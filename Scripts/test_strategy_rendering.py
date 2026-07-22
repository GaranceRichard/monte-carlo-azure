"""Validate and render the deterministic consolidated test-strategy report."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0.0"
PROFILES = ("pr", "main", "nightly", "release")
REPORT_KEYS = (
    "schemaVersion",
    "schema",
    "profile",
    "evidenceBundleId",
    "evidenceBundleIdentityDisclaimer",
    "globalReference",
    "profileExecution",
    "strategicCoverage",
    "evidenceManifest",
    "conclusions",
)


def _validate_profile(profile: Any) -> list[str]:
    errors: list[str] = []
    expected_profile_keys = {
        "profile",
        "includedProfiles",
        "selectedLogicalCases",
        "logicalCaseIds",
        "byFramework",
        "nodes",
        "collectedInstances",
        "executedInstances",
        "skippedInstances",
        "attempts",
        "retries",
        "initialResults",
        "finalResults",
        "governance",
        "coverage",
        "vitals",
    }
    if not isinstance(profile, dict) or set(profile) != expected_profile_keys:
        errors.append("profileExecution properties do not match the closed contract")
        return errors
    count_fields = (
        "selectedLogicalCases",
        "collectedInstances",
        "executedInstances",
        "skippedInstances",
        "attempts",
        "retries",
    )
    if any(type(profile.get(field)) is not int or profile[field] < 0 for field in count_fields):
        errors.append("execution counts must be non-negative integers")
    rate = profile.get("governance", {}).get("instabilityRatePercent")
    if not isinstance(rate, (int, float)) or isinstance(rate, bool) or not 0 <= rate <= 100:
        errors.append("governance percentage must be between 0 and 100")
    return errors


def _validate_identity(model: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not re.fullmatch(r"[0-9a-f]{64}", str(model.get("evidenceBundleId", ""))):
        errors.append("invalid evidenceBundleId")
    for entry in model.get("evidenceManifest", []):
        path = str(entry.get("path", ""))
        if Path(path).is_absolute() or "\\" in path:
            errors.append("evidence paths must be repository-relative POSIX paths")
    return errors


def validate_report(model: dict[str, Any]) -> list[str]:
    """Return contract errors found in a report model."""
    errors: list[str] = []
    if set(model) != set(REPORT_KEYS):
        errors.append("report properties do not match the closed contract")
    if (
        model.get("schemaVersion") != SCHEMA_VERSION
        or model.get("schema") != "config/test-strategy-report.schema.json"
    ):
        errors.append("unsupported report schema")
    if model.get("profile") not in PROFILES:
        errors.append("invalid report profile")
    errors.extend(_validate_profile(model.get("profileExecution", {})))
    errors.extend(_validate_identity(model))
    return errors


def render_json(model: dict[str, Any]) -> bytes:
    """Render a model as stable UTF-8 JSON."""
    return (json.dumps(model, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def render_markdown(model: dict[str, Any]) -> bytes:
    """Render a model as a stable human-readable summary."""
    profile = model["profileExecution"]
    conclusions = model["conclusions"]
    lines = [
        "# Consolidated test-strategy report",
        "",
        f"Profile: `{model['profile']}`",
        f"qualityGateStatus: `{conclusions['qualityGateStatus']}`",
        f"strategyEvidenceStatus: `{conclusions['strategyEvidenceStatus']}`",
        "",
        "## Global reference",
        "",
        f"Known logical cases: {model['globalReference']['inventory']['logicalCases']}",
        "",
        "## Profile execution",
        "",
        f"Selected logical cases: {profile['selectedLogicalCases']}",
        f"Collected instances: {profile['collectedInstances']}",
        f"Executed instances: {profile['executedInstances']}",
        f"Attempts: {profile['attempts']}",
        f"Retries: {profile['retries']}",
        "",
        "## Evidence manifest",
        "",
        "| Evidence | Scope | Required | Status | Path |",
        "| --- | --- | :---: | --- | --- |",
    ]
    for item in model["evidenceManifest"]:
        required = "yes" if item["required"] else "no"
        lines.append(
            f"| `{item['id']}` | `{item['scope']}` | {required} | "
            f"`{item['status']}` | `{item['path']}` |"
        )
    lines.extend(
        [
            "",
            "## Strategic coverage",
            "",
            "| Dimension | Status |",
            "| --- | --- |",
        ]
    )
    lines.extend(f"| `{item['id']}` | `{item['status']}` |" for item in model["strategicCoverage"])
    lines.extend(
        [
            "",
            "## Evidence identity limit",
            "",
            model["evidenceBundleIdentityDisclaimer"],
            "",
            "The running `aggregate` node does not require its own final `result.json`; "
            "its final success is attested by the quality-gate exit code and CI.",
            "",
        ]
    )
    return "\n".join(lines).encode("utf-8")


def write_reports(model: dict[str, Any], json_path: Path, markdown_path: Path) -> None:
    """Validate and write both report representations."""
    errors = validate_report(model)
    if errors:
        raise ValueError("; ".join(errors))
    json_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_bytes(render_json(model))
    markdown_path.write_bytes(render_markdown(model))
