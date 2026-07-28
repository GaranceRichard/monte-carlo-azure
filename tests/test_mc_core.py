import numpy as np
import pytest

from backend.mc_core import (
    FinishWeeksSimulation,
    _discrete_quantile,
    histogram_buckets,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
    throughput_reliability_metrics,
)
from backend.mca_prng_v1_sample_index_draw_port import McaPrngV1SampleIndexDrawPort
from backend.simulation_limits import SIMULATION_HORIZON_WEEKS_MAX, SIMULATION_N_SIMS_MAX
from backend.simulation_value_objects import SimulationSeed, ThroughputReliability
from tests.deterministic_sample_index_draw_port import (
    DeterministicSampleIndexDrawPort,
    RecordingSampleIndexDrawPort,
)


def _prng_draw_port(seed: int) -> McaPrngV1SampleIndexDrawPort:
    return McaPrngV1SampleIndexDrawPort(SimulationSeed(seed))


def _reliability(samples: np.ndarray) -> ThroughputReliability:
    return ThroughputReliability.create(**throughput_reliability_metrics(samples))


def test_empty_finish_result_and_discrete_quantile_guardrails():
    result = FinishWeeksSimulation(
        weeks_needed=np.array([], dtype=int),
        completed_mask=np.array([], dtype=bool),
        horizon_weeks=10,
    )
    assert result.censored_rate == 0.0
    with pytest.raises(ValueError, match="arr est vide"):
        _discrete_quantile(np.array([], dtype=int), 0.5, method="higher")
    with pytest.raises(ValueError, match="throughput_samples est vide"):
        throughput_reliability_metrics(np.array([], dtype=int))


def test_throughput_reliability_marks_moderate_trend_as_incertain():
    assert _reliability(np.arange(7, 15)).label == "incertain"


def test_mc_finish_weeks_shape_and_bounds():
    samples = np.array([2, 3, 4, 5], dtype=int)
    out = mc_finish_weeks(
        backlog_size=50,
        throughput_samples=samples,
        n_sims=5000,
        draw_port=_prng_draw_port(123),
    )

    assert out.weeks_needed.shape == (5000,)
    assert np.issubdtype(out.weeks_needed.dtype, np.integer)
    assert int(out.weeks_needed.min()) >= 1
    assert int(out.weeks_needed.max()) <= SIMULATION_HORIZON_WEEKS_MAX
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

    assert np.array_equal(a.weeks_needed, b.weeks_needed)
    assert np.array_equal(a.completed_mask, b.completed_mask)


def test_mc_finish_weeks_backlog_size_one():
    samples = np.array([1, 2, 3], dtype=int)
    out = mc_finish_weeks(
        backlog_size=1,
        throughput_samples=samples,
        n_sims=200,
        draw_port=_prng_draw_port(1),
    )
    assert out.weeks_needed.shape == (200,)
    assert np.all(out.weeks_needed == 1)
    assert np.all(out.completed_mask)


def test_mc_finish_weeks_single_value_samples():
    samples = np.array([2], dtype=int)
    out = mc_finish_weeks(
        backlog_size=11,
        throughput_samples=samples,
        n_sims=100,
        draw_port=_prng_draw_port(1),
    )
    assert np.all(out.weeks_needed == 6)
    assert np.all(out.completed_mask)


def test_mc_finish_weeks_large_backlog_hits_cap():
    samples = np.array([1], dtype=int)
    out = mc_finish_weeks(
        backlog_size=10_000,
        throughput_samples=samples,
        n_sims=50,
        draw_port=_prng_draw_port(1),
    )
    assert np.all(out.weeks_needed == SIMULATION_HORIZON_WEEKS_MAX)
    assert not np.any(out.completed_mask)
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
    draw_port = DeterministicSampleIndexDrawPort(
        [*first_simulation, *second_simulation]
    )

    result = mc_finish_weeks(
        backlog_size=3,
        throughput_samples=np.array([0, 2], dtype=int),
        n_sims=2,
        include_zero_weeks=True,
        draw_port=draw_port,
        batch_size=2,
    )

    assert result.weeks_needed.tolist() == [2, SIMULATION_HORIZON_WEEKS_MAX]
    assert result.completed_mask.tolist() == [True, False]
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

    assert np.array_equal(finish.weeks_needed, repeated_finish.weeks_needed)
    assert np.array_equal(finish.completed_mask, repeated_finish.completed_mask)
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
    assert np.array_equal(actual.weeks_needed, expected.weeks_needed)
    assert np.array_equal(actual.completed_mask, expected.completed_mask)


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
    assert np.all(out.weeks_needed == 1)
    assert np.all(out.completed_mask)


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


@pytest.mark.parametrize("function_name, kwargs", [
    ("mc_finish_weeks", {"backlog_size": 10, "throughput_samples": np.array([1], dtype=int)}),
    ("mc_items_done_for_weeks", {"weeks": 3, "throughput_samples": np.array([1], dtype=int)}),
])
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
    assert np.all(out.weeks_needed == 521)
    assert not np.any(out.completed_mask)


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
    assert histogram_buckets(np.array([], dtype=int)) == []

    buckets = histogram_buckets(np.array([1, 1, 2, 4, 4, 4], dtype=int), max_buckets=10)
    assert buckets == [
        {"x": 1, "count": 2},
        {"x": 2, "count": 1},
        {"x": 4, "count": 3},
    ]


def test_histogram_buckets_aggregated_bin_count_and_mass():
    data = np.arange(0, 1000, dtype=int)
    buckets = histogram_buckets(data, max_buckets=20)
    assert len(buckets) <= 20
    assert sum(b["count"] for b in buckets) == len(data)
    assert all(isinstance(b["x"], int) and isinstance(b["count"], int) for b in buckets)


def test_histogram_buckets_aggregated_skips_zero_count_bins():
    data = np.array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1000], dtype=int)
    buckets = histogram_buckets(data, max_buckets=10)
    assert len(buckets) == 2
    assert sum(b["count"] for b in buckets) == len(data)


def test_percentiles_default_and_custom():
    arr = np.array([1, 2, 3, 4, 5], dtype=int)
    p = percentiles(arr, "backlog_to_weeks")
    assert set(p.keys()) == {"P50", "P80", "P90"}
    assert p["P50"] == 3

    p2 = percentiles(arr, "backlog_to_weeks", ps=(25, 75))
    assert set(p2.keys()) == {"P25", "P75"}


def test_percentiles_return_empty_mapping_when_no_completed_simulation_exists():
    assert percentiles(np.array([], dtype=int), "backlog_to_weeks", ps=(50, 70, 90)) == {}


def test_percentiles_backlog_to_weeks_use_conservative_higher_quantiles():
    arr = np.array([3, 4, 6, 8, 10], dtype=int)

    p = percentiles(arr, "backlog_to_weeks", ps=(50, 70, 90))

    assert p == {"P50": 6, "P70": 8, "P90": 10}
    assert p["P50"] <= p["P70"] <= p["P90"]


@pytest.mark.parametrize(
    ("completed_count", "expected"),
    [
        (0, set()),
        (10, {"P50"}),
        (17, {"P50", "P70", "P85"}),
        (18, {"P50", "P70", "P85", "P90"}),
        (20, {"P50", "P70", "P85", "P90", "P100"}),
    ],
)
def test_percentiles_backlog_to_weeks_require_completion_rank_in_total_population(
    completed_count,
    expected,
):
    arr = np.arange(1, completed_count + 1, dtype=int)

    p = percentiles(arr, "backlog_to_weeks", ps=(50, 70, 85, 90, 100), total_count=20)

    assert set(p.keys()) == expected


def test_percentiles_weeks_to_items_use_survival_lower_quantiles():
    arr = np.array([18, 22, 24, 25, 27], dtype=int)

    p = percentiles(arr, "weeks_to_items", ps=(50, 70, 90))

    assert p == {"P50": 24, "P70": 22, "P90": 18}
    assert p["P50"] >= p["P70"] >= p["P90"]


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
