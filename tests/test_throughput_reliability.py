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
