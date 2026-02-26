import numpy as np
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter

from .api_config import get_api_config
from .api_models import SimulateRequest, SimulateResponse
from .mc_core import (
    histogram_buckets,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
)

router = APIRouter()
cfg = get_api_config()


def _client_key_from_request(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "").strip()
    if xff:
        return xff.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


limiter = Limiter(
    key_func=_client_key_from_request,
    storage_uri=cfg.rate_limit_storage_url,
)


@router.post("/simulate", response_model=SimulateResponse)
@limiter.limit(cfg.rate_limit_simulate)
def simulate(request: Request, req: SimulateRequest) -> SimulateResponse:
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
