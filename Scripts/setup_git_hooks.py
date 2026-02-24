#!/usr/bin/env python3
"""Configure git to use versioned hooks from .githooks."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    git_dir = REPO_ROOT / ".git"
    if not git_dir.exists():
        print("Skipping git hook setup: .git directory not found.")
        return 0

    result = subprocess.run(
        ["git", "config", "--local", "core.hooksPath", ".githooks"],
        cwd=REPO_ROOT,
        check=False,
    )
    if result.returncode != 0:
        print("Failed to configure core.hooksPath to .githooks.", file=sys.stderr)
        return result.returncode

    print("Configured git hooks path: .githooks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
