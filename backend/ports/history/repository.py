from __future__ import annotations

from typing import Protocol, runtime_checkable

from .contracts import (
    SimulationHistoryEntry,
    SimulationHistoryQuery,
    SimulationHistoryToSave,
)


@runtime_checkable
class SimulationRepository(Protocol):
    """Save and read simulation histories without exposing storage technology."""

    def save_history(self, history: SimulationHistoryToSave) -> None:
        """Save one completed simulation history."""

        ...

    def read_history(
        self,
        query: SimulationHistoryQuery,
    ) -> tuple[SimulationHistoryEntry, ...]:
        """Read recent histories for the query in repository-defined order."""

        ...
