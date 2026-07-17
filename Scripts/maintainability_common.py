from __future__ import annotations

import fnmatch
from pathlib import Path, PurePosixPath
from typing import Iterable


def normalize_path(value: str | Path) -> str:
    """Return one stable repository path representation on Windows and Linux."""
    raw = str(value).replace("\\", "/")
    parts = [part for part in PurePosixPath(raw).parts if part not in ("", ".", "/")]
    return "/".join(parts)


def matches(path: str, patterns: Iterable[str]) -> bool:
    return any(fnmatch.fnmatchcase(path, normalize_path(pattern)) for pattern in patterns)
