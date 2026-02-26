from __future__ import annotations

from datetime import datetime, timezone

from backend.api_config import ApiConfig
from backend.api_models import ClientContext, DistributionBucket, SimulateRequest, SimulateResponse
from backend.simulation_store import SimulationStore


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

    def create_index(self, spec):
        self.index_calls.append(spec)

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

    def __getitem__(self, _db_name):
        return _FakeDatabase(self._coll)


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
    )


def _req_resp():
    req = SimulateRequest(
        throughput_samples=[1, 2, 3, 4, 5, 6],
        include_zero_weeks=False,
        mode="backlog_to_weeks",
        backlog_size=20,
        n_sims=2000,
        capacity_percent=95,
        client_context=ClientContext(
            selected_org="org-demo",
            selected_project="Projet A",
            selected_team="Equipe Alpha",
            start_date="2026-01-01",
            end_date="2026-02-01",
            done_states=["Done"],
            types=["Bug"],
        ),
    )
    resp = SimulateResponse(
        result_kind="weeks",
        result_percentiles={"P50": 10, "P70": 12, "P90": 14},
        risk_score=0.4,
        result_distribution=[DistributionBucket(x=8, count=12)],
        samples_count=6,
    )
    return req, resp


def test_enabled_false_when_mongo_url_empty():
    store = SimulationStore(_cfg(""))
    assert store.enabled is False


def test_ping_returns_false_when_disabled():
    store = SimulationStore(_cfg(""))
    assert store.ping() is False


def test_ping_calls_admin_ping_when_enabled(monkeypatch):
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()
    fake_client = _FakeMongoClient(fake_coll)
    monkeypatch.setattr("backend.simulation_store.MongoClient", lambda *_a, **_kw: fake_client)

    ok = store.ping()
    assert ok is True
    assert fake_client.admin.calls == ["ping"]


def test_save_simulation_noop_when_disabled_or_empty_client():
    req, resp = _req_resp()
    store = SimulationStore(_cfg(""))
    store.save_simulation("", req, resp)
    # no exception == noop
    assert True


def test_save_simulation_inserts_and_updates(monkeypatch):
    req, resp = _req_resp()
    store = SimulationStore(_cfg("mongodb://localhost:27017"))
    fake_coll = _FakeCollection()
    fake_client = _FakeMongoClient(fake_coll)
    monkeypatch.setattr("backend.simulation_store.MongoClient", lambda *_a, **_kw: fake_client)

    store.save_simulation("c1", req, resp)

    assert len(fake_coll.index_calls) == 2
    assert len(fake_coll.inserted) == 1
    assert fake_coll.inserted[0]["mc_client_id"] == "c1"
    assert fake_coll.inserted[0]["capacity_percent"] == 95
    assert fake_coll.inserted[0]["selected_org"] == "org-demo"
    assert fake_coll.inserted[0]["distribution"] == [{"x": 8, "count": 12}]
    assert len(fake_coll.updated) == 1
    assert fake_coll.updated[0][0] == {"mc_client_id": "c1"}


def test_list_recent_returns_empty_when_disabled_or_empty_client():
    store_disabled = SimulationStore(_cfg(""))
    assert store_disabled.list_recent("c1") == []
    store_enabled = SimulationStore(_cfg("mongodb://localhost:27017"))
    assert store_enabled.list_recent("") == []


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
