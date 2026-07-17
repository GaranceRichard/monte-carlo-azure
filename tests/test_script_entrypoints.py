from __future__ import annotations

import runpy
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pymongo
import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize(
    "relative_path",
    [
        "Scripts/check_e2e_coverage.py",
        "Scripts/check_maintainability.py",
        "Scripts/check_python_coverage.py",
        "Scripts/check_vitals_compliance.py",
        "Scripts/quality_gate.py",
        "Scripts/report_vitals_coverage.py",
        "Scripts/scrub_simulation_identity.py",
        "run_app.py",
    ],
)
def test_argparse_entrypoints_expose_help(relative_path: str, monkeypatch) -> None:
    monkeypatch.setattr(sys, "argv", [relative_path, "--help"])
    with pytest.raises(SystemExit) as exc:
        runpy.run_path(str(ROOT / relative_path), run_name="__main__")
    assert exc.value.code == 0


def test_read_only_entrypoints_execute_their_main_guard(monkeypatch) -> None:
    class Result:
        returncode = 0
        stdout = ""
        stderr = ""

    monkeypatch.setattr(subprocess, "run", lambda *_args, **_kwargs: Result())
    for relative_path in (
        "Scripts/check_no_secrets.py",
        "Scripts/pre_commit_guard.py",
    ):
        monkeypatch.setattr(sys, "argv", [relative_path])
        with pytest.raises(SystemExit) as exc:
            runpy.run_path(str(ROOT / relative_path), run_name="__main__")
        assert exc.value.code == 0


def test_repository_compliance_entrypoints_execute_their_main_guard(monkeypatch) -> None:
    for relative_path in (
        "Scripts/check_dod_compliance.py",
        "Scripts/check_identity_boundary.py",
        "Scripts/check_naming_convention.py",
    ):
        monkeypatch.setattr(sys, "argv", [relative_path])
        with pytest.raises(SystemExit):
            runpy.run_path(str(ROOT / relative_path), run_name="__main__")


def test_operational_entrypoints_are_isolated_from_external_state(monkeypatch) -> None:
    class Collection:
        def distinct(self, *_args, **_kwargs):
            return []

    class Client:
        def __getitem__(self, _name):
            return self

        def close(self):
            return None

        def distinct(self, *_args, **_kwargs):
            return Collection().distinct()

    monkeypatch.setattr(pymongo, "MongoClient", lambda *_args, **_kwargs: Client())
    monkeypatch.setattr(sys, "argv", ["purge_inactive_clients.py"])
    with pytest.raises(SystemExit) as exc:
        runpy.run_path(str(ROOT / "Scripts/purge_inactive_clients.py"), run_name="__main__")
    assert exc.value.code == 0

    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(returncode=0),
    )
    monkeypatch.setattr(sys, "argv", ["setup_git_hooks.py"])
    with pytest.raises(SystemExit) as exc:
        runpy.run_path(str(ROOT / "Scripts/setup_git_hooks.py"), run_name="__main__")
    assert exc.value.code == 0
