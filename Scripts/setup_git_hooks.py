#!/usr/bin/env python3
"""Configure versioned hooks and prepare their worktree-local Python runtime."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable, NamedTuple

REPO_ROOT = Path(__file__).resolve().parents[1]
BOOTSTRAP_SCHEMA = 1
MINIMUM_PYTHON = (3, 10)
STAMP_NAME = ".montecarlo-python-environment.json"
_ENVIRONMENT_PROBE = r"""
import importlib.metadata
import json
import re
import sys

inventory = sorted(
    {
        (re.sub(r"[-_.]+", "-", item.metadata["Name"]).lower(), item.version)
        for item in importlib.metadata.distributions()
        if item.metadata.get("Name")
    }
)
print(
    json.dumps(
        {
            "base_prefix": sys.base_prefix,
            "implementation": sys.implementation.name,
            "inventory": inventory,
            "prefix": sys.prefix,
            "version": list(sys.version_info[:3]),
        },
        sort_keys=True,
    )
)
"""

Runner = Callable[..., subprocess.CompletedProcess[str]]


class BootstrapResult(NamedTuple):
    status: str
    reason: str
    python_executable: Path
    requirements_sha256: str
    duration_seconds: float


class BootstrapError(RuntimeError):
    """Raised when the local runtime cannot be made ready without running a gate."""


def environment_python(root: Path, platform_name: str = os.name) -> Path:
    relative = Path("Scripts/python.exe") if platform_name == "nt" else Path("bin/python")
    return root / ".venv" / relative


def _completed(
    argv: list[str],
    *,
    root: Path,
    capture_output: bool,
    runner: Runner | None,
) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment.update({"PIP_DISABLE_PIP_VERSION_CHECK": "1", "PIP_NO_INPUT": "1"})
    return (runner or subprocess.run)(
        argv,
        cwd=root,
        env=environment,
        check=False,
        capture_output=capture_output,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def _probe_environment(
    python_executable: Path,
    environment_root: Path,
    *,
    root: Path,
    runner: Runner | None,
) -> dict[str, Any] | None:
    if not python_executable.is_file():
        return None
    result = _completed(
        [str(python_executable), "-c", _ENVIRONMENT_PROBE],
        root=root,
        capture_output=True,
        runner=runner,
    )
    if result.returncode:
        return None
    try:
        payload = json.loads(result.stdout)
        prefix = Path(payload["prefix"]).resolve()
        base_prefix = Path(payload["base_prefix"]).resolve()
        version = tuple(payload["version"])
        inventory = payload["inventory"]
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None
    if (
        prefix != environment_root.resolve()
        or prefix == base_prefix
        or version[:2] < MINIMUM_PYTHON
        or not isinstance(inventory, list)
    ):
        return None
    return payload


def _requirements_sha256(requirements_path: Path) -> str:
    if not requirements_path.is_file():
        raise BootstrapError(f"missing dependency authority: {requirements_path}")
    return hashlib.sha256(requirements_path.read_bytes()).hexdigest()


def _manifest(requirements_sha256: str, probe: dict[str, Any]) -> dict[str, Any]:
    return {
        "bootstrap_schema": BOOTSTRAP_SCHEMA,
        "implementation": probe["implementation"],
        "inventory": probe["inventory"],
        "python_version": probe["version"],
        "requirements_sha256": requirements_sha256,
    }


def _read_manifest(stamp_path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(stamp_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _write_manifest(stamp_path: Path, payload: dict[str, Any]) -> None:
    temporary = stamp_path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    os.replace(temporary, stamp_path)


def _pip_check(python_executable: Path, root: Path, runner: Runner | None) -> bool:
    result = _completed(
        [str(python_executable), "-m", "pip", "check"],
        root=root,
        capture_output=True,
        runner=runner,
    )
    return result.returncode == 0


def _validate_environment_path(environment_root: Path) -> None:
    is_junction = getattr(os.path, "isjunction", lambda _path: False)
    if environment_root.is_symlink() or is_junction(environment_root):
        raise BootstrapError(f"refusing a linked or junction environment: {environment_root}")
    if environment_root.exists() and not environment_root.is_dir():
        raise BootstrapError(f"environment path is not a directory: {environment_root}")


def _create_environment(
    root: Path,
    environment_root: Path,
    bootstrap_python: Path,
    runner: Runner | None,
) -> None:
    argv = [str(bootstrap_python), "-m", "venv", "--copies"]
    if environment_root.exists():
        argv.append("--clear")
    result = _completed(
        [*argv, str(environment_root)],
        root=root,
        capture_output=False,
        runner=runner,
    )
    if result.returncode:
        raise BootstrapError(f"venv creation failed with exit code {result.returncode}")


def _synchronize_dependencies(
    python_executable: Path,
    requirements_path: Path,
    root: Path,
    runner: Runner | None,
) -> None:
    result = _completed(
        [
            str(python_executable),
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "--no-input",
            "-r",
            str(requirements_path),
        ],
        root=root,
        capture_output=False,
        runner=runner,
    )
    if result.returncode:
        raise BootstrapError(
            f"dependency synchronization failed with exit code {result.returncode}"
        )


def _refresh_environment(
    root: Path,
    environment_root: Path,
    requirements_path: Path,
    python_executable: Path,
    probe: dict[str, Any] | None,
    *,
    runner: Runner | None,
    platform_name: str,
    bootstrap_python: Path | None,
) -> tuple[Path, dict[str, Any], str]:
    reason = (
        "missing"
        if not environment_root.exists()
        else "unusable"
        if probe is None
        else "dependencies-changed"
    )
    if probe is None:
        creator = (bootstrap_python or Path(sys._base_executable)).resolve()
        if sys.version_info[:2] < MINIMUM_PYTHON or not creator.is_file():
            raise BootstrapError("Python 3.10+ is required to create .venv")
        _create_environment(root, environment_root, creator, runner)
        _validate_environment_path(environment_root)
        python_executable = environment_python(root, platform_name)
    _synchronize_dependencies(python_executable, requirements_path, root, runner)
    if not _pip_check(python_executable, root, runner):
        raise BootstrapError("pip check rejected the synchronized environment")
    refreshed_probe = _probe_environment(
        python_executable, environment_root, root=root, runner=runner
    )
    if refreshed_probe is None:
        raise BootstrapError("the synchronized .venv interpreter is not exploitable")
    return python_executable, refreshed_probe, reason


def ensure_python_environment(
    root: Path = REPO_ROOT,
    *,
    runner: Runner | None = None,
    clock: Callable[[], float] = time.perf_counter,
    platform_name: str = os.name,
    bootstrap_python: Path | None = None,
) -> BootstrapResult:
    started = clock()
    root = root.resolve()
    environment_root = root / ".venv"
    requirements_path = root / "requirements.txt"
    stamp_path = environment_root / STAMP_NAME
    _validate_environment_path(environment_root)
    requirements_sha256 = _requirements_sha256(requirements_path)
    python_executable = environment_python(root, platform_name)
    probe = _probe_environment(
        python_executable, environment_root, root=root, runner=runner
    )
    expected = _manifest(requirements_sha256, probe) if probe is not None else None
    recorded = _read_manifest(stamp_path)
    if expected is not None and recorded == expected and _pip_check(
        python_executable, root, runner
    ):
        return BootstrapResult(
            "ready", "unchanged", python_executable, requirements_sha256, clock() - started
        )
    stamp_path.unlink(missing_ok=True)
    python_executable, probe, reason = _refresh_environment(
        root,
        environment_root,
        requirements_path,
        python_executable,
        probe,
        runner=runner,
        platform_name=platform_name,
        bootstrap_python=bootstrap_python,
    )
    _write_manifest(stamp_path, _manifest(requirements_sha256, probe))
    return BootstrapResult(
        "synchronized", reason, python_executable, requirements_sha256, clock() - started
    )


def configure_git_hooks(root: Path, runner: Runner | None = None) -> int:
    result = (runner or subprocess.run)(
        ["git", "config", "--local", "core.hooksPath", ".githooks"],
        cwd=root,
        check=False,
    )
    if result.returncode:
        print("Failed to configure core.hooksPath to .githooks.", file=sys.stderr)
        return result.returncode
    print("Configured git hooks path: .githooks")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--bootstrap-only", action="store_true")
    parser.add_argument("--quiet-if-ready", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = args.root.resolve()
    if not (root / ".git").exists():
        print("Skipping git hook setup: .git directory not found.")
        return 0
    if not args.bootstrap_only:
        code = configure_git_hooks(root)
        if code:
            return code
    try:
        result = ensure_python_environment(root)
    except BootstrapError as exc:
        print(f"ERROR: Python environment bootstrap failed: {exc}", file=sys.stderr)
        return 1
    if result.status != "ready" or not args.quiet_if_ready:
        print(
            f"Python environment {result.status}: {result.python_executable} "
            f"reason={result.reason} duration={result.duration_seconds:.3f}s "
            f"requirements={result.requirements_sha256[:12]}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
