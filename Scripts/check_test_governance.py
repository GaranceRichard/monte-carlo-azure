#!/usr/bin/env python3
"""Enforce and report governance of ignored, quarantined and retried tests."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.test_classifier_discovery import LogicalCase  # noqa: E402
from Scripts.test_governance_contract import PROFILES, load_json  # noqa: E402
from Scripts.test_governance_detection import discover_mechanisms  # noqa: E402
from Scripts.test_governance_reporting import (  # noqa: E402
    build_report,
    collect_runtime,
    write_report,
)
from Scripts.test_governance_runtime_validation import (  # noqa: E402
    validate_runtime_governance,
)
from Scripts.test_governance_validation import validate_governance  # noqa: E402


def check_repository(
    root: Path,
    *,
    contract_path: Path,
    inventory_path: Path,
    execution_contract_path: Path,
    output_path: Path,
    profile: str,
    require_runtime: bool,
    today: date | None = None,
    cases: Iterable[LogicalCase] | None = None,
) -> tuple[dict, list[str]]:
    contract = load_json(root / contract_path)
    inventory = load_json(root / inventory_path)
    execution_contract = load_json(root / execution_contract_path)
    detections = discover_mechanisms(root, cases=cases)
    errors = validate_governance(contract, inventory, detections, execution_contract, today=today)
    runtime, complete, runtime_errors = collect_runtime(
        root,
        inventory,
        execution_contract,
        profile,
        require_runtime=require_runtime,
    )
    errors.extend(runtime_errors)
    errors.extend(validate_runtime_governance(contract, inventory, runtime))
    report = build_report(
        contract,
        inventory,
        detections,
        execution_contract,
        profile,
        runtime,
        complete,
        errors,
        today=today,
    )
    write_report(report, root / output_path)
    return report, sorted(set(errors))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--contract", type=Path, default=Path("config/test-governance.json"))
    parser.add_argument(
        "--inventory", type=Path, default=Path("reports/test-classification-inventory.json")
    )
    parser.add_argument(
        "--execution-contract",
        type=Path,
        default=Path("config/test-execution-profiles.json"),
    )
    parser.add_argument(
        "--output", type=Path, default=Path("reports/test-governance-report.json")
    )
    parser.add_argument("--profile", choices=PROFILES, default="main")
    parser.add_argument("--require-runtime", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report, errors = check_repository(
            args.root.resolve(),
            contract_path=args.contract,
            inventory_path=args.inventory,
            execution_contract_path=args.execution_contract,
            output_path=args.output,
            profile=args.profile,
            require_runtime=args.require_runtime,
        )
    except (OSError, RuntimeError, SyntaxError, TypeError, ValueError) as exc:
        print(f"ERROR: test governance could not run: {exc}", file=sys.stderr)
        return 2
    if errors:
        print("ERROR: test governance failed.", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(json.dumps(report["summary"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
