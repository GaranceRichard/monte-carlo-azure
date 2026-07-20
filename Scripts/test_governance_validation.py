"""Cross-contract and lifecycle validation for test governance."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from Scripts.test_execution_profiles_graph import included_profiles
from Scripts.test_governance_contract import (
    OPTIONAL_ENTRY_FIELDS,
    PROFILES,
    REQUIRED_ENTRY_FIELDS,
    SCHEMA_VERSION,
    STATE_PRIORITY,
    STATES,
)


def _parse_date(value: Any, label: str, errors: list[str]) -> date | None:
    if not isinstance(value, str):
        errors.append(f"{label} must be a canonical date")
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        errors.append(f"{label} must be a canonical date")
        return None
    if parsed.isoformat() != value:
        errors.append(f"{label} must be a canonical date")
        return None
    return parsed


def _retry_errors(entry: dict[str, Any], label: str) -> list[str]:
    retry = entry.get("retryPolicy")
    if retry is None:
        return [f"{label} retry requires retryPolicy"] if entry.get("state") == "retry" else []
    if not isinstance(retry, dict) or set(retry) != {"maxAttempts", "preserveFirstFailure"}:
        return [f"{label}.retryPolicy is invalid"]
    if (
        type(retry.get("maxAttempts")) is not int
        or retry["maxAttempts"] < 2
        or retry.get("preserveFirstFailure") is not True
    ):
        return [f"{label}.retryPolicy must preserve the first failure"]
    return []


def _field_errors(entry: dict[str, Any], label: str) -> list[str]:
    errors: list[str] = []
    missing = sorted(REQUIRED_ENTRY_FIELDS - set(entry))
    unknown = sorted(set(entry) - REQUIRED_ENTRY_FIELDS - OPTIONAL_ENTRY_FIELDS)
    if missing:
        errors.append(f"{label} is missing: {', '.join(missing)}")
    if unknown:
        errors.append(f"{label} has unknown fields: {', '.join(unknown)}")
    excluded = {"state", "criticality", "enteredOn", "expiresOn", "executionProfile"}
    for field in REQUIRED_ENTRY_FIELDS - excluded:
        if field in entry and (not isinstance(entry[field], str) or not entry[field].strip()):
            errors.append(f"{label}.{field} must be a non-empty string")
    if entry.get("state") not in STATES:
        errors.append(f"{label}.state is invalid")
    if entry.get("criticality") not in {"low", "medium", "high", "critical"}:
        errors.append(f"{label}.criticality is invalid")
    if entry.get("executionProfile") not in PROFILES:
        errors.append(f"{label}.executionProfile is invalid")
    return errors


def _date_errors(entry: dict[str, Any], label: str, today: date) -> list[str]:
    errors: list[str] = []
    entered = _parse_date(entry.get("enteredOn"), f"{label}.enteredOn", errors)
    expires = _parse_date(entry.get("expiresOn"), f"{label}.expiresOn", errors)
    if entered and entered > today:
        errors.append(f"{label}.enteredOn is in the future")
    if entered and expires and expires < entered:
        errors.append(f"{label}.expiresOn precedes enteredOn")
    if expires and expires < today:
        errors.append(f"{label} expired on {expires.isoformat()}")
    return errors


def _entry_shape_errors(entry: Any, index: int, today: date) -> list[str]:
    label = f"entries[{index}]"
    if not isinstance(entry, dict):
        return [f"{label} must be an object"]
    errors = [*_field_errors(entry, label), *_date_errors(entry, label, today)]
    errors.extend(_retry_errors(entry, label))
    if entry.get("state") == "quarantine" and entry.get("criticality") == "critical":
        measure = entry.get("compensatingMeasure")
        if not isinstance(measure, str) or not measure.strip():
            errors.append(f"{label} critical quarantine requires a compensating measure")
    return errors


def _contract_entries(
    contract: Any, today: date
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    if not isinstance(contract, dict):
        return {}, ["test-governance contract must be an object"]
    errors: list[str] = []
    if set(contract) != {"schemaVersion", "schema", "entries"}:
        errors.append("test-governance contract has an invalid top-level shape")
    if contract.get("schemaVersion") != SCHEMA_VERSION:
        errors.append(f"test-governance schemaVersion must be {SCHEMA_VERSION}")
    if contract.get("schema") != "config/test-governance.schema.json":
        errors.append("test-governance schema path is invalid")
    entries = contract.get("entries")
    if not isinstance(entries, list):
        return {}, [*errors, "test-governance entries must be an array"]
    by_id: dict[str, dict[str, Any]] = {}
    for index, entry in enumerate(entries):
        errors.extend(_entry_shape_errors(entry, index, today))
        if not isinstance(entry, dict) or not isinstance(entry.get("logicalCaseId"), str):
            continue
        logical_id = entry["logicalCaseId"]
        if logical_id in by_id:
            errors.append(f"duplicate governance entry: {logical_id}")
        by_id[logical_id] = entry
    return by_id, errors


def _group_detections(
    detections: list[dict[str, Any]], inventory_by_id: dict[str, dict[str, Any]]
) -> tuple[dict[str, list[dict[str, Any]]], list[str]]:
    by_case: dict[str, list[dict[str, Any]]] = defaultdict(list)
    errors: list[str] = []
    for detection in detections:
        logical_id = detection["logicalCaseId"]
        location = f"{detection['sourcePath']}:{detection['line']}"
        if detection["state"] == "unknown":
            errors.append(f"unknown test marker {detection['marker']} at {location}")
        if logical_id is None:
            errors.append(
                f"global or unassigned {detection['state']} mechanism "
                f"{detection['marker']} at {location}"
            )
            continue
        if logical_id not in inventory_by_id:
            errors.append(f"detected mechanism belongs to unknown logical case: {logical_id}")
        by_case[logical_id].append(detection)
    return by_case, errors


def _case_errors(
    logical_id: str,
    mechanisms: list[dict[str, Any]],
    entry: dict[str, Any] | None,
    record: dict[str, Any],
) -> list[str]:
    states = {item["state"] for item in mechanisms if item["state"] != "unknown"}
    if not states:
        return []
    normalized = max(states, key=lambda state: STATE_PRIORITY[state])
    if entry is None:
        return [f"ungoverned test mechanism: {logical_id} ({normalized})"]
    errors: list[str] = []
    if entry.get("state") != normalized:
        errors.append(
            f"governance state mismatch for {logical_id}: {entry.get('state')} != {normalized}"
        )
    if entry.get("executionProfile") != record.get("executionProfile"):
        errors.append(f"governance execution profile mismatch for {logical_id}")
    critical = entry.get("criticality") == "critical" or record.get("criticality") == "critical"
    if critical and states & {"skipped", "disabled", "expected_failure"}:
        errors.append(f"critical test cannot be ignored: {logical_id}")
    if normalized == "quarantine" and states & {"skipped", "disabled"}:
        errors.append(f"quarantine must remain executable: {logical_id}")
    retry = entry.get("retryPolicy")
    if "retry" in states and (
        not isinstance(retry, dict) or retry.get("preserveFirstFailure") is not True
    ):
        errors.append(f"retry can mask its first failure: {logical_id}")
    return errors


def _orphan_errors(
    entries: dict[str, dict[str, Any]],
    inventory: dict[str, dict[str, Any]],
    detections: dict[str, list[dict[str, Any]]],
    execution_contract: dict[str, Any],
) -> list[str]:
    errors: list[str] = []
    for logical_id, entry in entries.items():
        if logical_id not in inventory:
            errors.append(f"orphan governance entry targets no classified case: {logical_id}")
        if logical_id not in detections:
            errors.append(f"orphan governance entry targets no detected mechanism: {logical_id}")
        try:
            included_profiles(execution_contract, entry.get("executionProfile"))
        except (TypeError, ValueError):
            errors.append(f"governance entry has unknown execution profile: {logical_id}")
    return errors


def validate_governance(
    contract: Any,
    inventory: Any,
    detections: list[dict[str, Any]],
    execution_contract: dict[str, Any],
    *,
    today: date | None = None,
) -> list[str]:
    entries, errors = _contract_entries(contract, today or date.today())
    if not isinstance(inventory, list):
        return sorted(set([*errors, "classification inventory must be an array"]))
    inventory_by_id = {
        item.get("logicalCaseId"): item
        for item in inventory
        if isinstance(item, dict) and isinstance(item.get("logicalCaseId"), str)
    }
    by_case, detection_errors = _group_detections(detections, inventory_by_id)
    errors.extend(detection_errors)
    for logical_id, mechanisms in by_case.items():
        errors.extend(
            _case_errors(
                logical_id,
                mechanisms,
                entries.get(logical_id),
                inventory_by_id.get(logical_id, {}),
            )
        )
    errors.extend(_orphan_errors(entries, inventory_by_id, by_case, execution_contract))
    return sorted(set(errors))
