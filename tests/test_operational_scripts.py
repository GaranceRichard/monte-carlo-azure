from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

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
    monkeypatch.setattr(setup_git_hooks, "REPO_ROOT", tmp_path)
    assert setup_git_hooks.main() == 0
    assert "not found" in capsys.readouterr().out

    (tmp_path / ".git").mkdir()
    monkeypatch.setattr(
        setup_git_hooks.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=4),
    )
    assert setup_git_hooks.main() == 4
    assert "Failed to configure" in capsys.readouterr().err

    monkeypatch.setattr(
        setup_git_hooks.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=0),
    )
    assert setup_git_hooks.main() == 0
    assert "Configured git hooks" in capsys.readouterr().out
