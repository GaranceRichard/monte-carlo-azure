from inspect import Parameter, signature
from pathlib import Path

import numpy as np
import pytest

import backend.simulation_service as simulation_service
from backend.mc_core import (
    FinishWeeksSimulation,
    mc_finish_weeks,
    mc_items_done_for_weeks,
)
from backend.simulation_models import SimulationCommand
from backend.simulation_service import run_simulation
from backend.simulation_value_objects import SimulationSeed, StatisticalValueError
from tests.deterministic_sample_index_draw_port import RecordingSampleIndexDrawPort


def _command(**overrides) -> SimulationCommand:
    values = {
        "throughput_samples": (1, 2, 3, 4, 5, 6),
        "include_zero_weeks": False,
        "mode": "backlog_to_weeks",
        "backlog_size": 20,
        "target_weeks": None,
        "n_sims": 2000,
        "seed": SimulationSeed(123),
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


def test_service_and_engine_keep_seed_resolution_outside_the_draw_port_contract():
    root = Path(__file__).resolve().parents[1]
    sources = [
        (root / "backend/simulation_service.py").read_text(encoding="utf-8"),
        (root / "backend/mc_core.py").read_text(encoding="utf-8"),
    ]

    for source in sources:
        assert "secrets" not in source
        assert "randbelow" not in source
    for engine in (mc_finish_weeks, mc_items_done_for_weeks):
        parameters = signature(engine).parameters
        assert "seed" not in parameters
        assert parameters["draw_port"].default is Parameter.empty
    assert tuple(signature(run_simulation).parameters) == ("command",)
    assert tuple(signature(mc_finish_weeks).parameters) == (
        "backlog_size",
        "throughput_samples",
        "n_sims",
        "include_zero_weeks",
        "draw_port",
        "batch_size",
    )
    assert tuple(signature(mc_items_done_for_weeks).parameters) == (
        "weeks",
        "throughput_samples",
        "n_sims",
        "include_zero_weeks",
        "draw_port",
        "batch_size",
    )


def test_mc_core_has_no_concrete_rng_access():
    root = Path(__file__).resolve().parents[1]
    engine_source = (root / "backend/mc_core.py").read_text(encoding="utf-8")

    for forbidden in ("np.random", "default_rng", "Generator"):
        assert forbidden not in engine_source
    assert "McaPrngV1SampleIndexDrawPort" not in engine_source
    assert "mca_prng_v1_sample_index_draw_port" not in engine_source


def test_service_runs_both_modes_without_changing_seeded_results():
    weeks = run_simulation(_command())
    repeated_weeks = run_simulation(_command())
    items = run_simulation(
        _command(mode="weeks_to_items", backlog_size=None, target_weeks=8)
    )
    repeated_items = run_simulation(
        _command(mode="weeks_to_items", backlog_size=None, target_weeks=8)
    )

    assert weeks == repeated_weeks
    assert items == repeated_items
    assert weeks.result_kind == "weeks"
    assert weeks.seed.value == 123
    assert weeks.result_percentiles
    assert weeks.completion_summary is not None
    assert items.result_kind == "items"
    assert items.seed.value == 123
    assert items.result_percentiles
    assert items.completion_summary is None


def test_service_constructs_exactly_one_adapter_per_execution_and_passes_it_to_engine(
    monkeypatch,
):
    created_seeds: list[SimulationSeed] = []
    created_ports: list[RecordingSampleIndexDrawPort] = []

    def create_port(seed):
        draw_port = RecordingSampleIndexDrawPort()
        created_seeds.append(seed)
        created_ports.append(draw_port)
        return draw_port

    monkeypatch.setattr(
        simulation_service,
        "McaPrngV1SampleIndexDrawPort",
        create_port,
    )

    run_simulation(_command(n_sims=1000))
    run_simulation(
        _command(
            mode="weeks_to_items",
            backlog_size=None,
            target_weeks=3,
            n_sims=1000,
        )
    )

    assert created_seeds == [SimulationSeed(123), SimulationSeed(123)]
    assert len(created_ports) == 2
    assert created_ports[0].requests == [(6, (1000, 521))]
    assert created_ports[1].requests == [(6, (1000, 3))]


@pytest.mark.parametrize(
    ("completion_pattern", "expected_percentiles", "expected_risk"),
    [
        ([False, False, False], {}, None),
        ([True, False, True], {"P50": 521}, None),
    ],
)
def test_service_preserves_total_and_partial_censure(
    monkeypatch, completion_pattern, expected_percentiles, expected_risk
):
    repeated_mask = np.resize(np.array(completion_pattern, dtype=bool), 2000)
    completed_weeks = np.full(int(np.count_nonzero(repeated_mask)), 521, dtype=int)
    simulation = FinishWeeksSimulation(
        completed_weeks=completed_weeks,
        simulation_count=2000,
        horizon_weeks=521,
    )
    monkeypatch.setattr(
        "backend.simulation_service._run_engine",
        lambda _command, _samples, _draw_port: (simulation, "weeks"),
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
        completed_weeks=outcomes,
        simulation_count=2000,
        horizon_weeks=521,
    )
    monkeypatch.setattr(
        "backend.simulation_service._run_engine",
        lambda _command, _samples, _draw_port: (simulation, "weeks"),
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
