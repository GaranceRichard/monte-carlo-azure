from __future__ import annotations

import numpy as np

from .sample_index_draw_port import SampleIndexDrawShape
from .simulation_value_objects import SimulationSeed

MCA_PRNG_V1_CONTRACT_ID = "mca-prng-v1"

_UINT32_MASK = np.uint64(0xFFFFFFFF)
_UINT32_RANGE = 1 << 32
_STATE_INCREMENT = np.uint64(0x6D2B79F5)
_MAX_SAMPLE_COUNT = 1 << 63


def _imul32(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    product = left.astype(np.uint64) * right.astype(np.uint64)
    return np.bitwise_and(product, _UINT32_MASK).astype(np.uint32)


class McaPrngV1SampleIndexDrawPort:
    """Adaptateur vectorise du contrat commun ``mca-prng-v1``."""

    __slots__ = ("_state",)

    def __init__(self, seed: SimulationSeed) -> None:
        self._state = np.uint32(seed.value)

    def _draw_uint32_values(self, draw_count: int) -> np.ndarray:
        offsets = np.arange(1, draw_count + 1, dtype=np.uint64)
        states = np.bitwise_and(
            np.uint64(self._state) + offsets * _STATE_INCREMENT,
            _UINT32_MASK,
        ).astype(np.uint32)

        t = _imul32(
            np.bitwise_xor(states, np.right_shift(states, 15)),
            np.bitwise_or(states, np.uint32(1)),
        )
        mixed = _imul32(
            np.bitwise_xor(t, np.right_shift(t, 7)),
            np.bitwise_or(t, np.uint32(61)),
        )
        t = np.bitwise_xor(
            t,
            np.bitwise_and(
                t.astype(np.uint64) + mixed.astype(np.uint64),
                _UINT32_MASK,
            ).astype(np.uint32),
        )
        values = np.bitwise_xor(t, np.right_shift(t, 14)).astype(
            np.uint32,
            copy=False,
        )

        self._state = states[-1]
        return values

    def draw_uint32(self, draw_count: int) -> np.ndarray:
        """Consomme et retourne des sorties primitives uint32 du contrat."""

        if type(draw_count) is not int or draw_count <= 0:
            raise ValueError("draw_count doit etre un entier > 0")
        return self._draw_uint32_values(draw_count)

    def draw_sample_indices(
        self,
        sample_count: int,
        shape: SampleIndexDrawShape,
    ) -> np.ndarray:
        if (
            type(sample_count) is not int
            or sample_count <= 0
            or sample_count > _MAX_SAMPLE_COUNT
        ):
            raise ValueError("sample_count doit etre un entier > 0")
        if (
            type(shape) is not tuple
            or len(shape) != 2
            or any(type(dimension) is not int or dimension <= 0 for dimension in shape)
        ):
            raise ValueError("shape doit contenir deux dimensions entieres > 0")

        draw_count = shape[0] * shape[1]
        values = self._draw_uint32_values(draw_count)
        values_uint64 = values.astype(np.uint64)
        high, low = divmod(sample_count, _UINT32_RANGE)
        high_products = values_uint64 * np.uint64(high)
        low_products = values_uint64 * np.uint64(low)
        indices = (
            high_products + np.right_shift(low_products, 32)
        ).astype(np.int64)
        return indices.reshape(shape, order="C")
