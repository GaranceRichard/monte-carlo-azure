"""Read-only verification for the versioned global execution-count reference."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any, Callable


def reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"Duplicate JSON property: {key}")
        value[key] = item
    return value


def write_report(report: dict[str, Any], destination: Path) -> bytes:
    payload = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    return payload


def build_parser(
    description: str,
    default_root: Path,
    default_inventory: Path,
    default_output: Path,
) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--root", type=Path, default=default_root)
    parser.add_argument("--inventory", type=Path, default=default_inventory)
    parser.add_argument("--native", type=Path, action="append")
    parser.add_argument("--output", type=Path, default=default_output)
    parser.add_argument("--check", action="store_true")
    return parser


def _resolve(root: Path, path: Path) -> Path:
    return path if path.is_absolute() else root / path


def _groups(report: dict[str, Any]) -> list[tuple[str, Any]]:
    groups = [("totals", report["totals"])]
    for field, label in (
        ("frameworks", "framework"),
        ("classificationStatuses", "status"),
        ("natures", "nature"),
        ("executionProfiles", "profile"),
    ):
        groups.extend((f"{label} {key}", item) for key, item in report[field].items())
    groups.extend(
        (f"logical case {item.get('logicalCaseId')}", item) for item in report["logicalCases"]
    )
    return groups


def _content_errors(
    inventory: list[dict[str, Any]],
    inventory_bytes: bytes,
    report: dict[str, Any],
) -> list[str]:
    errors: list[str] = []
    if report.get("classificationInventorySha256") != hashlib.sha256(inventory_bytes).hexdigest():
        errors.append("Versioned execution-count inventory fingerprint is inconsistent.")
    if report.get("anomalies") != []:
        errors.append("Versioned execution-count report contains anomalies.")
    if report["totals"].get("logicalCases") != len(inventory):
        errors.append("Versioned execution-count logical-case total is inconsistent.")
    expected = [item["logicalCaseId"] for item in inventory]
    actual = [item.get("logicalCaseId") for item in report["logicalCases"]]
    if actual != expected:
        errors.append("Versioned execution-count logical-case details are inconsistent.")
    return errors


def _count_errors(
    report: dict[str, Any],
    validate_counts: Callable[[dict[str, Any], str], None],
) -> list[str]:
    errors: list[str] = []
    for label, value in _groups(report):
        try:
            validate_counts(value, label)
        except (KeyError, TypeError, ValueError) as exc:
            errors.append(str(exc))
    return errors


def validate_reference(
    root: Path,
    inventory_path: Path,
    report_path: Path,
    *,
    schema_version: str,
    reject_duplicates: Callable[[list[tuple[str, Any]]], dict[str, Any]],
    validate_inventory: Callable[[Any], list[dict[str, Any]]],
    load_json: Callable[[Path], Any],
    validate_counts: Callable[[dict[str, Any], str], None],
) -> list[str]:
    """Validate a versioned global reference without replaying a test suite."""
    try:
        inventory_bytes = _resolve(root, inventory_path).read_bytes()
        inventory = validate_inventory(
            json.loads(inventory_bytes.decode("utf-8"), object_pairs_hook=reject_duplicates)
        )
        report = load_json(_resolve(root, report_path))
        if not isinstance(report, dict) or report.get("schemaVersion") != schema_version:
            return ["Invalid versioned execution-count report schema."]
        errors = _content_errors(inventory, inventory_bytes, report)
        errors.extend(_count_errors(report, validate_counts))
    except (KeyError, OSError, TypeError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        errors = [f"Unable to validate versioned execution-count reference: {exc}"]
    return sorted(set(errors))


def reference_validator(
    default_root: Path,
    default_inventory: Path,
    default_report: Path,
    **dependencies: Any,
) -> Callable[[Path, Path, Path], list[str]]:
    """Bind the count module's validators without adding complexity to its hot path."""

    def validate(
        root: Path = default_root,
        inventory_path: Path = default_inventory,
        report_path: Path = default_report,
    ) -> list[str]:
        return validate_reference(root, inventory_path, report_path, **dependencies)

    return validate


def execution_counts_main(
    *,
    description: str,
    default_root: Path,
    default_inventory: Path,
    default_output: Path,
    default_native: tuple[Path, ...],
    validate_report: Callable[[Path, Path, Path], list[str]],
    load_json: Callable[[Path], Any],
    consolidate: Callable[..., dict[str, Any]],
    report_writer: Callable[[dict[str, Any], Path], bytes],
) -> Callable[[list[str] | None], int]:
    """Bind the execution-count CLI while keeping consolidation independently testable."""

    def main(argv: list[str] | None = None) -> int:
        args = build_parser(
            description,
            default_root,
            default_inventory,
            default_output,
        ).parse_args(argv)
        root = args.root.resolve()
        if args.check:
            errors = validate_report(root, args.inventory, args.output)
            if errors:
                for error in errors:
                    print(f"ERROR: {error}")
                return 1
            path = args.output if args.output.is_absolute() else root / args.output
            print(json.dumps(load_json(path)["totals"], sort_keys=True))
            return 0
        report = consolidate(root, args.inventory, args.native or default_native)
        destination = args.output if args.output.is_absolute() else root / args.output
        report_writer(report, destination)
        print(json.dumps(report["totals"], sort_keys=True))
        return 0

    return main
