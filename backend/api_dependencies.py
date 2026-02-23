from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List

import numpy as np


@dataclass(frozen=True)
class AuthRouteDependencies:
    require_pat: Callable[[str | None], str]
    pick_profile_name: Callable[[Dict[str, Any]], str]
    get_current_user: Callable[[str], Dict[str, Any]]
    list_accessible_orgs: Callable[[str], List[Dict[str, Any]]]
    list_projects_for_org: Callable[[str, str], List[Dict[str, Any]]]
    list_teams_for_org_project: Callable[[str, str, str], List[Dict[str, Any]]]
    list_team_work_item_options: Callable[[str, str, str, str], Dict[str, Any]]


@dataclass(frozen=True)
class TeamsRouteDependencies:
    require_pat: Callable[[str | None], str]
    list_teams: Callable[[str | None], List[Dict[str, Any]]]
    team_settings_areas: Callable[..., Dict[str, Any]]


@dataclass(frozen=True)
class ForecastRouteDependencies:
    require_pat: Callable[[str | None], str]
    team_settings_areas: Callable[..., Dict[str, Any]]
    weekly_throughput: Callable[..., Any]
    mc_items_done_for_weeks: Callable[..., np.ndarray]
    mc_finish_weeks: Callable[..., np.ndarray]
    percentiles: Callable[..., Dict[str, int]]


@dataclass(frozen=True)
class ApiRouteDependencies:
    auth: AuthRouteDependencies
    teams: TeamsRouteDependencies
    forecast: ForecastRouteDependencies
