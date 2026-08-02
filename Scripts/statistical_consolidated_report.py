"""Build one deterministic model for consolidated statistical compliance."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from Scripts.statistical_consolidated_diagnostics import (
    VERDICT_PRIORITY,
    consolidated_verdict,
    diagnostic_sort_key,
    distribution_diagnostics,
    exact_diagnostics,
    parity_diagnostics,
)
from Scripts.statistical_consolidated_io import (
    ROOT,
    SourceRecord,
    canonical_bytes,
    load_sources,
    sha256_bytes,
)
from Scripts.statistical_consolidated_scope import (
    case_summaries,
    probe_summaries,
    scenario_summaries,
)
from Scripts.statistical_consolidated_sections import (
    build_proof_levels,
    report_summary,
)
from Scripts.statistical_consolidated_validation import validate_sources


def _compatibility(
    records: dict[str, SourceRecord], diagnostics: list[dict[str, Any]]
) -> dict[str, Any]:
    evidence = records["compatibility_evidence"]
    incompatible = any(item["classification"] == "version_incompatibility" for item in diagnostics)
    incomplete = any(record.entry["validation_status"] != "valid" for record in records.values())
    status = (
        "version_incompatibility"
        if incompatible
        else "not_evaluated"
        if incomplete
        else evidence.data["status"]
    )
    declarations = [
        {
            "source": record.definition.source_id,
            "id": record.entry["declared"]["id"],
            "version": record.entry["declared"]["version"],
            "compatible": record.entry["validation_status"] not in {"incompatible", "stale"},
        }
        for record in records.values()
    ]
    evidence_data = evidence.data if isinstance(evidence.data, dict) else {}
    fallback_authority = {
        "id": "mca-statistical-compatibility-authority",
        "version": "1.0",
        "schema_version": "1.0",
        "semantic_fingerprint": "0" * 64,
    }
    fallback_summary = {
        "component_count": 0,
        "matching_component_count": 0,
        "blocked_component_count": 0,
        "proof_count": 0,
        "matching_proof_count": 0,
        "diagnostic_count": 0,
    }
    return {
        "status": status,
        "scope": (
            "Versioned semantic authorities, compatibility decisions, proof freshness, "
            "and explicit "
            "historical-data treatments."
        ),
        "source": "compatibility_evidence",
        "blocking_when_executed": True,
        "authority": evidence_data.get("authority", fallback_authority),
        "summary": evidence_data.get("summary", fallback_summary),
        "declarations": declarations,
    }


def _not_evaluated() -> list[dict[str, str]]:
    return [
        {
            "id": "azure_devops_empirical_backtesting",
            "statement": "No empirical Azure DevOps backtesting is evaluated.",
        },
        {
            "id": "universal_equivalence",
            "statement": (
                "No equivalence is claimed outside recorded corpus cases and protocol scenarios."
            ),
        },
    ]


def _authority_header(source_set_sha: str) -> dict[str, Any]:
    return {
        "format_version": "1.0",
        "report_id": "mca-statistical-consolidated-parity",
        "generation": {
            "kind": "deterministic_source_snapshot",
            "source_set_sha256": source_set_sha,
        },
        "contracts": {
            "normative_contract": {"id": "STD-STAT-001", "version": "1.0"},
            "corpus": {
                "id": "mca-statistical-reference-corpus",
                "version": "1.0",
            },
            "prng": {"id": "mca-prng-v1", "version": "1.0"},
            "distributional_protocol": {
                "id": "mca-statistical-distributional-parity",
                "version": "1.0",
            },
        },
    }


def _conclusions(
    verdict: str,
    classifications: list[str],
    levels: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "verdict": {
            "status": verdict,
            "rule": "highest-priority-observed-classification-v1",
            "priority_order": list(VERDICT_PRIORITY),
            "observed_classifications": [
                value for value in VERDICT_PRIORITY if value in set(classifications)
            ],
            "all_diagnostics_preserved": True,
        },
        "enforcement": {
            "level": "blocking_in_main",
            "blocking": True,
            "generator_failure_classifications": list(VERDICT_PRIORITY[:5]),
            "full_main_enforcement_scope": "config/statistical-main-enforcement-v1.0.json",
        },
        "limits": [{"proof_level": level["id"], "statements": level["limits"]} for level in levels],
        "not_evaluated": _not_evaluated(),
    }


def build_consolidated_report(
    root: Path = ROOT,
    source_paths: dict[str, str] | None = None,
) -> dict[str, Any]:
    records, diagnostics = load_sources(root, source_paths)
    diagnostics.extend(validate_sources(records))
    diagnostics.extend(parity_diagnostics(records["deterministic_parity"]))
    diagnostics.extend(exact_diagnostics(records["exact_replay"]))
    diagnostics.extend(distribution_diagnostics(records["distribution_evidence"]))
    diagnostics.sort(key=diagnostic_sort_key)
    levels = build_proof_levels(records, diagnostics)
    cases = case_summaries(records)
    probes = probe_summaries(records)
    scenarios = scenario_summaries(records)
    classifications = [level["status"] for level in levels]
    classifications.extend(item["classification"] for item in diagnostics)
    sources = [record.entry for record in records.values()]
    source_set_sha = sha256_bytes(canonical_bytes(sources))
    return {
        **_authority_header(source_set_sha),
        "sources": sources,
        "compatibility": _compatibility(records, diagnostics),
        "proof_levels": levels,
        "scope_summary": {
            "normative_cases": cases,
            "validation_probes": probes,
            "distribution_scenarios": scenarios,
        },
        "summary": report_summary(records, levels, diagnostics, cases, probes, scenarios),
        **_conclusions(consolidated_verdict(classifications), classifications, levels),
        "diagnostics": diagnostics,
    }
