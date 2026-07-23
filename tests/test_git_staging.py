from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from Scripts import git_staging


def _environment(**updates: str) -> dict[str, str]:
    environment = os.environ.copy()
    for name in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"):
        environment.pop(name, None)
    environment.update(updates)
    return environment


def _git(
    repository: Path,
    *args: str,
    environment: dict[str, str] | None = None,
    input_text: str | None = None,
) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repository,
        env=environment or _environment(),
        input=input_text,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout.strip()


def _put_blob(repository: Path, index_file: str, path: str, content: str) -> None:
    environment = _environment(GIT_INDEX_FILE=index_file)
    blob = _git(
        repository,
        "hash-object",
        "-w",
        "--stdin",
        environment=environment,
        input_text=content,
    )
    _git(
        repository,
        "update-index",
        "--add",
        "--cacheinfo",
        f"100644,{blob},{path}",
        environment=environment,
    )


def test_parser_and_path_projection_cover_every_name_status_shape() -> None:
    changes = git_staging.parse_staged_changes(
        "M\0backend/api.py\0A\0README.md\0R100\0old.py\0new.py\0"
    )

    assert changes == (
        git_staging.StagedChange("M", ("backend/api.py",)),
        git_staging.StagedChange("A", ("README.md",)),
        git_staging.StagedChange("R", ("old.py", "new.py")),
    )
    assert git_staging.changed_paths(changes) == (
        "backend/api.py",
        "README.md",
        "old.py",
        "new.py",
    )
    assert git_staging.parse_staged_changes("") == ()

    with pytest.raises(git_staging.GitStagingError, match="empty staged"):
        git_staging.parse_staged_changes("\0")
    with pytest.raises(git_staging.GitStagingError, match="incomplete staged"):
        git_staging.parse_staged_changes("R100\0old.py\0")


def test_relative_commit_index_is_read_and_exported_as_one_absolute_authority(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    _git(repository, "init")
    index_file = ".git/index.commit"
    environment = _environment(GIT_INDEX_FILE=index_file)
    _put_blob(repository, index_file, "README.md", "# Readme\n")

    assert git_staging.read_staged_changes(
        repository, environment=environment
    ) == (git_staging.StagedChange("A", ("README.md",)),)
    expected_index = (repository / index_file).resolve()
    assert git_staging.resolve_index_path(
        repository, environment=environment
    ) == expected_index
    exported = git_staging.index_git_environment(
        repository, environment=environment
    )
    assert exported == {
        "GIT_DIR": str((repository / ".git").resolve()),
        "GIT_WORK_TREE": str(repository.resolve()),
        "GIT_INDEX_FILE": str(expected_index),
    }

    default_environment = _environment()
    _put_blob(repository, ".git/index", "backend/api.py", "VALUE = 1\n")
    assert git_staging.resolve_index_path(
        repository, environment=default_environment
    ) == (repository / ".git/index").resolve()


def test_explicit_repository_ignores_an_inherited_foreign_git_context(
    tmp_path: Path,
) -> None:
    source = tmp_path / "source"
    source.mkdir()
    _git(source, "init")
    source_index = str((source / ".git/index.commit").resolve())
    _put_blob(source, source_index, "README.md", "# Source\n")

    target = tmp_path / "target"
    target.mkdir()
    _git(target, "init")
    _put_blob(target, ".git/index", "backend/api.py", "VALUE = 1\n")

    inherited = _environment(
        GIT_DIR=".git",
        GIT_WORK_TREE=".",
        GIT_INDEX_FILE=source_index,
        GIT_OBJECT_DIRECTORY=str((source / ".git/objects").resolve()),
        GIT_ALTERNATE_OBJECT_DIRECTORIES=str((source / ".git/objects").resolve()),
    )
    isolated = git_staging.isolated_git_environment(inherited)

    assert not set(git_staging.REPOSITORY_GIT_VARIABLES) & isolated.keys()
    assert git_staging.read_staged_changes(target, environment=isolated) == (
        git_staging.StagedChange("A", ("backend/api.py",)),
    )
    active = git_staging.active_index_git_environment(
        source, environment=inherited
    )
    assert active["GIT_INDEX_FILE"] == source_index
    assert git_staging.read_staged_changes(source, environment=active) == (
        git_staging.StagedChange("A", ("README.md",)),
    )


def test_git_staging_errors_fail_closed(tmp_path: Path, monkeypatch) -> None:
    class Result:
        returncode = 1
        stdout = ""
        stderr = "explicit failure"

    monkeypatch.setattr(git_staging, "_git", lambda *_args, **_kwargs: Result())
    with pytest.raises(git_staging.GitStagingError, match="explicit failure"):
        git_staging.read_staged_changes(tmp_path)

    Result.stderr = ""
    with pytest.raises(git_staging.GitStagingError, match="returned no path"):
        git_staging.resolve_index_path(tmp_path, environment={})
    with pytest.raises(git_staging.GitStagingError, match="returned no path"):
        git_staging.index_git_environment(tmp_path, environment={})
