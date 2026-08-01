"""Symmetric statistical primitives for the distributional parity protocol."""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from statistics import NormalDist
from typing import Any

import numpy as np

CountBlock = dict[float, int]
RateBlock = tuple[int, int]


def pooled_counts(blocks: Sequence[CountBlock]) -> CountBlock:
    pooled: CountBlock = {}
    for block in blocks:
        for value, count in block.items():
            pooled[value] = pooled.get(value, 0) + count
    return pooled


def ks_distance(left: CountBlock, right: CountBlock) -> float:
    left_total = sum(left.values())
    right_total = sum(right.values())
    if left_total == 0 or right_total == 0:
        return 1.0
    left_seen = 0
    right_seen = 0
    distance = 0.0
    for value in sorted(set(left) | set(right)):
        left_seen += left.get(value, 0)
        right_seen += right.get(value, 0)
        distance = max(distance, abs(left_seen / left_total - right_seen / right_total))
    return distance


def dkw_radius(left_size: int, right_size: int, alpha: float) -> float:
    if left_size <= 0 or right_size <= 0:
        return 1.0
    return min(
        1.0,
        math.sqrt(math.log(4 / alpha) / (2 * left_size))
        + math.sqrt(math.log(4 / alpha) / (2 * right_size)),
    )


def wilson_interval(successes: int, total: int, alpha: float) -> tuple[float, float]:
    if total <= 0:
        return 0.0, 1.0
    z = NormalDist().inv_cdf(1 - alpha / 2)
    rate = successes / total
    denominator = 1 + (z * z / total)
    center = (rate + z * z / (2 * total)) / denominator
    radius = z * math.sqrt(rate * (1 - rate) / total + z * z / (4 * total * total))
    radius /= denominator
    return max(0.0, center - radius), min(1.0, center + radius)


def rate_difference_interval(
    left: RateBlock, right: RateBlock, alpha: float,
) -> tuple[float, float]:
    left_interval = wilson_interval(*left, alpha)
    right_interval = wilson_interval(*right, alpha)
    return left_interval[0] - right_interval[1], left_interval[1] - right_interval[0]


def _permutation_groups(
    total: int, left_size: int, permutations: int, seed: int,
) -> list[tuple[np.ndarray, np.ndarray]]:
    rng = np.random.Generator(np.random.PCG64(seed))
    groups: list[tuple[np.ndarray, np.ndarray]] = []
    for _ in range(permutations):
        order = rng.permutation(total)
        groups.append((order[:left_size], order[left_size:]))
    return groups


def permutation_p_value(
    left: Sequence[Any],
    right: Sequence[Any],
    effect: Callable[[Sequence[Any], Sequence[Any]], float],
    *,
    permutations: int,
    seed: int,
) -> float:
    observed = effect(left, right)
    combined = [*left, *right]
    extreme = 0
    for left_indices, right_indices in _permutation_groups(
        len(combined), len(left), permutations, seed,
    ):
        permuted_left = [combined[int(index)] for index in left_indices]
        permuted_right = [combined[int(index)] for index in right_indices]
        if effect(permuted_left, permuted_right) >= observed - 1e-15:
            extreme += 1
    return (extreme + 1) / (permutations + 1)


def count_block_effect(left: Sequence[CountBlock], right: Sequence[CountBlock]) -> float:
    return ks_distance(pooled_counts(left), pooled_counts(right))


def rate_block_effect(left: Sequence[RateBlock], right: Sequence[RateBlock]) -> float:
    left_successes = sum(value[0] for value in left)
    left_total = sum(value[1] for value in left)
    right_successes = sum(value[0] for value in right)
    right_total = sum(value[1] for value in right)
    if left_total == 0 or right_total == 0:
        return 1.0
    return abs(left_successes / left_total - right_successes / right_total)


def _round(value: float) -> float:
    return round(value, 8)


def compare_count_blocks(
    metric_id: str,
    left: Sequence[CountBlock],
    right: Sequence[CountBlock],
    *,
    alpha: float,
    margin: float,
    permutations: int,
    seed: int,
) -> dict[str, Any]:
    left_pooled = pooled_counts(left)
    right_pooled = pooled_counts(right)
    left_size = sum(left_pooled.values())
    right_size = sum(right_pooled.values())
    effect = ks_distance(left_pooled, right_pooled)
    radius = dkw_radius(left_size, right_size, alpha)
    upper = min(1.0, effect + radius)
    return {
        "id": metric_id,
        "kind": "discrete_cdf",
        "sample_sizes": {"python": left_size, "typescript": right_size},
        "observed": {"effect": _round(effect)},
        "confidence_interval": {
            "lower": _round(max(0.0, effect - radius)),
            "upper": _round(upper),
            "alpha": _round(alpha),
            "method": "two-sample-dkw-union-bound",
        },
        "equivalence_margin": margin,
        "raw_p_value": _round(
            permutation_p_value(
                left,
                right,
                count_block_effect,
                permutations=permutations,
                seed=seed,
            )
        ),
        "equivalence_supported": upper <= margin,
    }


def compare_rate_blocks(
    metric_id: str,
    left: Sequence[RateBlock],
    right: Sequence[RateBlock],
    *,
    alpha: float,
    margin: float,
    permutations: int,
    seed: int,
) -> dict[str, Any]:
    left_pooled = (sum(value[0] for value in left), sum(value[1] for value in left))
    right_pooled = (sum(value[0] for value in right), sum(value[1] for value in right))
    low, high = rate_difference_interval(left_pooled, right_pooled, alpha)
    effect = rate_block_effect(left, right)
    upper = max(abs(low), abs(high))
    return {
        "id": metric_id,
        "kind": "rate_difference",
        "sample_sizes": {"python": left_pooled[1], "typescript": right_pooled[1]},
        "observed": {
            "python_rate": _round(left_pooled[0] / left_pooled[1]),
            "typescript_rate": _round(right_pooled[0] / right_pooled[1]),
            "effect": _round(effect),
        },
        "confidence_interval": {
            "lower": _round(low),
            "upper": _round(high),
            "absolute_upper": _round(upper),
            "alpha": _round(alpha),
            "method": "newcombe-wilson-independent-proportions",
        },
        "equivalence_margin": margin,
        "raw_p_value": _round(
            permutation_p_value(
                left,
                right,
                rate_block_effect,
                permutations=permutations,
                seed=seed,
            )
        ),
        "equivalence_supported": upper <= margin,
    }


def holm_adjust(metrics: list[dict[str, Any]], familywise_alpha: float) -> None:
    inferential = [metric for metric in metrics if "raw_p_value" in metric]
    ordered = sorted(enumerate(inferential), key=lambda entry: entry[1]["raw_p_value"])
    running = 0.0
    count = len(ordered)
    for rank, (_index, metric) in enumerate(ordered):
        adjusted = min(1.0, (count - rank) * metric["raw_p_value"])
        running = max(running, adjusted)
        metric["adjusted_p_value"] = _round(running)
    for metric in metrics:
        if metric.get("exact_mismatch"):
            metric["verdict"] = "divergence"
        elif metric.get("equivalence_supported"):
            metric["verdict"] = "match"
        elif (
            metric.get("adjusted_p_value", 1.0) <= familywise_alpha
            and metric["observed"]["effect"] > metric["equivalence_margin"]
        ):
            metric["verdict"] = "divergence"
        else:
            metric["verdict"] = "inconclusive"


def exact_metric(metric_id: str, left: Sequence[Any], right: Sequence[Any]) -> dict[str, Any]:
    mismatch = list(left) != list(right)
    return {
        "id": metric_id,
        "kind": "exact_structural",
        "sample_sizes": {"python": len(left), "typescript": len(right)},
        "observed": {"effect": 1.0 if mismatch else 0.0},
        "equivalence_margin": 0.0,
        "equivalence_supported": not mismatch,
        "exact_mismatch": mismatch,
    }


def aggregate_verdict(verdicts: Sequence[str]) -> str:
    if "divergence" in verdicts:
        return "divergence"
    if verdicts and all(verdict == "match" for verdict in verdicts):
        return "match"
    return "inconclusive"
