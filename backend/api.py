from __future__ import annotations

import sys
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
from .api_config import get_api_config
from .api_dependencies import (
    ApiRouteDependencies,
    build_api_route_dependencies,
)
from .api_helpers import pick_profile_name, require_pat, validate_pat
from .api_routes_auth import build_auth_router
from .api_routes_forecast import build_forecast_router
from .api_routes_teams import build_teams_router
from .api_static import mount_frontend
from .mc_core import histogram_buckets, mc_finish_weeks, mc_items_done_for_weeks, percentiles


# Backward-compatible helper names used by tests.
def _require_pat(x_ado_pat: str | None) -> str:
    return require_pat(x_ado_pat)


def _pick_profile_name(profile: Dict[str, Any]) -> str:
    return pick_profile_name(profile)

ROUTE_DEPS: ApiRouteDependencies = build_api_route_dependencies(sys.modules[__name__])


app = FastAPI(title="ADO Monte Carlo API", version="0.1")
API_CONFIG = get_api_config()

app.add_middleware(
    CORSMiddleware,
    allow_origins=API_CONFIG.cors_origins,
    allow_credentials=API_CONFIG.cors_allow_credentials,
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
        histogram_buckets=ROUTE_DEPS.forecast.histogram_buckets,
        request_timeout_seconds=lambda: API_CONFIG.forecast_timeout_seconds,
    )
)

mount_frontend(app)
