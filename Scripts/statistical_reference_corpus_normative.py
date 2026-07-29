"""Independent STD-STAT-001 calculations used to validate expected results."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext
from typing import Any

from Scripts.statistical_reference_corpus_models import ValidationIssue, semantic_issue


@dataclass(frozen=True, slots=True)
class ReliabilityStatistics:
    mean: Decimal
    population_variance: Decimal
    q25: Decimal
    median: Decimal
    q75: Decimal
    slope: Decimal
    cv: Decimal
    iqr_ratio: Decimal
    slope_norm: Decimal


def round_half_up(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def _linear_quantile(sorted_values: list[Decimal], level: Decimal) -> Decimal:
    position = Decimal(len(sorted_values) - 1) * level
    lower_index = int(position)
    weight = position - Decimal(lower_index)
    upper_index = min(lower_index + 1, len(sorted_values) - 1)
    return sorted_values[lower_index] + weight * (
        sorted_values[upper_index] - sorted_values[lower_index]
    )


def reliability_statistics(samples: list[int]) -> ReliabilityStatistics:
    """Derive statistics from a corpus-valid history containing at least two samples."""

    with localcontext() as context:
        context.prec = 50
        values = [Decimal(sample) for sample in samples]
        count = len(values)
        mean = sum(values) / Decimal(count)
        population_variance = (
            sum((value - mean) ** 2 for value in values) / Decimal(count)
        )
        cv = population_variance.sqrt() / mean if mean > 0 else Decimal(0)

        sorted_values = sorted(values)
        q25 = _linear_quantile(sorted_values, Decimal("0.25"))
        median = _linear_quantile(sorted_values, Decimal("0.5"))
        q75 = _linear_quantile(sorted_values, Decimal("0.75"))
        iqr_ratio = (q75 - q25) / median if median > 0 else Decimal(0)

        mean_x = Decimal(count - 1) / Decimal(2)
        denominator = sum((Decimal(index) - mean_x) ** 2 for index in range(count))
        numerator = sum(
            (Decimal(index) - mean_x) * (value - mean)
            for index, value in enumerate(values)
        )
        slope = numerator / denominator
        slope_norm = slope / mean if mean > 0 else Decimal(0)
        return ReliabilityStatistics(
            mean=mean,
            population_variance=population_variance,
            q25=q25,
            median=median,
            q75=q75,
            slope=slope,
            cv=cv,
            iqr_ratio=iqr_ratio,
            slope_norm=slope_norm,
        )


def _reliability_label(
    count: int,
    mean: Decimal,
    cv: Decimal,
    iqr_ratio: Decimal,
    slope_norm: Decimal,
) -> str:
    non_reliable = (
        count < 6
        or mean <= 0
        or cv >= Decimal("1.5")
        or slope_norm <= Decimal("-0.15")
    )
    if non_reliable:
        return "non fiable"
    fragile = (
        cv >= Decimal("1")
        or iqr_ratio >= Decimal("1")
        or abs(slope_norm) >= Decimal("0.1")
    )
    if fragile:
        return "fragile"
    uncertain = (
        cv >= Decimal("0.5")
        or iqr_ratio >= Decimal("0.5")
        or abs(slope_norm) >= Decimal("0.05")
    )
    if uncertain:
        return "incertain"
    return "incertain" if count in {6, 7} else "fiable"


def expected_reliability(samples: list[int]) -> dict[str, Decimal | str | int]:
    statistics = reliability_statistics(samples)
    cv = round_half_up(statistics.cv)
    iqr_ratio = round_half_up(statistics.iqr_ratio)
    slope_norm = round_half_up(statistics.slope_norm)
    return {
        "cv": cv,
        "iqr_ratio": iqr_ratio,
        "slope_norm": slope_norm,
        "label": _reliability_label(
            len(samples),
            statistics.mean,
            cv,
            iqr_ratio,
            slope_norm,
        ),
        "samples_count": len(samples),
    }


def risk_score_issues(
    case_path: str,
    input_value: dict[str, Any],
    result: dict[str, Any],
) -> list[ValidationIssue]:
    percentiles = result.get("result_percentiles")
    mode = input_value.get("mode")
    if not isinstance(percentiles, dict) or mode not in {
        "backlog_to_weeks",
        "weeks_to_items",
    }:
        return []
    p50 = percentiles.get("P50")
    p90 = percentiles.get("P90")
    calculable = type(p50) is int and p50 > 0 and type(p90) is int
    present = "risk_score" in result
    path = f"{case_path}/expected_result/risk_score"
    if calculable != present:
        expectation = "present" if calculable else "absent"
        return [
            semantic_issue(
                path,
                "riskScorePresence",
                f"risk_score must be {expectation} under its P50/P90 guard",
            )
        ]
    if not calculable:
        return []

    numerator = p90 - p50 if mode == "backlog_to_weeks" else p50 - p90
    expected = round_half_up(max(Decimal(0), Decimal(numerator) / Decimal(p50)))
    if Decimal(str(result["risk_score"])) == expected:
        return []
    return [
        semantic_issue(
            path,
            "riskScoreFormula",
            f"risk_score must equal {expected} after normative round half up",
        )
    ]


def _usable_reliability_samples(
    input_value: dict[str, Any],
    reliability: Any,
) -> list[int] | None:
    raw_samples = input_value.get("throughput_samples")
    include_zeros = input_value.get("include_zero_weeks")
    valid_samples = isinstance(raw_samples, list) and all(
        type(sample) is int and sample >= 0 for sample in raw_samples
    )
    if not valid_samples or not isinstance(include_zeros, bool):
        return None
    if not isinstance(reliability, dict):
        return None
    return raw_samples if include_zeros else [sample for sample in raw_samples if sample > 0]


def reliability_issues(
    case_path: str,
    input_value: dict[str, Any],
    result: dict[str, Any],
) -> list[ValidationIssue]:
    reliability = result.get("throughput_reliability")
    samples = _usable_reliability_samples(input_value, reliability)
    if samples is None or len(samples) < 2:
        return []

    expected = expected_reliability(samples)
    issues: list[ValidationIssue] = []
    for key in ("cv", "iqr_ratio", "slope_norm"):
        actual = reliability.get(key)
        if type(actual) not in {int, float} or Decimal(str(actual)) != expected[key]:
            issues.append(
                semantic_issue(
                    f"{case_path}/expected_result/throughput_reliability/{key}",
                    "reliabilityMetric",
                    f"{key} must equal {expected[key]} after normative round half up",
                )
            )
    if reliability.get("label") != expected["label"]:
        issues.append(
            semantic_issue(
                f"{case_path}/expected_result/throughput_reliability/label",
                "reliabilityLabel",
                f"label must equal {expected['label']!r} from normalized metrics",
            )
        )
    return issues
