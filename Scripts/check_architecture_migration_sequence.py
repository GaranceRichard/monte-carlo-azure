#!/usr/bin/env python3
"""Validate the publishable and acyclic migration sequence for Feature 7."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.architecture_migration_sequence_graph import (  # noqa: E402
    DEFAULT_BACKLOG,
    DEFAULT_DECISION,
    DEFAULT_EXPECTATIONS,
    DEFAULT_PLAN,
    FOUNDATIONS,
    MIGRATIONS,
    completed_from_backlog,
    documented_precedences,
    earliest_waves,
    find_cycles,
    graph_from_expectations,
    load_plan,
)
from Scripts.architecture_migration_sequence_plan import validate_sequence  # noqa: E402
from Scripts.architecture_migration_sequence_validation import (  # noqa: E402
    validate_documented_precedences,
    validate_published_state,
)

__all__ = [
    "DEFAULT_BACKLOG",
    "DEFAULT_DECISION",
    "DEFAULT_EXPECTATIONS",
    "DEFAULT_PLAN",
    "FOUNDATIONS",
    "MIGRATIONS",
    "completed_from_backlog",
    "documented_precedences",
    "earliest_waves",
    "find_cycles",
    "graph_from_expectations",
    "load_plan",
    "validate_documented_precedences",
    "validate_published_state",
    "validate_sequence",
    "main",
]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=DEFAULT_PLAN)
    parser.add_argument("--decision", type=Path, default=DEFAULT_DECISION)
    parser.add_argument("--expectations", type=Path, default=DEFAULT_EXPECTATIONS)
    parser.add_argument("--backlog", type=Path, default=DEFAULT_BACKLOG)
    args = parser.parse_args(argv)
    try:
        plan = load_plan(args.plan)
        graph = graph_from_expectations(args.expectations)
        completed = completed_from_backlog(args.backlog)
        errors = validate_sequence(plan, graph, completed)
        documented = documented_precedences(args.decision)
        errors.extend(validate_documented_precedences(graph, documented))
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: architecture migration sequence check could not run: {exc}", file=sys.stderr)
        return 2
    if errors:
        print("ERROR: architecture migration sequence violations:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    levels = earliest_waves(graph)
    immediate_count = sum(level == 1 for level in levels.values())
    print(
        "Architecture migration sequence check passed: "
        f"{len(graph)} outcomes, {max(levels.values())} waves, "
        f"{immediate_count} immediately parallelizable."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
