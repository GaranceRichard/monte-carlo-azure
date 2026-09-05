#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Repository-hygiene checks executed from the publication quality plan.

The pre-push orchestrator separately verifies that the terminal README differs from
the remote base and scans every introduced commit for secrets. This module checks
the terminal tree: README integrity, tracked-file secrets, and DoD compliance.
Backlog consistency is executed separately by the shared quality plan.
"""

from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

README_PATH = REPO_ROOT / "README.md"
SECRET_CHECK_PATH = REPO_ROOT / "Scripts" / "check_no_secrets.py"
DOD_CHECK_PATH = REPO_ROOT / "Scripts" / "check_dod_compliance.py"

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

# Common French terms used in the README. This detects an accidental wholesale conversion
# of French prose to ASCII without treating it as mojibake or inspecting code fragments.
FRENCH_ACCENT_PAIRS = (
    ("prévision", "prevision"),
    ("sécuriser", "securiser"),
    ("périmètre", "perimetre"),
    ("capacité", "capacite"),
    ("fonctionnalités", "fonctionnalites"),
    ("sécurité", "securite"),
    ("qualité", "qualite"),
    ("fiabilité", "fiabilite"),
    ("scénario", "scenario"),
    ("déploiement", "deploiement"),
    ("prérequis", "prerequis"),
    ("contrôle", "controle"),
    ("définition", "definition"),
    ("données", "donnees"),
    ("équipe", "equipe"),
    ("résultat", "resultat"),
)
MAX_UNACCENTED_FRENCH_TERMS = 4


@dataclass(frozen=True)
class GuardCheck:
    """Pure metadata plus callable for one fail-fast guard control."""

    name: str
    input_sources: tuple[str, ...]
    run: Callable[[], int]


def prose_without_code(text: str) -> str:
    """Drop fenced and inline code before checking French documentation prose."""
    prose: list[str] = []
    in_fence = False
    for line in text.splitlines():
        if line.strip().startswith("```"):
            in_fence = not in_fence
            continue
        if not in_fence:
            prose.append(line)
    return re.sub(r"`[^`]*`", "", "\n".join(prose))


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


def check_readme_encoding(readme_path: Path | None = None) -> int:
    readme_path = readme_path or README_PATH
    if not readme_path.exists():
        print("ERROR: README.md is missing.", file=sys.stderr)
        return 1

    text = readme_path.read_text(encoding="utf-8", errors="replace")
    hits = [token for token in MOJIBAKE_TOKENS if token in text]
    if hits:
        print("ERROR: README.md contains suspicious mojibake characters.", file=sys.stderr)
        print("Detected tokens:", ", ".join(sorted(set(hits))), file=sys.stderr)
        print("Action: re-save README.md in UTF-8 and fix broken accents.", file=sys.stderr)
        return 1
    return 0


def check_readme_french_accents(readme_path: Path | None = None) -> int:
    readme_path = readme_path or README_PATH
    if not readme_path.exists():
        print("ERROR: README.md is missing.", file=sys.stderr)
        return 1

    prose = prose_without_code(
        readme_path.read_text(encoding="utf-8", errors="replace")
    ).casefold()
    unaccented = [
        plain
        for _accented, plain in FRENCH_ACCENT_PAIRS
        if re.search(rf"\b{re.escape(plain)}\b", prose)
    ]
    if len(unaccented) > MAX_UNACCENTED_FRENCH_TERMS:
        print(
            "ERROR: README.md appears to contain massively de-accented French prose.",
            file=sys.stderr,
        )
        print(
            "Detected unaccented terms:", ", ".join(sorted(unaccented)), file=sys.stderr
        )
        print(
            "Action: restore French accents in prose; keep technical identifiers unchanged.",
            file=sys.stderr,
        )
        return 1
    return 0


def check_no_secrets() -> int:
    if not SECRET_CHECK_PATH.exists():
        print("ERROR: Scripts/check_no_secrets.py is missing.", file=sys.stderr)
        return 1
    p = run([sys.executable, str(SECRET_CHECK_PATH), "--workspace"])
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


def guard_plan() -> tuple[GuardCheck, ...]:
    """Describe the current ordered checks without executing them."""
    return (
        GuardCheck("README encoding", ("workspace",), check_readme_encoding),
        GuardCheck("README French accents", ("workspace",), check_readme_french_accents),
        GuardCheck("Final tree secret scan", ("workspace",), check_no_secrets),
        GuardCheck("DoD compliance", ("workspace",), check_dod_compliance),
    )


def main() -> int:
    for check in guard_plan():
        code = check.run()
        if code != 0:
            return code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
