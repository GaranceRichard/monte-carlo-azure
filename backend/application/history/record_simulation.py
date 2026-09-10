from __future__ import annotations

from ...ports.history import SimulationHistoryToSave, SimulationRepository


class RecordSimulation:
    """Record a completed simulation through the application persistence port."""

    def __init__(self, repository: SimulationRepository) -> None:
        self._repository = repository

    def execute(self, history: SimulationHistoryToSave) -> None:
        self._repository.save_history(history)
