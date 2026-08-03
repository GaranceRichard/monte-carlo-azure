"""Compose the independent structural rules of backlog atomicity."""

from __future__ import annotations

import re

from Scripts.backlog_atomicity_contract import field_errors
from Scripts.backlog_atomicity_feature7 import feature_seven_errors
from Scripts.backlog_atomicity_graph import validate_graph
from Scripts.backlog_atomicity_model import (
    COMPLIANT,
    TO_REFINE,
    Diagnostic,
    Feature,
    Pbi,
    Section,
    diagnostic,
)
from Scripts.backlog_atomicity_parsing import (
    parse_expectations,
    parse_readiness,
    parse_registry,
)


def _section_alignment_errors(
    sections: dict[str, Section], pbis: dict[str, Pbi]
) -> list[Diagnostic]:
    errors = []
    for identifier, section in sections.items():
        expected_feature = int(identifier.split(".")[0])
        if identifier not in pbis or section.feature != expected_feature:
            errors.append(
                diagnostic(
                    expected_feature,
                    identifier,
                    "Section d’attendus",
                    section.source,
                    "section orpheline ou rangée sous la mauvaise Feature",
                    "supprimer la section ou la rattacher au PBI exact du registre",
                )
            )
    return errors


def _readiness_errors(features: dict[int, Feature], statuses: dict[int, str]) -> list[Diagnostic]:
    errors = []
    for feature in features.values():
        if feature.complete:
            continue
        status = statuses.get(feature.number)
        if status not in {COMPLIANT, TO_REFINE}:
            errors.append(
                diagnostic(
                    feature.number,
                    "tous",
                    "Statut de préparation",
                    status or "absent",
                    "Feature ouverte sans statut reconnu",
                    f"déclarer `{COMPLIANT}` ou `{TO_REFINE}`",
                )
            )
        errors.extend(
            diagnostic(
                feature.number,
                pbi.identifier,
                "Réalisé le",
                pbi.completed_on,
                "date dans une Feature non réalisée",
                "laisser toutes les dates vides jusqu’à la réalisation de la Feature",
            )
            for pbi in feature.pbis
            if pbi.completed_on
        )
    return errors


def _target_pbis(
    features: dict[int, Feature], statuses: dict[int, str], priority: int | None
) -> dict[str, Pbi]:
    numbers = {number for number, status in statuses.items() if status == COMPLIANT}
    if priority in features:
        numbers.add(priority)
    return {
        pbi.identifier: pbi
        for number in numbers
        for pbi in features.get(number, Feature(number, "", ())).pbis
    }


def _size_error(pbi: Pbi) -> Diagnostic | None:
    if pbi.size not in {"L", "XL"}:
        return None
    return diagnostic(
        pbi.feature,
        pbi.identifier,
        "Taille",
        pbi.size,
        "taille non engageable pour cette Feature",
        "raffiner avant engagement",
    )


def _contract_errors(
    targets: dict[str, Pbi], sections: dict[str, Section]
) -> tuple[dict[str, list[Diagnostic]], list[Diagnostic]]:
    by_pbi = {}
    errors = []
    seen_justifications: set[str] = set()
    for identifier, pbi in targets.items():
        current = field_errors(pbi, sections.get(identifier))
        size_issue = _size_error(pbi)
        if size_issue:
            current.append(size_issue)
        section = sections.get(identifier)
        justifications = section.fields.get("Justification de la taille M", ()) if section else ()
        if pbi.size == "M" and len(justifications) == 1:
            if justifications[0] in seen_justifications:
                current.append(
                    diagnostic(
                        pbi.feature,
                        identifier,
                        "Justification de la taille M",
                        justifications[0],
                        "justification copiée",
                        "fournir une justification spécifique au PBI",
                    )
                )
            seen_justifications.add(justifications[0])
        by_pbi[identifier] = current
        errors.extend(current)
    return by_pbi, errors


def _feature_seven_content(expectations: dict[str, str]) -> str:
    return next(
        (
            content
            for content in expectations.values()
            if re.search(r"^# Feature 7 —", content, re.MULTILINE)
        ),
        "",
    )


def _feature_seven_m_justifications(
    feature: Feature, sections: dict[str, Section]
) -> dict[str, str]:
    return {
        pbi.identifier: (
            sections[pbi.identifier].fields.get("Justification de la taille M", ("",))[0]
            if pbi.identifier in sections
            else ""
        )
        for pbi in feature.pbis
        if pbi.size == "M"
    }


def _feature_seven_review_errors(
    feature: Feature,
    content: str,
    contracts: dict[str, list[Diagnostic]],
    sections: dict[str, Section],
    cycles: list[tuple[str, ...]],
    graph_errors: list[Diagnostic],
) -> list[Diagnostic]:
    invalid = {
        identifier
        for identifier, issues in contracts.items()
        if identifier.startswith("7.") and issues
    }
    invalid.update(issue.pbi for issue in graph_errors if issue.pbi.startswith("7."))
    feature_cycles = [cycle for cycle in cycles if cycle[0].startswith("7.")]
    future_predecessors = sum(
        issue.pbi.startswith("7.")
        and issue.rule == "prédécesseur futur ou réflexif invalide"
        for issue in graph_errors
    )
    return feature_seven_errors(
        content,
        feature,
        feature_cycles,
        invalid,
        future_predecessors,
        _feature_seven_m_justifications(feature, sections),
    )


def validate_atomicity(
    backlog: str, governance: str, expectations: dict[str, str]
) -> tuple[Diagnostic, ...]:
    features, pbis, errors = parse_registry(backlog)
    sections, section_errors = parse_expectations(expectations)
    priority, statuses, readiness_parse_errors = parse_readiness(governance)
    errors.extend(section_errors + readiness_parse_errors)
    errors.extend(_section_alignment_errors(sections, pbis))
    errors.extend(_readiness_errors(features, statuses))
    if priority not in features or statuses.get(priority) != COMPLIANT:
        errors.append(
            diagnostic(
                priority or "Dépôt",
                "tous",
                "Feature prioritaire",
                priority,
                "Feature prioritaire absente ou non conforme",
                "prioriser une Feature déclarée conforme",
            )
        )
    targets = _target_pbis(features, statuses, priority)
    contracts, contract_errors = _contract_errors(targets, sections)
    errors.extend(contract_errors)
    graph, cycles, graph_errors = validate_graph(targets, sections, pbis)
    errors.extend(graph_errors)
    if 7 in features and statuses.get(7) == COMPLIANT:
        errors.extend(
            _feature_seven_review_errors(
                features[7],
                _feature_seven_content(expectations),
                contracts,
                sections,
                cycles,
                graph_errors,
            )
        )
    return tuple(errors)
