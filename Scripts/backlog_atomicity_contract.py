"""Validate one outcome contract without forcing implementation micro-PBIs."""

from __future__ import annotations

from Scripts.backlog_atomicity_model import (
    COHESION_FIELDS,
    REQUIRED_FIELDS,
    SURFACE_RE,
    TASK_TITLE_RE,
    Diagnostic,
    Pbi,
    Section,
    diagnostic,
)


def _required_errors(pbi: Pbi, section: Section) -> list[Diagnostic]:
    errors = []
    for name in REQUIRED_FIELDS:
        values = section.fields.get(name, ())
        if len(values) != 1 or not values[0]:
            observed = "absent" if not values else values
            errors.append(
                diagnostic(
                    pbi.feature,
                    pbi.identifier,
                    name,
                    observed,
                    "champ obligatoire absent, vide ou répété",
                    "déclarer exactement une valeur non vide",
                )
            )
    return errors


def _cohesion_errors(pbi: Pbi, section: Section) -> list[Diagnostic]:
    """Reject explicit lists in singular metadata, not conjunctions in prose."""
    errors = []
    for name in COHESION_FIELDS:
        values = section.fields.get(name, ())
        if len(values) == 1 and ";" in values[0]:
            errors.append(
                diagnostic(
                    pbi.feature,
                    pbi.identifier,
                    name,
                    values[0],
                    "plusieurs valeurs explicites dans un champ principal",
                    "déclarer un contenu principal ou raffiner les outcomes indépendants",
                )
            )
    return errors


def _surface_errors(pbi: Pbi, section: Section) -> list[Diagnostic]:
    values = section.fields.get("Surface prévisionnelle", ())
    if len(values) != 1:
        return []
    match = SURFACE_RE.fullmatch(values[0])
    if not match:
        return [
            diagnostic(
                pbi.feature,
                pbi.identifier,
                "Surface prévisionnelle",
                values[0],
                "format de surface invalide",
                "utiliser `N fichiers de production ; N fichiers versionnés`",
            )
        ]
    production, total = int(match.group("production")), int(match.group("total"))
    if production > total:
        return [
            diagnostic(
                pbi.feature,
                pbi.identifier,
                "Surface prévisionnelle",
                values[0],
                "surface incohérente",
                "déclarer un total versionné au moins égal aux fichiers de production",
            )
        ]
    if production <= 8 and total <= 15:
        return []
    reviews = section.fields.get("Justification de cohésion", ())
    if len(reviews) == 1 and reviews[0]:
        return []
    return [
        diagnostic(
            pbi.feature,
            pbi.identifier,
            "Surface prévisionnelle",
            values[0],
            "signal de revue de découpage non traité",
            "ajouter une `Justification de cohésion` ou raffiner le PBI",
        )
    ]


def _task_title_errors(pbi: Pbi, section: Section) -> list[Diagnostic]:
    if not TASK_TITLE_RE.fullmatch(pbi.title):
        return []
    justifications = section.fields.get("Justification du titre opératoire", ())
    if len(justifications) == 1 and justifications[0]:
        return []
    return [
        diagnostic(
            pbi.feature,
            pbi.identifier,
            "Titre",
            pbi.title,
            "titre ressemblant à une tâche sans revue d’autonomie",
            "fusionner l’opération dans son outcome parent ou justifier sa valeur autonome",
        )
    ]


def field_errors(pbi: Pbi, section: Section | None) -> list[Diagnostic]:
    if section is None:
        return [
            diagnostic(
                pbi.feature,
                pbi.identifier,
                "Section d’attendus",
                "absente",
                "attendus de granularité absents",
                "ajouter la section et tous les champs obligatoires",
            )
        ]
    errors = [*_required_errors(pbi, section), *_cohesion_errors(pbi, section)]
    errors.extend(_surface_errors(pbi, section))
    errors.extend(_task_title_errors(pbi, section))
    if section.level != 2:
        errors.append(
            diagnostic(
                pbi.feature,
                pbi.identifier,
                "Section d’attendus",
                f"niveau {section.level}",
                "niveau de titre invalide",
                "utiliser `## X.Y — Titre`",
            )
        )
    size_values = section.fields.get("Taille", ())
    if len(size_values) == 1 and size_values[0] != pbi.size:
        errors.append(
            diagnostic(
                pbi.feature,
                pbi.identifier,
                "Taille",
                size_values[0],
                "taille incohérente avec le registre",
                f"déclarer {pbi.size}",
            )
        )
    if pbi.size == "M" and len(section.fields.get("Justification de la taille M", ())) != 1:
        errors.append(
            diagnostic(
                pbi.feature,
                pbi.identifier,
                "Justification de la taille M",
                "absente ou répétée",
                "taille M non justifiée",
                "expliquer pourquoi la difficulté reste limitée à un outcome",
            )
        )
    return errors
