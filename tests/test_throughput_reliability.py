import pytest

from backend.simulation_value_objects import StatisticalValueError
from backend.throughput_reliability import calculate_throughput_reliability


@pytest.mark.parametrize(
    ("samples", "expected"),
    [
        (
            [1, 2, 3, 4, 5, 6],
            {
                "cv": 0.488,
                "iqr_ratio": 0.7143,
                "slope_norm": 0.2857,
                "label": "fragile",
                "samples_count": 6,
            },
        ),
        (
            [9, 9, 10, 10, 10, 11, 11],
            {
                "cv": 0.0756,
                "iqr_ratio": 0.1,
                "slope_norm": 0.0357,
                "label": "incertain",
                "samples_count": 7,
            },
        ),
        (
            [16, 17, 18, 19, 20, 21, 22, 23, 24],
            {
                "cv": 0.1291,
                "iqr_ratio": 0.2,
                "slope_norm": 0.05,
                "label": "incertain",
                "samples_count": 9,
            },
        ),
        (
            [12, 14, 16, 18, 20, 22, 24, 26, 28],
            {
                "cv": 0.2582,
                "iqr_ratio": 0.4,
                "slope_norm": 0.1,
                "label": "fragile",
                "samples_count": 9,
            },
        ),
        (
            [32, 29, 26, 23, 20, 17, 14, 11, 8],
            {
                "cv": 0.3873,
                "iqr_ratio": 0.6,
                "slope_norm": -0.15,
                "label": "non fiable",
                "samples_count": 9,
            },
        ),
        (
            [8, 3, 3, 3, 3, 3, 3, 3, 3, 8],
            {
                "cv": 0.5,
                "iqr_ratio": 0,
                "slope_norm": 0,
                "label": "incertain",
                "samples_count": 10,
            },
        ),
        (
            [6, 1, 1, 1, 1, 1, 1, 1, 1, 6],
            {
                "cv": 1,
                "iqr_ratio": 0,
                "slope_norm": 0,
                "label": "fragile",
                "samples_count": 10,
            },
        ),
        (
            [16, 1, 1, 1, 1, 1, 1, 1, 1, 16],
            {
                "cv": 1.5,
                "iqr_ratio": 0,
                "slope_norm": 0,
                "label": "non fiable",
                "samples_count": 10,
            },
        ),
        (
            [3, 4, 5, 5, 4, 3, 3, 4, 5],
            {
                "cv": 0.2041,
                "iqr_ratio": 0.5,
                "slope_norm": 0.0083,
                "label": "incertain",
                "samples_count": 9,
            },
        ),
    ],
)
def test_population_moments_linear_quartiles_and_least_squares(
    samples,
    expected,
):
    reliability = calculate_throughput_reliability(samples)

    assert {
        "cv": reliability.cv,
        "iqr_ratio": reliability.iqr_ratio,
        "slope_norm": reliability.slope_norm,
        "label": reliability.label,
        "samples_count": reliability.samples_count,
    } == expected


@pytest.mark.parametrize("samples", [[], [True], [1.5], [-1]])
def test_invalid_sample_histories_are_rejected(samples):
    with pytest.raises(StatisticalValueError):
        calculate_throughput_reliability(samples)


def test_calculation_requires_a_collection():
    with pytest.raises(StatisticalValueError, match="collection"):
        calculate_throughput_reliability(None)
