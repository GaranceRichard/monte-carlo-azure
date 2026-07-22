"""Source and runtime evidence adapters for strategic test reporting."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

FRAMEWORKS = ("playwright", "pytest", "vitest")
FRAMEWORK_NODE = {
    "pytest": "backend-tests",
    "vitest": "frontend-tests",
    "playwright": "e2e",
}
RESULTS = ("passed", "failed", "skipped", "todo", "infrastructureError")
SOURCE_SPECS = (
    (
        "classification-inventory",
        "reports/test-classification-inventory.json",
        "Scripts/classify_tests.py",
        "globalReference",
    ),
    (
        "execution-counts",
        "reports/test-execution-counts.json",
        "Scripts/report_test_execution_counts.py",
        "globalReference",
    ),
    (
        "execution-plan",
        "reports/test-execution-plan.json",
        "Scripts/test_execution_profiles.py",
        "globalReference",
    ),
    (
        "execution-profiles",
        "config/test-execution-profiles.json",
        "versioned contract",
        "globalReference",
    ),
    (
        "classification-catalog",
        "config/test-classification.json",
        "versioned contract",
        "globalReference",
    ),
    (
        "classification-overrides",
        "config/test-classification-overrides.json",
        "versioned contract",
        "globalReference",
    ),
    (
        "governance",
        "reports/test-governance-report.json",
        "Scripts/check_test_governance.py",
        "profileExecution",
    ),
)
EVIDENCE_AXES = {
    "valid": ("informative", "present", "valid", "not_measurable", "consistent"),
    "missing": ("informative", "missing", "unknown", "not_measurable", "unknown"),
    "invalid": ("informative", "present", "invalid", "not_measurable", "unknown"),
    "stale": ("informative", "present", "valid", "stale", "consistent"),
    "inconsistent": (
        "informative",
        "present",
        "valid",
        "not_measurable",
        "inconsistent",
    ),
    "not_applicable": (
        "not_applicable",
        "not_applicable",
        "not_applicable",
        "not_applicable",
        "not_applicable",
    ),
    "not_measured": (
        "not_measured",
        "not_measured",
        "not_measured",
        "not_measured",
        "not_measured",
    ),
}


def reason(code: str, message: str, evidence_ids: list[str] | None = None) -> dict[str, Any]:
    return {"code": code, "message": message, "evidenceIds": sorted(evidence_ids or [])}


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate JSON property {key}")
        value[key] = item
    return value


def _valid_source(identifier: str, payload: Any) -> bool:
    if identifier == "classification-inventory":
        return isinstance(payload, list) and all(isinstance(item, dict) for item in payload)
    versions = {
        "execution-counts": "1.0.0",
        "execution-plan": "1.0.0",
        "execution-profiles": "1.0.0",
        "classification-catalog": "1.0.0",
        "classification-overrides": "1.0.0",
        "governance": "1.0.0",
    }
    fields = {
        "classification-catalog": "catalogVersion",
        "classification-overrides": "overridesVersion",
    }
    version_field = fields.get(identifier, "schemaVersion")
    return isinstance(payload, dict) and payload.get(version_field) == versions[identifier]


def manifest_entry(
    identifier: str,
    relative: str,
    producer: str,
    scope: str,
    *,
    required: bool = True,
    status: str = "valid",
    fingerprint: str | None = None,
    schema_version: str | int | None = None,
    reasons: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    requirement, presence, validity, freshness, consistency = EVIDENCE_AXES[status]
    return {
        "id": identifier,
        "path": relative.replace("\\", "/"),
        "producer": producer,
        "scope": scope,
        "requirement": "required" if required else requirement,
        "required": required,
        "presence": presence,
        "validity": validity,
        "freshness": freshness,
        "consistency": consistency,
        "fingerprint": fingerprint,
        "schemaVersion": schema_version,
        "status": status,
        "reasons": sorted(reasons or [], key=lambda item: item["code"]),
    }


def load_source(root: Path, spec: tuple[str, str, str, str]) -> tuple[Any, dict[str, Any]]:
    identifier, relative, producer, scope = spec
    path = root / relative
    try:
        raw = path.read_bytes()
    except OSError:
        issue = reason(
            "evidence.missing", f"Required evidence is missing: {relative}", [identifier]
        )
        return None, manifest_entry(
            identifier, relative, producer, scope, status="missing", reasons=[issue]
        )
    try:
        payload = json.loads(raw.decode("utf-8"), object_pairs_hook=_reject_duplicates)
    except (UnicodeError, json.JSONDecodeError, ValueError) as exc:
        issue = reason(
            "evidence.invalid_json", f"Invalid JSON evidence {relative}: {exc}", [identifier]
        )
        return None, manifest_entry(
            identifier,
            relative,
            producer,
            scope,
            status="invalid",
            fingerprint=hashlib.sha256(raw).hexdigest(),
            reasons=[issue],
        )
    version = payload.get("schemaVersion") if isinstance(payload, dict) else None
    if identifier == "classification-catalog" and isinstance(payload, dict):
        version = payload.get("catalogVersion")
    if identifier == "classification-overrides" and isinstance(payload, dict):
        version = payload.get("overridesVersion")
    fingerprint = hashlib.sha256(raw).hexdigest()
    if not _valid_source(identifier, payload):
        issue = reason(
            "evidence.unknown_version",
            f"Unsupported or invalid source contract: {relative}",
            [identifier],
        )
        return payload, manifest_entry(
            identifier,
            relative,
            producer,
            scope,
            status="invalid",
            fingerprint=fingerprint,
            schema_version=version,
            reasons=[issue],
        )
    return payload, manifest_entry(
        identifier,
        relative,
        producer,
        scope,
        fingerprint=fingerprint,
        schema_version=version,
    )


def mark_status(entry: dict[str, Any], status: str, issue: dict[str, Any]) -> None:
    requirement, presence, validity, freshness, consistency = EVIDENCE_AXES[status]
    entry["status"] = status
    entry["reasons"] = sorted([*entry["reasons"], issue], key=lambda item: item["code"])
    entry["presence"] = presence
    entry["validity"] = validity
    entry["freshness"] = freshness
    entry["consistency"] = consistency
    if not entry["required"]:
        entry["requirement"] = requirement


def empty_counts(logical: int = 0) -> dict[str, Any]:
    return {
        "logicalCases": logical,
        "collectedInstances": 0,
        "executedInstances": 0,
        "skippedInstances": 0,
        "attempts": 0,
        "retries": 0,
        "results": {item: 0 for item in RESULTS},
    }


def _native_path(root: Path, profile: str, framework: str) -> tuple[Path, str]:
    primary = Path(
        f"reports/test-execution-artifacts/{profile}/{FRAMEWORK_NODE[framework]}/{framework}.json"
    )
    fallback = Path(f"reports/test-execution-native/{framework}.json")
    selected = primary if (root / primary).is_file() else fallback
    return root / selected, selected.as_posix()


def _load_native(
    root: Path,
    spec: tuple[str, str, str, str],
    framework: str,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    identifier, relative, producer, scope = spec
    try:
        raw = (root / relative).read_bytes()
        payload = json.loads(raw.decode("utf-8"), object_pairs_hook=_reject_duplicates)
    except OSError:
        issue = reason(
            "evidence.missing", f"Required evidence is missing: {relative}", [identifier]
        )
        return None, manifest_entry(
            identifier, relative, producer, scope, status="missing", reasons=[issue]
        )
    except (UnicodeError, json.JSONDecodeError, ValueError) as exc:
        issue = reason(
            "evidence.invalid_json", f"Invalid JSON evidence {relative}: {exc}", [identifier]
        )
        return None, manifest_entry(
            identifier,
            relative,
            producer,
            scope,
            status="invalid",
            fingerprint=hashlib.sha256(raw).hexdigest(),
            reasons=[issue],
        )
    valid = (
        isinstance(payload, dict)
        and payload.get("schemaVersion") == 1
        and payload.get("framework") == framework
        and payload.get("complete") is True
        and payload.get("anomalies") == []
        and isinstance(payload.get("instances"), list)
    )
    status = "valid" if valid else "invalid"
    issues = (
        []
        if valid
        else [
            reason(
                "runtime.invalid", f"Invalid native runtime evidence for {framework}.", [identifier]
            )
        ]
    )
    return payload if isinstance(payload, dict) else None, manifest_entry(
        identifier,
        relative,
        producer,
        scope,
        status=status,
        fingerprint=hashlib.sha256(raw).hexdigest(),
        schema_version=payload.get("schemaVersion") if isinstance(payload, dict) else None,
        reasons=issues,
    )


def _accumulate_instance(
    counts: dict[str, Any],
    initial: Counter[str],
    final: Counter[str],
    item: dict[str, Any],
) -> None:
    executed = item.get("executed") is True
    attempts = item.get("attempts", 0) if type(item.get("attempts")) is int else 0
    counts["executedInstances"] += int(executed)
    counts["skippedInstances"] += int(not executed)
    counts["attempts"] += attempts
    counts["retries"] += max(0, attempts - int(executed))
    result = item.get("result") if item.get("result") in RESULTS else "infrastructureError"
    counts["results"][result] += 1
    first = item.get("initialResult") if item.get("initialResult") in RESULTS else result
    last = item.get("finalResult") if item.get("finalResult") in RESULTS else result
    initial[first] += 1
    final[last] += 1


def _framework_runtime(
    root: Path,
    profile: str,
    framework: str,
    expected: set[Any],
    initial: Counter[str],
    final: Counter[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    _path, relative = _native_path(root, profile, framework)
    identifier = f"runtime-{framework}"
    if not expected:
        entry = manifest_entry(
            identifier,
            relative,
            f"native {framework} reporter",
            "profileExecution",
            required=False,
            status="not_applicable",
        )
        return empty_counts(), entry
    spec = (identifier, relative, f"native {framework} reporter", "profileExecution")
    payload, entry = _load_native(root, spec, framework)
    counts = empty_counts(len(expected))
    instances = [
        item
        for item in (payload or {}).get("instances", [])
        if item.get("logicalCaseId") in expected
    ]
    if {item.get("logicalCaseId") for item in instances} != expected and entry["status"] == "valid":
        mark_status(
            entry,
            "inconsistent",
            reason(
                "runtime.selection_mismatch",
                f"Native {framework} evidence does not cover the exact selected logical cases.",
                [identifier],
            ),
        )
    counts["collectedInstances"] = len(instances)
    for item in instances:
        _accumulate_instance(counts, initial, final, item)
    return counts, entry


def native_counts(
    root: Path,
    profile: str,
    selected: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], dict[str, int], dict[str, int], list[dict[str, Any]]]:
    selected_by_framework = {
        framework: {
            item["logicalCaseId"] for item in selected if item.get("framework") == framework
        }
        for framework in FRAMEWORKS
    }
    initial = Counter({item: 0 for item in RESULTS})
    final = Counter({item: 0 for item in RESULTS})
    by_framework: dict[str, dict[str, Any]] = {}
    evidence: list[dict[str, Any]] = []
    for framework in FRAMEWORKS:
        counts, entry = _framework_runtime(
            root,
            profile,
            framework,
            selected_by_framework[framework],
            initial,
            final,
        )
        by_framework[framework] = counts
        evidence.append(entry)
    return by_framework, dict(initial), dict(final), evidence


def sum_counts(values: list[dict[str, Any]]) -> dict[str, Any]:
    total = empty_counts(sum(item["logicalCases"] for item in values))
    for item in values:
        for field in (
            "collectedInstances",
            "executedInstances",
            "skippedInstances",
            "attempts",
            "retries",
        ):
            total[field] += item[field]
        for result in RESULTS:
            total["results"][result] += item["results"][result]
    return total
