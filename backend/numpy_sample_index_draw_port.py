from __future__ import annotations

import numpy as np

from .sample_index_draw_port import SampleIndexDrawShape
from .simulation_value_objects import SimulationSeed


class NumpySampleIndexDrawPort:
    """Adaptateur conservant exactement les tirages NumPy historiques."""

    def __init__(self, seed: SimulationSeed) -> None:
        self._generator = np.random.default_rng(seed.value)

    def draw_sample_indices(
        self,
        sample_count: int,
        shape: SampleIndexDrawShape,
    ) -> np.ndarray:
        if type(sample_count) is not int or sample_count <= 0:
            raise ValueError("sample_count doit etre un entier > 0")
        if (
            type(shape) is not tuple
            or len(shape) != 2
            or any(type(dimension) is not int or dimension <= 0 for dimension in shape)
        ):
            raise ValueError("shape doit contenir deux dimensions entieres > 0")
        return self._generator.integers(0, sample_count, size=shape)
