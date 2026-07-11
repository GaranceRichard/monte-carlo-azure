from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import quality_gate  # noqa: E402


def test_fast_push_and_ci_modes_have_the_expected_scope() -> None:
    fast_steps = [command.step for command in quality_gate.execution_plan("fast", False)]
    push_steps = [command.step for command in quality_gate.execution_plan("push", False)]
    ci_steps = [command.step for command in quality_gate.execution_plan("ci", False)]

    assert fast_steps == push_steps[: len(fast_steps)]
    assert push_steps == ci_steps
    assert "Backend coverage (minimum 80%)" not in fast_steps
    assert "Backend coverage (minimum 80%)" in push_steps
    assert "End-to-end tests (Playwright)" in push_steps
    push_commands = quality_gate.execution_plan("push", False)
    assert all("docker" not in " ".join(command.argv).lower() for command in push_commands)


def test_documentation_only_fast_path_skips_expensive_checks() -> None:
    paths = ["README.md", "docs/definition-of-done.md"]

    assert quality_gate.is_documentation_only(paths)
    steps = [command.step for command in quality_gate.execution_plan("fast", True)]
    assert steps == [
        "Repository hygiene (README, encoding, secrets and DoD)",
        "Identity boundary",
        "Naming convention",
    ]
    assert not quality_gate.is_documentation_only(["README.md", "backend/api.py"])


def test_first_failed_command_exit_code_is_propagated(monkeypatch) -> None:
    failure = quality_gate.GateCommand("failing check", ("missing-command",), "Fix it.")
    skipped = quality_gate.GateCommand("must not run", ("also-missing",), "Fix it.")
    calls: list[str] = []

    monkeypatch.setattr(quality_gate, "execution_plan", lambda *_: [failure, skipped])

    def fake_run(command: quality_gate.GateCommand) -> int:
        calls.append(command.step)
        return 23

    monkeypatch.setattr(quality_gate, "_run_command", fake_run)

    assert quality_gate.run_gate("fast", paths=["README.md"]) == 23
    assert calls == ["failing check"]


def test_push_never_runs_docker_but_ci_runs_the_docker_smoke(monkeypatch) -> None:
    monkeypatch.setattr(quality_gate, "_run_command", lambda _: 0)
    monkeypatch.setattr(quality_gate, "_ensure_frontend_dependencies", lambda: 0)
    docker_called = False

    def run_docker_smoke() -> int:
        nonlocal docker_called
        docker_called = True
        return 0

    monkeypatch.setattr(quality_gate, "_run_docker_smoke", run_docker_smoke)

    assert quality_gate.run_gate("push", paths=["backend/api.py"]) == 0
    assert not docker_called
    assert quality_gate.run_gate("ci", paths=["backend/api.py"]) == 0
    assert docker_called


def test_docker_smoke_retries_a_transient_connection_reset(monkeypatch) -> None:
    responses = iter(
        [
            ConnectionResetError("backend is still starting"),
            (200, ""),
            (200, '{"status":"ok"}'),
            (200, ""),
            (200, '{"mode":"backlog_to_weeks"}'),
            *[(200, "")] * 20,
            (429, ""),
        ]
    )

    monkeypatch.setattr(quality_gate, "_run_command", lambda _: 0)
    monkeypatch.setattr(quality_gate.time, "sleep", lambda _: None)

    def request(*_args: object, **_kwargs: object) -> tuple[int, str]:
        response = next(responses)
        if isinstance(response, OSError):
            raise response
        return response

    monkeypatch.setattr(quality_gate, "_request", request)

    assert quality_gate._run_docker_smoke() == 0


def test_hooks_and_ci_delegate_to_the_central_command() -> None:
    pre_commit = (ROOT / ".githooks" / "pre-commit").read_text(encoding="utf-8")
    pre_push = (ROOT / ".githooks" / "pre-push").read_text(encoding="utf-8")
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")

    assert "Scripts/quality_gate.py\" fast" in pre_commit
    assert "Scripts/quality_gate.py\" push" in pre_push
    assert "python Scripts/quality_gate.py ci" in ci
    assert "npm run lint" not in ci
    assert "npm run test:e2e" not in ci


def test_ci_mode_statically_keeps_the_docker_smoke() -> None:
    gate = (ROOT / "Scripts" / "quality_gate.py").read_text(encoding="utf-8")

    assert 'if mode == "ci":\n        return _run_docker_smoke()' in gate
    assert '("docker", "compose", "build")' in gate
