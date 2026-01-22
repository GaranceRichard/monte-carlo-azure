from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import numpy as np

from .ado_core import list_teams, team_settings_areas, weekly_throughput
from .mc_core import mc_finish_weeks, percentiles


app = FastAPI(title="ADO Monte Carlo API", version="0.1")

# CORS pour un front local (Vite/React par défaut sur 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ForecastRequest(BaseModel):
    team_name: str = Field(..., description="Nom exact de la team (ex: 'CEA-... Team')")
    start_date: str = Field(..., description="YYYY-MM-DD")
    end_date: str = Field(..., description="YYYY-MM-DD")
    backlog_size: int = Field(..., ge=1)

    done_states: List[str] = ["Done", "Closed", "Resolved"]
    work_item_types: List[str] = ["User Story", "Product Backlog Item", "Bug"]

    n_sims: int = Field(20000, ge=1000, le=200000)
    area_path: Optional[str] = Field(
        default=None,
        description="AreaPath à utiliser. Si absent, on prend defaultValue des settings de team."
    )


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/teams")
def teams() -> List[Dict[str, Any]]:
    t = list_teams()
    return [{"name": x.get("name"), "id": x.get("id")} for x in t]


@app.get("/teams/{team_name}/settings")
def team_settings(team_name: str) -> Dict[str, Any]:
    areas = team_settings_areas(team_name)
    return {
        "team": team_name,
        "default_area_path": areas.get("defaultValue"),
        "area_paths": [
            {"value": v.get("value"), "includeChildren": v.get("includeChildren")}
            for v in (areas.get("values") or [])
        ],
    }


@app.post("/forecast")
def forecast(req: ForecastRequest) -> Dict[str, Any]:
    # 1) Résoudre l'AreaPath à partir de la team si non fourni
    area_path = req.area_path
    if not area_path:
        areas = team_settings_areas(req.team_name)
        area_path = areas.get("defaultValue")

    if not area_path:
        raise HTTPException(
            status_code=400,
            detail="Impossible de déterminer l'AreaPath (team settings sans defaultValue).",
        )

    # 2) Throughput hebdo sur l'AreaPath
    weekly = weekly_throughput(
        area_path=area_path,
        start_date=req.start_date,
        end_date=req.end_date,
        done_states=set(req.done_states),
        work_item_types=set(req.work_item_types),
    )

    if weekly.empty:
        raise HTTPException(
            status_code=404,
            detail="Aucun item trouvé avec ces filtres (area/states/types/dates).",
        )

    # 3) Préparer l’échantillon de throughput
    samples = weekly["throughput"].to_numpy()
    samples = samples[samples > 0]
    if len(samples) < 6:
        raise HTTPException(
            status_code=422,
            detail="Historique insuffisant (peu de semaines non-nulles). Élargissez la période.",
        )

    # 4) Monte Carlo (semaines nécessaires pour vider le backlog)
    weeks_needed = mc_finish_weeks(
        backlog_size=req.backlog_size,
        throughput_samples=samples,
        n_sims=req.n_sims,
        seed=42,
    )
    p = percentiles(weeks_needed, ps=(50, 80, 90))

    # 5) Réponse JSON (front-friendly)
    return {
        "team": req.team_name,
        "area_path": area_path,
        "backlog_size": req.backlog_size,
        "samples_count": int(len(samples)),
        "weeks_percentiles": p,
        "weekly_throughput": weekly.assign(
            week=weekly["week"].astype(str)  # JSON sérialisable
        ).to_dict(orient="records"),
        "weeks_distribution": weeks_needed.tolist(),  # histogramme côté front
    }


from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import sys

def _front_dist_dir() -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / "frontend" / "dist"

FRONT_DIR = _front_dist_dir()

if FRONT_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONT_DIR), html=True), name="front")

    @app.get("/")
    def index():
        return FileResponse(str(FRONT_DIR / "index.html"))
