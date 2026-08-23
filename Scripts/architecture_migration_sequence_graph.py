"""Read Feature 7 authorities and derive its migration DAG."""

from __future__ import annotations

import json
import re
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

from Scripts.backlog_atomicity_graph import predecessors
from Scripts.backlog_atomicity_parsing import parse_expectations, parse_registry

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PLAN = ROOT / "reports" / "architecture-migration-sequence.json"
DEFAULT_DECISION = ROOT / "docs" / "architecture-migration-sequence.md"
DEFAULT_EXPECTATIONS = (
    ROOT / "docs" / "backlog-expectations" / "feature-07-evolvable-architecture.md"
)
DEFAULT_BACKLOG = ROOT / "docs" / "backlog.md"
FOUNDATIONS = tuple(f"7.{number}" for number in range(1, 10))
MIGRATIONS = tuple(f"7.{number}" for number in range(10, 76))


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_plan(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys)
    if not isinstance(value, dict):
        raise ValueError("the migration sequence root must be an object")
    return value


def graph_from_expectations(path: Path) -> dict[str, tuple[str, ...]]:
    content = path.read_text(encoding="utf-8")
    sections, diagnostics = parse_expectations({str(path): content})
    if diagnostics:
        raise ValueError("Feature 7 expectations contain duplicate sections")
    graph: dict[str, tuple[str, ...]] = {}
    for identifier, section in sections.items():
        if not identifier.startswith("7."):
            continue
        declared = section.fields.get("Prédécesseurs", ())
        if len(declared) != 1:
            raise ValueError(f"{identifier} must declare exactly one predecessor field")
        graph[identifier] = predecessors(declared[0])
    return graph


def completed_from_backlog(path: Path) -> set[str]:
    features, _by_id, diagnostics = parse_registry(path.read_text(encoding="utf-8"))
    if diagnostics:
        raise ValueError("the backlog registry is structurally invalid")
    feature = features.get(7)
    if feature is None:
        raise ValueError("Feature 7 is absent from the backlog registry")
    return {pbi.identifier for pbi in feature.pbis if pbi.completed_on}


def documented_precedences(path: Path) -> dict[str, tuple[str, ...]]:
    content = path.read_text(encoding="utf-8")
    rows = re.findall(r"^(7\.\d+) ← (.+)$", content, re.MULTILINE)
    if len(rows) != len({identifier for identifier, _value in rows}):
        raise ValueError("the documented precedence list contains duplicate outcomes")
    return {identifier: predecessors(value) for identifier, value in rows}


def pbi_key(identifier: str) -> tuple[int, int]:
    feature, number = identifier.split(".", maxsplit=1)
    return int(feature), int(number)


def find_cycles(graph: Mapping[str, tuple[str, ...]]) -> tuple[tuple[str, ...], ...]:
    state: dict[str, int] = {}
    stack: list[str] = []
    cycles: set[tuple[str, ...]] = set()

    def visit(node: str) -> None:
        current = state.get(node, 0)
        if current == 2:
            return
        if current == 1:
            start = stack.index(node)
            cycles.add(tuple(stack[start:] + [node]))
            return
        state[node] = 1
        stack.append(node)
        for dependency in graph.get(node, ()):
            if dependency in graph:
                visit(dependency)
        stack.pop()
        state[node] = 2

    for identifier in sorted(graph, key=pbi_key):
        visit(identifier)
    return tuple(sorted(cycles))


def earliest_waves(
    graph: Mapping[str, tuple[str, ...]], foundations: Iterable[str] = FOUNDATIONS
) -> dict[str, int]:
    levels = {identifier: 0 for identifier in foundations}
    pending = set(graph) - set(levels)
    while pending:
        ready = sorted(
            (
                identifier
                for identifier in pending
                if all(dependency in levels for dependency in graph[identifier])
            ),
            key=pbi_key,
        )
        if not ready:
            unresolved = ", ".join(sorted(pending, key=pbi_key))
            raise ValueError(f"cyclic or unresolved migration graph: {unresolved}")
        for identifier in ready:
            levels[identifier] = (
                max((levels[dependency] for dependency in graph[identifier]), default=0) + 1
            )
        pending.difference_update(ready)
    return {identifier: levels[identifier] for identifier in MIGRATIONS if identifier in levels}
