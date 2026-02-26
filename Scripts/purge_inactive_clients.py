from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient


def _env_int(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def main() -> int:
    retention_days = _env_int("APP_PURGE_RETENTION_DAYS", 30)
    mongo_url = (os.getenv("APP_MONGO_URL") or "mongodb://mongo:27017").strip()
    mongo_db = (os.getenv("APP_MONGO_DB") or "montecarlo").strip()
    collection_name = (os.getenv("APP_MONGO_COLLECTION_SIMULATIONS") or "simulations").strip()

    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
    coll = client[mongo_db][collection_name]

    stale_client_ids = coll.distinct("mc_client_id", {"last_seen": {"$lt": cutoff}})

    purged_clients = 0
    purged_simulations = 0
    for mc_client_id in stale_client_ids:
        if not mc_client_id:
            continue
        res = coll.delete_many({"mc_client_id": mc_client_id})
        purged_clients += 1
        purged_simulations += int(res.deleted_count)

    print(
        f"[purge] retention_days={retention_days} cutoff={cutoff.isoformat()} "
        f"clients_purged={purged_clients} simulations_deleted={purged_simulations}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
