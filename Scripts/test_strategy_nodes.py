"""Quality-gate node evidence adapters for strategic test reporting."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from Scripts.test_strategy_evidence import manifest_entry, reason


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate JSON property {key}")
        value[key] = item
    return value


def _load_node(
    root: Path,
    profile: str,
    node: str,
    relative: str,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    identifier = f"node-{node}"
    try:
        raw = (root / relative).read_bytes()
        payload = json.loads(raw.decode("utf-8"), object_pairs_hook=_reject_duplicates)
    except OSError:
        issue = reason("node.missing", f"Required node result is missing: {node}", [identifier])
        return None, manifest_entry(
            identifier,
            relative,
            "Scripts/quality_gate_dag.py",
            "profileExecution",
            status="missing",
            reasons=[issue],
        )
    except (UnicodeError, json.JSONDecodeError, ValueError) as exc:
        issue = reason("node.invalid", f"Invalid node result for {node}: {exc}", [identifier])
        return None, manifest_entry(
            identifier,
            relative,
            "Scripts/quality_gate_dag.py",
            "profileExecution",
            status="invalid",
            fingerprint=hashlib.sha256(raw).hexdigest(),
            reasons=[issue],
        )
    valid = (
        isinstance(payload, dict)
        and payload.get("schemaVersion") == 1
        and payload.get("profile") == profile
        and payload.get("node") == node
        and type(payload.get("exitCode")) is int
    )
    status = "valid" if valid else "invalid"
    issues = (
        []
        if valid
        else [reason("node.invalid", f"Node result contract mismatch: {node}", [identifier])]
    )
    return payload if isinstance(payload, dict) else None, manifest_entry(
        identifier,
        relative,
        "Scripts/quality_gate_dag.py",
        "profileExecution",
        status=status,
        fingerprint=hashlib.sha256(raw).hexdigest(),
        schema_version=payload.get("schemaVersion") if isinstance(payload, dict) else None,
        reasons=issues,
    )


def _required_node(identifier: str, profile: str, frameworks: set[Any]) -> bool:
    return (
        identifier != "aggregate"
        and not (identifier == "e2e" and "playwright" not in frameworks)
        and not (identifier == "release-or-container-checks" and profile == "pr")
    )


def _not_applicable_node(identifier: str) -> dict[str, Any]:
    return {
        "id": identifier,
        "required": False,
        "status": "not_applicable",
        "evidencePath": None,
        "exitCode": None,
        "durationSeconds": None,
        "reasons": [],
    }


def _duration(payload: dict[str, Any] | None) -> int | float | None:
    value = payload.get("durationSeconds") if payload else None
    if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
        return value
    return None


def node_evidence(
    root: Path,
    profile: str,
    contract: dict[str, Any],
    selected: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    frameworks = {item.get("framework") for item in selected}
    nodes: list[dict[str, Any]] = []
    evidence: list[dict[str, Any]] = []
    violations: list[dict[str, Any]] = []
    for contract_node in contract.get("nodes", []):
        identifier = contract_node.get("id", "unknown")
        if not _required_node(identifier, profile, frameworks):
            nodes.append(_not_applicable_node(identifier))
            continue
        relative = f"reports/test-execution-artifacts/{profile}/{identifier}/result.json"
        payload, entry = _load_node(root, profile, identifier, relative)
        evidence.append(entry)
        code = payload.get("exitCode") if payload else None
        if type(code) is int and code != 0:
            violations.append(
                reason("node.failed", f"Node {identifier} exited with code {code}.", [entry["id"]])
            )
        nodes.append(
            {
                "id": identifier,
                "required": True,
                "status": entry["status"],
                "evidencePath": relative,
                "exitCode": code if type(code) is int else None,
                "durationSeconds": _duration(payload),
                "reasons": entry["reasons"],
            }
        )
    return nodes, evidence, violations
