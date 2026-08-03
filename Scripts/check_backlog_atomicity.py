#!/usr/bin/env python3
"""Validate the structural atomicity and readiness of future backlog PBIs."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.backlog_atomicity_model import (  # noqa: E402
    DEFAULT_BACKLOG,
    DEFAULT_EXPECTATIONS,
    DEFAULT_GOVERNANCE,
    Diagnostic,
)
from Scripts.backlog_atomicity_parsing import (  # noqa: E402
    markdown_table,
    parse_expectations,
    parse_readiness,
    parse_registry,
)
from Scripts.backlog_atomicity_validation import validate_atomicity  # noqa: E402

__all__ = [
    "Diagnostic",
    "markdown_table",
    "parse_expectations",
    "parse_readiness",
    "parse_registry",
    "validate_atomicity",
    "main",
]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backlog", type=Path, default=DEFAULT_BACKLOG)
    parser.add_argument("--governance", type=Path, default=DEFAULT_GOVERNANCE)
    parser.add_argument("--expectations", type=Path, default=DEFAULT_EXPECTATIONS)
    args = parser.parse_args(argv)
    try:
        backlog = args.backlog.read_text(encoding="utf-8")
        governance = args.governance.read_text(encoding="utf-8")
        documents = {
            str(path): path.read_text(encoding="utf-8") for path in args.expectations.glob("*.md")
        }
    except (OSError, UnicodeError) as exc:
        print(f"ERROR: backlog atomicity check could not run: {exc}", file=sys.stderr)
        return 2
    diagnostics = validate_atomicity(backlog, governance, documents)
    if diagnostics:
        print("ERROR: backlog atomicity violations:", file=sys.stderr)
        for diagnostic in diagnostics:
            print(f"- {diagnostic.render()}", file=sys.stderr)
        return 1
    print("Backlog atomicity check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
