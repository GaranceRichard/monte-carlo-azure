"""Canonical access to the Git index used by commit-time quality controls."""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

REPOSITORY_GIT_VARIABLES = (
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_QUARANTINE_PATH",
    "GIT_SHALLOW_FILE",
    "GIT_CEILING_DIRECTORIES",
    "GIT_DISCOVERY_ACROSS_FILESYSTEM",
)


@dataclass(frozen=True)
class StagedChange:
    """One NUL-delimited name-status entry from the active Git index."""

    status: str
    paths: tuple[str, ...]


class GitStagingError(RuntimeError):
    """Raised when the active Git index cannot be resolved or read."""


def isolated_git_environment(
    environment: Mapping[str, str] | None = None,
) -> dict[str, str]:
    """Remove repository-specific Git state while preserving process settings."""
    isolated = dict(os.environ if environment is None else environment)
    for name in REPOSITORY_GIT_VARIABLES:
        isolated.pop(name, None)
    return isolated


def parse_staged_changes(output: str) -> tuple[StagedChange, ...]:
    """Parse ``git diff --cached --name-status -z`` output."""
    tokens = output.split("\0")
    if tokens and tokens[-1] == "":
        tokens.pop()

    changes: list[StagedChange] = []
    index = 0
    while index < len(tokens):
        status_token = tokens[index]
        if not status_token:
            raise GitStagingError("empty staged change status")
        status = status_token[0]
        index += 1
        path_count = 2 if status in {"C", "R"} else 1
        paths = tuple(tokens[index : index + path_count])
        if len(paths) != path_count:
            raise GitStagingError(f"incomplete staged change entry for status {status}")
        index += path_count
        changes.append(StagedChange(status=status, paths=paths))
    return tuple(changes)


def _git(
    repository_root: Path,
    args: list[str],
    *,
    environment: Mapping[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=repository_root,
        env=(
            dict(environment)
            if environment is not None
            else isolated_git_environment()
        ),
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def read_staged_changes(
    repository_root: Path,
    *,
    environment: Mapping[str, str] | None = None,
) -> tuple[StagedChange, ...]:
    """Read every relevant entry from the active index exactly once."""
    result = _git(
        repository_root,
        [
            "diff",
            "--cached",
            "--name-status",
            "-z",
            "--find-renames",
            "--diff-filter=ACMRD",
        ],
        environment=environment,
    )
    if result.returncode:
        detail = result.stderr.strip() or "git diff --cached failed"
        raise GitStagingError(detail)
    return parse_staged_changes(result.stdout)


def changed_paths(changes: tuple[StagedChange, ...]) -> tuple[str, ...]:
    """Flatten staged entries without losing rename sources or destinations."""
    return tuple(dict.fromkeys(path for change in changes for path in change.paths))


def _git_path(
    repository_root: Path,
    args: list[str],
    *,
    environment: Mapping[str, str] | None = None,
) -> str:
    result = _git(repository_root, args, environment=environment)
    value = result.stdout.strip()
    if result.returncode or not value:
        detail = result.stderr.strip() or f"git {' '.join(args)} returned no path"
        raise GitStagingError(detail)
    return value


def resolve_index_path(
    repository_root: Path,
    *,
    environment: Mapping[str, str] | None = None,
) -> Path:
    """Resolve ``GIT_INDEX_FILE`` before commands move into a staged snapshot."""
    source_environment = environment if environment is not None else os.environ
    configured = source_environment.get("GIT_INDEX_FILE")
    raw_path = configured or _git_path(
        repository_root,
        ["rev-parse", "--git-path", "index"],
        environment=source_environment,
    )
    index_path = Path(raw_path)
    if not index_path.is_absolute():
        index_path = repository_root / index_path
    return index_path.resolve()


def index_git_environment(
    repository_root: Path,
    *,
    environment: Mapping[str, str] | None = None,
) -> dict[str, str]:
    """Return stable absolute Git paths for every snapshot subprocess."""
    source_environment = environment if environment is not None else os.environ
    configured_git_dir = source_environment.get("GIT_DIR")
    raw_git_dir = configured_git_dir or _git_path(
        repository_root,
        ["rev-parse", "--absolute-git-dir"],
        environment=source_environment,
    )
    git_dir = Path(raw_git_dir)
    if not git_dir.is_absolute():
        git_dir = repository_root / git_dir
    configured_work_tree = source_environment.get("GIT_WORK_TREE")
    work_tree = Path(configured_work_tree or repository_root)
    if not work_tree.is_absolute():
        work_tree = repository_root / work_tree
    return {
        "GIT_DIR": str(git_dir.resolve()),
        "GIT_WORK_TREE": str(work_tree.resolve()),
        "GIT_INDEX_FILE": str(
            resolve_index_path(repository_root, environment=source_environment)
        ),
    }


def active_index_git_environment(
    repository_root: Path,
    *,
    environment: Mapping[str, str] | None = None,
) -> dict[str, str]:
    """Build a clean subprocess environment retaining only this active index."""
    source_environment = environment if environment is not None else os.environ
    active = isolated_git_environment(source_environment)
    active.update(
        index_git_environment(repository_root, environment=source_environment)
    )
    return active
