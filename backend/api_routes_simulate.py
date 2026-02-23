from fastapi import APIRouter, HTTPException
import numpy as np

from .api_models import SimulateRequest, SimulateResponse
from .mc_core import histogram_buckets, mc_finish_weeks, mc_items_done_for_weeks, percentiles


router = APIRouter()


@router.post("/simulate", response_model=SimulateResponse)
def simulate(req: SimulateRequest) -> SimulateResponse:
    samples = np.array(req.throughput_samples)
    samples = samples[samples > 0]
    if len(samples) < 6:
        raise HTTPException(422, "Historique insuffisant (moins de 6 semaines non nulles).")

    if req.mode == "backlog_to_weeks":
        if not req.backlog_size:
            raise HTTPException(400, "backlog_size requis.")
        result = mc_finish_weeks(req.backlog_size, samples, req.n_sims)
        kind = "weeks"
    else:
        if not req.target_weeks:
            raise HTTPException(400, "target_weeks requis.")
        result = mc_items_done_for_weeks(req.target_weeks, samples, req.n_sims)
        kind = "items"

    return SimulateResponse(
        result_kind=kind,
        result_percentiles=percentiles(result, ps=(50, 70, 90)),
        result_distribution=histogram_buckets(result),
        samples_count=int(len(samples)),
    )
