import asyncio
import json
import logging
import secrets
import time

import numpy as np
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from starlette.concurrency import run_in_threadpool

from .api_config import get_api_config
from .api_models import (
    SIMULATION_SEED_MAX,
    CompletionSummary,
    SimulateRequest,
    SimulateResponse,
    SimulationHistoryItem,
    ThroughputReliability,
)
from .mc_core import (
    FinishWeeksSimulation,
    histogram_buckets,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
    risk_score,
    throughput_reliability,
)
from .simulation_store import SimulationStore

router = APIRouter()
cfg = get_api_config()
simulation_store = SimulationStore(cfg)
logger = logging.getLogger(__name__)
RATE_LIMIT_STORAGE_WARNING_INTERVAL_SECONDS = 5.0


class ObservableLimiter(Limiter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.logger = logger
        self._storage_warning_active = False
        self._storage_warning_last_logged_at = 0.0

    def _warning_interval_elapsed(self) -> bool:
        return (
            time.monotonic() - self._storage_warning_last_logged_at
            >= RATE_LIMIT_STORAGE_WARNING_INTERVAL_SECONDS
        )

    def _log_storage_warning(self, exc: Exception) -> None:
        if self._storage_warning_active and not self._warning_interval_elapsed():
            return
        self._storage_warning_active = True
        self._storage_warning_last_logged_at = time.monotonic()
        logger.warning(
            "Rate limit storage unreachable; allowing requests without shared throttling.",
            exc_info=exc,
        )

    def _log_storage_recovery(self) -> None:
        if not self._storage_warning_active:
            return
        self._storage_warning_active = False
        logger.warning("Rate limit storage recovered; shared throttling restored.")

    def check_storage(self) -> bool:
        if self._storage_uri == "memory://":
            return True
        try:
            available = bool(self._storage.check())
        except Exception as exc:
            self._log_storage_warning(exc)
            return False
        if available:
            self._log_storage_recovery()
            return True
        self._log_storage_warning(RuntimeError("storage healthcheck returned false"))
        return False

    def _check_request_limit(
        self,
        request: Request,
        endpoint_func=None,
        in_middleware=True,
    ) -> None:
        if self._storage_warning_active and not self.check_storage():
            request.state.view_rate_limit = None
            return
        try:
            super()._check_request_limit(request, endpoint_func, in_middleware)
        except RateLimitExceeded:
            raise
        except Exception as exc:
            self._log_storage_warning(exc)
            request.state.view_rate_limit = None
            return
        self._log_storage_recovery()


def _client_key_from_request(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "").strip()
    if xff:
        return xff.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


limiter = ObservableLimiter(
    key_func=_client_key_from_request,
    storage_uri=cfg.rate_limit_storage_url,
)


def _compute_simulation_result(
    req: SimulateRequest,
    samples: np.ndarray,
    seed: int,
) -> tuple[np.ndarray | FinishWeeksSimulation, str]:
    if req.mode == "backlog_to_weeks":
        if not req.backlog_size:
            raise HTTPException(400, "backlog_size requis.")
        return (
            mc_finish_weeks(
                req.backlog_size,
                samples,
                req.n_sims,
                include_zero_weeks=req.include_zero_weeks,
                seed=seed,
            ),
            "weeks",
        )

    if not req.target_weeks:
        raise HTTPException(400, "target_weeks requis.")
    return (
        mc_items_done_for_weeks(
            req.target_weeks,
            samples,
            req.n_sims,
            include_zero_weeks=req.include_zero_weeks,
            seed=seed,
        ),
        "items",
    )


def _resolve_simulation_seed(requested_seed: int | None) -> int:
    if requested_seed is not None:
        return requested_seed
    return secrets.randbelow(SIMULATION_SEED_MAX + 1)


def _persist_simulation(
    mc_client_id: str,
    req: SimulateRequest,
    response_model: SimulateResponse,
) -> None:
    if not simulation_store.enabled or not mc_client_id:
        return

    try:
        simulation_store.save_simulation(mc_client_id, req, response_model)
    except Exception as exc:
        logger.warning(
            "Simulation persistence failed; returning computed result without history entry.",
            extra={
                "event": "simulation_persistence_failed",
                "mode": req.mode,
                "n_sims": req.n_sims,
                "client_id_prefix": mc_client_id[:8],
            },
            exc_info=exc,
        )


@router.post("/simulate", response_model=SimulateResponse, response_model_exclude_none=True)
@limiter.limit(cfg.rate_limit_simulate)
async def simulate(
    request: Request,
    req: SimulateRequest,
    background_tasks: BackgroundTasks,
) -> SimulateResponse:
    started_at = time.perf_counter()
    seed = _resolve_simulation_seed(req.seed)
    samples = np.array(req.throughput_samples)
    if req.include_zero_weeks:
        samples = samples[samples >= 0]
    else:
        samples = samples[samples > 0]
    if len(samples) < 6:
        detail = (
            "Historique insuffisant (moins de 6 semaines)."
            if req.include_zero_weeks
            else "Historique insuffisant (moins de 6 semaines non nulles)."
        )
        raise HTTPException(422, detail)

    try:
        result, kind = await asyncio.wait_for(
            run_in_threadpool(_compute_simulation_result, req, samples, seed),
            timeout=cfg.forecast_timeout_seconds,
        )
    except TimeoutError as exc:
        logger.warning(
            json.dumps(
                {
                    "event": "simulation_timeout",
                    "mode": req.mode,
                    "n_sims": req.n_sims,
                    "timeout_seconds": cfg.forecast_timeout_seconds,
                    "samples_count": int(len(samples)),
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                },
                ensure_ascii=True,
            )
        )
        raise HTTPException(
            503,
            "Simulation trop longue. Reessayez avec moins de simulations ou plus tard.",
        ) from exc

    completion_summary = None
    distribution_values = result
    percentile_values = result
    percentile_total_count = None
    if isinstance(result, FinishWeeksSimulation):
        completion_summary = CompletionSummary(
            completed_count=result.completed_count,
            censored_count=result.censored_count,
            censored_rate=round(result.censored_rate, 4),
            horizon_weeks=result.horizon_weeks,
        )
        distribution_values = result.completed_weeks
        percentile_values = result.completed_weeks
        percentile_total_count = int(result.weeks_needed.size)

    simulation_percentiles = percentiles(
        percentile_values,
        req.mode,
        ps=(50, 70, 90),
        total_count=percentile_total_count,
    )
    p50 = simulation_percentiles.get("P50")
    p90 = simulation_percentiles.get("P90")
    reliability = ThroughputReliability(**throughput_reliability(samples))
    response_model = SimulateResponse(
        result_kind=kind,
        result_percentiles=simulation_percentiles,
        risk_score=risk_score(req.mode, p50, p90),
        result_distribution=histogram_buckets(distribution_values),
        completion_summary=completion_summary,
        samples_count=int(len(samples)),
        throughput_reliability=reliability,
        seed=seed,
    )

    mc_client_id = (request.cookies.get(cfg.client_cookie_name) or "").strip()
    if mc_client_id and simulation_store.enabled:
        background_tasks.add_task(_persist_simulation, mc_client_id, req, response_model)

    logger.info(
        json.dumps(
            {
                "event": "simulation_completed",
                "mode": req.mode,
                "n_sims": req.n_sims,
                "samples_count": response_model.samples_count,
                "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            },
            ensure_ascii=True,
        )
    )

    return response_model


@router.get("/simulations/history", response_model=list[SimulationHistoryItem])
def simulation_history(request: Request) -> list[SimulationHistoryItem]:
    mc_client_id = (request.cookies.get(cfg.client_cookie_name) or "").strip()
    if not mc_client_id:
        return []
    if not simulation_store.enabled:
        return []

    try:
        rows = simulation_store.list_recent(mc_client_id)
        return [SimulationHistoryItem(**row) for row in rows]
    except Exception as exc:
        raise HTTPException(503, "Historique indisponible temporairement.") from exc
