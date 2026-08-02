from __future__ import annotations

import json
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from Scripts import quality_gate
from Scripts.statistical_main_authorities import (
    validate_authorities,
    validate_corpus,
    validate_protocol,
)
from Scripts.statistical_main_enforcement import main
from Scripts.statistical_main_enforcement_common import (
    CONTROL_IDS,
    load_json,
    load_policy,
    snapshot_identity,
    verify_attestation,
    verify_requirements,
    write_attestation,
)
from Scripts.statistical_main_evidence import (
    enforce,
    observed_statuses,
    status_issues,
)
from Scripts.statistical_main_policy import POLICY_PATH, POLICY_SCHEMA_PATH
from Scripts.test_execution_profiles import active_nodes, topological_node_ids

ROOT = Path(__file__).resolve().parents[1]


def _copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def _workspace(path: Path) -> Path:
    root = path / "repository"
    shutil.copytree(ROOT / "config", root / "config")
    shutil.copytree(ROOT / "contracts", root / "contracts")
    _copy(ROOT / "docs/standards/STD-STAT-001.md", root / "docs/standards/STD-STAT-001.md")
    for name in (
        "statistical-parity-report.json",
        "statistical-exact-replay-evidence.json",
        "statistical-distribution-evidence.json",
        "statistical-compatibility-evidence.json",
        "statistical-distribution-calibration.json",
    ):
        _copy(ROOT / "reports" / name, root / "reports" / name)
    return root


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _attestation(
    root: Path, name: str, controls: list[str], artifacts: list[str]
) -> Path:
    path = Path("reports/run") / f"{name}.json"
    write_attestation(root, path, controls, [Path(item) for item in artifacts])
    return path


def _proof_chain(root: Path) -> dict[str, Path]:
    paths = {
        "authority": _attestation(
            root,
            "authority",
            ["authority_preflight"],
            [POLICY_PATH.as_posix(), POLICY_SCHEMA_PATH.as_posix()],
        ),
        "corpus": _attestation(
            root,
            "corpus",
            ["corpus_and_probes"],
            [
                "contracts/statistical-reference-corpus-v1.0.json",
                "contracts/statistical-validation-probes-v1.0.json",
            ],
        ),
        "protocol": _attestation(
            root,
            "protocol",
            ["distribution_protocol"],
            [
                "contracts/statistical-distribution-protocol-v1.0.json",
                "contracts/statistical-distribution-seeds-v1.0.json",
            ],
        ),
        "parity": _attestation(
            root,
            "parity",
            ["deterministic_parity"],
            ["reports/statistical-parity-report.json"],
        ),
        "exact": _attestation(
            root,
            "exact",
            ["exact_replay"],
            ["reports/statistical-exact-replay-evidence.json"],
        ),
        "batching": _attestation(
            root,
            "batching",
            ["batching_independence"],
            ["reports/statistical-exact-replay-evidence.json"],
        ),
        "distribution": _attestation(
            root,
            "distribution",
            ["distributional_parity"],
            ["reports/statistical-distribution-evidence.json"],
        ),
    }
    paths["compatibility"] = _attestation(
        root,
        "compatibility",
        ["statistical_compatibility"],
        ["reports/statistical-compatibility-evidence.json"],
    )
    return paths


def test_closed_policy_blocks_every_mandatory_final_status() -> None:
    policy, issues = load_policy(ROOT)
    assert issues == []
    assert tuple(item["id"] for item in policy["required_controls"]) == CONTROL_IDS
    accepted = [item["id"] for item in policy["statuses"] if item["final_allowed"]]
    assert accepted == ["match"]
    blocking = {
        "normative_divergence",
        "interlanguage_divergence",
        "validation_probe_divergence",
        "batching_divergence",
        "distributional_divergence",
        "statistically_inconclusive",
        "version_incompatibility",
        "invalid_evidence",
        "engine_error",
        "protocol_error",
        "infrastructure_error",
        "source_missing",
        "schema_invalid",
        "fingerprint_invalid",
        "stale_evidence",
        "decision_missing",
        "decision_incoherent",
        "migration_required",
    }
    assert all(status_issues(ROOT, {status}) for status in blocking)
    assert status_issues(ROOT, {"match"}) == []
    assert status_issues(ROOT, {"unknown_status"}) == [
        "status absent from closed policy: unknown_status"
    ]


def test_specialized_status_mutations_map_to_blocking_policy() -> None:
    parity = load_json(ROOT / "reports/statistical-parity-report.json")
    parity["cases"][0]["python"]["status"] = "normative_divergence"
    parity["cases"][0]["inter_engine"]["status"] = "engine_divergence"
    parity["validation_alignment"]["status"] = "divergence"
    assert observed_statuses("parity", parity) == {
        "normative_divergence",
        "interlanguage_divergence",
        "validation_probe_divergence",
    }

    exact = load_json(ROOT / "reports/statistical-exact-replay-evidence.json")
    exact["cases"][0]["outcomes"] = [
        "normative_divergence",
        "interlanguage_divergence",
        "engine_error",
    ]
    assert observed_statuses("exact", exact) == {
        "normative_divergence",
        "interlanguage_divergence",
        "engine_error",
    }
    exact["batching"]["independent"] = False
    assert observed_statuses("batching", exact) == {"batching_divergence"}

    distribution = load_json(ROOT / "reports/statistical-distribution-evidence.json")
    for observed, expected in (
        ("divergence", "distributional_divergence"),
        ("inconclusive", "statistically_inconclusive"),
    ):
        distribution["status"] = observed
        assert expected in observed_statuses("distribution", distribution)
    distribution["status"] = "invalid"
    for classification in ("engine_error", "protocol_error", "infrastructure_error"):
        distribution["error_classification"] = classification
        assert observed_statuses("distribution", distribution) == {classification}

    compatibility = load_json(ROOT / "reports/statistical-compatibility-evidence.json")
    compatibility["status"] = "blocked"
    for classification in (
        "version_incompatibility",
        "decision_missing",
        "migration_required",
        "invalid_evidence",
    ):
        compatibility["classification"] = classification
        assert observed_statuses("compatibility", compatibility) == {classification}


def test_authority_corpus_probe_and_protocol_mutations_are_rejected(tmp_path: Path) -> None:
    root = _workspace(tmp_path)
    assert validate_authorities(root) == []
    assert validate_corpus(root) == []
    assert validate_protocol(root) == []

    corpus_path = root / "contracts/statistical-reference-corpus-v1.0.json"
    corpus = load_json(corpus_path)
    corpus["cases"][0]["input"]["n_sims"] = 999
    _write_json(corpus_path, corpus)
    assert validate_corpus(root)

    root = _workspace(tmp_path / "probe")
    probes_path = root / "contracts/statistical-validation-probes-v1.0.json"
    probes = load_json(probes_path)
    probes["cases"][0]["accepted"] = False
    _write_json(probes_path, probes)
    assert any(
        "Validation probes differ" in message
        for message in enforce(
            root,
            "parity",
            Path("reports/statistical-parity-report.json"),
            Path("contracts/statistical-parity-report-v1.1.schema.json"),
            [],
            ["deterministic_parity"],
        )[0]
    )

    root = _workspace(tmp_path / "protocol")
    protocol_path = root / "contracts/statistical-distribution-protocol-v1.0.json"
    protocol = load_json(protocol_path)
    protocol["version"] = "9.0"
    _write_json(protocol_path, protocol)
    assert validate_protocol(root)


def test_attestations_reject_missing_stale_cross_snapshot_and_incoherent_dependencies(
    tmp_path: Path,
) -> None:
    root = _workspace(tmp_path)
    chain = _proof_chain(root)
    assert verify_attestation(root, chain["exact"]) == []
    assert verify_requirements(
        root,
        [chain["authority"], chain["corpus"]],
        {"authority_preflight", "corpus_and_probes"},
    ) == []
    assert verify_requirements(root, [chain["corpus"]], {"authority_preflight"})

    exact = load_json(root / chain["exact"])
    exact["snapshot"]["sha256"] = "0" * 64
    _write_json(root / chain["exact"], exact)
    assert any("another snapshot" in item for item in verify_attestation(root, chain["exact"]))

    stale_root = _workspace(tmp_path / "stale-source")
    stale_chain = _proof_chain(stale_root)
    declared = snapshot_identity(stale_root)
    standard = stale_root / "docs/standards/STD-STAT-001.md"
    standard.write_bytes(standard.read_bytes() + b"\n")
    recalculated = snapshot_identity(stale_root)
    assert recalculated != declared
    stale_issues = verify_requirements(
        stale_root,
        [stale_chain["authority"]],
        {"authority_preflight"},
        consumer_controls={"deterministic_parity"},
    )
    stale_error = "\n".join(stale_issues)
    assert "artifact comes from another snapshot" in stale_error
    assert (
        f"expected_recalculated={recalculated['method']}:{recalculated['sha256']}"
        in stale_error
    )
    assert (
        f"observed_declared={declared['method']}:{declared['sha256']}" in stale_error
    )
    assert "consumer_controls=deterministic_parity" in stale_error
    assert str((stale_root / stale_chain["authority"]).resolve()) in stale_error
    assert "required attestations are missing controls" not in stale_error

    transplanted_root = _workspace(tmp_path / "transplanted")
    transplanted_standard = transplanted_root / "docs/standards/STD-STAT-001.md"
    transplanted_standard.write_bytes(
        transplanted_standard.read_bytes() + b"\nother snapshot\n"
    )
    assert verify_requirements(
        transplanted_root,
        [stale_root / stale_chain["authority"]],
        {"authority_preflight"},
        consumer_controls={"exact_replay"},
    )

    missing_issues = verify_requirements(
        root,
        [Path("reports/run/missing.json")],
        {"authority_preflight"},
        consumer_controls={"deterministic_parity"},
    )
    assert any("attestation unavailable" in item for item in missing_issues)
    assert any("required attestations are missing controls" in item for item in missing_issues)

    parity_path = root / "reports/statistical-parity-report.json"
    parity_path.write_text(parity_path.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    assert any(
        "fingerprint is invalid" in item
        for item in verify_attestation(root, chain["parity"])
    )
    assert verify_attestation(root, Path("reports/run/missing.json"))


def test_nominal_evidence_enforcement_and_mutated_artifacts_block(tmp_path: Path) -> None:
    root = _workspace(tmp_path)
    chain = _proof_chain(root)
    source_identity = snapshot_identity(root)

    calibration_path = root / "reports/statistical-distribution-calibration.json"
    calibration = load_json(calibration_path)
    calibration_path.write_text(
        json.dumps(calibration, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    generated_paths = (
        "reports/test-execution-artifacts/main/generated.json",
        "frontend/coverage/coverage-final.json",
        "frontend/dist/asset-manifest.json",
        ".coverage.python.json",
        ".pytest_cache/v/cache/nodeids.json",
    )

    def generate_output(relative: str) -> dict[str, object]:
        _write_json(root / relative, {"generated": relative})
        return snapshot_identity(root)

    with ThreadPoolExecutor(max_workers=len(generated_paths)) as executor:
        parallel_identities = tuple(executor.map(generate_output, generated_paths))
    sequential_identities = tuple(snapshot_identity(root) for _ in range(3))
    assert all(identity == source_identity for identity in parallel_identities)
    assert all(identity == source_identity for identity in sequential_identities)
    for name in ("authority", "corpus", "protocol"):
        assert load_json(root / chain[name])["snapshot"] == source_identity

    authority_and_corpus = [chain["authority"], chain["corpus"]]
    assert enforce(
        root,
        "parity",
        Path("reports/statistical-parity-report.json"),
        Path("contracts/statistical-parity-report-v1.1.schema.json"),
        authority_and_corpus,
        ["deterministic_parity"],
    ) == ([], {"match"})
    assert enforce(
        root,
        "exact",
        Path("reports/statistical-exact-replay-evidence.json"),
        Path("contracts/statistical-exact-replay-evidence-v1.0.schema.json"),
        authority_and_corpus,
        ["exact_replay"],
    ) == ([], {"match"})
    assert enforce(
        root,
        "batching",
        Path("reports/statistical-exact-replay-evidence.json"),
        Path("contracts/statistical-exact-replay-evidence-v1.0.schema.json"),
        [*authority_and_corpus, chain["exact"]],
        ["batching_independence"],
    ) == ([], {"match"})
    assert enforce(
        root,
        "distribution",
        Path("reports/statistical-distribution-evidence.json"),
        Path("contracts/statistical-distribution-evidence-v1.0.schema.json"),
        [*authority_and_corpus, chain["protocol"]],
        ["distributional_parity"],
    ) == ([], {"match"})
    assert enforce(
        root,
        "compatibility",
        Path("reports/statistical-compatibility-evidence.json"),
        Path("contracts/statistical-compatibility-evidence-v1.0.schema.json"),
        [path for name, path in chain.items() if name != "compatibility"],
        ["statistical_compatibility"],
    ) == ([], {"match"})

    exact_path = root / "reports/statistical-exact-replay-evidence.json"
    exact = load_json(exact_path)
    exact["batching"]["independent"] = False
    _write_json(exact_path, exact)
    issues, statuses = enforce(
        root,
        "batching",
        Path("reports/statistical-exact-replay-evidence.json"),
        Path("contracts/statistical-exact-replay-evidence-v1.0.schema.json"),
        [*authority_and_corpus, chain["exact"]],
        ["batching_independence"],
    )
    assert issues and statuses == {"invalid_evidence"}


def test_main_plan_runs_each_logical_control_once_and_keeps_light_feedback_light() -> None:
    main_plan = quality_gate.build_execution_plan(
        quality_gate.build_change_context("ci", [], execution_profile="main")
    )
    steps = [command.step for command in main_plan.commands]
    producers = {
        "Generate deterministic statistical parity evidence": 1,
        "Generate exact replay and batching evidence": 1,
        "Generate distributional statistical parity evidence": 1,
        "Generate blocking statistical compatibility evidence": 1,
        "Generate current-run consolidated statistical report": 1,
        "Independently validate current-run consolidated statistical report": 1,
    }
    assert all(steps.count(step) == count for step, count in producers.items())
    assert all(steps.count(step) == 1 for step in producers)
    forbidden_bypass_tokens = ("--skip", "--retry", "quarantine", "continue-on-error")
    assert not any(
        token in " ".join(command.argv).lower()
        for command in main_plan.commands
        for token in forbidden_bypass_tokens
    )

    contract = load_json(ROOT / "config/test-execution-profiles.json")
    order = topological_node_ids(contract, "main")
    assert order.index("statistical-authorities") < order.index(
        "statistical-deterministic-parity"
    )
    assert order.index("statistical-compatibility") < order.index(
        "statistical-consolidated-report"
    )
    nodes = active_nodes(contract, "main")
    assert nodes["statistical-deterministic-parity"]["needs"] == [
        "statistical-authorities"
    ]
    assert nodes["statistical-exact-replay"]["needs"] == ["statistical-authorities"]
    assert nodes["statistical-distributional-parity"]["needs"] == [
        "statistical-authorities"
    ]

    for mode, paths in (("fast", ["README.md"]), ("push", ["backend/api.py"])):
        plan = quality_gate.build_execution_plan(quality_gate.build_change_context(mode, paths))
        assert not any("statistical" in command.step.lower() for command in plan.commands)


def test_cli_writes_nominal_attestations_and_reports_actionable_failures(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _workspace(tmp_path)
    authority = Path("reports/run/authority-cli.json")
    assert main(
        [
            "validate-authorities",
            "--root",
            str(root),
            "--output",
            str(authority),
        ]
    ) == 0
    assert verify_attestation(root, authority) == []

    assert main(
        [
            "validate-corpus",
            "--root",
            str(root),
            "--requires",
            str(authority),
            "--output",
            "reports/run/corpus-cli.json",
        ]
    ) == 0
    assert main(
        [
            "validate-protocol",
            "--root",
            str(root),
            "--requires",
            str(authority),
            "--output",
            "reports/run/protocol-cli.json",
        ]
    ) == 1
    error = capsys.readouterr().err
    assert "required attestations are missing controls" in error
    assert "Corrective action" in error
    assert "python Scripts/validate_statistical_distribution_protocol.py" in error

    corpus_path = root / "contracts/statistical-validation-probes-v1.0.json"
    probes = load_json(corpus_path)
    probes["schema_version"] = "broken"
    _write_json(corpus_path, probes)
    assert main(
        [
            "validate-corpus",
            "--root",
            str(root),
            "--requires",
            str(authority),
            "--output",
            "reports/run/broken-corpus-cli.json",
        ]
    ) == 1
    assert "python Scripts/validate_statistical_reference_corpus.py" in capsys.readouterr().err


def test_workspace_snapshot_is_read_only_and_cleans_after_interruption(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "source"
    source.mkdir()
    (source / "tracked.txt").write_text("snapshot", encoding="utf-8")
    subprocess.run(
        ["git", "init"], cwd=source, check=True, capture_output=True, text=True
    )
    subprocess.run(
        ["git", "add", "tracked.txt"],
        cwd=source,
        check=True,
        capture_output=True,
        text=True,
    )
    monkeypatch.setattr(quality_gate, "ROOT", source)
    snapshot_parent: Path | None = None
    with pytest.raises(KeyboardInterrupt):
        with quality_gate.workspace_snapshot() as snapshot:
            snapshot_parent = snapshot.parent
            git_environment = quality_gate._workspace_snapshot_git_environment(snapshot)
            assert Path(git_environment["GIT_DIR"]).resolve() == (source / ".git").resolve()
            assert Path(git_environment["GIT_WORK_TREE"]) == snapshot
            (snapshot / "tracked.txt").write_text("changed", encoding="utf-8")
            raise KeyboardInterrupt
    assert (source / "tracked.txt").read_text(encoding="utf-8") == "snapshot"
    assert snapshot_parent is not None and not snapshot_parent.exists()
