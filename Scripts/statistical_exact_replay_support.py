"""Independent coverage and diagnostic helpers for exact statistical replay."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from Scripts.statistical_parity_report import canonical_json_type, compare_canonical

AGGREGATED_HISTOGRAM_CASE_IDS = frozenset(
    {
        "histogram-aggregated-contiguous-101",
        "histogram-aggregated-discontinuous",
    }
)

REQUIRED_COVERAGE = {
    "modes": ("backlog_to_weeks", "weeks_to_items"),
    "censorship": ("none", "partial", "total"),
    "percentiles": ("complete", "partial", "absent"),
    "risk_score": ("present", "absent"),
    "reliability_labels": ("fiable", "incertain", "fragile", "non fiable"),
    "histograms": ("exact", "aggregated"),
}


def _unique_in_order(values: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(values))


def _censorship_coverage(result: dict[str, Any]) -> str:
    summary = result.get("completion_summary")
    if not isinstance(summary, dict):
        return "not_applicable"
    if summary["censored_count"] == 0:
        return "none"
    if summary["completed_count"] == 0:
        return "total"
    return "partial"


def _percentile_coverage(result: dict[str, Any]) -> str:
    count = len(result["result_percentiles"])
    if count == 0:
        return "absent"
    return "complete" if count == 3 else "partial"


def build_proof_coverage(corpus: dict[str, Any]) -> dict[str, list[str]]:
    """Describe mandatory dimensions from corpus data, without engine output."""

    cases = corpus["cases"]
    results = [case["expected_result"] for case in cases]
    return {
        "modes": _unique_in_order(case["input"]["mode"] for case in cases),
        "censorship": _unique_in_order(_censorship_coverage(result) for result in results),
        "percentiles": _unique_in_order(_percentile_coverage(result) for result in results),
        "risk_score": _unique_in_order(
            "present" if "risk_score" in result else "absent" for result in results
        ),
        "reliability_labels": _unique_in_order(
            result["throughput_reliability"]["label"] for result in results
        ),
        "histograms": _unique_in_order(
            "aggregated" if case["id"] in AGGREGATED_HISTOGRAM_CASE_IDS else "exact"
            for case in cases
        ),
    }


def proof_coverage_issues(coverage: dict[str, list[str]]) -> list[str]:
    """Return missing mandatory proof dimensions in a deterministic order."""

    issues: list[str] = []
    for dimension, required_values in REQUIRED_COVERAGE.items():
        missing = [value for value in required_values if value not in coverage[dimension]]
        if missing:
            issues.append(f"Couverture de rejeu incomplète pour {dimension}: {', '.join(missing)}.")
    return issues


def _present_state(value: Any) -> dict[str, Any]:
    return {
        "present": True,
        "type": canonical_json_type(value),
        "value": value,
    }


def _absent_state() -> dict[str, bool]:
    return {"present": False}


def state_at_pointer(value: Any, path: str) -> dict[str, Any]:
    """Return presence, JSON type and value at a comparator JSON Pointer."""

    if path in {"", "/"}:
        return _present_state(value)
    current = value
    for raw_token in path.removeprefix("/").split("/"):
        token = raw_token.replace("~1", "/").replace("~0", "~")
        if isinstance(current, dict) and token in current:
            current = current[token]
            continue
        if isinstance(current, list) and token.isdecimal():
            index = int(token)
            if index < len(current):
                current = current[index]
                continue
        return _absent_state()
    return _present_state(current)


def _missing_case_error() -> dict[str, str]:
    return {
        "type": "MissingCaseReport",
        "message": "engine produced no case report",
    }


def normative_comparison(
    expected: dict[str, Any],
    case_report: dict[str, Any] | None,
) -> dict[str, Any]:
    if not case_report or case_report.get("status") != "ok":
        return {
            "status": "engine_error",
            "error": (case_report or {}).get("error", _missing_case_error()),
        }
    differences = compare_canonical(expected, case_report["result"])
    return {
        "status": "match" if not differences else "normative_divergence",
        "differences": differences,
    }


def _paired_differences(
    python_result: dict[str, Any],
    typescript_result: dict[str, Any],
) -> list[dict[str, Any]]:
    differences = compare_canonical(python_result, typescript_result)
    return [
        {
            "path": difference["path"],
            "kind": difference["kind"],
            "python": state_at_pointer(python_result, difference["path"]),
            "typescript": state_at_pointer(typescript_result, difference["path"]),
        }
        for difference in differences
    ]


def interlanguage_comparison(
    python_case: dict[str, Any] | None,
    typescript_case: dict[str, Any] | None,
) -> dict[str, Any]:
    comparable = (
        python_case is not None
        and typescript_case is not None
        and python_case.get("status") == "ok"
        and typescript_case.get("status") == "ok"
    )
    if not comparable:
        return {"status": "not_compared", "differences": []}
    differences = _paired_differences(
        python_case["result"],
        typescript_case["result"],
    )
    return {
        "status": "match" if not differences else "interlanguage_divergence",
        "differences": differences,
    }


def normative_diagnostics(
    *,
    case_id: str,
    engine: str,
    batch_size: int | None,
    expected: dict[str, Any],
    case_report: dict[str, Any] | None,
    comparison: dict[str, Any],
) -> list[dict[str, Any]]:
    if comparison["status"] == "engine_error":
        return [
            {
                "case_id": case_id,
                "engine": engine,
                "batch_size": batch_size,
                "comparison": "normative",
                "classification": "engine_error",
                "path": "/",
                "kind": "engine_error",
                "expected": _present_state(expected),
                "actual": {
                    "present": False,
                    "error": comparison["error"],
                },
            }
        ]
    if comparison["status"] == "match":
        return []
    actual = case_report["result"]
    return [
        {
            "case_id": case_id,
            "engine": engine,
            "batch_size": batch_size,
            "comparison": "normative",
            "classification": "normative_divergence",
            "path": difference["path"],
            "kind": difference["kind"],
            "expected": state_at_pointer(expected, difference["path"]),
            "actual": state_at_pointer(actual, difference["path"]),
        }
        for difference in comparison["differences"]
    ]


def interlanguage_diagnostics(
    *,
    case_id: str,
    batch_size: int,
    expected: dict[str, Any],
    comparison: dict[str, Any],
) -> list[dict[str, Any]]:
    if comparison["status"] != "interlanguage_divergence":
        return []
    return [
        {
            "case_id": case_id,
            "engine": "python_vs_typescript",
            "batch_size": batch_size,
            "comparison": "interlanguage",
            "classification": "interlanguage_divergence",
            "path": difference["path"],
            "kind": difference["kind"],
            "expected": state_at_pointer(expected, difference["path"]),
            "actual": {
                "python": difference["python"],
                "typescript": difference["typescript"],
            },
        }
        for difference in comparison["differences"]
    ]
