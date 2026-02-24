from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class SimulateRequest(BaseModel):
    throughput_samples: List[int] = Field(..., min_length=6)
    include_zero_weeks: bool = False
    mode: Literal["backlog_to_weeks", "weeks_to_items"]
    backlog_size: Optional[int] = Field(default=None, ge=1)
    target_weeks: Optional[int] = Field(default=None, ge=1)
    n_sims: int = Field(default=20000, ge=1000, le=200000)


class DistributionBucket(BaseModel):
    x: int
    count: int


class SimulateResponse(BaseModel):
    result_kind: Literal["weeks", "items"]
    result_percentiles: Dict[str, int]
    result_distribution: List[DistributionBucket]
    samples_count: int
