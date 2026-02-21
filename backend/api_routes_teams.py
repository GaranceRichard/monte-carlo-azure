from __future__ import annotations

from typing import Any, Callable, Dict, List

from fastapi import APIRouter, Header


def build_teams_router(
    require_pat: Callable[[str | None], str],
    list_teams: Callable[[str | None], List[Dict[str, Any]]],
    team_settings_areas: Callable[..., Dict[str, Any]],
) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> Dict[str, str]:
        return {"status": "ok"}

    @router.get("/teams")
    def teams(x_ado_pat: str | None = Header(default=None)) -> List[Dict[str, Any]]:
        pat = require_pat(x_ado_pat)
        t = list_teams(pat)
        return [{"name": x.get("name"), "id": x.get("id")} for x in t]

    @router.get("/teams/{team_name}/settings")
    def team_settings(team_name: str, x_ado_pat: str | None = Header(default=None)) -> Dict[str, Any]:
        pat = require_pat(x_ado_pat)
        areas = team_settings_areas(team_name, pat=pat)
        return {
            "team": team_name,
            "default_area_path": areas.get("defaultValue"),
            "area_paths": [
                {"value": v.get("value"), "includeChildren": v.get("includeChildren")}
                for v in (areas.get("values") or [])
            ],
        }

    return router
