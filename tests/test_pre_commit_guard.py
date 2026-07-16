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


def test_staged_files_reads_only_added_copied_modified_or_renamed_index_entries(
    monkeypatch,
) -> None:
    calls: list[list[str]] = []

    def fake_run(cmd: list[str]) -> SimpleNamespace:
        calls.append(cmd)
        return SimpleNamespace(returncode=0, stdout="backend/api.py\nREADME.md\n\n", stderr="")

    monkeypatch.setattr(pre_commit_guard, "run", fake_run)

    assert pre_commit_guard.staged_files() == ["backend/api.py", "README.md"]
    assert calls == [["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"]]


def test_staged_files_exits_two_when_the_index_cannot_be_read(
    monkeypatch, capsys
) -> None:
    monkeypatch.setattr(
        pre_commit_guard,
        "run",
        lambda _cmd: SimpleNamespace(returncode=128, stdout="", stderr="fatal: no index"),
    )

    with pytest.raises(SystemExit) as exc:
        pre_commit_guard.staged_files()

    assert exc.value.code == 2
    assert "ERROR: unable to read staged files." in capsys.readouterr().err


def test_readme_requirement_scope_is_prefix_based() -> None:
    triggering_paths = [
        "frontend/src/App.tsx",
        "backend/api.py",
        "Scripts/quality_gate.py",
        ".github/workflows/ci.yml",
        "requirements.txt",
        "run_app.py",
    ]

    assert all(
        pre_commit_guard.requires_readme_update([path]) for path in triggering_paths
    )
    assert not pre_commit_guard.requires_readme_update(
        ["pyproject.toml", ".github/dependabot.yml", "docker-compose.yml"]
    )


def test_guard_plan_locks_order_and_repository_inputs() -> None:
    plan = pre_commit_guard.guard_plan(["backend/api.py"])

    assert [(check.name, check.input_sources) for check in plan] == [
        ("README staged with code/config changes", ("git-index",)),
        ("README encoding", ("git-index",)),
        ("README French accents", ("git-index",)),
        ("Secret scan", ("git-index",)),
        ("DoD compliance", ("git-index",)),
    ]


def test_main_is_fail_fast_and_leaves_naming_to_the_main_quality_plan(
    monkeypatch,
) -> None:
    calls: list[str] = []

    monkeypatch.setattr(pre_commit_guard, "staged_files", lambda: ["backend/api.py"])
    monkeypatch.setattr(
        pre_commit_guard,
        "check_readme_staged",
        lambda paths: calls.append(f"readme-staged:{paths[0]}") or 0,
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
        "readme-staged:backend/api.py",
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
