import time

import numpy as np
import pytest
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request

from backend.api import app
from backend.api_config import ApiConfig
from backend.api_models import SIMULATION_SEED_MAX
from backend.api_routes_simulate import (
    _client_key_from_request,
    _persist_simulation,
    _resolve_simulation_seed,
    limiter,
)
from backend.mc_core import FinishWeeksSimulation
from backend.simulation_limits import (
    SIMULATION_BACKLOG_SIZE_MAX,
    SIMULATION_HORIZON_WEEKS_MAX,
    SIMULATION_N_SIMS_MAX,
    SIMULATION_N_SIMS_MIN,
    SIMULATION_THROUGHPUT_SAMPLES_MAX,
    SIMULATION_THROUGHPUT_SAMPLES_MIN,
)
from backend.simulation_models import (
    CompletionSummary,
    HistogramBucket,
    SimulationCommand,
    SimulationResult,
    ThroughputReliability,
)
from tests.http_client import ApiTestClient


def test_simulate_backlog_to_weeks_success():
    client = ApiTestClient(app)
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
    assert isinstance(body["seed"], int)
    assert 0 <= body["seed"] <= SIMULATION_SEED_MAX
    assert (
        body["result_percentiles"]["P50"]
        <= body["result_percentiles"]["P70"]
        <= body["result_percentiles"]["P90"]
    )
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
    assert (
        body["completion_summary"]["completed_count"]
        + body["completion_summary"]["censored_count"]
        == 2000
    )
    assert body["completion_summary"]["horizon_weeks"] == 521
    first_bucket = body["result_distribution"][0]
    assert set(first_bucket.keys()) == {"x", "count"}
    assert isinstance(first_bucket["x"], int)
    assert isinstance(first_bucket["count"], int)


def test_simulate_weeks_to_items_success():
    client = ApiTestClient(app)
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
    assert isinstance(body["seed"], int)
    assert "risk_score" in body
    assert isinstance(body["risk_score"], float)
    assert body["throughput_reliability"]["samples_count"] == 6
    assert (
        body["result_percentiles"]["P50"]
        >= body["result_percentiles"]["P70"]
        >= body["result_percentiles"]["P90"]
    )
    expected = (
        (body["result_percentiles"]["P50"] - body["result_percentiles"]["P90"])
        / body["result_percentiles"]["P50"]
    )
    assert body["risk_score"] == max(0.0, expected)


def test_simulate_include_zero_weeks_keeps_zero_samples():
    client = ApiTestClient(app)
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
    client = ApiTestClient(app)
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 2, 3, 4, 5, 6],
            "mode": "backlog_to_weeks",
            "n_sims": 2000,
        },
    )

    assert r.status_code == 422
    assert "backlog_size" in str(r.json()["detail"])


def test_simulate_requires_target_weeks_for_weeks_mode():
    client = ApiTestClient(app)
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 2, 3, 4, 5, 6],
            "mode": "weeks_to_items",
            "n_sims": 2000,
        },
    )

    assert r.status_code == 422
    assert "target_weeks" in str(r.json()["detail"])


def test_simulate_rejects_insufficient_non_zero_history():
    client = ApiTestClient(app)
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
    client = ApiTestClient(app)
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


def test_simulate_accepts_contract_boundaries():
    client = ApiTestClient(app)
    response = client.post(
        "/simulate",
        json={
            "throughput_samples": [1] * SIMULATION_THROUGHPUT_SAMPLES_MIN,
            "mode": "weeks_to_items",
            "target_weeks": SIMULATION_HORIZON_WEEKS_MAX,
            "n_sims": SIMULATION_N_SIMS_MIN,
        },
    )

    assert response.status_code == 200


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("n_sims", SIMULATION_N_SIMS_MIN - 1),
        ("n_sims", SIMULATION_N_SIMS_MAX + 1),
        ("target_weeks", 0),
        ("target_weeks", SIMULATION_HORIZON_WEEKS_MAX + 1),
        ("backlog_size", 0),
        ("backlog_size", SIMULATION_BACKLOG_SIZE_MAX + 1),
    ],
)
def test_simulate_rejects_out_of_range_numeric_contract_values(field, value):
    client = ApiTestClient(app)
    payload = {
        "throughput_samples": [1] * SIMULATION_THROUGHPUT_SAMPLES_MIN,
        "mode": "backlog_to_weeks" if field != "target_weeks" else "weeks_to_items",
        "backlog_size": 10,
        "target_weeks": 10,
        "n_sims": SIMULATION_N_SIMS_MIN,
    }
    payload[field] = value
    if payload["mode"] == "backlog_to_weeks":
        payload.pop("target_weeks", None)
    else:
        payload.pop("backlog_size", None)

    response = client.post("/simulate", json=payload)

    assert response.status_code == 422
    assert field in str(response.json()["detail"])


@pytest.mark.parametrize(
    "samples_count",
    [SIMULATION_THROUGHPUT_SAMPLES_MIN - 1, SIMULATION_THROUGHPUT_SAMPLES_MAX + 1],
)
def test_simulate_rejects_out_of_range_throughput_samples_count(samples_count):
    client = ApiTestClient(app)
    response = client.post(
        "/simulate",
        json={
            "throughput_samples": [1] * samples_count,
            "mode": "backlog_to_weeks",
            "backlog_size": 10,
            "n_sims": SIMULATION_N_SIMS_MIN,
        },
    )

    assert response.status_code == 422
    assert "throughput_samples" in str(response.json()["detail"])


def test_simulate_rate_limit_returns_429():
    client = ApiTestClient(app)
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
    client = ApiTestClient(app)
    payload = {
        "throughput_samples": [1, 2, 3, 4, 5, 6],
        "mode": "backlog_to_weeks",
        "backlog_size": 10,
        "n_sims": 2000,
    }

    def slow_compute(_command):
        time.sleep(0.05)
        raise AssertionError("the timed-out result must not be observed")

    monkeypatch.setattr("backend.api_routes_simulate.run_simulation", slow_compute)
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


def test_simulate_returns_business_percentiles_for_known_discrete_results(monkeypatch):
    client = ApiTestClient(app)
    backlog_payload = {
        "throughput_samples": [1, 2, 3, 4, 5, 6],
        "mode": "backlog_to_weeks",
        "backlog_size": 10,
        "n_sims": 1000,
    }
    items_payload = {
        "throughput_samples": [1, 2, 3, 4, 5, 6],
        "mode": "weeks_to_items",
        "target_weeks": 5,
        "n_sims": 1000,
    }
    known_backlog = np.array([3, 4, 6, 8, 10], dtype=int)
    known_items = np.array([18, 22, 24, 25, 27], dtype=int)

    def fake_compute(command, _samples):
        if command.mode == "backlog_to_weeks":
            return known_backlog, "weeks"
        return known_items, "items"

    monkeypatch.setattr("backend.simulation_service._run_engine", fake_compute)

    backlog_response = client.post("/simulate", json=backlog_payload)
    items_response = client.post("/simulate", json=items_payload)

    assert backlog_response.status_code == 200
    assert backlog_response.json()["result_percentiles"] == {"P50": 6, "P70": 8, "P90": 10}
    assert backlog_response.json()["risk_score"] == pytest.approx((10 - 6) / 6)
    assert isinstance(backlog_response.json()["seed"], int)
    assert items_response.status_code == 200
    assert items_response.json()["result_percentiles"] == {"P50": 24, "P70": 22, "P90": 18}
    assert items_response.json()["risk_score"] == 0.25
    assert isinstance(items_response.json()["seed"], int)


def test_simulate_backlog_to_weeks_omits_unidentifiable_percentiles_and_risk_score(monkeypatch):
    client = ApiTestClient(app)

    def fake_compute(_command, _samples):
        return (
            FinishWeeksSimulation(
                weeks_needed=np.array([521, 521, 521], dtype=int),
                completed_mask=np.array([False, False, False], dtype=bool),
                horizon_weeks=521,
            ),
            "weeks",
        )

    monkeypatch.setattr("backend.simulation_service._run_engine", fake_compute)

    response = client.post(
        "/simulate",
        json={
            "throughput_samples": [0, 0, 0, 0, 0, 0],
            "include_zero_weeks": True,
            "mode": "backlog_to_weeks",
            "backlog_size": 10,
            "n_sims": 2000,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["result_percentiles"] == {}
    assert "risk_score" not in body
    assert body["result_distribution"] == []
    assert body["completion_summary"] == {
        "completed_count": 0,
        "censored_count": 3,
        "censored_rate": 1.0,
        "horizon_weeks": 521,
    }


def test_simulate_backlog_to_weeks_keeps_exact_finish_at_horizon_distinct_from_censure(monkeypatch):
    client = ApiTestClient(app)

    def fake_compute(_command, _samples):
        return (
            FinishWeeksSimulation(
                weeks_needed=np.array([521, 521, 521], dtype=int),
                completed_mask=np.array([True, False, True], dtype=bool),
                horizon_weeks=521,
            ),
            "weeks",
        )

    monkeypatch.setattr("backend.simulation_service._run_engine", fake_compute)

    response = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 1, 1, 1, 1, 1],
            "mode": "backlog_to_weeks",
            "backlog_size": 10,
            "n_sims": 2000,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["result_distribution"] == [{"x": 521, "count": 2}]
    assert body["completion_summary"] == {
        "completed_count": 2,
        "censored_count": 1,
        "censored_rate": 0.3333,
        "horizon_weeks": 521,
    }
    assert body["result_percentiles"] == {"P50": 521}
    assert "risk_score" not in body


def test_simulate_returns_same_result_for_same_seed():
    client = ApiTestClient(app)
    payload = {
        "throughput_samples": [1, 2, 3, 4, 5, 6],
        "mode": "backlog_to_weeks",
        "backlog_size": 20,
        "n_sims": 2000,
        "seed": 123456,
    }

    first = client.post("/simulate", json=payload)
    second = client.post("/simulate", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()


def test_simulate_uses_requested_seed():
    client = ApiTestClient(app)
    response = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 2, 3, 4, 5, 6],
            "mode": "weeks_to_items",
            "target_weeks": 8,
            "n_sims": 2000,
            "seed": 98765,
        },
    )

    assert response.status_code == 200
    assert response.json()["seed"] == 98765


@pytest.mark.parametrize(
    "seed",
    [-1, SIMULATION_SEED_MAX + 1],
)
def test_simulate_rejects_invalid_seed(seed):
    client = ApiTestClient(app)
    response = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 2, 3, 4, 5, 6],
            "mode": "backlog_to_weeks",
            "backlog_size": 20,
            "n_sims": 2000,
            "seed": seed,
        },
    )

    assert response.status_code == 422


def test_resolve_simulation_seed_returns_requested_value():
    assert _resolve_simulation_seed(321) == 321


def test_resolve_simulation_seed_generates_value_in_range(monkeypatch):
    monkeypatch.setattr("backend.api_routes_simulate.secrets.randbelow", lambda limit: limit - 1)

    assert _resolve_simulation_seed(None) == SIMULATION_SEED_MAX


class _FakeStore:
    def __init__(self, enabled: bool, fail: bool = False):
        self.enabled = enabled
        self.fail = fail
        self.saved: list[tuple[str, SimulationCommand, SimulationResult]] = []

    def save_simulation(self, mc_client_id, command, result):
        if self.fail:
            raise RuntimeError("mongo down")
        self.saved.append((mc_client_id, command, result))


def _build_request_with_cookie(cookie_name: str, cookie_value: str | None = None) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if cookie_value is not None:
        headers.append((b"cookie", f"{cookie_name}={cookie_value}".encode()))
    return Request({"type": "http", "headers": headers})


def _build_command() -> SimulationCommand:
    return SimulationCommand(
        throughput_samples=(1, 2, 3, 4, 5, 6),
        include_zero_weeks=False,
        mode="backlog_to_weeks",
        backlog_size=20,
        target_weeks=None,
        n_sims=2000,
        seed=123,
    )


def _build_result_model() -> SimulationResult:
    return SimulationResult(
        result_kind="weeks",
        result_percentiles={"P50": 10, "P70": 12, "P90": 15},
        risk_score=0.5,
        result_distribution=(HistogramBucket(x=10, count=4),),
        completion_summary=CompletionSummary(
            completed_count=4,
            censored_count=0,
            censored_rate=0.0,
            horizon_weeks=521,
        ),
        samples_count=6,
        throughput_reliability=ThroughputReliability(
            cv=0.2,
            iqr_ratio=0.3,
            slope_norm=0.1,
            label="fiable",
            samples_count=6,
        ),
        seed=123,
    )


def test_persist_simulation_saves_when_cookie_present_and_store_enabled(monkeypatch):
    from backend import api_routes_simulate

    fake = _FakeStore(enabled=True)
    monkeypatch.setattr(api_routes_simulate, "simulation_store", fake)
    _persist_simulation("client-123", _build_command(), _build_result_model())

    assert len(fake.saved) == 1
    saved_id, saved_command, saved_result = fake.saved[0]
    assert saved_id == "client-123"
    assert saved_command.backlog_size == 20
    assert saved_result.result_kind == "weeks"
    assert saved_result.seed == 123


def test_persist_simulation_skips_when_cookie_missing(monkeypatch):
    from backend import api_routes_simulate

    fake = _FakeStore(enabled=True)
    monkeypatch.setattr(api_routes_simulate, "simulation_store", fake)
    _persist_simulation("", _build_command(), _build_result_model())

    assert fake.saved == []


def test_persist_simulation_skips_when_store_disabled(monkeypatch):
    from backend import api_routes_simulate

    fake = _FakeStore(enabled=False)
    monkeypatch.setattr(api_routes_simulate, "simulation_store", fake)
    _persist_simulation("client-123", _build_command(), _build_result_model())

    assert fake.saved == []


def test_persist_simulation_logs_warning_when_store_fails(monkeypatch, caplog):
    from backend import api_routes_simulate

    fake = _FakeStore(enabled=True, fail=True)
    monkeypatch.setattr(api_routes_simulate, "simulation_store", fake)

    with caplog.at_level("WARNING"):
        _persist_simulation("client-123", _build_command(), _build_result_model())

    assert fake.saved == []
    assert "Simulation persistence failed" in caplog.text


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
    client = ApiTestClient(app)
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
