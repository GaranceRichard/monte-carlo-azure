from pathlib import Path

import numpy as np
import pytest

from backend.mc_core import FinishWeeksSimulation
from backend.simulation_models import SimulationCommand
from backend.simulation_service import (
    InsufficientSimulationSamplesError,
    run_simulation,
)


def _command(**overrides) -> SimulationCommand:
    values = {
        "throughput_samples": (1, 2, 3, 4, 5, 6),
        "include_zero_weeks": False,
        "mode": "backlog_to_weeks",
        "backlog_size": 20,
        "target_weeks": None,
        "n_sims": 2000,
        "seed": 123,
    }
    values.update(overrides)
    return SimulationCommand(**values)


def test_service_has_no_http_or_pydantic_dependency():
    root = Path(__file__).resolve().parents[1]
    service_source = (root / "backend/simulation_service.py").read_text(encoding="utf-8")
    model_source = (root / "backend/simulation_models.py").read_text(encoding="utf-8")
    for forbidden in ("pydantic", "fastapi", "starlette", "api_models"):
        assert forbidden not in service_source.lower()
        assert forbidden not in model_source.lower()


def test_service_runs_both_modes_without_changing_seeded_results():
    weeks = run_simulation(_command())
    items = run_simulation(
        _command(mode="weeks_to_items", backlog_size=None, target_weeks=8)
    )

    assert weeks.result_kind == "weeks"
    assert weeks.seed == 123
    assert weeks.result_percentiles
    assert weeks.completion_summary is not None
    assert items.result_kind == "items"
    assert items.seed == 123
    assert items.result_percentiles
    assert items.completion_summary is None


@pytest.mark.parametrize(
    ("completed_mask", "expected_percentiles", "expected_risk", "expected_rate"),
    [
        ([False, False, False], {}, None, 1.0),
        ([True, False, True], {"P50": 521}, None, 0.3333),
    ],
)
def test_service_preserves_total_and_partial_censure(
    monkeypatch, completed_mask, expected_percentiles, expected_risk, expected_rate
):
    simulation = FinishWeeksSimulation(
        weeks_needed=np.array([521, 521, 521], dtype=int),
        completed_mask=np.array(completed_mask, dtype=bool),
        horizon_weeks=521,
    )
    monkeypatch.setattr(
        "backend.simulation_service._run_engine",
        lambda _command, _samples: (simulation, "weeks"),
    )

    result = run_simulation(_command())

    assert result.result_percentiles == expected_percentiles
    assert result.risk_score is expected_risk
    assert result.completion_summary is not None
    assert result.completion_summary.censored_rate == expected_rate
    assert sum(bucket.count for bucket in result.result_distribution) == sum(completed_mask)


def test_service_preserves_histogram_reliability_and_risk_score(monkeypatch):
    monkeypatch.setattr(
        "backend.simulation_service._run_engine",
        lambda _command, _samples: (np.array([3, 4, 6, 8, 10]), "weeks"),
    )

    result = run_simulation(_command())

    assert result.result_percentiles == {"P50": 6, "P70": 8, "P90": 10}
    assert result.risk_score == pytest.approx((10 - 6) / 6)
    assert [(bucket.x, bucket.count) for bucket in result.result_distribution] == [
        (3, 1),
        (4, 1),
        (6, 1),
        (8, 1),
        (10, 1),
    ]
    assert result.throughput_reliability.samples_count == 6


def test_service_rejects_insufficient_filtered_samples():
    with pytest.raises(InsufficientSimulationSamplesError, match="non nulles"):
        run_simulation(_command(throughput_samples=(0, 0, 0, 1, 2, 3)))
