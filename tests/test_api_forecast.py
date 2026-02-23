import pandas as pd
from fastapi.testclient import TestClient
from unittest.mock import patch
from backend.api import app

TEST_PAT = "fake-pat-token-1234567890"

def test_forecast_ok():
    client = TestClient(app)

    weekly = pd.DataFrame({
        "week": ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09"],
        "throughput": [3, 2, 4, 3, 5, 2],
    })

    req = {
        "org": "org-a",
        "project": "projet",
        "team_name": "Team",
        "start_date": "2025-10-01",
        "end_date": "2026-01-19",
        "backlog_size": 20,
        "done_states": ["Done"],
        "work_item_types": ["User Story"],
        "n_sims": 2000
    }

    with patch("backend.api.team_settings_areas", return_value={"defaultValue": "Projet\\X"}):
        with patch("backend.api.weekly_throughput", return_value=weekly):
            r = client.post("/forecast", json=req, headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 200
    body = r.json()
    assert body["team"] == "Team"
    assert body["area_path"] == "Projet\\X"
    assert body["backlog_size"] == 20
    assert "result_percentiles" in body
    assert "weekly_throughput" in body
    assert "result_histogram" in body
    assert "weeks_percentiles" not in body
    assert "weeks_distribution" not in body


def test_forecast_weeks_to_items_ok():
    client = TestClient(app)

    weekly = pd.DataFrame({
        "week": ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09"],
        "throughput": [3, 2, 4, 3, 5, 2],
    })

    req = {
        "org": "org-a",
        "project": "Projet",
        "mode": "weeks_to_items",
        "team_name": "Team",
        "start_date": "2025-10-01",
        "end_date": "2026-01-19",
        "target_weeks": 10,
        "done_states": ["Done"],
        "work_item_types": ["User Story"],
        "n_sims": 2000
    }

    with patch("backend.api.team_settings_areas", return_value={"defaultValue": "Projet\\X"}):
        with patch("backend.api.weekly_throughput", return_value=weekly):
            r = client.post("/forecast", json=req, headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "weeks_to_items"
    assert body["result_kind"] == "items"
    assert "result_percentiles" in body
    assert "result_histogram" in body
    assert "items_percentiles" not in body
    assert "items_distribution" not in body
