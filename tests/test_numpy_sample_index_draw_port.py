import numpy as np
import pytest

from backend.numpy_sample_index_draw_port import NumpySampleIndexDrawPort
from backend.simulation_value_objects import SimulationSeed


def test_numpy_draw_port_matches_default_rng_across_successive_vectorized_draws():
    seed = SimulationSeed(987_654_321)
    expected = np.random.default_rng(seed.value)
    draw_port = NumpySampleIndexDrawPort(seed)

    assert np.array_equal(
        draw_port.draw_sample_indices(7, (2, 3)),
        expected.integers(0, 7, size=(2, 3)),
    )
    assert np.array_equal(
        draw_port.draw_sample_indices(5, (1, 4)),
        expected.integers(0, 5, size=(1, 4)),
    )


@pytest.mark.parametrize("sample_count", [0, -1, 1.5, True])
def test_numpy_draw_port_rejects_invalid_sample_count(sample_count):
    draw_port = NumpySampleIndexDrawPort(SimulationSeed(1))

    with pytest.raises(ValueError, match="sample_count"):
        draw_port.draw_sample_indices(sample_count, (1, 1))


@pytest.mark.parametrize(
    "shape",
    [
        [1, 1],
        (1,),
        (1, 1, 1),
        (0, 1),
        (1, -1),
        (1.5, 1),
        (True, 1),
    ],
)
def test_numpy_draw_port_rejects_invalid_vectorized_shape(shape):
    draw_port = NumpySampleIndexDrawPort(SimulationSeed(1))

    with pytest.raises(ValueError, match="shape"):
        draw_port.draw_sample_indices(1, shape)
