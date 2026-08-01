"""Extract and compare the metrics declared by the distributional protocol."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_distribution_statistics import (
    compare_count_blocks,
    compare_rate_blocks,
    exact_metric,
)


def scenario_results(report: dict[str, Any], scenario_id: str) -> list[dict[str, Any]]:
    prefix = f"{scenario_id}:"
    return [case["result"] for case in report["cases"] if case["id"].startswith(prefix)]


def outcome_block(result: dict[str, Any]) -> dict[float, int]:
    block = {float(bucket["x"]): bucket["count"] for bucket in result["result_distribution"]}
    completion = result.get("completion_summary")
    if completion is not None and completion["censored_count"]:
        censor_state = float(completion["horizon_weeks"] + 1)
        block[censor_state] = completion["censored_count"]
    return block


def presence_blocks(
    results: list[dict[str, Any]], field: str, nested: str | None = None,
) -> list[tuple[int, int]]:
    return [
        (int((nested in result.get(field, {})) if nested else (field in result)), 1)
        for result in results
    ]


def value_blocks(
    results: list[dict[str, Any]], field: str, nested: str | None = None,
) -> list[dict[float, int]]:
    values: list[dict[float, int]] = []
    for result in results:
        container = result.get(field, {}) if nested else result
        key = nested or field
        if key in container:
            values.append({float(container[key]): 1})
    return values


def insufficient_metric(
    metric_id: str, left_size: int, right_size: int, margin: float,
) -> dict[str, Any]:
    return {
        "id": metric_id,
        "kind": "discrete_cdf",
        "sample_sizes": {"python": left_size, "typescript": right_size},
        "observed": {"effect": 0.0},
        "equivalence_margin": margin,
        "equivalence_supported": False,
        "diagnostic": "Observations conditionnelles insuffisantes.",
    }


def compare_values(
    metric_id: str,
    left: list[dict[float, int]],
    right: list[dict[float, int]],
    *,
    inference: dict[str, Any],
    alpha: float,
    seed: int,
) -> dict[str, Any]:
    minimum = inference["minimum_conditional_observations"]
    margin = inference["equivalence_margins"]["conditional_cdf"]
    if not left and not right:
        return exact_metric(metric_id, [], [])
    if len(left) < minimum or len(right) < minimum:
        return insufficient_metric(metric_id, len(left), len(right), margin)
    return compare_count_blocks(
        metric_id,
        left,
        right,
        alpha=alpha,
        margin=margin,
        permutations=inference["permutations"],
        seed=seed,
    )


def structural_metrics(
    scenario: dict[str, Any], left: list[dict[str, Any]], right: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    metrics: list[dict[str, Any]] = []
    for metric_id in scenario["metrics"]:
        if metric_id == "outcome_cdf":
            left_values = [outcome_block(result) for result in left]
            right_values = [outcome_block(result) for result in right]
        elif metric_id == "censored_rate":
            left_values = [result["completion_summary"]["censored_rate"] for result in left]
            right_values = [result["completion_summary"]["censored_rate"] for result in right]
        elif metric_id.endswith("_presence"):
            field = "risk_score" if metric_id.startswith("risk_score") else "result_percentiles"
            nested = None if field == "risk_score" else metric_id[:3]
            left_values = presence_blocks(left, field, nested)
            right_values = presence_blocks(right, field, nested)
        else:
            left_values = [result["throughput_reliability"] for result in left]
            right_values = [result["throughput_reliability"] for result in right]
        metrics.append(exact_metric(metric_id, left_values, right_values))
    return metrics


def _censored_blocks(results: list[dict[str, Any]]) -> list[tuple[int, int]]:
    return [
        (
            result["completion_summary"]["censored_count"],
            result["completion_summary"]["completed_count"]
            + result["completion_summary"]["censored_count"],
        )
        for result in results
    ]


def _common_arguments(
    inference: dict[str, Any], alpha: float, seed: int,
) -> dict[str, Any]:
    return {
        "alpha": alpha,
        "permutations": inference["permutations"],
        "seed": seed,
    }


def _presence_metric(
    metric_id: str,
    left: list[dict[str, Any]],
    right: list[dict[str, Any]],
    inference: dict[str, Any],
    common: dict[str, Any],
) -> dict[str, Any]:
    field = "risk_score" if metric_id.startswith("risk_score") else "result_percentiles"
    nested = None if field == "risk_score" else metric_id[:3]
    return compare_rate_blocks(
        metric_id,
        presence_blocks(left, field, nested),
        presence_blocks(right, field, nested),
        margin=inference["equivalence_margins"]["cohort_rate"],
        **common,
    )


def _values_metric(
    metric_id: str,
    left: list[dict[str, Any]],
    right: list[dict[str, Any]],
    inference: dict[str, Any],
    alpha: float,
    seed: int,
) -> dict[str, Any]:
    field = "risk_score" if metric_id.startswith("risk_score") else "result_percentiles"
    nested = None if field == "risk_score" else metric_id[:3]
    return compare_values(
        metric_id,
        value_blocks(left, field, nested),
        value_blocks(right, field, nested),
        inference=inference,
        alpha=alpha,
        seed=seed,
    )


def inferential_metric(
    metric_id: str,
    left: list[dict[str, Any]],
    right: list[dict[str, Any]],
    *,
    inference: dict[str, Any],
    alpha: float,
    seed: int,
) -> dict[str, Any]:
    common = _common_arguments(inference, alpha, seed)
    if metric_id == "outcome_cdf":
        return compare_count_blocks(
            metric_id,
            [outcome_block(result) for result in left],
            [outcome_block(result) for result in right],
            margin=inference["equivalence_margins"]["pooled_cdf"],
            **common,
        )
    if metric_id == "censored_rate":
        return compare_rate_blocks(
            metric_id,
            _censored_blocks(left),
            _censored_blocks(right),
            margin=inference["equivalence_margins"]["pooled_rate"],
            **common,
        )
    if metric_id == "completion_count":
        return compare_values(
            metric_id,
            [{float(result["completion_summary"]["completed_count"]): 1} for result in left],
            [{float(result["completion_summary"]["completed_count"]): 1} for result in right],
            inference=inference,
            alpha=alpha,
            seed=seed,
        )
    if metric_id.endswith("_presence"):
        return _presence_metric(metric_id, left, right, inference, common)
    if metric_id.endswith("_values"):
        return _values_metric(metric_id, left, right, inference, alpha, seed)
    return exact_metric(
        metric_id,
        [result["throughput_reliability"] for result in left],
        [result["throughput_reliability"] for result in right],
    )
