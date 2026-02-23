from __future__ import annotations

from dataclasses import dataclass
from types import ModuleType
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
    histogram_buckets: Callable[..., List[Dict[str, int]]]


@dataclass(frozen=True)
class ApiRouteDependencies:
    auth: AuthRouteDependencies
    teams: TeamsRouteDependencies
    forecast: ForecastRouteDependencies


class ModuleAttrCallable:
    """
    Résout une fonction au runtime depuis un module donné.
    Permet aux tests qui patchent `backend.api.<fn>` de rester effectifs.
    """

    def __init__(self, module: ModuleType, attr: str):
        self._module = module
        self._attr = attr

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        fn = getattr(self._module, self._attr)
        return fn(*args, **kwargs)


def build_api_route_dependencies(module: ModuleType) -> ApiRouteDependencies:
    return ApiRouteDependencies(
        auth=AuthRouteDependencies(
            require_pat=ModuleAttrCallable(module, "_require_pat"),
            pick_profile_name=ModuleAttrCallable(module, "_pick_profile_name"),
            get_current_user=ModuleAttrCallable(module, "get_current_user"),
            list_accessible_orgs=ModuleAttrCallable(module, "list_accessible_orgs"),
            list_projects_for_org=ModuleAttrCallable(module, "list_projects_for_org"),
            list_teams_for_org_project=ModuleAttrCallable(module, "list_teams_for_org_project"),
            list_team_work_item_options=ModuleAttrCallable(module, "list_team_work_item_options"),
        ),
        teams=TeamsRouteDependencies(
            require_pat=ModuleAttrCallable(module, "_require_pat"),
            list_teams=ModuleAttrCallable(module, "list_teams"),
            team_settings_areas=ModuleAttrCallable(module, "team_settings_areas"),
        ),
        forecast=ForecastRouteDependencies(
            require_pat=ModuleAttrCallable(module, "_require_pat"),
            team_settings_areas=ModuleAttrCallable(module, "team_settings_areas"),
            weekly_throughput=ModuleAttrCallable(module, "weekly_throughput"),
            mc_items_done_for_weeks=ModuleAttrCallable(module, "mc_items_done_for_weeks"),
            mc_finish_weeks=ModuleAttrCallable(module, "mc_finish_weeks"),
            percentiles=ModuleAttrCallable(module, "percentiles"),
            histogram_buckets=ModuleAttrCallable(module, "histogram_buckets"),
        ),
    )
