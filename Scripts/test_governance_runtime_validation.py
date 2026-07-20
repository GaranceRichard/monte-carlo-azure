"""Validate observed skips, quarantines and retries against their governance."""

from __future__ import annotations

from collections import defaultdict
from typing import Any


def _records_by_id(inventory: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(inventory, list):
        return {}
    return {
        record["logicalCaseId"]: record
        for record in inventory
        if isinstance(record, dict) and isinstance(record.get("logicalCaseId"), str)
    }


def _entries_by_id(contract: Any) -> dict[str, dict[str, Any]]:
    raw_entries = contract.get("entries", []) if isinstance(contract, dict) else []
    return {
        entry["logicalCaseId"]: entry
        for entry in raw_entries
        if isinstance(entry, dict) and isinstance(entry.get("logicalCaseId"), str)
    }


def _ignored_result_errors(
    logical_id: str,
    result: Any,
    entry: dict[str, Any] | None,
    record: dict[str, Any],
) -> list[str]:
    if result not in {"skipped", "todo"}:
        return []
    allowed = {"disabled"} if result == "todo" else {
        "skipped",
        "disabled",
        "expected_failure",
    }
    errors = []
    if entry is None or entry.get("state") not in allowed:
        errors.append(f"ungoverned runtime {result} result: {logical_id}")
    if record.get("criticality") == "critical":
        errors.append(f"critical test cannot be ignored at runtime: {logical_id}")
    return errors


def _retry_result_errors(
    logical_id: str, attempts: Any, entry: dict[str, Any] | None
) -> list[str]:
    if type(attempts) is not int or attempts <= 1:
        return []
    policy = entry.get("retryPolicy") if entry else None
    if not isinstance(policy, dict) or policy.get("preserveFirstFailure") is not True:
        return [f"ungoverned runtime retry: {logical_id}"]
    if attempts > policy.get("maxAttempts", 0):
        return [f"runtime retry exceeds governed maximum: {logical_id}"]
    return []


def _quarantine_errors(
    entries: dict[str, dict[str, Any]],
    runtime_by_case: dict[str, list[dict[str, Any]]],
) -> list[str]:
    errors = []
    for logical_id, entry in entries.items():
        observed = runtime_by_case.get(logical_id)
        if entry.get("state") != "quarantine" or not observed:
            continue
        if any(item.get("executed") is not True for item in observed):
            errors.append(f"quarantine did not execute in its selected profile: {logical_id}")
    return errors


def validate_runtime_governance(
    contract: Any,
    inventory: Any,
    runtime: list[dict[str, Any]],
) -> list[str]:
    entries = _entries_by_id(contract)
    records = _records_by_id(inventory)
    errors: list[str] = []
    runtime_by_case: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for instance in runtime:
        logical_id = instance.get("logicalCaseId")
        if not isinstance(logical_id, str):
            continue
        runtime_by_case[logical_id].append(instance)
        entry = entries.get(logical_id)
        errors.extend(
            _ignored_result_errors(
                logical_id,
                instance.get("result"),
                entry,
                records.get(logical_id, {}),
            )
        )
        errors.extend(_retry_result_errors(logical_id, instance.get("attempts"), entry))
    errors.extend(_quarantine_errors(entries, runtime_by_case))
    return sorted(set(errors))
