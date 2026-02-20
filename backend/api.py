from __future__ import annotations

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
import numpy as np
import requests

from .ado_core import (
    get_current_user,
    list_accessible_orgs,
    list_projects,
    list_projects_for_org,
    list_team_work_item_options,
    list_teams_for_org_project,
    list_teams,
    team_settings_areas,
    weekly_throughput,
)
from .ado_config import get_ado_config
from .mc_core import mc_finish_weeks, mc_items_done_for_weeks, percentiles


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
    mode: Literal["backlog_to_weeks", "weeks_to_items"] = Field(
        default="backlog_to_weeks",
        description="Mode de simulation: backlog_to_weeks ou weeks_to_items",
    )
    backlog_size: Optional[int] = Field(default=None, ge=1)
    target_weeks: Optional[int] = Field(default=None, ge=1)

    done_states: List[str] = ["Done", "Closed", "Resolved"]
    work_item_types: List[str] = ["User Story", "Product Backlog Item", "Bug"]

    n_sims: int = Field(20000, ge=1000, le=200000)
    area_path: Optional[str] = Field(
        default=None,
        description="AreaPath à utiliser. Si absent, on prend defaultValue des settings de team."
    )


class OrgRequest(BaseModel):
    org: str = Field(..., description="Nom de l'organisation Azure DevOps")


class OrgProjectRequest(BaseModel):
    org: str = Field(..., description="Nom de l'organisation Azure DevOps")
    project: str = Field(..., description="Nom du projet Azure DevOps")


class TeamOptionsRequest(BaseModel):
    org: str = Field(..., description="Nom de l'organisation Azure DevOps")
    project: str = Field(..., description="Nom du projet Azure DevOps")
    team: str = Field(..., description="Nom de l'equipe Azure DevOps")


def _require_pat(x_ado_pat: str | None) -> str:
    pat = (x_ado_pat or "").strip()
    if not pat:
        raise HTTPException(
            status_code=400,
            detail="PAT Azure DevOps requis via header x-ado-pat. Il est utilise en memoire uniquement et n'est pas sauvegarde.",
        )
    # Validation locale minimale pour éviter un appel réseau inutile
    # sur des tokens manifestement invalides (ex: "aaa").
    if len(pat) < 20 or any(ch.isspace() for ch in pat):
        raise HTTPException(
            status_code=401,
            detail="PAT invalide ou non autorisé sur Azure DevOps.",
        )
    return pat


def validate_pat(pat: str) -> None:
    """
    Vérifie la validité du PAT via un appel ADO léger.
    """
    try:
        list_projects(pat=pat)
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (400, 401, 403):
            raise HTTPException(
                status_code=401,
                detail="PAT invalide ou non autorisé sur Azure DevOps.",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail="Erreur Azure DevOps pendant la verification du PAT.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=401,
            detail="PAT invalide ou non autorisé sur Azure DevOps.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Impossible de verifier le PAT pour le moment.",
        ) from exc


def _pick_profile_name(profile: Dict[str, Any]) -> str:
    # Champs directs possibles selon endpoint/tenant
    direct_candidates = [
        profile.get("fullName"),
        profile.get("displayName"),
        profile.get("publicAlias"),
        profile.get("emailAddress"),
    ]
    for value in direct_candidates:
        if isinstance(value, str) and value.strip():
            return value.strip()

    # Certains profils exposent le nom dans coreAttributes.*.value
    core = profile.get("coreAttributes")
    if isinstance(core, dict):
        for key in ("DisplayName", "displayName", "FullName", "fullName", "PublicAlias", "publicAlias"):
            node = core.get(key)
            if isinstance(node, dict):
                value = node.get("value")
                if isinstance(value, str) and value.strip():
                    return value.strip()

    return "Utilisateur"


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/auth/check")
def auth_check(x_ado_pat: str | None = Header(default=None)) -> Dict[str, str]:
    pat = _require_pat(x_ado_pat)
    validate_pat(pat)
    user_name = "Utilisateur"
    try:
        profile = get_current_user(pat=pat)
        user_name = _pick_profile_name(profile)
    except Exception:
        pass
    return {
        "status": "ok",
        "message": "PAT valide (non sauvegarde).",
        "user_name": user_name,
    }


@app.get("/auth/orgs")
def auth_orgs(x_ado_pat: str | None = Header(default=None)) -> Dict[str, Any]:
    pat = _require_pat(x_ado_pat)
    validate_pat(pat)
    try:
        orgs = list_accessible_orgs(pat=pat)
    except Exception:
        # Certains PAT valides pour dev.azure.com ne permettent pas toujours
        # l'endpoint global de découverte d'organisations.
        cfg = get_ado_config(pat_override=pat)
        orgs = [
            {
                "id": None,
                "name": cfg.org,
                "account_uri": f"https://dev.azure.com/{cfg.org}",
            }
        ]
    return {
        "status": "ok",
        "orgs": orgs,
    }


@app.post("/auth/projects")
def auth_projects(req: OrgRequest, x_ado_pat: str | None = Header(default=None)) -> Dict[str, Any]:
    pat = _require_pat(x_ado_pat)
    org_clean = (req.org or "").strip()
    if not org_clean:
        raise HTTPException(status_code=400, detail="Champ org requis.")
    validate_pat(pat)
    try:
        projects = list_projects_for_org(org=org_clean, pat=pat)
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (401, 403, 404):
            raise HTTPException(
                status_code=403,
                detail="Organisation inaccessible avec ce PAT.",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail="Erreur Azure DevOps pendant la lecture des projets.",
        ) from exc
    return {
        "status": "ok",
        "org": org_clean,
        "projects": [{"id": p.get("id"), "name": p.get("name")} for p in projects],
    }


@app.post("/auth/teams")
def auth_teams(req: OrgProjectRequest, x_ado_pat: str | None = Header(default=None)) -> Dict[str, Any]:
    pat = _require_pat(x_ado_pat)
    org_clean = (req.org or "").strip()
    project_clean = (req.project or "").strip()
    if not org_clean:
        raise HTTPException(status_code=400, detail="Champ org requis.")
    if not project_clean:
        raise HTTPException(status_code=400, detail="Champ project requis.")
    validate_pat(pat)
    try:
        teams = list_teams_for_org_project(org=org_clean, project=project_clean, pat=pat)
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (401, 403, 404):
            raise HTTPException(
                status_code=403,
                detail="Projet inaccessible avec ce PAT.",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail="Erreur Azure DevOps pendant la lecture des equipes.",
        ) from exc
    return {
        "status": "ok",
        "org": org_clean,
        "project": project_clean,
        "teams": [{"id": t.get("id"), "name": t.get("name")} for t in teams],
    }


@app.post("/auth/team-options")
def auth_team_options(
    req: TeamOptionsRequest,
    x_ado_pat: str | None = Header(default=None),
) -> Dict[str, Any]:
    pat = _require_pat(x_ado_pat)
    org_clean = (req.org or "").strip()
    project_clean = (req.project or "").strip()
    team_clean = (req.team or "").strip()
    if not org_clean:
        raise HTTPException(status_code=400, detail="Champ org requis.")
    if not project_clean:
        raise HTTPException(status_code=400, detail="Champ project requis.")
    if not team_clean:
        raise HTTPException(status_code=400, detail="Champ team requis.")
    validate_pat(pat)
    try:
        options = list_team_work_item_options(
            org=org_clean,
            project=project_clean,
            team=team_clean,
            pat=pat,
        )
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (401, 403, 404):
            raise HTTPException(
                status_code=403,
                detail="Equipe inaccessible avec ce PAT.",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail="Erreur Azure DevOps pendant la lecture des options d'equipe.",
        ) from exc
    return {
        "status": "ok",
        "org": org_clean,
        "project": project_clean,
        "team": team_clean,
        "done_states": options.get("states", []),
        "work_item_types": options.get("types", []),
        "states_by_type": options.get("states_by_type", {}),
    }


@app.get("/teams")
def teams(x_ado_pat: str | None = Header(default=None)) -> List[Dict[str, Any]]:
    pat = _require_pat(x_ado_pat)
    t = list_teams(pat=pat)
    return [{"name": x.get("name"), "id": x.get("id")} for x in t]


@app.get("/teams/{team_name}/settings")
def team_settings(team_name: str, x_ado_pat: str | None = Header(default=None)) -> Dict[str, Any]:
    pat = _require_pat(x_ado_pat)
    areas = team_settings_areas(team_name, pat=pat)
    return {
        "team": team_name,
        "default_area_path": areas.get("defaultValue"),
        "area_paths": [
            {"value": v.get("value"), "includeChildren": v.get("includeChildren")}
            for v in (areas.get("values") or [])
        ],
    }


@app.post("/forecast")
def forecast(req: ForecastRequest, x_ado_pat: str | None = Header(default=None)) -> Dict[str, Any]:
    pat = _require_pat(x_ado_pat)
    # 1) Résoudre l'AreaPath à partir de la team si non fourni
    area_path = req.area_path
    if not area_path:
        areas = team_settings_areas(req.team_name, pat=pat)
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
        pat=pat,
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

    # 4) Monte Carlo selon mode
    result_percentiles: Dict[str, int]
    result_distribution: list[int]
    result_kind: str

    if req.mode == "weeks_to_items":
        if not req.target_weeks:
            raise HTTPException(
                status_code=400,
                detail="target_weeks requis pour le mode weeks_to_items.",
            )
        items_done = mc_items_done_for_weeks(
            weeks=req.target_weeks,
            throughput_samples=samples,
            n_sims=req.n_sims,
            seed=42,
        )
        result_percentiles = percentiles(items_done, ps=(50, 70, 90))
        result_distribution = items_done.tolist()
        result_kind = "items"
    else:
        if not req.backlog_size:
            raise HTTPException(
                status_code=400,
                detail="backlog_size requis pour le mode backlog_to_weeks.",
            )
        weeks_needed = mc_finish_weeks(
            backlog_size=req.backlog_size,
            throughput_samples=samples,
            n_sims=req.n_sims,
            seed=42,
        )
        result_percentiles = percentiles(weeks_needed, ps=(50, 70, 90))
        result_distribution = weeks_needed.tolist()
        result_kind = "weeks"

    # 5) Réponse JSON (front-friendly)
    body: Dict[str, Any] = {
        "team": req.team_name,
        "area_path": area_path,
        "mode": req.mode,
        "result_kind": result_kind,
        "samples_count": int(len(samples)),
        "result_percentiles": result_percentiles,
        "result_distribution": result_distribution,
        "weekly_throughput": weekly.assign(
            week=weekly["week"].astype(str)  # JSON sérialisable
        ).to_dict(orient="records"),
    }

    # Compatibilité historique frontend/tests
    if result_kind == "weeks":
        body["backlog_size"] = req.backlog_size
        body["weeks_percentiles"] = result_percentiles
        body["weeks_distribution"] = result_distribution
    else:
        body["target_weeks"] = req.target_weeks
        body["items_percentiles"] = result_percentiles
        body["items_distribution"] = result_distribution

    return body


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
