import os

from backend.ado_config import get_ado_config
from backend.ado_client import ado_session
from backend.ado_core import get_project_id, team_settings_areas, team_settings_iterations, list_teams

cfg = get_ado_config()
s = ado_session()

def resolve_team(team_name: str) -> dict:
    teams = list_teams()
    for t in teams:
        if t.get("name") == team_name:
            return t
    raise RuntimeError(f"Team introuvable: {team_name}")

if __name__ == "__main__":
    team_name = os.getenv("ADO_TEAM", "").strip()
    if not team_name:
        raise RuntimeError("ADO_TEAM manquant. Ajoutez dans .env : ADO_TEAM=Nom exact de la team")

    # validation projet
    project_id = get_project_id(cfg.project)
    t = resolve_team(team_name)

    print("ORG    :", cfg.org)
    print("PROJECT:", cfg.project)
    print("TEAM   :", team_name)
    print("teamId :", t.get("id"))
    print()

    areas = team_settings_areas(team_name)
    print("=== TEAM AREAS (Team Field Values) ===")
    print("defaultValue:", areas.get("defaultValue"))
    vals = areas.get("values", []) or []
    for v in vals:
        print(f"- {v.get('value')} | includeChildren={v.get('includeChildren')}")

    iters = team_settings_iterations(team_name)
    print("\n=== TEAM ITERATIONS ===")
    for it in iters.get("value", []) or []:
        name = it.get("name")
        path = it.get("path")
        attrs = it.get("attributes", {}) or {}
        start = attrs.get("startDate")
        finish = attrs.get("finishDate")
        print(f"- {name} | {path} | {start} -> {finish}")
