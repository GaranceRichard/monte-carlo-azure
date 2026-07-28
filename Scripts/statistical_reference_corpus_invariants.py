"""Cross-field and PBI 2.10 invariants for the statistical reference corpus."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any, Callable


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    instance_path: str
    keyword: str
    message: str
    schema_path: str

    def render(self, source: Path) -> str:
        return (
            f"{source.as_posix()}:{self.instance_path}: [{self.keyword}] {self.message} "
            f"(schema {self.schema_path})"
        )


@dataclass(frozen=True, slots=True)
class InputRejectionProbe:
    probe_id: str
    source_case_id: str
    operation: str
    path: tuple[str | int, ...]
    value: Any
    expected_instance_path: str
    expected_keyword: str


PBI_210_CASE_IDS = frozenset(
    {
        "items-zero-weeks-excluded",
        "weeks-zero-weeks-included-no-censorship",
        "weeks-exact-horizon-completion",
        "weeks-partial-censorship",
        "weeks-total-censorship",
    }
)


def semantic_issue(instance_path: str, keyword: str, message: str) -> ValidationIssue:
    return ValidationIssue(
        instance_path=instance_path,
        keyword=keyword,
        message=message,
        schema_path="/$defs/expectedResult/$comment",
    )


def _seed_and_sample_issues(
    case_path: str,
    case: dict[str, Any],
    input_value: dict[str, Any],
    result: dict[str, Any],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if result.get("seed") != case.get("seed"):
        issues.append(
            semantic_issue(
                f"{case_path}/expected_result/seed",
                "caseSeedEquality",
                "expected_result.seed must equal case.seed",
            )
        )

    raw_samples = input_value.get("throughput_samples")
    include_zeros = input_value.get("include_zero_weeks")
    if isinstance(raw_samples, list) and isinstance(include_zeros, bool):
        usable_samples = (
            raw_samples
            if include_zeros
            else [
                sample
                for sample in raw_samples
                if isinstance(sample, int) and not isinstance(sample, bool) and sample > 0
            ]
        )
        if result.get("samples_count") != len(usable_samples):
            issues.append(
                semantic_issue(
                    f"{case_path}/expected_result/samples_count",
                    "usableSamplesCount",
                    "samples_count must equal the usable sample count after the zero policy",
                )
            )

    reliability = result.get("throughput_reliability")
    if isinstance(reliability, dict) and reliability.get("samples_count") != result.get(
        "samples_count"
    ):
        issues.append(
            semantic_issue(
                f"{case_path}/expected_result/throughput_reliability/samples_count",
                "resultSamplesCountEquality",
                "throughput reliability and result samples_count must be equal",
            )
        )
    return issues


def _percentile_issues(
    case_path: str,
    input_value: dict[str, Any],
    result: dict[str, Any],
) -> list[ValidationIssue]:
    mode = input_value.get("mode")
    percentiles = result.get("result_percentiles")
    if not isinstance(percentiles, dict) or mode not in {
        "backlog_to_weeks",
        "weeks_to_items",
    }:
        return []
    present_values = [percentiles[key] for key in ("P50", "P70", "P90") if key in percentiles]
    ordered_values = (
        sorted(present_values)
        if mode == "backlog_to_weeks"
        else sorted(present_values, reverse=True)
    )
    if present_values == ordered_values:
        return []
    return [
        semantic_issue(
            f"{case_path}/expected_result/result_percentiles",
            "percentileOrder",
            f"percentiles are not ordered for mode {mode}",
        )
    ]


def _distribution_state(
    case_path: str,
    result: dict[str, Any],
) -> tuple[list[ValidationIssue], int | None]:
    distribution = result.get("result_distribution")
    if not isinstance(distribution, list) or not all(
        isinstance(bucket, dict)
        and type(bucket.get("x")) is int
        and type(bucket.get("count")) is int
        for bucket in distribution
    ):
        return [], None
    x_values = [bucket["x"] for bucket in distribution]
    issues = []
    if any(left >= right for left, right in zip(x_values, x_values[1:])):
        issues.append(
            semantic_issue(
                f"{case_path}/expected_result/result_distribution",
                "histogramOrder",
                "histogram x values must be strictly increasing",
            )
        )
    return issues, sum(bucket["count"] for bucket in distribution)


def _completion_state(
    case_path: str,
    input_value: dict[str, Any],
    result: dict[str, Any],
) -> tuple[list[ValidationIssue], int | None]:
    n_sims = input_value.get("n_sims")
    mode = input_value.get("mode")
    expected_mass = n_sims if mode == "weeks_to_items" and type(n_sims) is int else None
    completion = result.get("completion_summary")
    if not isinstance(completion, dict) or type(n_sims) is not int or n_sims <= 0:
        return [], expected_mass

    completed_count = completion.get("completed_count")
    censored_count = completion.get("censored_count")
    if type(completed_count) is not int or type(censored_count) is not int:
        return [], expected_mass

    issues = []
    if completed_count + censored_count != n_sims:
        issues.append(
            semantic_issue(
                f"{case_path}/expected_result/completion_summary",
                "completionMass",
                "completion counts must sum to n_sims",
            )
        )
    expected_rate = (Decimal(censored_count) / Decimal(n_sims)).quantize(
        Decimal("0.0001"),
        rounding=ROUND_HALF_UP,
    )
    if Decimal(str(completion.get("censored_rate"))) != expected_rate:
        issues.append(
            semantic_issue(
                f"{case_path}/expected_result/completion_summary/censored_rate",
                "censoredRate",
                "censored_rate must equal censored_count / n_sims rounded half up",
            )
        )
    return issues, completed_count


def validate_case_semantics(case: dict[str, Any], index: int) -> list[ValidationIssue]:
    input_value = case.get("input")
    result = case.get("expected_result")
    if not isinstance(input_value, dict) or not isinstance(result, dict):
        return []

    case_path = f"/cases/{index}"
    issues = _seed_and_sample_issues(case_path, case, input_value, result)
    issues.extend(_percentile_issues(case_path, input_value, result))
    distribution_issues, distribution_mass = _distribution_state(case_path, result)
    completion_issues, expected_mass = _completion_state(case_path, input_value, result)
    issues.extend(distribution_issues)
    issues.extend(completion_issues)
    if (
        distribution_mass is not None
        and expected_mass is not None
        and distribution_mass != expected_mass
    ):
        issues.append(
            semantic_issue(
                f"{case_path}/expected_result/result_distribution",
                "histogramMass",
                f"histogram mass {distribution_mass} must equal {expected_mass}",
            )
        )
    return issues


def cases_by_id(instance: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        case["id"]: case
        for case in instance.get("cases", [])
        if isinstance(case, dict) and isinstance(case.get("id"), str)
    }


def _items_scope(case: dict[str, Any]) -> bool:
    return (
        case["input"].get("mode") == "weeks_to_items"
        and case["input"].get("include_zero_weeks") is False
        and case["expected_result"].get("samples_count") == 6
        and case["expected_result"].get("result_percentiles") == {"P50": 3, "P70": 2, "P90": 1}
    )


def _no_censorship_scope(case: dict[str, Any]) -> bool:
    return (
        case["input"].get("mode") == "backlog_to_weeks"
        and case["input"].get("include_zero_weeks") is True
        and case["expected_result"].get("result_percentiles") == {"P50": 2, "P70": 3, "P90": 4}
        and case["expected_result"].get("completion_summary", {}).get("censored_count") == 0
    )


def _exact_horizon_scope(case: dict[str, Any]) -> bool:
    return (
        case["input"].get("backlog_size") == 521
        and case["expected_result"].get("result_distribution") == [{"x": 521, "count": 1000}]
        and case["expected_result"].get("completion_summary", {}).get("censored_count") == 0
    )


def _partial_censorship_scope(case: dict[str, Any]) -> bool:
    return case["expected_result"].get("completion_summary") == {
        "completed_count": 748,
        "censored_count": 252,
        "censored_rate": 0.252,
        "horizon_weeks": 521,
    } and case["expected_result"].get("result_percentiles") == {
        "P50": 518,
        "P70": 521,
    }


def _total_censorship_scope(case: dict[str, Any]) -> bool:
    return (
        case["expected_result"].get("completion_summary", {}).get("completed_count") == 0
        and case["expected_result"].get("result_percentiles") == {}
        and case["expected_result"].get("result_distribution") == []
    )


_SCOPE_CHECKS: tuple[tuple[str, Callable[[dict[str, Any]], bool], str], ...] = (
    (
        "items-zero-weeks-excluded",
        _items_scope,
        "items case must prove zero exclusion and ordered survival percentiles",
    ),
    (
        "weeks-zero-weeks-included-no-censorship",
        _no_censorship_scope,
        "no-censorship case must prove zero retention and increasing percentiles",
    ),
    (
        "weeks-exact-horizon-completion",
        _exact_horizon_scope,
        "exact-horizon completion must remain distinct from censorship",
    ),
    (
        "weeks-partial-censorship",
        _partial_censorship_scope,
        "partial censorship must identify P50 and P70 while omitting P90",
    ),
    (
        "weeks-total-censorship",
        _total_censorship_scope,
        "total censorship must omit every percentile and completed duration",
    ),
)


def validate_pbi_210_scope(instance: Any) -> list[ValidationIssue]:
    if not isinstance(instance, dict):
        return [semantic_issue("/", "pbi210Scope", "the PBI 2.10 corpus must be a JSON object")]
    cases = cases_by_id(instance)
    missing_ids = sorted(PBI_210_CASE_IDS.difference(cases))
    if missing_ids:
        return [
            semantic_issue(
                "/cases",
                "pbi210Scope",
                f"missing required PBI 2.10 case: {case_id}",
            )
            for case_id in missing_ids
        ]
    return [
        semantic_issue("/cases", "pbi210Scope", message)
        for case_id, check, message in _SCOPE_CHECKS
        if not check(cases[case_id])
    ]


def apply_probe(case: dict[str, Any], probe: InputRejectionProbe) -> None:
    target: Any = case
    for part in probe.path[:-1]:
        target = target[part]
    final_part = probe.path[-1]
    if probe.operation == "remove":
        del target[final_part]
    else:
        target[final_part] = probe.value
