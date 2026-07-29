from dataclasses import FrozenInstanceError

import pytest

from backend.simulation_limits import (
    SIMULATION_BACKLOG_SIZE_MAX,
    SIMULATION_HORIZON_WEEKS_MAX,
    SIMULATION_N_SIMS_MAX,
    SIMULATION_N_SIMS_MIN,
    SIMULATION_SEED_MAX,
    SIMULATION_THROUGHPUT_SAMPLES_MAX,
)
from backend.simulation_models import SimulationCommand
from backend.simulation_value_objects import (
    BacklogSize,
    CompletionSummary,
    Histogram,
    SimulationCount,
    SimulationHorizon,
    SimulationPercentiles,
    SimulationSeed,
    StatisticalValueError,
    ThroughputReliability,
    ThroughputSamples,
    round_half_up,
)


@pytest.mark.parametrize(
    ("factory", "minimum", "maximum"),
    [
        (SimulationSeed, 0, SIMULATION_SEED_MAX),
        (SimulationCount, SIMULATION_N_SIMS_MIN, SIMULATION_N_SIMS_MAX),
        (BacklogSize, 1, SIMULATION_BACKLOG_SIZE_MAX),
        (SimulationHorizon, 1, SIMULATION_HORIZON_WEEKS_MAX),
    ],
)
def test_bounded_integer_value_objects_accept_inclusive_bounds(
    factory,
    minimum,
    maximum,
):
    assert factory(minimum).value == minimum
    assert factory(maximum).value == maximum


@pytest.mark.parametrize(
    ("factory", "minimum", "maximum"),
    [
        (SimulationSeed, 0, SIMULATION_SEED_MAX),
        (SimulationCount, SIMULATION_N_SIMS_MIN, SIMULATION_N_SIMS_MAX),
        (BacklogSize, 1, SIMULATION_BACKLOG_SIZE_MAX),
        (SimulationHorizon, 1, SIMULATION_HORIZON_WEEKS_MAX),
    ],
)
def test_bounded_integer_value_objects_reject_out_of_bounds_and_non_integers(
    factory,
    minimum,
    maximum,
):
    for invalid in (minimum - 1, maximum + 1, True, "12", 12.0):
        with pytest.raises(StatisticalValueError):
            factory(invalid)


def test_seed_and_throughput_value_objects_are_immutable():
    seed = SimulationSeed(123)
    samples = ThroughputSamples.create([0, 1, 2, 3, 4, 5], True)

    with pytest.raises(FrozenInstanceError):
        seed.value = 456
    with pytest.raises(FrozenInstanceError):
        samples.raw_values = (1, 2, 3, 4, 5, 6)
    assert isinstance(samples.raw_values, tuple)
    assert isinstance(samples.usable_values, tuple)


@pytest.mark.parametrize(
    "invalid",
    [True, "4", 4.5, -1, float("nan"), float("inf"), float("-inf")],
)
def test_throughput_rejects_invalid_values_before_zero_processing(invalid):
    values = [0, 1, 2, 3, 4, invalid]

    with pytest.raises(StatisticalValueError):
        ThroughputSamples.create(values, False)


def test_throughput_enforces_raw_and_usable_sample_limits():
    assert len(ThroughputSamples.create([1] * 6, False).usable_values) == 6
    assert (
        len(
            ThroughputSamples.create(
                [1] * SIMULATION_THROUGHPUT_SAMPLES_MAX,
                False,
            ).raw_values
        )
        == SIMULATION_THROUGHPUT_SAMPLES_MAX
    )
    for values in ([1] * 5, [1] * (SIMULATION_THROUGHPUT_SAMPLES_MAX + 1)):
        with pytest.raises(StatisticalValueError, match="entre 6 et 521"):
            ThroughputSamples.create(values, False)

    with pytest.raises(StatisticalValueError, match="non nulles"):
        ThroughputSamples.create([0, 1, 2, 3, 4, 5], False)

    zero_history = ThroughputSamples.create([0] * 6, True)
    assert zero_history.usable_values == (0, 0, 0, 0, 0, 0)


def test_throughput_rejects_invalid_collection_and_zero_week_flag():
    with pytest.raises(StatisticalValueError, match="collection"):
        ThroughputSamples.create(None, True)
    with pytest.raises(StatisticalValueError, match="booleen strict"):
        ThroughputSamples.create([1] * 6, 1)


def test_commands_require_only_the_active_mode_parameter():
    backlog = SimulationCommand.create(
        throughput_samples=[1] * 6,
        include_zero_weeks=False,
        mode="backlog_to_weeks",
        backlog_size=10,
        target_weeks=None,
        n_sims=1000,
        seed=SimulationSeed(0),
    )
    horizon = SimulationCommand.create(
        throughput_samples=[1] * 6,
        include_zero_weeks=False,
        mode="weeks_to_items",
        backlog_size=None,
        target_weeks=12,
        n_sims=1000,
        seed=SimulationSeed(SIMULATION_SEED_MAX),
    )

    assert backlog.backlog_size == BacklogSize(10)
    assert backlog.target_weeks is None
    assert horizon.backlog_size is None
    assert horizon.target_weeks == SimulationHorizon(12)


@pytest.mark.parametrize(
    "overrides",
    [
        {"mode": "invalid"},
        {"mode": "backlog_to_weeks", "backlog_size": None},
        {"mode": "weeks_to_items", "target_weeks": None},
        {"mode": "backlog_to_weeks", "target_weeks": 12},
        {
            "mode": "weeks_to_items",
            "backlog_size": 10,
            "target_weeks": 12,
        },
        {"throughput_samples": "123456"},
        {"seed": 0},
    ],
)
def test_commands_reject_unresolved_domain_inputs(overrides):
    values = {
        "throughput_samples": [1] * 6,
        "include_zero_weeks": False,
        "mode": "backlog_to_weeks",
        "backlog_size": 10,
        "target_weeks": None,
        "n_sims": 1000,
        "seed": SimulationSeed(0),
    }
    values.update(overrides)

    with pytest.raises(StatisticalValueError):
        SimulationCommand.create(**values)


def test_normalized_commands_are_closed_explicit_and_seeded_with_uint32():
    backlog = SimulationCommand.from_normalized_input(
        {
            "throughput_samples": [0, 1, 2, 3, 4, 5],
            "include_zero_weeks": True,
            "mode": "backlog_to_weeks",
            "backlog_size": 10,
            "n_sims": 1000,
        },
        0,
    )
    items = SimulationCommand.from_normalized_input(
        {
            "throughput_samples": [0, 1, 2, 3, 4, 5, 6],
            "include_zero_weeks": False,
            "mode": "weeks_to_items",
            "target_weeks": 521,
            "n_sims": 200000,
        },
        SIMULATION_SEED_MAX,
    )

    assert backlog.seed == SimulationSeed(0)
    assert backlog.throughput_samples.usable_values == (0, 1, 2, 3, 4, 5)
    assert items.seed == SimulationSeed(SIMULATION_SEED_MAX)
    assert items.throughput_samples.usable_values == (1, 2, 3, 4, 5, 6)


@pytest.mark.parametrize(
    ("input_value", "seed"),
    [
        (None, 0),
        (
            {
                "throughput_samples": [1] * 6,
                "include_zero_weeks": False,
                "mode": "backlog_to_weeks",
                "backlog_size": 10,
                "n_sims": 1000,
                "unknown": True,
            },
            0,
        ),
        (
            {
                "throughput_samples": [1] * 6,
                "mode": "backlog_to_weeks",
                "backlog_size": 10,
                "n_sims": 1000,
            },
            0,
        ),
        (
            {
                "throughput_samples": [1] * 6,
                "include_zero_weeks": False,
                "mode": "backlog_to_weeks",
                "target_weeks": 12,
                "n_sims": 1000,
            },
            0,
        ),
        (
            {
                "throughput_samples": [1] * 6,
                "include_zero_weeks": False,
                "mode": "backlog_to_weeks",
                "backlog_size": 10,
                "target_weeks": 12,
                "n_sims": 1000,
            },
            0,
        ),
        (
            {
                "throughput_samples": [1] * 6,
                "include_zero_weeks": False,
                "mode": "invalid",
                "n_sims": 1000,
            },
            0,
        ),
        (
            {
                "throughput_samples": [1] * 6,
                "include_zero_weeks": False,
                "mode": "backlog_to_weeks",
                "backlog_size": 10,
                "n_sims": 1000,
            },
            4294967296,
        ),
    ],
)
def test_normalized_commands_reject_open_unresolved_or_invalid_shapes(
    input_value,
    seed,
):
    with pytest.raises(StatisticalValueError):
        SimulationCommand.from_normalized_input(input_value, seed)


def test_direct_command_construction_requires_value_objects_and_resolved_mode():
    samples = ThroughputSamples.create([1] * 6, False)
    count = SimulationCount(1000)
    seed = SimulationSeed(0)

    with pytest.raises(StatisticalValueError, match="Value Object"):
        SimulationCommand((1, 2, 3, 4, 5, 6), "backlog_to_weeks", None, None, count, seed)
    with pytest.raises(StatisticalValueError, match="n_sims"):
        SimulationCommand(samples, "backlog_to_weeks", BacklogSize(1), None, 1000, seed)
    with pytest.raises(StatisticalValueError, match="seed"):
        SimulationCommand(samples, "backlog_to_weeks", BacklogSize(1), None, count, 0)
    with pytest.raises(StatisticalValueError, match="backlog actif"):
        SimulationCommand(samples, "backlog_to_weeks", None, None, count, seed)
    with pytest.raises(StatisticalValueError, match="backlog actif"):
        SimulationCommand(
            samples,
            "backlog_to_weeks",
            BacklogSize(1),
            SimulationHorizon(1),
            count,
            seed,
        )
    with pytest.raises(StatisticalValueError, match="horizon actif"):
        SimulationCommand(samples, "weeks_to_items", BacklogSize(1), None, count, seed)
    with pytest.raises(StatisticalValueError, match="horizon actif"):
        SimulationCommand(
            samples,
            "weeks_to_items",
            BacklogSize(1),
            SimulationHorizon(1),
            count,
            seed,
        )
    with pytest.raises(StatisticalValueError, match="mode"):
        SimulationCommand(samples, "invalid", None, None, count, seed)


def test_percentiles_preserve_absences_and_mode_order():
    backlog = SimulationPercentiles.create(
        "backlog_to_weeks",
        {"P50": 5, "P90": 9},
    )
    items = SimulationPercentiles.create(
        "weeks_to_items",
        {"P50": 9, "P70": 7, "P90": 5},
    )

    assert backlog.to_dict() == {"P50": 5, "P90": 9}
    assert list(backlog) == ["P50", "P90"]
    assert "P70" not in backlog
    assert items == {"P50": 9, "P70": 7, "P90": 5}
    assert not (items == object())
    assert backlog.risk_score == 0.8
    assert SimulationPercentiles.create("backlog_to_weeks", {"P70": 7}).risk_score is None


@pytest.mark.parametrize(
    ("mode", "values", "message"),
    [
        ("invalid", {}, "mode"),
        ("backlog_to_weeks", {"P80": 3}, "uniquement"),
        ("backlog_to_weeks", {"P50": True}, "entier strict"),
        ("backlog_to_weeks", {"P50": -1}, ">= 0"),
        ("backlog_to_weeks", {"P50": 9, "P90": 5}, "croissant"),
        ("weeks_to_items", {"P50": 5, "P90": 9}, "decroissant"),
    ],
)
def test_percentiles_reject_invalid_keys_values_and_order(mode, values, message):
    with pytest.raises(StatisticalValueError, match=message):
        SimulationPercentiles.create(mode, values)


def test_risk_score_uses_round_half_up_and_requires_positive_p50():
    assert (
        SimulationPercentiles.create(
            "backlog_to_weeks",
            {"P50": 6, "P90": 10},
        ).risk_score
        == 0.6667
    )
    assert (
        SimulationPercentiles.create(
            "weeks_to_items",
            {"P50": 8, "P90": 2},
        ).risk_score
        == 0.75
    )
    assert (
        SimulationPercentiles.create(
            "backlog_to_weeks",
            {"P50": 0, "P90": 0},
        ).risk_score
        is None
    )
    assert (
        SimulationPercentiles.create(
            "backlog_to_weeks",
            {"P50": 32, "P90": 33},
        ).risk_score
        == 0.0313
    )
    assert (
        SimulationPercentiles.create(
            "weeks_to_items",
            {"P50": 32, "P90": 31},
        ).risk_score
        == 0.0313
    )
    assert round_half_up(0.00005) == 0.0001
    assert round_half_up(-0.00005) == -0.0001


@pytest.mark.parametrize(
    ("value", "decimal_places", "expected"),
    [
        (1.005, 2, 1.01),
        (-1.005, 2, -1.01),
        (1.004999999999, 2, 1.0),
        (1.005000000001, 2, 1.01),
        (1.499949999, 4, 1.4999),
        (1.49995, 4, 1.5),
        (1.499950001, 4, 1.5),
    ],
)
def test_round_half_up_distinguishes_midpoints_and_adjacent_values(
    value,
    decimal_places,
    expected,
):
    assert round_half_up(value, decimal_places) == expected


@pytest.mark.parametrize(
    ("metrics", "expected_label"),
    [
        (
            {"cv": 1.49994, "iqr_ratio": 0, "slope_norm": 0, "samples_count": 8, "mean": 1},
            "fragile",
        ),
        (
            {"cv": 1.49995, "iqr_ratio": 0, "slope_norm": 0, "samples_count": 8, "mean": 1},
            "non fiable",
        ),
        (
            {"cv": 0.99995, "iqr_ratio": 0, "slope_norm": 0, "samples_count": 8, "mean": 1},
            "fragile",
        ),
        (
            {"cv": 0.49995, "iqr_ratio": 0, "slope_norm": 0, "samples_count": 8, "mean": 1},
            "incertain",
        ),
        (
            {"cv": 0, "iqr_ratio": 0.49995, "slope_norm": 0, "samples_count": 8, "mean": 1},
            "incertain",
        ),
        (
            {"cv": 0, "iqr_ratio": 0, "slope_norm": -0.14995, "samples_count": 8, "mean": 1},
            "non fiable",
        ),
        (
            {"cv": 0, "iqr_ratio": 0, "slope_norm": 0.04995, "samples_count": 8, "mean": 1},
            "incertain",
        ),
        (
            {"cv": 1, "iqr_ratio": 1, "slope_norm": -0.15, "samples_count": 8, "mean": 1},
            "non fiable",
        ),
        (
            {"cv": 1, "iqr_ratio": 0.5, "slope_norm": 0.05, "samples_count": 6, "mean": 1},
            "fragile",
        ),
        (
            {"cv": 0.5, "iqr_ratio": 0.5, "slope_norm": 0.05, "samples_count": 8, "mean": 1},
            "incertain",
        ),
        ({"cv": 0, "iqr_ratio": 0, "slope_norm": 0, "samples_count": 7, "mean": 1}, "incertain"),
        ({"cv": 0, "iqr_ratio": 0, "slope_norm": 0, "samples_count": 8, "mean": 1}, "fiable"),
        ({"cv": 0, "iqr_ratio": 0, "slope_norm": 0, "samples_count": 8, "mean": 0}, "non fiable"),
        ({"cv": 0, "iqr_ratio": 0, "slope_norm": 0, "samples_count": 5, "mean": 1}, "non fiable"),
    ],
)
def test_reliability_normalizes_before_categorization(metrics, expected_label):
    reliability = ThroughputReliability.create(**metrics)

    assert reliability.label == expected_label
    assert reliability.cv == round_half_up(metrics["cv"])
    assert reliability.iqr_ratio == round_half_up(metrics["iqr_ratio"])
    assert reliability.slope_norm == round_half_up(metrics["slope_norm"])


@pytest.mark.parametrize(
    "overrides",
    [
        {"cv": float("nan")},
        {"iqr_ratio": float("inf")},
        {"slope_norm": "0"},
        {"cv": -0.1},
        {"iqr_ratio": -0.1},
        {"samples_count": True},
        {"samples_count": -1},
        {"mean": float("-inf")},
    ],
)
def test_reliability_rejects_invalid_metrics(overrides):
    metrics = {
        "cv": 0.2,
        "iqr_ratio": 0.3,
        "slope_norm": 0.01,
        "samples_count": 8,
        "mean": 10,
    }
    metrics.update(overrides)
    with pytest.raises(StatisticalValueError):
        ThroughputReliability.create(**metrics)


def test_serialized_reliability_accepts_only_the_closed_label_set():
    reliability = ThroughputReliability.create(
        cv=0.2,
        iqr_ratio=0.3,
        slope_norm=0.01,
        samples_count=8,
        label="fiable",
    )
    assert reliability.label == "fiable"

    for invalid_label in (None, "stable"):
        with pytest.raises(StatisticalValueError, match="label"):
            ThroughputReliability.create(
                cv=0.2,
                iqr_ratio=0.3,
                slope_norm=0.01,
                samples_count=8,
                label=invalid_label,
            )


def test_histogram_accepts_exact_and_aggregated_immutable_buckets():
    exact = Histogram.create(
        [{"x": 1, "count": 2}, {"x": 3, "count": 1}],
        expected_mass=3,
    )
    aggregated = Histogram.create(
        [{"x": index * 2, "count": 1} for index in range(100)],
        expected_mass=100,
    )

    assert [(bucket.x, bucket.count) for bucket in exact] == [(1, 2), (3, 1)]
    assert exact[:] == exact.buckets
    assert len(aggregated) == 100
    with pytest.raises(FrozenInstanceError):
        exact[0].count = 3


@pytest.mark.parametrize(
    ("buckets", "mass", "message"),
    [
        ([{"x": True, "count": 1}], 1, "entier strict"),
        ([{"x": 1, "count": 1.5}], 1, "entier strict"),
        ([{"x": 1, "count": 0}], 0, "strictement positif"),
        ([{"x": 2, "count": 1}, {"x": 1, "count": 1}], 2, "croissant"),
        ([{"x": 1, "count": 1}, {"x": 1, "count": 1}], 2, "croissant"),
        ([{"x": 1, "count": 1}], 2, "masse"),
        ([{"x": 1, "count": 1}], -1, ">= 0"),
        ([{"x": 1, "count": 1}], True, "entier strict"),
    ],
)
def test_histogram_rejects_invalid_buckets_order_and_mass(buckets, mass, message):
    with pytest.raises(StatisticalValueError, match=message):
        Histogram.create(buckets, expected_mass=mass)


def test_histogram_rejects_more_than_one_hundred_buckets():
    with pytest.raises(StatisticalValueError, match="au plus 100"):
        Histogram.create(
            [{"x": index, "count": 1} for index in range(101)],
            expected_mass=101,
        )


@pytest.mark.parametrize(
    ("completed", "censored", "expected_rate"),
    [(1000, 0, 0), (667, 333, 0.333), (0, 1000, 1)],
)
def test_completion_supports_complete_partial_and_fully_censored_counts(
    completed,
    censored,
    expected_rate,
):
    summary = CompletionSummary.create(
        completed_count=completed,
        censored_count=censored,
        n_sims=SimulationCount(1000),
    )

    assert summary.censored_rate == expected_rate
    assert summary.horizon_weeks == 521


def test_completion_uses_round_half_up_and_rejects_inconsistent_counts():
    summary = CompletionSummary.create(
        completed_count=19_999,
        censored_count=1,
        n_sims=SimulationCount(20_000),
    )
    assert summary.censored_rate == 0.0001

    invalid_cases = [
        {"completed_count": 999, "censored_count": 0, "n_sims": SimulationCount(1000)},
        {"completed_count": -1, "censored_count": 1001, "n_sims": SimulationCount(1000)},
        {"completed_count": True, "censored_count": 999, "n_sims": SimulationCount(1000)},
        {
            "completed_count": 1000,
            "censored_count": 0,
            "n_sims": SimulationCount(1000),
            "horizon_weeks": 520,
        },
        {"completed_count": 1000, "censored_count": 0, "n_sims": 1000},
    ]
    for invalid in invalid_cases:
        with pytest.raises(StatisticalValueError):
            CompletionSummary.create(**invalid)
