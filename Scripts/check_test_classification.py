#!/usr/bin/env python3
"""Block stale, ambiguous, invalid, or unauditable test classifications."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.test_classification_compliance import (  # noqa: E402
    compliance_summary,
    validate_repository,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--node-command", default="node")
    args = parser.parse_args(argv)
    errors = validate_repository(args.root, node_command=args.node_command)
    if errors:
        print("ERROR: test classification compliance failed.", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(compliance_summary(args.root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
