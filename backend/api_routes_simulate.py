import json
import logging
import time

import numpy as np
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from .api_config import get_api_config
from .api_models import SimulateRequest, SimulateResponse, SimulationHistoryItem
from .mc_core import (
    histogram_buckets,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
    risk_score,
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


@router.post("/simulate", response_model=SimulateResponse)
@limiter.limit(cfg.rate_limit_simulate)
def simulate(request: Request, req: SimulateRequest) -> SimulateResponse:
    started_at = time.perf_counter()
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

    if req.mode == "backlog_to_weeks":
        if not req.backlog_size:
            raise HTTPException(400, "backlog_size requis.")
        result = mc_finish_weeks(
            req.backlog_size,
            samples,
            req.n_sims,
            include_zero_weeks=req.include_zero_weeks,
        )
        kind = "weeks"
    else:
        if not req.target_weeks:
            raise HTTPException(400, "target_weeks requis.")
        result = mc_items_done_for_weeks(
            req.target_weeks,
            samples,
            req.n_sims,
            include_zero_weeks=req.include_zero_weeks,
        )
        kind = "items"

    simulation_percentiles = percentiles(result, ps=(50, 70, 90))
    response_model = SimulateResponse(
        result_kind=kind,
        result_percentiles={
            "P50": simulation_percentiles["P50"],
            "P70": simulation_percentiles["P70"],
            "P90": simulation_percentiles["P90"],
        },
        risk_score=risk_score(
            req.mode,
            simulation_percentiles["P50"],
            simulation_percentiles["P90"],
        ),
        result_distribution=histogram_buckets(result),
        samples_count=int(len(samples)),
    )

    mc_client_id = (request.cookies.get(cfg.client_cookie_name) or "").strip()
    if simulation_store.enabled and mc_client_id:
        try:
            simulation_store.save_simulation(mc_client_id, req, response_model)
        except Exception as exc:
            raise HTTPException(
                503,
                "Persistence Mongo indisponible. Reessayez plus tard.",
            ) from exc

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
