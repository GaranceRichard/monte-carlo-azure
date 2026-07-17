from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1


def read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid {label}: {path}: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"Invalid {label} schemaVersion; expected {SCHEMA_VERSION}.")
    return payload


def load_inputs(
    config_path: Path, baseline_path: Path, exceptions_path: Path
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    config = read_json(config_path, "maintainability config")
    baseline = read_json(baseline_path, "maintainability baseline")
    exceptions_payload = read_json(exceptions_path, "maintainability exceptions")
    exceptions = exceptions_payload.get("exceptions")
    if not isinstance(exceptions, list):
        raise ValueError("Invalid maintainability exceptions; expected an exceptions list.")
    for item in exceptions:
        if not isinstance(item, dict) or not str(item.get("justification", "")).strip():
            raise ValueError("Every maintainability exception requires a justification.")
    if baseline.get("limits") != config.get("limits"):
        raise ValueError(
            "Maintainability limits differ from the versioned baseline; review and update "
            "the baseline explicitly."
        )
    return config, baseline, exceptions
