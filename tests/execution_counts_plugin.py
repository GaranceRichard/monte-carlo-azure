"""Native Pytest hooks for deterministic logical-case execution counting."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

WORKER_OUTPUT_KEY = "montecarlo_execution_counts"


@dataclass
class _Run:
    root: Path | None = None
    inventory_ids: set[str] = field(default_factory=set)
    logical_by_identity: dict[tuple[str, str], list[str]] = field(default_factory=dict)
    instances: dict[str, dict[str, Any]] = field(default_factory=dict)
    reports: dict[str, list[Any]] = field(default_factory=dict)
    anomalies: list[str] = field(default_factory=list)
    worker_payloads: list[tuple[str, dict[str, Any]]] = field(default_factory=list)


_run = _Run()


def _included_profiles(root: Path) -> set[str] | None:
    profile = os.environ.get("TEST_EXECUTION_PROFILE")
    if not profile:
        return None
    try:
        contract = json.loads(
            (root / "config" / "test-execution-profiles.json").read_text(encoding="utf-8")
        )
        entry = next(item for item in contract["profiles"] if item["id"] == profile)
    except (OSError, KeyError, StopIteration, json.JSONDecodeError) as error:
        _run.anomalies.append(f"execution profile unavailable: {error}")
        return set()
    return set(entry["includes"])


def _relative(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def _selector(item: Any) -> str:
    parts = item.nodeid.split("::")
    original_name = getattr(item, "originalname", None)
    if not original_name:
        original_name = parts[-1].split("[", 1)[0]
    return "::".join([*parts[1:-1], original_name])


def _write_payload(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def pytest_sessionstart(session: Any) -> None:
    global _run
    root = Path(str(session.config.rootpath)).resolve()
    _run = _Run(root=root)
    inventory_path = root / "reports" / "test-classification-inventory.json"
    try:
        inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        _run.anomalies.append(f"classification inventory unavailable: {error}")
        return
    included = _included_profiles(root)
    for record in inventory:
        if record.get("framework") != "pytest":
            continue
        if included is not None and record.get("executionProfile") not in included:
            continue
        logical_id = record.get("logicalCaseId")
        identity = (record.get("sourcePath"), record.get("selector"))
        if not isinstance(logical_id, str):
            _run.anomalies.append("pytest inventory record has no logicalCaseId")
            continue
        _run.inventory_ids.add(logical_id)
        _run.logical_by_identity.setdefault(identity, []).append(logical_id)


def pytest_collection_finish(session: Any) -> None:
    if _run.root is None:
        return
    for item in session.items:
        try:
            source_path = _relative(_run.root, Path(str(item.path)))
        except ValueError:
            _run.anomalies.append(f"pytest item outside repository: {item.nodeid}")
            continue
        selector = _selector(item)
        matches = _run.logical_by_identity.get((source_path, selector), [])
        if len(matches) != 1:
            state = "orphan" if not matches else "ambiguous"
            _run.anomalies.append(
                f"{state} pytest instance {item.nodeid} at {source_path}::{selector}"
            )
            continue
        location = getattr(item, "location", None) or (None, None, None)
        _run.instances[item.nodeid] = {
            "instanceId": item.nodeid,
            "logicalCaseId": matches[0],
            "sourcePath": source_path,
            "declaration": {
                "line": int(location[1]) + 1 if isinstance(location[1], int) else 0,
                "column": 1,
            },
        }


def pytest_collectreport(report: Any) -> None:
    if getattr(report, "failed", False):
        _run.anomalies.append(f"pytest collection error: {report.nodeid}")


def pytest_runtest_logreport(report: Any) -> None:
    _run.reports.setdefault(report.nodeid, []).append(report)


def _result(reports: list[Any], executed: bool) -> str:
    phase_failures = [
        report
        for report in reports
        if report.when in {"setup", "teardown"} and report.outcome == "failed"
    ]
    if phase_failures:
        return "infrastructureError"
    calls = [report for report in reports if report.when == "call" and report.outcome != "rerun"]
    if not calls:
        return "skipped" if not executed else "infrastructureError"
    final = calls[-1]
    if final.outcome == "passed":
        return "passed"
    if final.outcome == "failed":
        return "failed"
    return "skipped"


def _attempt_results(reports: list[Any], executed: bool) -> list[str]:
    calls = [report for report in reports if report.when == "call"]
    results = []
    for report in calls:
        if report.outcome == "passed":
            results.append("passed")
        elif report.outcome in {"failed", "rerun"}:
            results.append("failed")
        else:
            results.append("skipped")
    phase_failure = any(
        report.when in {"setup", "teardown"} and report.outcome == "failed"
        for report in reports
    )
    if phase_failure and results:
        results[-1] = "infrastructureError"
    if not results and executed:
        results.append("infrastructureError")
    return results


def _native_instances(*, reported_only: bool) -> list[dict[str, Any]]:
    native_instances: list[dict[str, Any]] = []
    for nodeid, instance in sorted(_run.instances.items()):
        if reported_only and nodeid not in _run.reports:
            continue
        reports = _run.reports.get(nodeid, [])
        calls = [report for report in reports if report.when == "call"]
        setup_or_teardown_failure = any(
            report.when in {"setup", "teardown"} and report.outcome == "failed"
            for report in reports
        )
        executed = bool(
            calls
            or setup_or_teardown_failure
            or any(hasattr(report, "wasxfail") for report in reports)
        )
        retry_reports = sum(report.outcome == "rerun" for report in reports)
        attempts = (1 + retry_reports) if executed else 0
        result = _result(reports, executed)
        attempt_results = _attempt_results(reports, executed)
        native_instances.append(
            {
                **instance,
                "executed": executed,
                "attempts": attempts,
                "attemptResults": attempt_results,
                "initialResult": attempt_results[0] if attempt_results else result,
                "finalResult": attempt_results[-1] if attempt_results else result,
                "result": result,
            }
        )
    return native_instances


def _merged_worker_results() -> tuple[list[dict[str, Any]], list[str]]:
    instances: dict[str, dict[str, Any]] = {}
    anomalies = list(_run.anomalies)
    for worker, payload in sorted(_run.worker_payloads):
        worker_instances = payload.get("instances")
        worker_anomalies = payload.get("anomalies")
        if not isinstance(worker_instances, list) or not isinstance(worker_anomalies, list):
            anomalies.append(f"pytest worker {worker} produced an invalid execution payload")
            continue
        anomalies.extend(str(item) for item in worker_anomalies)
        for instance in worker_instances:
            if not isinstance(instance, dict) or not isinstance(instance.get("instanceId"), str):
                anomalies.append(f"pytest worker {worker} produced an invalid instance")
                continue
            instance_id = instance["instanceId"]
            if instance_id in instances:
                anomalies.append(f"pytest instance executed by multiple workers: {instance_id}")
                continue
            instances[instance_id] = instance
    return [instances[item] for item in sorted(instances)], anomalies


def _final_payload(
    native_instances: list[dict[str, Any]], anomalies: list[str]
) -> dict[str, Any]:
    matched_ids = {item["logicalCaseId"] for item in native_instances}
    missing = sorted(_run.inventory_ids - matched_ids)
    unexpected = sorted(matched_ids - _run.inventory_ids)
    if missing:
        anomalies.append(f"pytest logical cases absent from execution: {', '.join(missing)}")
    if unexpected:
        anomalies.append(
            f"pytest execution contains unknown logical cases: {', '.join(unexpected)}"
        )
    return {
        "schemaVersion": 1,
        "framework": "pytest",
        "complete": not anomalies,
        "instances": native_instances,
        "anomalies": sorted(set(anomalies)),
    }


@pytest.hookimpl(optionalhook=True)
def pytest_testnodedown(node: Any, error: object | None) -> None:
    worker = str(getattr(getattr(node, "gateway", None), "id", "unknown"))
    payload = getattr(node, "workeroutput", {}).get(WORKER_OUTPUT_KEY)
    if isinstance(payload, dict):
        _run.worker_payloads.append((worker, payload))
    else:
        _run.anomalies.append(f"pytest worker {worker} produced no execution payload")
    if error is not None:
        _run.anomalies.append(f"pytest worker {worker} stopped unexpectedly: {error}")


def pytest_sessionfinish(session: Any) -> None:
    if _run.root is None:
        return
    config = session.config
    if hasattr(config, "workerinput"):
        config.workeroutput[WORKER_OUTPUT_KEY] = {
            "instances": _native_instances(reported_only=True),
            "anomalies": sorted(set(_run.anomalies)),
        }
        return
    distributed = bool(getattr(config.option, "numprocesses", None))
    if distributed:
        native_instances, anomalies = _merged_worker_results()
    else:
        native_instances = _native_instances(reported_only=False)
        anomalies = list(_run.anomalies)
    payload = _final_payload(native_instances, anomalies)
    configured = os.environ.get("TEST_EXECUTION_NATIVE_DIR")
    report_root = Path(configured).resolve() if configured else (
        _run.root / "reports" / "test-execution-native"
    )
    _write_payload(report_root / "pytest.json", payload)
