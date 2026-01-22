from __future__ import annotations

from typing import Iterable, List, Dict, Any, Set
import pandas as pd

from .ado_config import get_ado_config
from .ado_client import ado_session

cfg = get_ado_config()
s = ado_session()

API_VERSION = "7.1"


# -----------------------------
# Projects / Teams
# -----------------------------
def list_projects() -> List[Dict[str, Any]]:
    url = f"https://dev.azure.com/{cfg.org}/_apis/projects?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json().get("value", [])


def get_project_id(project_name: str) -> str:
    for p in list_projects():
        if p.get("name") == project_name:
            return p["id"]
    raise RuntimeError(f"Projet introuvable: {project_name}")


def list_teams() -> List[Dict[str, Any]]:
    project_id = get_project_id(cfg.project)
    url = f"https://dev.azure.com/{cfg.org}/_apis/projects/{project_id}/teams?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json().get("value", [])


def team_settings_areas(team_name: str) -> Dict[str, Any]:
    """
    Retourne Team Field Values (areas) : defaultValue + values[] (includeChildren).
    """
    url = f"https://dev.azure.com/{cfg.org}/{cfg.project}/{team_name}/_apis/work/teamsettings/teamfieldvalues?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json()


def team_settings_iterations(team_name: str) -> Dict[str, Any]:
    """
    Retourne les iterations (sprints) associées à la team.
    """
    url = f"https://dev.azure.com/{cfg.org}/{cfg.project}/{team_name}/_apis/work/teamsettings/iterations?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json()


# -----------------------------
# Work Items (WIQL + batch)
# -----------------------------
def wiql_query_ids(query: str) -> List[int]:
    url = f"https://dev.azure.com/{cfg.org}/{cfg.project}/_apis/wit/wiql?api-version={API_VERSION}"
    r = s.post(url, json={"query": query})
    r.raise_for_status()
    data = r.json()
    return [w["id"] for w in data.get("workItems", [])]


def fetch_work_items_batch(ids: Iterable[int], fields: List[str]) -> List[Dict[str, Any]]:
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
) -> List[int]:
    """
    Récupère les IDs des work items "Done" dans un AreaPath donné,
    fermés entre start_date et end_date (YYYY-MM-DD).
    """
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
    return wiql_query_ids(query)


# -----------------------------
# Throughput
# -----------------------------
def weekly_throughput(
    area_path: str,
    start_date: str,
    end_date: str,
    done_states: Set[str],
    work_item_types: Set[str],
) -> pd.DataFrame:
    """
    Retourne un DataFrame: week (datetime start-of-week), throughput (count).
    """
    ids = done_ids_by_area_and_closed_date(
        area_path=area_path,
        start_date=start_date,
        end_date=end_date,
        done_states=done_states,
        work_item_types=work_item_types,
    )

    if not ids:
        return pd.DataFrame(columns=["week", "throughput"])

    items = fetch_work_items_batch(ids, ["System.Id", "Microsoft.VSTS.Common.ClosedDate"])

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

    # Semaine (début de semaine)
    df["week"] = df["closed_date"].dt.to_period("W").apply(lambda p: p.start_time)

    weekly = (
        df.groupby("week")["id"]
          .count()
          .rename("throughput")
          .reset_index()
          .sort_values("week")
    )
    return weekly
