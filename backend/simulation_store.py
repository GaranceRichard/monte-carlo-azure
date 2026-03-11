from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

from pymongo import DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

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
        self._mongo_min_pool_size = cfg.mongo_min_pool_size
        self._mongo_max_pool_size = max(cfg.mongo_max_pool_size, cfg.mongo_min_pool_size)
        self._mongo_server_selection_timeout_ms = cfg.mongo_server_selection_timeout_ms
        self._mongo_connect_timeout_ms = cfg.mongo_connect_timeout_ms
        self._mongo_socket_timeout_ms = cfg.mongo_socket_timeout_ms
        self._mongo_max_idle_time_ms = cfg.mongo_max_idle_time_ms
        self._client: MongoClient[Any] | None = None
        self._collection: Collection[Any] | None = None
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self._mongo_url)

    def _build_client(self) -> MongoClient[Any]:
        return MongoClient(
            self._mongo_url,
            minPoolSize=self._mongo_min_pool_size,
            maxPoolSize=self._mongo_max_pool_size,
            serverSelectionTimeoutMS=self._mongo_server_selection_timeout_ms,
            connectTimeoutMS=self._mongo_connect_timeout_ms,
            socketTimeoutMS=self._mongo_socket_timeout_ms,
            maxIdleTimeMS=self._mongo_max_idle_time_ms,
            retryWrites=True,
            retryReads=True,
        )

    def _reset_client(self) -> None:
        with self._lock:
            client = self._client
            self._client = None
            self._collection = None
        if client is not None:
            client.close()

    def connect(self) -> None:
        if not self.enabled:
            return
        if self._collection is not None:
            return

        with self._lock:
            if self._collection is not None:
                return
            client = self._build_client()
            try:
                collection = client[self._mongo_db][self._collection_name]
                collection.create_index([("mc_client_id", 1), ("created_at", DESCENDING)])
                collection.create_index(
                    [("last_seen", 1)],
                    expireAfterSeconds=30 * 24 * 3600,
                )
                client.admin.command("ping")
            except Exception:
                client.close()
                raise
            self._client = client
            self._collection = collection

    def close(self) -> None:
        self._reset_client()

    def _ensure_collection(self) -> Collection[Any]:
        if not self.enabled:
            raise RuntimeError("Mongo persistence is disabled.")
        self.connect()
        assert self._collection is not None
        return self._collection

    def ping(self) -> bool:
        if not self.enabled:
            return False

        def _op() -> bool:
            self._ensure_collection()
            assert self._client is not None
            self._client.admin.command("ping")
            return True

        return self._run_with_reconnect(_op)

    def _run_with_reconnect(self, op):
        last_exc: Exception | None = None
        for attempt in range(2):
            try:
                return op()
            except PyMongoError as exc:
                last_exc = exc
                self._reset_client()
                if attempt == 1:
                    break
        if last_exc is not None:
            raise last_exc
        raise RuntimeError("Mongo operation failed unexpectedly.")

    def save_simulation(
        self,
        mc_client_id: str,
        req: SimulateRequest,
        response: SimulateResponse,
    ) -> None:
        if not self.enabled or not mc_client_id:
            return

        def _op() -> None:
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
                "samples_count": response.samples_count,
                "percentiles": response.result_percentiles,
                "distribution": [bucket.model_dump() for bucket in response.result_distribution],
                "throughput_reliability": response.throughput_reliability.model_dump(),
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

        self._run_with_reconnect(_op)

    def list_recent(self, mc_client_id: str) -> list[dict[str, Any]]:
        if not self.enabled or not mc_client_id:
            return []

        def _op() -> list[dict[str, Any]]:
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

        return self._run_with_reconnect(_op)
