import time

import pytest
from fastapi.testclient import TestClient
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request

from backend.api import app
from backend.api_config import ApiConfig
from backend.api_routes_simulate import _client_key_from_request, limiter


def test_simulate_backlog_to_weeks_success():
    client = TestClient(app)
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
    assert "risk_score" in body
    assert isinstance(body["risk_score"], float)
    assert body["throughput_reliability"]["samples_count"] == 6
    assert set(body["throughput_reliability"].keys()) == {
        "cv",
        "iqr_ratio",
        "slope_norm",
        "label",
        "samples_count",
    }
    expected = (
        (body["result_percentiles"]["P90"] - body["result_percentiles"]["P50"])
        / body["result_percentiles"]["P50"]
    )
    assert body["risk_score"] == expected
    assert isinstance(body["result_distribution"], list)
    assert len(body["result_distribution"]) > 0
    first_bucket = body["result_distribution"][0]
    assert set(first_bucket.keys()) == {"x", "count"}
    assert isinstance(first_bucket["x"], int)
    assert isinstance(first_bucket["count"], int)


def test_simulate_weeks_to_items_success():
    client = TestClient(app)
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
    assert "risk_score" in body
    assert isinstance(body["risk_score"], float)
    assert body["throughput_reliability"]["samples_count"] == 6
    expected = (
        (body["result_percentiles"]["P50"] - body["result_percentiles"]["P90"])
        / body["result_percentiles"]["P50"]
    )
    assert body["risk_score"] == max(0.0, expected)


def test_simulate_include_zero_weeks_keeps_zero_samples():
    client = TestClient(app)
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
    assert body["throughput_reliability"]["samples_count"] == 8


def test_simulate_requires_backlog_size_for_backlog_mode():
    client = TestClient(app)
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
    client = TestClient(app)
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
    client = TestClient(app)
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
    client = TestClient(app)
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


def test_simulate_rate_limit_returns_429():
    client = TestClient(app)
    payload = {
        "throughput_samples": [1, 2, 3, 4, 5, 6],
        "mode": "backlog_to_weeks",
        "backlog_size": 10,
        "n_sims": 2000,
    }
    headers = {"x-forwarded-for": "simulate-rate-limit-test"}

    statuses = [
        client.post("/simulate", json=payload, headers=headers).status_code
        for _ in range(21)
    ]

    assert statuses[:20] == [200] * 20
    assert statuses[20] == 429


def test_simulate_returns_503_when_forecast_timeout_is_exceeded(monkeypatch):
    client = TestClient(app)
    payload = {
        "throughput_samples": [1, 2, 3, 4, 5, 6],
        "mode": "backlog_to_weeks",
        "backlog_size": 10,
        "n_sims": 2000,
    }

    def slow_compute(req, samples):
        time.sleep(0.05)
        return [1, 2, 3], "weeks"

    monkeypatch.setattr("backend.api_routes_simulate._compute_simulation_result", slow_compute)
    monkeypatch.setattr(
        "backend.api_routes_simulate.cfg",
        ApiConfig(
            cors_origins=[],
            cors_allow_credentials=True,
            forecast_timeout_seconds=0.01,
            rate_limit_simulate="20/minute",
            rate_limit_storage_url="memory://",
            client_cookie_name="IDMontecarlo",
            simulation_history_limit=10,
            mongo_url="",
            mongo_db="montecarlo",
            mongo_collection_simulations="simulations",
            mongo_min_pool_size=5,
            mongo_max_pool_size=20,
            mongo_server_selection_timeout_ms=2000,
            mongo_connect_timeout_ms=2000,
            mongo_socket_timeout_ms=5000,
            mongo_max_idle_time_ms=60000,
        ),
    )

    response = client.post("/simulate", json=payload)

    assert response.status_code == 503
    assert "Simulation trop longue" in response.json()["detail"]


def test_client_key_prefers_first_forwarded_ip():
    request = Request(
        {
            "type": "http",
            "headers": [(b"x-forwarded-for", b"203.0.113.10, 10.0.0.7")],
            "client": ("127.0.0.1", 50000),
        }
    )

    assert _client_key_from_request(request) == "203.0.113.10"


def test_client_key_falls_back_to_client_host():
    request = Request(
        {
            "type": "http",
            "headers": [],
            "client": ("127.0.0.1", 50000),
        }
    )

    assert _client_key_from_request(request) == "127.0.0.1"


def test_client_key_returns_unknown_without_forwarded_or_client():
    request = Request(
        {
            "type": "http",
            "headers": [],
        }
    )

    assert _client_key_from_request(request) == "unknown"


def test_simulate_logs_warning_and_stays_permissive_when_rate_limit_storage_fails(
    monkeypatch, caplog
):
    client = TestClient(app)
    payload = {
        "throughput_samples": [1, 2, 3, 4, 5, 6],
        "mode": "backlog_to_weeks",
        "backlog_size": 10,
        "n_sims": 2000,
    }
    original_hit = limiter._limiter.hit
    original_storage_uri = limiter._storage_uri
    original_warning_active = limiter._storage_warning_active
    original_warning_logged_at = limiter._storage_warning_last_logged_at

    def broken_hit(*args, **kwargs):
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(limiter._limiter, "hit", broken_hit)
    limiter._storage_uri = "redis://redis:6379/0"
    limiter._storage_warning_active = False
    limiter._storage_warning_last_logged_at = 0.0

    with caplog.at_level("WARNING"):
        response = client.post("/simulate", json=payload)

    limiter._limiter.hit = original_hit
    limiter._storage_uri = original_storage_uri
    limiter._storage_warning_active = original_warning_active
    limiter._storage_warning_last_logged_at = original_warning_logged_at

    assert response.status_code == 200
    assert "Rate limit storage unreachable" in caplog.text


def test_rate_limit_storage_check_logs_warning_when_redis_is_unreachable(caplog, monkeypatch):
    original_storage_uri = limiter._storage_uri
    original_storage_check = limiter._storage.check
    original_warning_active = limiter._storage_warning_active
    original_warning_logged_at = limiter._storage_warning_last_logged_at

    def broken_check():
        raise RuntimeError("redis healthcheck unavailable")

    monkeypatch.setattr(limiter._storage, "check", broken_check)
    limiter._storage_uri = "redis://redis:6379/0"
    limiter._storage_warning_active = False
    limiter._storage_warning_last_logged_at = 0.0

    with caplog.at_level("WARNING"):
        assert limiter.check_storage() is False

    limiter._storage_uri = original_storage_uri
    limiter._storage.check = original_storage_check
    limiter._storage_warning_active = original_warning_active
    limiter._storage_warning_last_logged_at = original_warning_logged_at

    assert "Rate limit storage unreachable" in caplog.text


def test_rate_limit_storage_warning_is_throttled(caplog, monkeypatch):
    original_warning_active = limiter._storage_warning_active
    original_warning_logged_at = limiter._storage_warning_last_logged_at

    limiter._storage_warning_active = True
    limiter._storage_warning_last_logged_at = 0.0
    monkeypatch.setattr(limiter, "_warning_interval_elapsed", lambda: False)

    with caplog.at_level("WARNING"):
        limiter._log_storage_warning(RuntimeError("redis unavailable"))

    limiter._storage_warning_active = original_warning_active
    limiter._storage_warning_last_logged_at = original_warning_logged_at

    assert "Rate limit storage unreachable" not in caplog.text


def test_rate_limit_storage_recovery_logs_when_warning_was_active(caplog):
    original_warning_active = limiter._storage_warning_active

    limiter._storage_warning_active = True

    with caplog.at_level("WARNING"):
        limiter._log_storage_recovery()

    limiter._storage_warning_active = original_warning_active

    assert "Rate limit storage recovered" in caplog.text


def test_rate_limit_storage_check_memory_backend_returns_true():
    original_storage_uri = limiter._storage_uri
    limiter._storage_uri = "memory://"

    assert limiter.check_storage() is True

    limiter._storage_uri = original_storage_uri


def test_rate_limit_storage_check_true_clears_warning_state(caplog, monkeypatch):
    original_storage_uri = limiter._storage_uri
    original_warning_active = limiter._storage_warning_active

    monkeypatch.setattr(limiter._storage, "check", lambda: True)
    limiter._storage_uri = "redis://redis:6379/0"
    limiter._storage_warning_active = True

    with caplog.at_level("WARNING"):
        assert limiter.check_storage() is True

    limiter._storage_uri = original_storage_uri
    limiter._storage_warning_active = original_warning_active

    assert "Rate limit storage recovered" in caplog.text


def test_rate_limit_storage_warning_interval_elapsed():
    original_warning_logged_at = limiter._storage_warning_last_logged_at
    limiter._storage_warning_last_logged_at = time.monotonic() - 10

    assert limiter._warning_interval_elapsed() is True

    limiter._storage_warning_last_logged_at = original_warning_logged_at


def test_rate_limit_storage_check_false_logs_warning(caplog, monkeypatch):
    original_storage_uri = limiter._storage_uri
    original_warning_active = limiter._storage_warning_active
    original_warning_logged_at = limiter._storage_warning_last_logged_at

    monkeypatch.setattr(limiter._storage, "check", lambda: False)
    limiter._storage_uri = "redis://redis:6379/0"
    limiter._storage_warning_active = False
    limiter._storage_warning_last_logged_at = 0.0

    with caplog.at_level("WARNING"):
        assert limiter.check_storage() is False

    limiter._storage_uri = original_storage_uri
    limiter._storage_warning_active = original_warning_active
    limiter._storage_warning_last_logged_at = original_warning_logged_at

    assert "Rate limit storage unreachable" in caplog.text


def test_check_request_limit_returns_early_when_storage_warning_active(monkeypatch):
    request = Request({"type": "http", "headers": [], "path": "/simulate"})
    limiter._storage_warning_active = True
    monkeypatch.setattr(limiter, "check_storage", lambda: False)

    limiter._check_request_limit(request, None, False)

    limiter._storage_warning_active = False

    assert request.state.view_rate_limit is None


def test_check_request_limit_reraises_rate_limit_exceeded(monkeypatch):
    request = Request({"type": "http", "headers": [], "path": "/simulate"})

    class _FakeLimit:
        error_message = None
        limit = "1/minute"

    def raise_rate_limit(self, request, endpoint_func, in_middleware):
        raise RateLimitExceeded(_FakeLimit())

    monkeypatch.setattr(
        "backend.api_routes_simulate.Limiter._check_request_limit",
        raise_rate_limit,
    )

    with pytest.raises(RateLimitExceeded):
        limiter._check_request_limit(request, None, False)
