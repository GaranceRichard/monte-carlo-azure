from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import pytest
from pymongo import MongoClient
from pymongo.errors import AutoReconnect, OperationFailure, PyMongoError

import backend.simulation_store as simulation_store_module
from backend.api_config import ApiConfig
from backend.api_models import (
    DistributionBucket,
    SimulateRequest,
    SimulateResponse,
    ThroughputReliability,
)
from backend.simulation_store import SENSITIVE_HISTORY_FIELDS, SimulationStore


class _FakeAdmin:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def command(self, name: str):
        self.calls.append(name)
        return {"ok": 1}


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows

    def sort(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def __iter__(self):
        return iter(self._rows)


class _FakeCollection:
    def __init__(self, rows=None) -> None:
        self.rows = rows or []
        self.index_calls = []
        self.inserted = []
        self.updated = []
        self.find_calls = []
        self.dropped_indexes = []
        self.raise_on_ttl_create = False

    def create_index(self, spec, **kwargs):
        self.index_calls.append((spec, kwargs))
        if (
            self.raise_on_ttl_create
            and spec == [("last_seen", 1)]
            and "expireAfterSeconds" in kwargs
        ):
            self.raise_on_ttl_create = False
            raise OperationFailure(
                "An equivalent index already exists with the same name but different options.",
                code=85,
            )

    def drop_index(self, name):
        self.dropped_indexes.append(name)

    def insert_one(self, doc):
        self.inserted.append(doc)
        return {"inserted_id": "x"}

    def update_many(self, q, upd):
        self.updated.append((q, upd))
        return {"modified_count": 1}

    def find(self, q, proj):
        self.find_calls.append((q, proj))
        return _FakeCursor(self.rows)


class _FakeDatabase:
    def __init__(self, coll: _FakeCollection):
        self.coll = coll

    def __getitem__(self, _collection_name):
        return self.coll


class _FakeMongoClient:
    def __init__(self, coll: _FakeCollection):
        self._coll = coll
        self.admin = _FakeAdmin()
        self.closed = False

    def __getitem__(self, _db_name):
        return _FakeDatabase(self._coll)

    def close(self):
        self.closed = True


def _cfg(mongo_url: str) -> ApiConfig:
    return ApiConfig(
        cors_origins=["http://localhost:5173"],
        cors_allow_credentials=True,
        forecast_timeout_seconds=30.0,
        rate_limit_simulate="20/minute",
        rate_limit_storage_url="memory://",
        client_cookie_name="IDMontecarlo",
        simulation_history_limit=10,
        mongo_url=mongo_url,
        mongo_db="montecarlo",
        mongo_collection_simulations="simulations",
        mongo_min_pool_size=5,
        mongo_max_pool_size=20,
        mongo_server_selection_timeout_ms=2000,
        mongo_connect_timeout_ms=2000,
        mongo_socket_timeout_ms=5000,
        mongo_max_idle_time_ms=60000,
    )


def _req_resp():
    req = SimulateRequest(
        throughput_samples=[1, 2, 3, 4, 5, 6],
        include_zero_weeks=False,
        mode="backlog_to_weeks",
        backlog_size=20,
        n_sims=2000,
        seed=98765,
    )
    resp = SimulateResponse(
        result_kind="weeks",
        result_percentiles={"P50": 10, "P70": 12, "P90": 14},
        risk_score=0.4,
        result_distribution=[DistributionBucket(x=8, count=12)],
        samples_count=6,
        throughput_reliability=ThroughputReliability(
            cv=0.25,
            iqr_ratio=0.2,
            slope_norm=-0.01,
            label="fiable",
            samples_count=6,
        ),
        seed=98765,
    )
    return req, resp


def test_enabled_false_when_mongo_url_empty():
    store = SimulationStore(_cfg(""))
    assert store.enabled is False


def test_ping_returns_false_when_disabled():
    store = SimulationStore(_cfg(""))
    assert store.ping() is False


def test_connect_returns_early_when_disabled(monkeypatch):
    store = SimulationStore(_cfg(""))
    build_calls = []
    monkeypatch.setattr(store, "_build_client", lambda: build_calls.append("called"))

    store.connect()

    assert build_calls == []


def test_ping_calls_admin_ping_when_enabled(monkeypatch):
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()
    fake_client = _FakeMongoClient(fake_coll)
    monkeypatch.setattr("backend.simulation_store.MongoClient", lambda *_a, **_kw: fake_client)

    ok = store.ping()
    assert ok is True
    assert fake_client.admin.calls == ["ping", "ping"]


def test_connect_initializes_indexes_and_pool(monkeypatch):
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()
    fake_client = _FakeMongoClient(fake_coll)
    mongo_calls = []

    def _mongo_factory(*_args, **kwargs):
        mongo_calls.append(kwargs)
        return fake_client

    monkeypatch.setattr("backend.simulation_store.MongoClient", _mongo_factory)

    store.connect()

    assert mongo_calls[0]["minPoolSize"] == 5
    assert mongo_calls[0]["maxPoolSize"] == 20
    assert mongo_calls[0]["retryWrites"] is True
    assert mongo_calls[0]["retryReads"] is True
    assert len(fake_coll.index_calls) == 2


def test_connect_returns_early_when_collection_is_already_initialized(monkeypatch):
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()
    store._collection = fake_coll
    build_calls = []
    monkeypatch.setattr(store, "_build_client", lambda: build_calls.append("called"))

    store.connect()

    assert build_calls == []


def test_connect_returns_early_when_collection_is_initialized_inside_lock(monkeypatch):
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()

    class _LockThatInitializes:
        def __enter__(self):
            store._collection = fake_coll
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    store._lock = _LockThatInitializes()
    build_calls = []
    monkeypatch.setattr(store, "_build_client", lambda: build_calls.append("called"))

    store.connect()

    assert build_calls == []


def test_connect_repairs_conflicting_last_seen_ttl_index(monkeypatch):
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()
    fake_coll.raise_on_ttl_create = True
    fake_client = _FakeMongoClient(fake_coll)
    monkeypatch.setattr("backend.simulation_store.MongoClient", lambda *_a, **_kw: fake_client)

    store.connect()

    assert fake_coll.dropped_indexes == ["last_seen_1"]
    assert fake_coll.index_calls[-1][0] == [("last_seen", 1)]
    assert fake_coll.index_calls[-1][1]["expireAfterSeconds"] == 30 * 24 * 3600


def test_connect_closes_client_and_reraises_when_ping_fails(monkeypatch):
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()
    fake_client = _FakeMongoClient(fake_coll)

    def _broken_ping(name: str):
        raise RuntimeError(f"ping failed: {name}")

    fake_client.admin.command = _broken_ping
    monkeypatch.setattr("backend.simulation_store.MongoClient", lambda *_a, **_kw: fake_client)

    with pytest.raises(RuntimeError, match="ping failed"):
        store.connect()

    assert fake_client.closed is True
    assert store._collection is None
    assert store._client is None


def test_ensure_indexes_reraises_non_conflicting_operation_failure():
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()

    def _raise_unexpected(spec, **kwargs):
        if spec == [("last_seen", 1)] and "expireAfterSeconds" in kwargs:
            raise OperationFailure("other index issue", code=123)
        fake_coll.index_calls.append((spec, kwargs))

    fake_coll.create_index = _raise_unexpected

    with pytest.raises(OperationFailure, match="other index issue"):
        store._ensure_indexes(fake_coll)


def test_save_simulation_reconnects_once_after_pymongo_error(monkeypatch):
    req, resp = _req_resp()
    first_coll = _FakeCollection()
    second_coll = _FakeCollection()
    first_coll.insert_one = lambda _doc: (_ for _ in ()).throw(AutoReconnect("down"))
    clients = [_FakeMongoClient(first_coll), _FakeMongoClient(second_coll)]

    def _mongo_factory(*_args, **_kwargs):
        return clients.pop(0)

    monkeypatch.setattr("backend.simulation_store.MongoClient", _mongo_factory)

    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    store.save_simulation("c1", req, resp)

    assert second_coll.inserted[0]["mc_client_id"] == "c1"


def test_save_simulation_noop_when_disabled_or_empty_client():
    req, resp = _req_resp()
    store = SimulationStore(_cfg(""))
    store.save_simulation("", req, resp)
    # no exception == noop
    assert True


def test_close_resets_client_and_collection():
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_client = _FakeMongoClient(_FakeCollection())
    store._client = fake_client
    store._collection = _FakeCollection()

    store.close()

    assert store._client is None
    assert store._collection is None
    assert fake_client.closed is True


def test_save_simulation_inserts_and_updates(monkeypatch):
    req, resp = _req_resp()
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()
    fake_client = _FakeMongoClient(fake_coll)
    monkeypatch.setattr("backend.simulation_store.MongoClient", lambda *_a, **_kw: fake_client)

    store.save_simulation("c1", req, resp)

    assert len(fake_coll.index_calls) == 2
    assert fake_coll.index_calls[1][0] == [("last_seen", 1)]
    assert fake_coll.index_calls[1][1]["expireAfterSeconds"] == 30 * 24 * 3600
    assert len(fake_coll.inserted) == 1
    assert fake_coll.inserted[0]["mc_client_id"] == "c1"
    assert fake_coll.inserted[0]["seed"] == 98765
    assert fake_coll.inserted[0]["distribution"] == [{"x": 8, "count": 12}]
    assert "selected_org" not in fake_coll.inserted[0]
    assert "client_context" not in fake_coll.inserted[0]
    assert len(fake_coll.updated) == 1
    assert fake_coll.updated[0][0] == {"mc_client_id": "c1"}


def test_list_recent_returns_empty_when_disabled_or_empty_client():
    store_disabled = SimulationStore(_cfg(""))
    assert store_disabled.list_recent("c1") == []
    store_enabled = SimulationStore(_cfg("mongodb://localhost:27017"))
    assert store_enabled.list_recent("") == []


def test_ensure_collection_raises_when_disabled():
    store = SimulationStore(_cfg(""))

    with pytest.raises(RuntimeError, match="Mongo persistence is disabled"):
        store._ensure_collection()


def test_list_recent_converts_datetimes_to_iso(monkeypatch):
    now = datetime(2026, 2, 26, 10, 0, tzinfo=timezone.utc)
    fake_coll = _FakeCollection(
        rows=[
            {
                "created_at": now,
                "last_seen": now,
                "mode": "backlog_to_weeks",
                "n_sims": 20000,
            },
            {
                "created_at": "already-string",
                "last_seen": "already-string",
                "mode": "weeks_to_items",
                "n_sims": 10000,
            },
        ]
    )
    fake_client = _FakeMongoClient(fake_coll)
    monkeypatch.setattr("backend.simulation_store.MongoClient", lambda *_a, **_kw: fake_client)

    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    out = store.list_recent("c1")

    assert len(out) == 2
    assert out[0]["created_at"] == "2026-02-26T10:00:00Z"
    assert out[0]["last_seen"] == "2026-02-26T10:00:00Z"
    assert out[1]["created_at"] == "already-string"
    assert out[1]["last_seen"] == "already-string"
    assert fake_coll.find_calls[0][0] == {"mc_client_id": "c1"}
    assert fake_coll.find_calls[0][1]["_id"] == 0
    for field in SENSITIVE_HISTORY_FIELDS:
        assert fake_coll.find_calls[0][1][field] == 0


def test_run_with_reconnect_reraises_after_second_pymongo_error():
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    calls = []

    def _always_fail():
        calls.append("attempt")
        raise AutoReconnect("still down")

    with pytest.raises(AutoReconnect, match="still down"):
        store._run_with_reconnect(_always_fail)

    assert calls == ["attempt", "attempt"]


def test_run_with_reconnect_raises_runtime_error_on_unexpected_empty_retry_loop(monkeypatch):
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    monkeypatch.setattr(simulation_store_module, "range", lambda _count: [], raising=False)

    with pytest.raises(RuntimeError, match="unexpectedly"):
        store._run_with_reconnect(lambda: True)


def test_save_and_list_recent_with_real_mongo():
    mongo_url = (os.getenv("APP_MONGO_URL") or "mongodb://localhost:27017").strip()

    db_name = f"{(os.getenv('APP_MONGO_DB') or 'montecarlo_test').strip()}_{uuid.uuid4().hex[:8]}"
    collection_name = "simulations_integration"
    cfg = ApiConfig(
        cors_origins=["http://localhost:5173"],
        cors_allow_credentials=True,
        forecast_timeout_seconds=30.0,
        rate_limit_simulate="20/minute",
        rate_limit_storage_url="memory://",
        client_cookie_name="IDMontecarlo",
        simulation_history_limit=10,
        mongo_url=mongo_url,
        mongo_db=db_name,
        mongo_collection_simulations=collection_name,
        mongo_min_pool_size=5,
        mongo_max_pool_size=20,
        mongo_server_selection_timeout_ms=2000,
        mongo_connect_timeout_ms=2000,
        mongo_socket_timeout_ms=5000,
        mongo_max_idle_time_ms=60000,
    )
    store = SimulationStore(cfg)
    req, resp = _req_resp()
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=1200)
    mongo_available = False

    try:
        try:
            client.admin.command("ping")
            mongo_available = True
        except PyMongoError as exc:
            pytest.fail(
                f"MongoDB integration test requires a reachable Mongo instance at {mongo_url} "
                f"(override with APP_MONGO_URL). Error: {exc}"
            )

        try:
            store.save_simulation("integration-client", req, resp)
            rows = store.list_recent("integration-client")
        except Exception as exc:
            pytest.fail(
                f"MongoDB integration test requires a reachable Mongo instance at {mongo_url} "
                f"(override with APP_MONGO_URL). Error: {exc}"
            )

        assert len(rows) == 1
        row = rows[0]
        assert row["mode"] == "backlog_to_weeks"
        assert row["samples_count"] == 6
        assert row["seed"] == 98765
        assert row["percentiles"]["P50"] == 10

        indexes = list(client[db_name][collection_name].list_indexes())
        ttl_indexes = [
            idx
            for idx in indexes
            if idx.get("key") == {"last_seen": 1} and "expireAfterSeconds" in idx
        ]
        assert ttl_indexes
        assert ttl_indexes[0]["expireAfterSeconds"] == 30 * 24 * 3600
    finally:
        if mongo_available:
            client.drop_database(db_name)
