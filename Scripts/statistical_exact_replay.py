"""Build the deterministic exact-replay evidence for the statistical corpus."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from Scripts.statistical_exact_replay_support import (
    build_proof_coverage,
    interlanguage_comparison,
    interlanguage_diagnostics,
    normative_comparison,
    normative_diagnostics,
)


def _case_map(engine_report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {case["id"]: case for case in engine_report.get("cases", [])}


def _case_from_report(
    engine_report: dict[str, Any],
    cases: dict[str, dict[str, Any]],
    case_id: str,
) -> dict[str, Any] | None:
    case = cases.get(case_id)
    if case is not None:
        return case
    if engine_report.get("status") == "engine_error" and "error" in engine_report:
        return {"status": "engine_error", "error": engine_report["error"]}
    return None


def _batch_geometry(n_sims: int, batch_size: int) -> dict[str, int | bool]:
    batch_count = (n_sims + batch_size - 1) // batch_size
    return {
        "batch_size": batch_size,
        "batch_count": batch_count,
        "last_batch_size": n_sims - ((batch_count - 1) * batch_size),
        "divisible": n_sims % batch_size == 0,
    }


def _case_outcomes(
    typescript: dict[str, Any],
    python_batches: list[dict[str, Any]],
    interlanguage: list[dict[str, Any]],
) -> list[str]:
    statuses = [
        typescript["status"],
        *(entry["status"] for entry in python_batches),
        *(entry["status"] for entry in interlanguage),
    ]
    outcomes = [
        outcome
        for outcome in (
            "engine_error",
            "normative_divergence",
            "interlanguage_divergence",
        )
        if outcome in statuses
    ]
    return outcomes or ["match"]


def _build_typescript_case(
    *,
    case_id: str,
    expected: dict[str, Any],
    typescript_report: dict[str, Any],
    typescript_case_map: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any] | None, dict[str, Any], list[dict[str, Any]]]:
    typescript_case = _case_from_report(
        typescript_report,
        typescript_case_map,
        case_id,
    )
    comparison = normative_comparison(expected, typescript_case)
    diagnostics = normative_diagnostics(
        case_id=case_id,
        engine="typescript",
        batch_size=None,
        expected=expected,
        case_report=typescript_case,
        comparison=comparison,
    )
    return typescript_case, comparison, diagnostics


def _build_python_batch(
    *,
    reference_case: dict[str, Any],
    expected: dict[str, Any],
    batch_size: int,
    engine_report: dict[str, Any],
    case_map: dict[str, dict[str, Any]],
    typescript_case: dict[str, Any] | None,
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    case_id = reference_case["id"]
    python_case = _case_from_report(engine_report, case_map, case_id)
    normative = normative_comparison(expected, python_case)
    python_entry = {
        **_batch_geometry(reference_case["input"]["n_sims"], batch_size),
        **normative,
    }
    diagnostics = normative_diagnostics(
        case_id=case_id,
        engine="python",
        batch_size=batch_size,
        expected=expected,
        case_report=python_case,
        comparison=normative,
    )
    paired = {
        "python_batch_size": batch_size,
        **interlanguage_comparison(python_case, typescript_case),
    }
    diagnostics.extend(
        interlanguage_diagnostics(
            case_id=case_id,
            batch_size=batch_size,
            expected=expected,
            comparison=paired,
        )
    )
    return python_entry, paired, diagnostics


def _build_case_report(
    reference_case: dict[str, Any],
    batch_sizes: tuple[int, ...],
    python_reports: list[dict[str, Any]],
    python_case_maps: list[dict[str, dict[str, Any]]],
    typescript_report: dict[str, Any],
    typescript_case_map: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    case_id = reference_case["id"]
    expected = reference_case["expected_result"]
    typescript_case, typescript, diagnostics = _build_typescript_case(
        case_id=case_id,
        expected=expected,
        typescript_report=typescript_report,
        typescript_case_map=typescript_case_map,
    )
    python_batches: list[dict[str, Any]] = []
    interlanguage: list[dict[str, Any]] = []
    for batch_size, engine_report, case_map in zip(
        batch_sizes,
        python_reports,
        python_case_maps,
    ):
        python_entry, paired, batch_diagnostics = _build_python_batch(
            reference_case=reference_case,
            expected=expected,
            batch_size=batch_size,
            engine_report=engine_report,
            case_map=case_map,
            typescript_case=typescript_case,
        )
        python_batches.append(python_entry)
        interlanguage.append(paired)
        diagnostics.extend(batch_diagnostics)

    return (
        {
            "id": case_id,
            "outcomes": _case_outcomes(typescript, python_batches, interlanguage),
            "typescript": typescript,
            "python_batches": python_batches,
            "interlanguage": interlanguage,
            "batch_independent": all(entry["status"] == "match" for entry in python_batches),
        },
        diagnostics,
    )


def _count_status(entries: Iterable[dict[str, Any]], status: str) -> int:
    return sum(entry["status"] == status for entry in entries)


def _report_status(case_reports: list[dict[str, Any]]) -> str:
    outcomes = [outcome for case in case_reports for outcome in case["outcomes"]]
    if "engine_error" in outcomes:
        return "engine_error"
    if any(outcome != "match" for outcome in outcomes):
        return "divergence"
    return "match"


def _report_summary(
    case_reports: list[dict[str, Any]],
    batch_sizes: tuple[int, ...],
    diagnostic_count: int,
) -> dict[str, int]:
    normative_entries = [case["typescript"] for case in case_reports] + [
        entry for case in case_reports for entry in case["python_batches"]
    ]
    interlanguage_entries = [entry for case in case_reports for entry in case["interlanguage"]]
    return {
        "case_count": len(case_reports),
        "python_case_executions": len(case_reports) * len(batch_sizes),
        "typescript_case_executions": len(case_reports),
        "normative_comparisons": len(normative_entries),
        "normative_matches": _count_status(normative_entries, "match"),
        "interlanguage_comparisons": len(interlanguage_entries),
        "interlanguage_matches": _count_status(interlanguage_entries, "match"),
        "batch_independent_cases": sum(case["batch_independent"] for case in case_reports),
        "engine_error_cases": sum("engine_error" in case["outcomes"] for case in case_reports),
        "diagnostic_count": diagnostic_count,
    }


def _report_context(
    corpus: dict[str, Any],
    batch_sizes: tuple[int, ...],
    case_reports: list[dict[str, Any]],
) -> dict[str, Any]:
    independent_count = sum(case["batch_independent"] for case in case_reports)
    return {
        "report_version": "1.0",
        "proof_kind": "exact_replay",
        "enforcement": "informational",
        "distributional_equivalence": "not_evaluated",
        "status": _report_status(case_reports),
        "comparison_policy": {
            "authority": "versioned_corpus_expected_result",
            "engine_as_oracle": False,
            "field_presence": "exact",
            "primitive_types": "exact_json_types",
            "numeric_tolerance": "none",
            "numeric_rounding": "none",
            "distribution_order": "significant",
            "silent_normalization": False,
        },
        "corpus": {
            "id": corpus["corpus_id"],
            "schema_version": corpus["schema_version"],
            "normative_contract": corpus["normative_contract"],
            "prng_contract": corpus["prng_contract"]["id"],
        },
        "coverage": build_proof_coverage(corpus),
        "batching": {
            "python_batch_sizes": list(batch_sizes),
            "typescript_execution": "simulation_major_sequential",
            "independence_rule": "every_python_batch_matches_corpus",
            "independent": independent_count == len(case_reports),
        },
    }


def build_exact_replay_report(
    corpus: dict[str, Any],
    batch_sizes: tuple[int, ...],
    python_reports: list[dict[str, Any]],
    typescript_report: dict[str, Any],
) -> dict[str, Any]:
    """Compare every engine execution directly with the versioned authority."""

    python_case_maps = [_case_map(report) for report in python_reports]
    typescript_case_map = _case_map(typescript_report)
    case_reports: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []
    for reference_case in corpus["cases"]:
        case_report, case_diagnostics = _build_case_report(
            reference_case,
            batch_sizes,
            python_reports,
            python_case_maps,
            typescript_report,
            typescript_case_map,
        )
        case_reports.append(case_report)
        diagnostics.extend(case_diagnostics)

    return {
        **_report_context(corpus, batch_sizes, case_reports),
        "summary": _report_summary(case_reports, batch_sizes, len(diagnostics)),
        "cases": case_reports,
        "diagnostics": diagnostics,
    }
