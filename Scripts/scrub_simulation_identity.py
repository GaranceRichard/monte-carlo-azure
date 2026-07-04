from __future__ import annotations

import argparse
from typing import Any

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from backend.api_config import get_api_config

SENSITIVE_FIELDS = (
    "selected_org",
    "selected_project",
    "selected_team",
    "start_date",
    "end_date",
    "done_states",
    "types",
    "client_context",
    "pat",
    "server_url",
    "azure_devops_url",
)


def build_sensitive_filter() -> dict[str, Any]:
    return {"$or": [{field: {"$exists": True}} for field in SENSITIVE_FIELDS]}


def build_unset_payload() -> dict[str, str]:
    return {field: "" for field in SENSITIVE_FIELDS}


def count_sensitive_documents(collection: Collection[Any]) -> int:
    return int(collection.count_documents(build_sensitive_filter()))


def scrub_sensitive_documents(collection: Collection[Any], apply_changes: bool) -> tuple[int, int]:
    matched = count_sensitive_documents(collection)
    if not apply_changes or matched == 0:
        return matched, 0

    result = collection.update_many(
        build_sensitive_filter(),
        {"$unset": build_unset_payload()},
    )
    return matched, int(result.modified_count)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Remove legacy Azure DevOps identity fields from persisted simulation documents."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the MongoDB $unset update. Dry-run is the default.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    cfg = get_api_config()

    if not cfg.mongo_url:
        print("[scrub] Mongo disabled: APP_MONGO_URL is empty.")
        return 1

    try:
        client = MongoClient(
            cfg.mongo_url,
            serverSelectionTimeoutMS=cfg.mongo_server_selection_timeout_ms,
            connectTimeoutMS=cfg.mongo_connect_timeout_ms,
            socketTimeoutMS=cfg.mongo_socket_timeout_ms,
        )
    except PyMongoError as exc:
        print(f"[scrub] Mongo error: {exc.__class__.__name__}")
        return 1

    try:
        collection = client[cfg.mongo_db][cfg.mongo_collection_simulations]
        matched, modified = scrub_sensitive_documents(collection, apply_changes=args.apply)
        mode = "apply" if args.apply else "dry-run"
        print(
            f"[scrub] mode={mode} matched_documents={matched} modified_documents={modified} "
            f"collection={cfg.mongo_collection_simulations}"
        )
        return 0
    except PyMongoError as exc:
        print(f"[scrub] Mongo error: {exc.__class__.__name__}")
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
