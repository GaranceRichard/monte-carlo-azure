import numpy as np
import pytest

from backend.mc_core import (
    histogram_buckets,
    mc_finish_weeks,
    mc_items_done_for_weeks,
    percentiles,
)


def test_mc_finish_weeks_shape_and_bounds():
    samples = np.array([2, 3, 4, 5], dtype=int)
    out = mc_finish_weeks(backlog_size=50, throughput_samples=samples, n_sims=5000, seed=123)

    assert out.shape == (5000,)
    assert np.issubdtype(out.dtype, np.integer)
    assert int(out.min()) >= 1
    assert int(out.max()) <= 521


def test_mc_finish_weeks_reproducible_for_seed():
    samples = np.array([1, 2, 3], dtype=int)
    a = mc_finish_weeks(backlog_size=30, throughput_samples=samples, n_sims=2000, seed=42)
    b = mc_finish_weeks(backlog_size=30, throughput_samples=samples, n_sims=2000, seed=42)

    assert np.array_equal(a, b)


def test_mc_finish_weeks_backlog_size_one():
    samples = np.array([1, 2, 3], dtype=int)
    out = mc_finish_weeks(backlog_size=1, throughput_samples=samples, n_sims=200, seed=1)
    assert out.shape == (200,)
    assert np.all(out == 1)


def test_mc_finish_weeks_single_value_samples():
    samples = np.array([2], dtype=int)
    out = mc_finish_weeks(backlog_size=11, throughput_samples=samples, n_sims=100, seed=1)
    assert np.all(out == 6)


def test_mc_finish_weeks_large_backlog_hits_cap():
    samples = np.array([1], dtype=int)
    out = mc_finish_weeks(backlog_size=10_000, throughput_samples=samples, n_sims=50, seed=1)
    assert np.all(out == 521)


def test_mc_finish_weeks_invalid_inputs():
    with pytest.raises(ValueError):
        mc_finish_weeks(backlog_size=0, throughput_samples=np.array([1, 2], dtype=int))
    with pytest.raises(ValueError):
        mc_finish_weeks(backlog_size=10, throughput_samples=np.array([], dtype=int))
    with pytest.raises(ValueError):
        mc_finish_weeks(backlog_size=10, throughput_samples=np.array([0, 0], dtype=int))


def test_mc_items_done_for_weeks_shape_and_reproducible():
    samples = np.array([1, 2, 3], dtype=int)
    a = mc_items_done_for_weeks(weeks=8, throughput_samples=samples, n_sims=3000, seed=123)
    b = mc_items_done_for_weeks(weeks=8, throughput_samples=samples, n_sims=3000, seed=123)
    assert a.shape == (3000,)
    assert np.array_equal(a, b)
    assert int(a.min()) >= 8


def test_mc_items_done_for_weeks_single_sample_value():
    samples = np.array([3], dtype=int)
    out = mc_items_done_for_weeks(weeks=7, throughput_samples=samples, n_sims=25, seed=5)
    assert np.all(out == 21)


def test_mc_items_done_for_weeks_invalid_inputs():
    with pytest.raises(ValueError):
        mc_items_done_for_weeks(weeks=0, throughput_samples=np.array([1, 2], dtype=int))
    with pytest.raises(ValueError):
        mc_items_done_for_weeks(weeks=2, throughput_samples=np.array([], dtype=int))
    with pytest.raises(ValueError):
        mc_items_done_for_weeks(weeks=2, throughput_samples=np.array([0, 0], dtype=int))


def test_mc_items_done_for_weeks_accepts_zero_samples_when_enabled():
    samples = np.array([0, 0, 1, 2], dtype=int)
    out = mc_items_done_for_weeks(
        weeks=4,
        throughput_samples=samples,
        n_sims=1000,
        include_zero_weeks=True,
        seed=7,
    )
    assert out.shape == (1000,)
    assert int(out.min()) >= 0


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


def test_percentiles_default_and_custom():
    arr = np.array([1, 2, 3, 4, 5], dtype=int)
    p = percentiles(arr)
    assert set(p.keys()) == {"P50", "P80", "P90"}
    assert p["P50"] == 3

    p2 = percentiles(arr, ps=(25, 75))
    assert set(p2.keys()) == {"P25", "P75"}
