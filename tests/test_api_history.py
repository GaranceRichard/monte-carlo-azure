from fastapi.testclient import TestClient

from backend import api_routes_simulate
from backend.api import app


class _FakeStore:
    def __init__(self, enabled: bool, rows: list[dict] | None = None, fail: bool = False):
        self.enabled = enabled
        self.rows = rows or []
        self.fail = fail
        self.saved: list[tuple[str, dict, dict]] = []

    def save_simulation(self, mc_client_id, req, response):
        if self.fail:
            raise RuntimeError("mongo down")
        self.saved.append((mc_client_id, req.model_dump(), response.model_dump()))

    def list_recent(self, mc_client_id):
        if self.fail:
            raise RuntimeError("mongo down")
        return self.rows


def test_simulate_persists_when_cookie_present(monkeypatch):
    fake = _FakeStore(enabled=True)
    monkeypatch.setattr(api_routes_simulate, "simulation_store", fake)
    client_id = "f47ac10b-58cc-4372-a567-0e02b2c3d479"

    client = TestClient(app)
    client.cookies.set(api_routes_simulate.cfg.client_cookie_name, client_id)
    r = client.post(
        "/simulate",
        json={
            "throughput_samples": [1, 2, 3, 4, 5, 6],
            "mode": "backlog_to_weeks",
            "backlog_size": 20,
            "n_sims": 2000,
            "capacity_percent": 90,
            "client_context": {
                "selected_org": "org-demo",
                "selected_project": "Projet A",
                "selected_team": "Equipe Alpha",
            },
        },
    )

    assert r.status_code == 200
    assert len(fake.saved) == 1
    saved_id, saved_req, saved_resp = fake.saved[0]
    assert saved_id.startswith("f47ac10b")
    assert saved_req["capacity_percent"] == 90
    assert "result_percentiles" in saved_resp


def test_simulation_history_reads_last_items_from_store(monkeypatch):
    fake = _FakeStore(
        enabled=True,
        rows=[
            {
                "created_at": "2026-02-26T10:00:00Z",
                "last_seen": "2026-02-26T10:00:00Z",
                "mode": "backlog_to_weeks",
                "backlog_size": 80,
                "target_weeks": None,
                "n_sims": 20000,
                "capacity_percent": 100,
                "samples_count": 24,
                "percentiles": {"P50": 10, "P70": 12, "P90": 14},
                "distribution": [{"x": 8, "count": 120}],
                "selected_org": "org-demo",
                "selected_project": "Projet A",
                "selected_team": "Equipe Alpha",
                "start_date": "2026-01-01",
                "end_date": "2026-02-01",
                "done_states": ["Done"],
                "types": ["Bug"],
                "include_zero_weeks": False,
            }
        ],
    )
    monkeypatch.setattr(api_routes_simulate, "simulation_store", fake)
    client_id = "f47ac10b-58cc-4372-a567-0e02b2c3d479"

    client = TestClient(app)
    client.cookies.set(api_routes_simulate.cfg.client_cookie_name, client_id)
    r = client.get(
        "/simulations/history",
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["mode"] == "backlog_to_weeks"
    assert body[0]["samples_count"] == 24


def test_simulation_history_returns_empty_without_cookie(monkeypatch):
    fake = _FakeStore(enabled=True)
    monkeypatch.setattr(api_routes_simulate, "simulation_store", fake)
    client = TestClient(app)
    r = client.get("/simulations/history")
    assert r.status_code == 200
    assert r.json() == []
