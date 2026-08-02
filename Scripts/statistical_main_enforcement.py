#!/usr/bin/env python3
"""Enforce run-scoped statistical evidence for the blocking main profile."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Scripts.statistical_consolidated_source_catalog import (  # noqa: E402
    parse_source_paths,
)
from Scripts.statistical_main_authorities import (  # noqa: E402
    validate_authorities,
    validate_corpus,
    validate_protocol,
)
from Scripts.statistical_main_enforcement_common import (  # noqa: E402
    verify_requirements,
    write_attestation,
)
from Scripts.statistical_main_evidence import (  # noqa: E402
    enforce,
    observed_statuses,
    status_issues,
)
from Scripts.statistical_main_policy import (  # noqa: E402
    POLICY_PATH,
    POLICY_SCHEMA_PATH,
)
from Scripts.validate_statistical_consolidated_report import run_control  # noqa: E402


def _print_issues(label: str, issues: list[str], reproduce: str) -> int:
    if not issues:
        print(f"{label}: match; blocking main control passed.")
        return 0
    print(f"ERROR: {label} blocked.", file=sys.stderr)
    for issue in issues:
        print(f"- {issue}", file=sys.stderr)
    print(
        f"Corrective action: repair the specialized evidence and rerun `{reproduce}`.",
        file=sys.stderr,
    )
    return 1


def _validation_parser(subparsers: Any, name: str) -> None:
    child = subparsers.add_parser(name)
    child.add_argument("--root", type=Path, default=ROOT)
    child.add_argument("--output", type=Path, required=True)
    child.add_argument("--requires", action="append", type=Path, default=[])


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name in ("validate-authorities", "validate-corpus", "validate-protocol"):
        _validation_parser(subparsers, name)
    consolidated = subparsers.add_parser("validate-consolidated")
    consolidated.add_argument("--root", type=Path, default=ROOT)
    consolidated.add_argument("--report", type=Path, required=True)
    consolidated.add_argument("--schema", type=Path, required=True)
    consolidated.add_argument("--markdown", type=Path, required=True)
    consolidated.add_argument("--source-path", action="append", default=[])
    consolidated.add_argument("--requires", action="append", type=Path, default=[])
    consolidated.add_argument("--output", type=Path, required=True)
    child = subparsers.add_parser("enforce")
    child.add_argument("--root", type=Path, default=ROOT)
    child.add_argument(
        "--kind",
        choices=(
            "parity",
            "exact",
            "batching",
            "distribution",
            "compatibility",
        ),
        required=True,
    )
    child.add_argument("--artifact", type=Path, required=True)
    child.add_argument("--schema", type=Path, required=True)
    child.add_argument("--output", type=Path, required=True)
    child.add_argument("--requires", action="append", type=Path, default=[])
    child.add_argument("--control", action="append", required=True)
    child.add_argument("--reproduce", required=True)
    return parser


def _requirement_issues(
    args: argparse.Namespace,
    root: Path,
    expected: set[str],
    consumer: str,
) -> list[str]:
    return verify_requirements(
        root,
        args.requires,
        expected,
        consumer_controls={consumer},
    )


def _validation_inputs(
    args: argparse.Namespace, root: Path
) -> tuple[list[str], list[str], list[Path], str]:
    if args.command == "validate-authorities":
        return (
            [
                *_requirement_issues(args, root, set(), "authority_preflight"),
                *validate_authorities(root),
            ],
            ["authority_preflight"],
            [POLICY_PATH, POLICY_SCHEMA_PATH],
            (
                "python Scripts/statistical_main_enforcement.py validate-authorities "
                "--output reports/test-execution-artifacts/main/"
                "statistical-authorities/authority-attestation.json"
            ),
        )
    if args.command == "validate-corpus":
        return (
            [
                *_requirement_issues(
                    args, root, {"authority_preflight"}, "corpus_and_probes"
                ),
                *validate_corpus(root),
            ],
            ["corpus_and_probes"],
            [
                Path("contracts/statistical-reference-corpus-v1.0.json"),
                Path("contracts/statistical-validation-probes-v1.0.json"),
            ],
            "python Scripts/validate_statistical_reference_corpus.py",
        )
    return (
        [
            *_requirement_issues(
                args,
                root,
                {"authority_preflight", "corpus_and_probes"},
                "distribution_protocol",
            ),
            *validate_protocol(root),
        ],
        ["distribution_protocol"],
        [
            Path("contracts/statistical-distribution-protocol-v1.0.json"),
            Path("contracts/statistical-distribution-seeds-v1.0.json"),
        ],
        "python Scripts/validate_statistical_distribution_protocol.py",
    )


def _consolidated_inputs(
    args: argparse.Namespace, root: Path
) -> tuple[list[str], list[str], list[Path], str]:
    expected = {
        "deterministic_parity",
        "exact_replay",
        "batching_independence",
        "distributional_parity",
        "statistical_compatibility",
    }
    issues = verify_requirements(
        root,
        args.requires,
        expected,
        consumer_controls={"consolidated_report_validation"},
    )
    try:
        source_paths = parse_source_paths(args.source_path)
        report, validation_issues = run_control(
            root / args.report,
            root / args.schema,
            root / args.markdown,
            root=root,
            source_paths=source_paths,
        )
        issues.extend(validation_issues)
        statuses = observed_statuses("consolidated", report or {})
        issues.extend(status_issues(root, statuses if not issues else {"invalid_evidence"}))
    except (OSError, UnicodeError, ValueError) as exc:
        issues.append(str(exc))
    return (
        issues,
        ["consolidated_report_generation", "consolidated_report_validation"],
        [args.report, args.markdown],
        "python Scripts/validate_statistical_consolidated_report.py",
    )


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    root = args.root.resolve()
    if args.command == "enforce":
        issues, statuses = enforce(
            root, args.kind, args.artifact, args.schema, args.requires, args.control
        )
        controls = args.control
        artifacts = [args.artifact]
        reproduce = args.reproduce
        if not issues:
            print(f"Observed statistical statuses: {', '.join(sorted(statuses))}.")
    elif args.command == "validate-consolidated":
        issues, controls, artifacts, reproduce = _consolidated_inputs(args, root)
    else:
        issues, controls, artifacts, reproduce = _validation_inputs(args, root)
    code = _print_issues(args.command, issues, reproduce)
    if code:
        return code
    write_attestation(root, args.output, controls, artifacts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
