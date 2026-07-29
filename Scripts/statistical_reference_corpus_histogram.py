"""Independent histogram derivation for the statistical reference corpus."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_reference_corpus_models import ValidationIssue, semantic_issue

HISTOGRAM_MAX_BUCKETS = 100
_MCA_PRNG_V1_INCREMENT = 0x6D2B79F5
_UINT32_MASK = 0xFFFFFFFF


def _target_one_samples(input_value: dict[str, Any]) -> list[int] | None:
    target_one = (
        input_value.get("mode") == "weeks_to_items"
        and input_value.get("target_weeks") == 1
    )
    raw_samples = input_value.get("throughput_samples")
    include_zeros = input_value.get("include_zero_weeks")
    valid_samples = isinstance(raw_samples, list) and all(
        type(sample) is int and sample >= 0 for sample in raw_samples
    )
    if not target_one or not valid_samples or not isinstance(include_zeros, bool):
        return None
    return raw_samples if include_zeros else [sample for sample in raw_samples if sample > 0]


def normative_histogram(values: list[int]) -> list[dict[str, int]]:
    counts_by_value: dict[int, int] = {}
    for value in values:
        counts_by_value[value] = counts_by_value.get(value, 0) + 1
    exact_buckets = sorted(counts_by_value.items())
    if len(exact_buckets) <= HISTOGRAM_MAX_BUCKETS:
        return [{"x": value, "count": count} for value, count in exact_buckets]

    minimum = exact_buckets[0][0]
    maximum = exact_buckets[-1][0]
    width = (maximum - minimum) // HISTOGRAM_MAX_BUCKETS + 1
    counts_by_index: dict[int, int] = {}
    for value, count in exact_buckets:
        index = (value - minimum) // width
        counts_by_index[index] = counts_by_index.get(index, 0) + count

    histogram = []
    for index, count in sorted(counts_by_index.items()):
        left = minimum + index * width
        right = min(maximum, left + width - 1)
        histogram.append({"x": (left + right) // 2, "count": count})
    return histogram


def _mca_prng_v1_target_one_values(
    samples: list[int],
    seed: int,
    simulation_count: int,
) -> list[int]:
    state = seed
    values = []
    for _index in range(simulation_count):
        state = (state + _MCA_PRNG_V1_INCREMENT) & _UINT32_MASK
        mixed_state = ((state ^ (state >> 15)) * (state | 1)) & _UINT32_MASK
        mixed_product = (
            (mixed_state ^ (mixed_state >> 7)) * (mixed_state | 61)
        ) & _UINT32_MASK
        mixed_state = (
            mixed_state ^ ((mixed_state + mixed_product) & _UINT32_MASK)
        ) & _UINT32_MASK
        random_value = (mixed_state ^ (mixed_state >> 14)) & _UINT32_MASK
        sample_index = (random_value * len(samples)) >> 32
        values.append(samples[sample_index])
    return values


def histogram_construction_issues(
    case_path: str,
    seed: Any,
    input_value: dict[str, Any],
    result: dict[str, Any],
) -> list[ValidationIssue]:
    distribution = result.get("result_distribution")
    valid_distribution = isinstance(distribution, list) and all(
        isinstance(bucket, dict)
        and type(bucket.get("x")) is int
        and type(bucket.get("count")) is int
        for bucket in distribution
    )
    samples = _target_one_samples(input_value)
    simulation_count = input_value.get("n_sims")
    if (
        not valid_distribution
        or not samples
        or type(seed) is not int
        or not 0 <= seed <= _UINT32_MASK
        or type(simulation_count) is not int
        or simulation_count <= 0
    ):
        return []
    expected = normative_histogram(
        _mca_prng_v1_target_one_values(samples, seed, simulation_count)
    )
    representatives = [bucket["x"] for bucket in distribution]
    expected_representatives = [bucket["x"] for bucket in expected]
    if representatives != expected_representatives:
        return [
            semantic_issue(
                f"{case_path}/expected_result/result_distribution",
                "histogramRepresentative",
                "histogram representatives must match the independent normative construction",
            )
        ]
    if distribution == expected:
        return []
    return [
        semantic_issue(
            f"{case_path}/expected_result/result_distribution",
            "histogramCount",
            "histogram counts must match the independent normative construction",
        )
    ]
