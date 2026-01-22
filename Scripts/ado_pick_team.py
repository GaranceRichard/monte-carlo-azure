# Scripts/ado_pick_team.py
from __future__ import annotations

import os

from backend.ado_config import get_ado_config
from backend.ado_core import get_project_id, list_teams


def main() -> int:
    cfg = get_ado_config()

    # Nom de team attendu (exact) : priorités
    # 1) env ADO_TEAM
    # 2) attribut cfg.team (si jamais tu l'ajoutes un jour)
    team_name = (os.getenv("ADO_TEAM") or "").strip()
    if not team_name:
        team_name = (getattr(cfg, "team", None) or "").strip()

    if not team_name:
        raise RuntimeError("ADO_TEAM manquant. Ajoutez dans .env : ADO_TEAM=Nom exact de la team")

    # Validation projet + récupération teams
    _ = get_project_id(cfg.project)  # force validation projet
    teams = list_teams()

    match = [t for t in teams if t.get("name") == team_name]
    if not match:
        print(f"Team demandée introuvable: '{team_name}'")
        print("Teams disponibles:")
        for t in sorted(teams, key=lambda x: (x.get("name") or "").lower()):
            print("-", t.get("name"))
        return 1

    t = match[0]
    print("OK")
    print("ORG    :", cfg.org)
    print("PROJECT:", cfg.project)
    print("TEAM   :", t.get("name"))
    print("teamId :", t.get("id"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
