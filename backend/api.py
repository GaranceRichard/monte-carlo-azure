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
from .api_dependencies import (
    ApiRouteDependencies,
    AuthRouteDependencies,
    ForecastRouteDependencies,
    TeamsRouteDependencies,
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


def _get_current_user(pat: str) -> Dict[str, Any]:
    return get_current_user(pat=pat)


def _list_accessible_orgs(pat: str) -> list[Dict[str, Any]]:
    return list_accessible_orgs(pat=pat)


def _list_projects_for_org(org: str, pat: str) -> list[Dict[str, Any]]:
    return list_projects_for_org(org=org, pat=pat)


def _list_teams_for_org_project(org: str, project: str, pat: str) -> list[Dict[str, Any]]:
    return list_teams_for_org_project(org=org, project=project, pat=pat)


def _list_team_work_item_options(org: str, project: str, team: str, pat: str) -> Dict[str, Any]:
    return list_team_work_item_options(org=org, project=project, team=team, pat=pat)


def _list_teams(pat: str | None) -> list[Dict[str, Any]]:
    return list_teams(pat=pat)


def _team_settings_areas(team_name: str, **kwargs: Any) -> Dict[str, Any]:
    return team_settings_areas(team_name, **kwargs)


def _weekly_throughput(**kwargs: Any) -> Any:
    return weekly_throughput(**kwargs)


def _mc_items_done_for_weeks(**kwargs: Any) -> Any:
    return mc_items_done_for_weeks(**kwargs)


def _mc_finish_weeks(**kwargs: Any) -> Any:
    return mc_finish_weeks(**kwargs)


def _percentiles(arr: Any, ps: tuple[int, ...] = (50, 70, 90)) -> Dict[str, int]:
    return percentiles(arr, ps=ps)


ROUTE_DEPS = ApiRouteDependencies(
    auth=AuthRouteDependencies(
        require_pat=_require_pat,
        pick_profile_name=_pick_profile_name,
        get_current_user=_get_current_user,
        list_accessible_orgs=_list_accessible_orgs,
        list_projects_for_org=_list_projects_for_org,
        list_teams_for_org_project=_list_teams_for_org_project,
        list_team_work_item_options=_list_team_work_item_options,
    ),
    teams=TeamsRouteDependencies(
        require_pat=_require_pat,
        list_teams=_list_teams,
        team_settings_areas=_team_settings_areas,
    ),
    forecast=ForecastRouteDependencies(
        require_pat=_require_pat,
        team_settings_areas=_team_settings_areas,
        weekly_throughput=_weekly_throughput,
        mc_items_done_for_weeks=_mc_items_done_for_weeks,
        mc_finish_weeks=_mc_finish_weeks,
        percentiles=_percentiles,
    ),
)


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
        require_pat=ROUTE_DEPS.auth.require_pat,
        pick_profile_name=ROUTE_DEPS.auth.pick_profile_name,
        get_current_user=ROUTE_DEPS.auth.get_current_user,
        list_accessible_orgs=ROUTE_DEPS.auth.list_accessible_orgs,
        list_projects_for_org=ROUTE_DEPS.auth.list_projects_for_org,
        list_teams_for_org_project=ROUTE_DEPS.auth.list_teams_for_org_project,
        list_team_work_item_options=ROUTE_DEPS.auth.list_team_work_item_options,
    )
)

app.include_router(
    build_teams_router(
        require_pat=ROUTE_DEPS.teams.require_pat,
        list_teams=ROUTE_DEPS.teams.list_teams,
        team_settings_areas=ROUTE_DEPS.teams.team_settings_areas,
    )
)

app.include_router(
    build_forecast_router(
        require_pat=ROUTE_DEPS.forecast.require_pat,
        team_settings_areas=ROUTE_DEPS.forecast.team_settings_areas,
        weekly_throughput=ROUTE_DEPS.forecast.weekly_throughput,
        mc_items_done_for_weeks=ROUTE_DEPS.forecast.mc_items_done_for_weeks,
        mc_finish_weeks=ROUTE_DEPS.forecast.mc_finish_weeks,
        percentiles=ROUTE_DEPS.forecast.percentiles,
    )
)

mount_frontend(app)
