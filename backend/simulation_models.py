from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Mapping, TypeAlias

SimulationMode: TypeAlias = Literal["backlog_to_weeks", "weeks_to_items"]
SimulationResultKind: TypeAlias = Literal["weeks", "items"]
ThroughputReliabilityLabel: TypeAlias = Literal[
    "fiable", "incertain", "fragile", "non fiable"
]


@dataclass(frozen=True)
class HistogramBucket:
    x: int
    count: int


@dataclass(frozen=True)
class CompletionSummary:
    completed_count: int
    censored_count: int
    censored_rate: float
    horizon_weeks: int


@dataclass(frozen=True)
class ThroughputReliability:
    cv: float
    iqr_ratio: float
    slope_norm: float
    label: ThroughputReliabilityLabel
    samples_count: int


@dataclass(frozen=True)
class SimulationCommand:
    throughput_samples: tuple[int, ...]
    include_zero_weeks: bool
    mode: SimulationMode
    backlog_size: int | None
    target_weeks: int | None
    n_sims: int
    seed: int


@dataclass(frozen=True)
class SimulationResult:
    result_kind: SimulationResultKind
    result_percentiles: Mapping[str, int]
    risk_score: float | None
    result_distribution: tuple[HistogramBucket, ...]
    completion_summary: CompletionSummary | None
    samples_count: int
    throughput_reliability: ThroughputReliability
    seed: int
