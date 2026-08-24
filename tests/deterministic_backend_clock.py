from __future__ import annotations

from datetime import datetime


class DeterministicBackendClock:
    """Return one controlled instant and record every clock read."""

    def __init__(self, instant: datetime) -> None:
        self._instant = instant
        self.calls = 0

    def now(self) -> datetime:
        self.calls += 1
        return self._instant
