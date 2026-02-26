#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pre-commit guard for repository hygiene.

Checks:
1) README update is staged when code/config changes are staged.
2) README text does not contain common mojibake artifacts.
3) Secret scan via Scripts/check_no_secrets.py.
4) DoD compliance guard via Scripts/check_dod_compliance.py.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
README_PATH = REPO_ROOT / "README.md"
SECRET_CHECK_PATH = REPO_ROOT / "Scripts" / "check_no_secrets.py"
DOD_CHECK_PATH = REPO_ROOT / "Scripts" / "check_dod_compliance.py"

# If one of these paths changes in the index, README.md must also be staged.
README_REQUIRED_PREFIXES = (
    "frontend/",
    "backend/",
    "Scripts/",
    ".github/workflows/",
)
README_REQUIRED_FILES = {
    "requirements.txt",
    "run_app.py",
}

# Typical mojibake fragments seen when UTF-8 is decoded as cp1252/latin1.
MOJIBAKE_TOKENS = (
    "Ã©",
    "Ã¨",
    "Ã ",
    "Ã¢",
    "Ãª",
    "Ã®",
    "Ã´",
    "Ã»",
    "Ã§",
    "â€™",
    "â€œ",
    "â€",
    "â€“",
    "â€”",
    "â€¦",
    "Â ",
    "�",
)


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def staged_files() -> list[str]:
    p = run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"])
    if p.returncode != 0:
        print("ERROR: unable to read staged files.", file=sys.stderr)
        print(p.stderr, file=sys.stderr)
        raise SystemExit(2)
    return [line.strip() for line in p.stdout.splitlines() if line.strip()]


def requires_readme_update(paths: list[str]) -> bool:
    for path in paths:
        if path in README_REQUIRED_FILES:
            return True
        if any(path.startswith(prefix) for prefix in README_REQUIRED_PREFIXES):
            return True
    return False


def check_readme_staged(paths: list[str]) -> int:
    readme_staged = "README.md" in set(paths)
    if requires_readme_update(paths) and not readme_staged:
        print(
            "ERROR: README.md must be updated and staged when code/config changes are committed.",
            file=sys.stderr,
        )
        print("Staged paths triggering this rule:", file=sys.stderr)
        for p in paths:
            if p in README_REQUIRED_FILES or any(
                p.startswith(prefix) for prefix in README_REQUIRED_PREFIXES
            ):
                print(f"  - {p}", file=sys.stderr)
        print("\nAction: update README.md, then run `git add README.md`.", file=sys.stderr)
        return 1
    return 0


def check_readme_encoding() -> int:
    if not README_PATH.exists():
        print("ERROR: README.md is missing.", file=sys.stderr)
        return 1

    text = README_PATH.read_text(encoding="utf-8", errors="replace")
    hits = [token for token in MOJIBAKE_TOKENS if token in text]
    if hits:
        print("ERROR: README.md contains suspicious mojibake characters.", file=sys.stderr)
        print("Detected tokens:", ", ".join(sorted(set(hits))), file=sys.stderr)
        print("Action: re-save README.md in UTF-8 and fix broken accents.", file=sys.stderr)
        return 1
    return 0


def check_no_secrets() -> int:
    if not SECRET_CHECK_PATH.exists():
        print("ERROR: Scripts/check_no_secrets.py is missing.", file=sys.stderr)
        return 1
    p = run([sys.executable, str(SECRET_CHECK_PATH)])
    if p.returncode != 0:
        if p.stdout:
            print(p.stdout, file=sys.stderr, end="")
        if p.stderr:
            print(p.stderr, file=sys.stderr, end="")
        return p.returncode
    return 0


def check_dod_compliance() -> int:
    if not DOD_CHECK_PATH.exists():
        print("ERROR: Scripts/check_dod_compliance.py is missing.", file=sys.stderr)
        return 1
    p = run([sys.executable, str(DOD_CHECK_PATH)])
    if p.returncode != 0:
        if p.stdout:
            print(p.stdout, file=sys.stderr, end="")
        if p.stderr:
            print(p.stderr, file=sys.stderr, end="")
        return p.returncode
    return 0


def main() -> int:
    paths = staged_files()
    if not paths:
        return 0

    checks = (
        check_readme_staged(paths),
        check_readme_encoding(),
        check_no_secrets(),
        check_dod_compliance(),
    )
    return 1 if any(code != 0 for code in checks) else 0


if __name__ == "__main__":
    raise SystemExit(main())
