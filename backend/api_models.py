from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

SIMULATION_SEED_MIN = 0
SIMULATION_SEED_MAX = 4_294_967_295


class SimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    throughput_samples: List[int] = Field(..., min_length=6)
    include_zero_weeks: bool = False
    mode: Literal["backlog_to_weeks", "weeks_to_items"]
    backlog_size: Optional[int] = Field(default=None, ge=1)
    target_weeks: Optional[int] = Field(default=None, ge=1)
    n_sims: int = Field(default=20000, ge=1000, le=200000)
    seed: Optional[int] = Field(default=None, ge=SIMULATION_SEED_MIN, le=SIMULATION_SEED_MAX)


class DistributionBucket(BaseModel):
    x: int
    count: int


class ThroughputReliability(BaseModel):
    cv: float
    iqr_ratio: float
    slope_norm: float
    label: Literal["fiable", "incertain", "fragile", "non fiable"]
    samples_count: int


class CompletionSummary(BaseModel):
    completed_count: int
    censored_count: int
    censored_rate: float
    horizon_weeks: int


class SimulateResponse(BaseModel):
    result_kind: Literal["weeks", "items"]
    result_percentiles: Dict[str, int]
    risk_score: Optional[float] = None
    result_distribution: List[DistributionBucket]
    completion_summary: Optional[CompletionSummary] = None
    samples_count: int
    throughput_reliability: ThroughputReliability
    seed: int = Field(ge=SIMULATION_SEED_MIN, le=SIMULATION_SEED_MAX)


class SimulationHistoryItem(BaseModel):
    created_at: str
    last_seen: str
    mode: Literal["backlog_to_weeks", "weeks_to_items"]
    backlog_size: Optional[int] = None
    target_weeks: Optional[int] = None
    n_sims: int
    samples_count: int
    percentiles: Dict[str, int]
    distribution: List[DistributionBucket]
    completion_summary: Optional[CompletionSummary] = None
    include_zero_weeks: bool = False
    throughput_reliability: Optional[ThroughputReliability] = None
    seed: Optional[int] = Field(default=None, ge=SIMULATION_SEED_MIN, le=SIMULATION_SEED_MAX)
