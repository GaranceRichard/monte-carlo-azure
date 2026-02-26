from fastapi.testclient import TestClient

from backend import api
from backend.api import app


def test_health():
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_health_cors_preflight_allows_get():
    client = TestClient(app)
    r = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == 200
    allow_methods = r.headers.get("access-control-allow-methods", "")
    assert "GET" in allow_methods


def test_health_mongo_disabled_returns_disabled(monkeypatch):
    class _DisabledStore:
        enabled = False

    monkeypatch.setattr(api, "simulation_store", _DisabledStore())
    client = TestClient(app)
    r = client.get("/health/mongo")
    assert r.status_code == 200
    assert r.json() == {"status": "disabled"}


def test_health_mongo_enabled_returns_ok(monkeypatch):
    class _EnabledStore:
        enabled = True

        @staticmethod
        def ping():
            return True

    monkeypatch.setattr(api, "simulation_store", _EnabledStore())
    client = TestClient(app)
    r = client.get("/health/mongo")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_health_mongo_enabled_but_unreachable_returns_503(monkeypatch):
    class _FailingStore:
        enabled = True

        @staticmethod
        def ping():
            raise RuntimeError("down")

    monkeypatch.setattr(api, "simulation_store", _FailingStore())
    client = TestClient(app)
    r = client.get("/health/mongo")
    assert r.status_code == 503
    assert r.json()["detail"] == "mongo_unreachable"
