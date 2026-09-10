from __future__ import annotations

from ...ports.history import (
    SimulationHistoryEntry,
    SimulationHistoryQuery,
    SimulationRepository,
)


class ListSimulationHistory:
    """Read recent simulation histories through the application persistence port."""

    def __init__(self, repository: SimulationRepository) -> None:
        self._repository = repository

    def execute(
        self,
        query: SimulationHistoryQuery,
    ) -> tuple[SimulationHistoryEntry, ...]:
        return self._repository.read_history(query)
