from __future__ import annotations

from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def _front_dist_dir() -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / "frontend" / "dist"


def mount_frontend(app: FastAPI) -> None:
    front_dir = _front_dist_dir()
    if front_dir.exists():
        app.mount("/", StaticFiles(directory=str(front_dir), html=True), name="front")

        @app.get("/")
        def index():
            return FileResponse(str(front_dir / "index.html"))
