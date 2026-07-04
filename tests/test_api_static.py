import shutil
from pathlib import Path

from fastapi import FastAPI
from fastapi.routing import APIRoute

from backend import api_static
from tests.http_client import ApiTestClient


def _workspace_temp_front_dir() -> Path:
    base_dir = Path(__file__).resolve().parent.parent / ".tmp_api_static_tests"
    if base_dir.exists():
        shutil.rmtree(base_dir)
    return base_dir / "frontend" / "dist"


def test_mount_frontend_serves_index_when_dist_exists(monkeypatch):
    front_dir = _workspace_temp_front_dir()
    front_dir.mkdir(parents=True)
    index_file = front_dir / "index.html"
    index_file.write_text("<html><body>frontend ok</body></html>", encoding="utf-8")

    monkeypatch.setattr(api_static, "_front_dist_dir", lambda: front_dir)
    app = FastAPI()

    api_static.mount_frontend(app)

    client = ApiTestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert "frontend ok" in response.text

    index_route = next(
        route for route in app.routes if isinstance(route, APIRoute) and route.path == "/"
    )
    direct_response = index_route.endpoint()
    assert Path(direct_response.path).name == "index.html"


def test_mount_frontend_leaves_root_unmounted_when_dist_is_missing(monkeypatch):
    front_dir = _workspace_temp_front_dir()
    monkeypatch.setattr(api_static, "_front_dist_dir", lambda: front_dir)
    app = FastAPI()

    api_static.mount_frontend(app)

    client = ApiTestClient(app)
    response = client.get("/")
    assert response.status_code == 404
