from __future__ import annotations

from typing import cast

import numpy as np

from .mc_core import (
    FinishWeeksSimulation,
    histogram_buckets,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
    risk_score,
    throughput_reliability,
)
from .simulation_limits import SIMULATION_THROUGHPUT_SAMPLES_MIN
from .simulation_models import (
    CompletionSummary,
    HistogramBucket,
    SimulationCommand,
    SimulationResult,
    ThroughputReliability,
    ThroughputReliabilityLabel,
)


class InsufficientSimulationSamplesError(ValueError):
    pass


def _prepare_samples(command: SimulationCommand) -> np.ndarray:
    samples = np.array(command.throughput_samples)
    if command.include_zero_weeks:
        samples = samples[samples >= 0]
    else:
        samples = samples[samples > 0]
    if len(samples) < SIMULATION_THROUGHPUT_SAMPLES_MIN:
        detail = (
            f"Historique insuffisant (moins de {SIMULATION_THROUGHPUT_SAMPLES_MIN} semaines)."
            if command.include_zero_weeks
            else (
                "Historique insuffisant (moins de "
                f"{SIMULATION_THROUGHPUT_SAMPLES_MIN} semaines non nulles)."
            )
        )
        raise InsufficientSimulationSamplesError(detail)
    return samples


def _run_engine(
    command: SimulationCommand, samples: np.ndarray
) -> tuple[np.ndarray | FinishWeeksSimulation, str]:
    if command.mode == "backlog_to_weeks":
        assert command.backlog_size is not None
        return (
            mc_finish_weeks(
                command.backlog_size,
                samples,
                command.n_sims,
                include_zero_weeks=command.include_zero_weeks,
                seed=command.seed,
            ),
            "weeks",
        )

    assert command.target_weeks is not None
    return (
        mc_items_done_for_weeks(
            command.target_weeks,
            samples,
            command.n_sims,
            include_zero_weeks=command.include_zero_weeks,
            seed=command.seed,
        ),
        "items",
    )


def run_simulation(command: SimulationCommand) -> SimulationResult:
    samples = _prepare_samples(command)
    engine_result, result_kind = _run_engine(command, samples)
    completion_summary = None
    distribution_values = engine_result
    percentile_values = engine_result
    percentile_total_count = None

    if isinstance(engine_result, FinishWeeksSimulation):
        completion_summary = CompletionSummary(
            completed_count=engine_result.completed_count,
            censored_count=engine_result.censored_count,
            censored_rate=round(engine_result.censored_rate, 4),
            horizon_weeks=engine_result.horizon_weeks,
        )
        distribution_values = engine_result.completed_weeks
        percentile_values = engine_result.completed_weeks
        percentile_total_count = int(engine_result.weeks_needed.size)

    result_percentiles = percentiles(
        percentile_values,
        command.mode,
        ps=(50, 70, 90),
        total_count=percentile_total_count,
    )
    p50 = result_percentiles.get("P50")
    p90 = result_percentiles.get("P90")
    reliability_values = throughput_reliability(samples)

    return SimulationResult(
        result_kind=result_kind,
        result_percentiles=result_percentiles,
        risk_score=risk_score(command.mode, p50, p90),
        result_distribution=tuple(
            HistogramBucket(x=bucket["x"], count=bucket["count"])
            for bucket in histogram_buckets(distribution_values)
        ),
        completion_summary=completion_summary,
        samples_count=int(len(samples)),
        throughput_reliability=ThroughputReliability(
            cv=float(reliability_values["cv"]),
            iqr_ratio=float(reliability_values["iqr_ratio"]),
            slope_norm=float(reliability_values["slope_norm"]),
            label=cast(ThroughputReliabilityLabel, reliability_values["label"]),
            samples_count=int(reliability_values["samples_count"]),
        ),
        seed=command.seed,
    )
