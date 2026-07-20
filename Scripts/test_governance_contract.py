"""Shared versioned vocabulary and JSON loading for test governance."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0.0"
PROFILES = ("pr", "main", "nightly", "release")
STATES = ("skipped", "disabled", "expected_failure", "quarantine", "retry")
STATE_PRIORITY = {
    "skipped": 0,
    "disabled": 1,
    "expected_failure": 2,
    "retry": 3,
    "quarantine": 4,
}
FRAMEWORK_NODES = {
    "pytest": "backend-tests",
    "vitest": "frontend-tests",
    "playwright": "e2e",
}
REQUIRED_ENTRY_FIELDS = {
    "logicalCaseId",
    "state",
    "justification",
    "cause",
    "owner",
    "ticket",
    "criticality",
    "risk",
    "enteredOn",
    "expiresOn",
    "executionProfile",
}
OPTIONAL_ENTRY_FIELDS = {"compensatingMeasure", "retryPolicy"}


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON property: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> Any:
    try:
        return json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys
        )
    except FileNotFoundError as exc:
        raise ValueError(f"Missing test-governance input: {path.as_posix()}") from exc
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid test-governance JSON {path.as_posix()}: {exc}") from exc
