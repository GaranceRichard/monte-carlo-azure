from pathlib import Path

import pytest

from backend.simulation_models import SimulationResult
from backend.simulation_value_objects import (
    CompletionSummary,
    Histogram,
    SimulationCount,
    SimulationPercentiles,
    SimulationSeed,
    StatisticalValueError,
    ThroughputReliability,
)


def _valid_result_values():
    percentiles = SimulationPercentiles.create(
        "backlog_to_weeks",
        {"P50": 5, "P70": 7, "P90": 9},
    )
    reliability = ThroughputReliability.create(
        cv=0.2,
        iqr_ratio=0.3,
        slope_norm=0,
        samples_count=6,
        label="fiable",
    )
    completion = CompletionSummary.create(
        completed_count=1000,
        censored_count=0,
        n_sims=SimulationCount(1000),
    )
    histogram = Histogram.create([{"x": 5, "count": 1000}], expected_mass=1000)
    return percentiles, reliability, completion, histogram


def test_simulation_result_protects_cross_value_object_invariants():
    percentiles, reliability, completion, histogram = _valid_result_values()
    result = SimulationResult(
        result_kind="weeks",
        result_percentiles=percentiles,
        result_distribution=histogram,
        completion_summary=completion,
        samples_count=6,
        throughput_reliability=reliability,
        seed=SimulationSeed(1),
    )
    assert result.risk_score == 0.8

    invalid_values = [
        {"result_percentiles": {"P50": 5}},
        {"result_distribution": ({"x": 5, "count": 1000},)},
        {"throughput_reliability": {"samples_count": 6}},
        {"seed": 1},
        {"completion_summary": {"completed_count": 1000, "censored_count": 0}},
        {"samples_count": -1},
        {"samples_count": True},
        {"samples_count": 7},
        {"completion_summary": None},
        {
            "result_percentiles": SimulationPercentiles.create(
                "weeks_to_items",
                {"P50": 9, "P70": 7, "P90": 5},
            )
        },
        {"result_kind": "invalid"},
    ]
    for overrides in invalid_values:
        values = {
            "result_kind": "weeks",
            "result_percentiles": percentiles,
            "result_distribution": histogram,
            "completion_summary": completion,
            "samples_count": 6,
            "throughput_reliability": reliability,
            "seed": SimulationSeed(1),
        }
        values.update(overrides)
        with pytest.raises(StatisticalValueError):
            SimulationResult(**values)

    with pytest.raises(StatisticalValueError, match="masse"):
        SimulationResult(
            result_kind="weeks",
            result_percentiles=percentiles,
            result_distribution=Histogram.create(
                [{"x": 5, "count": 999}],
                expected_mass=999,
            ),
            completion_summary=completion,
            samples_count=6,
            throughput_reliability=reliability,
            seed=SimulationSeed(1),
        )

    with pytest.raises(StatisticalValueError, match="interdit"):
        SimulationResult(
            result_kind="items",
            result_percentiles=SimulationPercentiles.create(
                "weeks_to_items",
                {"P50": 9, "P70": 7, "P90": 5},
            ),
            result_distribution=histogram,
            completion_summary=completion,
            samples_count=6,
            throughput_reliability=reliability,
            seed=SimulationSeed(1),
        )

    with pytest.raises(StatisticalValueError, match="Percentiles incompatibles"):
        SimulationResult(
            result_kind="items",
            result_percentiles=percentiles,
            result_distribution=histogram,
            completion_summary=None,
            samples_count=6,
            throughput_reliability=reliability,
            seed=SimulationSeed(1),
        )


def test_statistical_domain_has_no_framework_or_engine_dependency():
    root = Path(__file__).resolve().parents[1]
    sources = [
        (root / "backend/simulation_models.py").read_text(encoding="utf-8"),
        (root / "backend/simulation_value_objects.py").read_text(encoding="utf-8"),
    ]
    forbidden = ("fastapi", "pydantic", "mongodb", "numpy", "react", "localstorage")

    for source in sources:
        for dependency in forbidden:
            assert dependency not in source.lower()
