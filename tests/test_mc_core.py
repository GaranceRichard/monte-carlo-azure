import numpy as np

from backend.mc_core import mc_finish_weeks


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
