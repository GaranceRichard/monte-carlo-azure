from __future__ import annotations

from typing import List, Dict, Any, Set
from urllib.parse import quote

from .ado_core_common import API_VERSION, _cfg, _session


def list_projects(pat: str | None = None) -> List[Dict[str, Any]]:
    cfg = _cfg(pat=pat)
    s = _session(pat=pat)
    url = f"https://dev.azure.com/{cfg.org}/_apis/projects?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json().get("value", [])


def list_projects_for_org(org: str, pat: str) -> List[Dict[str, Any]]:
    s = _session(pat=pat)
    org_clean = (org or "").strip()
    if not org_clean:
        return []
    url = f"https://dev.azure.com/{org_clean}/_apis/projects?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json().get("value", [])


def list_teams_for_org_project(org: str, project: str, pat: str) -> List[Dict[str, Any]]:
    s = _session(pat=pat)
    org_clean = (org or "").strip()
    project_clean = (project or "").strip()
    if not org_clean or not project_clean:
        return []

    project_id = None
    for p in list_projects_for_org(org_clean, pat):
        if p.get("name") == project_clean:
            project_id = p.get("id")
            break
    if not project_id:
        return []

    url = f"https://dev.azure.com/{org_clean}/_apis/projects/{project_id}/teams?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json().get("value", [])


def list_team_work_item_options(org: str, project: str, team: str, pat: str) -> Dict[str, Any]:
    s = _session(pat=pat)
    org_clean = (org or "").strip()
    project_clean = (project or "").strip()
    team_clean = (team or "").strip()
    if not org_clean or not project_clean or not team_clean:
        return {"types": [], "states": []}

    team_url = f"https://dev.azure.com/{org_clean}/{project_clean}/{team_clean}/_apis/work/teamsettings/teamfieldvalues?api-version={API_VERSION}"
    team_resp = s.get(team_url)
    team_resp.raise_for_status()

    types_url = f"https://dev.azure.com/{org_clean}/{project_clean}/_apis/wit/workitemtypes?api-version={API_VERSION}"
    types_resp = s.get(types_url)
    types_resp.raise_for_status()
    wit_types = [t.get("name") for t in types_resp.json().get("value", []) if t.get("name")]

    states_set: Set[str] = set()
    states_by_type: Dict[str, List[str]] = {}
    for type_name in wit_types:
        encoded = quote(type_name, safe="")
        states_url = f"https://dev.azure.com/{org_clean}/{project_clean}/_apis/wit/workitemtypes/{encoded}/states?api-version={API_VERSION}"
        states_resp = s.get(states_url)
        states_resp.raise_for_status()
        type_states: List[str] = []
        for st in states_resp.json().get("value", []):
            name = st.get("name")
            if name:
                states_set.add(name)
                type_states.append(name)
        states_by_type[type_name] = sorted(set(type_states))

    return {
        "types": sorted(set(wit_types)),
        "states": sorted(states_set),
        "states_by_type": states_by_type,
    }


def get_project_id(project_name: str, pat: str | None = None) -> str:
    for p in list_projects(pat=pat):
        if p.get("name") == project_name:
            return p["id"]
    raise RuntimeError(f"Projet introuvable: {project_name}")


def list_teams(pat: str | None = None) -> List[Dict[str, Any]]:
    cfg = _cfg(pat=pat)
    s = _session(pat=pat)
    project_id = get_project_id(cfg.project, pat=pat)
    url = f"https://dev.azure.com/{cfg.org}/_apis/projects/{project_id}/teams?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json().get("value", [])


def team_settings_areas(
    team_name: str,
    org: str | None = None,
    project: str | None = None,
    pat: str | None = None,
) -> Dict[str, Any]:
    cfg = _cfg(pat=pat)
    s = _session(pat=pat)
    org_name = (org or cfg.org or "").strip()
    project_name = (project or cfg.project or "").strip()
    if not org_name or not project_name:
        raise RuntimeError("org et project requis pour lire les settings de team.")
    url = f"https://dev.azure.com/{org_name}/{project_name}/{team_name}/_apis/work/teamsettings/teamfieldvalues?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json()


def team_settings_iterations(team_name: str, pat: str | None = None) -> Dict[str, Any]:
    cfg = _cfg(pat=pat)
    s = _session(pat=pat)
    url = f"https://dev.azure.com/{cfg.org}/{cfg.project}/{team_name}/_apis/work/teamsettings/iterations?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json()


def list_accessible_orgs(pat: str) -> List[Dict[str, Any]]:
    s = _session(pat=pat)
    member_ids: List[str] = []

    try:
        profile_url = "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1-preview.3"
        profile_resp = s.get(profile_url)
        profile_resp.raise_for_status()
        profile = profile_resp.json()
        member_id = profile.get("id")
        if isinstance(member_id, str) and member_id.strip():
            member_ids.append(member_id.strip())
    except Exception:
        pass

    try:
        conn_url = "https://dev.azure.com/_apis/connectionData?connectOptions=none&lastChangeId=-1&lastChangeId64=-1"
        conn_resp = s.get(conn_url)
        conn_resp.raise_for_status()
        conn = conn_resp.json()
        auth_user = conn.get("authenticatedUser") or {}
        member_id = auth_user.get("id")
        if isinstance(member_id, str) and member_id.strip():
            member_ids.append(member_id.strip())
    except Exception:
        pass

    accounts: List[Dict[str, Any]] = []
    try:
        accounts_url = "https://app.vssps.visualstudio.com/_apis/accounts?api-version=7.1-preview.1"
        accounts_resp = s.get(accounts_url)
        if accounts_resp.ok:
            accounts = accounts_resp.json().get("value", []) or []
    except Exception:
        pass

    if not accounts:
        for mid in dict.fromkeys(member_ids):
            try:
                accounts_url = f"https://app.vssps.visualstudio.com/_apis/accounts?memberId={mid}&api-version=7.1-preview.1"
                accounts_resp = s.get(accounts_url)
                accounts_resp.raise_for_status()
                accounts = accounts_resp.json().get("value", []) or []
                if accounts:
                    break
            except Exception:
                continue

    out: List[Dict[str, Any]] = []
    for a in accounts:
        out.append(
            {
                "id": a.get("accountId"),
                "name": a.get("accountName"),
                "account_uri": a.get("accountUri"),
            }
        )
    return out


def get_current_user(pat: str) -> Dict[str, Any]:
    s = _session(pat=pat)
    cfg = _cfg(pat=pat)

    urls = [
        "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1-preview.3",
        f"https://vssps.dev.azure.com/{cfg.org}/_apis/profile/profiles/me?api-version=7.1",
    ]
    last_exc: Exception | None = None
    for profile_url in urls:
        try:
            r = s.get(profile_url)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            last_exc = exc
            continue
    if last_exc:
        raise last_exc
    return {}
