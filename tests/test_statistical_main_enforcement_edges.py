from __future__ import annotations

import argparse
import runpy
import shutil
import sys
from copy import deepcopy
from pathlib import Path

import pytest

from Scripts import generate_statistical_consolidated_report as consolidated_generator
from Scripts import quality_gate
from Scripts.quality_gate_statistical_plan import statistical_commands
from Scripts.statistical_main_authorities import (
    SCHEMA_PATHS,
    _validate_schema_file,
    validate_authorities,
    validate_corpus,
)
from Scripts.statistical_main_compatibility_evidence import compatibility_proof_issues
from Scripts.statistical_main_enforcement import _consolidated_inputs, main
from Scripts.statistical_main_enforcement_common import (
    _artifact_entries,
    canonical_sha,
    load_json,
    load_policy,
    schema_issues,
    snapshot_identity,
    verify_attestation,
    verify_requirements,
    write_attestation,
)
from Scripts.statistical_main_evidence import (
    _artifact_issues,
    _specialized_semantic_issues,
    enforce,
    observed_statuses,
)
from Scripts.statistical_main_policy import (
    ATTESTATION_SCHEMA_PATH,
    POLICY_PATH,
    POLICY_SCHEMA_PATH,
)
from tests.test_statistical_main_enforcement import (
    ROOT,
    _attestation,
    _proof_chain,
    _workspace,
    _write_json,
)


def _generate_current_consolidated_report(root: Path) -> dict[str, object]:
    report, issues = consolidated_generator.run_control(
        root=root,
        schema_path=root / "contracts/statistical-consolidated-report-v1.0.schema.json",
    )
    assert issues == []
    assert report is not None
    return report


def _consolidated_arguments(
    root: Path, requirements: list[Path], output: str
) -> list[str]:
    arguments = [
        "validate-consolidated",
        "--root",
        str(root),
        "--report",
        "reports/statistical-consolidated-report.json",
        "--schema",
        "contracts/statistical-consolidated-report-v1.0.schema.json",
        "--markdown",
        "reports/statistical-consolidated-report.md",
        "--output",
        output,
    ]
    for requirement in requirements:
        arguments.extend(("--requires", str(requirement)))
    return arguments


def _permissive_policy_root(path: Path) -> tuple[Path, dict[str, object]]:
    root = _workspace(path)
    policy = load_json(root / POLICY_PATH)
    _write_json(root / POLICY_SCHEMA_PATH, {})
    return root, policy


def test_policy_defence_in_depth_and_json_schema_errors(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"value": 1, "value": 2}', encoding="utf-8")
    with pytest.raises(ValueError, match="duplicate JSON property"):
        load_json(duplicate)

    assert schema_issues({}, []) == ["schema must be a JSON object"]
    assert schema_issues({}, {"type": "not-a-json-schema-type"})[0].startswith(
        "schema is invalid"
    )

    root = _workspace(tmp_path / "schema")
    _write_json(root / POLICY_PATH, [])
    assert load_policy(root)[0] == {}

    root, policy = _permissive_policy_root(tmp_path / "semantic")
    controls = policy["required_controls"]
    statuses = policy["statuses"]
    controls[0]["id"] = "changed_control"
    controls[0]["needs"] = ["consolidated_report_validation", "unknown_control"]
    statuses.append(deepcopy(statuses[1]))
    statuses.append(
        {"id": "extra_accepted", "disposition": "accepted", "final_allowed": True}
    )
    statuses[0]["disposition"] = "blocking"
    statuses[0]["final_allowed"] = False
    next(item for item in statuses if item["id"] == "normative_divergence")[
        "disposition"
    ] = "informative"
    _write_json(root / POLICY_PATH, policy)
    issues = load_policy(root)[1]
    assert any("closed ordered" in item for item in issues)
    assert any("unique" in item for item in issues)
    assert any("only accepted" in item for item in issues)
    assert any("mandatory blocking" in item for item in issues)
    assert any("unknown dependencies" in item for item in issues)
    assert any("topologically ordered" in item for item in issues)


def test_schema_authority_and_corpus_load_failures_are_explicit(tmp_path: Path) -> None:
    missing = _workspace(tmp_path / "missing-schema")
    (missing / SCHEMA_PATHS[0]).unlink()
    assert _validate_schema_file(missing, SCHEMA_PATHS[0])

    non_object = _workspace(tmp_path / "non-object-schema")
    _write_json(non_object / SCHEMA_PATHS[0], [])
    assert "JSON object" in _validate_schema_file(non_object, SCHEMA_PATHS[0])[0]

    invalid = _workspace(tmp_path / "invalid-schema")
    _write_json(invalid / SCHEMA_PATHS[0], {"type": "invalid"})
    assert "schema is invalid" in _validate_schema_file(invalid, SCHEMA_PATHS[0])[0]

    vectors = _workspace(tmp_path / "vectors")
    vector_path = vectors / "contracts/mca-prng-v1-vectors.json"
    value = load_json(vector_path)
    value["version"] = 2
    _write_json(vector_path, value)
    assert any("PRNG vectors" in item for item in validate_authorities(vectors))

    absent = _workspace(tmp_path / "absent-authority")
    (absent / "contracts/statistical-compatibility-authority-v1.0.json").unlink()
    assert any("authority cannot be loaded" in item for item in validate_authorities(absent))

    non_object_authority = _workspace(tmp_path / "non-object-authority")
    _write_json(
        non_object_authority / "contracts/statistical-compatibility-authority-v1.0.json",
        [],
    )
    assert validate_authorities(non_object_authority)

    corpus = _workspace(tmp_path / "absent-corpus")
    (corpus / "contracts/statistical-reference-corpus-v1.0.json").unlink()
    assert validate_corpus(corpus)

    probes = _workspace(tmp_path / "probe-version")
    probe_path = probes / "contracts/statistical-validation-probes-v1.0.json"
    value = load_json(probe_path)
    value["normative_contract"] = "other"
    _write_json(probe_path, value)
    assert any("incompatible authority" in item for item in validate_corpus(probes))


def test_attestation_validation_rejects_every_integrity_bypass(tmp_path: Path) -> None:
    root = _workspace(tmp_path)
    artifact = Path("reports/statistical-parity-report.json")
    attestation = _attestation(root, "valid", ["deterministic_parity"], [str(artifact)])
    assert snapshot_identity(root)["file_count"] > 0

    with pytest.raises(ValueError, match="escapes"):
        _artifact_entries(root, [Path("../outside.json")])
    with pytest.raises(ValueError, match="missing"):
        _artifact_entries(root, [Path("reports/missing.json")])
    with pytest.raises(ValueError, match="closed catalog"):
        write_attestation(root, Path("reports/run/bad.json"), ["unknown"], [artifact])
    with pytest.raises(ValueError, match="closed catalog"):
        write_attestation(root, Path("reports/run/empty.json"), [], [artifact])

    invalid_policy = _workspace(tmp_path / "invalid-policy")
    policy = load_json(invalid_policy / POLICY_PATH)
    policy["profile"] = "pr"
    _write_json(invalid_policy / POLICY_PATH, policy)
    with pytest.raises(ValueError):
        write_attestation(
            invalid_policy,
            Path("reports/run/policy.json"),
            ["authority_preflight"],
            [POLICY_PATH],
        )

    invalid_attestation_schema = _workspace(tmp_path / "invalid-attestation-schema")
    _write_json(invalid_attestation_schema / ATTESTATION_SCHEMA_PATH, {"type": "array"})
    with pytest.raises(ValueError):
        write_attestation(
            invalid_attestation_schema,
            Path("reports/run/schema.json"),
            ["authority_preflight"],
            [POLICY_PATH],
        )

    value = load_json(root / attestation)
    value["policy"]["sha256"] = "0" * 64
    _write_json(root / attestation, value)
    assert any(
        "another enforcement policy" in item
        for item in verify_attestation(root, attestation)
    )

    value["policy"]["sha256"] = canonical_sha(load_json(root / POLICY_PATH))
    value["artifacts"][0]["path"] = "../outside.json"
    _write_json(root / attestation, value)
    assert any("escapes" in item for item in verify_attestation(root, attestation))

    value["artifacts"][0]["path"] = "reports/missing.json"
    _write_json(root / attestation, value)
    assert any("artifact is missing" in item for item in verify_attestation(root, attestation))

    _write_json(root / attestation, [])
    assert verify_attestation(root, attestation)
    assert verify_requirements(root, [attestation], {"deterministic_parity"})


def test_specialized_semantic_and_freshness_edge_diagnostics(tmp_path: Path) -> None:
    root = _workspace(tmp_path)
    distribution = load_json(root / "reports/statistical-distribution-evidence.json")
    distribution["protocol"]["version"] = "9.0"
    distribution["seed_population"]["fingerprint"] = "0" * 64
    issues = _specialized_semantic_issues(root, "distribution", distribution)
    assert any("current protocol" in item for item in issues)
    assert any("another seed population" in item for item in issues)
    assert _specialized_semantic_issues(root, "compatibility", {}) == []

    chain = _proof_chain(root)
    compatibility = load_json(root / "reports/statistical-compatibility-evidence.json")
    proof = next(
        item for item in compatibility["proof_artifacts"] if item["id"] == "deterministic-parity"
    )
    proof["actual_semantic_fingerprint"] = "0" * 64
    stale = compatibility_proof_issues(root, compatibility, [chain["parity"]])
    assert any("stale" in item for item in stale)
    assert any("proofs are missing" in item for item in stale)

    schema = load_json(root / "contracts/statistical-parity-report-v1.1.schema.json")
    assert _artifact_issues(root, "parity", [], schema, [])
    consolidated = _generate_current_consolidated_report(root)
    consolidated_schema = load_json(
        root / "contracts/statistical-consolidated-report-v1.0.schema.json"
    )
    assert _artifact_issues(root, "consolidated", consolidated, consolidated_schema, []) == []

    assert observed_statuses("parity", {"status": "engine_error"}) == {"engine_error"}
    assert observed_statuses(
        "parity", {"status": "match", "validation_alignment": {"status": "engine_error"}}
    ) == {"engine_error"}
    assert observed_statuses("exact", {"status": "unknown"}) == {"invalid_evidence"}
    assert observed_statuses("distribution", {"status": "invalid"}) == {
        "invalid_evidence"
    }
    assert observed_statuses("compatibility", {"status": "match"}) == {"match"}
    assert observed_statuses(
        "consolidated",
        {
            "verdict": {"status": "distributional_divergence"},
            "diagnostics": [{"classification": "protocol_error"}],
        },
    ) == {"distributional_divergence", "protocol_error"}


def test_enforcement_invocation_and_missing_artifact_fail_closed(tmp_path: Path) -> None:
    root = _workspace(tmp_path)
    chain = _proof_chain(root)
    issues, statuses = enforce(
        root,
        "parity",
        Path("reports/statistical-parity-report.json"),
        Path("contracts/statistical-parity-report-v1.1.schema.json"),
        [chain["authority"], chain["corpus"]],
        ["wrong_control"],
    )
    assert issues and statuses == {"invalid_evidence"}

    issues, statuses = enforce(
        root,
        "parity",
        Path("reports/missing.json"),
        Path("contracts/statistical-parity-report-v1.1.schema.json"),
        [chain["authority"], chain["corpus"]],
        ["deterministic_parity"],
    )
    assert issues and statuses == {"invalid_evidence"}


def test_cli_enforce_and_consolidated_validation_are_single_blocking_controls(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _workspace(tmp_path)
    report = _generate_current_consolidated_report(root)
    chain = _proof_chain(root)
    assert main(
        [
            "enforce",
            "--root",
            str(root),
            "--kind",
            "parity",
            "--artifact",
            "reports/statistical-parity-report.json",
            "--schema",
            "contracts/statistical-parity-report-v1.1.schema.json",
            "--requires",
            str(chain["authority"]),
            "--requires",
            str(chain["corpus"]),
            "--control",
            "deterministic_parity",
            "--output",
            "reports/run/parity-cli.json",
            "--reproduce",
            "python Scripts/run_statistical_reference_corpus.py",
        ]
    ) == 0
    assert "Observed statistical statuses: match" in capsys.readouterr().out
    assert main(
        [
            "enforce",
            "--root",
            str(root),
            "--kind",
            "parity",
            "--artifact",
            "reports/missing.json",
            "--schema",
            "contracts/statistical-parity-report-v1.1.schema.json",
            "--requires",
            str(chain["authority"]),
            "--requires",
            str(chain["corpus"]),
            "--control",
            "deterministic_parity",
            "--output",
            "reports/run/missing-cli.json",
            "--reproduce",
            "python Scripts/run_statistical_reference_corpus.py",
        ]
    ) == 1

    requirements = [
        chain[name]
        for name in ("parity", "exact", "batching", "distribution", "compatibility")
    ]
    report_sources = {source["path"]: source for source in report["sources"]}
    for requirement in requirements:
        attestation = load_json(root / requirement)
        assert attestation["snapshot"] == snapshot_identity(root)
        for artifact in attestation["artifacts"]:
            assert report_sources[artifact["path"]]["sha256"] == artifact["sha256"]
    assert main(
        _consolidated_arguments(root, requirements, "reports/run/consolidated-cli.json")
    ) == 0
    assert verify_attestation(root, Path("reports/run/consolidated-cli.json")) == []

    namespace = argparse.Namespace(
        requires=requirements,
        source_path=["invalid"],
        report=Path("reports/statistical-consolidated-report.json"),
        schema=Path("contracts/statistical-consolidated-report-v1.0.schema.json"),
        markdown=Path("reports/statistical-consolidated-report.md"),
    )
    assert _consolidated_inputs(namespace, root)[0]


def test_consolidated_validation_rejects_a_report_after_a_source_change(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _workspace(tmp_path)
    _generate_current_consolidated_report(root)
    chain = _proof_chain(root)
    requirements = [
        chain[name]
        for name in ("parity", "exact", "batching", "distribution", "compatibility")
    ]
    report_path = root / "reports/statistical-consolidated-report.json"
    report_before = report_path.read_bytes()
    parity_path = root / "reports/statistical-parity-report.json"
    parity_path.write_bytes(parity_path.read_bytes() + b"\n")

    assert main(
        _consolidated_arguments(root, requirements, "reports/run/stale-consolidated.json")
    ) == 1
    error = capsys.readouterr().err
    assert "Consolidated report is stale against the supplied current-run sources." in error
    assert "blocking statistical status observed: invalid_evidence" in error
    assert report_path.read_bytes() == report_before
    assert not (root / "reports/run/stale-consolidated.json").exists()


def test_consolidated_validation_rejects_a_report_from_another_snapshot(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = _workspace(tmp_path / "source")
    standard_path = source / "docs/standards/STD-STAT-001.md"
    standard_path.write_bytes(standard_path.read_bytes() + b"\n")
    _generate_current_consolidated_report(source)
    chain = _proof_chain(source)
    requirements = [
        source / chain[name]
        for name in ("parity", "exact", "batching", "distribution", "compatibility")
    ]
    report_path = source / "reports/statistical-consolidated-report.json"
    markdown_path = source / "reports/statistical-consolidated-report.md"
    source_report_before = report_path.read_bytes()

    target = _workspace(tmp_path / "target")
    shutil.copy2(report_path, target / "reports/statistical-consolidated-report.json")
    shutil.copy2(markdown_path, target / "reports/statistical-consolidated-report.md")

    assert main(
        _consolidated_arguments(target, requirements, "reports/run/cross-snapshot.json")
    ) == 1
    error = capsys.readouterr().err
    assert "artifact comes from another snapshot" in error
    assert "Consolidated report is stale against the supplied current-run sources." in error
    assert "blocking statistical status observed: invalid_evidence" in error
    assert report_path.read_bytes() == source_report_before
    assert not (target / "reports/run/cross-snapshot.json").exists()


def test_pr_statistical_plan_is_empty_and_script_entrypoint_is_executable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert statistical_commands(quality_gate, "pr", (quality_gate.InputSource.WORKSPACE,)) == ()
    monkeypatch.setattr(sys, "argv", ["statistical_main_enforcement.py", "--help"])
    monkeypatch.setattr(
        sys,
        "path",
        [item for item in sys.path if Path(item or ".").resolve() != ROOT],
    )
    with pytest.raises(SystemExit) as exc:
        runpy.run_path(
            str(ROOT / "Scripts/statistical_main_enforcement.py"),
            run_name="__main__",
        )
    assert exc.value.code == 0
