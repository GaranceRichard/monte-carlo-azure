#!/usr/bin/env python3
"""Validate compatibility evidence structure, integrity, and freshness."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from Scripts.run_statistical_compatibility import (  # noqa: E402
    DEFAULT_AUTHORITY,
    DEFAULT_AUTHORITY_SCHEMA,
    DEFAULT_EVIDENCE_SCHEMA,
    DEFAULT_OUTPUT,
)
from Scripts.statistical_compatibility_common import load_json  # noqa: E402
from Scripts.statistical_compatibility_control import validate_authority_and_evaluate  # noqa: E402
from Scripts.statistical_compatibility_evidence import (  # noqa: E402
    build_evidence,
    validate_evidence,
)
from Scripts.statistical_compatibility_evolution import load_committed_authority  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--evidence", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)
    try:
        authority = load_json(args.root / DEFAULT_AUTHORITY)
        authority_schema = load_json(args.root / DEFAULT_AUTHORITY_SCHEMA)
        evidence_schema = load_json(args.root / DEFAULT_EVIDENCE_SCHEMA)
        evidence = load_json(args.root / args.evidence)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"ERROR: compatibility evidence cannot be loaded: {exc}", file=sys.stderr)
        return 2
    issues = validate_evidence(evidence, evidence_schema)
    states, proofs, diagnostics = validate_authority_and_evaluate(
        args.root,
        authority,
        authority_schema,
        load_committed_authority(args.root, DEFAULT_AUTHORITY.as_posix()),
    )
    expected = build_evidence(authority, states, proofs, diagnostics)
    if evidence != expected:
        issues.append("/: compatibility evidence is stale against current semantic authorities")
    if issues:
        for issue in issues:
            print(f"ERROR: {issue}", file=sys.stderr)
        return 1
    print("Statistical compatibility evidence is valid, canonical, and current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
