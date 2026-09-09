"""Install physical shared dispatchers for the repository's versioned Git hooks."""

from __future__ import annotations

import os
import stat
import subprocess
import sys
from pathlib import Path
from typing import Callable

HOOK_DISPATCHER_DIRECTORY = "montecarlo-hooks"
VERSIONED_HOOK_NAMES = ("post-checkout", "pre-commit", "pre-push")

Runner = Callable[..., subprocess.CompletedProcess[str]]


def _hook_dispatcher(hook_name: str) -> str:
    missing_hook = (
        '  echo "ERROR: the versioned pre-push hook is missing." >&2\n  exit 1\n'
        if hook_name == "pre-push"
        else "  exit 0\n"
    )
    return (
        "#!/usr/bin/env sh\n"
        "set -eu\n\n"
        "REPO_ROOT=$(git rev-parse --show-toplevel)\n"
        f'VERSIONED_HOOK="$REPO_ROOT/.githooks/{hook_name}"\n'
        'if [ ! -f "$VERSIONED_HOOK" ]; then\n'
        f"{missing_hook}"
        "fi\n\n"
        'exec "$VERSIONED_HOOK" "$@"\n'
    )


def _executable_mode(path: Path) -> int:
    return path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH


def _write_hook_dispatcher(path: Path, content: str) -> None:
    is_junction = getattr(os.path, "isjunction", lambda _path: False)
    if path.is_symlink() or is_junction(path):
        raise OSError(f"refusing a linked hook dispatcher: {path}")
    encoded = content.encode("utf-8")
    if path.is_file() and path.read_bytes() == encoded:
        path.chmod(_executable_mode(path))
        return
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_bytes(encoded)
    temporary.chmod(_executable_mode(temporary))
    os.replace(temporary, path)


def _common_git_directory(root: Path, execute: Runner) -> Path:
    result = execute(
        ["git", "rev-parse", "--git-common-dir"],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        raise OSError("Git could not resolve its shared directory")
    value = result.stdout.strip()
    if not value:
        raise OSError("Git returned an empty shared directory")
    common_directory = Path(value)
    return (
        common_directory.resolve()
        if common_directory.is_absolute()
        else (root / common_directory).resolve()
    )


def _install_dispatchers(directory: Path) -> None:
    is_junction = getattr(os.path, "isjunction", lambda _path: False)
    if directory.is_symlink() or is_junction(directory):
        raise OSError(f"refusing a linked hook directory: {directory}")
    directory.mkdir(parents=True, exist_ok=True)
    for hook_name in VERSIONED_HOOK_NAMES:
        _write_hook_dispatcher(directory / hook_name, _hook_dispatcher(hook_name))


def configure_git_hooks(
    root: Path,
    runner: Runner | None = None,
    *,
    quiet: bool = False,
) -> int:
    execute = runner or subprocess.run
    try:
        directory = _common_git_directory(root, execute) / HOOK_DISPATCHER_DIRECTORY
        _install_dispatchers(directory)
        result = execute(
            ["git", "config", "--local", "core.hooksPath", str(directory)],
            cwd=root,
            check=False,
        )
        if result.returncode:
            raise OSError("Git rejected the stable hooks path")
    except OSError as exc:
        print(f"Failed to configure stable Git hook dispatchers: {exc}", file=sys.stderr)
        return 1
    if not quiet:
        print(f"Configured stable Git hooks path: {directory}")
    return 0
