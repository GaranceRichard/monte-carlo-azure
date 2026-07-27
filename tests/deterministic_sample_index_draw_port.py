from __future__ import annotations

import numpy as np

from backend.sample_index_draw_port import SampleIndexDrawShape


class DeterministicSampleIndexDrawPort:
    """Double qui consomme une sequence exacte et detecte tout ecart de tirage."""

    def __init__(self, sample_indices: list[int]) -> None:
        self._sample_indices = tuple(sample_indices)
        self._position = 0
        self.requests: list[tuple[int, SampleIndexDrawShape]] = []

    def draw_sample_indices(
        self,
        sample_count: int,
        shape: SampleIndexDrawShape,
    ) -> np.ndarray:
        requested_count = shape[0] * shape[1]
        stop = self._position + requested_count
        if stop > len(self._sample_indices):
            raise AssertionError("consommation excessive d'indices")

        values = self._sample_indices[self._position : stop]
        if any(
            type(value) is not int or value < 0 or value >= sample_count
            for value in values
        ):
            raise AssertionError("indice de test hors bornes")

        self.requests.append((sample_count, shape))
        self._position = stop
        return np.asarray(values, dtype=np.int64).reshape(shape)

    def assert_exhausted(self) -> None:
        if self._position != len(self._sample_indices):
            raise AssertionError("consommation insuffisante d'indices")


class RecordingSampleIndexDrawPort:
    """Double constant adapte aux grandes formes vectorisees."""

    def __init__(self, sample_index: int = 0) -> None:
        self._sample_index = sample_index
        self.requests: list[tuple[int, SampleIndexDrawShape]] = []

    def draw_sample_indices(
        self,
        sample_count: int,
        shape: SampleIndexDrawShape,
    ) -> np.ndarray:
        if (
            type(self._sample_index) is not int
            or self._sample_index < 0
            or self._sample_index >= sample_count
        ):
            raise AssertionError("indice de test hors bornes")
        self.requests.append((sample_count, shape))
        return np.full(shape, self._sample_index, dtype=np.int64)
