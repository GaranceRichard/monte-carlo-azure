from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESOLVER = ROOT / "frontend" / "scripts" / "e2e-backend-web-server.mjs"


def _diagnose(script: Path, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["node", str(script), "--diagnose"],
        cwd=script.parent,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )


def _environment(**updates: str) -> dict[str, str]:
    env = os.environ.copy()
    env.pop("MONTECARLO_E2E_PYTHON", None)
    env.pop("PYTHON", None)
    env.update(updates)
    return env


def _copy_resolver(repository: Path) -> Path:
    script = repository / "frontend" / "scripts" / RESOLVER.name
    script.parent.mkdir(parents=True)
    shutil.copy2(RESOLVER, script)
    (repository / "run_app.py").write_text("# isolated application source\n", encoding="utf-8")
    return script


def _repository_python(repository: Path) -> Path:
    if os.name == "nt":
        return repository / ".venv" / "Scripts" / "python.exe"
    return repository / ".venv" / "bin" / "python"


def test_web_server_resolves_repository_venv_and_sources(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    script = _copy_resolver(workspace)
    local_python = _repository_python(workspace)
    local_python.parent.mkdir(parents=True)
    local_python.write_text("local repository interpreter\n", encoding="utf-8")

    result = _diagnose(script, _environment())

    assert result.returncode == 0, result.stderr
    launch = json.loads(result.stdout)
    assert Path(launch["cwd"]) == workspace
    assert Path(launch["backendScript"]) == workspace / "run_app.py"
    assert Path(launch["pythonExecutable"]) == local_python
    assert launch["pythonSource"] == "repository-venv"
    assert launch["args"][0] == "run_app.py"


def test_web_server_resolves_host_dependencies_and_worktree_sources(tmp_path: Path) -> None:
    worktree = tmp_path / "detached-worktree"
    script = _copy_resolver(worktree)

    result = _diagnose(
        script,
        _environment(MONTECARLO_E2E_PYTHON=sys.executable),
    )

    assert result.returncode == 0, result.stderr
    launch = json.loads(result.stdout)
    assert Path(launch["cwd"]) == worktree
    assert Path(launch["pythonExecutable"]) == Path(sys.executable)
    assert Path(launch["backendScript"]) == worktree / "run_app.py"
    assert launch["pythonSource"] == "host-exposed"
    assert str(ROOT / "run_app.py") not in launch["command"]


def test_web_server_uses_path_fallback_without_venv_or_exposed_python(
    tmp_path: Path,
) -> None:
    snapshot = tmp_path / "snapshot" / "repository"
    script = _copy_resolver(snapshot)

    result = _diagnose(script, _environment())

    assert result.returncode == 0, result.stderr
    launch = json.loads(result.stdout)
    assert Path(launch["cwd"]) == snapshot
    assert Path(launch["backendScript"]) == snapshot / "run_app.py"
    assert launch["pythonExecutable"] == "python"
    assert launch["pythonSource"] == "path-fallback"
    assert str(snapshot / ".venv") not in launch["command"]


def test_web_server_sources_do_not_pin_the_primary_workspace() -> None:
    source_paths = [
        ROOT / "frontend" / "playwright.config.js",
        ROOT / "frontend" / "scripts" / "e2e-backend-web-server.mjs",
        ROOT / "frontend" / "scripts" / "run-e2e-coverage.mjs",
    ]

    for source_path in source_paths:
        source = source_path.read_text(encoding="utf-8")
        assert str(ROOT) not in source
        assert str(ROOT).replace("\\", "\\\\") not in source


def test_web_server_reports_command_cwd_and_missing_python(tmp_path: Path) -> None:
    worktree = tmp_path / "detached-worktree"
    script = _copy_resolver(worktree)
    missing_python = tmp_path / "host-dependencies" / "python.exe"

    result = _diagnose(
        script,
        _environment(MONTECARLO_E2E_PYTHON=str(missing_python)),
    )

    assert result.returncode == 2
    assert "Unable to start the Playwright backend webServer." in result.stderr
    assert "Command: " in result.stderr
    assert f"CWD: {worktree}" in result.stderr
    assert f"Missing dependency: Python executable: {missing_python}" in result.stderr


def test_playwright_config_uses_explicit_web_server_working_directories() -> None:
    script = (
        "import config from './frontend/playwright.config.js'; "
        "console.log(JSON.stringify(config.webServer));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "--eval", script],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=_environment(),
    )

    assert result.returncode == 0, result.stderr
    web_servers = json.loads(result.stdout)
    assert Path(web_servers[0]["cwd"]) == ROOT
    assert "run_app.py" in web_servers[0]["command"]
    assert Path(web_servers[1]["cwd"]) == ROOT / "frontend"
