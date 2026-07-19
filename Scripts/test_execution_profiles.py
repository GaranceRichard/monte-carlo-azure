#!/usr/bin/env python3
"""Validate and render the versioned CI/CD execution-profile DAG."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.test_execution_profiles_graph import (  # noqa: E402
    PROFILES,
    active_nodes,
    included_profiles,
    topological_node_ids,
)
from Scripts.test_execution_profiles_validation import (  # noqa: E402
    validate_contract,
    validate_inventory,
)

DEFAULT_CONTRACT = Path("config/test-execution-profiles.json")
DEFAULT_INVENTORY = Path("reports/test-classification-inventory.json")
DEFAULT_REPORT = Path("reports/test-execution-plan.json")
CHANGE_LEVELS = ("targeted", "impacted", "massive")
FRAMEWORK_NODE = {
    "pytest": "backend-tests",
    "vitest": "frontend-tests",
    "playwright": "e2e",
}


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON property: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> Any:
    try:
        return json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys
        )
    except FileNotFoundError as exc:
        raise ValueError(f"Missing execution-profile artifact: {path.as_posix()}") from exc
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid execution-profile JSON {path.as_posix()}: {exc}") from exc


def _case_summary(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    selected = sorted(records, key=lambda item: item["logicalCaseId"])
    return {
        "logicalCaseIds": [item["logicalCaseId"] for item in selected],
        "frameworks": dict(sorted(Counter(item["framework"] for item in selected).items())),
        "natures": dict(
            sorted(Counter(item.get("nature", "unresolved") for item in selected).items())
        ),
        "criticalities": dict(
            sorted(Counter(item.get("criticality", "unassigned") for item in selected).items())
        ),
    }


def build_profile_plan(
    contract: dict[str, Any],
    inventory: list[dict[str, Any]],
    profile: str,
    *,
    change_level: str | None = None,
) -> dict[str, Any]:
    errors = validate_contract(contract) + validate_inventory(inventory)
    if errors:
        raise ValueError("; ".join(errors))
    if change_level is not None and change_level not in CHANGE_LEVELS:
        raise ValueError(f"Unknown change level: {change_level}")
    included = included_profiles(contract, profile)
    selected = [item for item in inventory if item["executionProfile"] in included]
    records_by_node: dict[str, list[dict[str, Any]]] = {
        identifier: [] for identifier in active_nodes(contract, profile)
    }
    for record in selected:
        records_by_node[FRAMEWORK_NODE[record["framework"]]].append(record)
    nodes = active_nodes(contract, profile)
    rendered_nodes = [
        {
            "id": identifier,
            "needs": list(nodes[identifier]["needs"]),
            "commands": list(nodes[identifier]["commands"]),
            "reads": list(nodes[identifier]["reads"]),
            "writes": list(nodes[identifier]["writes"]),
            "resources": list(nodes[identifier]["resources"]),
            "aggregator": nodes[identifier]["aggregator"],
            **_case_summary(records_by_node[identifier]),
        }
        for identifier in topological_node_ids(contract, profile)
    ]
    planned_ids = [case for node in rendered_nodes for case in node["logicalCaseIds"]]
    expected_ids = sorted(item["logicalCaseId"] for item in selected)
    if sorted(planned_ids) != expected_ids or len(planned_ids) != len(set(planned_ids)):
        raise ValueError(f"Execution profile {profile} does not select each logical case once")
    return {
        "profile": profile,
        "includedProfiles": list(included),
        "changeLevel": change_level,
        "logicalCases": len(selected),
        "nodes": rendered_nodes,
    }


def build_plan_report(
    contract: dict[str, Any], inventory: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0.0",
        "contract": DEFAULT_CONTRACT.as_posix(),
        "inventory": DEFAULT_INVENTORY.as_posix(),
        "profiles": [build_profile_plan(contract, inventory, profile) for profile in PROFILES],
    }


def selected_records(
    contract: dict[str, Any],
    inventory: list[dict[str, Any]],
    profile: str,
    framework: str,
) -> list[dict[str, Any]]:
    included = included_profiles(contract, profile)
    return sorted(
        (
            item
            for item in inventory
            if item["executionProfile"] in included and item["framework"] == framework
        ),
        key=lambda item: item["logicalCaseId"],
    )


def write_framework_selection(
    contract: dict[str, Any],
    inventory: list[dict[str, Any]],
    profile: str,
    framework: str,
    destination: Path,
) -> bytes:
    records = selected_records(contract, inventory, profile, framework)
    if framework == "pytest":
        selectors = [f"{item['sourcePath']}::{item['selector']}" for item in records]
    else:
        selectors = sorted({item["sourcePath"] for item in records})
    payload = ("\n".join(selectors) + "\n").encode("utf-8")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    return payload


def write_report(report: dict[str, Any], destination: Path) -> bytes:
    payload = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    return payload


def node_for_command(contract: dict[str, Any], profile: str, step: str) -> str:
    matches = [
        identifier
        for identifier, node in active_nodes(contract, profile).items()
        if step in node.get("commands", [])
    ]
    if len(matches) != 1:
        raise ValueError(f"Quality-gate step {step!r} maps to {len(matches)} DAG nodes")
    return matches[0]


def execution_batches(
    contract: dict[str, Any], profile: str, steps: Iterable[str]
) -> tuple[tuple[str, tuple[str, ...]], ...]:
    nodes = active_nodes(contract, profile)
    grouped: dict[str, list[str]] = {item: [] for item in nodes}
    for step in steps:
        grouped[node_for_command(contract, profile, step)].append(step)
    return tuple(
        (identifier, tuple(grouped[identifier]))
        for identifier in topological_node_ids(contract, profile)
        if grouped[identifier] or nodes[identifier]["aggregator"]
    )


def _resolved(root: Path, path: Path) -> Path:
    return path if path.is_absolute() else root / path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT)
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--select-profile", choices=PROFILES)
    parser.add_argument("--select-framework", choices=tuple(FRAMEWORK_NODE))
    parser.add_argument("--selection-output", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = args.root.resolve()
    try:
        contract = load_json(_resolved(root, args.contract))
        inventory = load_json(_resolved(root, args.inventory))
        report = build_plan_report(contract, inventory)
    except ValueError as exc:
        print(f"ERROR: {exc}")
        return 1
    selection = (args.select_profile, args.select_framework, args.selection_output)
    if any(selection) and not all(selection):
        print("ERROR: selection requires profile, framework and output")
        return 2
    if all(selection):
        write_framework_selection(
            contract,
            inventory,
            args.select_profile,
            args.select_framework,
            _resolved(root, args.selection_output),
        )
    elif not args.check:
        write_report(report, _resolved(root, args.output))
    print(
        json.dumps(
            {item["profile"]: item["logicalCases"] for item in report["profiles"]},
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
