from __future__ import annotations

import math
from collections.abc import Iterable, Sequence

from .simulation_value_objects import StatisticalValueError, ThroughputReliability


def _linear_quantile(sorted_values: Sequence[float], level: float) -> float:
    position = (len(sorted_values) - 1) * level
    lower_index = math.floor(position)
    upper_index = min(lower_index + 1, len(sorted_values) - 1)
    weight = position - lower_index
    lower_value = sorted_values[lower_index]
    return lower_value + weight * (sorted_values[upper_index] - lower_value)


def _strict_samples(samples: Iterable[object]) -> tuple[int, ...]:
    try:
        raw_values = tuple(samples)
    except TypeError as exc:
        raise StatisticalValueError("throughput_samples doit etre une collection.") from exc
    if not raw_values:
        raise StatisticalValueError("throughput_samples est vide.")
    if any(type(value) is not int or value < 0 for value in raw_values):
        raise StatisticalValueError(
            "throughput_samples doit contenir uniquement des entiers finis >= 0."
        )
    return raw_values


def calculate_throughput_reliability(
    samples: Iterable[object],
) -> ThroughputReliability:
    values = _strict_samples(samples)
    samples_count = len(values)
    mean = sum(values) / samples_count
    variance = sum((value - mean) ** 2 for value in values) / samples_count
    sorted_values = sorted(values)
    q25 = _linear_quantile(sorted_values, 0.25)
    median = _linear_quantile(sorted_values, 0.5)
    q75 = _linear_quantile(sorted_values, 0.75)

    mean_x = (samples_count - 1) / 2
    slope_denominator = sum((index - mean_x) ** 2 for index in range(samples_count))
    slope_numerator = sum((index - mean_x) * (value - mean) for index, value in enumerate(values))
    slope = slope_numerator / slope_denominator if slope_denominator > 0 else 0.0
    return ThroughputReliability.create(
        cv=math.sqrt(variance) / mean if mean > 0 else 0.0,
        iqr_ratio=(q75 - q25) / median if median > 0 else 0.0,
        slope_norm=slope / mean if mean > 0 else 0.0,
        samples_count=samples_count,
        mean=mean,
    )
