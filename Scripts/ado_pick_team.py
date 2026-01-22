from backend.ado_config import get_ado_config
from backend.ado_client import ado_session
from backend.ado_core import get_project_id

cfg = get_ado_config()
s = ado_session()

API_VERSION = "7.1"

def list_teams(project_id: str):
    url = f"https://dev.azure.com/{cfg.org}/_apis/projects/{project_id}/teams?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json().get("value", [])

if __name__ == "__main__":
    team_name = getattr(cfg, "team", None)  # au cas où votre ado_config n'a pas 'team'
    if not team_name:
        # fallback: lire direct depuis env sans casser le reste
        import os
        team_name = (os.getenv("ADO_TEAM") or "").strip()

    if not team_name:
        raise RuntimeError("ADO_TEAM manquant. Ajoutez dans .env : ADO_TEAM=Nom exact de la team")

    project_id = get_project_id(cfg.project)
    teams = list_teams(project_id)

    match = [t for t in teams if t.get("name") == team_name]
    if not match:
        print(f"Team demandée introuvable: '{team_name}'")
        print("Teams disponibles:")
        for t in sorted(teams, key=lambda x: (x.get('name') or '').lower()):
            print("-", t.get("name"))
        raise SystemExit(1)

    t = match[0]
    print("OK")
    print("ORG    :", cfg.org)
    print("PROJECT:", cfg.project)
    print("TEAM   :", t.get("name"))
    print("teamId :", t.get("id"))
