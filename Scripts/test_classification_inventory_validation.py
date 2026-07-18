"""Load and compare discovered, generated, and versioned classification inventories."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

from Scripts.test_classification_contract import validate_record_compliance
from Scripts.test_classifier_discovery import LogicalCase
from Scripts.test_classifier_engine import classify_inventory


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate JSON property {key!r}")
        value[key] = item
    return value


def load_json(path: Path) -> Any:
    try:
        return json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys
        )
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        raise ValueError(f"invalid JSON artifact {path.as_posix()}: {exc}") from exc


def inventory_bytes(inventory: list[dict[str, Any]]) -> bytes:
    return (json.dumps(inventory, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def validate_versioned_records(
    inventory: Any, catalog: Any, today: date
) -> tuple[list[dict[str, Any]], list[str]]:
    if not isinstance(inventory, list):
        return [], ["versioned classification inventory must be a JSON array"]
    records = inventory
    if not isinstance(catalog, dict):
        return records, []
    errors: list[str] = []
    for index, record in enumerate(records):
        errors.extend(
            validate_record_compliance(record, catalog, f"inventory[{index}]", today)
        )
    return records, errors


def inventory_identity_errors(
    cases: list[LogicalCase], records: list[dict[str, Any]]
) -> list[str]:
    discovered_ids = [case.logical_case_id for case in cases]
    versioned_ids = _versioned_ids(records)
    errors = _duplicate_errors(discovered_ids, "discovered")
    errors.extend(_duplicate_errors(versioned_ids, "inventory"))
    errors.extend(_membership_errors(discovered_ids, versioned_ids))
    if versioned_ids != sorted(versioned_ids):
        errors.append("versioned classification inventory is not sorted by logicalCaseId")
    unresolved = _unresolved_ids(records)
    if unresolved:
        errors.append(f"unresolved classifications are blocking: {', '.join(unresolved)}")
    return errors


def _versioned_ids(records: list[dict[str, Any]]) -> list[str]:
    return [
        record.get("logicalCaseId")
        for record in records
        if isinstance(record, dict) and isinstance(record.get("logicalCaseId"), str)
    ]


def _duplicate_errors(identifiers: list[str], source: str) -> list[str]:
    duplicates = sorted(
        identifier for identifier, count in Counter(identifiers).items() if count > 1
    )
    if not duplicates:
        return []
    noun = "discovered logical cases" if source == "discovered" else "inventory logical cases"
    return [f"duplicate {noun}: {', '.join(duplicates)}"]


def _membership_errors(discovered_ids: list[str], versioned_ids: list[str]) -> list[str]:
    errors: list[str] = []
    missing = sorted(set(discovered_ids) - set(versioned_ids))
    obsolete = sorted(set(versioned_ids) - set(discovered_ids))
    if missing:
        errors.append(f"discovered cases absent from inventory: {', '.join(missing)}")
    if obsolete:
        errors.append(f"inventoried cases no longer discovered: {', '.join(obsolete)}")
    return errors


def _unresolved_ids(records: list[dict[str, Any]]) -> list[str]:
    return [
        record.get("logicalCaseId", f"index {index}")
        for index, record in enumerate(records)
        if isinstance(record, dict) and record.get("status") == "unresolved"
    ]


def generated_inventory_errors(
    root: Path,
    inventory_path: Path,
    cases: list[LogicalCase],
    catalog: Any,
    schema: Any,
    rules: Any,
    overrides: Any,
) -> list[str]:
    if not cases or not all(
        isinstance(value, dict) for value in (catalog, schema, rules, overrides)
    ):
        return []
    try:
        expected = classify_inventory(cases, rules, overrides, catalog, schema)
        repeated = classify_inventory(cases, rules, overrides, catalog, schema)
    except (KeyError, TypeError, ValueError, re.error) as exc:
        return [f"in-memory inventory generation failed: {exc}"]
    errors = _determinism_errors(expected, repeated)
    errors.extend(_versioned_comparison_errors(root / inventory_path, expected))
    return errors


def _determinism_errors(
    expected: list[dict[str, Any]], repeated: list[dict[str, Any]]
) -> list[str]:
    if inventory_bytes(expected) == inventory_bytes(repeated):
        return []
    return ["in-memory classification inventory is not deterministic"]


def _versioned_comparison_errors(
    inventory_path: Path, expected: list[dict[str, Any]]
) -> list[str]:
    try:
        versioned_bytes = inventory_path.read_bytes()
    except OSError as exc:
        return [f"versioned classification inventory cannot be read: {exc}"]
    if inventory_bytes(expected) != versioned_bytes:
        return ["generated inventory differs from the versioned inventory"]
    return []


def execution_fingerprint_errors(
    root: Path, inventory_path: Path, execution_report: Any
) -> list[str]:
    if not isinstance(execution_report, dict):
        return ["versioned execution report must be a JSON object"]
    try:
        versioned_bytes = (root / inventory_path).read_bytes()
    except OSError as exc:
        return [f"classification inventory fingerprint cannot be computed: {exc}"]
    fingerprint = hashlib.sha256(versioned_bytes).hexdigest()
    if execution_report.get("classificationInventorySha256") != fingerprint:
        return ["execution report fingerprint differs from the versioned inventory"]
    return []
