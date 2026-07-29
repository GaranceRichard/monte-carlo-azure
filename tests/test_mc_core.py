import numpy as np
import pytest

from backend.histogram import HISTOGRAM_MAX_BUCKETS, build_histogram
from backend.mc_core import (
    FinishWeeksSimulation,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
)
from backend.mca_prng_v1_sample_index_draw_port import McaPrngV1SampleIndexDrawPort
from backend.simulation_limits import SIMULATION_HORIZON_WEEKS_MAX, SIMULATION_N_SIMS_MAX
from backend.simulation_value_objects import SimulationSeed, ThroughputReliability
from backend.throughput_reliability import calculate_throughput_reliability
from tests.deterministic_sample_index_draw_port import (
    DeterministicSampleIndexDrawPort,
    RecordingSampleIndexDrawPort,
)


def _prng_draw_port(seed: int) -> McaPrngV1SampleIndexDrawPort:
    return McaPrngV1SampleIndexDrawPort(SimulationSeed(seed))


def _reliability(samples: np.ndarray) -> ThroughputReliability:
    return calculate_throughput_reliability(samples.tolist())


def test_empty_finish_result_guardrails():
    result = FinishWeeksSimulation(
        completed_weeks=np.array([], dtype=int),
        simulation_count=0,
        horizon_weeks=10,
    )
    assert result.censored_rate == 0.0
    with pytest.raises(ValueError, match="simulations terminees"):
        FinishWeeksSimulation(
            completed_weeks=np.array([1], dtype=int),
            simulation_count=0,
            horizon_weeks=10,
        )
    with pytest.raises(ValueError, match="unidimensionnel"):
        FinishWeeksSimulation(
            completed_weeks=np.array([[1]], dtype=int),
            simulation_count=1,
            horizon_weeks=10,
        )
    with pytest.raises(ValueError, match="horizon"):
        FinishWeeksSimulation(
            completed_weeks=np.array([0], dtype=int),
            simulation_count=1,
            horizon_weeks=10,
        )


def test_mc_finish_weeks_shape_and_bounds():
    samples = np.array([2, 3, 4, 5], dtype=int)
    out = mc_finish_weeks(
        backlog_size=50,
        throughput_samples=samples,
        n_sims=5000,
        draw_port=_prng_draw_port(123),
    )

    assert out.completed_weeks.shape == (5000,)
    assert np.issubdtype(out.completed_weeks.dtype, np.integer)
    assert int(out.completed_weeks.min()) >= 1
    assert int(out.completed_weeks.max()) <= SIMULATION_HORIZON_WEEKS_MAX
    assert out.simulation_count == 5000
    assert out.horizon_weeks == SIMULATION_HORIZON_WEEKS_MAX


def test_mc_finish_weeks_reproducible_for_seed():
    samples = np.array([1, 2, 3], dtype=int)
    a = mc_finish_weeks(
        backlog_size=30,
        throughput_samples=samples,
        n_sims=2000,
        draw_port=_prng_draw_port(42),
    )
    b = mc_finish_weeks(
        backlog_size=30,
        throughput_samples=samples,
        n_sims=2000,
        draw_port=_prng_draw_port(42),
    )

    assert np.array_equal(a.completed_weeks, b.completed_weeks)
    assert a.simulation_count == b.simulation_count


def test_mc_finish_weeks_backlog_size_one():
    samples = np.array([1, 2, 3], dtype=int)
    out = mc_finish_weeks(
        backlog_size=1,
        throughput_samples=samples,
        n_sims=200,
        draw_port=_prng_draw_port(1),
    )
    assert out.completed_weeks.shape == (200,)
    assert np.all(out.completed_weeks == 1)
    assert out.censored_count == 0


def test_mc_finish_weeks_single_value_samples():
    samples = np.array([2], dtype=int)
    out = mc_finish_weeks(
        backlog_size=11,
        throughput_samples=samples,
        n_sims=100,
        draw_port=_prng_draw_port(1),
    )
    assert np.all(out.completed_weeks == 6)
    assert out.censored_count == 0


def test_mc_finish_weeks_large_backlog_hits_cap():
    samples = np.array([1], dtype=int)
    out = mc_finish_weeks(
        backlog_size=10_000,
        throughput_samples=samples,
        n_sims=50,
        draw_port=_prng_draw_port(1),
    )
    assert out.completed_weeks.size == 0
    assert out.completed_count == 0
    assert out.censored_count == 50
    assert out.censored_rate == 1.0


def test_mc_finish_weeks_invalid_inputs():
    with pytest.raises(ValueError):
        mc_finish_weeks(
            backlog_size=0,
            throughput_samples=np.array([1, 2], dtype=int),
            draw_port=_prng_draw_port(0),
        )
    with pytest.raises(ValueError):
        mc_finish_weeks(
            backlog_size=10,
            throughput_samples=np.array([], dtype=int),
            draw_port=_prng_draw_port(0),
        )
    with pytest.raises(ValueError):
        mc_finish_weeks(
            backlog_size=10,
            throughput_samples=None,
            draw_port=_prng_draw_port(0),
        )
    with pytest.raises(ValueError):
        mc_finish_weeks(
            backlog_size=10,
            throughput_samples=np.array([0, 0], dtype=int),
            draw_port=_prng_draw_port(0),
        )


def test_mc_items_done_for_weeks_shape_and_reproducible():
    samples = np.array([1, 2, 3], dtype=int)
    a = mc_items_done_for_weeks(
        weeks=8,
        throughput_samples=samples,
        n_sims=3000,
        draw_port=_prng_draw_port(123),
    )
    b = mc_items_done_for_weeks(
        weeks=8,
        throughput_samples=samples,
        n_sims=3000,
        draw_port=_prng_draw_port(123),
    )
    assert a.shape == (3000,)
    assert np.array_equal(a, b)
    assert int(a.min()) >= 8


def test_mc_items_done_for_weeks_single_sample_value():
    samples = np.array([3], dtype=int)
    out = mc_items_done_for_weeks(
        weeks=7,
        throughput_samples=samples,
        n_sims=25,
        draw_port=_prng_draw_port(5),
    )
    assert np.all(out == 21)


def test_mc_items_done_for_weeks_invalid_inputs():
    with pytest.raises(ValueError):
        mc_items_done_for_weeks(
            weeks=0,
            throughput_samples=np.array([1, 2], dtype=int),
            draw_port=_prng_draw_port(0),
        )
    with pytest.raises(ValueError):
        mc_items_done_for_weeks(
            weeks=2,
            throughput_samples=np.array([], dtype=int),
            draw_port=_prng_draw_port(0),
        )
    with pytest.raises(ValueError):
        mc_items_done_for_weeks(
            weeks=2,
            throughput_samples=None,
            draw_port=_prng_draw_port(0),
        )
    with pytest.raises(ValueError):
        mc_items_done_for_weeks(
            weeks=2,
            throughput_samples=np.array([0, 0], dtype=int),
            draw_port=_prng_draw_port(0),
        )


def test_mc_finish_weeks_consumes_imposed_indices_for_known_censored_result():
    first_simulation = [1, 1, *([0] * (SIMULATION_HORIZON_WEEKS_MAX - 2))]
    second_simulation = [0] * SIMULATION_HORIZON_WEEKS_MAX
    draw_port = DeterministicSampleIndexDrawPort([*first_simulation, *second_simulation])

    result = mc_finish_weeks(
        backlog_size=3,
        throughput_samples=np.array([0, 2], dtype=int),
        n_sims=2,
        include_zero_weeks=True,
        draw_port=draw_port,
        batch_size=2,
    )

    assert result.completed_weeks.tolist() == [2]
    assert result.simulation_count == 2
    assert result.censored_count == 1
    assert draw_port.requests == [
        (2, (2, SIMULATION_HORIZON_WEEKS_MAX)),
    ]
    draw_port.assert_exhausted()


def test_mc_items_done_for_weeks_consumes_imposed_indices_for_known_result():
    draw_port = DeterministicSampleIndexDrawPort([0, 1, 2, 2, 1, 0])

    result = mc_items_done_for_weeks(
        weeks=2,
        throughput_samples=np.array([2, 5, 9], dtype=int),
        n_sims=3,
        draw_port=draw_port,
        batch_size=2,
    )

    assert result.tolist() == [7, 18, 7]
    assert draw_port.requests == [(3, (2, 2)), (3, (1, 2))]
    draw_port.assert_exhausted()


def test_deterministic_draw_port_detects_invalid_consumption_and_bounds():
    excessive = DeterministicSampleIndexDrawPort([0])
    with pytest.raises(AssertionError, match="excessive"):
        excessive.draw_sample_indices(1, (1, 2))

    insufficient = DeterministicSampleIndexDrawPort([0, 0, 0])
    insufficient.draw_sample_indices(1, (1, 2))
    with pytest.raises(AssertionError, match="insuffisante"):
        insufficient.assert_exhausted()

    out_of_bounds = DeterministicSampleIndexDrawPort([1])
    with pytest.raises(AssertionError, match="hors bornes"):
        out_of_bounds.draw_sample_indices(1, (1, 1))


@pytest.mark.parametrize("batch_size", [3, 4])
def test_numpy_adapter_preserves_captured_reference_outputs(batch_size):
    """Nom historique conserve pour suivre le remplacement contractuel de NumPy."""

    samples = np.array([0, 1, 3, 5, 8, 13], dtype=int)

    finish = mc_finish_weeks(
        backlog_size=2800,
        throughput_samples=samples,
        n_sims=9,
        include_zero_weeks=True,
        draw_port=_prng_draw_port(246_813_579),
        batch_size=batch_size,
    )
    repeated_finish = mc_finish_weeks(
        backlog_size=2800,
        throughput_samples=samples,
        n_sims=9,
        include_zero_weeks=True,
        draw_port=_prng_draw_port(246_813_579),
        batch_size=batch_size,
    )
    items = mc_items_done_for_weeks(
        weeks=7,
        throughput_samples=samples,
        n_sims=9,
        include_zero_weeks=True,
        draw_port=_prng_draw_port(246_813_579),
        batch_size=batch_size,
    )
    repeated_items = mc_items_done_for_weeks(
        weeks=7,
        throughput_samples=samples,
        n_sims=9,
        include_zero_weeks=True,
        draw_port=_prng_draw_port(246_813_579),
        batch_size=batch_size,
    )

    assert np.array_equal(finish.completed_weeks, repeated_finish.completed_weeks)
    assert finish.simulation_count == repeated_finish.simulation_count
    assert np.array_equal(items, repeated_items)


@pytest.mark.parametrize("batch_size", [3, 4])
@pytest.mark.parametrize(
    ("censoring_state", "backlog_size", "completed_count", "censored_count"),
    [
        ("absent", 1, 15, 0),
        ("partial", 1625, 7, 8),
        ("total", 4169, 0, 15),
    ],
)
def test_mc_finish_weeks_is_batch_independent_for_every_censoring_state(
    batch_size,
    censoring_state,
    backlog_size,
    completed_count,
    censored_count,
):
    samples = np.array([0, 1, 2, 3, 5, 8], dtype=int)
    expected = mc_finish_weeks(
        backlog_size=backlog_size,
        throughput_samples=samples,
        n_sims=15,
        include_zero_weeks=True,
        draw_port=_prng_draw_port(99),
    )
    actual = mc_finish_weeks(
        backlog_size=backlog_size,
        throughput_samples=samples,
        n_sims=15,
        include_zero_weeks=True,
        draw_port=_prng_draw_port(99),
        batch_size=batch_size,
    )

    actual_censoring_state = (
        "absent"
        if expected.censored_count == 0
        else "total"
        if expected.completed_count == 0
        else "partial"
    )
    assert actual_censoring_state == censoring_state
    assert expected.completed_count == completed_count
    assert expected.censored_count == censored_count
    assert np.array_equal(actual.completed_weeks, expected.completed_weeks)
    assert actual.simulation_count == expected.simulation_count


@pytest.mark.parametrize("batch_size", [3, 4])
def test_mc_items_done_for_weeks_is_batch_independent(batch_size):
    samples = np.array([1, 2, 3, 4, 5, 6], dtype=int)
    expected = mc_items_done_for_weeks(
        weeks=9,
        throughput_samples=samples,
        n_sims=15,
        draw_port=_prng_draw_port(99),
    )
    actual = mc_items_done_for_weeks(
        weeks=9,
        throughput_samples=samples,
        n_sims=15,
        draw_port=_prng_draw_port(99),
        batch_size=batch_size,
    )

    assert np.array_equal(actual, expected)


def test_mc_finish_weeks_processes_incomplete_last_batch():
    draw_port = RecordingSampleIndexDrawPort()

    out = mc_finish_weeks(
        backlog_size=1,
        throughput_samples=np.array([1], dtype=int),
        n_sims=10,
        draw_port=draw_port,
        batch_size=4,
    )

    assert draw_port.requests == [
        (1, (4, SIMULATION_HORIZON_WEEKS_MAX)),
        (1, (4, SIMULATION_HORIZON_WEEKS_MAX)),
        (1, (2, SIMULATION_HORIZON_WEEKS_MAX)),
    ]
    assert np.all(out.completed_weeks == 1)
    assert out.censored_count == 0


def test_mc_finish_weeks_keeps_batched_draw_shapes_at_max_contract():
    draw_port = RecordingSampleIndexDrawPort()

    mc_finish_weeks(
        backlog_size=1,
        throughput_samples=np.array([1], dtype=int),
        n_sims=SIMULATION_N_SIMS_MAX,
        draw_port=draw_port,
        batch_size=4096,
    )

    assert draw_port.requests[0] == (
        1,
        (4096, SIMULATION_HORIZON_WEEKS_MAX),
    )
    assert draw_port.requests[-1] == (
        1,
        (
            SIMULATION_N_SIMS_MAX % 4096 or 4096,
            SIMULATION_HORIZON_WEEKS_MAX,
        ),
    )


def test_mc_items_done_for_weeks_processes_incomplete_last_batch():
    draw_port = RecordingSampleIndexDrawPort()

    out = mc_items_done_for_weeks(
        weeks=3,
        throughput_samples=np.array([5], dtype=int),
        n_sims=10,
        draw_port=draw_port,
        batch_size=4,
    )

    assert draw_port.requests == [(1, (4, 3)), (1, (4, 3)), (1, (2, 3))]
    assert np.array_equal(out, np.full(10, 15, dtype=int))


@pytest.mark.parametrize(
    "function_name, kwargs",
    [
        ("mc_finish_weeks", {"backlog_size": 10, "throughput_samples": np.array([1], dtype=int)}),
        ("mc_items_done_for_weeks", {"weeks": 3, "throughput_samples": np.array([1], dtype=int)}),
    ],
)
def test_simulation_batch_size_must_be_positive(function_name, kwargs):
    function = mc_finish_weeks if function_name == "mc_finish_weeks" else mc_items_done_for_weeks

    with pytest.raises(ValueError, match="batch_size"):
        function(
            n_sims=5,
            draw_port=_prng_draw_port(0),
            batch_size=0,
            **kwargs,
        )


def test_mc_finish_weeks_accepts_zero_only_samples_when_enabled():
    samples = np.array([0, 0, 0], dtype=int)
    out = mc_finish_weeks(
        backlog_size=1,
        throughput_samples=samples,
        n_sims=10,
        include_zero_weeks=True,
        draw_port=_prng_draw_port(1),
    )
    assert out.completed_weeks.size == 0
    assert out.censored_count == 10


def test_mc_finish_weeks_include_zero_rejects_all_negative_samples():
    with pytest.raises(ValueError):
        mc_finish_weeks(
            backlog_size=10,
            throughput_samples=np.array([-5, -1], dtype=int),
            include_zero_weeks=True,
            draw_port=_prng_draw_port(0),
        )


def test_mc_items_done_for_weeks_accepts_zero_samples_when_enabled():
    samples = np.array([0, 0, 1, 2], dtype=int)
    out = mc_items_done_for_weeks(
        weeks=4,
        throughput_samples=samples,
        n_sims=1000,
        include_zero_weeks=True,
        draw_port=_prng_draw_port(7),
    )
    assert out.shape == (1000,)
    assert int(out.min()) >= 0


def test_mc_items_done_for_weeks_include_zero_rejects_all_negative_samples():
    with pytest.raises(ValueError):
        mc_items_done_for_weeks(
            weeks=4,
            throughput_samples=np.array([-4, -1], dtype=int),
            include_zero_weeks=True,
            draw_port=_prng_draw_port(0),
        )


def test_histogram_buckets_empty_and_exact():
    assert build_histogram(np.array([], dtype=int)) == []

    buckets = build_histogram(np.array([1, 1, 2, 4, 4, 4], dtype=int))
    assert buckets == [
        {"x": 1, "count": 2},
        {"x": 2, "count": 1},
        {"x": 4, "count": 3},
    ]


def test_histogram_buckets_contiguous_range_uses_clipped_inclusive_bounds():
    buckets = build_histogram(np.arange(101, dtype=int))

    assert buckets == [
        {"x": representative, "count": 1 if representative == 100 else 2}
        for representative in range(0, 101, 2)
    ]
    assert len(buckets) == 51
    assert sum(bucket["count"] for bucket in buckets) == 101


@pytest.mark.parametrize(
    ("maximum", "expected"),
    [
        (
            10_000,
            [{"x": 50, "count": 100}, {"x": 9_999, "count": 1}],
        ),
        (
            1_000_000,
            [{"x": 5_000, "count": 100}, {"x": 995_049, "count": 1}],
        ),
    ],
)
def test_histogram_buckets_discontinuous_ranges_clip_the_extreme_right_bound(
    maximum: int,
    expected: list[dict[str, int]],
):
    data = np.concatenate((np.arange(100, dtype=int), np.array([maximum], dtype=int)))

    buckets = build_histogram(data)

    assert buckets == expected
    assert len(buckets) <= HISTOGRAM_MAX_BUCKETS
    assert all(bucket["count"] > 0 for bucket in buckets)
    assert all(
        left["x"] < right["x"]
        for left, right in zip(buckets, buckets[1:])
    )
    assert sum(bucket["count"] for bucket in buckets) == len(data)


def test_percentiles_default_public_keys_and_small_population_ranks():
    arr = np.array([1, 2, 3, 4, 5], dtype=int)
    p = percentiles(arr, "backlog_to_weeks", total_count=5)
    assert set(p.keys()) == {"P50", "P70", "P90"}
    assert p["P50"] == 3

    assert percentiles(
        np.array([1, 9], dtype=int),
        "backlog_to_weeks",
        total_count=2,
    ) == {"P50": 1, "P70": 9, "P90": 9}
    with pytest.raises(ValueError, match="uniquement"):
        percentiles(arr, "backlog_to_weeks", ps=(50, 80), total_count=5)
    with pytest.raises(ValueError, match="mode"):
        percentiles(arr, "invalid", total_count=5)


def test_percentiles_return_empty_mapping_when_no_completed_simulation_exists():
    assert (
        percentiles(
            np.array([], dtype=int),
            "backlog_to_weeks",
            ps=(50, 70, 90),
            total_count=1000,
        )
        == {}
    )


def test_percentiles_backlog_to_weeks_use_total_population_ranks():
    arr = np.array([3, 4, 6, 8, 10], dtype=int)

    p = percentiles(arr, "backlog_to_weeks", ps=(50, 70, 90), total_count=5)

    assert p == {"P50": 6, "P70": 8, "P90": 10}
    assert p["P50"] <= p["P70"] <= p["P90"]


@pytest.mark.parametrize(
    ("completed_count", "expected"),
    [
        (0, set()),
        (10, {"P50"}),
        (14, {"P50", "P70"}),
        (18, {"P50", "P70", "P90"}),
        (20, {"P50", "P70", "P90"}),
    ],
)
def test_percentiles_backlog_to_weeks_require_completion_rank_in_total_population(
    completed_count,
    expected,
):
    arr = np.arange(1, completed_count + 1, dtype=int)

    p = percentiles(arr, "backlog_to_weeks", ps=(50, 70, 90), total_count=20)

    assert set(p.keys()) == expected


@pytest.mark.parametrize("total_count", [None, 0, 4, 5.0])
def test_percentiles_backlog_to_weeks_require_explicit_total_population(total_count):
    with pytest.raises(ValueError, match="population totale"):
        percentiles(
            np.array([1, 2, 3, 4, 5], dtype=int),
            "backlog_to_weeks",
            total_count=total_count,
        )


def test_percentiles_weeks_to_items_use_survival_lower_quantiles():
    arr = np.array([18, 22, 24, 25, 27], dtype=int)

    p = percentiles(arr, "weeks_to_items", ps=(50, 70, 90))

    assert p == {"P50": 24, "P70": 22, "P90": 18}
    assert p["P50"] >= p["P70"] >= p["P90"]
    assert percentiles(np.array([], dtype=int), "weeks_to_items") == {}
    with pytest.raises(ValueError, match="interdit"):
        percentiles(arr, "weeks_to_items", total_count=5)


def test_throughput_reliability_marks_stable_history_as_fiable():
    result = _reliability(np.array([9, 10, 10, 11, 9, 10, 11, 10, 9, 10], dtype=int))

    assert result.label == "fiable"
    assert result.samples_count == 10
    assert result.cv < 0.5
    assert abs(result.slope_norm) < 0.05


def test_throughput_reliability_marks_volatile_history_as_fragile():
    result = _reliability(np.array([1, 12, 2, 14, 1, 15, 2, 13, 1, 16], dtype=int))

    assert result.label == "fragile"
    assert result.cv >= 1.0 or result.iqr_ratio >= 1.0


def test_throughput_reliability_marks_downward_trend_as_non_fiable():
    result = _reliability(np.array([20, 18, 16, 14, 12, 10, 8, 6], dtype=int))

    assert result.label == "non fiable"
    assert result.slope_norm <= -0.15


def test_throughput_reliability_marks_short_history_as_non_fiable():
    result = _reliability(np.array([8, 8, 8, 8, 8], dtype=int))

    assert result.label == "non fiable"
    assert result.samples_count == 5


def test_throughput_reliability_returns_expected_ratio_values_for_reference_series():
    result = _reliability(np.array([10, 20, 30, 40, 50, 60, 70, 80], dtype=int))

    assert result.cv == 0.5092
    assert result.iqr_ratio == 0.7778
    assert result.slope_norm == 0.2222
    assert result.label == "fragile"
    assert result.samples_count == 8
