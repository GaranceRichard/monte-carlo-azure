#!/usr/bin/env python3
"""Discover and classify every logical test case in the repository."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.test_classifier_discovery import discover_all  # noqa: E402
from Scripts.test_classifier_engine import classify_inventory  # noqa: E402

DEFAULT_RULES = Path("config/test-classification-rules.json")
DEFAULT_OVERRIDES = Path("config/test-classification-overrides.json")
DEFAULT_OUTPUT = Path("reports/test-classification-inventory.json")


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON property: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def _resolved(root: Path, path: Path) -> Path:
    return path if path.is_absolute() else root / path


def generate_inventory(
    root: Path = ROOT,
    rules_path: Path = DEFAULT_RULES,
    overrides_path: Path = DEFAULT_OVERRIDES,
    output_path: Path = DEFAULT_OUTPUT,
    node_command: str = "node",
) -> list[dict[str, Any]]:
    catalog = load_json(root / "config" / "test-classification.json")
    schema = load_json(root / "config" / "test-classification.schema.json")
    rules = load_json(_resolved(root, rules_path))
    overrides = load_json(_resolved(root, overrides_path))
    cases = discover_all(root, node_command)
    inventory = classify_inventory(cases, rules, overrides, catalog, schema)
    destination = _resolved(root, output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(inventory, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return inventory


def inventory_summary(inventory: list[dict[str, Any]], override_count: int) -> dict[str, Any]:
    return {
        "frameworks": dict(sorted(Counter(item["framework"] for item in inventory).items())),
        "statuses": dict(sorted(Counter(item["status"] for item in inventory).items())),
        "natures": dict(
            sorted(Counter(item.get("nature", "unresolved") for item in inventory).items())
        ),
        "overrides": override_count,
        "total": len(inventory),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--rules", type=Path, default=DEFAULT_RULES)
    parser.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--node-command", default="node")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    inventory = generate_inventory(
        root=args.root.resolve(),
        rules_path=args.rules,
        overrides_path=args.overrides,
        output_path=args.output,
        node_command=args.node_command,
    )
    overrides = load_json(_resolved(args.root.resolve(), args.overrides))
    print(
        json.dumps(
            inventory_summary(inventory, len(overrides.get("overrides", []))), sort_keys=True
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
