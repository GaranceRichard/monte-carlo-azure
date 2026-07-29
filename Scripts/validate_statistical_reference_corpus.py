#!/usr/bin/env python3
"""Validate the versioned statistical reference corpus independently of either engine."""

from __future__ import annotations

import argparse
import json
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.statistical_reference_corpus_invariants import (  # noqa: E402, I001
    PBI_210_CASE_IDS as _PBI_210_CASE_IDS,
    PBI_211_CASE_IDS as _PBI_211_CASE_IDS,
    InputRejectionProbe,
    ValidationIssue,
    apply_probe as _apply_probe,
    cases_by_id as _cases_by_id,
    validate_case_semantics as _validate_case_semantics,
)
from Scripts.statistical_reference_corpus_pbi_214 import (  # noqa: E402
    PBI_214_CASE_IDS as _PBI_214_CASE_IDS,
)
from Scripts.statistical_reference_corpus_validation import validate_reference_corpus  # noqa: E402

PBI_210_CASE_IDS = _PBI_210_CASE_IDS
PBI_211_CASE_IDS = _PBI_211_CASE_IDS
PBI_214_CASE_IDS = _PBI_214_CASE_IDS

SCHEMA_PATH = ROOT / "contracts/statistical-reference-corpus-v1.0.schema.json"
CORPUS_PATH = ROOT / "contracts/statistical-reference-corpus-v1.0.json"
VALID_EXAMPLE_PATH = ROOT / "contracts/examples/statistical-reference-corpus-v1.0.minimal.json"
INVALID_EXAMPLE_PATH = ROOT / "contracts/examples/statistical-reference-corpus-v1.0.invalid.json"

INPUT_REJECTION_PROBES = (
    InputRejectionProbe(
        "throughput-below-minimum-length",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "throughput_samples"),
        [1, 1, 1, 1, 1],
        "/input/throughput_samples",
        "minItems",
    ),
    InputRejectionProbe(
        "throughput-above-maximum-length",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "throughput_samples"),
        [1] * 522,
        "/input/throughput_samples",
        "maxItems",
    ),
    InputRejectionProbe(
        "throughput-string-item",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "throughput_samples"),
        [1, 1, 1, 1, 1, "1"],
        "/input/throughput_samples/5",
        "type",
    ),
    InputRejectionProbe(
        "throughput-decimal-item",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "throughput_samples"),
        [1, 1, 1, 1, 1, 1.5],
        "/input/throughput_samples/5",
        "type",
    ),
    InputRejectionProbe(
        "throughput-negative-item",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "throughput_samples"),
        [1, 1, 1, 1, 1, -1],
        "/input/throughput_samples/5",
        "minimum",
    ),
    InputRejectionProbe(
        "too-few-usable-samples-after-zero-exclusion",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "throughput_samples"),
        [0, 1, 1, 1, 1, 1],
        "/input/throughput_samples",
        "minContains",
    ),
    InputRejectionProbe(
        "include-zero-weeks-wrong-type",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "include_zero_weeks"),
        "false",
        "/input/include_zero_weeks",
        "type",
    ),
    InputRejectionProbe(
        "mode-outside-contract",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "mode"),
        "invalid",
        "/input/mode",
        "enum",
    ),
    InputRejectionProbe(
        "simulation-count-below-minimum",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "n_sims"),
        999,
        "/input/n_sims",
        "minimum",
    ),
    InputRejectionProbe(
        "simulation-count-above-maximum",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "n_sims"),
        200001,
        "/input/n_sims",
        "maximum",
    ),
    InputRejectionProbe(
        "simulation-count-wrong-type",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "n_sims"),
        "1000",
        "/input/n_sims",
        "type",
    ),
    InputRejectionProbe(
        "target-weeks-below-minimum",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "target_weeks"),
        0,
        "/input/target_weeks",
        "minimum",
    ),
    InputRejectionProbe(
        "target-weeks-above-maximum",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "target_weeks"),
        522,
        "/input/target_weeks",
        "maximum",
    ),
    InputRejectionProbe(
        "target-weeks-wrong-type",
        "items-zero-weeks-excluded",
        "replace",
        ("input", "target_weeks"),
        "1",
        "/input/target_weeks",
        "type",
    ),
    InputRejectionProbe(
        "target-weeks-missing",
        "items-zero-weeks-excluded",
        "remove",
        ("input", "target_weeks"),
        None,
        "/input",
        "required",
    ),
    InputRejectionProbe(
        "inactive-backlog-present",
        "items-zero-weeks-excluded",
        "add",
        ("input", "backlog_size"),
        1,
        "/input",
        "not",
    ),
    InputRejectionProbe(
        "backlog-below-minimum",
        "weeks-zero-weeks-included-no-censorship",
        "replace",
        ("input", "backlog_size"),
        0,
        "/input/backlog_size",
        "minimum",
    ),
    InputRejectionProbe(
        "backlog-above-maximum",
        "weeks-zero-weeks-included-no-censorship",
        "replace",
        ("input", "backlog_size"),
        1000001,
        "/input/backlog_size",
        "maximum",
    ),
    InputRejectionProbe(
        "backlog-wrong-type",
        "weeks-zero-weeks-included-no-censorship",
        "replace",
        ("input", "backlog_size"),
        "5",
        "/input/backlog_size",
        "type",
    ),
    InputRejectionProbe(
        "backlog-missing",
        "weeks-zero-weeks-included-no-censorship",
        "remove",
        ("input", "backlog_size"),
        None,
        "/input",
        "required",
    ),
    InputRejectionProbe(
        "inactive-target-present",
        "weeks-zero-weeks-included-no-censorship",
        "add",
        ("input", "target_weeks"),
        1,
        "/input",
        "not",
    ),
    InputRejectionProbe(
        "seed-below-minimum",
        "items-zero-weeks-excluded",
        "replace",
        ("seed",),
        -1,
        "/seed",
        "minimum",
    ),
    InputRejectionProbe(
        "seed-above-maximum",
        "items-zero-weeks-excluded",
        "replace",
        ("seed",),
        4294967296,
        "/seed",
        "maximum",
    ),
    InputRejectionProbe(
        "seed-wrong-type",
        "items-zero-weeks-excluded",
        "replace",
        ("seed",),
        "0",
        "/seed",
        "type",
    ),
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
    first_index_by_scenario: dict[str, int] = {}
    for index, case in enumerate(instance["cases"]):
        if not isinstance(case, dict) or not isinstance(case.get("id"), str):
            continue
        case_id = case["id"]
        if case_id in first_index_by_id:
            issues.append(
                ValidationIssue(
                    instance_path=f"/cases/{index}/id",
                    keyword="uniqueCaseId",
                    message=(f"{case_id!r} duplicates /cases/{first_index_by_id[case_id]}/id"),
                    schema_path="/$comment",
                )
            )
        else:
            first_index_by_id[case_id] = index
        if isinstance(case.get("input"), dict) and type(case.get("seed")) is int:
            scenario = json.dumps(
                {"input": case["input"], "seed": case["seed"]},
                sort_keys=True,
                separators=(",", ":"),
            )
            if scenario in first_index_by_scenario:
                issues.append(
                    ValidationIssue(
                        instance_path=f"/cases/{index}",
                        keyword="uniqueScenario",
                        message=(
                            "normalized input and seed duplicate "
                            f"/cases/{first_index_by_scenario[scenario]}"
                        ),
                        schema_path="/$comment",
                    )
                )
            else:
                first_index_by_scenario[scenario] = index
        issues.extend(_validate_case_semantics(case, index))
    return sorted(
        issues,
        key=lambda issue: (
            issue.instance_path,
            issue.keyword,
            issue.message,
            issue.schema_path,
        ),
    )


def validate_input_rejection_probes(corpus: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    cases = _cases_by_id(corpus)
    errors: list[str] = []
    for probe in INPUT_REJECTION_PROBES:
        candidate_case = deepcopy(cases[probe.source_case_id])
        _apply_probe(candidate_case, probe)
        candidate = deepcopy(corpus)
        candidate["cases"] = [candidate_case]
        issues = validate_instance(candidate, schema)
        expected_path = f"/cases/0{probe.expected_instance_path}"
        if not any(
            issue.instance_path == expected_path and issue.keyword == probe.expected_keyword
            for issue in issues
        ):
            errors.append(
                f"{probe.probe_id}: expected [{probe.expected_keyword}] at "
                f"{expected_path}, got "
                f"{[(issue.instance_path, issue.keyword) for issue in issues]}"
            )
    return errors


def run_control(instance_paths: list[Path] | None = None) -> list[str]:
    schema = load_json(SCHEMA_PATH)
    if not isinstance(schema, dict):
        return [f"{SCHEMA_PATH.as_posix()}:/: schema must be a JSON object"]
    Draft202012Validator.check_schema(schema)

    corpus = load_json(CORPUS_PATH)
    if not isinstance(corpus, dict):
        return [f"{CORPUS_PATH.as_posix()}:/: corpus must be a JSON object"]

    errors: list[str] = []
    for path in instance_paths or [CORPUS_PATH]:
        candidate = corpus if path == CORPUS_PATH else load_json(path)
        issues = validate_reference_corpus(candidate, schema, validate_contract)
        errors.extend(issue.render(path) for issue in issues)
    if not instance_paths:
        errors.extend(
            issue.render(VALID_EXAMPLE_PATH)
            for issue in validate_contract(load_json(VALID_EXAMPLE_PATH), schema)
        )
    errors.extend(
        f"{CORPUS_PATH.as_posix()}:/cases: [inputRejectionProbe] {error}"
        for error in validate_input_rejection_probes(corpus, schema)
    )

    negative_issues = validate_contract(load_json(INVALID_EXAMPLE_PATH), schema)
    if not negative_issues:
        errors.append(
            f"{INVALID_EXAMPLE_PATH.as_posix()}:/: negative example was unexpectedly accepted"
        )
    elif not any(
        issue.instance_path == "/cases/0/input" and issue.keyword == "additionalProperties"
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
        "Statistical reference corpus 1.0 and its schema are valid; "
        "PBI 2.10, PBI 2.11, PBI 2.14, PBI 2.15 and PBI 2.16 scopes are complete, "
        "input rejection probes pass, "
        "positive example is accepted and negative example is rejected."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
