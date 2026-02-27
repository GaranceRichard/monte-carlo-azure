from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pymongo import DESCENDING, MongoClient
from pymongo.collection import Collection

from .api_config import ApiConfig
from .api_models import SimulateRequest, SimulateResponse


def _to_iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class SimulationStore:
    def __init__(self, cfg: ApiConfig) -> None:
        self._mongo_url = cfg.mongo_url
        self._mongo_db = cfg.mongo_db
        self._collection_name = cfg.mongo_collection_simulations
        self._history_limit = cfg.simulation_history_limit
        self._client: MongoClient[Any] | None = None
        self._collection: Collection[Any] | None = None

    @property
    def enabled(self) -> bool:
        return bool(self._mongo_url)

    def ping(self) -> bool:
        if not self.enabled:
            return False
        if self._client is None:
            self._client = MongoClient(self._mongo_url, serverSelectionTimeoutMS=1200)
        self._client.admin.command("ping")
        return True

    def _ensure_collection(self) -> Collection[Any]:
        if not self.enabled:
            raise RuntimeError("Mongo persistence is disabled.")
        if self._collection is not None:
            return self._collection

        self._client = MongoClient(self._mongo_url, serverSelectionTimeoutMS=1200)
        self._collection = self._client[self._mongo_db][self._collection_name]
        self._collection.create_index([("mc_client_id", 1), ("created_at", DESCENDING)])
        self._collection.create_index(
            [("last_seen", 1)],
            expireAfterSeconds=30 * 24 * 3600,
        )
        return self._collection

    def save_simulation(
        self,
        mc_client_id: str,
        req: SimulateRequest,
        response: SimulateResponse,
    ) -> None:
        if not self.enabled or not mc_client_id:
            return

        coll = self._ensure_collection()
        now = datetime.now(timezone.utc)
        context = req.client_context

        doc: dict[str, Any] = {
            "mc_client_id": mc_client_id,
            "created_at": now,
            "last_seen": now,
            "mode": req.mode,
            "backlog_size": req.backlog_size,
            "target_weeks": req.target_weeks,
            "n_sims": req.n_sims,
            "capacity_percent": req.capacity_percent,
            "samples_count": response.samples_count,
            "percentiles": response.result_percentiles,
            "distribution": [bucket.model_dump() for bucket in response.result_distribution],
            "selected_org": context.selected_org if context else None,
            "selected_project": context.selected_project if context else None,
            "selected_team": context.selected_team if context else None,
            "start_date": context.start_date if context else None,
            "end_date": context.end_date if context else None,
            "done_states": context.done_states if context else [],
            "types": context.types if context else [],
            "include_zero_weeks": req.include_zero_weeks,
        }
        coll.insert_one(doc)
        coll.update_many({"mc_client_id": mc_client_id}, {"$set": {"last_seen": now}})

    def list_recent(self, mc_client_id: str) -> list[dict[str, Any]]:
        if not self.enabled or not mc_client_id:
            return []
        coll = self._ensure_collection()

        cursor = coll.find(
            {"mc_client_id": mc_client_id},
            {
                "_id": 0,
                "mc_client_id": 0,
            },
        ).sort("created_at", DESCENDING).limit(self._history_limit)

        out: list[dict[str, Any]] = []
        for item in cursor:
            created_at = item.get("created_at")
            last_seen = item.get("last_seen")
            if isinstance(created_at, datetime):
                item["created_at"] = _to_iso_z(created_at)
            if isinstance(last_seen, datetime):
                item["last_seen"] = _to_iso_z(last_seen)
            out.append(item)
        return out
