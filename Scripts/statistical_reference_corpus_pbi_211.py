"""Frozen PBI 2.11 scope for the statistical reference corpus."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_reference_corpus_models import ValidationIssue, semantic_issue

PBI_211_CASE_IDS = frozenset(
    {
        "risk-p50-zero-absent",
        "reliability-slope-005-rounded",
        "reliability-slope-010-rounded",
        "reliability-slope-minus-015-rounded",
        "reliability-cv-050-rounded",
        "reliability-cv-100-rounded",
        "reliability-cv-150-rounded",
        "reliability-iqr-050-rounded",
        "histogram-aggregated-contiguous-101",
        "histogram-aggregated-discontinuous",
    }
)

_INPUT_SAMPLES: dict[str, tuple[int, ...]] = {
    "risk-p50-zero-absent": (0,) * 6,
    "reliability-slope-005-rounded": tuple(range(16, 25)),
    "reliability-slope-010-rounded": tuple(range(12, 29, 2)),
    "reliability-slope-minus-015-rounded": tuple(range(32, 7, -3)),
    "reliability-cv-050-rounded": (8, 3, 3, 3, 3, 3, 3, 3, 3, 8),
    "reliability-cv-100-rounded": (6, 1, 1, 1, 1, 1, 1, 1, 1, 6),
    "reliability-cv-150-rounded": (16, 1, 1, 1, 1, 1, 1, 1, 1, 16),
    "reliability-iqr-050-rounded": (3, 4, 5, 5, 4, 3, 3, 4, 5),
    "histogram-aggregated-contiguous-101": tuple(range(101)),
    "histogram-aggregated-discontinuous": (*range(100), 10000),
}

_PERCENTILES: dict[str, dict[str, int]] = {
    "risk-p50-zero-absent": {"P50": 0, "P70": 0, "P90": 0},
    "reliability-slope-005-rounded": {"P50": 20, "P70": 18, "P90": 16},
    "reliability-slope-010-rounded": {"P50": 20, "P70": 16, "P90": 12},
    "reliability-slope-minus-015-rounded": {"P50": 20, "P70": 14, "P90": 8},
    "reliability-cv-050-rounded": {"P50": 3, "P70": 3, "P90": 3},
    "reliability-cv-100-rounded": {"P50": 1, "P70": 1, "P90": 1},
    "reliability-cv-150-rounded": {"P50": 1, "P70": 1, "P90": 1},
    "reliability-iqr-050-rounded": {"P50": 4, "P70": 3, "P90": 3},
    "histogram-aggregated-contiguous-101": {"P50": 49, "P70": 31, "P90": 10},
    "histogram-aggregated-discontinuous": {"P50": 49, "P70": 31, "P90": 10},
}

_NINE_SAMPLE_COUNTS = (107, 109, 109, 115, 130, 105, 95, 126, 104)
_CONTIGUOUS_101_COUNTS = (
    19,
    20,
    14,
    17,
    26,
    14,
    18,
    19,
    23,
    22,
    18,
    24,
    20,
    15,
    19,
    19,
    22,
    23,
    19,
    17,
    22,
    21,
    21,
    24,
    29,
    14,
    27,
    22,
    19,
    21,
    16,
    17,
    25,
    17,
    13,
    19,
    19,
    16,
    13,
    32,
    15,
    23,
    17,
    24,
    26,
    17,
    18,
    24,
    20,
    15,
    6,
)


def _buckets(x_values: tuple[int, ...], counts: tuple[int, ...]) -> list[dict[str, int]]:
    return [{"x": x, "count": count} for x, count in zip(x_values, counts)]


_DISTRIBUTIONS: dict[str, list[dict[str, int]]] = {
    "risk-p50-zero-absent": [{"x": 0, "count": 1000}],
    "reliability-slope-005-rounded": _buckets(
        tuple(range(16, 25)), _NINE_SAMPLE_COUNTS
    ),
    "reliability-slope-010-rounded": _buckets(
        tuple(range(12, 29, 2)), _NINE_SAMPLE_COUNTS
    ),
    "reliability-slope-minus-015-rounded": _buckets(
        tuple(range(8, 33, 3)), tuple(reversed(_NINE_SAMPLE_COUNTS))
    ),
    "reliability-cv-050-rounded": [{"x": 3, "count": 806}, {"x": 8, "count": 194}],
    "reliability-cv-100-rounded": [{"x": 1, "count": 806}, {"x": 6, "count": 194}],
    "reliability-cv-150-rounded": [{"x": 1, "count": 806}, {"x": 16, "count": 194}],
    "reliability-iqr-050-rounded": [
        {"x": 3, "count": 307},
        {"x": 4, "count": 365},
        {"x": 5, "count": 328},
    ],
    "histogram-aggregated-contiguous-101": _buckets(
        tuple(range(0, 101, 2)), _CONTIGUOUS_101_COUNTS
    ),
    "histogram-aggregated-discontinuous": [
        {"x": 50, "count": 994},
        {"x": 9999, "count": 6},
    ],
}


def _cases_by_id(instance: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        case["id"]: case
        for case in instance.get("cases", [])
        if isinstance(case, dict) and isinstance(case.get("id"), str)
    }


def _expected_case_core(case_id: str) -> dict[str, Any]:
    include_zeros = case_id in {
        "risk-p50-zero-absent",
        "histogram-aggregated-contiguous-101",
        "histogram-aggregated-discontinuous",
    }
    return {
        "proof_level": "deterministic" if case_id == "risk-p50-zero-absent" else "replay",
        "input": {
            "throughput_samples": list(_INPUT_SAMPLES[case_id]),
            "include_zero_weeks": include_zeros,
            "mode": "weeks_to_items",
            "target_weeks": 1,
            "n_sims": 1000,
        },
        "seed": 0,
        "result_kind": "items",
        "result_percentiles": _PERCENTILES[case_id],
        "result_distribution": _DISTRIBUTIONS[case_id],
        "samples_count": len(_INPUT_SAMPLES[case_id]),
        "result_seed": 0,
    }


def _actual_case_core(case: dict[str, Any]) -> dict[str, Any]:
    result = case.get("expected_result")
    if not isinstance(result, dict):
        result = {}
    return {
        "proof_level": case.get("proof_level"),
        "input": case.get("input"),
        "seed": case.get("seed"),
        "result_kind": result.get("result_kind"),
        "result_percentiles": result.get("result_percentiles"),
        "result_distribution": result.get("result_distribution"),
        "samples_count": result.get("samples_count"),
        "result_seed": result.get("seed"),
    }


def validate_pbi_211_scope(instance: Any) -> list[ValidationIssue]:
    if not isinstance(instance, dict):
        return [semantic_issue("/", "pbi211Scope", "the PBI 2.11 corpus must be a JSON object")]
    cases = _cases_by_id(instance)
    required_ids = PBI_211_CASE_IDS | {
        "items-zero-weeks-excluded",
        "weeks-partial-censorship",
    }
    missing_ids = sorted(required_ids.difference(cases))
    if missing_ids:
        return [
            semantic_issue(
                "/cases",
                "pbi211Scope",
                f"missing required PBI 2.11 case or preserved proof: {case_id}",
            )
            for case_id in missing_ids
        ]

    issues = [
        semantic_issue(
            "/cases",
            "pbi211Scope",
            f"{case_id} must preserve its discriminating PBI 2.11 input and expected replay",
        )
        for case_id in sorted(PBI_211_CASE_IDS)
        if _actual_case_core(cases[case_id]) != _expected_case_core(case_id)
    ]
    issues.extend(_preserved_risk_proof_issues(cases))
    return issues


def _preserved_risk_proof_issues(
    cases: dict[str, dict[str, Any]],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    risk_present = cases["items-zero-weeks-excluded"]["expected_result"]
    exact_distribution = _buckets(
        (1, 2, 3, 4, 5, 6),
        (157, 168, 186, 164, 160, 165),
    )
    if (
        risk_present.get("risk_score") != 0.6667
        or risk_present.get("result_distribution") != exact_distribution
    ):
        issues.append(
            semantic_issue(
                "/cases",
                "pbi211Scope",
                "the preserved exact histogram and 0.6667 Risk Score proof must remain exact",
            )
        )
    risk_absent = cases["weeks-partial-censorship"]["expected_result"]
    if "P90" in risk_absent.get("result_percentiles", {}) or "risk_score" in risk_absent:
        issues.append(
            semantic_issue(
                "/cases",
                "pbi211Scope",
                "the preserved censored P90 proof must omit risk_score",
            )
        )
    return issues
