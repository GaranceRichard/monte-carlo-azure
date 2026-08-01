"""Validate exact-replay evidence semantics."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_consolidated_io import SourceRecord
from Scripts.statistical_consolidated_validation_common import (
    available,
    diagnostic,
    same_identity,
)
from Scripts.statistical_exact_replay_support import build_proof_coverage


def exact_summary(report: dict[str, Any]) -> dict[str, int]:
    cases = report["cases"]
    normative = [case["typescript"] for case in cases] + [
        batch for case in cases for batch in case["python_batches"]
    ]
    interlanguage = [entry for case in cases for entry in case["interlanguage"]]
    return {
        "case_count": len(cases),
        "python_case_executions": sum(len(case["python_batches"]) for case in cases),
        "typescript_case_executions": len(cases),
        "normative_comparisons": len(normative),
        "normative_matches": sum(entry["status"] == "match" for entry in normative),
        "interlanguage_comparisons": len(interlanguage),
        "interlanguage_matches": sum(entry["status"] == "match" for entry in interlanguage),
        "batch_independent_cases": sum(case["batch_independent"] for case in cases),
        "engine_error_cases": sum("engine_error" in case["outcomes"] for case in cases),
        "diagnostic_count": len(report["diagnostics"]),
    }


def exact_status(report: dict[str, Any]) -> str:
    outcomes = [value for case in report["cases"] for value in case["outcomes"]]
    if "engine_error" in outcomes:
        return "engine_error"
    return "divergence" if any(value != "match" for value in outcomes) else "match"


def _exact_collection_issues(
    report: dict[str, Any], expected_ids: list[str], batches: list[int]
) -> list[tuple[str, str]]:
    issues: list[tuple[str, str]] = []
    cases = report["cases"]
    if [case["id"] for case in cases] != expected_ids:
        issues.append(("/cases", "Exact replay cases do not match the corpus identity and order."))
    if any([entry["batch_size"] for entry in case["python_batches"]] != batches for case in cases):
        issues.append(("/cases", "Exact replay batch collections are inconsistent."))
    if any(
        [entry["python_batch_size"] for entry in case["interlanguage"]] != batches for case in cases
    ):
        issues.append(("/cases", "Interlanguage batch collections are inconsistent."))
    if any(
        case["batch_independent"]
        != all(batch["status"] == "match" for batch in case["python_batches"])
        for case in cases
    ):
        issues.append(("/cases", "Batch independence is inconsistent with comparisons."))
    if report["batching"]["independent"] != all(case["batch_independent"] for case in cases):
        issues.append(("/batching/independent", "Global batch independence is inconsistent."))
    return issues


def exact_internal_issues(report: dict[str, Any], corpus: dict[str, Any]) -> list[tuple[str, str]]:
    expected_ids = [case["id"] for case in corpus["cases"]]
    issues = _exact_collection_issues(
        report, expected_ids, report["batching"]["python_batch_sizes"]
    )
    if report["summary"] != exact_summary(report):
        issues.append(("/summary", "Exact replay summary is inconsistent."))
    if report["status"] != exact_status(report):
        issues.append(("/status", "Exact replay status is inconsistent."))
    if report["coverage"] != build_proof_coverage(corpus):
        issues.append(("/coverage", "Exact replay coverage differs from the corpus authority."))
    return issues


def validate_exact(record: SourceRecord, corpus: SourceRecord) -> list[dict[str, Any]]:
    if not all(available(item) for item in (record, corpus)):
        return []
    expected = {
        "id": corpus.data["corpus_id"],
        "schema_version": corpus.data["schema_version"],
        "normative_contract": corpus.data["normative_contract"],
        "prng_contract": corpus.data["prng_contract"]["id"],
    }
    diagnostics = same_identity(
        record, record.data["corpus"], expected, "/corpus", "Exact replay metadata"
    )
    diagnostics.extend(
        diagnostic(
            record,
            "invalid_evidence",
            "exact_evidence_inconsistent",
            message,
            path,
        )
        for path, message in exact_internal_issues(record.data, corpus.data)
    )
    return diagnostics
