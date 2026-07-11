#!/usr/bin/env python3
"""Run the repository quality gates shared by hooks and GitHub Actions."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCUMENTATION_PATHS = {"README.md", "LICENSE", "NOTICE"}
NPM_COMMAND = "npm.cmd" if os.name == "nt" else "npm"
BACKEND_TEST_ENV = {
    "ADO_PAT": "FAKE_PAT",
    "ADO_ORG": "FAKE_ORG",
    "ADO_PROJECT": "FAKE_PROJECT",
    "APP_MONGO_URL": "mongodb://localhost:27017",
    "APP_MONGO_DB": "montecarlo_test",
}


@dataclass(frozen=True)
class GateCommand:
    step: str
    argv: tuple[str, ...]
    correction: str
    backend_test: bool = False


def staged_files() -> list[str]:
    """Return the files currently staged for the pre-commit hook."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        print("ERROR: unable to list staged files.", file=sys.stderr)
        if result.stderr:
            print(result.stderr, file=sys.stderr, end="")
        raise RuntimeError("git diff --cached failed")
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def is_documentation_only(paths: list[str]) -> bool:
    """Whether a staged change only touches user-facing repository documentation."""
    if not paths:
        return False
    return all(path in DOCUMENTATION_PATHS or path.startswith("docs/") for path in paths)


def command_text(argv: tuple[str, ...]) -> str:
    return subprocess.list2cmdline(list(argv))


def execution_plan(mode: str, documentation_only: bool) -> list[GateCommand]:
    """Build the ordered command list; this is the single gate definition."""
    commands = [
        GateCommand(
            "Repository hygiene (README, encoding, secrets and DoD)",
            (sys.executable, "Scripts/pre_commit_guard.py"),
            "Correct the reported README, encoding, secret, or DoD issue and stage the fix.",
        ),
        GateCommand(
            "Identity boundary",
            (sys.executable, "Scripts/check_identity_boundary.py"),
            "Remove Azure DevOps identity data from the browser/backend boundary.",
        ),
        GateCommand(
            "Naming convention",
            (sys.executable, "Scripts/check_naming_convention.py"),
            "Rename the reported code identifier in English.",
        ),
    ]
    if documentation_only and mode == "fast":
        return commands

    commands.extend(
        [
            GateCommand(
                "Backend lint (Ruff)",
                (sys.executable, "-m", "ruff", "check", "."),
                "Run `python -m ruff check .` and correct the reported lint issue.",
            ),
            GateCommand(
                "Backend tests",
                (sys.executable, "-m", "pytest", "-q"),
                "Run `python -m pytest -q` and correct the failing backend test.",
                backend_test=True,
            ),
            GateCommand(
                "Frontend lint (ESLint, zero warning)",
                (NPM_COMMAND, "--prefix", "frontend", "run", "lint", "--", "--max-warnings", "0"),
                "Run the displayed ESLint command and correct all errors and warnings.",
            ),
            GateCommand(
                "Frontend typecheck (TypeScript)",
                (NPM_COMMAND, "--prefix", "frontend", "run", "typecheck"),
                "Run `npm --prefix frontend run typecheck` and correct the type errors.",
            ),
            GateCommand(
                "Frontend unit tests (Vitest)",
                (NPM_COMMAND, "--prefix", "frontend", "run", "test:unit"),
                "Run `npm --prefix frontend run test:unit` and correct the failing test.",
            ),
        ]
    )
    if mode in {"push", "ci"}:
        commands.extend(
            [
                GateCommand(
                    "Backend coverage (minimum 80%)",
                    (
                        sys.executable,
                        "-m",
                        "pytest",
                        "--cov=backend",
                        "--cov-branch",
                        "--cov-report=json:.coverage.backend.json",
                        "--cov-fail-under=80",
                        "--cov-report=term-missing",
                        "-q",
                    ),
                    "Add tests until backend coverage is at least 80% with no uncovered red lines.",
                    backend_test=True,
                ),
                GateCommand(
                    "Frontend unit coverage",
                    (NPM_COMMAND, "--prefix", "frontend", "run", "test:unit:coverage"),
                    "Add frontend unit tests until all configured coverage thresholds pass.",
                ),
                GateCommand(
                    "Frontend build",
                    (NPM_COMMAND, "--prefix", "frontend", "run", "build"),
                    "Run `npm --prefix frontend run build` and correct the build error.",
                ),
                GateCommand(
                    "End-to-end tests (Playwright)",
                    (NPM_COMMAND, "--prefix", "frontend", "run", "test:e2e"),
                    "Install Playwright browsers explicitly if missing, then correct the failing "
                    "E2E test.",
                ),
            ]
        )
    return commands


def _frontend_dependencies_available() -> bool:
    return (ROOT / "frontend" / "node_modules").is_dir()


def _run_command(command: GateCommand) -> int:
    print(f"\n==> {command.step}")
    print(f"$ {command_text(command.argv)}")
    env = os.environ.copy()
    if command.backend_test:
        env.update(BACKEND_TEST_ENV)
    try:
        result = subprocess.run(command.argv, cwd=ROOT, check=False, env=env)
    except OSError as exc:
        print(f"ERROR: command could not start: {exc}", file=sys.stderr)
        print(f"Expected correction: {command.correction}", file=sys.stderr)
        return 127
    if result.returncode:
        print(f"ERROR: step failed: {command.step}", file=sys.stderr)
        print(f"Failed command: {command_text(command.argv)}", file=sys.stderr)
        print(f"Expected correction: {command.correction}", file=sys.stderr)
    return result.returncode


def _ensure_frontend_dependencies() -> int:
    if _frontend_dependencies_available():
        return 0
    print("ERROR: frontend dependencies are missing (frontend/node_modules).", file=sys.stderr)
    print(
        "Expected correction: run `npm --prefix frontend ci` explicitly, then retry.",
        file=sys.stderr,
    )
    return 1


def _request(
    url: str, payload: bytes | None = None, headers: dict[str, str] | None = None
) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        data=payload,
        headers=headers or {},
        method="POST" if payload else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def _docker_logs() -> None:
    subprocess.run(
        ["docker", "compose", "logs", "backend", "mongo", "redis"], cwd=ROOT, check=False
    )


def _run_docker_smoke() -> int:
    if not (ROOT / ".env").exists():
        print("ERROR: .env is required for Docker smoke testing.", file=sys.stderr)
        print(
            "Expected correction: copy .env.example to .env and set local values explicitly.",
            file=sys.stderr,
        )
        return 1

    started = False
    try:
        for command in (
            GateCommand(
                "Docker build",
                ("docker", "compose", "build"),
                "Install and start Docker Desktop, then ensure `docker compose version` succeeds.",
            ),
            GateCommand(
                "Docker start",
                ("docker", "compose", "up", "-d"),
                "Install and start Docker Desktop, then correct the Docker startup error.",
            ),
        ):
            code = _run_command(command)
            if code:
                return code
            started = True

        print("\n==> Docker smoke test")
        print("$ HTTP health, Mongo persistence, and shared rate-limit checks")
        for _ in range(30):
            try:
                status, _ = _request("http://127.0.0.1:8000/health")
            except urllib.error.URLError:
                status = 0
            if status == 200:
                break
            time.sleep(2)
        else:
            raise RuntimeError("The health endpoint did not become ready within 60 seconds.")

        mongo_status, mongo_body = _request("http://127.0.0.1:8000/health/mongo")
        if mongo_status != 200 or '"status":"ok"' not in mongo_body:
            raise RuntimeError("Mongo health endpoint is not OK.")

        payload = (
            b'{"throughput_samples":[1,2,3,4,5,6],"mode":"backlog_to_weeks",'
            b'"backlog_size":20,"n_sims":2000}'
        )
        headers = {
            "Content-Type": "application/json",
            "Cookie": "IDMontecarlo=ci-smoke-idmontecarlo",
        }
        simulate_status, _ = _request("http://127.0.0.1:8000/simulate", payload, headers)
        if simulate_status != 200:
            raise RuntimeError(f"POST /simulate returned HTTP {simulate_status}.")
        history_status, history_body = _request(
            "http://127.0.0.1:8000/simulations/history", headers={"Cookie": headers["Cookie"]}
        )
        if history_status != 200 or '"mode":"backlog_to_weeks"' not in history_body:
            raise RuntimeError("Simulation history did not return the persisted simulation.")

        rate_payload = (
            b'{"throughput_samples":[1,2,3,4,5,6],"mode":"backlog_to_weeks",'
            b'"backlog_size":10,"n_sims":2000}'
        )
        rate_headers = {
            "Content-Type": "application/json",
            "X-Forwarded-For": "ci-rate-limit-shared",
        }
        last_status = 0
        for attempt in range(1, 22):
            last_status, _ = _request(
                "http://127.0.0.1:8000/simulate", rate_payload, rate_headers
            )
            if attempt <= 20 and last_status != 200:
                raise RuntimeError(
                    f"Rate limit rejected request {attempt} too early: HTTP {last_status}."
                )
        if last_status != 429:
            raise RuntimeError(
                f"Expected HTTP 429 after the rate limit, received HTTP {last_status}."
            )
    except (RuntimeError, urllib.error.URLError) as exc:
        print("ERROR: step failed: Docker smoke test", file=sys.stderr)
        print("Failed command: HTTP Docker smoke checks", file=sys.stderr)
        print(f"Detail: {exc}", file=sys.stderr)
        print(
            "Expected correction: inspect Docker logs and correct the health, persistence, or "
            "rate-limit failure.",
            file=sys.stderr,
        )
        _docker_logs()
        return 1
    finally:
        if started:
            _run_command(
                GateCommand(
                    "Docker cleanup",
                    ("docker", "compose", "down", "-v"),
                    "Stop the Docker services manually after resolving the failure.",
                )
            )
    return 0


def run_gate(mode: str, paths: list[str] | None = None) -> int:
    """Run a gate and propagate the first failing command exit code."""
    if mode not in {"fast", "push", "ci"}:
        raise ValueError(f"Unsupported mode: {mode}")
    changed_paths = staged_files() if paths is None and mode == "fast" else (paths or [])
    documentation_only = mode == "fast" and is_documentation_only(changed_paths)
    print(f"Quality gate mode: {mode}")
    if documentation_only:
        print("Documentation-only change detected: expensive code checks are skipped.")

    frontend_checked = False
    for command in execution_plan(mode, documentation_only):
        if command.argv[0] == NPM_COMMAND and not frontend_checked:
            frontend_checked = True
            code = _ensure_frontend_dependencies()
            if code:
                return code
        code = _run_command(command)
        if code:
            return code
    if mode == "ci":
        return _run_docker_smoke()
    print("\nQuality gate passed.")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mode",
        choices=("fast", "push", "ci"),
        help="fast for pre-commit, push for pre-push, ci for GitHub Actions",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    return run_gate(parse_args(argv).mode)


if __name__ == "__main__":
    raise SystemExit(main())
