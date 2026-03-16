#!/usr/bin/env python3
"""
Fail when known French-only domain terms appear in code identifiers.

Repository rule:
- code identifiers are in English
- user-facing strings remain in French

This guard is intentionally pragmatic. It inspects common identifier
declaration sites in Python and TypeScript/JavaScript sources and blocks the
French terms that already created mixed naming in the codebase.
"""

from __future__ import annotations

import re
import sys
import tokenize
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET_DIRS = (
    ROOT / "backend",
    ROOT / "frontend" / "src",
    ROOT / "frontend" / "tests",
    ROOT / "Scripts",
)
TARGET_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".jsx"}
BLOCKED_FRAGMENTS = (
    "arrimage",
    "arrime",
    "optimiste",
    "conservateur",
    "hypothese",
)

JS_IDENTIFIER_PATTERNS = (
    re.compile(
        r"\b(?:const|let|var|function|class|interface|type|enum)\s+"
        r"(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)"
    ),
    re.compile(
        r"(?m)(?:^|[,{(])\s*(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*\??:"
    ),
)


@dataclass(frozen=True)
class Violation:
    path: Path
    line: int
    identifier: str
    fragment: str


def _iter_source_files() -> list[Path]:
    files: list[Path] = []
    for base in TARGET_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix in TARGET_SUFFIXES and path.is_file():
                files.append(path)
    return sorted(files)


def _blocked_fragment(identifier: str) -> str | None:
    lowered = identifier.casefold()
    for fragment in BLOCKED_FRAGMENTS:
        if fragment in lowered:
            return fragment
    return None


def _extract_python_identifiers(path: Path) -> list[Violation]:
    violations: list[Violation] = []
    with path.open("r", encoding="utf-8") as handle:
        for token in tokenize.generate_tokens(handle.readline):
            if token.type != tokenize.NAME:
                continue
            fragment = _blocked_fragment(token.string)
            if fragment is None:
                continue
            violations.append(
                Violation(
                    path=path,
                    line=token.start[0],
                    identifier=token.string,
                    fragment=fragment,
                )
            )
    return violations


def _strip_js_comments_and_strings(text: str) -> str:
    pattern = re.compile(
        r"""
        //.*?$ |
        /\*.*?\*/ |
        "(?:\\.|[^"\\])*" |
        '(?:\\.|[^'\\])*' |
        `(?:\\.|[^`\\])*`
        """,
        re.MULTILINE | re.DOTALL | re.VERBOSE,
    )
    return pattern.sub(lambda match: " " * len(match.group(0)), text)


def _extract_js_identifiers(path: Path) -> list[Violation]:
    text = path.read_text(encoding="utf-8")
    stripped = _strip_js_comments_and_strings(text)
    violations: list[Violation] = []
    seen: set[tuple[int, str]] = set()

    for pattern in JS_IDENTIFIER_PATTERNS:
        for match in pattern.finditer(stripped):
            identifier = match.group("name")
            fragment = _blocked_fragment(identifier)
            if fragment is None:
                continue
            line = stripped.count("\n", 0, match.start("name")) + 1
            key = (line, identifier)
            if key in seen:
                continue
            seen.add(key)
            violations.append(
                Violation(
                    path=path,
                    line=line,
                    identifier=identifier,
                    fragment=fragment,
                )
            )

    return violations


def _scan_file(path: Path) -> list[Violation]:
    if path.suffix == ".py":
        return _extract_python_identifiers(path)
    return _extract_js_identifiers(path)


def main() -> int:
    violations: list[Violation] = []
    for path in _iter_source_files():
        violations.extend(_scan_file(path))

    if not violations:
        print("No violations : Naming compliance is ok")
        return 0

    print("ERROR: naming convention check failed.", file=sys.stderr)
    print(
        "Code identifiers must be in English; keep French only for user-facing strings.",
        file=sys.stderr,
    )
    for violation in violations:
        relpath = violation.path.relative_to(ROOT).as_posix()
        print(
            f"  - {relpath}:{violation.line}: "
            f'identifier "{violation.identifier}" contains French fragment "{violation.fragment}"',
            file=sys.stderr,
        )
    print(
        "\nAction: rename the identifier to English or, if this is user-facing text, "
        "keep it inside a string instead of an identifier.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
