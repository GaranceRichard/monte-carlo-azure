import pytest
from pydantic import ValidationError

from backend.api_models import SimulateResponse, SimulationHistoryItem


def test_simulate_response_rejects_a_non_authoritative_risk_score() -> None:
    with pytest.raises(ValidationError):
        SimulateResponse.model_validate("not-a-response")

    with pytest.raises(ValidationError, match="valeur d'autorite"):
        SimulateResponse(
            result_kind="items",
            result_percentiles={"P50": 40, "P70": 35, "P90": 30},
            risk_score=0.2,
            result_distribution=[{"x": 30, "count": 1000}],
            samples_count=6,
            throughput_reliability={
                "cv": 0.2,
                "iqr_ratio": 0.3,
                "slope_norm": 0,
                "label": "fiable",
                "samples_count": 6,
            },
            seed=1,
        )


def test_history_item_rejects_an_explicit_null_risk_score() -> None:
    with pytest.raises(ValidationError, match="absent doit etre omis"):
        SimulationHistoryItem(
            created_at="2026-07-28T12:00:00Z",
            last_seen="2026-07-28T12:00:00Z",
            mode="weeks_to_items",
            target_weeks=10,
            n_sims=1000,
            samples_count=6,
            percentiles={"P50": 40, "P70": 35, "P90": 30},
            risk_score=None,
            distribution=[{"x": 30, "count": 1000}],
        )
