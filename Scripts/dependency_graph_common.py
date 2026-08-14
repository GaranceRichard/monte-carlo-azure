"""Shared scope, path and evidence primitives for dependency extraction."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path, PurePosixPath
from typing import Any

SOURCE_ROOTS = ("backend/", "Scripts/", "frontend/src/", "frontend/scripts/")
SOURCE_SUFFIXES = {".py", ".js", ".jsx", ".mjs", ".ts", ".tsx"}
TEST_PATH = re.compile(r"(?:^|/)(?:test/|tests/)|\.(?:test|spec)\.[^.]+$")


def normalize_path(value: str | Path) -> str:
    raw = str(value).replace("\\", "/")
    return "/".join(part for part in PurePosixPath(raw).parts if part not in ("", ".", "/"))


def repository_paths(root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=root,
        check=False,
        capture_output=True,
    )
    if result.returncode:
        detail = result.stderr.decode("utf-8", errors="replace").strip() or "git ls-files failed"
        raise RuntimeError(f"Unable to enumerate repository files: {detail}")
    return sorted(normalize_path(item) for item in result.stdout.decode().split("\0") if item)


def _is_source(path: str) -> bool:
    return (
        (any(path.startswith(root) for root in SOURCE_ROOTS) or path == "run_app.py")
        and Path(path).suffix in SOURCE_SUFFIXES
        and not TEST_PATH.search(path)
    )


def source_texts(root: Path, paths: list[str]) -> dict[str, str]:
    return {
        path: (root / path).read_text(encoding="utf-8-sig")
        for path in paths
        if _is_source(path) and (root / path).is_file()
    }


def edge(
    source: str, target: str, line: int, kind: str, phase: str, specifier: str, resolution: str
) -> dict[str, Any]:
    return {
        "source": source,
        "target": target,
        "line": line,
        "kind": kind,
        "phase": phase,
        "specifier": specifier,
        "resolution": resolution,
    }


def line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1
