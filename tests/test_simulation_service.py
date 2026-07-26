from pathlib import Path

import numpy as np
import pytest

from backend.mc_core import FinishWeeksSimulation
from backend.simulation_models import SimulationCommand
from backend.simulation_service import run_simulation
from backend.simulation_value_objects import StatisticalValueError


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
    return SimulationCommand.create(**values)


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
    assert weeks.seed.value == 123
    assert weeks.result_percentiles
    assert weeks.completion_summary is not None
    assert items.result_kind == "items"
    assert items.seed.value == 123
    assert items.result_percentiles
    assert items.completion_summary is None


@pytest.mark.parametrize(
    ("completed_mask", "expected_percentiles", "expected_risk"),
    [
        ([False, False, False], {}, None),
        ([True, False, True], {"P50": 521}, None),
    ],
)
def test_service_preserves_total_and_partial_censure(
    monkeypatch, completed_mask, expected_percentiles, expected_risk
):
    repeated_mask = np.resize(np.array(completed_mask, dtype=bool), 2000)
    simulation = FinishWeeksSimulation(
        weeks_needed=np.full(2000, 521, dtype=int),
        completed_mask=repeated_mask,
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
    expected_completed = int(np.count_nonzero(repeated_mask))
    expected_censored_rate = round((2000 - expected_completed) / 2000, 4)
    assert result.completion_summary.censored_rate == expected_censored_rate
    assert sum(bucket.count for bucket in result.result_distribution) == expected_completed


def test_service_preserves_histogram_reliability_and_risk_score(monkeypatch):
    outcomes = np.tile(np.array([3, 4, 6, 8, 10]), 400)
    simulation = FinishWeeksSimulation(
        weeks_needed=outcomes,
        completed_mask=np.ones(2000, dtype=bool),
        horizon_weeks=521,
    )
    monkeypatch.setattr(
        "backend.simulation_service._run_engine",
        lambda _command, _samples: (simulation, "weeks"),
    )

    result = run_simulation(_command())

    assert result.result_percentiles == {"P50": 6, "P70": 8, "P90": 10}
    assert result.risk_score == 0.6667
    assert [(bucket.x, bucket.count) for bucket in result.result_distribution] == [
        (3, 400),
        (4, 400),
        (6, 400),
        (8, 400),
        (10, 400),
    ]
    assert result.throughput_reliability.samples_count == 6


def test_service_rejects_insufficient_filtered_samples():
    with pytest.raises(StatisticalValueError, match="non nulles"):
        _command(throughput_samples=(0, 0, 0, 1, 2, 3))
