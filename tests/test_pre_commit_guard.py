from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import pre_commit_guard  # noqa: E402


@pytest.fixture
def workspace_readme(tmp_path: Path) -> Path:
    return tmp_path / "README.md"


def test_guard_plan_checks_the_final_tree_without_reinspecting_the_index() -> None:
    assert [
        (check.name, check.input_sources) for check in pre_commit_guard.guard_plan()
    ] == [
        ("README encoding", ("workspace",)),
        ("README French accents", ("workspace",)),
        ("Final tree secret scan", ("workspace",)),
        ("DoD compliance", ("workspace",)),
    ]


@pytest.mark.parametrize("failed_check", range(4))
def test_final_tree_guard_stops_at_the_first_failure(
    monkeypatch, failed_check: int
) -> None:
    calls: list[str] = []
    checks = (
        "check_readme_encoding",
        "check_readme_french_accents",
        "check_no_secrets",
        "check_dod_compliance",
    )
    for position, name in enumerate(checks):
        monkeypatch.setattr(
            pre_commit_guard,
            name,
            lambda label=name, index=position: calls.append(label)
            or (9 if index == failed_check else 0),
        )

    assert pre_commit_guard.main() == 9
    assert calls == list(checks[: failed_check + 1])


def test_french_accent_guard_accepts_accented_prose_and_ascii_code(
    workspace_readme: Path, monkeypatch
) -> None:
    workspace_readme.write_text(
        "# Prévision\n\nUne équipe sécurise un périmètre et sa capacité.\n\n"
        "```bash\npython Scripts/check_naming_convention.py\n```\n"
        "La qualité du scénario reste documentée.\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(pre_commit_guard, "README_PATH", workspace_readme)

    assert pre_commit_guard.check_readme_french_accents() == 0


def test_french_accent_guard_rejects_massively_deaccented_prose(
    workspace_readme: Path, monkeypatch
) -> None:
    workspace_readme.write_text(
        "# Prevision\n\nSecuriser le perimetre, la capacite et la securite.\n\n"
        "Les fonctionnalites, la qualite, le scenario, le deploiement, les prerequis, "
        "le controle et la definition doivent etre documentes.\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(pre_commit_guard, "README_PATH", workspace_readme)

    assert pre_commit_guard.check_readme_french_accents() == 1


def test_french_accent_guard_is_independent_from_mojibake(
    workspace_readme: Path, monkeypatch
) -> None:
    workspace_readme.write_text(
        "# PrÃ©vision\n\nLa qualité reste documentée.\n", encoding="utf-8"
    )
    monkeypatch.setattr(pre_commit_guard, "README_PATH", workspace_readme)

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


def test_final_readme_must_exist_and_have_valid_encoding(
    workspace_readme: Path, capsys
) -> None:
    assert pre_commit_guard.check_readme_encoding(workspace_readme) == 1
    assert pre_commit_guard.check_readme_french_accents(workspace_readme) == 1
    assert "README.md is missing" in capsys.readouterr().err
    workspace_readme.write_bytes(b"Invalid UTF-8: \xff\n")
    assert pre_commit_guard.check_readme_encoding(workspace_readme) == 1
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

    calls = []
    monkeypatch.setattr(
        pre_commit_guard,
        "run",
        lambda cmd: calls.append(cmd)
        or SimpleNamespace(returncode=0, stdout="", stderr=""),
    )
    assert pre_commit_guard.check_no_secrets() == 0
    assert pre_commit_guard.check_dod_compliance() == 0
    assert calls == [
        [sys.executable, str(script), "--workspace"],
        [sys.executable, str(script)],
    ]


def test_main_returns_zero_when_all_final_checks_pass(monkeypatch) -> None:
    monkeypatch.setattr(
        pre_commit_guard,
        "guard_plan",
        lambda: (pre_commit_guard.GuardCheck("ok", ("workspace",), lambda: 0),),
    )
    assert pre_commit_guard.main() == 0
