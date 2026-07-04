import asyncio

from fastapi import FastAPI

from backend import api
from backend.api import app
from tests.http_client import ApiTestClient


def test_lifespan_connects_checks_storage_and_closes_store(monkeypatch):
    calls: list[str] = []

    class _Store:
        enabled = True

        @staticmethod
        def connect():
            calls.append("connect")

        @staticmethod
        def close():
            calls.append("close")

    class _Limiter:
        @staticmethod
        def check_storage():
            calls.append("check_storage")

    async def _run() -> None:
        async with api.lifespan(FastAPI()):
            calls.append("yield")

    monkeypatch.setattr(api, "simulation_store", _Store())
    monkeypatch.setattr(api, "limiter", _Limiter())

    asyncio.run(_run())

    assert calls == ["connect", "check_storage", "yield", "close"]


def test_lifespan_closes_store_when_context_raises(monkeypatch):
    calls: list[str] = []

    class _Store:
        enabled = True

        @staticmethod
        def connect():
            calls.append("connect")

        @staticmethod
        def close():
            calls.append("close")

    class _Limiter:
        @staticmethod
        def check_storage():
            calls.append("check_storage")

    async def _run() -> None:
        async with api.lifespan(FastAPI()):
            calls.append("yield")
            raise RuntimeError("boom")

    monkeypatch.setattr(api, "simulation_store", _Store())
    monkeypatch.setattr(api, "limiter", _Limiter())

    try:
        asyncio.run(_run())
    except RuntimeError as exc:
        assert str(exc) == "boom"
    else:
        raise AssertionError("Expected RuntimeError from lifespan body")

    assert calls == ["connect", "check_storage", "yield", "close"]


def test_health():
    client = ApiTestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_health_cors_preflight_allows_get():
    client = ApiTestClient(app)
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
    client = ApiTestClient(app)
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
    client = ApiTestClient(app)
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
    client = ApiTestClient(app)
    r = client.get("/health/mongo")
    assert r.status_code == 503
    assert r.json()["detail"] == "mongo_unreachable"
