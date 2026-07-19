"""Pure quality-gate command planning backed by execution profiles."""

from __future__ import annotations

import sys
from typing import Any

from Scripts.quality_gate_change_policy import classification_gate_command


def execution_profile_for_mode(mode: str, explicit_profile: str | None = None) -> str:
    """Resolve hooks and automation modes without mixing them with change scope."""
    defaults = {
        "fast": "pr",
        "push": "main",
        "ci": "pr",
        "nightly": "nightly",
        "release": "release",
    }
    if mode not in defaults:
        raise ValueError(f"Unsupported mode: {mode}")
    profile = explicit_profile or defaults[mode]
    if profile not in {"pr", "main", "nightly", "release"}:
        raise ValueError(f"Unsupported execution profile: {profile}")
    return profile


def _selection_path(profile: str) -> str:
    return f"reports/test-execution-artifacts/{profile}/backend-tests/pytest-args.txt"


def _prepare_backend_selection(q: Any, profile: str, inputs: tuple[Any, ...]) -> Any:
    return q.GateCommand(
        "Prepare backend test selection",
        (
            sys.executable,
            "Scripts/test_execution_profiles.py",
            "--check",
            "--select-profile",
            profile,
            "--select-framework",
            "pytest",
            "--selection-output",
            _selection_path(profile),
        ),
        "Correct the exact Pytest selection for the requested execution profile.",
        input_sources=inputs,
    )


def _python_coverage_commands(
    q: Any, command_input: tuple[Any, ...], profile: str
) -> tuple[Any, ...]:
    report = f"reports/test-execution-artifacts/{profile}/backend-tests/coverage.json"
    return (
        _prepare_backend_selection(q, profile, command_input),
        q.GateCommand(
            "Versioned Python coverage",
            (
                sys.executable,
                "-m",
                "pytest",
                "--cov",
                "--cov-config=.coveragerc",
                f"--cov-report=json:{report}",
                "--cov-report=term-missing",
                "-q",
                f"@{_selection_path(profile)}",
            ),
            "Add tests until every declared Python source has no uncovered line.",
            backend_test=True,
            input_sources=command_input,
            coverage_artifacts=(".coverage", ".coverage.python.json"),
        ),
        q.GateCommand(
            "Python coverage scope and per-file compliance",
            (sys.executable, "Scripts/check_python_coverage.py", "--report", report),
            "Restore the declared Python scope, branch coverage, and per-file compliance.",
            input_sources=command_input,
        ),
    )


def _base_commands(q: Any, command_input: tuple[Any, ...]) -> list[Any]:
    return [
        q.GateCommand(
            "Repository hygiene (README, encoding, secrets and DoD)",
            (sys.executable, "Scripts/pre_commit_guard.py"),
            "Correct the reported README, encoding, secret, or DoD issue and stage the fix.",
            input_sources=command_input,
        ),
        classification_gate_command(q.GateCommand, sys.executable, command_input),
        q.GateCommand(
            "Identity boundary",
            (sys.executable, "Scripts/check_identity_boundary.py"),
            "Remove Azure DevOps identity data from the browser/backend boundary.",
            input_sources=command_input,
        ),
        q.GateCommand(
            "Naming convention",
            (sys.executable, "Scripts/check_naming_convention.py"),
            "Rename the reported code identifier in English.",
            input_sources=command_input,
        ),
        q.GateCommand(
            "Maintainability ratchet",
            (sys.executable, "Scripts/check_maintainability.py"),
            "Remove the new maintainability drift or explicitly review the versioned baseline.",
            input_sources=command_input,
        ),
    ]


def _backend_lint(q: Any, inputs: tuple[Any, ...]) -> Any:
    return q.GateCommand(
        "Backend lint (Ruff)",
        (sys.executable, "-m", "ruff", "check", "."),
        "Run `python -m ruff check .` and correct the reported lint issue.",
        input_sources=inputs,
    )


def _frontend_commands(q: Any, inputs: tuple[Any, ...]) -> tuple[Any, ...]:
    return (
        q.GateCommand(
            "Frontend lint (ESLint, zero warning)",
            (
                q.NPM_COMMAND,
                "--prefix",
                "frontend",
                "run",
                "lint",
                "--",
                "--max-warnings",
                "0",
            ),
            "Run the displayed ESLint command and correct all errors and warnings.",
            input_sources=inputs,
        ),
        q.GateCommand(
            "Frontend typecheck (TypeScript)",
            (q.NPM_COMMAND, "--prefix", "frontend", "run", "typecheck"),
            "Run `npm --prefix frontend run typecheck` and correct the type errors.",
            input_sources=inputs,
        ),
    )


def _selected_commands(q: Any, resolution: Any, inputs: tuple[Any, ...]) -> list[Any]:
    selected: list[Any] = []
    if q.ChangeDomain.BACKEND in resolution.impacted_domains:
        selected.append(_backend_lint(q, inputs))
    if q.ChangeDomain.FRONTEND in resolution.impacted_domains:
        selected.extend(_frontend_commands(q, inputs))
    if resolution.backend_tests:
        selected.append(
            q.GateCommand(
                "Selected backend tests",
                (sys.executable, "-m", "pytest", "-q", *resolution.backend_tests),
                "Correct the backend tests directly related to the changed files.",
                backend_test=True,
                input_sources=inputs,
            )
        )
    if resolution.frontend_tests:
        paths = tuple(path.removeprefix("frontend/") for path in resolution.frontend_tests)
        selected.append(
            q.GateCommand(
                "Selected frontend unit tests (Vitest)",
                (q.NPM_COMMAND, "--prefix", "frontend", "run", "test:unit", "--", *paths),
                "Correct the frontend tests directly related to the changed files.",
                input_sources=inputs,
            )
        )
    return selected


def _full_test_commands(
    q: Any, profile: str, inputs: tuple[Any, ...]
) -> tuple[list[Any], bool]:
    if profile == "pr":
        return [
            _prepare_backend_selection(q, profile, inputs),
            q.GateCommand(
                "Backend tests",
                (sys.executable, "-m", "pytest", "-q", f"@{_selection_path(profile)}"),
                "Run `python -m pytest -q` and correct the failing backend test.",
                backend_test=True,
                input_sources=inputs,
            ),
            q.GateCommand(
                "Frontend unit tests (Vitest)",
                (q.NPM_COMMAND, "--prefix", "frontend", "run", "test:unit"),
                "Run `npm --prefix frontend run test:unit` and correct the failing test.",
                input_sources=inputs,
            ),
        ], False
    return [
        *_python_coverage_commands(q, inputs, profile),
        q.GateCommand(
            "Frontend unit coverage",
            (q.NPM_COMMAND, "--prefix", "frontend", "run", "test:unit:coverage"),
            "Add frontend unit tests until all configured coverage thresholds pass.",
            input_sources=inputs,
            coverage_artifacts=(
                "frontend/coverage/coverage-final.json",
                "frontend/coverage/index.html",
            ),
        ),
        q.GateCommand(
            "Frontend build",
            (q.NPM_COMMAND, "--prefix", "frontend", "run", "build"),
            "Run `npm --prefix frontend run build` and correct the build error.",
            input_sources=inputs,
        ),
        q.GateCommand(
            "End-to-end tests (Playwright)",
            (q.NPM_COMMAND, "--prefix", "frontend", "run", "test:e2e"),
            "Install Playwright browsers explicitly, then correct the failing E2E test.",
            input_sources=inputs,
            coverage_artifacts=("frontend/coverage/e2e-coverage-summary.json",),
        ),
        q.GateCommand(
            "Release or container checks",
            (sys.executable, "Scripts/test_execution_profiles.py", "--check"),
            "Correct the versioned execution DAG or the container/release configuration.",
            input_sources=inputs,
        ),
    ], True


def _aggregate_commands(q: Any, inputs: tuple[Any, ...]) -> tuple[Any, ...]:
    report = "frontend/coverage/vitals-coverage-report.json"
    return (
        q.GateCommand(
            "Vitals coverage report",
            (
                sys.executable,
                "Scripts/report_vitals_coverage.py",
                "--output",
                report,
            ),
            "Restore the coverage artifacts required to calculate critical-path rates.",
            input_sources=inputs,
            coverage_artifacts=(report,),
        ),
        q.GateCommand(
            "Vitals compliance",
            (
                sys.executable,
                "Scripts/check_vitals_compliance.py",
                "--report-json",
                report,
            ),
            "Restore every critical-path coverage rate to the versioned threshold.",
            input_sources=inputs,
        ),
    )


def build_execution_plan(context: Any, q: Any) -> Any:
    """Build the immutable deterministic command list and its DAG profile."""
    profile = execution_profile_for_mode(context.mode, context.execution_profile)
    inputs = q._gate_input_sources(context.mode)
    commands = _base_commands(q, inputs)
    resolution = q.resolve_tests(context)
    if context.documentation_only and context.mode == "fast" and (
        resolution.level != q.ChangeLevel.MASSIVE
    ):
        return q.GateExecutionPlan(context, tuple(commands), False, resolution, profile)
    if resolution.level != q.ChangeLevel.MASSIVE:
        known = {command.argv for command in commands}
        for command in _selected_commands(q, resolution, inputs):
            if command.argv not in known:
                known.add(command.argv)
                commands.append(command)
        return q.GateExecutionPlan(context, tuple(commands), False, resolution, profile)
    commands.append(_backend_lint(q, inputs))
    commands.extend(_frontend_commands(q, inputs))
    test_commands, has_release_checks = _full_test_commands(q, profile, inputs)
    commands.extend(test_commands)
    if has_release_checks:
        commands.extend(_aggregate_commands(q, inputs))
    docker_smoke = has_release_checks and context.mode in {"ci", "nightly", "release"}
    return q.GateExecutionPlan(context, tuple(commands), docker_smoke, resolution, profile)


def execution_plan(mode: str, documentation_only: bool, q: Any) -> list[Any]:
    """Return the compatibility list interface used by hooks and tests."""
    context = q.build_change_context(mode, ["README.md"] if documentation_only else [])
    return list(build_execution_plan(context, q).commands)
