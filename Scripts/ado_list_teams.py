# Scripts/ado_list_teams.py
from __future__ import annotations

from backend.ado_config import get_ado_config
from backend.ado_core import get_project_id, list_teams


def main() -> int:
    cfg = get_ado_config()

    project_id = get_project_id(cfg.project)
    teams = list_teams()

    print(f"ORG    : {cfg.org}")
    print(f"PROJECT: {cfg.project} (id={project_id})")
    print(f"Teams  : {len(teams)}\n")

    for t in sorted(teams, key=lambda x: (x.get("name") or "").lower()):
        print(f"- {t.get('name')} | teamId={t.get('id')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
