"""Validate deterministic parity evidence semantics."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_consolidated_io import SourceRecord
from Scripts.statistical_consolidated_validation_common import (
    available,
    diagnostic,
    same_identity,
)


def parity_summary(report: dict[str, Any]) -> dict[str, int]:
    cases = report["cases"]
    return {
        "case_count": len(cases),
        "matching_cases": sum(case["outcomes"] == ["match"] for case in cases),
        "normative_divergence_cases": sum(
            "normative_divergence" in case["outcomes"] for case in cases
        ),
        "engine_divergence_cases": sum("engine_divergence" in case["outcomes"] for case in cases),
        "engine_error_cases": sum("engine_error" in case["outcomes"] for case in cases),
        "fatal_engine_errors": sum(
            engine["status"] == "engine_error" for engine in report["engines"].values()
        ),
    }


def parity_status(report: dict[str, Any]) -> str:
    summary = report["summary"]
    validation = report["validation_alignment"]["status"]
    if (
        summary["engine_error_cases"]
        or summary["fatal_engine_errors"]
        or validation == "engine_error"
    ):
        return "engine_error"
    if (
        summary["normative_divergence_cases"]
        or summary["engine_divergence_cases"]
        or validation == "divergence"
    ):
        return "divergence"
    return "match"


def validation_summary(validation: dict[str, Any]) -> dict[str, int]:
    cases = validation["cases"]
    return {
        "probe_count": len(cases),
        "matching_probes": sum(case["status"] == "match" for case in cases),
        "divergent_probes": sum(case["status"] == "divergence" for case in cases),
        "engine_errors": sum(
            engine["status"] == "engine_error" for engine in validation["engines"].values()
        ),
    }


def parity_internal_issues(
    report: dict[str, Any], corpus: dict[str, Any], probes: dict[str, Any]
) -> list[tuple[str, str]]:
    issues: list[tuple[str, str]] = []
    expected_ids = [case["id"] for case in corpus["cases"]]
    cases = report["cases"]
    if [case["id"] for case in cases] != expected_ids:
        issues.append(("/cases", "Parity cases do not match the corpus identity and order."))
    expected_results = {case["id"]: case["expected_result"] for case in corpus["cases"]}
    if any(case["expected"] != expected_results.get(case["id"]) for case in cases):
        issues.append(("/cases", "Parity expected results differ from the corpus authority."))
    if report["summary"] != parity_summary(report):
        issues.append(("/summary", "Parity summary is inconsistent with its cases."))
    validation = report["validation_alignment"]
    expected_probes = [(case["id"], case["accepted"]) for case in probes["cases"]]
    observed_probes = [(case["id"], case["expected_accepted"]) for case in validation["cases"]]
    if observed_probes != expected_probes:
        issues.append(
            (
                "/validation_alignment/cases",
                "Validation probes differ from their authority.",
            )
        )
    if validation["summary"] != validation_summary(validation):
        issues.append(("/validation_alignment/summary", "Validation summary is inconsistent."))
    if report["status"] != parity_status(report):
        issues.append(("/status", "Parity status is inconsistent with specialized outcomes."))
    return issues


def validate_parity(
    record: SourceRecord, corpus: SourceRecord, probes: SourceRecord
) -> list[dict[str, Any]]:
    if not all(available(item) for item in (record, corpus, probes)):
        return []
    expected_corpus = {
        "id": corpus.data["corpus_id"],
        "schema_version": corpus.data["schema_version"],
        "prng_contract": corpus.data["prng_contract"]["id"],
    }
    diagnostics = same_identity(
        record,
        record.data["corpus"],
        expected_corpus,
        "/corpus",
        "Parity corpus metadata",
    )
    diagnostics.extend(
        diagnostic(
            record,
            "invalid_evidence",
            "parity_evidence_inconsistent",
            message,
            path,
        )
        for path, message in parity_internal_issues(record.data, corpus.data, probes.data)
    )
    return diagnostics
