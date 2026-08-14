"""Validate PBI predecessors and calculate the atomic backlog graph."""

from __future__ import annotations

import re

from Scripts.backlog_atomicity_model import Diagnostic, Pbi, Section, diagnostic


def predecessors(value: str) -> tuple[str, ...]:
    if value.strip().casefold() == "aucun":
        return ()
    return tuple(re.findall(r"\d+\.\d+", value))


def _completion_precedence_error(pbi: Pbi, predecessor: Pbi) -> Diagnostic | None:
    if not pbi.completed_on or predecessor.completed_on:
        return None
    return diagnostic(
        pbi.feature,
        pbi.identifier,
        "Prédécesseurs",
        predecessor.identifier,
        "PBI réalisé avant son prédécesseur",
        "dater chaque prédécesseur avant le PBI qui en dépend",
    )


def _one_pbi_errors(
    pbi: Pbi,
    declared: tuple[str, ...],
    all_pbis: dict[str, Pbi],
) -> list[Diagnostic]:
    errors = []
    if len(declared) != len(set(declared)):
        errors.append(
            diagnostic(
                pbi.feature,
                pbi.identifier,
                "Prédécesseurs",
                declared,
                "prédécesseur dupliqué",
                "déclarer chaque prédécesseur une seule fois",
            )
        )
    current_order = tuple(map(int, pbi.identifier.split(".")))
    for predecessor in declared:
        if predecessor not in all_pbis:
            errors.append(
                diagnostic(
                    pbi.feature,
                    pbi.identifier,
                    "Prédécesseurs",
                    predecessor,
                    "prédécesseur inexistant",
                    "référencer un PBI existant",
                )
            )
        elif tuple(map(int, predecessor.split("."))) >= current_order:
            errors.append(
                diagnostic(
                    pbi.feature,
                    pbi.identifier,
                    "Prédécesseurs",
                    predecessor,
                    "prédécesseur futur ou réflexif invalide",
                    "référencer uniquement un PBI antérieur",
                )
            )
        else:
            completion_issue = _completion_precedence_error(pbi, all_pbis[predecessor])
            if completion_issue:
                errors.append(completion_issue)
    return errors


def _cycles(graph: dict[str, tuple[str, ...]]) -> list[tuple[str, ...]]:
    cycles: set[tuple[str, ...]] = set()
    visited: set[str] = set()
    active: list[str] = []

    def visit(node: str) -> None:
        if node in active:
            cycles.add(tuple(sorted(active[active.index(node) :])))
            return
        if node in visited:
            return
        active.append(node)
        for predecessor in graph.get(node, ()):
            if predecessor in graph:
                visit(predecessor)
        active.pop()
        visited.add(node)

    for identifier in graph:
        visit(identifier)
    return sorted(cycles)


def validate_graph(
    targets: dict[str, Pbi],
    sections: dict[str, Section],
    all_pbis: dict[str, Pbi],
) -> tuple[dict[str, tuple[str, ...]], list[tuple[str, ...]], list[Diagnostic]]:
    graph = {}
    errors = []
    for identifier, pbi in targets.items():
        values = (
            sections[identifier].fields.get("Prédécesseurs", ()) if identifier in sections else ()
        )
        declared = predecessors(values[0]) if len(values) == 1 else ()
        graph[identifier] = declared
        errors.extend(_one_pbi_errors(pbi, declared, all_pbis))
    cycles = _cycles(graph)
    for cycle in cycles:
        errors.append(
            diagnostic(
                targets[cycle[0]].feature,
                " -> ".join(cycle),
                "Prédécesseurs",
                cycle,
                "cycle dans le graphe",
                "supprimer au moins une dépendance du cycle",
            )
        )
    return graph, cycles, errors
