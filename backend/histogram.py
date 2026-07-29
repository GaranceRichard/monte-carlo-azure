from __future__ import annotations

import numpy as np

HISTOGRAM_MAX_BUCKETS = 100


def build_histogram(values: np.ndarray) -> list[dict[str, int]]:
    """Build the exact or aggregated STD-STAT-001 histogram."""

    source = np.asarray(values, dtype=int)
    if source.size == 0:
        return []

    unique_values, value_counts = np.unique(source, return_counts=True)
    if unique_values.size <= HISTOGRAM_MAX_BUCKETS:
        return [
            {"x": int(value), "count": int(count)}
            for value, count in zip(unique_values, value_counts)
        ]

    minimum = int(unique_values[0])
    maximum = int(unique_values[-1])
    width = (maximum - minimum) // HISTOGRAM_MAX_BUCKETS + 1
    counts_by_index: dict[int, int] = {}
    for value, count in zip(unique_values, value_counts):
        index = (int(value) - minimum) // width
        counts_by_index[index] = counts_by_index.get(index, 0) + int(count)

    buckets: list[dict[str, int]] = []
    for index, count in sorted(counts_by_index.items()):
        left = minimum + index * width
        right = min(maximum, left + width - 1)
        representative = (left + right) // 2
        buckets.append({"x": representative, "count": count})
    return buckets
