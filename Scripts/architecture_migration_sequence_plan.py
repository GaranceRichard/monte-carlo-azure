"""Validate the machine projection of Feature 7 migration paths."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from Scripts.architecture_migration_sequence_graph import (
    FOUNDATIONS,
    MIGRATIONS,
    earliest_waves,
    pbi_key,
)
from Scripts.architecture_migration_sequence_validation import (
    duplicates,
    validate_graph,
    validate_published_state,
    validate_waves,
)


def _string_list(value: Any, label: str, errors: list[str]) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        errors.append(f"{label} must be an array of strings")
        return []
    return value


def _validate_lanes(plan: Mapping[str, Any]) -> list[str]:
    lanes = plan.get("lanes")
    if not isinstance(lanes, list):
        return ["lanes must be an array"]
    errors: list[str] = []
    lane_ids: list[str] = []
    assigned: list[str] = []
    for index, lane in enumerate(lanes):
        if not isinstance(lane, dict):
            errors.append(f"lanes[{index}] must be an object")
            continue
        identifier = lane.get("id")
        if not isinstance(identifier, str) or not identifier:
            errors.append(f"lanes[{index}].id must be a non-empty string")
        else:
            lane_ids.append(identifier)
        outcomes = _string_list(lane.get("outcomes"), f"lanes[{index}].outcomes", errors)
        if outcomes != sorted(outcomes, key=pbi_key):
            errors.append(f"lanes[{index}].outcomes must follow numeric PBI order")
        assigned.extend(outcomes)
    if repeated := duplicates(lane_ids):
        errors.append(f"duplicate lane ids: {sorted(repeated)}")
    if repeated := duplicates(assigned):
        errors.append(f"outcomes assigned to several lanes: {sorted(repeated, key=pbi_key)}")
    missing = set(MIGRATIONS) - set(assigned)
    extra = set(assigned) - set(MIGRATIONS)
    if missing or extra:
        errors.append(
            "lane coverage differs: "
            f"missing={sorted(missing, key=pbi_key)}, extra={sorted(extra, key=pbi_key)}"
        )
    return errors


def _validate_convergences(
    plan: Mapping[str, Any], graph: Mapping[str, tuple[str, ...]]
) -> list[str]:
    points = plan.get("convergencePoints")
    if not isinstance(points, list):
        return ["convergencePoints must be an array"]
    errors: list[str] = []
    outcomes: list[str] = []
    for index, point in enumerate(points):
        if not isinstance(point, dict):
            errors.append(f"convergencePoints[{index}] must be an object")
            continue
        outcome = point.get("outcome")
        role = point.get("role")
        if not isinstance(outcome, str) or outcome not in graph:
            errors.append(f"convergencePoints[{index}].outcome must reference Feature 7")
            continue
        outcomes.append(outcome)
        if len(graph[outcome]) < 2:
            errors.append(f"convergence point {outcome} must have several direct predecessors")
        if not isinstance(role, str) or not role.strip():
            errors.append(f"convergencePoints[{index}].role must be non-empty")
    if repeated := duplicates(outcomes):
        errors.append(f"duplicate convergence points: {sorted(repeated, key=pbi_key)}")
    return errors


def validate_sequence(
    plan: Mapping[str, Any],
    graph: Mapping[str, tuple[str, ...]],
    completed: set[str],
) -> list[str]:
    errors = [*validate_graph(graph), *validate_published_state(graph, completed)]
    if errors:
        return errors
    levels = earliest_waves(graph)
    if plan.get("schemaVersion") != "1.0.0":
        errors.append("schemaVersion must be 1.0.0")
    if plan.get("pbi") != "7.9":
        errors.append("pbi must be 7.9")
    if plan.get("source") != (
        "docs/backlog-expectations/feature-07-evolvable-architecture.md"
    ):
        errors.append("source must reference the Feature 7 expectations")
    if plan.get("publicationModel") != "downward-closed-outcome-set":
        errors.append("publicationModel must preserve every mandatory predecessor")
    if plan.get("rollbackModel") != "reverse-topological":
        errors.append("rollbackModel must be reverse-topological")
    if plan.get("foundations") != list(FOUNDATIONS):
        errors.append(f"foundations must equal {list(FOUNDATIONS)!r}")
    errors.extend(validate_waves(plan, levels))
    immediate = _string_list(
        plan.get("immediatelyParallelizable"), "immediatelyParallelizable", errors
    )
    expected_immediate = [identifier for identifier in MIGRATIONS if levels[identifier] == 1]
    if immediate != expected_immediate:
        errors.append(f"immediatelyParallelizable must equal {expected_immediate!r}")
    errors.extend(_validate_lanes(plan))
    errors.extend(_validate_convergences(plan, graph))
    return errors
