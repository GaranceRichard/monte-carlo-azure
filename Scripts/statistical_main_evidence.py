"""Closed status evaluation for specialized statistical evidence."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from Scripts.statistical_compatibility_evidence import (
    validate_evidence as validate_compatibility_evidence,
)
from Scripts.statistical_consolidated_distribution_validation import (
    distribution_protocol_alignment,
)
from Scripts.statistical_consolidated_exact_validation import exact_internal_issues
from Scripts.statistical_consolidated_parity_validation import parity_internal_issues
from Scripts.statistical_consolidated_report_validation import validate_report
from Scripts.statistical_distribution_evidence import (
    evidence_semantic_issues,
)
from Scripts.statistical_distribution_evidence import (
    validate_evidence as validate_distribution_evidence,
)
from Scripts.statistical_main_compatibility_evidence import compatibility_proof_issues
from Scripts.statistical_main_enforcement_common import (
    load_json,
    load_policy,
    schema_issues,
    verify_requirements,
)

CONTROL_REQUIREMENTS = {
    "parity": (
        ("deterministic_parity",),
        {"authority_preflight", "corpus_and_probes"},
    ),
    "exact": (("exact_replay",), {"authority_preflight", "corpus_and_probes"}),
    "batching": (
        ("batching_independence",),
        {"authority_preflight", "corpus_and_probes", "exact_replay"},
    ),
    "distribution": (
        ("distributional_parity",),
        {"authority_preflight", "corpus_and_probes", "distribution_protocol"},
    ),
    "compatibility": (
        ("statistical_compatibility",),
        {
            "authority_preflight",
            "corpus_and_probes",
            "distribution_protocol",
            "deterministic_parity",
            "exact_replay",
            "batching_independence",
            "distributional_parity",
        },
    ),
}


def _parity_statuses(report: dict[str, Any]) -> set[str]:
    statuses: set[str] = set()
    if report.get("status") == "engine_error":
        statuses.add("engine_error")
    for case in report.get("cases", []):
        engines = {
            case.get("python", {}).get("status"),
            case.get("typescript", {}).get("status"),
        }
        if "normative_divergence" in engines:
            statuses.add("normative_divergence")
        if case.get("inter_engine", {}).get("status") == "engine_divergence":
            statuses.add("interlanguage_divergence")
    alignment = report.get("validation_alignment", {})
    if alignment.get("status") == "divergence":
        statuses.add("validation_probe_divergence")
    if alignment.get("status") == "engine_error":
        statuses.add("engine_error")
    return statuses or {"match" if report.get("status") == "match" else "invalid_evidence"}


def _exact_statuses(report: dict[str, Any], *, batching_only: bool) -> set[str]:
    if batching_only:
        independent = report.get("batching", {}).get("independent") is True
        return {"match" if independent else "batching_divergence"}
    statuses = {
        item for case in report.get("cases", []) for item in case.get("outcomes", [])
    }
    statuses.discard("match")
    return statuses or {"match" if report.get("status") == "match" else "invalid_evidence"}


def _distribution_statuses(report: dict[str, Any]) -> set[str]:
    if report.get("status") == "invalid":
        return {report.get("error_classification") or "invalid_evidence"}
    statuses = {item.get("classification") for item in report.get("diagnostics", [])}
    statuses.discard(None)
    if report.get("status") == "divergence":
        statuses.add("distributional_divergence")
    if report.get("status") == "inconclusive":
        statuses.add("statistically_inconclusive")
    return statuses or {"match" if report.get("status") == "match" else "invalid_evidence"}


def observed_statuses(kind: str, report: dict[str, Any]) -> set[str]:
    if kind == "parity":
        return _parity_statuses(report)
    if kind in {"exact", "batching"}:
        return _exact_statuses(report, batching_only=kind == "batching")
    if kind == "distribution":
        return _distribution_statuses(report)
    if kind == "compatibility":
        if report.get("status") == "match":
            return {"match"}
        return {report.get("classification", "invalid_evidence")}
    statuses = {report.get("verdict", {}).get("status", "invalid_evidence")}
    statuses.update(item.get("classification") for item in report.get("diagnostics", []))
    statuses.discard(None)
    return statuses


def _specialized_semantic_issues(root: Path, kind: str, report: dict[str, Any]) -> list[str]:
    corpus = load_json(root / "contracts/statistical-reference-corpus-v1.0.json")
    if kind == "parity":
        probes = load_json(root / "contracts/statistical-validation-probes-v1.0.json")
        return [message for _path, message in parity_internal_issues(report, corpus, probes)]
    if kind in {"exact", "batching"}:
        return [message for _path, message in exact_internal_issues(report, corpus)]
    if kind == "distribution":
        protocol = load_json(root / "contracts/statistical-distribution-protocol-v1.0.json")
        seeds = load_json(root / "contracts/statistical-distribution-seeds-v1.0.json")
        issues = evidence_semantic_issues(report)
        if not distribution_protocol_alignment(report, protocol):
            issues.append("distribution evidence does not match the current protocol")
        if report["seed_population"]["fingerprint"] != seeds["population_fingerprint"]:
            issues.append("distribution evidence uses another seed population")
        return issues
    return []


def _artifact_issues(
    root: Path,
    kind: str,
    report: Any,
    schema: Any,
    requirements: list[Path],
) -> list[str]:
    issues = schema_issues(report, schema)
    if issues or not isinstance(report, dict):
        return issues
    issues.extend(_specialized_semantic_issues(root, kind, report))
    if kind == "compatibility":
        issues.extend(validate_compatibility_evidence(report, schema))
        issues.extend(compatibility_proof_issues(root, report, requirements))
    elif kind == "consolidated":
        issues.extend(validate_report(report, schema))
    return issues


def enforce(
    root: Path,
    kind: str,
    artifact: Path,
    schema_path: Path,
    requirements: list[Path],
    controls: list[str],
) -> tuple[list[str], set[str]]:
    expected_controls, expected_requirements = CONTROL_REQUIREMENTS[kind]
    issues = verify_requirements(
        root,
        requirements,
        expected_requirements,
        consumer_controls=set(expected_controls),
    )
    if tuple(controls) != expected_controls:
        issues.append(f"control invocation is incoherent for evidence kind {kind}")
    try:
        report = load_json(root / artifact)
        schema = load_json(root / schema_path)
        issues.extend(_artifact_issues(root, kind, report, schema, requirements))
        if kind == "distribution":
            _validated, distribution_issues = validate_distribution_evidence(
                root / artifact, root / schema_path
            )
            issues.extend(distribution_issues)
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        return [*issues, str(exc)], {"invalid_evidence"}
    statuses = observed_statuses(kind, report) if not issues else {"invalid_evidence"}
    issues.extend(status_issues(root, statuses))
    return issues, statuses


def status_issues(root: Path, statuses: set[str]) -> list[str]:
    policy, policy_issues = load_policy(root)
    issues = list(policy_issues)
    dispositions = {item["id"]: item for item in policy.get("statuses", [])}
    for status in sorted(statuses):
        rule = dispositions.get(status)
        if rule is None:
            issues.append(f"status absent from closed policy: {status}")
        elif rule["disposition"] != "accepted" or not rule["final_allowed"]:
            issues.append(f"blocking statistical status observed: {status}")
    return issues
