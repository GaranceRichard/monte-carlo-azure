import numpy as np
from fastapi import APIRouter, HTTPException, Request

from .api_models import SimulateRequest, SimulateResponse
from .mc_core import (
    histogram_buckets,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
)
from .rate_limiter import SlidingWindowRateLimiter, client_key_from_request

router = APIRouter()

RATE_LIMIT_MAX_REQUESTS_PER_MINUTE = 20
RATE_LIMIT_WINDOW_SECONDS = 60.0

_rate_limiter = SlidingWindowRateLimiter(
    max_requests=RATE_LIMIT_MAX_REQUESTS_PER_MINUTE,
    window_seconds=RATE_LIMIT_WINDOW_SECONDS,
)


@router.post("/simulate", response_model=SimulateResponse)
def simulate(req: SimulateRequest, request: Request) -> SimulateResponse:
    if not _rate_limiter.allow(client_key_from_request(request)):
        raise HTTPException(
            429,
            "Trop de requetes sur /simulate. Reessayez dans quelques instants.",
        )

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

    return SimulateResponse(
        result_kind=kind,
        result_percentiles=percentiles(result, ps=(50, 70, 90)),
        result_distribution=histogram_buckets(result),
        samples_count=int(len(samples)),
    )
