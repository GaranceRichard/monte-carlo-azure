"""Cheap, read-only PBI scope policy used before expensive validation."""

from __future__ import annotations

import fnmatch
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any


def changed_paths_since_base(
    base: str,
    repository_root: Path,
    *,
    git_output: Callable[..., str],
) -> tuple[str, tuple[str, ...]]:
    """Return the complete branch/workspace scope relative to one merge base."""
    merge_base = git_output(
        ["merge-base", base, "HEAD"],
        repository_root=repository_root,
    ).strip()
    tracked = git_output(
        ["diff", "--name-only", "--diff-filter=ACMRD", "-z", merge_base, "--"],
        repository_root=repository_root,
    )
    untracked = git_output(
        ["ls-files", "--others", "--exclude-standard", "-z"],
        repository_root=repository_root,
    )
    paths = tuple(
        dict.fromkeys(path for path in (*tracked.split("\0"), *untracked.split("\0")) if path)
    )
    return merge_base, paths


def pattern_matches(path: str, pattern: str) -> bool:
    normalized_path = path.replace("\\", "/").strip("/")
    normalized_pattern = pattern.replace("\\", "/").strip("/")
    if not normalized_pattern:
        return False
    return (
        fnmatch.fnmatchcase(normalized_path, normalized_pattern)
        or normalized_path == normalized_pattern
        or normalized_path.startswith(f"{normalized_pattern}/")
    )


def summarize_values(values: tuple[str, ...], limit: int = 8) -> str:
    visible = values[:limit]
    suffix = f" (+{len(values) - limit})" if len(values) > limit else ""
    return ", ".join(visible) + suffix if visible else "(none)"


def run_scope_check(
    base: str,
    allowed_patterns: tuple[str, ...],
    *,
    allow_massive: bool,
    changed_paths_loader: Callable[[str, Path], tuple[str, tuple[str, ...]]],
    classify: Callable[[tuple[str, ...]], Any],
    repository_root: Path,
) -> int:
    """Check the live PBI scope without running tests or generating evidence."""
    if not allowed_patterns:
        print("ERROR: declare the intended PBI paths with at least one --allow.", file=sys.stderr)
        return 2
    try:
        merge_base, paths = changed_paths_loader(base, repository_root)
    except RuntimeError as exc:
        print(f"ERROR: unable to resolve PBI scope from {base}: {exc}", file=sys.stderr)
        return 2

    unexpected = tuple(
        path
        for path in paths
        if not any(pattern_matches(path, pattern) for pattern in allowed_patterns)
    )
    classification = classify(paths) if paths else None
    level = classification.level.value if classification is not None else "none"
    print(
        f"PBI scope: base={merge_base[:12]} files={len(paths)} "
        f"level={level} allowed={len(allowed_patterns)}"
    )
    print(f"Paths: {summarize_values(paths)}")
    if unexpected:
        print(
            f"ERROR: {len(unexpected)} path(s) are outside the declared PBI scope: "
            f"{summarize_values(unexpected)}",
            file=sys.stderr,
        )
        return 1
    if classification is not None and classification.level.value == "massive":
        print(f"Massive triggers: {summarize_values(classification.trigger_paths)}")
        if not allow_massive:
            print(
                "ERROR: massive scope requires explicit --allow-massive acknowledgement.",
                file=sys.stderr,
            )
            return 1
    print("PBI scope is controlled.")
    return 0
