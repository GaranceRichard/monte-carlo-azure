from __future__ import annotations

from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .ado_core import (
    get_current_user,
    list_accessible_orgs,
    list_projects_for_org,
    list_team_work_item_options,
    list_teams_for_org_project,
    list_teams,
    team_settings_areas,
    weekly_throughput,
)
from .api_helpers import pick_profile_name, require_pat, validate_pat
from .api_routes_auth import build_auth_router
from .api_routes_forecast import build_forecast_router
from .api_routes_teams import build_teams_router
from .api_static import mount_frontend
from .mc_core import mc_finish_weeks, mc_items_done_for_weeks, percentiles


# Backward-compatible helper names used by tests.
def _require_pat(x_ado_pat: str | None) -> str:
    return require_pat(x_ado_pat)


def _pick_profile_name(profile: Dict[str, Any]) -> str:
    return pick_profile_name(profile)


app = FastAPI(title="ADO Monte Carlo API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    build_auth_router(
        require_pat=lambda v: _require_pat(v),
        pick_profile_name=lambda p: _pick_profile_name(p),
        get_current_user=lambda pat: get_current_user(pat=pat),
        list_accessible_orgs=lambda pat: list_accessible_orgs(pat=pat),
        list_projects_for_org=lambda org, pat: list_projects_for_org(org=org, pat=pat),
        list_teams_for_org_project=lambda org, project, pat: list_teams_for_org_project(
            org=org, project=project, pat=pat
        ),
        list_team_work_item_options=lambda org, project, team, pat: list_team_work_item_options(
            org=org, project=project, team=team, pat=pat
        ),
    )
)

app.include_router(
    build_teams_router(
        require_pat=lambda v: _require_pat(v),
        list_teams=lambda pat: list_teams(pat=pat),
        team_settings_areas=lambda team_name, **kwargs: team_settings_areas(team_name, **kwargs),
    )
)

app.include_router(
    build_forecast_router(
        require_pat=lambda v: _require_pat(v),
        team_settings_areas=lambda team_name, **kwargs: team_settings_areas(team_name, **kwargs),
        weekly_throughput=lambda **kwargs: weekly_throughput(**kwargs),
        mc_items_done_for_weeks=lambda **kwargs: mc_items_done_for_weeks(**kwargs),
        mc_finish_weeks=lambda **kwargs: mc_finish_weeks(**kwargs),
        percentiles=lambda arr, ps=(50, 70, 90): percentiles(arr, ps=ps),
    )
)

mount_frontend(app)
