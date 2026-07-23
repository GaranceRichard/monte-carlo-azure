from __future__ import annotations

import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import pre_commit_guard  # noqa: E402


@pytest.fixture
def workspace_readme() -> Path:
    base_dir = ROOT / ".tmp_pre_commit_guard_tests"
    shutil.rmtree(base_dir, ignore_errors=True)
    base_dir.mkdir(parents=True)
    readme = base_dir / "README.md"
    try:
        yield readme
    finally:
        shutil.rmtree(base_dir, ignore_errors=True)


def change(status: str, *paths: str) -> pre_commit_guard.StagedChange:
    return pre_commit_guard.StagedChange(status=status, paths=paths)


def test_staged_changes_reads_added_modified_deleted_and_renamed_index_entries(
) -> None:
    assert list(
        pre_commit_guard.parse_staged_changes(
            "M\0backend/api.py\0A\0README.md\0D\0docs/old.md\0"
            "R100\0README.md\0docs/README.md\0"
        )
    ) == [
        change("M", "backend/api.py"),
        change("A", "README.md"),
        change("D", "docs/old.md"),
        change("R", "README.md", "docs/README.md"),
    ]


def test_staged_changes_exits_two_when_the_index_cannot_be_read(
    monkeypatch, capsys
) -> None:
    monkeypatch.setattr(
        pre_commit_guard,
        "read_staged_changes",
        lambda _root, **_kwargs: (_ for _ in ()).throw(
            pre_commit_guard.GitStagingError("fatal: no index")
        ),
    )

    with pytest.raises(SystemExit) as exc:
        pre_commit_guard.staged_changes()

    assert exc.value.code == 2
    assert "ERROR: unable to read staged changes." in capsys.readouterr().err


@pytest.mark.parametrize(
    "changes",
    [
        [],
        [change("M", "README.md")],
        [change("M", "backend/api.py"), change("M", "README.md")],
        [change("A", "README.md"), change("A", "backend/new_module.py")],
    ],
    ids=["empty-index", "readme-only", "code-and-readme", "readme-and-new-files"],
)
def test_readme_gate_accepts_only_commits_containing_an_added_or_modified_root_readme(
    changes: list[pre_commit_guard.StagedChange],
) -> None:
    assert pre_commit_guard.check_readme_staged(changes) == 0


@pytest.mark.parametrize(
    "changes",
    [
        [change("M", "backend/api.py")],
        [change("M", "docs/note.md")],
        [change("M", "docs/backlog.md")],
        [change("M", "frontend/README.md")],
        [change("D", "README.md")],
        [change("R", "README.md", "docs/README.md")],
    ],
    ids=["code", "documentation", "backlog", "nested-readme", "deleted", "renamed"],
)
def test_readme_gate_rejects_every_staged_change_without_a_modified_root_readme(
    changes: list[pre_commit_guard.StagedChange],
    capsys,
) -> None:
    assert pre_commit_guard.check_readme_staged(changes) == 1
    assert capsys.readouterr().err.startswith(
        "Commit refusé : README.md doit contenir une évolution pertinente et être inclus "
        "dans les changements stagés."
    )


def test_readme_gate_reports_when_readme_is_modified_only_in_worktree(capsys) -> None:
    assert pre_commit_guard.check_readme_staged(
        [change("M", "backend/api.py")],
        modified_only_in_worktree=True,
    ) == 1
    assert "README.md est modifié mais non stagé." in capsys.readouterr().err


def test_worktree_readme_probe_is_read_only_and_fails_closed(monkeypatch, capsys) -> None:
    calls: list[list[str]] = []

    def changed(cmd: list[str]) -> SimpleNamespace:
        calls.append(cmd)
        return SimpleNamespace(returncode=0, stdout="README.md\n", stderr="")

    monkeypatch.setattr(pre_commit_guard, "run", changed)
    assert pre_commit_guard.readme_modified_in_worktree()
    assert calls == [["git", "diff", "--name-only", "--", "README.md"]]

    monkeypatch.setattr(
        pre_commit_guard,
        "run",
        lambda _cmd: SimpleNamespace(returncode=2, stdout="", stderr="probe failed"),
    )
    with pytest.raises(SystemExit) as exc:
        pre_commit_guard.readme_modified_in_worktree()
    assert exc.value.code == 2
    assert "unable to inspect the README.md worktree state" in capsys.readouterr().err


def test_guard_plan_locks_order_and_repository_inputs() -> None:
    plan = pre_commit_guard.guard_plan([change("M", "backend/api.py")])

    assert [(check.name, check.input_sources) for check in plan] == [
        ("README staged with every commit", ("git-index",)),
        ("README encoding", ("git-index",)),
        ("README French accents", ("git-index",)),
        ("Secret scan", ("git-index",)),
        ("DoD compliance", ("git-index",)),
    ]


def test_main_is_fail_fast_and_leaves_naming_to_the_main_quality_plan(
    monkeypatch,
) -> None:
    calls: list[str] = []

    monkeypatch.setattr(
        pre_commit_guard,
        "staged_changes",
        lambda: [change("M", "backend/api.py")],
    )
    monkeypatch.setattr(
        pre_commit_guard,
        "readme_modified_in_worktree",
        lambda: False,
    )
    monkeypatch.setattr(
        pre_commit_guard,
        "check_readme_staged",
        lambda changes, *, modified_only_in_worktree=False: calls.append(
            f"readme-staged:{changes[0].paths[0]}:{modified_only_in_worktree}"
        ) or 0,
    )
    monkeypatch.setattr(
        pre_commit_guard,
        "check_readme_encoding",
        lambda: calls.append("readme-encoding") or 0,
    )
    monkeypatch.setattr(
        pre_commit_guard,
        "check_readme_french_accents",
        lambda: calls.append("readme-accents") or 0,
    )
    monkeypatch.setattr(
        pre_commit_guard,
        "check_no_secrets",
        lambda: calls.append("secrets") or 9,
    )
    monkeypatch.setattr(
        pre_commit_guard,
        "check_dod_compliance",
        lambda: calls.append("dod") or 0,
    )
    assert pre_commit_guard.main() == 9
    assert calls == [
        "readme-staged:backend/api.py:False",
        "readme-encoding",
        "readme-accents",
        "secrets",
    ]
    assert all(check.name != "Naming convention" for check in pre_commit_guard.guard_plan([]))


def test_french_accent_guard_accepts_accented_prose_and_ascii_code(
    workspace_readme: Path, monkeypatch
) -> None:
    readme = workspace_readme
    readme.write_text(
        "# Prévision\n\nUne équipe sécurise un périmètre et sa capacité.\n\n"
        "```bash\npython Scripts/check_naming_convention.py\n```\n"
        "La qualité du scénario reste documentée.\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(pre_commit_guard, "README_PATH", readme)

    assert pre_commit_guard.check_readme_french_accents() == 0


def test_french_accent_guard_rejects_massively_deaccented_prose(
    workspace_readme: Path, monkeypatch
) -> None:
    readme = workspace_readme
    readme.write_text(
        "# Prevision\n\nSecuriser le perimetre, la capacite et la securite.\n\n"
        "Les fonctionnalites, la qualite, le scenario, le deploiement, les prerequis, "
        "le controle et la definition doivent etre documentes.\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(pre_commit_guard, "README_PATH", readme)

    assert pre_commit_guard.check_readme_french_accents() == 1


def test_french_accent_guard_is_independent_from_mojibake(
    workspace_readme: Path, monkeypatch
) -> None:
    readme = workspace_readme
    readme.write_text("# PrÃ©vision\n\nLa qualité reste documentée.\n", encoding="utf-8")
    monkeypatch.setattr(pre_commit_guard, "README_PATH", readme)

    assert pre_commit_guard.check_readme_french_accents() == 0
    assert pre_commit_guard.check_readme_encoding() == 1


def test_run_executes_in_repository(monkeypatch) -> None:
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append((cmd, kwargs))
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(pre_commit_guard.subprocess, "run", fake_run)
    pre_commit_guard.run(["tool"])
    assert calls[0][1]["cwd"] == pre_commit_guard.REPO_ROOT


def test_readme_staging_encoding_and_missing_file_errors(
    workspace_readme: Path, capsys
) -> None:
    assert pre_commit_guard.check_readme_encoding(workspace_readme) == 1
    assert pre_commit_guard.check_readme_french_accents(workspace_readme) == 1
    workspace_readme.write_text("Plain valid text", encoding="utf-8")
    assert pre_commit_guard.check_readme_encoding(workspace_readme) == 0
    assert pre_commit_guard.check_readme_french_accents(workspace_readme) == 0


def test_external_checks_cover_missing_failure_and_success(
    monkeypatch, tmp_path: Path, capsys
) -> None:
    missing = tmp_path / "missing.py"
    monkeypatch.setattr(pre_commit_guard, "SECRET_CHECK_PATH", missing)
    monkeypatch.setattr(pre_commit_guard, "DOD_CHECK_PATH", missing)
    assert pre_commit_guard.check_no_secrets() == 1
    assert pre_commit_guard.check_dod_compliance() == 1

    script = tmp_path / "check.py"
    script.write_text("", encoding="utf-8")
    monkeypatch.setattr(pre_commit_guard, "SECRET_CHECK_PATH", script)
    monkeypatch.setattr(pre_commit_guard, "DOD_CHECK_PATH", script)
    monkeypatch.setattr(
        pre_commit_guard,
        "run",
        lambda _cmd: SimpleNamespace(returncode=4, stdout="out\n", stderr="err\n"),
    )
    assert pre_commit_guard.check_no_secrets() == 4
    assert pre_commit_guard.check_dod_compliance() == 4
    output = capsys.readouterr().err
    assert "out" in output and "err" in output

    monkeypatch.setattr(
        pre_commit_guard,
        "run",
        lambda _cmd: SimpleNamespace(returncode=0, stdout="", stderr=""),
    )
    assert pre_commit_guard.check_no_secrets() == 0
    assert pre_commit_guard.check_dod_compliance() == 0


def test_main_returns_zero_when_all_checks_pass(monkeypatch) -> None:
    monkeypatch.setattr(pre_commit_guard, "staged_changes", lambda: [])
    monkeypatch.setattr(
        pre_commit_guard,
        "guard_plan",
        lambda _changes, *, readme_worktree_only=False: (
            pre_commit_guard.GuardCheck("ok", (), lambda: 0),
        ),
    )
    assert pre_commit_guard.main() == 0
