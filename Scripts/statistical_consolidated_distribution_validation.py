"""Validate protocol, calibration and distributional evidence semantics."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_consolidated_io import SourceRecord
from Scripts.statistical_consolidated_validation_common import available, diagnostic
from Scripts.statistical_distribution_evidence import evidence_semantic_issues
from Scripts.statistical_distribution_protocol import (
    protocol_semantic_issues,
    seed_semantic_issues,
)


def validate_protocol(
    protocol: SourceRecord, seeds: SourceRecord, corpus: SourceRecord
) -> list[dict[str, Any]]:
    if not all(available(item) for item in (protocol, seeds, corpus)):
        return []
    version_issues, protocol_issues = protocol_semantic_issues(
        protocol.data, corpus.data, seeds.data
    )
    diagnostics = [
        diagnostic(protocol, "version_incompatibility", "authority_incompatibility", issue)
        for issue in version_issues
    ]
    seed_issues = seed_semantic_issues(seeds.data)
    fingerprint_issues = [issue for issue in seed_issues if "empreinte" in issue.lower()]
    seeds.entry["fingerprint_valid"] = not fingerprint_issues
    diagnostics.extend(
        diagnostic(seeds, "invalid_evidence", "fingerprint_invalid", issue)
        for issue in fingerprint_issues
    )
    remaining = [issue for issue in protocol_issues if issue not in fingerprint_issues]
    diagnostics.extend(
        diagnostic(protocol, "protocol_error", "protocol_semantic_error", issue)
        for issue in remaining
    )
    return diagnostics


def validate_calibration(record: SourceRecord, protocol: SourceRecord) -> list[dict[str, Any]]:
    if not all(available(item) for item in (record, protocol)):
        return []
    expected = protocol.data["calibration"]
    observed = record.data
    values = (
        observed["method"] == expected["method_id"],
        observed["calibration_version"] == expected["version"],
        observed["repetitions"] == expected["repetitions"],
        observed["protocol"]
        == {"id": protocol.data["protocol_id"], "version": protocol.data["version"]},
    )
    if all(values):
        return []
    return [
        diagnostic(
            record,
            "version_incompatibility",
            "calibration_incompatibility",
            "Calibration metadata is incompatible with the protocol.",
        )
    ]


def distribution_protocol_alignment(evidence: dict[str, Any], protocol: dict[str, Any]) -> bool:
    expected_protocol = {"id": protocol["protocol_id"], "version": protocol["version"]}
    if evidence["protocol"] != expected_protocol:
        return False
    if (
        evidence["authorities"] != protocol["authorities"]
        or evidence["inference"] != protocol["inference"]
    ):
        return False
    observed = [
        {
            "id": scenario["id"],
            "source_case_id": scenario["source_case_id"],
            "mode": scenario["mode"],
            "cohort_size": scenario["cohort_size"],
            "n_sims": scenario["n_sims"],
            "distribution_view": scenario["distribution_view"],
            "metrics": [metric["id"] for metric in scenario["metrics"]],
        }
        for scenario in evidence["scenarios"]
    ]
    return observed == protocol["scenarios"]


def validate_distribution(
    record: SourceRecord, protocol: SourceRecord, seeds: SourceRecord
) -> list[dict[str, Any]]:
    if not all(available(item) for item in (record, protocol, seeds)):
        return []
    diagnostics = [
        diagnostic(record, "invalid_evidence", "distribution_evidence_inconsistent", issue)
        for issue in evidence_semantic_issues(record.data)
    ]
    if not distribution_protocol_alignment(record.data, protocol.data):
        diagnostics.append(
            diagnostic(
                record,
                "version_incompatibility",
                "protocol_incompatibility",
                "Distributional evidence does not match protocol metadata and scope.",
            )
        )
    if record.data["seed_population"]["fingerprint"] != seeds.data["population_fingerprint"]:
        diagnostics.append(
            diagnostic(
                record,
                "version_incompatibility",
                "seed_population_incompatibility",
                "Distributional evidence references another seed population.",
                "/seed_population/fingerprint",
            )
        )
    return diagnostics
