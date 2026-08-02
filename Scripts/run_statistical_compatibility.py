#!/usr/bin/env python3
"""Run the blocking statistical compatibility control and write canonical evidence."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Scripts.statistical_compatibility_common import load_json  # noqa: E402
from Scripts.statistical_compatibility_control import validate_authority_and_evaluate  # noqa: E402
from Scripts.statistical_compatibility_evidence import (  # noqa: E402
    build_evidence,
    validate_evidence,
)
from Scripts.statistical_compatibility_evolution import load_committed_authority  # noqa: E402

DEFAULT_AUTHORITY = Path("contracts/statistical-compatibility-authority-v1.0.json")
DEFAULT_AUTHORITY_SCHEMA = Path("contracts/statistical-compatibility-authority-v1.0.schema.json")
DEFAULT_EVIDENCE_SCHEMA = Path("contracts/statistical-compatibility-evidence-v1.0.schema.json")
DEFAULT_OUTPUT = Path("reports/statistical-compatibility-evidence.json")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--authority", type=Path, default=DEFAULT_AUTHORITY)
    parser.add_argument("--authority-schema", type=Path, default=DEFAULT_AUTHORITY_SCHEMA)
    parser.add_argument("--evidence-schema", type=Path, default=DEFAULT_EVIDENCE_SCHEMA)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--print-fingerprints", action="store_true")
    return parser


def _at(root: Path, path: Path) -> Path:
    return path if path.is_absolute() else root / path


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        authority = load_json(_at(args.root, args.authority))
        authority_schema = load_json(_at(args.root, args.authority_schema))
        evidence_schema = load_json(_at(args.root, args.evidence_schema))
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        print(
            f"ERROR compatibility_control_error: cannot load compatibility authority: {exc}",
            file=sys.stderr,
        )
        return 2
    states, proof_fingerprints, diagnostics = validate_authority_and_evaluate(
        args.root,
        authority,
        authority_schema,
        load_committed_authority(args.root, args.authority.as_posix()),
    )
    if args.print_fingerprints:
        for state in states:
            print(f"component {state['id']}: {state['actual_semantic_fingerprint']}")
        for proof_id, fingerprint in proof_fingerprints.items():
            print(f"proof {proof_id}: {fingerprint}")
    evidence = build_evidence(authority, states, proof_fingerprints, diagnostics)
    evidence_issues = validate_evidence(evidence, evidence_schema)
    output = _at(args.root, args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    for diagnostic in diagnostics:
        print(
            f"ERROR {diagnostic.classification} [{diagnostic.component}] "
            f"{diagnostic.code}: {diagnostic.corrective_action}",
            file=sys.stderr,
        )
    for issue in evidence_issues:
        print(f"ERROR compatibility_control_error evidence {issue}", file=sys.stderr)
    if diagnostics or evidence_issues:
        print(f"Statistical compatibility blocked; evidence written to {output}.", file=sys.stderr)
        return 1
    print(
        "Statistical compatibility is coherent and blocking control passed; "
        f"evidence written to {output}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
