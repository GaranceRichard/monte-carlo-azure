from __future__ import annotations

from typing import Iterable, List, Dict, Any, Set

from .ado_core_common import API_VERSION, _session


def wiql_query_ids(query: str, org: str, project: str, pat: str | None = None) -> List[int]:
    s = _session(pat=pat)
    url = f"https://dev.azure.com/{org}/{project}/_apis/wit/wiql?api-version={API_VERSION}"
    r = s.post(url, json={"query": query})
    r.raise_for_status()
    data = r.json()
    return [w["id"] for w in data.get("workItems", [])]


def fetch_work_items_batch(ids: Iterable[int], fields: List[str], org: str, pat: str | None = None) -> List[Dict[str, Any]]:
    s = _session(pat=pat)
    ids = list(ids)
    if not ids:
        return []
    url = f"https://dev.azure.com/{org}/_apis/wit/workitemsbatch?api-version={API_VERSION}"

    out: List[Dict[str, Any]] = []
    chunk_size = 200
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i:i + chunk_size]
        r = s.post(url, json={"ids": chunk, "fields": fields})
        r.raise_for_status()
        out.extend(r.json().get("value", []))
    return out


def done_ids_by_area_and_closed_date(
    org: str,
    project: str,
    area_path: str,
    start_date: str,
    end_date: str,
    done_states: Set[str],
    work_item_types: Set[str],
    pat: str | None = None,
) -> List[int]:
    states_sql = ", ".join([f"'{x}'" for x in done_states])
    types_sql = ", ".join([f"'{x}'" for x in work_item_types])

    query = f"""
    SELECT [System.Id]
    FROM WorkItems
    WHERE
        [System.TeamProject] = '{project}'
        AND [System.AreaPath] = '{area_path}'
        AND [System.WorkItemType] IN ({types_sql})
        AND [System.State] IN ({states_sql})
        AND [Microsoft.VSTS.Common.ClosedDate] >= '{start_date}'
        AND [Microsoft.VSTS.Common.ClosedDate] <= '{end_date}'
    ORDER BY [Microsoft.VSTS.Common.ClosedDate] ASC
    """
    return wiql_query_ids(query, org=org, project=project, pat=pat)
