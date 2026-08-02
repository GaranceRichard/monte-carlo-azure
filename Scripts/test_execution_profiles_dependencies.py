"""Profile-aware dependency selection for the execution DAG."""

from __future__ import annotations

from typing import Any


def active_dependencies(node: dict[str, Any], nodes: dict[str, dict[str, Any]]) -> set[str]:
    """Return conditional edges whose two endpoints participate in the profile."""
    dependencies = set(node.get("needs", [])) | set(node.get("conditionalNeeds", []))
    return dependencies & set(nodes)
