"""Validate exact, evidenced classification overrides and governed exemptions."""

from __future__ import annotations

from datetime import date
from typing import Any

from Scripts.test_classification_contract import (
    RECORD_FIELDS,
    unknown_properties,
    validate_record_compliance,
)
from Scripts.test_classifier_discovery import LogicalCase

TARGET_FIELDS = {"framework", "sourcePath", "selector"}
OVERRIDE_FIELDS = {"target", "classification", "justification", "evidence"}
CLASSIFICATION_FIELDS = RECORD_FIELDS - {
    "logicalCaseId",
    "framework",
    "sourcePath",
    "selector",
}


def validate_overrides(
    overrides: Any,
    cases: list[LogicalCase],
    catalog: dict[str, Any],
    today: date,
) -> list[str]:
    if not isinstance(overrides, dict):
        return ["classification overrides must be a JSON object"]
    errors = unknown_properties(
        overrides, {"overridesVersion", "overrides"}, "overrides"
    )
    if overrides.get("overridesVersion") != "1.0.0":
        errors.append("classification overrides version must be 1.0.0")
    entries = overrides.get("overrides")
    if not isinstance(entries, list):
        return errors + ["overrides.overrides must be an array"]
    discovered = {case.logical_case_id for case in cases}
    targets: set[tuple[Any, Any, Any]] = set()
    for index, entry in enumerate(entries):
        errors.extend(
            _override_entry_errors(
                entry,
                f"overrides[{index}]",
                discovered,
                targets,
                catalog,
                today,
            )
        )
    return errors


def _override_entry_errors(
    entry: Any,
    label: str,
    discovered: set[str],
    targets: set[tuple[Any, Any, Any]],
    catalog: dict[str, Any],
    today: date,
) -> list[str]:
    if not isinstance(entry, dict):
        return [f"{label} must be an object"]
    errors = unknown_properties(entry, OVERRIDE_FIELDS, label)
    target = entry.get("target")
    if not isinstance(target, dict):
        return errors + [f"{label}.target must be an object"]
    target_key = _target_key(target)
    logical_id = f"{target_key[0]}:{target_key[1]}::{target_key[2]}"
    errors.extend(_target_errors(target, target_key, logical_id, label, discovered, targets))
    errors.extend(_evidence_errors(entry, label))
    errors.extend(
        _classification_errors(
            entry.get("classification"),
            target_key,
            logical_id,
            label,
            catalog,
            today,
        )
    )
    return errors


def _target_key(target: dict[str, Any]) -> tuple[Any, Any, Any]:
    return (target.get("framework"), target.get("sourcePath"), target.get("selector"))


def _target_errors(
    target: dict[str, Any],
    target_key: tuple[Any, Any, Any],
    logical_id: str,
    label: str,
    discovered: set[str],
    targets: set[tuple[Any, Any, Any]],
) -> list[str]:
    errors = unknown_properties(target, TARGET_FIELDS, f"{label}.target")
    if set(target) != TARGET_FIELDS or any(
        not isinstance(value, str) or not value.strip() for value in target_key
    ):
        errors.append(f"{label}.target must contain three exact non-empty identity fields")
    if target_key in targets:
        errors.append(f"{label} duplicates an override target")
    targets.add(target_key)
    if logical_id not in discovered:
        errors.append(f"{label} targets an orphan logical case: {logical_id}")
    return errors


def _evidence_errors(entry: dict[str, Any], label: str) -> list[str]:
    return [
        f"{label}.{field} must be non-empty"
        for field in ("justification", "evidence")
        if not isinstance(entry.get(field), str) or not entry[field].strip()
    ]


def _classification_errors(
    classification: Any,
    target_key: tuple[Any, Any, Any],
    logical_id: str,
    label: str,
    catalog: dict[str, Any],
    today: date,
) -> list[str]:
    if not isinstance(classification, dict):
        return [f"{label}.classification must be an object"]
    errors = unknown_properties(classification, CLASSIFICATION_FIELDS, f"{label}.classification")
    if "status" not in classification:
        errors.append(f"{label}.classification must declare status")
    record = {
        "logicalCaseId": logical_id,
        "framework": target_key[0],
        "sourcePath": target_key[1],
        "selector": target_key[2],
        **classification,
    }
    errors.extend(
        validate_record_compliance(record, catalog, f"{label}.classification", today)
    )
    return errors
