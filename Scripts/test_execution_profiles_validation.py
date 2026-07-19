"""Structural validation for the execution-profile contract and inventory."""

from __future__ import annotations

from typing import Any

from Scripts.test_execution_profiles_graph import (
    PROFILES,
    dependency_errors,
    parallel_conflict_errors,
    reachability_errors,
)


def _basic_contract_errors(contract: Any) -> list[str]:
    if not isinstance(contract, dict):
        return ["execution-profile contract must be a JSON object"]
    errors: list[str] = []
    if contract.get("schemaVersion") != "1.0.0":
        errors.append("execution-profile schemaVersion must be 1.0.0")
    profiles = contract.get("profiles")
    nodes = contract.get("nodes")
    if not isinstance(profiles, list) or not profiles:
        errors.append("execution-profile profiles must be a non-empty array")
    if not isinstance(nodes, list) or not nodes:
        errors.append("execution-profile nodes must be a non-empty array")
    return errors


def _profile_errors(contract: dict[str, Any]) -> list[str]:
    profiles = contract.get("profiles", [])
    identifiers = [item.get("id") for item in profiles if isinstance(item, dict)]
    errors: list[str] = []
    if len(identifiers) != len(set(identifiers)):
        errors.append("execution-profile identifiers must be unique")
    if tuple(identifiers) != PROFILES:
        errors.append("execution profiles must be declared as pr, main, nightly, release")
    expected = {
        "pr": ["pr"],
        "main": ["pr", "main"],
        "nightly": ["pr", "main", "nightly"],
        "release": ["pr", "main", "release"],
    }
    for item in profiles:
        if not isinstance(item, dict):
            errors.append("each execution profile must be an object")
            continue
        identifier = item.get("id")
        if item.get("includes") != expected.get(identifier):
            errors.append(f"execution profile {identifier!r} has an invalid inclusion hierarchy")
        description = item.get("description")
        if not isinstance(description, str) or not description.strip():
            errors.append(f"execution profile {identifier!r} requires a description")
    return errors


def _array_errors(node: dict[str, Any], label: str, field: str) -> list[str]:
    value = node.get(field)
    if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
        return [f"{label}.{field} must contain non-empty strings"]
    if len(value) != len(set(value)):
        return [f"{label}.{field} must not contain duplicates"]
    return []


def _one_node_errors(node: Any, label: str) -> list[str]:
    if not isinstance(node, dict):
        return [f"{label} must be an object"]
    errors: list[str] = []
    if not isinstance(node.get("id"), str) or not node["id"].strip():
        errors.append(f"{label}.id must be a non-empty string")
    if type(node.get("order")) is not int or node["order"] < 0:
        errors.append(f"{label}.order must be a non-negative integer")
    for field in ("needs", "commands", "profiles", "reads", "writes", "resources"):
        errors.extend(_array_errors(node, label, field))
    if not isinstance(node.get("aggregator"), bool):
        errors.append(f"{label}.aggregator must be boolean")
    return errors


def _node_shape_errors(contract: dict[str, Any]) -> list[str]:
    raw_nodes = contract.get("nodes", [])
    identifiers = [item.get("id") for item in raw_nodes if isinstance(item, dict)]
    errors: list[str] = []
    if len(identifiers) != len(set(identifiers)):
        errors.append("execution node identifiers must be unique")
    for index, node in enumerate(raw_nodes):
        errors.extend(_one_node_errors(node, f"nodes[{index}]"))
    return errors


def validate_contract(contract: Any) -> list[str]:
    errors = _basic_contract_errors(contract)
    if errors or not isinstance(contract, dict):
        return errors
    errors.extend(_profile_errors(contract))
    errors.extend(_node_shape_errors(contract))
    if not errors:
        errors.extend(dependency_errors(contract))
        errors.extend(reachability_errors(contract))
        errors.extend(parallel_conflict_errors(contract))
    return errors


def _inventory_record_errors(record: Any, index: int, seen: set[str]) -> list[str]:
    if not isinstance(record, dict):
        return [f"inventory[{index}] must be an object"]
    errors: list[str] = []
    identifier = record.get("logicalCaseId")
    if not isinstance(identifier, str) or not identifier:
        errors.append(f"inventory[{index}] has no logicalCaseId")
    elif identifier in seen:
        errors.append(f"duplicate inventory logicalCaseId: {identifier}")
    else:
        seen.add(identifier)
    if record.get("executionProfile") not in PROFILES:
        errors.append(f"{identifier} has an invalid executionProfile")
    if record.get("framework") not in {"pytest", "vitest", "playwright"}:
        errors.append(f"{identifier} has an unsupported framework")
    return errors


def validate_inventory(inventory: Any) -> list[str]:
    if not isinstance(inventory, list):
        return ["classification inventory must be an array"]
    errors: list[str] = []
    seen: set[str] = set()
    for index, record in enumerate(inventory):
        errors.extend(_inventory_record_errors(record, index, seen))
    return errors
