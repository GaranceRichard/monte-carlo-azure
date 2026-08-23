"""Shared diagnostic contract for the dependency authority parser."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Diagnostic:
    """One deterministic, localized and actionable authority defect."""

    code: str
    location: str
    message: str
    hint: str

    def render(self, source: Path | str) -> str:
        return f"{source}:{self.location}: [{self.code}] {self.message} Correction: {self.hint}"
