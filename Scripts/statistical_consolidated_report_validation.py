"""Independent structural, semantic and fingerprint checks for consolidated reports."""

from __future__ import annotations

from typing import Any

from jsonschema import Draft202012Validator

from Scripts.statistical_consolidated_diagnostics import (
    VERDICT_PRIORITY,
    consolidated_verdict,
    diagnostic_sort_key,
)
from Scripts.statistical_consolidated_io import canonical_bytes, sha256_bytes
from Scripts.statistical_consolidated_render import verify_report_fingerprint


def _pointer(parts: Any) -> str:
    escaped = [str(part).replace("~", "~0").replace("/", "~1") for part in parts]
    return "/" + "/".join(escaped) if escaped else "/"


def structural_issues(report: Any, schema: dict[str, Any]) -> list[str]:
    errors = sorted(
        Draft202012Validator(schema).iter_errors(report),
        key=lambda error: (list(error.absolute_path), error.message),
    )
    return [f"{_pointer(error.absolute_path)}: {error.message}" for error in errors]


def _summary_issues(report: dict[str, Any]) -> list[str]:
    summary = report["summary"]
    expected = {
        "source_count": len(report["sources"]),
        "valid_source_count": sum(
            source["validation_status"] == "valid" for source in report["sources"]
        ),
        "invalid_source_count": sum(
            source["validation_status"] != "valid" for source in report["sources"]
        ),
        "proof_level_count": len(report["proof_levels"]),
        "matching_proof_level_count": sum(
            level["status"] == "match" for level in report["proof_levels"]
        ),
        "divergent_proof_level_count": sum(
            "divergence" in level["status"] for level in report["proof_levels"]
        ),
        "inconclusive_proof_level_count": sum(
            level["status"] == "statistically_inconclusive" for level in report["proof_levels"]
        ),
        "unavailable_proof_level_count": sum(
            level["status"] in VERDICT_PRIORITY[:5] for level in report["proof_levels"]
        ),
        "normative_case_count": len(report["scope_summary"]["normative_cases"]),
        "validation_probe_count": len(report["scope_summary"]["validation_probes"]),
        "distribution_scenario_count": len(report["scope_summary"]["distribution_scenarios"]),
        "distribution_metric_count": sum(
            scenario["metric_count"]
            for scenario in report["scope_summary"]["distribution_scenarios"]
        ),
        "diagnostic_count": len(report["diagnostics"]),
    }
    return [] if summary == expected else ["/summary: counters are inconsistent"]


def semantic_issues(report: dict[str, Any]) -> list[str]:
    issues = _summary_issues(report)
    expected_source_set = sha256_bytes(canonical_bytes(report["sources"]))
    if report["generation"]["source_set_sha256"] != expected_source_set:
        issues.append("/generation/source_set_sha256: source-set fingerprint is inconsistent")
    classifications = [level["status"] for level in report["proof_levels"]]
    classifications += [item["classification"] for item in report["diagnostics"]]
    if report["verdict"]["priority_order"] != list(VERDICT_PRIORITY):
        issues.append("/verdict/priority_order: priority rule is inconsistent")
    if report["verdict"]["status"] != consolidated_verdict(classifications):
        issues.append("/verdict/status: verdict does not apply the priority rule")
    if report["diagnostics"] != sorted(report["diagnostics"], key=diagnostic_sort_key):
        issues.append("/diagnostics: diagnostics are not deterministically ordered")
    if not verify_report_fingerprint(report):
        issues.append("/integrity/content_sha256: report fingerprint is inconsistent")
    return issues


def validate_report(report: Any, schema: dict[str, Any]) -> list[str]:
    structural = structural_issues(report, schema)
    if structural or not isinstance(report, dict):
        return structural
    return semantic_issues(report)
