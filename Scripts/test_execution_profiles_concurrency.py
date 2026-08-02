"""Parallel write and exclusive-resource checks for execution profiles."""

from __future__ import annotations

from typing import Any

from Scripts.test_execution_profiles_graph import PROFILES, _ancestors, active_nodes


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
