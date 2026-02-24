from fastapi.testclient import TestClient

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
