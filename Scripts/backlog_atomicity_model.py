"""Shared immutable model for the backlog atomicity control."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BACKLOG = ROOT / "docs" / "backlog.md"
DEFAULT_GOVERNANCE = ROOT / "docs" / "backlog-governance.md"
DEFAULT_EXPECTATIONS = ROOT / "docs" / "backlog-expectations"
KNOWN_SIZES = {"XXS", "XS", "S", "M", "L", "XL"}
COMPLIANT = "Conforme au standard de granularité"
TO_REFINE = "À raffiner avant engagement"
REQUIRED_FIELDS = (
    "Taille",
    "Outcome",
    "Raison principale de changer",
    "Frontière principale",
    "Famille d’invariants",
    "Preuve principale",
    "Éléments de réalisation inclus",
    "Hors périmètre",
    "Surface prévisionnelle",
    "Prédécesseurs",
    "Critères de clôture",
)
COHESION_FIELDS = (
    "Outcome",
    "Raison principale de changer",
    "Frontière principale",
    "Famille d’invariants",
    "Preuve principale",
)
TASK_TITLE_RE = re.compile(
    r"^(?:Ancien(?:ne)? .+ retir(?:é|ée)|Import .+ bloqu(?:é|ée)|"
    r"Consommateur .+ migr(?:é|ée)|Documentation .+ publi(?:é|ée)|"
    r"Adaptateur .+ disponible|Mapper .+ disponible|"
    r"T[ée]l[ée]chargement .+ disponible)$",
    re.IGNORECASE,
)
FEATURE_RE = re.compile(r"^## Feature (?P<number>\d+) — (?P<title>.+)$", re.MULTILINE)
PBI_HEADING_RE = re.compile(
    r"^(?P<marks>#{2,6}) (?P<identifier>\d+\.\d+) — (?P<title>.+)$", re.MULTILINE
)
FIELD_RE = re.compile(r"^- \*\*(?P<name>[^*]+?) :\*\*\s*(?P<value>.*)$", re.MULTILINE)
SURFACE_RE = re.compile(
    r"(?P<production>\d+) fichiers? de production ; (?P<total>\d+) fichiers? versionnés?"
)


@dataclass(frozen=True)
class Diagnostic:
    feature: str
    pbi: str
    field: str
    observed: str
    rule: str
    expected: str

    def render(self) -> str:
        return (
            f"Feature={self.feature} | PBI={self.pbi} | Champ={self.field} | "
            f"Valeur observée={self.observed!r} | Règle violée={self.rule} | "
            f"Correction attendue={self.expected}"
        )


@dataclass(frozen=True)
class Pbi:
    identifier: str
    title: str
    size: str
    completed_on: str
    feature: int


@dataclass(frozen=True)
class Feature:
    number: int
    title: str
    pbis: tuple[Pbi, ...]

    @property
    def complete(self) -> bool:
        return all(pbi.completed_on for pbi in self.pbis)


@dataclass(frozen=True)
class Section:
    identifier: str
    feature: int | None
    level: int
    fields: dict[str, tuple[str, ...]]
    source: str


def diagnostic(
    feature: int | str,
    pbi: str,
    field: str,
    observed: object,
    rule: str,
    expected: str,
) -> Diagnostic:
    label = str(feature) if str(feature).startswith("Feature") else f"Feature {feature}"
    return Diagnostic(label, pbi, field, str(observed), rule, expected)
