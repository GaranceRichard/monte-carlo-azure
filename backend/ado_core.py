from __future__ import annotations

from typing import Iterable, List, Dict, Any, Set
import pandas as pd
from urllib.parse import quote

from .ado_config import get_ado_config
from .ado_client import ado_session

API_VERSION = "7.1"


def _cfg(pat: str | None = None):
    return get_ado_config(pat_override=pat)


def _session(pat: str | None = None):
    return ado_session(pat_override=pat)


# -----------------------------
# Projects / Teams
# -----------------------------
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
    """
    Retourne la liste des types de tickets et des états disponibles
    pour le projet de l'équipe sélectionnée.
    """
    s = _session(pat=pat)
    org_clean = (org or "").strip()
    project_clean = (project or "").strip()
    team_clean = (team or "").strip()
    if not org_clean or not project_clean or not team_clean:
        return {"types": [], "states": []}

    # Vérifie que la team est accessible dans ce contexte org/projet.
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


def team_settings_areas(team_name: str, pat: str | None = None) -> Dict[str, Any]:
    cfg = _cfg(pat=pat)
    s = _session(pat=pat)
    url = f"https://dev.azure.com/{cfg.org}/{cfg.project}/{team_name}/_apis/work/teamsettings/teamfieldvalues?api-version={API_VERSION}"
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


# -----------------------------
# Work Items (WIQL + batch)
# -----------------------------
def wiql_query_ids(query: str, pat: str | None = None) -> List[int]:
    cfg = _cfg(pat=pat)
    s = _session(pat=pat)
    url = f"https://dev.azure.com/{cfg.org}/{cfg.project}/_apis/wit/wiql?api-version={API_VERSION}"
    r = s.post(url, json={"query": query})
    r.raise_for_status()
    data = r.json()
    return [w["id"] for w in data.get("workItems", [])]


def fetch_work_items_batch(ids: Iterable[int], fields: List[str], pat: str | None = None) -> List[Dict[str, Any]]:
    cfg = _cfg(pat=pat)
    s = _session(pat=pat)
    ids = list(ids)
    if not ids:
        return []
    url = f"https://dev.azure.com/{cfg.org}/_apis/wit/workitemsbatch?api-version={API_VERSION}"

    out: List[Dict[str, Any]] = []
    chunk_size = 200
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i:i + chunk_size]
        r = s.post(url, json={"ids": chunk, "fields": fields})
        r.raise_for_status()
        out.extend(r.json().get("value", []))
    return out


def done_ids_by_area_and_closed_date(
    area_path: str,
    start_date: str,
    end_date: str,
    done_states: Set[str],
    work_item_types: Set[str],
    pat: str | None = None,
) -> List[int]:
    cfg = _cfg(pat=pat)

    states_sql = ", ".join([f"'{x}'" for x in done_states])
    types_sql = ", ".join([f"'{x}'" for x in work_item_types])

    query = f"""
    SELECT [System.Id]
    FROM WorkItems
    WHERE
        [System.TeamProject] = '{cfg.project}'
        AND [System.AreaPath] = '{area_path}'
        AND [System.WorkItemType] IN ({types_sql})
        AND [System.State] IN ({states_sql})
        AND [Microsoft.VSTS.Common.ClosedDate] >= '{start_date}'
        AND [Microsoft.VSTS.Common.ClosedDate] <= '{end_date}'
    ORDER BY [Microsoft.VSTS.Common.ClosedDate] ASC
    """
    return wiql_query_ids(query, pat=pat)


# -----------------------------
# Throughput
# -----------------------------
def weekly_throughput(
    area_path: str,
    start_date: str,
    end_date: str,
    done_states: Set[str],
    work_item_types: Set[str],
    pat: str | None = None,
) -> pd.DataFrame:
    ids = done_ids_by_area_and_closed_date(
        area_path=area_path,
        start_date=start_date,
        end_date=end_date,
        done_states=done_states,
        work_item_types=work_item_types,
        pat=pat,
    )

    if not ids:
        return pd.DataFrame(columns=["week", "throughput"])

    items = fetch_work_items_batch(ids, ["System.Id", "Microsoft.VSTS.Common.ClosedDate"], pat=pat)

    rows = []
    for it in items:
        f = it.get("fields", {})
        rows.append({
            "id": it.get("id"),
            "closed_date": f.get("Microsoft.VSTS.Common.ClosedDate"),
        })

    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(columns=["week", "throughput"])

    df["closed_date"] = pd.to_datetime(df["closed_date"], utc=True, errors="coerce")
    df = df.dropna(subset=["closed_date"])

    # to_period() sur des datetimes tz-aware declenche un warning; on retire d'abord le timezone.
    df["week"] = (
        df["closed_date"]
        .dt.tz_convert(None)
        .dt.to_period("W")
        .dt.start_time
    )

    weekly = (
        df.groupby("week")["id"]
          .count()
          .rename("throughput")
          .reset_index()
          .sort_values("week")
    )
    return weekly


def list_accessible_orgs(pat: str) -> List[Dict[str, Any]]:
    """
    Liste les organisations Azure DevOps accessibles avec le PAT.
    """
    s = _session(pat=pat)

    profile_url = "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1-preview.3"
    profile_resp = s.get(profile_url)
    profile_resp.raise_for_status()
    profile = profile_resp.json()
    member_id = profile.get("id")
    if not member_id:
        return []

    accounts_url = f"https://app.vssps.visualstudio.com/_apis/accounts?memberId={member_id}&api-version=7.1-preview.1"
    accounts_resp = s.get(accounts_url)
    accounts_resp.raise_for_status()
    accounts = accounts_resp.json().get("value", [])

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
    """
    Retourne le profil utilisateur associé au PAT.
    """
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
