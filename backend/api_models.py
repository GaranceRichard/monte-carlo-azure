from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, StrictBool, StrictInt, model_validator

from .simulation_limits import SIMULATION_SEED_MAX, SIMULATION_SEED_MIN
from .simulation_value_objects import (
    BacklogSize,
    SimulationCount,
    SimulationHorizon,
    StatisticalValueError,
    ThroughputSamples,
)

__all__ = [
    "SIMULATION_SEED_MAX",
    "SIMULATION_SEED_MIN",
    "CompletionSummary",
    "DistributionBucket",
    "SimulateRequest",
    "SimulateResponse",
    "SimulationHistoryItem",
    "ThroughputReliability",
]


class SimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    throughput_samples: List[StrictInt]
    include_zero_weeks: StrictBool = False
    mode: Literal["backlog_to_weeks", "weeks_to_items"]
    backlog_size: Optional[StrictInt] = None
    target_weeks: Optional[StrictInt] = None
    n_sims: StrictInt = 20000
    seed: Optional[StrictInt] = None

    @model_validator(mode="after")
    def validate_domain_contract(self) -> "SimulateRequest":
        try:
            ThroughputSamples.create(
                self.throughput_samples,
                self.include_zero_weeks,
            )
            SimulationCount(self.n_sims)
            if self.mode == "backlog_to_weeks":
                if self.backlog_size is None:
                    raise StatisticalValueError(
                        "backlog_size requis pour le mode backlog_to_weeks."
                    )
                BacklogSize(self.backlog_size)
            else:
                if self.target_weeks is None:
                    raise StatisticalValueError(
                        "target_weeks requis pour le mode weeks_to_items."
                    )
                SimulationHorizon(self.target_weeks)
        except StatisticalValueError as exc:
            if str(exc).startswith("Historique insuffisant"):
                return self
            raise
        return self


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
    seed: int


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
    seed: Optional[int] = None
