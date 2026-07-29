from collections.abc import Mapping
from typing import Dict, List, Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    FiniteFloat,
    StrictBool,
    StrictInt,
    model_validator,
)

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
                if "target_weeks" in self.model_fields_set:
                    raise StatisticalValueError(
                        "target_weeks doit etre absent pour le mode backlog_to_weeks."
                    )
                BacklogSize(self.backlog_size)
            else:
                if self.target_weeks is None:
                    raise StatisticalValueError(
                        "target_weeks requis pour le mode weeks_to_items."
                    )
                if "backlog_size" in self.model_fields_set:
                    raise StatisticalValueError(
                        "backlog_size doit etre absent pour le mode weeks_to_items."
                    )
                SimulationHorizon(self.target_weeks)
        except StatisticalValueError as exc:
            if str(exc).startswith("Historique insuffisant"):
                return self
            raise
        return self


class DistributionBucket(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: StrictInt
    count: StrictInt


class ResultPercentiles(BaseModel):
    model_config = ConfigDict(extra="forbid")

    P50: Optional[StrictInt] = None
    P70: Optional[StrictInt] = None
    P90: Optional[StrictInt] = None

    @model_validator(mode="before")
    @classmethod
    def reject_null_percentiles(cls, value):
        if isinstance(value, Mapping) and any(item is None for item in value.values()):
            raise ValueError("Un percentile absent doit etre omis.")
        return value


class ThroughputReliability(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cv: FiniteFloat
    iqr_ratio: FiniteFloat
    slope_norm: FiniteFloat
    label: Literal["fiable", "incertain", "fragile", "non fiable"]
    samples_count: StrictInt


class CompletionSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    completed_count: StrictInt
    censored_count: StrictInt
    censored_rate: FiniteFloat
    horizon_weeks: StrictInt


class SimulateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result_kind: Literal["weeks", "items"]
    result_percentiles: ResultPercentiles
    risk_score: Optional[FiniteFloat] = Field(default=None, ge=0)
    result_distribution: List[DistributionBucket]
    completion_summary: Optional[CompletionSummary] = None
    samples_count: StrictInt
    throughput_reliability: ThroughputReliability
    seed: StrictInt

    @model_validator(mode="before")
    @classmethod
    def reject_null_optional_results(cls, value):
        if isinstance(value, Mapping):
            for field_name in ("risk_score", "completion_summary"):
                if field_name in value and value[field_name] is None:
                    raise ValueError(f"{field_name} absent doit etre omis.")
        return value

    @model_validator(mode="after")
    def validate_canonical_shape(self) -> "SimulateResponse":
        if self.result_kind == "weeks" and self.completion_summary is None:
            raise ValueError("completion_summary est requis pour backlog_to_weeks.")
        if self.result_kind == "items" and self.completion_summary is not None:
            raise ValueError("completion_summary est interdit pour weeks_to_items.")
        if self.samples_count != self.throughput_reliability.samples_count:
            raise ValueError(
                "samples_count doit correspondre a throughput_reliability."
            )
        return self


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
