from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

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
