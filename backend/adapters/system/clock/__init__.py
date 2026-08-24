from __future__ import annotations

from datetime import datetime, timezone


class SystemUtcClock:
    """Read the current UTC instant from the host system clock."""

    def now(self) -> datetime:
        return datetime.now(timezone.utc)
