from __future__ import annotations

import numpy as np

from .histogram import build_histogram
from .mc_core import (
    SIMULATION_BATCH_SIZE,
    FinishWeeksSimulation,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
)
from .mca_prng_v1_sample_index_draw_port import McaPrngV1SampleIndexDrawPort
from .sample_index_draw_port import SampleIndexDrawPort
from .simulation_models import (
    SimulationCommand,
    SimulationResult,
)
from .simulation_value_objects import (
    CompletionSummary,
    Histogram,
    SimulationPercentiles,
)
from .throughput_reliability import calculate_throughput_reliability


def _prepare_samples(command: SimulationCommand) -> np.ndarray:
    return np.asarray(command.throughput_samples.usable_values, dtype=int)


def _run_engine(
    command: SimulationCommand,
    samples: np.ndarray,
    draw_port: SampleIndexDrawPort,
    *,
    batch_size: int,
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
                batch_size=batch_size,
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
            batch_size=batch_size,
        ),
        "items",
    )


def run_simulation(command: SimulationCommand) -> SimulationResult:
    return run_simulation_with_batch_size(
        command,
        batch_size=SIMULATION_BATCH_SIZE,
    )


def _resolve_result_population(
    command: SimulationCommand,
    engine_result: np.ndarray | FinishWeeksSimulation,
) -> tuple[CompletionSummary | None, np.ndarray, int | None]:
    if not isinstance(engine_result, FinishWeeksSimulation):
        return None, engine_result, None
    completion_summary = CompletionSummary.create(
        completed_count=engine_result.completed_count,
        censored_count=engine_result.censored_count,
        n_sims=command.n_sims,
        horizon_weeks=engine_result.horizon_weeks,
    )
    return (
        completion_summary,
        engine_result.completed_weeks,
        engine_result.simulation_count,
    )


def run_simulation_with_batch_size(
    command: SimulationCommand,
    *,
    batch_size: int,
) -> SimulationResult:
    samples = _prepare_samples(command)
    draw_port = McaPrngV1SampleIndexDrawPort(command.seed)
    engine_result, result_kind = _run_engine(
        command,
        samples,
        draw_port,
        batch_size=batch_size,
    )
    completion_summary, distribution_values, percentile_total_count = _resolve_result_population(
        command, engine_result
    )
    result_percentiles = SimulationPercentiles.create(
        command.mode,
        percentiles(
            distribution_values,
            command.mode,
            ps=(50, 70, 90),
            total_count=percentile_total_count,
        ),
    )
    throughput_reliability = calculate_throughput_reliability(
        command.throughput_samples.usable_values
    )
    expected_mass = (
        completion_summary.completed_count
        if completion_summary is not None
        else int(len(distribution_values))
    )

    return SimulationResult(
        result_kind=result_kind,
        result_percentiles=result_percentiles,
        result_distribution=Histogram.create(
            build_histogram(distribution_values),
            expected_mass=expected_mass,
        ),
        completion_summary=completion_summary,
        samples_count=int(len(samples)),
        throughput_reliability=throughput_reliability,
        seed=command.seed,
    )
