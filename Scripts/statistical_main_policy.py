"""Closed policy loading and validation for statistical main enforcement."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

POLICY_PATH = Path("config/statistical-main-enforcement-v1.0.json")
POLICY_SCHEMA_PATH = Path("config/statistical-main-enforcement-v1.0.schema.json")
ATTESTATION_SCHEMA_PATH = Path("config/statistical-main-attestation-v1.0.schema.json")
CONTROL_IDS = (
    "corpus_and_probes",
    "deterministic_parity",
    "exact_replay",
    "batching_independence",
    "distribution_protocol",
    "distributional_parity",
    "statistical_compatibility",
    "consolidated_report_generation",
    "consolidated_report_validation",
)
REQUIRED_BLOCKING_STATUSES = frozenset(
    {
        "normative_divergence",
        "interlanguage_divergence",
        "batching_divergence",
        "distributional_divergence",
        "statistically_inconclusive",
        "version_incompatibility",
        "invalid_evidence",
        "engine_error",
        "protocol_error",
        "infrastructure_error",
        "source_missing",
        "schema_invalid",
        "fingerprint_invalid",
        "stale_evidence",
        "decision_missing",
        "decision_incoherent",
    }
)


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate JSON property: {key}")
        value[key] = item
    return value


def load_json(path: Path) -> Any:
    return json.loads(
        path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicates
    )


def canonical_sha(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def schema_issues(value: Any, schema: Any) -> list[str]:
    if not isinstance(schema, dict):
        return ["schema must be a JSON object"]
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        return [f"schema is invalid: {exc.message}"]
    errors = sorted(
        Draft202012Validator(schema).iter_errors(value),
        key=lambda error: (list(error.absolute_path), error.message),
    )
    return [
        f"/{'/'.join(str(item) for item in error.absolute_path)}: {error.message}"
        for error in errors
    ]


def _status_issues(policy: dict[str, Any]) -> list[str]:
    statuses = {item["id"]: item for item in policy["statuses"]}
    issues: list[str] = []
    if len(statuses) != len(policy["statuses"]):
        issues.append("status identifiers must be unique")
    accepted = [
        item["id"]
        for item in policy["statuses"]
        if item["disposition"] == "accepted" or item["final_allowed"]
    ]
    expected_match = {"id": "match", "disposition": "accepted", "final_allowed": True}
    if accepted != ["match"] or statuses.get("match") != expected_match:
        issues.append("match must be the only accepted final status")
    blocking = {
        item["id"] for item in policy["statuses"] if item["disposition"] == "blocking"
    }
    missing = REQUIRED_BLOCKING_STATUSES - blocking
    if missing:
        issues.append(f"mandatory blocking statuses are missing: {', '.join(sorted(missing))}")
    return issues


def _control_issues(controls: list[dict[str, Any]]) -> list[str]:
    identifiers = tuple(item["id"] for item in controls)
    issues = (
        []
        if identifiers == CONTROL_IDS
        else ["required controls must use the closed ordered main catalog"]
    )
    declared: set[str] = set()
    for control in controls:
        unknown = set(control["needs"]) - set(identifiers)
        future = set(control["needs"]) - declared
        if unknown:
            issues.append(f"{control['id']} has unknown dependencies: {', '.join(sorted(unknown))}")
        if future:
            issues.append(
                f"{control['id']} dependencies are not topologically ordered: "
                f"{', '.join(sorted(future))}"
            )
        declared.add(control["id"])
    return issues


def load_policy(root: Path) -> tuple[dict[str, Any], list[str]]:
    policy = load_json(root / POLICY_PATH)
    issues = schema_issues(policy, load_json(root / POLICY_SCHEMA_PATH))
    if issues or not isinstance(policy, dict):
        return {}, issues
    issues.extend(_status_issues(policy))
    issues.extend(_control_issues(policy["required_controls"]))
    return policy, issues
