#!/usr/bin/env python3
"""Validate the versioned statistical reference corpus independently of either engine."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "contracts/statistical-reference-corpus-v1.0.schema.json"
VALID_EXAMPLE_PATH = (
    ROOT / "contracts/examples/statistical-reference-corpus-v1.0.minimal.json"
)
INVALID_EXAMPLE_PATH = (
    ROOT / "contracts/examples/statistical-reference-corpus-v1.0.invalid.json"
)


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    instance_path: str
    keyword: str
    message: str
    schema_path: str

    def render(self, source: Path) -> str:
        return (
            f"{source.as_posix()}:{self.instance_path}: [{self.keyword}] {self.message} "
            f"(schema {self.schema_path})"
        )


def _json_pointer(parts: Any) -> str:
    escaped = [str(part).replace("~", "~0").replace("/", "~1") for part in parts]
    return "/" + "/".join(escaped) if escaped else "/"


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate JSON property: {key}")
        value[key] = item
    return value


def load_json(path: Path) -> Any:
    try:
        return json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_keys,
        )
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"{path.as_posix()}:{exc.lineno}:{exc.colno}: invalid JSON: {exc.msg}"
        ) from exc


def validate_instance(instance: Any, schema: dict[str, Any]) -> list[ValidationIssue]:
    validator = Draft202012Validator(schema)
    issues = [
        ValidationIssue(
            instance_path=_json_pointer(error.absolute_path),
            keyword=str(error.validator),
            message=error.message,
            schema_path=_json_pointer(error.absolute_schema_path),
        )
        for error in validator.iter_errors(instance)
    ]
    return sorted(
        issues,
        key=lambda issue: (
            issue.instance_path,
            issue.keyword,
            issue.message,
            issue.schema_path,
        ),
    )


def validate_contract(instance: Any, schema: dict[str, Any]) -> list[ValidationIssue]:
    issues = validate_instance(instance, schema)
    if not isinstance(instance, dict) or not isinstance(instance.get("cases"), list):
        return issues
    first_index_by_id: dict[str, int] = {}
    for index, case in enumerate(instance["cases"]):
        if not isinstance(case, dict) or not isinstance(case.get("id"), str):
            continue
        case_id = case["id"]
        if case_id in first_index_by_id:
            issues.append(
                ValidationIssue(
                    instance_path=f"/cases/{index}/id",
                    keyword="uniqueCaseId",
                    message=(
                        f"{case_id!r} duplicates /cases/"
                        f"{first_index_by_id[case_id]}/id"
                    ),
                    schema_path="/$comment",
                )
            )
        else:
            first_index_by_id[case_id] = index
    return sorted(
        issues,
        key=lambda issue: (
            issue.instance_path,
            issue.keyword,
            issue.message,
            issue.schema_path,
        ),
    )


def run_control(instance_paths: list[Path] | None = None) -> list[str]:
    schema = load_json(SCHEMA_PATH)
    if not isinstance(schema, dict):
        return [f"{SCHEMA_PATH.as_posix()}:/: schema must be a JSON object"]
    Draft202012Validator.check_schema(schema)

    errors: list[str] = []
    for path in instance_paths or [VALID_EXAMPLE_PATH]:
        errors.extend(issue.render(path) for issue in validate_contract(load_json(path), schema))

    negative_issues = validate_contract(load_json(INVALID_EXAMPLE_PATH), schema)
    if not negative_issues:
        errors.append(
            f"{INVALID_EXAMPLE_PATH.as_posix()}:/: negative example was unexpectedly accepted"
        )
    elif not any(
        issue.instance_path == "/cases/0/input"
        and issue.keyword == "additionalProperties"
        for issue in negative_issues
    ):
        errors.append(
            f"{INVALID_EXAMPLE_PATH.as_posix()}:/cases/0/input: "
            "negative example did not produce the expected actionable diagnostic"
        )
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "instances",
        nargs="*",
        type=Path,
        help="Corpus instances expected to satisfy the normative 1.0 schema.",
    )
    args = parser.parse_args(argv)
    try:
        errors = run_control(args.instances or None)
    except (OSError, UnicodeError, ValueError, SchemaError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    if errors:
        print("ERROR: statistical reference corpus validation failed.", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(
        "Statistical reference corpus schema 1.0 is valid; "
        "positive example accepted and negative example rejected."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
