from __future__ import annotations

import numpy as np

from .mc_core import (
    FinishWeeksSimulation,
    histogram_buckets,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
    throughput_reliability_metrics,
)
from .numpy_sample_index_draw_port import NumpySampleIndexDrawPort
from .sample_index_draw_port import SampleIndexDrawPort
from .simulation_models import (
    SimulationCommand,
    SimulationResult,
)
from .simulation_value_objects import (
    CompletionSummary,
    Histogram,
    SimulationPercentiles,
    ThroughputReliability,
)


def _prepare_samples(command: SimulationCommand) -> np.ndarray:
    return np.asarray(command.throughput_samples.usable_values, dtype=int)


def _run_engine(
    command: SimulationCommand,
    samples: np.ndarray,
    draw_port: SampleIndexDrawPort,
) -> tuple[np.ndarray | FinishWeeksSimulation, str]:
    if command.mode == "backlog_to_weeks":
        assert command.backlog_size is not None
        return (
            mc_finish_weeks(
                command.backlog_size.value,
                samples,
                command.n_sims.value,
                include_zero_weeks=True,
                draw_port=draw_port,
            ),
            "weeks",
        )

    assert command.target_weeks is not None
    return (
        mc_items_done_for_weeks(
            command.target_weeks.value,
            samples,
            command.n_sims.value,
            include_zero_weeks=True,
            draw_port=draw_port,
        ),
        "items",
    )


def run_simulation(command: SimulationCommand) -> SimulationResult:
    samples = _prepare_samples(command)
    draw_port = NumpySampleIndexDrawPort(command.seed)
    engine_result, result_kind = _run_engine(command, samples, draw_port)
    completion_summary = None
    distribution_values = engine_result
    percentile_values = engine_result
    percentile_total_count = None

    if isinstance(engine_result, FinishWeeksSimulation):
        completion_summary = CompletionSummary.create(
            completed_count=engine_result.completed_count,
            censored_count=engine_result.censored_count,
            n_sims=command.n_sims,
            horizon_weeks=engine_result.horizon_weeks,
        )
        distribution_values = engine_result.completed_weeks
        percentile_values = engine_result.completed_weeks
        percentile_total_count = int(engine_result.weeks_needed.size)

    result_percentiles = SimulationPercentiles.create(
        command.mode,
        percentiles(
            percentile_values,
            command.mode,
            ps=(50, 70, 90),
            total_count=percentile_total_count,
        ),
    )
    reliability_values = throughput_reliability_metrics(samples)
    throughput_reliability = ThroughputReliability.create(**reliability_values)
    expected_mass = (
        completion_summary.completed_count
        if completion_summary is not None
        else int(len(distribution_values))
    )

    return SimulationResult(
        result_kind=result_kind,
        result_percentiles=result_percentiles,
        result_distribution=Histogram.create(
            histogram_buckets(distribution_values),
            expected_mass=expected_mass,
        ),
        completion_summary=completion_summary,
        samples_count=int(len(samples)),
        throughput_reliability=throughput_reliability,
        seed=command.seed,
    )
