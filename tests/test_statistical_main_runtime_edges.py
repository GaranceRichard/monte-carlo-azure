from __future__ import annotations

import subprocess
from copy import deepcopy
from pathlib import Path

import pytest

from Scripts import generate_statistical_consolidated_report as generator
from Scripts import quality_gate_workspace_snapshot as snapshot
from Scripts import run_statistical_compatibility as compatibility
from Scripts import validate_statistical_consolidated_report as validator
from Scripts.statistical_consolidated_render import finalize_report, render_json, render_markdown
from Scripts.statistical_consolidated_source_catalog import parse_source_paths
from Scripts.statistical_main_enforcement_common import load_json
from Scripts.test_execution_profiles import load_json as load_profile_json
from Scripts.test_execution_profiles_graph import dependency_errors

ROOT = Path(__file__).resolve().parents[1]


def test_workspace_enumeration_fails_closed_and_preserves_unique_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    failed = subprocess.CompletedProcess([], 2, "", "enumeration denied")
    monkeypatch.setattr(snapshot.subprocess, "run", lambda *_args, **_kwargs: failed)
    with pytest.raises(RuntimeError, match="enumeration denied"):
        snapshot.workspace_snapshot_paths(tmp_path, {})

    (tmp_path / ".env").write_text("TECHNICAL=1\n", encoding="utf-8")
    passed = subprocess.CompletedProcess([], 0, "README.md\0README.md\0", "")
    monkeypatch.setattr(snapshot.subprocess, "run", lambda *_args, **_kwargs: passed)
    assert snapshot.workspace_snapshot_paths(tmp_path, {}) == ("README.md", ".env")


def test_workspace_copy_rejects_non_regular_and_escaping_sources(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    destination = tmp_path / "snapshot"
    repository.mkdir()
    destination.mkdir()
    snapshot._copy_regular_file(repository, destination, "missing.txt")
    (repository / "directory").mkdir()
    with pytest.raises(RuntimeError, match="regular file"):
        snapshot._copy_regular_file(repository, destination, "directory")
    with pytest.raises(RuntimeError, match="escapes the repository"):
        snapshot._copy_regular_file(repository, destination, "../outside.txt")


def test_workspace_snapshot_exposes_only_a_discoverable_git_pointer(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    git_directory = repository / ".git"
    repository.mkdir()
    git_directory.mkdir()
    (repository / "README.md").write_text("snapshot\n", encoding="utf-8")

    with snapshot.workspace_snapshot(
        repository,
        ("README.md",),
        git_directory,
    ) as isolated:
        assert (isolated / "README.md").read_text(encoding="utf-8") == "snapshot\n"
        assert (isolated / ".git").read_text(encoding="utf-8") == (
            f"gitdir: {git_directory.resolve().as_posix()}\n"
        )

    with pytest.raises(RuntimeError, match="Git directory is unavailable"):
        snapshot._write_git_pointer(tmp_path, tmp_path / "missing")


def test_snapshot_git_environment_requires_an_explicit_git_directory(
    tmp_path: Path,
) -> None:
    with pytest.raises(RuntimeError, match="is not configured"):
        snapshot.snapshot_git_environment(tmp_path, {})
    assert snapshot.snapshot_git_environment(
        tmp_path,
        {"GIT_DIR": "authority.git", "UNCHANGED": "yes"},
    ) == {
        "GIT_DIR": "authority.git",
        "GIT_WORK_TREE": str(tmp_path),
        "UNCHANGED": "yes",
    }


def test_run_scoped_path_parsers_accept_closed_valid_mappings_and_reject_invalid() -> None:
    assert compatibility.parse_proof_paths(["exact-replay=reports/exact.json"]) == {
        "exact-replay": "reports/exact.json"
    }
    with pytest.raises(ValueError, match="Invalid or duplicate"):
        compatibility.parse_proof_paths(["missing-separator"])
    assert parse_source_paths(["exact_replay=reports/exact.json"]) == {
        "exact_replay": "reports/exact.json"
    }


def test_consolidated_clis_reject_invalid_run_scoped_source_syntax(
    capsys: pytest.CaptureFixture[str],
) -> None:
    invalid = ["--source-path", "exact_replay"]
    assert generator.main(invalid) == 1
    assert "Invalid or duplicate" in capsys.readouterr().err
    assert validator.main(invalid) == 1
    assert "Invalid or duplicate" in capsys.readouterr().err


def test_independent_consolidated_validator_rejects_a_current_but_stale_model(
    tmp_path: Path,
) -> None:
    report = deepcopy(load_json(ROOT / "reports/statistical-consolidated-report.json"))
    report["limits"][0]["statements"][0] = "Mutated but structurally valid declared limit."
    report = finalize_report(report)
    report_path = tmp_path / "report.json"
    markdown_path = tmp_path / "report.md"
    report_path.write_text(render_json(report), encoding="utf-8")
    markdown_path.write_text(render_markdown(report), encoding="utf-8")

    validated, issues = validator.run_control(
        report_path,
        ROOT / "contracts/statistical-consolidated-report-v1.0.schema.json",
        markdown_path,
        root=ROOT,
    )

    assert validated is not None
    assert issues == ["Consolidated report is stale against the supplied current-run sources."]


def test_execution_dag_rejects_a_missing_conditional_dependency() -> None:
    contract = load_profile_json(ROOT / "config/test-execution-profiles.json")
    changed = deepcopy(contract)
    aggregate = next(node for node in changed["nodes"] if node["id"] == "aggregate")
    aggregate["conditionalNeeds"] = ["missing-statistical-node"]

    assert any(
        "conditionally needs missing node missing-statistical-node" in issue
        for issue in dependency_errors(changed)
    )
