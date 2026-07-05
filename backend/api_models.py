from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .simulation_limits import (
    SIMULATION_BACKLOG_SIZE_MAX,
    SIMULATION_BACKLOG_SIZE_MIN,
    SIMULATION_HORIZON_WEEKS_MAX,
    SIMULATION_N_SIMS_MAX,
    SIMULATION_N_SIMS_MIN,
    SIMULATION_TARGET_WEEKS_MIN,
    SIMULATION_THROUGHPUT_SAMPLES_MAX,
    SIMULATION_THROUGHPUT_SAMPLES_MIN,
)

SIMULATION_SEED_MIN = 0
SIMULATION_SEED_MAX = 4_294_967_295


class SimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    throughput_samples: List[int]
    include_zero_weeks: bool = False
    mode: Literal["backlog_to_weeks", "weeks_to_items"]
    backlog_size: Optional[int] = None
    target_weeks: Optional[int] = None
    n_sims: int = 20000
    seed: Optional[int] = Field(default=None, ge=SIMULATION_SEED_MIN, le=SIMULATION_SEED_MAX)

    @field_validator("throughput_samples")
    @classmethod
    def validate_throughput_samples(cls, value: List[int]) -> List[int]:
        if not (
            SIMULATION_THROUGHPUT_SAMPLES_MIN
            <= len(value)
            <= SIMULATION_THROUGHPUT_SAMPLES_MAX
        ):
            raise ValueError(
                "throughput_samples doit contenir entre "
                f"{SIMULATION_THROUGHPUT_SAMPLES_MIN} et {SIMULATION_THROUGHPUT_SAMPLES_MAX} valeurs."
            )
        return value

    @field_validator("backlog_size")
    @classmethod
    def validate_backlog_size(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and not (
            SIMULATION_BACKLOG_SIZE_MIN <= value <= SIMULATION_BACKLOG_SIZE_MAX
        ):
            raise ValueError(
                "backlog_size doit etre compris entre "
                f"{SIMULATION_BACKLOG_SIZE_MIN} et {SIMULATION_BACKLOG_SIZE_MAX}."
            )
        return value

    @field_validator("target_weeks")
    @classmethod
    def validate_target_weeks(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and not (
            SIMULATION_TARGET_WEEKS_MIN <= value <= SIMULATION_HORIZON_WEEKS_MAX
        ):
            raise ValueError(
                "target_weeks doit etre compris entre "
                f"{SIMULATION_TARGET_WEEKS_MIN} et {SIMULATION_HORIZON_WEEKS_MAX}."
            )
        return value

    @field_validator("n_sims")
    @classmethod
    def validate_n_sims(cls, value: int) -> int:
        if not SIMULATION_N_SIMS_MIN <= value <= SIMULATION_N_SIMS_MAX:
            raise ValueError(
                f"n_sims doit etre compris entre {SIMULATION_N_SIMS_MIN} et {SIMULATION_N_SIMS_MAX}."
            )
        return value

    @model_validator(mode="after")
    def validate_mode_requirements(self) -> "SimulateRequest":
        if self.mode == "backlog_to_weeks" and self.backlog_size is None:
            raise ValueError("backlog_size requis pour le mode backlog_to_weeks.")
        if self.mode == "weeks_to_items" and self.target_weeks is None:
            raise ValueError("target_weeks requis pour le mode weeks_to_items.")
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
