import asyncio
import json
import logging
import secrets
import time

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from starlette.concurrency import run_in_threadpool

from .api_config import get_api_config
from .api_models import (
    SIMULATION_SEED_MAX,
    SimulateRequest,
    SimulateResponse,
    SimulationHistoryItem,
)
from .simulation_mappers import (
    persistence_row_to_history_item,
    request_to_command,
    result_to_response,
)
from .simulation_models import SimulationCommand, SimulationResult
from .simulation_service import InsufficientSimulationSamplesError, run_simulation
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


def _resolve_simulation_seed(requested_seed: int | None) -> int:
    if requested_seed is not None:
        return requested_seed
    return secrets.randbelow(SIMULATION_SEED_MAX + 1)


def _persist_simulation(
    mc_client_id: str,
    command: SimulationCommand,
    result: SimulationResult,
) -> None:
    if not simulation_store.enabled or not mc_client_id:
        return

    try:
        simulation_store.save_simulation(mc_client_id, command, result)
    except Exception as exc:
        logger.warning(
            "Simulation persistence failed; returning computed result without history entry.",
            extra={
                "event": "simulation_persistence_failed",
                "mode": command.mode,
                "n_sims": command.n_sims,
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
    command = request_to_command(req, seed)

    try:
        result = await asyncio.wait_for(
            run_in_threadpool(run_simulation, command),
            timeout=cfg.forecast_timeout_seconds,
        )
    except InsufficientSimulationSamplesError as exc:
        raise HTTPException(422, str(exc)) from exc
    except TimeoutError as exc:
        logger.warning(
            json.dumps(
                {
                    "event": "simulation_timeout",
                    "mode": req.mode,
                    "n_sims": req.n_sims,
                    "timeout_seconds": cfg.forecast_timeout_seconds,
                    "samples_count": len(command.throughput_samples),
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                },
                ensure_ascii=True,
            )
        )
        raise HTTPException(
            503,
            "Simulation trop longue. Reessayez avec moins de simulations ou plus tard.",
        ) from exc

    response_model = result_to_response(result)

    mc_client_id = (request.cookies.get(cfg.client_cookie_name) or "").strip()
    if mc_client_id and simulation_store.enabled:
        background_tasks.add_task(_persist_simulation, mc_client_id, command, result)

    logger.info(
        json.dumps(
            {
                "event": "simulation_completed",
                "mode": req.mode,
                "n_sims": req.n_sims,
                "samples_count": result.samples_count,
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
        return [persistence_row_to_history_item(row) for row in rows]
    except Exception as exc:
        raise HTTPException(503, "Historique indisponible temporairement.") from exc
