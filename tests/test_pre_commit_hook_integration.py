from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _git_environment() -> dict[str, str]:
    environment = os.environ.copy()
    for name in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"):
        environment.pop(name, None)
    for name in tuple(environment):
        if name.startswith("COV_CORE_") or name in {
            "COVERAGE_FILE",
            "COVERAGE_PROCESS_START",
        }:
            environment.pop(name)
    environment.update(
        {
            "GIT_AUTHOR_NAME": "Quality Gate Test",
            "GIT_AUTHOR_EMAIL": "quality-gate@example.invalid",
            "GIT_COMMITTER_NAME": "Quality Gate Test",
            "GIT_COMMITTER_EMAIL": "quality-gate@example.invalid",
            "PYTHONIOENCODING": "utf-8",
        }
    )
    return environment


def _git(repository: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repository,
        env=_git_environment(),
        check=True,
        capture_output=True,
    )
    return result.stdout.decode("utf-8", errors="replace").strip()


def _real_index_digest() -> str:
    index_path = Path(_git(ROOT, "rev-parse", "--git-path", "index"))
    if not index_path.is_absolute():
        index_path = ROOT / index_path
    return hashlib.sha256(index_path.read_bytes()).hexdigest()


@pytest.fixture
def checkpoint_repository(tmp_path: Path) -> Path:
    repository = tmp_path / "repository"
    repository.mkdir()
    _git(repository, "init")
    _git(repository, "config", "core.hooksPath", ".githooks")
    hooks = repository / ".githooks"
    hooks.mkdir()
    shutil.copy2(ROOT / ".githooks/pre-commit", hooks / "pre-commit")
    (hooks / "pre-commit").chmod(0o755)
    scripts = repository / "Scripts"
    scripts.mkdir()
    (scripts / "quality_gate.py").write_text(
        "from pathlib import Path\n"
        "Path('validation-was-called').touch()\n"
        "raise SystemExit(17)\n",
        encoding="utf-8",
    )
    (repository / "example.py").write_text("VALUE = 1\n", encoding="utf-8")
    _git(repository, "add", "example.py")
    _git(repository, "commit", "-m", "baseline without README")
    return repository


def test_real_commit_saves_a_transient_index_without_readme_or_validation(
    checkpoint_repository: Path,
) -> None:
    real_index_before = _real_index_digest()
    repository = checkpoint_repository
    source = repository / "example.py"
    source.write_text("def unfinished(\n", encoding="utf-8")
    _git(repository, "add", "example.py")
    source.write_text("VALUE = 3\n", encoding="utf-8")

    result = _git(repository, "commit", "-m", "technical checkpoint")

    assert "technical checkpoint" in result
    assert _git(repository, "show", "HEAD:example.py") == "def unfinished("
    assert source.read_text(encoding="utf-8") == "VALUE = 3\n"
    assert _git(repository, "diff", "--cached", "--name-only") == ""
    assert _git(repository, "diff", "--name-only") == "example.py"
    assert not (repository / "README.md").exists()
    assert not (repository / "validation-was-called").exists()
    assert _real_index_digest() == real_index_before


def test_publication_secret_scan_rejects_a_secret_removed_by_a_later_checkpoint(
    checkpoint_repository: Path,
) -> None:
    real_index_before = _real_index_digest()
    repository = checkpoint_repository
    source = repository / "example.py"
    source.write_text("gh" + "p_" + "A" * 24 + "\n", encoding="utf-8")
    _git(repository, "add", "example.py")
    _git(repository, "commit", "-m", "transient secret fixture")
    introduced = _git(repository, "rev-parse", "HEAD")
    source.write_text("VALUE = 2\n", encoding="utf-8")
    _git(repository, "add", "example.py")
    _git(repository, "commit", "-m", "remove fixture before publication")
    terminal = _git(repository, "rev-parse", "HEAD")

    def scan(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(ROOT / "Scripts/check_no_secrets.py"), *args],
            cwd=repository,
            env=_git_environment(),
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )

    assert scan("--workspace").returncode == 0
    historical = scan("--commits", introduced, terminal)
    assert historical.returncode == 1
    assert "example.py:1 | GitHub token" in historical.stderr
    assert not (repository / "validation-was-called").exists()
    assert _real_index_digest() == real_index_before


def test_codex_worktree_bootstraps_before_scope_without_source_post_checkout(
    tmp_path: Path,
) -> None:
    real_index_before = _real_index_digest()
    repository = tmp_path / "source"
    repository.mkdir()
    _git(repository, "init")
    _git(repository, "config", "core.hooksPath", ".githooks")
    (repository / "README.md").write_text("# Stale creator checkout\n", encoding="utf-8")
    _git(repository, "add", "README.md")
    _git(repository, "commit", "-m", "source without post-checkout")
    stale_source = _git(repository, "rev-parse", "HEAD")

    hooks = repository / ".githooks"
    hooks.mkdir()
    for name in ("post-checkout", "pre-commit", "pre-push", "python-env"):
        shutil.copy2(ROOT / ".githooks" / name, hooks / name)
        (hooks / name).chmod(0o755)
    codex = repository / ".codex"
    codex.mkdir()
    for name in ("bootstrap-python.ps1", "hooks.json"):
        shutil.copy2(ROOT / ".codex" / name, codex / name)
    scripts = repository / "Scripts"
    scripts.mkdir()
    for name in ("git_hook_dispatchers.py", "setup_git_hooks.py"):
        shutil.copy2(ROOT / "Scripts" / name, scripts / name)
    (repository / "requirements.txt").write_text("", encoding="utf-8")
    (repository / "README.md").write_text("# Contributor target\n", encoding="utf-8")
    (scripts / "quality_gate.py").write_text(
        "import json\n"
        "import os\n"
        "import sys\n"
        "from pathlib import Path\n"
        "root = Path.cwd()\n"
        "mode = sys.argv[1]\n"
        "relative = Path('Scripts/python.exe') if os.name == 'nt' else Path('bin/python')\n"
        "expected = (root / '.venv' / relative).resolve()\n"
        "if Path(sys.executable).resolve() != expected:\n"
        "    raise SystemExit(29)\n"
        "counter = root / f'{mode}-invocations.json'\n"
        "previous = json.loads(counter.read_text()) if counter.exists() else {'count': 0}\n"
        "counter.write_text(json.dumps({'count': previous['count'] + 1, "
        "'python': str(Path(sys.executable).resolve())}))\n",
        encoding="utf-8",
    )
    _git(repository, "add", ".")
    _git(
        repository,
        "update-index",
        "--chmod=+x",
        ".githooks/post-checkout",
        ".githooks/pre-commit",
        ".githooks/pre-push",
        ".githooks/python-env",
    )
    _git(repository, "commit", "-m", "contributor target")
    contributor_target = _git(repository, "rev-parse", "HEAD")
    remote = tmp_path / "remote.git"
    _git(tmp_path, "init", "--bare", str(remote))
    _git(repository, "remote", "add", "origin", str(remote))
    _git(repository, "reset", "--hard", stale_source)

    codex_worktree = tmp_path / "codex-worktree"
    add = subprocess.run(
        [
            "git",
            "worktree",
            "add",
            "--detach",
            str(codex_worktree),
            contributor_target,
        ],
        cwd=repository,
        env=_git_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert add.returncode == 0, add.stderr
    assert not (codex_worktree / ".venv").exists()

    hook_configuration = json.loads(
        (codex_worktree / ".codex/hooks.json").read_text(encoding="utf-8")
    )
    session_hook = hook_configuration["hooks"]["SessionStart"][0]
    assert session_hook["matcher"] == "startup|resume"
    command = session_hook["hooks"][0]
    nested_session_directory = codex_worktree / "nested/session"
    nested_session_directory.mkdir(parents=True)
    if os.name == "nt":
        assert command["commandWindows"] == (
            "powershell -NoProfile -ExecutionPolicy Bypass "
            "-Command \"& (Join-Path (& git rev-parse --show-toplevel) "
            "'.codex/bootstrap-python.ps1')\""
        )
        session_command = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "& (Join-Path (& git rev-parse --show-toplevel) "
            "'.codex/bootstrap-python.ps1')",
        ]
    else:
        assert command["command"] == (
            'sh "$(git rev-parse --show-toplevel)/.githooks/python-env" '
            '"$(git rev-parse --show-toplevel)"'
        )
        session_command = command["command"]
    session_start = subprocess.run(
        session_command,
        cwd=nested_session_directory,
        env=_git_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
        shell=os.name != "nt",
    )
    assert session_start.returncode == 0, session_start.stderr

    local_python = (
        codex_worktree
        / ".venv"
        / (Path("Scripts/python.exe") if os.name == "nt" else Path("bin/python"))
    )
    stamp = codex_worktree / ".venv/.montecarlo-python-environment.json"
    assert local_python.is_file()
    assert stamp.is_file()
    assert not (codex_worktree / ".venv").is_symlink()
    assert not getattr(os.path, "isjunction", lambda _path: False)(
        codex_worktree / ".venv"
    )
    assert not (codex_worktree / "scope-invocations.json").exists()

    first_scope = subprocess.run(
        [str(local_python), "Scripts/quality_gate.py", "scope"],
        cwd=codex_worktree,
        env=_git_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert first_scope.returncode == 0, first_scope.stderr
    assert json.loads(
        (codex_worktree / "scope-invocations.json").read_text(encoding="utf-8")
    ) == {"count": 1, "python": str(local_python.resolve())}

    stamp_before = stamp.read_bytes()
    warm = subprocess.run(
        session_command,
        cwd=nested_session_directory,
        env=_git_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
        shell=os.name != "nt",
    )
    assert warm.returncode == 0, warm.stderr
    assert warm.stdout == ""
    assert stamp.read_bytes() == stamp_before

    configured_hooks = Path(_git(repository, "config", "--get", "core.hooksPath"))
    assert configured_hooks.is_absolute()
    assert configured_hooks.name == "montecarlo-hooks"
    assert configured_hooks.is_dir()
    assert not configured_hooks.is_symlink()
    assert not getattr(os.path, "isjunction", lambda _path: False)(configured_hooks)
    assert _git(repository, "worktree", "remove", "--force", str(codex_worktree)) == ""

    worktree = tmp_path / "fresh-worktree"
    branched_add = subprocess.run(
        [
            "git",
            "worktree",
            "add",
            "-b",
            "contribution",
            str(worktree),
            contributor_target,
        ],
        cwd=repository,
        env=_git_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert branched_add.returncode == 0, branched_add.stderr
    local_python = (
        worktree
        / ".venv"
        / (Path("Scripts/python.exe") if os.name == "nt" else Path("bin/python"))
    )
    assert local_python.is_file()

    canonical = tmp_path / "canonical-worktree"
    canonical_environment = _git_environment()
    canonical_environment["MONTECARLO_CANONICAL_WORKTREE"] = "1"
    canonical_add = subprocess.run(
        [
            "git",
            "worktree",
            "add",
            "--detach",
            str(canonical),
            contributor_target,
        ],
        cwd=repository,
        env=canonical_environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert canonical_add.returncode == 0, canonical_add.stderr
    assert not (canonical / ".venv").exists()
    assert _git(repository, "worktree", "remove", "--force", str(canonical)) == ""

    push = subprocess.run(
        ["git", "push", "origin", "HEAD:main"],
        cwd=worktree,
        env=_git_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert push.returncode == 0, push.stderr
    invocation_path = worktree / "push-invocations.json"
    invocation = json.loads(invocation_path.read_text(encoding="utf-8"))
    assert invocation == {"count": 1, "python": str(local_python.resolve())}

    (worktree / "Scripts/setup_git_hooks.py").write_text(
        "raise SystemExit(23)\n", encoding="utf-8"
    )
    (worktree / "second.txt").write_text("candidate\n", encoding="utf-8")
    _git(worktree, "add", "Scripts/setup_git_hooks.py", "second.txt")
    _git(worktree, "commit", "-m", "unavailable bootstrap fixture")
    blocked = subprocess.run(
        ["git", "push", "origin", "HEAD:main"],
        cwd=worktree,
        env=_git_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert blocked.returncode != 0
    assert json.loads(invocation_path.read_text(encoding="utf-8"))["count"] == 1
    assert _git(repository, "worktree", "remove", "--force", str(worktree)) == ""
    assert _real_index_digest() == real_index_before
