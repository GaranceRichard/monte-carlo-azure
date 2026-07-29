"""PBI 2.15 scope invariants for throughput reliability."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_reference_corpus_models import ValidationIssue, semantic_issue

PBI_215_CASE_IDS = frozenset(
    {
        "items-zero-weeks-excluded",
        "weeks-exact-horizon-completion",
        "weeks-partial-censorship",
        "risk-p50-zero-absent",
        "reliability-slope-005-rounded",
        "reliability-slope-010-rounded",
        "reliability-slope-minus-015-rounded",
        "reliability-cv-050-rounded",
        "reliability-cv-100-rounded",
        "reliability-cv-150-rounded",
        "reliability-iqr-050-rounded",
        "reliability-seven-observations-degraded",
    }
)

_EXPECTED_RELIABILITY: dict[str, dict[str, float | int | str]] = {
    "items-zero-weeks-excluded": {
        "cv": 0.488,
        "iqr_ratio": 0.7143,
        "slope_norm": 0.2857,
        "label": "fragile",
        "samples_count": 6,
    },
    "weeks-exact-horizon-completion": {
        "cv": 0,
        "iqr_ratio": 0,
        "slope_norm": 0,
        "label": "incertain",
        "samples_count": 6,
    },
    "weeks-partial-censorship": {
        "cv": 0.2294,
        "iqr_ratio": 0,
        "slope_norm": 0.015,
        "label": "fiable",
        "samples_count": 20,
    },
    "risk-p50-zero-absent": {
        "cv": 0,
        "iqr_ratio": 0,
        "slope_norm": 0,
        "label": "non fiable",
        "samples_count": 6,
    },
    "reliability-slope-005-rounded": {
        "cv": 0.1291,
        "iqr_ratio": 0.2,
        "slope_norm": 0.05,
        "label": "incertain",
        "samples_count": 9,
    },
    "reliability-slope-010-rounded": {
        "cv": 0.2582,
        "iqr_ratio": 0.4,
        "slope_norm": 0.1,
        "label": "fragile",
        "samples_count": 9,
    },
    "reliability-slope-minus-015-rounded": {
        "cv": 0.3873,
        "iqr_ratio": 0.6,
        "slope_norm": -0.15,
        "label": "non fiable",
        "samples_count": 9,
    },
    "reliability-cv-050-rounded": {
        "cv": 0.5,
        "iqr_ratio": 0,
        "slope_norm": 0,
        "label": "incertain",
        "samples_count": 10,
    },
    "reliability-cv-100-rounded": {
        "cv": 1,
        "iqr_ratio": 0,
        "slope_norm": 0,
        "label": "fragile",
        "samples_count": 10,
    },
    "reliability-cv-150-rounded": {
        "cv": 1.5,
        "iqr_ratio": 0,
        "slope_norm": 0,
        "label": "non fiable",
        "samples_count": 10,
    },
    "reliability-iqr-050-rounded": {
        "cv": 0.2041,
        "iqr_ratio": 0.5,
        "slope_norm": 0.0083,
        "label": "incertain",
        "samples_count": 9,
    },
    "reliability-seven-observations-degraded": {
        "cv": 0.0756,
        "iqr_ratio": 0.1,
        "slope_norm": 0.0357,
        "label": "incertain",
        "samples_count": 7,
    },
}

_SEVEN_OBSERVATION_REPLAY = {
    "proof_level": "replay",
    "input": {
        "throughput_samples": [9, 9, 10, 10, 10, 11, 11],
        "include_zero_weeks": False,
        "mode": "weeks_to_items",
        "target_weeks": 1,
        "n_sims": 1000,
    },
    "seed": 0,
    "result_percentiles": {"P50": 10, "P70": 10, "P90": 9},
    "risk_score": 0.1,
    "result_distribution": [
        {"x": 9, "count": 275},
        {"x": 10, "count": 441},
        {"x": 11, "count": 284},
    ],
}


def _cases_by_id(instance: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        case["id"]: case
        for case in instance.get("cases", [])
        if isinstance(case, dict) and isinstance(case.get("id"), str)
    }


def _seven_observation_replay(case: dict[str, Any]) -> dict[str, Any]:
    result = case.get("expected_result")
    if not isinstance(result, dict):
        result = {}
    return {
        "proof_level": case.get("proof_level"),
        "input": case.get("input"),
        "seed": case.get("seed"),
        "result_percentiles": result.get("result_percentiles"),
        "risk_score": result.get("risk_score"),
        "result_distribution": result.get("result_distribution"),
    }


def _observed_labels(reliability_by_id: dict[str, Any]) -> set[Any]:
    return {
        reliability.get("label")
        for reliability in reliability_by_id.values()
        if isinstance(reliability, dict)
    }


def validate_pbi_215_scope(instance: Any) -> list[ValidationIssue]:
    if not isinstance(instance, dict):
        return [semantic_issue("/", "pbi215Scope", "the PBI 2.15 corpus must be a JSON object")]
    cases = _cases_by_id(instance)
    missing_ids = sorted(PBI_215_CASE_IDS.difference(cases))
    if missing_ids:
        return [
            semantic_issue(
                "/cases",
                "pbi215Scope",
                f"missing required PBI 2.15 case: {case_id}",
            )
            for case_id in missing_ids
        ]

    issues = []
    observed_reliability: dict[str, Any] = {}
    for case_id, expected in _EXPECTED_RELIABILITY.items():
        result = cases[case_id].get("expected_result")
        reliability = result.get("throughput_reliability") if isinstance(result, dict) else None
        observed_reliability[case_id] = reliability
        if reliability != expected:
            issues.append(
                semantic_issue(
                    "/cases",
                    "pbi215Scope",
                    f"{case_id} must preserve its exact normative reliability metrics and label",
                )
            )

    seven_case = cases["reliability-seven-observations-degraded"]
    if _seven_observation_replay(seven_case) != _SEVEN_OBSERVATION_REPLAY:
        issues.append(
            semantic_issue(
                "/cases",
                "pbi215Scope",
                "the seven-observation case must preserve its independently derived replay",
            )
        )
    labels = _observed_labels(observed_reliability)
    if labels != {"fiable", "incertain", "fragile", "non fiable"}:
        issues.append(
            semantic_issue(
                "/cases",
                "pbi215Scope",
                "the PBI 2.15 proof must retain all four normative labels",
            )
        )
    return issues
