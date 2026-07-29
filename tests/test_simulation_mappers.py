import pytest
from pydantic import ValidationError

from backend.api_models import SimulateRequest, SimulateResponse
from backend.simulation_mappers import (
    persistence_row_to_history_item,
    request_to_command,
    result_to_response,
)
from backend.simulation_models import (
    SimulationResult,
)
from backend.simulation_value_objects import (
    CompletionSummary,
    Histogram,
    SimulationCount,
    SimulationPercentiles,
    SimulationSeed,
    ThroughputReliability,
)


def _result(*, with_optional_values: bool = True) -> SimulationResult:
    mode = "backlog_to_weeks" if with_optional_values else "weeks_to_items"
    percentiles = (
        {"P50": 8, "P70": 10, "P90": 13}
        if with_optional_values
        else {"P70": 10}
    )
    return SimulationResult(
        result_kind="weeks" if with_optional_values else "items",
        result_percentiles=SimulationPercentiles.create(mode, percentiles),
        result_distribution=Histogram.create(
            [{"x": 8, "count": 800 if with_optional_values else 4}],
            expected_mass=800 if with_optional_values else 4,
        ),
        completion_summary=(
            CompletionSummary.create(
                completed_count=800,
                censored_count=200,
                n_sims=SimulationCount(1000),
            )
            if with_optional_values
            else None
        ),
        samples_count=6,
        throughput_reliability=ThroughputReliability.create(
            cv=0.2,
            iqr_ratio=0.3,
            slope_norm=-0.02,
            label="fiable",
            samples_count=6,
        ),
        seed=SimulationSeed(123),
    )


def test_request_to_command_resolves_transport_values_and_seed():
    request = SimulateRequest(
        throughput_samples=[0, 1, 2, 3, 4, 5],
        include_zero_weeks=True,
        mode="backlog_to_weeks",
        backlog_size=20,
        n_sims=2000,
    )

    command = request_to_command(request, SimulationSeed(98765))

    assert command.throughput_samples.raw_values == (0, 1, 2, 3, 4, 5)
    assert command.include_zero_weeks is True
    assert command.backlog_size is not None
    assert command.backlog_size.value == 20
    assert command.target_weeks is None
    assert command.seed.value == 98765


def test_request_transport_defaults_are_explicitly_aligned_before_the_domain():
    request = SimulateRequest(
        throughput_samples=[0, 1, 2, 3, 4, 5, 6],
        mode="weeks_to_items",
        target_weeks=12,
    )

    command = request_to_command(request, SimulationSeed(0))

    assert request.include_zero_weeks is False
    assert request.n_sims == 20000
    assert command.include_zero_weeks is False
    assert command.n_sims == SimulationCount(20000)
    assert command.throughput_samples.usable_values == (1, 2, 3, 4, 5, 6)


def test_result_to_response_preserves_public_json_and_omits_none_values():
    response = result_to_response(_result(with_optional_values=True))
    assert response.model_dump(exclude_none=True) == {
        "result_kind": "weeks",
        "result_percentiles": {"P50": 8, "P70": 10, "P90": 13},
        "risk_score": 0.625,
        "result_distribution": [{"x": 8, "count": 800}],
        "completion_summary": {
            "completed_count": 800,
            "censored_count": 200,
            "censored_rate": 0.2,
            "horizon_weeks": 521,
        },
        "samples_count": 6,
        "throughput_reliability": {
            "cv": 0.2,
            "iqr_ratio": 0.3,
            "slope_norm": -0.02,
            "label": "fiable",
            "samples_count": 6,
        },
        "seed": 123,
    }

    without_optional = result_to_response(_result(with_optional_values=False))
    serialized = without_optional.model_dump(exclude_none=True)
    assert "risk_score" not in serialized
    assert "completion_summary" not in serialized


@pytest.mark.parametrize(
    "override",
    [
        {"risk_score": None},
        {"completion_summary": None},
        {"unknown": True},
        {"result_percentiles": {"P50": 8, "P80": 4}},
        {"result_percentiles": {"P50": None}},
        {"result_kind": "weeks"},
        {
            "completion_summary": {
                "completed_count": 1000,
                "censored_count": 0,
                "censored_rate": 0,
                "horizon_weeks": 521,
            }
        },
        {
            "throughput_reliability": {
                "cv": 0.2,
                "iqr_ratio": 0.3,
                "slope_norm": 0,
                "label": "fiable",
                "samples_count": 7,
            }
        },
        {
            "throughput_reliability": {
                "cv": float("nan"),
                "iqr_ratio": 0.3,
                "slope_norm": 0,
                "label": "fiable",
                "samples_count": 6,
            }
        },
    ],
)
def test_response_dto_rejects_null_non_finite_and_open_shapes(override):
    values = _result(with_optional_values=False)
    payload = result_to_response(values).model_dump(exclude_none=True)
    payload.update(override)

    with pytest.raises(ValidationError):
        SimulateResponse.model_validate(payload)


def test_persistence_row_to_history_item_preserves_legacy_optional_fields():
    item = persistence_row_to_history_item(
        {
            "created_at": "2026-02-26T10:00:00Z",
            "last_seen": "2026-02-26T10:00:00Z",
            "mode": "backlog_to_weeks",
            "backlog_size": 80,
            "n_sims": 20000,
            "samples_count": 24,
            "percentiles": {"P50": 10},
            "distribution": [{"x": 8, "count": 120}],
        }
    )

    assert item.seed is None
    assert item.throughput_reliability is None
    assert item.model_dump()["distribution"] == [{"x": 8, "count": 120}]


def test_persistence_history_preserves_absent_risk_and_rejects_stale_authority():
    row = {
        "created_at": "2026-02-26T10:00:00Z",
        "last_seen": "2026-02-26T10:00:00Z",
        "mode": "backlog_to_weeks",
        "n_sims": 20000,
        "samples_count": 24,
        "percentiles": {"P50": 10, "P70": 12, "P90": 14},
        "distribution": [{"x": 8, "count": 120}],
    }

    legacy = persistence_row_to_history_item(row)
    assert legacy.risk_score is None
    assert persistence_row_to_history_item({**row, "risk_score": 0.4}).risk_score == 0.4
    with pytest.raises(ValidationError, match="valeur d'autorite"):
        persistence_row_to_history_item({**row, "risk_score": 0.3999})
    with pytest.raises(ValidationError, match="P50, P70 et P90"):
        persistence_row_to_history_item(
            {**row, "percentiles": {"P50": 10, "P80": 14}}
        )
