"""Runtime validation and consolidated reporting for test governance."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from Scripts.test_execution_profiles_graph import included_profiles
from Scripts.test_governance_contract import (
    FRAMEWORK_NODES,
    SCHEMA_VERSION,
    STATE_PRIORITY,
    load_json,
)


def _runtime_path(root: Path, profile: str, framework: str) -> Path:
    node = FRAMEWORK_NODES[framework]
    primary = (
        root
        / "reports"
        / "test-execution-artifacts"
        / profile
        / node
        / f"{framework}.json"
    )
    fallback = root / "reports" / "test-execution-native" / f"{framework}.json"
    return primary if primary.is_file() else fallback


def _valid_attempt_history(instance: dict[str, Any]) -> bool:
    attempts = instance.get("attempts")
    results = instance.get("attemptResults")
    initial = instance.get("initialResult")
    final = instance.get("finalResult")
    result = instance.get("result")
    if type(attempts) is not int or attempts < 0 or not isinstance(results, list):
        return False
    if len(results) != attempts or result != final:
        return False
    if results:
        return initial == results[0] and final == results[-1]
    return initial == result and final == result


def _artifact_instances(
    path: Path,
    framework: str,
    selected: dict[str, dict[str, Any]],
    require_runtime: bool,
) -> tuple[list[dict[str, Any]], set[str], bool, list[str]]:
    payload = load_json(path)
    if not isinstance(payload, dict) or payload.get("framework") != framework:
        return [], set(), False, [f"invalid native runtime evidence for {framework}"]
    errors: list[str] = []
    complete = payload.get("complete") is True and not payload.get("anomalies")
    if not complete:
        errors.append(f"incomplete native runtime evidence for {framework}")
    instances = payload.get("instances")
    if not isinstance(instances, list):
        return [], set(), False, [*errors, f"invalid native runtime instances for {framework}"]
    details: list[dict[str, Any]] = []
    matched: set[str] = set()
    for instance in instances:
        if not isinstance(instance, dict) or instance.get("logicalCaseId") not in selected:
            continue
        logical_id = instance["logicalCaseId"]
        if selected[logical_id].get("framework") != framework:
            errors.append(f"native runtime framework mismatch for {logical_id}")
            continue
        matched.add(logical_id)
        if not _valid_attempt_history(instance):
            errors.append(f"native runtime hides attempt history for {instance.get('instanceId')}")
            continue
        details.append(instance | {"framework": framework})
    if require_runtime:
        expected = {
            logical_id
            for logical_id, item in selected.items()
            if item.get("framework") == framework
        }
        missing = expected - matched
        if missing:
            errors.append(
                f"native runtime misses {len(missing)} selected {framework} logical case(s)"
            )
            complete = False
    return details, matched, complete, errors


def collect_runtime(
    root: Path,
    inventory: list[dict[str, Any]],
    execution_contract: dict[str, Any],
    profile: str,
    *,
    require_runtime: bool,
) -> tuple[list[dict[str, Any]], bool, list[str]]:
    if not require_runtime:
        return [], False, []
    selected_profiles = set(included_profiles(execution_contract, profile))
    selected = {
        item["logicalCaseId"]: item
        for item in inventory
        if item.get("executionProfile") in selected_profiles
    }
    frameworks = {item["framework"] for item in selected.values()}
    details: list[dict[str, Any]] = []
    errors: list[str] = []
    complete = bool(frameworks)
    for framework in sorted(frameworks):
        path = _runtime_path(root, profile, framework)
        if not path.is_file():
            complete = False
            if require_runtime:
                errors.append(f"missing native runtime evidence for {framework}")
            continue
        items, _matched, artifact_complete, artifact_errors = _artifact_instances(
            path, framework, selected, require_runtime
        )
        details.extend(items)
        errors.extend(artifact_errors)
        complete = complete and artifact_complete
    return details, complete, sorted(set(errors))


def _group_by_case(items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        logical_id = item.get("logicalCaseId")
        if logical_id:
            grouped[logical_id].append(item)
    return grouped


def _entry_detail(
    entry: dict[str, Any],
    record: dict[str, Any],
    mechanisms: list[dict[str, Any]],
    runtime: list[dict[str, Any]],
    selected_profiles: set[str],
) -> dict[str, Any]:
    return {
        **entry,
        "framework": record.get("framework"),
        "sourcePath": record.get("sourcePath"),
        "selector": record.get("selector"),
        "selectedInProfile": entry.get("executionProfile") in selected_profiles,
        "mechanisms": [
            {key: item[key] for key in ("state", "marker", "line")} for item in mechanisms
        ],
        "runtime": runtime,
    }


def _entries_and_expirations(
    entries: list[dict[str, Any]],
    inventory: dict[str, dict[str, Any]],
    detections: dict[str, list[dict[str, Any]]],
    runtime: dict[str, list[dict[str, Any]]],
    selected_profiles: set[str],
    today: date,
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    details: list[dict[str, Any]] = []
    expired: list[str] = []
    due: list[str] = []
    for entry in sorted(entries, key=lambda item: item.get("logicalCaseId", "")):
        logical_id = entry.get("logicalCaseId", "")
        expires = date.fromisoformat(entry["expiresOn"])
        if expires < today:
            expired.append(logical_id)
        elif expires <= today + timedelta(days=30):
            due.append(logical_id)
        details.append(
            _entry_detail(
                entry,
                inventory.get(logical_id, {}),
                detections.get(logical_id, []),
                runtime.get(logical_id, []),
                selected_profiles,
            )
        )
    return details, expired, due


def _state_counts(detections: dict[str, list[dict[str, Any]]]) -> Counter[str]:
    normalized: list[str] = []
    for items in detections.values():
        states = [item["state"] for item in items if item["state"] in STATE_PRIORITY]
        if states:
            normalized.append(max(states, key=lambda state: STATE_PRIORITY[state]))
    return Counter(normalized)


def _summary(
    inventory_count: int,
    entry_count: int,
    detection_count: int,
    states: Counter[str],
    runtime: list[dict[str, Any]],
    expired: list[str],
    due: list[str],
) -> dict[str, int | float]:
    executed = [item for item in runtime if item.get("executed") is True]
    retried = [item for item in executed if item.get("attempts", 0) > 1]
    unstable = [item for item in retried if item.get("initialResult") != item.get("finalResult")]
    attempts = sum(item.get("attempts", 0) for item in runtime)
    retries = sum(
        max(0, item.get("attempts", 0) - int(bool(item.get("executed"))))
        for item in runtime
    )
    return {
        "logicalCases": inventory_count,
        "governedEntries": entry_count,
        "detectedMechanisms": detection_count,
        "skippedCases": states["skipped"],
        "disabledCases": states["disabled"],
        "expectedFailureCases": states["expected_failure"],
        "quarantinedCases": states["quarantine"],
        "retryCases": states["retry"],
        "expiredEntries": len(expired),
        "dueWithin30Days": len(due),
        "executedInstances": len(executed),
        "attempts": attempts,
        "retries": retries,
        "unstableInstances": len(unstable),
        "instabilityRatePercent": round(100 * len(unstable) / len(executed), 4)
        if executed
        else 0.0,
    }


def build_report(
    contract: dict[str, Any],
    inventory: list[dict[str, Any]],
    detections: list[dict[str, Any]],
    execution_contract: dict[str, Any],
    profile: str,
    runtime: list[dict[str, Any]],
    runtime_complete: bool,
    violations: list[str],
    *,
    today: date | None = None,
) -> dict[str, Any]:
    current = today or date.today()
    inventory_by_id = {item["logicalCaseId"]: item for item in inventory}
    detections_by_case = _group_by_case(detections)
    runtime_by_case = _group_by_case(runtime)
    selected = set(included_profiles(execution_contract, profile))
    entries, expired, due = _entries_and_expirations(
        contract.get("entries", []),
        inventory_by_id,
        detections_by_case,
        runtime_by_case,
        selected,
        current,
    )
    controlled = {entry.get("logicalCaseId") for entry in contract.get("entries", [])}
    runtime_details = [
        item
        for item in runtime
        if item.get("logicalCaseId") in controlled or item.get("attempts", 0) > 1
    ]
    summary = _summary(
        len(inventory),
        len(entries),
        len(detections),
        _state_counts(detections_by_case),
        runtime,
        expired,
        due,
    )
    return {
        "schemaVersion": SCHEMA_VERSION,
        "schema": "config/test-governance-report.schema.json",
        "contractVersion": contract.get("schemaVersion"),
        "profile": profile,
        "runtimeComplete": runtime_complete,
        "summary": summary,
        "expirations": {"expired": expired, "dueWithin30Days": due},
        "entries": entries,
        "runtimeDetails": runtime_details,
        "violations": sorted(set(violations)),
    }


def write_report(report: dict[str, Any], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
