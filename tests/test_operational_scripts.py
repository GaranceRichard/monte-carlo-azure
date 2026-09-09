from __future__ import annotations

import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from Scripts import purge_inactive_clients, setup_git_hooks


class _Collection:
    def __init__(self) -> None:
        self.deleted: list[str] = []

    def distinct(self, _field: str, query: dict) -> list[str | None]:
        assert "$lt" in query["last_seen"]
        return [None, "client-a", "client-b"]

    def delete_many(self, query: dict) -> SimpleNamespace:
        self.deleted.append(query["mc_client_id"])
        return SimpleNamespace(deleted_count=2)


class _Client:
    def __init__(self, collection: _Collection) -> None:
        self.collection = collection

    def __getitem__(self, _name: str):
        return self.collection if _name == "simulations" else self


def _bootstrap_runner(
    root: Path,
    calls: list[tuple[str, ...]],
    *,
    failures: dict[str, int] | None = None,
):
    failures = failures or {}
    environment_root = root / ".venv"
    environment_python = environment_root / "Scripts" / "python.exe"
    inventory = [["pip", "25.0"]]

    def run(argv, **_kwargs):
        command = tuple(str(item) for item in argv)
        calls.append(command)
        kind = (
            "create"
            if command[1:3] == ("-m", "venv")
            else "install"
            if command[1:4] == ("-m", "pip", "install")
            else "check"
            if command[1:4] == ("-m", "pip", "check")
            else "probe"
        )
        if failures.get(kind):
            return subprocess.CompletedProcess(command, failures[kind], "", f"{kind} failed")
        if kind == "create":
            environment_python.parent.mkdir(parents=True, exist_ok=True)
            environment_python.write_text("fixture", encoding="utf-8")
        stdout = ""
        if kind == "probe":
            stdout = json.dumps(
                {
                    "base_prefix": str(root / "base-python"),
                    "implementation": "cpython",
                    "inventory": inventory,
                    "prefix": str(environment_root),
                    "version": [3, 12, 10],
                }
            )
        return subprocess.CompletedProcess(command, 0, stdout, "")

    return run


def test_purge_env_integer_defaults_and_main(monkeypatch, capsys) -> None:
    monkeypatch.delenv("DAYS", raising=False)
    assert purge_inactive_clients._env_int("DAYS", 30) == 30
    monkeypatch.setenv("DAYS", "invalid")
    assert purge_inactive_clients._env_int("DAYS", 30) == 30
    monkeypatch.setenv("DAYS", "0")
    assert purge_inactive_clients._env_int("DAYS", 30) == 30
    monkeypatch.setenv("DAYS", "7")
    assert purge_inactive_clients._env_int("DAYS", 30) == 7

    collection = _Collection()
    client = _Client(collection)
    monkeypatch.setattr(
        purge_inactive_clients,
        "MongoClient",
        lambda url, serverSelectionTimeoutMS: client,
    )
    assert purge_inactive_clients.main() == 0
    assert collection.deleted == ["client-a", "client-b"]
    assert "clients_purged=2 simulations_deleted=4" in capsys.readouterr().out


def test_git_hook_setup_skips_missing_repo_and_reports_git_results(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    assert setup_git_hooks.main(["--root", str(tmp_path)]) == 0
    assert "not found" in capsys.readouterr().out

    (tmp_path / ".git").mkdir()
    ready = setup_git_hooks.BootstrapResult(
        "ready", "unchanged", tmp_path / ".venv/Scripts/python.exe", "a" * 64, 0.25
    )
    bootstrap_calls: list[Path] = []
    monkeypatch.setattr(
        setup_git_hooks,
        "ensure_python_environment",
        lambda root: bootstrap_calls.append(root) or ready,
    )
    monkeypatch.setattr(
        setup_git_hooks.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=4),
    )
    assert setup_git_hooks.main(["--root", str(tmp_path)]) == 4
    assert "Failed to configure" in capsys.readouterr().err

    monkeypatch.setattr(
        setup_git_hooks.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=0),
    )
    assert setup_git_hooks.main(["--root", str(tmp_path)]) == 0
    output = capsys.readouterr().out
    assert "Configured git hooks" in output
    assert "Python environment ready" in output
    assert bootstrap_calls == [tmp_path.resolve()]

    monkeypatch.setattr(
        setup_git_hooks,
        "configure_git_hooks",
        lambda *_args: pytest.fail("bootstrap-only must not rewrite Git configuration"),
    )
    assert setup_git_hooks.main(
        ["--root", str(tmp_path), "--bootstrap-only", "--quiet-if-ready"]
    ) == 0
    assert capsys.readouterr().out == ""

    monkeypatch.setattr(
        setup_git_hooks,
        "ensure_python_environment",
        lambda _root: (_ for _ in ()).throw(setup_git_hooks.BootstrapError("offline")),
    )
    assert setup_git_hooks.main(["--root", str(tmp_path), "--bootstrap-only"]) == 1
    assert "bootstrap failed: offline" in capsys.readouterr().err


def test_python_environment_bootstrap_creates_repairs_and_stays_idempotent(
    tmp_path: Path,
) -> None:
    root = tmp_path / "repository"
    root.mkdir()
    requirements = root / "requirements.txt"
    requirements.write_text("pip\n", encoding="utf-8")
    creator = root / "base-python.exe"
    creator.write_text("fixture", encoding="utf-8")
    calls: list[tuple[str, ...]] = []
    runner = _bootstrap_runner(root, calls)

    cold = setup_git_hooks.ensure_python_environment(
        root,
        runner=runner,
        clock=iter((1.0, 3.5)).__next__,
        platform_name="nt",
        bootstrap_python=creator,
    )
    assert (cold.status, cold.reason, cold.duration_seconds) == ("synchronized", "missing", 2.5)
    assert cold.requirements_sha256 == setup_git_hooks._requirements_sha256(requirements)
    assert any(command[1:3] == ("-m", "venv") for command in calls)
    assert any(command[1:4] == ("-m", "pip", "install") for command in calls)
    stamp = root / ".venv" / setup_git_hooks.STAMP_NAME
    stamp_before = stamp.read_bytes()

    calls.clear()
    warm = setup_git_hooks.ensure_python_environment(
        root,
        runner=runner,
        clock=iter((10.0, 10.2)).__next__,
        platform_name="nt",
        bootstrap_python=creator,
    )
    assert (warm.status, warm.reason) == ("ready", "unchanged")
    assert [command[1:4] for command in calls] == [
        ("-c", setup_git_hooks._ENVIRONMENT_PROBE),
        ("-m", "pip", "check"),
    ]
    assert stamp.read_bytes() == stamp_before

    requirements.write_text("pip>=1\n", encoding="utf-8")
    calls.clear()
    changed = setup_git_hooks.ensure_python_environment(
        root, runner=runner, platform_name="nt", bootstrap_python=creator
    )
    assert (changed.status, changed.reason) == ("synchronized", "dependencies-changed")
    assert not any(command[1:3] == ("-m", "venv") for command in calls)
    assert sum(command[1:4] == ("-m", "pip", "install") for command in calls) == 1

    setup_git_hooks.environment_python(root, "nt").unlink()
    calls.clear()
    repaired = setup_git_hooks.ensure_python_environment(
        root, runner=runner, platform_name="nt", bootstrap_python=creator
    )
    assert (repaired.status, repaired.reason) == ("synchronized", "unusable")
    create = next(command for command in calls if command[1:3] == ("-m", "venv"))
    assert "--copies" in create and "--clear" in create
    assert setup_git_hooks.environment_python(root, "posix") == root / ".venv/bin/python"
    expected_default = "Scripts/python.exe" if setup_git_hooks.os.name == "nt" else "bin/python"
    assert setup_git_hooks.environment_python(root) == root / ".venv" / expected_default


def test_python_environment_bootstrap_fails_closed_on_invalid_prerequisites(
    tmp_path: Path, monkeypatch
) -> None:
    root = tmp_path / "repository"
    root.mkdir()
    with pytest.raises(setup_git_hooks.BootstrapError, match="missing dependency authority"):
        setup_git_hooks.ensure_python_environment(root)

    requirements = root / "requirements.txt"
    requirements.write_text("pip\n", encoding="utf-8")
    environment = root / ".venv"
    environment.write_text("not a directory", encoding="utf-8")
    with pytest.raises(setup_git_hooks.BootstrapError, match="not a directory"):
        setup_git_hooks.ensure_python_environment(root)
    environment.unlink()

    environment.mkdir()
    monkeypatch.setattr(setup_git_hooks.os.path, "isjunction", lambda path: path == environment)
    with pytest.raises(setup_git_hooks.BootstrapError, match="linked or junction"):
        setup_git_hooks.ensure_python_environment(root)
    monkeypatch.setattr(setup_git_hooks.os.path, "isjunction", lambda _path: False)

    missing_creator = root / "missing-python.exe"
    with pytest.raises(setup_git_hooks.BootstrapError, match="Python 3.10"):
        setup_git_hooks.ensure_python_environment(
            root,
            runner=_bootstrap_runner(root, []),
            platform_name="nt",
            bootstrap_python=missing_creator,
        )

    creator = root / "base-python.exe"
    creator.write_text("fixture", encoding="utf-8")
    for failure, message in (
        ({"create": 2}, "venv creation failed"),
        ({"install": 3}, "dependency synchronization failed"),
        ({"check": 4}, "pip check rejected"),
        ({"probe": 5}, "interpreter is not exploitable"),
    ):
        if environment.exists():
            children = sorted(
                environment.rglob("*"), key=lambda path: len(path.parts), reverse=True
            )
            for child in children:
                child.unlink() if child.is_file() else child.rmdir()
        with pytest.raises(setup_git_hooks.BootstrapError, match=message):
            setup_git_hooks.ensure_python_environment(
                root,
                runner=_bootstrap_runner(root, [], failures=failure),
                platform_name="nt",
                bootstrap_python=creator,
            )


def test_python_environment_probe_and_manifest_reject_malformed_state(
    tmp_path: Path,
) -> None:
    root = tmp_path.resolve()
    environment = root / ".venv"
    python_executable = environment / "Scripts/python.exe"
    python_executable.parent.mkdir(parents=True)
    python_executable.write_text("fixture", encoding="utf-8")

    def probe(stdout: str, returncode: int = 0):
        return lambda *_args, **_kwargs: subprocess.CompletedProcess([], returncode, stdout, "")

    for stdout in ("not-json", "{}", json.dumps({"prefix": [], "base_prefix": "x", "version": []})):
        assert setup_git_hooks._probe_environment(
            python_executable, environment, root=root, runner=probe(stdout)
        ) is None
    assert setup_git_hooks._probe_environment(
        python_executable, environment, root=root, runner=probe("", 1)
    ) is None

    invalid = {
        "base_prefix": str(root / "base"),
        "implementation": "cpython",
        "inventory": {},
        "prefix": str(environment),
        "version": [3, 9, 9],
    }
    assert setup_git_hooks._probe_environment(
        python_executable, environment, root=root, runner=probe(json.dumps(invalid))
    ) is None
    invalid.update({"inventory": [], "version": [3, 12, 0], "base_prefix": str(environment)})
    assert setup_git_hooks._probe_environment(
        python_executable, environment, root=root, runner=probe(json.dumps(invalid))
    ) is None
    invalid.update(
        {
            "base_prefix": str(root / "base"),
            "inventory": {},
            "prefix": str(environment),
        }
    )
    assert setup_git_hooks._probe_environment(
        python_executable, environment, root=root, runner=probe(json.dumps(invalid))
    ) is None
    invalid.update({"inventory": [], "prefix": str(root / "other-environment")})
    assert setup_git_hooks._probe_environment(
        python_executable, environment, root=root, runner=probe(json.dumps(invalid))
    ) is None

    stamp = environment / setup_git_hooks.STAMP_NAME
    assert setup_git_hooks._read_manifest(stamp) is None
    stamp.write_text("[]", encoding="utf-8")
    assert setup_git_hooks._read_manifest(stamp) is None
    stamp.write_text("{broken", encoding="utf-8")
    assert setup_git_hooks._read_manifest(stamp) is None
