from __future__ import annotations

import pandas as pd
from typing import Set

from .ado_core_work_items import done_ids_by_area_and_closed_date, fetch_work_items_batch


def weekly_throughput(
    org: str,
    project: str,
    area_path: str,
    start_date: str,
    end_date: str,
    done_states: Set[str],
    work_item_types: Set[str],
    pat: str | None = None,
) -> pd.DataFrame:
    ids = done_ids_by_area_and_closed_date(
        org=org,
        project=project,
        area_path=area_path,
        start_date=start_date,
        end_date=end_date,
        done_states=done_states,
        work_item_types=work_item_types,
        pat=pat,
    )

    if not ids:
        return pd.DataFrame(columns=["week", "throughput"])

    items = fetch_work_items_batch(ids, ["System.Id", "Microsoft.VSTS.Common.ClosedDate"], org=org, pat=pat)

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
