from backend.ado_config import get_ado_config
from backend.ado_client import ado_session
from backend.ado_core import get_project_id

cfg = get_ado_config()
s = ado_session()

def list_teams(project_id: str):
    url = f"https://dev.azure.com/{cfg.org}/_apis/projects/{project_id}/teams?api-version=7.1"
    r = s.get(url)
    r.raise_for_status()
    return r.json().get("value", [])

if __name__ == "__main__":
    project_id = get_project_id(cfg.project)
    teams = list_teams(project_id)

    print(f"ORG    : {cfg.org}")
    print(f"PROJECT: {cfg.project} (id={project_id})")
    print(f"Teams  : {len(teams)}\n")

    for t in sorted(teams, key=lambda x: (x.get("name") or "").lower()):
        print(f"- {t.get('name')} | teamId={t.get('id')}")
