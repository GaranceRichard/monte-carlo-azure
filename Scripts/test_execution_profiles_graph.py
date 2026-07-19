"""Graph algorithms and concurrency checks for execution profiles."""

from __future__ import annotations

from typing import Any

PROFILES = ("pr", "main", "nightly", "release")


def profile_map(contract: dict[str, Any]) -> dict[str, dict[str, Any]]:
    values = contract.get("profiles", [])
    if not isinstance(values, list):
        return {}
    return {
        item.get("id"): item
        for item in values
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }


def node_map(contract: dict[str, Any]) -> dict[str, dict[str, Any]]:
    values = contract.get("nodes", [])
    if not isinstance(values, list):
        return {}
    return {
        item.get("id"): item
        for item in values
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }


def included_profiles(contract: dict[str, Any], profile: str) -> tuple[str, ...]:
    entry = profile_map(contract).get(profile)
    if entry is None:
        raise ValueError(f"Unknown execution profile: {profile}")
    includes = entry.get("includes")
    if not isinstance(includes, list) or not all(isinstance(item, str) for item in includes):
        raise ValueError(f"Invalid includes for execution profile: {profile}")
    return tuple(includes)


def active_nodes(contract: dict[str, Any], profile: str) -> dict[str, dict[str, Any]]:
    return {
        identifier: node
        for identifier, node in node_map(contract).items()
        if profile in node.get("profiles", [])
    }


def topological_node_ids(contract: dict[str, Any], profile: str) -> tuple[str, ...]:
    nodes = active_nodes(contract, profile)
    indegree = {identifier: 0 for identifier in nodes}
    outgoing = {identifier: [] for identifier in nodes}
    for identifier, node in nodes.items():
        for dependency in node.get("needs", []):
            if dependency in nodes:
                indegree[identifier] += 1
                outgoing[dependency].append(identifier)
    ready = sorted(
        (identifier for identifier, degree in indegree.items() if degree == 0),
        key=lambda item: (nodes[item].get("order", 0), item),
    )
    ordered: list[str] = []
    while ready:
        identifier = ready.pop(0)
        ordered.append(identifier)
        for successor in outgoing[identifier]:
            indegree[successor] -= 1
            if indegree[successor] == 0:
                ready.append(successor)
                ready.sort(key=lambda item: (nodes[item].get("order", 0), item))
    if len(ordered) != len(nodes):
        raise ValueError(f"Execution profile {profile} contains a dependency cycle")
    return tuple(ordered)


def _ancestors(identifier: str, nodes: dict[str, dict[str, Any]]) -> set[str]:
    found: set[str] = set()
    pending = list(nodes[identifier].get("needs", []))
    while pending:
        current = pending.pop()
        if current in found or current not in nodes:
            continue
        found.add(current)
        pending.extend(nodes[current].get("needs", []))
    return found


def dependency_errors(contract: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    all_nodes = node_map(contract)
    for profile in PROFILES:
        nodes = active_nodes(contract, profile)
        for identifier, node in nodes.items():
            for dependency in node.get("needs", []):
                if dependency not in all_nodes:
                    errors.append(f"{profile}:{identifier} needs missing node {dependency}")
                elif dependency not in nodes:
                    errors.append(f"{profile}:{identifier} needs inactive node {dependency}")
        try:
            topological_node_ids(contract, profile)
        except ValueError as exc:
            errors.append(str(exc))
    return errors


def reachability_errors(contract: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for profile in PROFILES:
        nodes = active_nodes(contract, profile)
        aggregators = [item for item, node in nodes.items() if node.get("aggregator")]
        if len(aggregators) != 1:
            errors.append(f"{profile} must have exactly one final aggregator")
            continue
        aggregator = aggregators[0]
        unreachable = sorted(set(nodes) - _ancestors(aggregator, nodes) - {aggregator})
        if unreachable:
            errors.append(f"{profile} has unreachable nodes: {', '.join(unreachable)}")
        if any(aggregator in node.get("needs", []) for node in nodes.values()):
            errors.append(f"{profile} aggregator must be final")
    return errors


def parallel_conflict_errors(contract: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for profile in PROFILES:
        nodes = active_nodes(contract, profile)
        ancestors = {identifier: _ancestors(identifier, nodes) for identifier in nodes}
        ordered = sorted(nodes, key=lambda item: (nodes[item].get("order", 0), item))
        for index, left in enumerate(ordered):
            for right in ordered[index + 1 :]:
                if left in ancestors[right] or right in ancestors[left]:
                    continue
                writes = set(nodes[left].get("writes", [])) & set(nodes[right].get("writes", []))
                resources = set(nodes[left].get("resources", [])) & set(
                    nodes[right].get("resources", [])
                )
                if writes:
                    errors.append(
                        f"{profile} parallel write conflict {left}/{right}: "
                        f"{', '.join(sorted(writes))}"
                    )
                if resources:
                    errors.append(
                        f"{profile} parallel exclusive-resource conflict {left}/{right}: "
                        f"{', '.join(sorted(resources))}"
                    )
    return errors
