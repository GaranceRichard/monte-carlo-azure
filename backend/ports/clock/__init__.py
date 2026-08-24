from __future__ import annotations

from datetime import datetime
from typing import Protocol


class BackendClock(Protocol):
    """Provide the UTC instant required by backend history use cases."""

    def now(self) -> datetime:
        """Return a timezone-aware UTC instant."""

        ...
