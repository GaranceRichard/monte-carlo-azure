"""Docker smoke orchestration kept separate from the quality-gate entry point."""

from __future__ import annotations

import sys
import urllib.error
from pathlib import Path
from typing import Any, Callable


def _start_services(
    root: Path,
    port: int,
    command_type: type[Any],
    run_command: Callable[..., int],
) -> tuple[int, bool]:
    environment = {"APP_PORT": str(port)}
    specifications = (
        (
            "Docker build",
            ("docker", "compose", "build"),
            "Install and start Docker Desktop, then ensure `docker compose version` succeeds.",
        ),
        (
            "Docker start",
            ("docker", "compose", "up", "-d"),
            "Install and start Docker Desktop, then correct the Docker startup error.",
        ),
    )
    started = False
    for specification in specifications:
        code = run_command(
            command_type(*specification),
            validation_root=root,
            extra_env=environment,
        )
        if code:
            return code, started
        started = True
    return 0, started


def _report_smoke_failure(exc: BaseException, logs: Callable[[Path], None], root: Path) -> None:
    print("ERROR: step failed: Docker smoke test", file=sys.stderr)
    print("Failed command: HTTP Docker smoke checks", file=sys.stderr)
    print(f"Detail: {exc}", file=sys.stderr)
    print(
        "Expected correction: inspect Docker logs and correct the health, persistence, or "
        "rate-limit failure.",
        file=sys.stderr,
    )
    logs(root)


def _cleanup(
    root: Path,
    port: int,
    command_type: type[Any],
    run_command: Callable[..., int],
) -> None:
    run_command(
        command_type(
            "Docker cleanup",
            ("docker", "compose", "down", "-v"),
            "Stop the Docker services manually after resolving the failure.",
        ),
        validation_root=root,
        extra_env={"APP_PORT": str(port)},
    )


def run_docker_smoke(
    *,
    root: Path,
    port: int,
    configured: Callable[[], bool],
    command_type: type[Any],
    run_command: Callable[..., int],
    http_smoke: Callable[[], None],
    logs: Callable[[Path], None],
) -> int:
    if not configured():
        return 1
    started = False
    try:
        code, started = _start_services(root, port, command_type, run_command)
        if code:
            return code
        http_smoke()
    except (RuntimeError, urllib.error.URLError, OSError) as exc:
        _report_smoke_failure(exc, logs, root)
        return 1
    finally:
        if started:
            _cleanup(root, port, command_type, run_command)
    return 0
