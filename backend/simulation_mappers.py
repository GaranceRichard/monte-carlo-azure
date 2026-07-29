from __future__ import annotations

from typing import Any, Mapping

from .api_models import SimulateRequest, SimulateResponse, SimulationHistoryItem
from .simulation_models import SimulationCommand, SimulationResult
from .simulation_value_objects import SimulationSeed


def request_to_command(
    request: SimulateRequest,
    resolved_seed: SimulationSeed,
) -> SimulationCommand:
    return SimulationCommand.create(
        throughput_samples=request.throughput_samples,
        include_zero_weeks=request.include_zero_weeks,
        mode=request.mode,
        backlog_size=request.backlog_size,
        target_weeks=request.target_weeks,
        n_sims=request.n_sims,
        seed=resolved_seed,
    )


def result_to_response(result: SimulationResult) -> SimulateResponse:
    values: dict[str, Any] = {
        "result_kind": result.result_kind,
        "result_percentiles": result.result_percentiles.to_dict(),
        "result_distribution": [
            {"x": bucket.x, "count": bucket.count}
            for bucket in result.result_distribution.buckets
        ],
        "samples_count": result.samples_count,
        "throughput_reliability": {
            "cv": result.throughput_reliability.cv,
            "iqr_ratio": result.throughput_reliability.iqr_ratio,
            "slope_norm": result.throughput_reliability.slope_norm,
            "label": result.throughput_reliability.label,
            "samples_count": result.throughput_reliability.samples_count,
        },
        "seed": result.seed.value,
    }
    if result.risk_score is not None:
        values["risk_score"] = result.risk_score
    if result.completion_summary is not None:
        values["completion_summary"] = {
            "completed_count": result.completion_summary.completed_count,
            "censored_count": result.completion_summary.censored_count,
            "censored_rate": result.completion_summary.censored_rate,
            "horizon_weeks": result.completion_summary.horizon_weeks,
        }
    return SimulateResponse(**values)


def persistence_row_to_history_item(
    row: Mapping[str, Any],
) -> SimulationHistoryItem:
    return SimulationHistoryItem(**row)
