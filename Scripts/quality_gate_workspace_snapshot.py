"""Isolated workspace snapshot primitives for the full local quality gate."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from collections.abc import Callable, Iterator
from contextlib import contextmanager, nullcontext
from pathlib import Path
from typing import Any


def workspace_snapshot_paths(
    repository_root: Path, git_environment: dict[str, str]
) -> tuple[str, ...]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=repository_root,
        env=git_environment,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        detail = result.stderr.strip() or "git ls-files failed"
        raise RuntimeError(f"Unable to enumerate the workspace snapshot: {detail}")
    paths = tuple(dict.fromkeys(item for item in result.stdout.split("\0") if item))
    return (*paths, ".env") if (repository_root / ".env").is_file() else paths


def _copy_regular_file(repository_root: Path, snapshot_root: Path, relative: str) -> None:
    relative_path = Path(relative)
    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise RuntimeError(f"Workspace snapshot source escapes the repository: {relative}")
    source = repository_root / relative_path
    if not source.exists():
        return
    is_junction = getattr(os.path, "isjunction", lambda _path: False)
    if not source.is_file() or source.is_symlink() or is_junction(source):
        raise RuntimeError(f"Workspace snapshot source must be a regular file: {relative}")
    destination = snapshot_root / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def _write_git_pointer(snapshot_root: Path, git_directory: Path) -> None:
    resolved = git_directory.resolve()
    if not resolved.is_dir():
        raise RuntimeError(f"Workspace snapshot Git directory is unavailable: {resolved}")
    (snapshot_root / ".git").write_text(
        f"gitdir: {resolved.as_posix()}\n",
        encoding="utf-8",
    )


@contextmanager
def workspace_snapshot(
    repository_root: Path,
    paths: tuple[str, ...],
    git_directory: Path,
) -> Iterator[Path]:
    with tempfile.TemporaryDirectory(prefix="montecarlo-main-") as temp_dir:
        snapshot_root = Path(temp_dir) / "repository"
        snapshot_root.mkdir()
        for relative in paths:
            _copy_regular_file(repository_root, snapshot_root, relative)
        _write_git_pointer(snapshot_root, git_directory)
        yield snapshot_root


def snapshot_git_environment(
    snapshot_root: Path,
    git_environment: dict[str, str],
) -> dict[str, str]:
    environment = dict(git_environment)
    if not environment.get("GIT_DIR"):
        raise RuntimeError("Workspace snapshot Git directory is not configured.")
    environment["GIT_WORK_TREE"] = str(snapshot_root)
    return environment


def full_profile_isolated(mode: str, profile: str, selected_node: str | None) -> bool:
    return selected_node is None and profile != "pr" and mode in {"ci", "nightly", "release"}


@contextmanager
def validation_snapshot(
    *,
    mode: str,
    profile: str,
    selected_node: str | None,
    repository_root: Path,
    staged_snapshot: Callable[[], Any],
    full_snapshot: Callable[[], Any],
    index_environment: Callable[[], dict[str, str]],
    full_environment: Callable[[Path], dict[str, str]],
) -> Iterator[tuple[Path, bool, dict[str, str] | None]]:
    full_isolated = full_profile_isolated(mode, profile, selected_node)
    manager = (
        staged_snapshot()
        if mode == "fast"
        else full_snapshot()
        if full_isolated
        else nullcontext(repository_root)
    )
    with manager as validation_root:
        isolated = mode == "fast" or full_isolated
        environment = (
            index_environment()
            if mode == "fast"
            else full_environment(validation_root)
            if full_isolated
            else None
        )
        yield validation_root, isolated, environment
