from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ...simulation_models import SimulationCommand, SimulationResult
from ...simulation_value_objects import (
    BacklogSize,
    CompletionSummary,
    Histogram,
    SimulationCount,
    SimulationHorizon,
    SimulationMode,
    SimulationPercentiles,
    SimulationSeed,
    ThroughputReliability,
)


@dataclass(frozen=True, slots=True)
class SimulationHistoryToSave:
    """A completed simulation ready to be saved for an opaque client identity."""

    client_id: str
    command: SimulationCommand
    result: SimulationResult


@dataclass(frozen=True, slots=True)
class SimulationHistoryQuery:
    """The opaque client filter used to read recent simulation history."""

    client_id: str


@dataclass(frozen=True, slots=True)
class SimulationHistoryEntry:
    """A storage-independent, minimized simulation history entry."""

    created_at: datetime
    last_seen: datetime
    mode: SimulationMode
    backlog_size: BacklogSize | None
    target_weeks: SimulationHorizon | None
    n_sims: SimulationCount
    samples_count: int
    percentiles: SimulationPercentiles
    risk_score: float | None
    distribution: Histogram
    completion_summary: CompletionSummary | None
    include_zero_weeks: bool
    throughput_reliability: ThroughputReliability | None
    seed: SimulationSeed | None
