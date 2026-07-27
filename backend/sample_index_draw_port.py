from __future__ import annotations

from typing import Protocol, TypeAlias

import numpy as np

SampleIndexDrawShape: TypeAlias = tuple[int, int]


class SampleIndexDrawPort(Protocol):
    """Port metier de tirage d'indices, sans seed ni generateur concret expose.

    La forme matricielle preserve les tirages vectorises et le batching du moteur
    Python sans multiplier les appels unitaires.
    """

    def draw_sample_indices(
        self,
        sample_count: int,
        shape: SampleIndexDrawShape,
    ) -> np.ndarray:
        """Retourne des entiers de ``shape`` appartenant a [0, sample_count)."""

        ...
