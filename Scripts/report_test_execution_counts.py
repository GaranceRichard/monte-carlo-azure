#!/usr/bin/env python3
"""Consolidate native framework execution inventories without changing test identity."""

from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from Scripts.test_execution_counts_reference import (
    execution_counts_main,
    reference_validator,
)
from Scripts.test_execution_counts_reference import (
    reject_duplicate_keys as _reject_duplicate_keys,
)
from Scripts.test_execution_counts_reference import write_report as write_report

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = "1.0.0"
FRAMEWORKS = ("playwright", "pytest", "vitest")
RESULTS = ("passed", "failed", "skipped", "todo", "infrastructureError")
COUNT_FIELDS = (
    "logicalCases",
    "collectedInstances",
    "executedInstances",
    "skippedInstances",
    "attempts",
    "retries",
)
DEFAULT_INVENTORY = Path("reports/test-classification-inventory.json")
DEFAULT_OUTPUT = Path("reports/test-execution-counts.json")
DEFAULT_NATIVE = tuple(Path(f"reports/test-execution-native/{name}.json") for name in FRAMEWORKS)


def load_json(path: Path) -> Any:
    try:
        return json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys
        )
    except FileNotFoundError as error:
        raise ValueError(f"Missing execution-count artifact: {path.as_posix()}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON in {path.as_posix()}: {error.msg}") from error


def _empty_totals(logical_cases: int = 0) -> dict[str, Any]:
    return {
        "logicalCases": logical_cases,
        "collectedInstances": 0,
        "executedInstances": 0,
        "skippedInstances": 0,
        "attempts": 0,
        "retries": 0,
        "results": {result: 0 for result in RESULTS},
    }


def _add(target: dict[str, Any], source: dict[str, Any]) -> None:
    for field in COUNT_FIELDS:
        target[field] += source[field]
    for result in RESULTS:
        target["results"][result] += source["results"][result]


def _validate_inventory(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, list) or not payload:
        raise ValueError("Classification inventory must be a non-empty JSON array.")
    identifiers: set[str] = set()
    records: list[dict[str, Any]] = []
    for index, record in enumerate(payload):
        if not isinstance(record, dict):
            raise ValueError(f"Invalid classification inventory record at index {index}.")
        identifier = record.get("logicalCaseId")
        framework = record.get("framework")
        if not isinstance(identifier, str) or not identifier:
            raise ValueError(f"Missing logicalCaseId in classification record {index}.")
        if identifier in identifiers:
            raise ValueError(f"Duplicate logicalCaseId in classification inventory: {identifier}")
        if framework not in FRAMEWORKS:
            raise ValueError(f"Unsupported framework for {identifier}: {framework}")
        identifiers.add(identifier)
        records.append(record)
    return sorted(records, key=lambda item: item["logicalCaseId"])


def _validate_instance(instance: Any, framework: str, index: int) -> dict[str, Any]:
    label = f"{framework} instance {index}"
    if not isinstance(instance, dict):
        raise ValueError(f"Invalid {label}: expected an object.")
    required = {"instanceId", "logicalCaseId", "executed", "attempts", "result"}
    missing = sorted(required - set(instance))
    if missing:
        raise ValueError(f"Invalid {label}: missing {', '.join(missing)}.")
    if not isinstance(instance["instanceId"], str) or not instance["instanceId"]:
        raise ValueError(f"Invalid {label}: instanceId must be non-empty.")
    if not isinstance(instance["logicalCaseId"], str) or not instance["logicalCaseId"]:
        raise ValueError(f"Invalid {label}: logicalCaseId must be non-empty.")
    if type(instance["executed"]) is not bool:  # bool must not be accepted as an integer later
        raise ValueError(f"Invalid {label}: executed must be boolean.")
    attempts = instance["attempts"]
    if type(attempts) is not int or attempts < 0:
        raise ValueError(f"Invalid {label}: attempts must be a non-negative integer.")
    expected_minimum = 1 if instance["executed"] else 0
    if attempts < expected_minimum or (not instance["executed"] and attempts != 0):
        raise ValueError(f"Invalid {label}: attempts contradict executed.")
    if instance["result"] not in RESULTS:
        raise ValueError(f"Invalid {label}: unsupported result {instance['result']!r}.")
    return instance


def _case_counts(instances: Iterable[dict[str, Any]]) -> dict[str, Any]:
    items = list(instances)
    counts = _empty_totals(1)
    counts["collectedInstances"] = len(items)
    for instance in items:
        executed = int(instance["executed"])
        attempts = instance["attempts"]
        counts["executedInstances"] += executed
        counts["skippedInstances"] += 1 - executed
        counts["attempts"] += attempts
        counts["retries"] += attempts - executed
        counts["results"][instance["result"]] += 1
    _validate_counts(counts, "logical case")
    return counts


def _validate_counts(counts: dict[str, Any], label: str) -> None:
    if counts["collectedInstances"] != (counts["executedInstances"] + counts["skippedInstances"]):
        raise ValueError(f"Invalid {label}: collectedInstances invariant failed.")
    if counts["attempts"] != counts["executedInstances"] + counts["retries"]:
        raise ValueError(f"Invalid {label}: attempts invariant failed.")
    if sum(counts["results"].values()) != counts["collectedInstances"]:
        raise ValueError(f"Invalid {label}: result totals do not equal collectedInstances.")


def _native_artifact(path: Path) -> tuple[str, list[Any]]:
    artifact = load_json(path)
    if not isinstance(artifact, dict) or artifact.get("schemaVersion") != 1:
        raise ValueError(f"Invalid native execution artifact schema: {path.as_posix()}")
    framework = artifact.get("framework")
    if framework not in FRAMEWORKS:
        raise ValueError(f"Unsupported native execution framework: {framework}")
    if artifact.get("complete") is not True:
        raise ValueError(f"Native {framework} collection is not complete.")
    anomalies = artifact.get("anomalies")
    if not isinstance(anomalies, list):
        raise ValueError(f"Native {framework} anomalies must be an array.")
    if anomalies:
        raise ValueError(f"Native {framework} matching anomalies: {'; '.join(map(str, anomalies))}")
    instances = artifact.get("instances")
    if not isinstance(instances, list):
        raise ValueError(f"Native {framework} instances must be an array.")
    return framework, instances


def _collect_native(
    root: Path,
    native_paths: Iterable[Path],
    inventory_by_id: dict[str, dict[str, Any]],
) -> tuple[dict[str, list[dict[str, Any]]], set[str]]:
    instances_by_case: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_instances: set[tuple[str, str]] = set()
    covered_frameworks: set[str] = set()
    for native_path in native_paths:
        path = native_path if native_path.is_absolute() else root / native_path
        framework, raw_instances = _native_artifact(path)
        if framework in covered_frameworks:
            raise ValueError(f"Duplicate native execution artifact for {framework}.")
        covered_frameworks.add(framework)
        for index, raw_instance in enumerate(raw_instances):
            instance = _validate_instance(raw_instance, framework, index)
            key = (framework, instance["instanceId"])
            if key in seen_instances:
                raise ValueError(
                    f"Native instance belongs more than once: {framework}:{instance['instanceId']}"
                )
            seen_instances.add(key)
            logical = inventory_by_id.get(instance["logicalCaseId"])
            if logical is None:
                raise ValueError(
                    f"Orphan native instance {instance['instanceId']}: {instance['logicalCaseId']}"
                )
            if logical["framework"] != framework:
                raise ValueError(
                    f"Framework mismatch for native instance {instance['instanceId']}."
                )
            instances_by_case[instance["logicalCaseId"]].append(instance)
    return instances_by_case, covered_frameworks


def _require_complete(
    inventory: list[dict[str, Any]],
    instances_by_case: dict[str, list[dict[str, Any]]],
    covered_frameworks: set[str],
) -> None:
    missing_frameworks = sorted(set(FRAMEWORKS) - covered_frameworks)
    if missing_frameworks:
        raise ValueError(f"Incomplete native collection; missing: {', '.join(missing_frameworks)}")
    missing_cases = [
        item["logicalCaseId"] for item in inventory if not instances_by_case[item["logicalCaseId"]]
    ]
    if missing_cases:
        preview = ", ".join(missing_cases[:5])
        suffix = " ..." if len(missing_cases) > 5 else ""
        raise ValueError(
            f"Classification inventory absent from complete collection: {preview}{suffix}"
        )


def _aggregates(inventory: list[dict[str, Any]]) -> tuple[dict[str, Any], ...]:
    framework_totals = {
        framework: _empty_totals(sum(item["framework"] == framework for item in inventory))
        for framework in FRAMEWORKS
    }
    status_totals = {
        status: _empty_totals(sum(item["status"] == status for item in inventory))
        for status in sorted({item["status"] for item in inventory})
    }
    nature_names = sorted(
        {
            item["nature"]
            for item in inventory
            if item["status"] != "unresolved" and "nature" in item
        }
    )
    nature_totals = {
        nature: _empty_totals(
            sum(
                item.get("nature") == nature and item["status"] != "unresolved"
                for item in inventory
            )
        )
        for nature in nature_names
    }
    profile_counts = Counter(map(lambda item: item["executionProfile"], inventory))
    profile_totals = {
        "pr": _empty_totals(profile_counts["pr"]),
        "main": _empty_totals(profile_counts["main"]),
        "nightly": _empty_totals(profile_counts["nightly"]),
        "release": _empty_totals(profile_counts["release"]),
    }
    return (
        _empty_totals(len(inventory)),
        framework_totals,
        status_totals,
        nature_totals,
        profile_totals,
    )


def _detail(logical: dict[str, Any], case_counts: dict[str, Any]) -> dict[str, Any]:
    return {
        "logicalCaseId": logical["logicalCaseId"],
        "framework": logical["framework"],
        "sourcePath": logical["sourcePath"],
        "selector": logical["selector"],
        "classificationStatus": logical["status"],
        "executionProfile": logical["executionProfile"],
        **({"nature": logical["nature"]} if "nature" in logical else {}),
        **case_counts,
    }


def _validate_aggregates(
    global_totals: dict[str, Any],
    framework_totals: dict[str, Any],
    status_totals: dict[str, Any],
    nature_totals: dict[str, Any],
    profile_totals: dict[str, Any],
) -> None:
    groups = (
        [("global totals", global_totals)]
        + [(f"framework {key}", value) for key, value in framework_totals.items()]
        + [(f"status {key}", value) for key, value in status_totals.items()]
        + [(f"nature {key}", value) for key, value in nature_totals.items()]
        + [(f"execution profile {key}", value) for key, value in profile_totals.items()]
    )
    for label, totals in groups:
        _validate_counts(totals, label)


def consolidate(
    root: Path = ROOT,
    inventory_path: Path = DEFAULT_INVENTORY,
    native_paths: Iterable[Path] = DEFAULT_NATIVE,
) -> dict[str, Any]:
    inventory_file = inventory_path if inventory_path.is_absolute() else root / inventory_path
    inventory_bytes = inventory_file.read_bytes()
    inventory = _validate_inventory(
        json.loads(inventory_bytes.decode("utf-8"), object_pairs_hook=_reject_duplicate_keys)
    )
    inventory_by_id = {item["logicalCaseId"]: item for item in inventory}
    instances_by_case, covered = _collect_native(root, native_paths, inventory_by_id)
    _require_complete(inventory, instances_by_case, covered)
    logical_details: list[dict[str, Any]] = []
    (
        global_totals,
        framework_totals,
        status_totals,
        nature_totals,
        profile_totals,
    ) = _aggregates(inventory)
    for logical in inventory:
        case_counts = _case_counts(instances_by_case[logical["logicalCaseId"]])
        logical_details.append(_detail(logical, case_counts))
        execution_counts = case_counts | {"logicalCases": 0}
        _add(global_totals, execution_counts)
        _add(framework_totals[logical["framework"]], execution_counts)
        _add(status_totals[logical["status"]], execution_counts)
        if logical["status"] != "unresolved" and "nature" in logical:
            _add(nature_totals[logical["nature"]], execution_counts)
        _add(profile_totals[logical["executionProfile"]], execution_counts)
    _validate_aggregates(
        global_totals, framework_totals, status_totals, nature_totals, profile_totals
    )
    return {
        "schemaVersion": SCHEMA_VERSION,
        "classificationInventorySha256": hashlib.sha256(inventory_bytes).hexdigest(),
        "totals": global_totals,
        "frameworks": framework_totals,
        "classificationStatuses": status_totals,
        "natures": nature_totals,
        "executionProfiles": profile_totals,
        "logicalCases": logical_details,
        "anomalies": [],
    }


validate_report_reference = reference_validator(
    ROOT,
    DEFAULT_INVENTORY,
    DEFAULT_OUTPUT,
    schema_version=SCHEMA_VERSION,
    reject_duplicates=_reject_duplicate_keys,
    validate_inventory=_validate_inventory,
    load_json=load_json,
    validate_counts=_validate_counts,
)


main = execution_counts_main(
    description=str(__doc__),
    default_root=ROOT,
    default_inventory=DEFAULT_INVENTORY,
    default_output=DEFAULT_OUTPUT,
    default_native=DEFAULT_NATIVE,
    validate_report=validate_report_reference,
    load_json=load_json,
    consolidate=consolidate,
    report_writer=write_report,
)


if __name__ == "__main__":
    raise SystemExit(main())
