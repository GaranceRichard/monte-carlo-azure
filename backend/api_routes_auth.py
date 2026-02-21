from __future__ import annotations

from typing import Any, Callable, Dict

from fastapi import APIRouter, Header, HTTPException
import requests

from .api_models import OrgProjectRequest, OrgRequest, TeamOptionsRequest


def build_auth_router(
    require_pat: Callable[[str | None], str],
    pick_profile_name: Callable[[Dict[str, Any]], str],
    get_current_user: Callable[[str], Dict[str, Any]],
    list_accessible_orgs: Callable[[str], list[Dict[str, Any]]],
    list_projects_for_org: Callable[[str, str], list[Dict[str, Any]]],
    list_teams_for_org_project: Callable[[str, str, str], list[Dict[str, Any]]],
    list_team_work_item_options: Callable[[str, str, str, str], Dict[str, Any]],
) -> APIRouter:
    router = APIRouter()

    @router.get("/auth/check")
    def auth_check(x_ado_pat: str | None = Header(default=None)) -> Dict[str, str]:
        pat = require_pat(x_ado_pat)
        user_name = "Utilisateur"
        try:
            profile = get_current_user(pat)
            user_name = pick_profile_name(profile)
        except Exception:
            pass
        return {
            "status": "ok",
            "message": "PAT valide (non sauvegarde).",
            "user_name": user_name,
        }

    @router.get("/auth/orgs")
    def auth_orgs(x_ado_pat: str | None = Header(default=None)) -> Dict[str, Any]:
        pat = require_pat(x_ado_pat)
        try:
            orgs = list_accessible_orgs(pat)
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (401, 403):
                raise HTTPException(
                    status_code=401,
                    detail="PAT invalide ou non autorisé sur Azure DevOps.",
                ) from exc
            raise HTTPException(
                status_code=502,
                detail="Erreur Azure DevOps pendant la découverte des organisations.",
            ) from exc
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Impossible de lister les organisations Azure DevOps pour le moment.",
            )
        if not orgs:
            return {
                "status": "ok",
                "orgs": [],
                "detail": "PAT non global et organisation non decouverte automatiquement.",
            }
        return {"status": "ok", "orgs": orgs}

    @router.post("/auth/projects")
    def auth_projects(req: OrgRequest, x_ado_pat: str | None = Header(default=None)) -> Dict[str, Any]:
        pat = require_pat(x_ado_pat)
        org_clean = (req.org or "").strip()
        if not org_clean:
            raise HTTPException(status_code=400, detail="Champ org requis.")
        try:
            projects = list_projects_for_org(org_clean, pat)
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

    @router.post("/auth/teams")
    def auth_teams(req: OrgProjectRequest, x_ado_pat: str | None = Header(default=None)) -> Dict[str, Any]:
        pat = require_pat(x_ado_pat)
        org_clean = (req.org or "").strip()
        project_clean = (req.project or "").strip()
        if not org_clean:
            raise HTTPException(status_code=400, detail="Champ org requis.")
        if not project_clean:
            raise HTTPException(status_code=400, detail="Champ project requis.")
        try:
            teams = list_teams_for_org_project(org_clean, project_clean, pat)
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

    @router.post("/auth/team-options")
    def auth_team_options(
        req: TeamOptionsRequest,
        x_ado_pat: str | None = Header(default=None),
    ) -> Dict[str, Any]:
        pat = require_pat(x_ado_pat)
        org_clean = (req.org or "").strip()
        project_clean = (req.project or "").strip()
        team_clean = (req.team or "").strip()
        if not org_clean:
            raise HTTPException(status_code=400, detail="Champ org requis.")
        if not project_clean:
            raise HTTPException(status_code=400, detail="Champ project requis.")
        if not team_clean:
            raise HTTPException(status_code=400, detail="Champ team requis.")
        try:
            options = list_team_work_item_options(org_clean, project_clean, team_clean, pat)
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

    return router
