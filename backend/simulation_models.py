from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

from .simulation_value_objects import (
    BacklogSize,
    CompletionSummary,
    Histogram,
    SimulationCount,
    SimulationHorizon,
    SimulationMode,
    SimulationPercentiles,
    SimulationSeed,
    StatisticalValueError,
    ThroughputReliability,
    ThroughputSamples,
)

SimulationResultKind: TypeAlias = Literal["weeks", "items"]


@dataclass(frozen=True, slots=True)
class SimulationCommand:
    throughput_samples: ThroughputSamples
    mode: SimulationMode
    backlog_size: BacklogSize | None
    target_weeks: SimulationHorizon | None
    n_sims: SimulationCount
    seed: SimulationSeed

    def __post_init__(self) -> None:
        if not isinstance(self.throughput_samples, ThroughputSamples):
            raise StatisticalValueError("throughput_samples doit etre un Value Object.")
        if not isinstance(self.n_sims, SimulationCount):
            raise StatisticalValueError("n_sims doit etre un Value Object.")
        if not isinstance(self.seed, SimulationSeed):
            raise StatisticalValueError("seed doit etre un Value Object.")
        if self.mode == "backlog_to_weeks":
            if not isinstance(self.backlog_size, BacklogSize) or self.target_weeks is not None:
                raise StatisticalValueError(
                    "backlog_to_weeks doit contenir uniquement un backlog actif."
                )
        elif self.mode == "weeks_to_items":
            if (
                not isinstance(self.target_weeks, SimulationHorizon)
                or self.backlog_size is not None
            ):
                raise StatisticalValueError(
                    "weeks_to_items doit contenir uniquement un horizon actif."
                )
        else:
            raise StatisticalValueError("mode de simulation invalide.")

    @classmethod
    def create(
        cls,
        *,
        throughput_samples: object,
        include_zero_weeks: object,
        mode: object,
        backlog_size: object | None,
        target_weeks: object | None,
        n_sims: object,
        seed: SimulationSeed,
    ) -> SimulationCommand:
        if not isinstance(seed, SimulationSeed):
            raise StatisticalValueError("seed doit etre un Value Object resolu.")
        if mode not in ("backlog_to_weeks", "weeks_to_items"):
            raise StatisticalValueError("mode de simulation invalide.")
        if not isinstance(throughput_samples, (list, tuple)):
            raise StatisticalValueError(
                "throughput_samples doit etre une collection."
            )
        samples = ThroughputSamples.create(
            throughput_samples,
            include_zero_weeks,
        )
        simulation_count = SimulationCount(n_sims)
        if mode == "backlog_to_weeks":
            if backlog_size is None:
                raise StatisticalValueError(
                    "backlog_size requis pour le mode backlog_to_weeks."
                )
            return cls(
                samples,
                mode,
                BacklogSize(backlog_size),
                None,
                simulation_count,
                seed,
            )
        if target_weeks is None:
            raise StatisticalValueError(
                "target_weeks requis pour le mode weeks_to_items."
            )
        return cls(
            samples,
            mode,
            None,
            SimulationHorizon(target_weeks),
            simulation_count,
            seed,
        )

    @property
    def include_zero_weeks(self) -> bool:
        return self.throughput_samples.include_zero_weeks


@dataclass(frozen=True, slots=True)
class SimulationResult:
    result_kind: SimulationResultKind
    result_percentiles: SimulationPercentiles
    result_distribution: Histogram
    completion_summary: CompletionSummary | None
    samples_count: int
    throughput_reliability: ThroughputReliability
    seed: SimulationSeed

    def _validate_value_objects(self) -> None:
        if not isinstance(self.result_percentiles, SimulationPercentiles):
            raise StatisticalValueError("result_percentiles doit etre un Value Object.")
        if not isinstance(self.result_distribution, Histogram):
            raise StatisticalValueError("result_distribution doit etre un Value Object.")
        if not isinstance(self.throughput_reliability, ThroughputReliability):
            raise StatisticalValueError("throughput_reliability doit etre un Value Object.")
        if not isinstance(self.seed, SimulationSeed):
            raise StatisticalValueError("seed doit etre un Value Object.")
        if self.completion_summary is not None and not isinstance(
            self.completion_summary,
            CompletionSummary,
        ):
            raise StatisticalValueError("completion_summary doit etre un Value Object.")

    def _validate_counts(self) -> None:
        if type(self.samples_count) is not int or self.samples_count < 0:
            raise StatisticalValueError("samples_count doit etre un entier >= 0.")
        if self.samples_count != self.throughput_reliability.samples_count:
            raise StatisticalValueError(
                "samples_count doit correspondre a throughput_reliability."
            )

    def _validate_weeks_result(self) -> None:
        if self.result_percentiles.mode != "backlog_to_weeks":
            raise StatisticalValueError("Percentiles incompatibles avec result_kind.")
        if self.completion_summary is None:
            raise StatisticalValueError(
                "completion_summary est requis pour backlog_to_weeks."
            )
        if (
            sum(bucket.count for bucket in self.result_distribution)
            != self.completion_summary.completed_count
        ):
            raise StatisticalValueError(
                "result_distribution doit conserver la masse des simulations terminees."
            )

    def _validate_items_result(self) -> None:
        if self.result_percentiles.mode != "weeks_to_items":
            raise StatisticalValueError("Percentiles incompatibles avec result_kind.")
        if self.completion_summary is not None:
            raise StatisticalValueError(
                "completion_summary est interdit pour weeks_to_items."
            )

    def __post_init__(self) -> None:
        self._validate_value_objects()
        self._validate_counts()
        if self.result_kind == "weeks":
            self._validate_weeks_result()
            return
        if self.result_kind == "items":
            self._validate_items_result()
            return
        raise StatisticalValueError("result_kind invalide.")

    @property
    def risk_score(self) -> float | None:
        return self.result_percentiles.risk_score
