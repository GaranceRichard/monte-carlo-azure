from backend.ado_config import get_ado_config
from backend.ado_client import ado_session

cfg = get_ado_config()
s = ado_session()

API_VERSION = "7.1"

def smoke_projects():
    url = f"https://dev.azure.com/{cfg.org}/_apis/projects?api-version={API_VERSION}"
    r = s.get(url)

    print("HTTP", r.status_code)
    print(r.text[:800])

    r.raise_for_status()

    data = r.json()
    print("Projects found:", data.get("count"))
    if data.get("value"):
        print("First project:", data["value"][0].get("name"))

if __name__ == "__main__":
    smoke_projects()
