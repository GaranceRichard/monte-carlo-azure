from backend.api_models import SimulateRequest
from backend.simulation_mappers import (
    persistence_row_to_history_item,
    request_to_command,
    result_to_response,
)
from backend.simulation_models import (
    CompletionSummary,
    HistogramBucket,
    SimulationResult,
    ThroughputReliability,
)


def _result(*, with_optional_values: bool = True) -> SimulationResult:
    return SimulationResult(
        result_kind="weeks",
        result_percentiles={"P50": 8, "P70": 10, "P90": 13},
        risk_score=0.625 if with_optional_values else None,
        result_distribution=(HistogramBucket(x=8, count=4),),
        completion_summary=(
            CompletionSummary(
                completed_count=4,
                censored_count=2,
                censored_rate=0.3333,
                horizon_weeks=521,
            )
            if with_optional_values
            else None
        ),
        samples_count=6,
        throughput_reliability=ThroughputReliability(
            cv=0.2,
            iqr_ratio=0.3,
            slope_norm=-0.02,
            label="fiable",
            samples_count=6,
        ),
        seed=123,
    )


def test_request_to_command_resolves_transport_values_and_seed():
    request = SimulateRequest(
        throughput_samples=[0, 1, 2, 3, 4, 5],
        include_zero_weeks=True,
        mode="backlog_to_weeks",
        backlog_size=20,
        n_sims=2000,
    )

    command = request_to_command(request, 98765)

    assert command.throughput_samples == (0, 1, 2, 3, 4, 5)
    assert command.include_zero_weeks is True
    assert command.backlog_size == 20
    assert command.target_weeks is None
    assert command.seed == 98765


def test_result_to_response_preserves_public_json_and_omits_none_values():
    response = result_to_response(_result(with_optional_values=True))
    assert response.model_dump(exclude_none=True) == {
        "result_kind": "weeks",
        "result_percentiles": {"P50": 8, "P70": 10, "P90": 13},
        "risk_score": 0.625,
        "result_distribution": [{"x": 8, "count": 4}],
        "completion_summary": {
            "completed_count": 4,
            "censored_count": 2,
            "censored_rate": 0.3333,
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
