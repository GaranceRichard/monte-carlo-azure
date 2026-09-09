"""Shared values emitted by the technical DTO confinement rule."""

from __future__ import annotations

import re
from dataclasses import dataclass

from Scripts.dependency_authority_domain import LocatedDiagnostic

DTO_NAME = re.compile(r"(?:Dto|DTO)(?:s)?(?:V[0-9]+)?$")


@dataclass(frozen=True)
class DtoDeclaration:
    source: str
    name: str
    line: int


@dataclass(frozen=True)
class DtoExposure:
    source: str
    symbol: str
    dto_names: tuple[str, ...]
    line: int


@dataclass(frozen=True)
class DtoConfinementResult:
    files: int
    technical_boundaries: int
    declarations: int
    boundary_references: int
    diagnostics: tuple[LocatedDiagnostic, ...]

    @property
    def violations(self) -> int:
        return len(self.diagnostics)


class DtoConfinementInspectionError(RuntimeError):
    """Raised when technical DTO ownership cannot be inspected completely."""


def dto_names_in_text(text: str, names: set[str]) -> tuple[str, ...]:
    return tuple(
        name for name in sorted(names) if re.search(rf"\b{re.escape(name)}\b", text)
    )
