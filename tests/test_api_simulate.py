from fastapi.testclient import TestClient

import backend.api_routes_simulate as api_routes_simulate
from backend.api import app

client = TestClient(app)


def test_simulate_backlog_to_weeks_success():
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [0, 1, 2, 3, 4, 5, 6, 0],
            "mode": "backlog_to_weeks",
            "backlog_size": 30,
            "n_sims": 2000,
        },
    )

    assert r.status_code == 200
    body = r.json()
    assert body["result_kind"] == "weeks"
    assert body["samples_count"] == 6
    assert set(body["result_percentiles"].keys()) == {"P50", "P70", "P90"}
    assert isinstance(body["result_distribution"], list)
    assert len(body["result_distribution"]) > 0
    first_bucket = body["result_distribution"][0]
    assert set(first_bucket.keys()) == {"x", "count"}
    assert isinstance(first_bucket["x"], int)
    assert isinstance(first_bucket["count"], int)


def test_simulate_weeks_to_items_success():
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 2, 3, 4, 5, 6],
            "mode": "weeks_to_items",
            "target_weeks": 8,
            "n_sims": 2000,
        },
    )

    assert r.status_code == 200
    body = r.json()
    assert body["result_kind"] == "items"
    assert body["samples_count"] == 6


def test_simulate_include_zero_weeks_keeps_zero_samples():
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [0, 1, 2, 3, 4, 5, 6, 0],
            "include_zero_weeks": True,
            "mode": "backlog_to_weeks",
            "backlog_size": 30,
            "n_sims": 2000,
        },
    )

    assert r.status_code == 200
    body = r.json()
    assert body["samples_count"] == 8


def test_simulate_requires_backlog_size_for_backlog_mode():
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 2, 3, 4, 5, 6],
            "mode": "backlog_to_weeks",
            "n_sims": 2000,
        },
    )

    assert r.status_code == 400
    assert "backlog_size" in r.json()["detail"]


def test_simulate_requires_target_weeks_for_weeks_mode():
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 2, 3, 4, 5, 6],
            "mode": "weeks_to_items",
            "n_sims": 2000,
        },
    )

    assert r.status_code == 400
    assert "target_weeks" in r.json()["detail"]


def test_simulate_rejects_insufficient_non_zero_history():
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [0, 0, 0, 1, 2, 3, 0],
            "mode": "backlog_to_weeks",
            "backlog_size": 10,
            "n_sims": 2000,
        },
    )

    assert r.status_code == 422
    assert "Historique insuffisant" in r.json()["detail"]


def test_simulate_rejects_short_raw_samples_list():
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 2, 3, 4, 5],
            "mode": "backlog_to_weeks",
            "backlog_size": 10,
            "n_sims": 2000,
        },
    )

    assert r.status_code == 422


def test_simulate_rate_limit_returns_429(monkeypatch):
    monkeypatch.setattr(
        api_routes_simulate,
        "_rate_limiter",
        api_routes_simulate.SlidingWindowRateLimiter(max_requests=1, window_seconds=60.0),
    )
    payload = {
        "throughput_samples": [1, 2, 3, 4, 5, 6],
        "mode": "backlog_to_weeks",
        "backlog_size": 10,
        "n_sims": 2000,
    }

    first = client.post("/simulate", json=payload)
    second = client.post("/simulate", json=payload)

    assert first.status_code == 200
    assert second.status_code == 429
