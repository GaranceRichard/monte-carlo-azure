"""Build proof-level and counter sections of the consolidated report."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_consolidated_diagnostics import VERDICT_PRIORITY, consolidated_verdict
from Scripts.statistical_consolidated_io import SourceRecord


def _record_status(record: SourceRecord, diagnostics: list[dict[str, Any]]) -> str | None:
    if record.entry["validation_status"] == "valid":
        return None
    classifications = [
        item["classification"]
        for item in diagnostics
        if item["source"] == record.definition.source_id
    ]
    return consolidated_verdict(classifications or ["invalid_evidence"])


def _parity_level(record: SourceRecord, diagnostics: list[dict[str, Any]]) -> str:
    unavailable = _record_status(record, diagnostics)
    if unavailable:
        return unavailable
    summary = record.data["summary"]
    if summary["engine_error_cases"] or summary["fatal_engine_errors"]:
        return "engine_error"
    if summary["normative_divergence_cases"]:
        return "normative_divergence"
    if summary["engine_divergence_cases"]:
        return "interlanguage_divergence"
    return "match"


def _probe_level(record: SourceRecord, diagnostics: list[dict[str, Any]]) -> str:
    unavailable = _record_status(record, diagnostics)
    if unavailable:
        return unavailable
    return {
        "match": "match",
        "divergence": "normative_divergence",
        "engine_error": "engine_error",
    }[record.data["validation_alignment"]["status"]]


def _exact_level(record: SourceRecord, diagnostics: list[dict[str, Any]]) -> str:
    unavailable = _record_status(record, diagnostics)
    if unavailable:
        return unavailable
    outcomes = {value for case in record.data["cases"] for value in case["outcomes"]}
    return next(
        value
        for value in (
            "engine_error",
            "normative_divergence",
            "interlanguage_divergence",
            "match",
        )
        if value in outcomes
    )


def _batch_level(record: SourceRecord, diagnostics: list[dict[str, Any]]) -> str:
    unavailable = _record_status(record, diagnostics)
    if unavailable:
        return unavailable
    statuses = {
        batch["status"] for case in record.data["cases"] for batch in case["python_batches"]
    }
    if "engine_error" in statuses:
        return "engine_error"
    if "normative_divergence" in statuses:
        return "normative_divergence"
    return "match" if record.data["batching"]["independent"] else "invalid_evidence"


def _distribution_level(record: SourceRecord, diagnostics: list[dict[str, Any]]) -> str:
    unavailable = _record_status(record, diagnostics)
    if unavailable:
        return unavailable
    if record.data["status"] == "invalid":
        return record.data["error_classification"] or "invalid_evidence"
    return {
        "match": "match",
        "divergence": "distributional_divergence",
        "inconclusive": "statistically_inconclusive",
    }[record.data["status"]]


def _counters(**values: int) -> list[dict[str, Any]]:
    return [{"id": key, "value": value} for key, value in values.items()]


def _algorithmic_proof(
    record: SourceRecord, summary: dict[str, int], diagnostics: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "id": "algorithmic_normative_compliance",
        "status": _parity_level(record, diagnostics),
        "source": "deterministic_parity",
        "scope": "Versioned corpus expected results in both declared engines.",
        "counters": _counters(
            cases=summary.get("case_count", 0),
            matches=summary.get("matching_cases", 0),
            normative_divergences=summary.get("normative_divergence_cases", 0),
            engine_errors=summary.get("engine_error_cases", 0),
        ),
        "limits": ["Corpus 1.0 only; no claim for inputs or versions outside that corpus."],
    }


def _probe_proof(
    record: SourceRecord, summary: dict[str, int], diagnostics: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "id": "contract_and_probe_validation",
        "status": _probe_level(record, diagnostics),
        "source": "deterministic_parity",
        "scope": "Closed input contract and shared validation probes.",
        "counters": _counters(
            probes=summary.get("probe_count", 0),
            matches=summary.get("matching_probes", 0),
            divergences=summary.get("divergent_probes", 0),
            engine_errors=summary.get("engine_errors", 0),
        ),
        "limits": ["Probe acceptance does not prove statistical equivalence."],
    }


def _exact_proof(
    record: SourceRecord, summary: dict[str, int], diagnostics: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "id": "exact_interlanguage_replay",
        "status": _exact_level(record, diagnostics),
        "source": "exact_replay",
        "scope": "Exact canonical replay against corpus 1.0 and between declared languages.",
        "counters": _counters(
            cases=summary.get("case_count", 0),
            normative_comparisons=summary.get("normative_comparisons", 0),
            normative_matches=summary.get("normative_matches", 0),
            interlanguage_comparisons=summary.get("interlanguage_comparisons", 0),
            interlanguage_matches=summary.get("interlanguage_matches", 0),
        ),
        "limits": ["Exact replay applies only to the corpus and declared versions."],
    }


def _batch_proof(
    record: SourceRecord, summary: dict[str, int], diagnostics: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "id": "batching_independence",
        "status": _batch_level(record, diagnostics),
        "source": "exact_replay",
        "scope": "Python batch sizes declared by exact-replay evidence.",
        "counters": _counters(
            cases=summary.get("case_count", 0),
            independent_cases=summary.get("batch_independent_cases", 0),
            python_executions=summary.get("python_case_executions", 0),
        ),
        "limits": ["Independence is not extrapolated beyond the recorded batch geometries."],
    }


def _distribution_proof(
    record: SourceRecord, summary: dict[str, int], diagnostics: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "id": "distributional_parity",
        "status": _distribution_level(record, diagnostics),
        "source": "distribution_evidence",
        "scope": "Protocol 1.0 scenarios, cohorts, metrics, margins and documented power.",
        "counters": _counters(
            scenarios=summary.get("scenario_count", 0),
            metrics=summary.get("metric_count", 0),
            matches=summary.get("matches", 0),
            divergences=summary.get("divergences", 0),
            inconclusive=summary.get("inconclusive", 0),
        ),
        "limits": [
            "Distributional evidence is not exact replay and is bounded by documented power."
        ],
    }


def build_proof_levels(
    records: dict[str, SourceRecord], diagnostics: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    parity = records["deterministic_parity"]
    exact = records["exact_replay"]
    distribution = records["distribution_evidence"]
    parity_summary = parity.data.get("summary", {}) if isinstance(parity.data, dict) else {}
    probe_summary = (
        parity.data.get("validation_alignment", {}).get("summary", {})
        if isinstance(parity.data, dict)
        else {}
    )
    exact_summary = exact.data.get("summary", {}) if isinstance(exact.data, dict) else {}
    dist_summary = (
        distribution.data.get("summary", {}) if isinstance(distribution.data, dict) else {}
    )
    return [
        _algorithmic_proof(parity, parity_summary, diagnostics),
        _probe_proof(parity, probe_summary, diagnostics),
        _exact_proof(exact, exact_summary, diagnostics),
        _batch_proof(exact, exact_summary, diagnostics),
        _distribution_proof(distribution, dist_summary, diagnostics),
    ]


def report_summary(
    records: dict[str, SourceRecord],
    levels: list[dict[str, Any]],
    diagnostics: list[dict[str, Any]],
    cases: list[dict[str, Any]],
    probes: list[dict[str, Any]],
    scenarios: list[dict[str, Any]],
) -> dict[str, int]:
    return {
        "source_count": len(records),
        "valid_source_count": sum(
            record.entry["validation_status"] == "valid" for record in records.values()
        ),
        "invalid_source_count": sum(
            record.entry["validation_status"] != "valid" for record in records.values()
        ),
        "proof_level_count": len(levels),
        "matching_proof_level_count": sum(level["status"] == "match" for level in levels),
        "divergent_proof_level_count": sum("divergence" in level["status"] for level in levels),
        "inconclusive_proof_level_count": sum(
            level["status"] == "statistically_inconclusive" for level in levels
        ),
        "unavailable_proof_level_count": sum(
            level["status"] in VERDICT_PRIORITY[:5] for level in levels
        ),
        "normative_case_count": len(cases),
        "validation_probe_count": len(probes),
        "distribution_scenario_count": len(scenarios),
        "distribution_metric_count": sum(item["metric_count"] for item in scenarios),
        "diagnostic_count": len(diagnostics),
    }
