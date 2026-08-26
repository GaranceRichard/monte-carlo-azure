from __future__ import annotations

import json
import runpy
import subprocess
import sys
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from Scripts import run_statistical_compatibility as compatibility_cli
from Scripts import validate_statistical_compatibility_evidence as evidence_cli
from Scripts.statistical_compatibility_authority import semantic_diagnostics
from Scripts.statistical_compatibility_common import load_json
from Scripts.statistical_compatibility_evidence import validate_evidence
from Scripts.statistical_compatibility_evolution import (
    evolution_diagnostics,
    load_committed_authority,
)
from tests.test_statistical_compatibility import (
    AUTHORITY_PATH,
    EVIDENCE_SCHEMA_PATH,
    ROOT,
    _append_release,
    _authority,
    _evaluate,
    _mutate_json,
    _replace,
    _risk_score,
    _workspace,
)


def test_ambiguous_authority_and_direct_proof_fingerprint_edit_are_blocked(
    tmp_path: Path,
) -> None:
    ambiguous = _workspace(tmp_path / "ambiguous")
    _replace(
        ambiguous,
        "backend/histogram.py",
        "HISTOGRAM_MAX_BUCKETS = 100",
        "HISTOGRAM_MAX_BUCKETS = 100\nHISTOGRAM_MAX_BUCKETS = 100",
    )
    _states, diagnostics = _evaluate(ambiguous)
    assert any(item.code == "authority_extraction_failed" for item in diagnostics)

    edited = _workspace(tmp_path / "proof")
    authority = load_json(edited / AUTHORITY_PATH)
    authority["proof_artifacts"][0]["semantic_fingerprint"] = "f" * 64
    _mutate_json(edited, AUTHORITY_PATH.as_posix(), lambda value: value.update(authority))
    _states, diagnostics = _evaluate(edited)
    assert any(item.code == "proof_fingerprint_drift" for item in diagnostics)


def test_accepted_release_history_and_new_proof_lineage_cannot_be_rewritten() -> None:
    previous = _authority()
    rewritten = deepcopy(previous)
    component = next(item for item in rewritten["components"] if item["id"] == "risk-score")
    component["releases"][0]["semantic_fingerprint"] = "f" * 64
    component["releases"][0]["decision"]["to_fingerprint"] = "f" * 64
    assert any(
        item.code == "accepted_release_modified"
        for item in evolution_diagnostics(rewritten, previous)
    )

    versioned = deepcopy(previous)
    _append_release(versioned, "risk-score", "normative_result_change")
    diagnostics = evolution_diagnostics(versioned, previous)
    assert any(item.code == "release_proofs_not_regenerated" for item in diagnostics)

    regenerated = deepcopy(previous)
    released = _append_release(regenerated, "risk-score", "normative_result_change")
    required = set(released["required_proofs"])
    for proof in regenerated["proof_artifacts"]:
        if proof["id"] in required:
            proof["version"] = "1.1"
            proof["semantic_fingerprint"] = "f" * 64
    diagnostics = evolution_diagnostics(regenerated, previous)
    assert not any(item.code == "release_proofs_not_regenerated" for item in diagnostics)


def test_evolution_rejects_removed_authorities_and_untraced_manifest_edits() -> None:
    previous = _authority()
    removed_proof = deepcopy(previous)
    removed_proof["proof_artifacts"].pop()
    assert any(
        item.code == "accepted_proof_removed"
        for item in evolution_diagnostics(removed_proof, previous)
    )

    removed_component = deepcopy(previous)
    removed_component["components"].pop()
    assert any(
        item.code == "accepted_component_removed"
        for item in evolution_diagnostics(removed_component, previous)
    )

    manifest_edit = deepcopy(previous)
    manifest_edit["components"][0]["consumers"].append("new-unreleased-consumer")
    assert any(
        item.code == "component_manifest_changed_without_release"
        for item in evolution_diagnostics(manifest_edit, previous)
    )


def test_proof_manifest_change_requires_version_and_component_release() -> None:
    previous = _authority()
    unversioned = deepcopy(previous)
    unversioned["proof_artifacts"][0]["semantic_fingerprint"] = "f" * 64
    diagnostics = evolution_diagnostics(unversioned, previous)
    assert {item.code for item in diagnostics} >= {
        "proof_version_not_incremented",
        "proof_manifest_changed_without_release",
    }

    versioned = deepcopy(previous)
    proof = versioned["proof_artifacts"][0]
    proof["version"] = "1.1"
    proof["semantic_fingerprint"] = "f" * 64
    diagnostics = evolution_diagnostics(versioned, previous)
    assert any(item.code == "proof_manifest_changed_without_release" for item in diagnostics)


def test_release_decision_must_match_semantics_identity_and_treatments() -> None:
    authority = _authority()
    risk = _append_release(authority, "risk-score", "serialized_shape_change")
    risk["releases"][-1]["decision"]["data_treatments"] = [
        {**item, "treatment": "compatible_without_action"}
        for item in risk["releases"][-1]["decision"]["data_treatments"]
    ]
    diagnostics = semantic_diagnostics(authority)
    assert any(item.code == "decision_incompatible_with_component" for item in diagnostics)
    assert any(item.code == "historical_treatment_incoherent" for item in diagnostics)

    prng_authority = _authority()
    _append_release(prng_authority, "prng", "pseudo_random_stream_change")
    assert any(
        item.code == "prng_identity_not_changed" for item in semantic_diagnostics(prng_authority)
    )

    version_only = _authority()
    component = _append_release(version_only, "risk-score", "normative_result_change")
    fingerprint = component["releases"][0]["semantic_fingerprint"]
    component["releases"][-1]["semantic_fingerprint"] = fingerprint
    component["releases"][-1]["decision"]["to_fingerprint"] = fingerprint
    assert any(
        item.code == "release_without_semantic_change"
        for item in semantic_diagnostics(version_only)
    )


def test_release_rejects_error_classification_incomplete_proofs_and_bad_plans() -> None:
    authority = _authority()
    component = _append_release(authority, "risk-score", "decision_missing")
    decision = component["releases"][-1]["decision"]
    decision["proof_artifacts"].pop()
    decision["changed_surfaces"] = []
    decision["from_fingerprint"] = "b" * 64
    decision["to_version"] = "9.0"
    component["releases"][-1]["version"] = "1.0"
    diagnostics = semantic_diagnostics(authority)
    codes = {item.code for item in diagnostics}
    assert {
        "invalid_release_classification",
        "release_proof_set_incomplete",
        "decision_missing_surfaces",
        "release_lineage_broken",
        "decision_target_mismatch",
        "version_not_incremented",
    }.issubset(codes)

    migration = _authority()
    _append_release(migration, "risk-score", "migration_required")
    assert any(item.code == "migration_plan_missing" for item in semantic_diagnostics(migration))

    invalidation = _authority()
    _append_release(invalidation, "risk-score", "invalidation_required")
    assert any(
        item.code == "invalidation_plan_missing" for item in semantic_diagnostics(invalidation)
    )


@pytest.mark.parametrize(
    ("completed", "expected"),
    [
        (SimpleNamespace(returncode=1, stdout=""), None),
        (SimpleNamespace(returncode=0, stdout="not json"), None),
        (SimpleNamespace(returncode=0, stdout="[]"), None),
        (SimpleNamespace(returncode=0, stdout='{"authority_id": "accepted"}'), "accepted"),
    ],
)
def test_committed_authority_loader_handles_git_outcomes(
    monkeypatch: pytest.MonkeyPatch,
    completed: SimpleNamespace,
    expected: str | None,
) -> None:
    monkeypatch.setattr(subprocess, "run", lambda *args, **kwargs: completed)
    value = load_committed_authority(ROOT, AUTHORITY_PATH.as_posix())
    assert (value or {}).get("authority_id") == expected


def test_committed_authority_loader_handles_process_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail(*args: Any, **kwargs: Any) -> None:
        raise OSError("git unavailable")

    monkeypatch.setattr(subprocess, "run", fail)
    assert load_committed_authority(ROOT, AUTHORITY_PATH.as_posix()) is None


def test_mixed_proof_versions_and_stale_evidence_are_rejected(tmp_path: Path) -> None:
    root = _workspace(tmp_path)

    def change(value: dict[str, Any]) -> None:
        value["corpus"]["schema_version"] = "9.0"

    _mutate_json(root, "reports/statistical-exact-replay-evidence.json", change)
    _states, diagnostics = _evaluate(root)
    assert any(item.code == "proof_version_mismatch" for item in diagnostics)

    evidence = load_json(ROOT / "reports/statistical-compatibility-evidence.json")
    schema = load_json(ROOT / EVIDENCE_SCHEMA_PATH)
    stale = deepcopy(evidence)
    stale["summary"]["diagnostic_count"] = 1
    assert validate_evidence(stale, schema)


def test_cli_is_blocking_but_is_not_a_main_profile_step(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _workspace(tmp_path)
    assert compatibility_cli.main(["--root", str(root), "--print-fingerprints"]) == 0
    _risk_score(root)
    assert compatibility_cli.main(["--root", str(root)]) == 1
    assert "normative_result_change" in capsys.readouterr().err

    main_profile = load_json(ROOT / "config/test-execution-profiles.json")
    assert "Statistical compatibility" not in json.dumps(main_profile)
    assert "run_statistical_compatibility.py" not in (ROOT / ".vscode/tasks.json").read_text(
        encoding="utf-8"
    )


def test_cli_load_schema_and_freshness_failures_are_explicit(tmp_path: Path) -> None:
    assert compatibility_cli.main(["--root", str(tmp_path / "absent")]) == 2
    assert evidence_cli.main(["--root", str(tmp_path / "absent")]) == 2

    root = _workspace(tmp_path / "schema")
    rejecting_schema = root / "reject-all.schema.json"
    rejecting_schema.write_text('{"not": {}}\n', encoding="utf-8")
    assert (
        compatibility_cli.main(
            [
                "--root",
                str(root),
                "--evidence-schema",
                str(rejecting_schema),
                "--output",
                str(root / "absolute-evidence.json"),
            ]
        )
        == 1
    )

    current = _workspace(tmp_path / "stale")
    output = current / "reports/statistical-compatibility-evidence.json"
    assert compatibility_cli.main(["--root", str(current)]) == 0
    evidence = load_json(output)
    evidence["summary"]["component_count"] += 1
    output.write_text(json.dumps(evidence), encoding="utf-8")
    assert evidence_cli.main(["--root", str(current)]) == 1


def test_canonical_evidence_is_current_and_entrypoints_execute(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    evidence = load_json(ROOT / "reports/statistical-compatibility-evidence.json")
    schema = load_json(ROOT / EVIDENCE_SCHEMA_PATH)
    assert validate_evidence(evidence, schema) == []
    assert evidence["status"] == "match"
    assert evidence["summary"]["component_count"] == 15
    assert evidence["summary"]["proof_count"] == 8
    assert evidence_cli.main([]) == 0

    monkeypatch.setattr(sys, "path", [item for item in sys.path if item != str(ROOT)])
    monkeypatch.setattr("sys.argv", ["run_statistical_compatibility.py"])
    with pytest.raises(SystemExit) as run_exit:
        runpy.run_path(str(ROOT / "Scripts/run_statistical_compatibility.py"), run_name="__main__")
    assert run_exit.value.code == 0
    sys.path.remove(str(ROOT))
    monkeypatch.setattr("sys.argv", ["validate_statistical_compatibility_evidence.py"])
    with pytest.raises(SystemExit) as validate_exit:
        runpy.run_path(
            str(ROOT / "Scripts/validate_statistical_compatibility_evidence.py"),
            run_name="__main__",
        )
    assert validate_exit.value.code == 0
