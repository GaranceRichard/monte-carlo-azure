"""PBI 2.14 scope invariants for the statistical reference corpus."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_reference_corpus_invariants import (
    cases_by_id,
    validate_pbi_210_scope,
)
from Scripts.statistical_reference_corpus_models import ValidationIssue, semantic_issue

PBI_214_CASE_IDS = frozenset(
    {
        "items-zero-weeks-excluded",
        "weeks-zero-weeks-included-no-censorship",
        "weeks-exact-horizon-completion",
        "weeks-partial-censorship",
        "weeks-total-censorship",
        "risk-p50-zero-absent",
    }
)

_EXPECTED_RISK_SCORES: dict[str, float | None] = {
    "items-zero-weeks-excluded": 0.6667,
    "weeks-zero-weeks-included-no-censorship": 1.0,
    "weeks-exact-horizon-completion": 0.0,
    "weeks-partial-censorship": None,
    "weeks-total-censorship": None,
    "risk-p50-zero-absent": None,
}


def _risk_score_issues(cases: dict[str, dict[str, Any]]) -> list[ValidationIssue]:
    issues = []
    for case_id, expected in _EXPECTED_RISK_SCORES.items():
        result = cases[case_id].get("expected_result")
        if not isinstance(result, dict):
            issues.append(
                semantic_issue(
                    "/cases",
                    "pbi214Scope",
                    f"{case_id} must expose an object expected_result",
                )
            )
            continue
        is_present = "risk_score" in result
        if (expected is None and is_present) or (
            expected is not None and result.get("risk_score") != expected
        ):
            issues.append(
                semantic_issue(
                    "/cases",
                    "pbi214Scope",
                    f"{case_id} must preserve the authoritative Risk Score presence and value",
                )
            )
    return issues


def validate_pbi_214_scope(instance: Any) -> list[ValidationIssue]:
    if not isinstance(instance, dict):
        return [semantic_issue("/", "pbi214Scope", "the PBI 2.14 corpus must be a JSON object")]
    cases = cases_by_id(instance)
    missing_ids = sorted(PBI_214_CASE_IDS.difference(cases))
    if missing_ids:
        return [
            semantic_issue(
                "/cases",
                "pbi214Scope",
                f"missing required PBI 2.14 case: {case_id}",
            )
            for case_id in missing_ids
        ]

    issues = validate_pbi_210_scope(instance)
    issues.extend(_risk_score_issues(cases))
    zero_case = cases["risk-p50-zero-absent"].get("expected_result")
    if not isinstance(zero_case, dict) or zero_case.get("result_percentiles") != {
        "P50": 0,
        "P70": 0,
        "P90": 0,
    }:
        issues.append(
            semantic_issue(
                "/cases",
                "pbi214Scope",
                "risk-p50-zero-absent must prove the strict positive P50 guard",
            )
        )
    return issues
