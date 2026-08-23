"""Validate graph, publication and wave invariants for the migration sequence."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from Scripts.architecture_migration_sequence_graph import (
    FOUNDATIONS,
    MIGRATIONS,
    find_cycles,
    pbi_key,
)


def duplicates(values: list[str]) -> set[str]:
    seen: set[str] = set()
    repeated: set[str] = set()
    for value in values:
        if value in seen:
            repeated.add(value)
        seen.add(value)
    return repeated


def validate_graph(graph: Mapping[str, tuple[str, ...]]) -> list[str]:
    errors: list[str] = []
    expected = set(FOUNDATIONS + MIGRATIONS)
    actual = set(graph)
    if actual != expected:
        errors.append(
            "Feature 7 graph coverage differs: "
            f"missing={sorted(expected - actual, key=pbi_key)}, "
            f"extra={sorted(actual - expected, key=pbi_key)}"
        )
    for identifier, dependencies in graph.items():
        unknown = set(dependencies) - actual
        if unknown:
            errors.append(
                f"{identifier} references unknown predecessors: "
                f"{sorted(unknown, key=pbi_key)}"
            )
    for cycle in find_cycles(graph):
        errors.append("cycle detected: " + " -> ".join(cycle))
    return errors


def validate_published_state(
    graph: Mapping[str, tuple[str, ...]], completed: set[str]
) -> list[str]:
    errors = []
    for identifier in sorted(completed, key=pbi_key):
        missing = set(graph.get(identifier, ())) - completed
        if missing:
            errors.append(
                f"published outcome {identifier} is missing predecessors "
                f"{sorted(missing, key=pbi_key)}"
            )
    return errors


def validate_documented_precedences(
    graph: Mapping[str, tuple[str, ...]], documented: Mapping[str, tuple[str, ...]]
) -> list[str]:
    expected = {identifier: graph[identifier] for identifier in MIGRATIONS if identifier in graph}
    if documented == expected:
        return []
    errors = []
    for identifier in MIGRATIONS:
        if documented.get(identifier) != expected.get(identifier):
            errors.append(
                f"documented predecessors for {identifier} must equal "
                f"{expected.get(identifier)!r}, got {documented.get(identifier)!r}"
            )
    extra = set(documented) - set(MIGRATIONS)
    if extra:
        errors.append(f"documented precedence list has extra outcomes: {sorted(extra)}")
    return errors


def expected_wave_rows(levels: Mapping[str, int]) -> list[dict[str, Any]]:
    maximum = max(levels.values())
    return [
        {
            "wave": wave,
            "outcomes": [
                identifier for identifier in MIGRATIONS if levels.get(identifier) == wave
            ],
        }
        for wave in range(1, maximum + 1)
    ]


def validate_waves(plan: Mapping[str, Any], levels: Mapping[str, int]) -> list[str]:
    expected = expected_wave_rows(levels)
    if plan.get("waves") == expected:
        return []
    return [
        "waves must equal the earliest publishable topological levels; "
        f"expected {expected!r}"
    ]
