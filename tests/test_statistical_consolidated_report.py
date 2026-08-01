from __future__ import annotations

import json
import runpy
import shutil
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable

import pytest
from jsonschema import Draft202012Validator

from Scripts import generate_statistical_consolidated_report as generator
from Scripts import statistical_consolidated_diagnostics as diagnostic_module
from Scripts import statistical_consolidated_distribution_validation as distribution_validation
from Scripts import statistical_consolidated_exact_validation as exact_validation
from Scripts import statistical_consolidated_io as io_module
from Scripts import statistical_consolidated_parity_validation as parity_validation
from Scripts import statistical_consolidated_render as render_module
from Scripts import statistical_consolidated_sections as section_module
from Scripts import statistical_consolidated_validation as source_validation
from Scripts import statistical_consolidated_validation_common as validation_common
from Scripts import validate_statistical_consolidated_report as validator_cli
from Scripts.statistical_consolidated_diagnostics import (
    VERDICT_PRIORITY,
    consolidated_verdict,
)
from Scripts.statistical_consolidated_io import SOURCE_DEFINITIONS
from Scripts.statistical_consolidated_render import (
    finalize_report,
    render_json,
    render_markdown,
    verify_report_fingerprint,
)
from Scripts.statistical_consolidated_report import build_consolidated_report
from Scripts.statistical_consolidated_report_validation import validate_report
from Scripts.statistical_distribution_runner import _artifact_fingerprint

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads(
    (ROOT / "contracts/statistical-consolidated-report-v1.0.schema.json").read_text(
        encoding="utf-8"
    )
)


def _workspace(tmp_path: Path) -> Path:
    paths = {definition.path for definition in SOURCE_DEFINITIONS} | {
        definition.schema_path
        for definition in SOURCE_DEFINITIONS
        if definition.schema_path is not None
    }
    for relative in sorted(paths):
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, target)
    return tmp_path


def _json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _mutate(root: Path, relative: str, change: Callable[[dict[str, Any]], None]) -> None:
    path = root / relative
    value = _json(path)
    change(value)
    _write(path, value)


def _refresh_distribution_fingerprint(value: dict[str, Any]) -> None:
    value["stability"].pop("artifact_fingerprint", None)
    value["stability"]["artifact_fingerprint"] = _artifact_fingerprint(value)


def _exact_diagnostic(
    classification: str,
    engine: str,
    batch: int | None,
    comparison: str,
) -> dict[str, Any]:
    return {
        "case_id": "items-zero-weeks-excluded",
        "engine": engine,
        "batch_size": batch,
        "comparison": comparison,
        "classification": classification,
        "path": "/risk_score",
        "kind": classification,
        "expected": {"present": True, "type": "number", "value": 0.6667},
        "actual": {"present": True, "type": "number", "value": 0.5},
    }


def _make_exact_normative_divergence(value: dict[str, Any]) -> None:
    case = value["cases"][0]
    case["outcomes"] = ["normative_divergence"]
    case["typescript"] = {
        "status": "normative_divergence",
        "differences": [
            {
                "path": "/risk_score",
                "kind": "value_mismatch",
                "expected": 0.6667,
                "actual": 0.5,
            }
        ],
    }
    value["status"] = "divergence"
    value["summary"]["normative_matches"] -= 1
    value["diagnostics"] = [
        _exact_diagnostic("normative_divergence", "typescript", None, "normative")
    ]
    value["summary"]["diagnostic_count"] = 1


def _make_exact_interlanguage_divergence(value: dict[str, Any]) -> None:
    case = value["cases"][0]
    case["outcomes"] = ["interlanguage_divergence"]
    case["interlanguage"][0] = {
        "python_batch_size": 125,
        "status": "interlanguage_divergence",
        "differences": [
            {
                "path": "/risk_score",
                "kind": "value_mismatch",
                "python": {"present": True, "type": "number", "value": 0.5},
                "typescript": {"present": True, "type": "number", "value": 0.6667},
            }
        ],
    }
    value["status"] = "divergence"
    value["summary"]["interlanguage_matches"] -= 1
    value["diagnostics"] = [
        _exact_diagnostic("interlanguage_divergence", "python_vs_typescript", 125, "interlanguage")
    ]
    value["summary"]["diagnostic_count"] = 1


def _make_exact_engine_error(value: dict[str, Any]) -> None:
    case = value["cases"][0]
    case["outcomes"] = ["engine_error"]
    case["typescript"] = {
        "status": "engine_error",
        "error": {"type": "SyntheticError", "message": "synthetic engine failure"},
    }
    value["status"] = "engine_error"
    value["summary"]["normative_matches"] -= 1
    value["summary"]["engine_error_cases"] = 1
    diagnostic = _exact_diagnostic("engine_error", "typescript", None, "normative")
    diagnostic["actual"] = {
        "present": False,
        "error": {"type": "SyntheticError", "message": "synthetic engine failure"},
    }
    value["diagnostics"] = [diagnostic]
    value["summary"]["diagnostic_count"] = 1


def _make_distribution_result(value: dict[str, Any], verdict: str) -> None:
    metric = value["scenarios"][0]["metrics"][0]
    metric["verdict"] = verdict
    metric["equivalence_supported"] = False
    value["scenarios"][0]["verdict"] = verdict
    value["status"] = verdict
    value["summary"]["matches"] -= 1
    value["summary"]["divergences"] = int(verdict == "divergence")
    value["summary"]["inconclusive"] = int(verdict == "inconclusive")
    classification = (
        "distributional_divergence" if verdict == "divergence" else "statistically_inconclusive"
    )
    value["diagnostics"] = [
        {
            "classification": classification,
            "scenario_id": value["scenarios"][0]["id"],
            "metric_id": metric["id"],
            "message": f"Synthetic {verdict} result.",
        }
    ]
    _refresh_distribution_fingerprint(value)


def test_nominal_sources_schema_counters_scopes_and_limits_are_consolidated() -> None:
    report = finalize_report(build_consolidated_report())

    assert validate_report(report, SCHEMA) == []
    assert report["verdict"]["status"] == "match"
    assert report["summary"] == {
        "source_count": 10,
        "valid_source_count": 10,
        "invalid_source_count": 0,
        "proof_level_count": 5,
        "matching_proof_level_count": 5,
        "divergent_proof_level_count": 0,
        "inconclusive_proof_level_count": 0,
        "unavailable_proof_level_count": 0,
        "normative_case_count": 16,
        "validation_probe_count": 22,
        "distribution_scenario_count": 5,
        "distribution_metric_count": 49,
        "diagnostic_count": 0,
    }
    assert all(source["validation_status"] == "valid" for source in report["sources"])
    assert all(len(source["sha256"]) == 64 for source in report["sources"])
    assert len(report["scope_summary"]["normative_cases"]) == 16
    assert len(report["scope_summary"]["validation_probes"]) == 22
    assert len(report["limits"]) == 5
    assert {item["id"] for item in report["not_evaluated"]} == {
        "azure_devops_empirical_backtesting",
        "universal_equivalence",
        "future_version_compatibility",
        "blocking_main_enforcement",
    }


def test_json_markdown_and_sha_are_byte_stable_and_machine_independent() -> None:
    first = finalize_report(build_consolidated_report())
    second = finalize_report(build_consolidated_report())

    assert render_json(first).encode() == render_json(second).encode()
    assert render_markdown(first).encode() == render_markdown(second).encode()
    assert first["integrity"] == second["integrity"]
    assert verify_report_fingerprint(first)
    assert "C:\\" not in render_json(first)
    assert "generated_at" not in render_json(first)
    markdown = render_markdown(first)
    assert "ne devient jamais une preuve exacte" in markdown
    assert "backtesting empirique Azure DevOps" in markdown
    assert "PBI 2.21" in markdown


def test_closed_report_schema_and_independent_validator_reject_drift() -> None:
    report = finalize_report(build_consolidated_report())
    changed = deepcopy(report)
    changed["unexpected"] = True
    assert any("Additional properties" in issue for issue in validate_report(changed, SCHEMA))

    changed = deepcopy(report)
    changed["summary"]["diagnostic_count"] = 1
    changed["integrity"]["content_sha256"] = "0" * 64
    issues = validate_report(changed, SCHEMA)
    assert "/summary" in " ".join(issues)
    assert "/integrity/content_sha256" in " ".join(issues)


def test_missing_stale_corrupt_schema_and_fingerprint_sources_remain_visible(
    tmp_path: Path,
) -> None:
    missing = _workspace(tmp_path / "missing")
    (missing / "reports/statistical-exact-replay-evidence.json").unlink()
    missing_report = build_consolidated_report(missing)
    assert missing_report["verdict"]["status"] == "invalid_evidence"
    assert (
        next(source for source in missing_report["sources"] if source["id"] == "exact_replay")[
            "validation_status"
        ]
        == "missing"
    )

    stale = _workspace(tmp_path / "stale")
    _mutate(
        stale,
        "reports/statistical-exact-replay-evidence.json",
        lambda value: value.update(report_version="0.9"),
    )
    stale_report = build_consolidated_report(stale)
    assert any(item["code"] == "stale_source" for item in stale_report["diagnostics"])
    assert (
        next(source for source in stale_report["sources"] if source["id"] == "exact_replay")[
            "validation_status"
        ]
        == "stale"
    )

    corrupt = _workspace(tmp_path / "corrupt")
    (corrupt / "reports/statistical-parity-report.json").write_text("{", encoding="utf-8")
    corrupt_report = build_consolidated_report(corrupt)
    assert any(item["code"] == "source_corrupt" for item in corrupt_report["diagnostics"])

    schema_drift = _workspace(tmp_path / "schema")
    _mutate(
        schema_drift,
        "reports/statistical-parity-report.json",
        lambda value: value.update(unexpected=True),
    )
    schema_report = build_consolidated_report(schema_drift)
    assert any(item["code"] == "schema_violation" for item in schema_report["diagnostics"])

    fingerprint = _workspace(tmp_path / "fingerprint")
    _mutate(
        fingerprint,
        "reports/statistical-distribution-evidence.json",
        lambda value: value["scenarios"][0]["metrics"][0]["observed"].update(effect=0.5),
    )
    fingerprint_report = build_consolidated_report(fingerprint)
    assert any(item["code"] == "fingerprint_invalid" for item in fingerprint_report["diagnostics"])


def test_version_incompatibility_and_protocol_error_are_not_functional_divergence(
    tmp_path: Path,
) -> None:
    incompatible = _workspace(tmp_path / "incompatible")

    def change_exact(value: dict[str, Any]) -> None:
        value["corpus"]["normative_contract"]["version"] = "2.0"

    _mutate(incompatible, "reports/statistical-exact-replay-evidence.json", change_exact)
    report = build_consolidated_report(incompatible)
    assert report["verdict"]["status"] == "version_incompatibility"
    assert "normative_divergence" not in report["verdict"]["observed_classifications"]

    protocol = _workspace(tmp_path / "protocol")
    _mutate(
        protocol,
        "contracts/statistical-distribution-protocol-v1.0.json",
        lambda value: value["scenarios"][1].update(id=value["scenarios"][0]["id"]),
    )
    protocol_report = build_consolidated_report(protocol)
    assert protocol_report["verdict"]["status"] == "protocol_error"
    assert any(
        item["classification"] == "protocol_error" for item in protocol_report["diagnostics"]
    )


@pytest.mark.parametrize(
    ("mutation", "expected"),
    [
        (_make_exact_normative_divergence, "normative_divergence"),
        (_make_exact_interlanguage_divergence, "interlanguage_divergence"),
        (_make_exact_engine_error, "engine_error"),
    ],
)
def test_exact_specialized_outcomes_remain_localized(
    tmp_path: Path,
    mutation: Callable[[dict[str, Any]], None],
    expected: str,
) -> None:
    root = _workspace(tmp_path)
    _mutate(root, "reports/statistical-exact-replay-evidence.json", mutation)
    report = build_consolidated_report(root)

    assert report["verdict"]["status"] == expected
    diagnostic = next(item for item in report["diagnostics"] if item["classification"] == expected)
    assert diagnostic["source"] == "exact_replay"
    assert diagnostic["case_id"] == "items-zero-weeks-excluded"
    assert diagnostic["json_path"] == "/risk_score"
    assert diagnostic["expected"] != diagnostic["actual"]


@pytest.mark.parametrize(
    ("specialized", "expected"),
    [
        ("divergence", "distributional_divergence"),
        ("inconclusive", "statistically_inconclusive"),
    ],
)
def test_distributional_divergence_and_inconclusive_never_become_exact_match(
    tmp_path: Path, specialized: str, expected: str
) -> None:
    root = _workspace(tmp_path)
    _mutate(
        root,
        "reports/statistical-distribution-evidence.json",
        lambda value: _make_distribution_result(value, specialized),
    )
    report = build_consolidated_report(root)

    assert report["verdict"]["status"] == expected
    assert (
        next(
            level for level in report["proof_levels"] if level["id"] == "exact_interlanguage_replay"
        )["status"]
        == "match"
    )
    diagnostic = next(item for item in report["diagnostics"] if item["classification"] == expected)
    assert diagnostic["metric"] == "outcome_cdf"
    assert diagnostic["threshold"] == 0.025
    assert diagnostic["cohort"]["size"] == 64


def test_verdict_priority_is_explicit_deterministic_and_non_compensating() -> None:
    assert consolidated_verdict(["match", "statistically_inconclusive"]) == (
        "statistically_inconclusive"
    )
    assert (
        consolidated_verdict(["distributional_divergence", "interlanguage_divergence"])
        == "interlanguage_divergence"
    )
    assert (
        consolidated_verdict(["normative_divergence", "version_incompatibility", "engine_error"])
        == "version_incompatibility"
    )
    assert consolidated_verdict(list(reversed(VERDICT_PRIORITY))) == "infrastructure_error"


def test_infrastructure_failure_is_separate_and_generator_fails_but_writes_valid_findings(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = _workspace(tmp_path)
    original = Path.read_bytes

    def fail_selected(path: Path) -> bytes:
        if path.name == "statistical-parity-report.json":
            raise PermissionError("synthetic access denial")
        return original(path)

    monkeypatch.setattr(Path, "read_bytes", fail_selected)
    report = build_consolidated_report(root)
    assert report["verdict"]["status"] == "infrastructure_error"
    assert any(item["code"] == "source_unreadable" for item in report["diagnostics"])

    monkeypatch.undo()
    (root / "reports/statistical-exact-replay-evidence.json").unlink()
    generated, issues = generator.run_control(root=root)
    assert issues == []
    assert generated is not None
    assert generator.main(["--root", str(root)]) == 1
    assert (root / "reports/statistical-consolidated-report.json").is_file()


def test_generator_validator_and_entrypoints_publish_both_views_from_one_model(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    root = _workspace(tmp_path)
    report, issues = generator.run_control(root=root)
    assert issues == [] and report is not None
    json_path = root / "reports/statistical-consolidated-report.json"
    markdown_path = root / "reports/statistical-consolidated-report.md"
    assert json_path.read_text(encoding="utf-8") == render_json(report)
    assert markdown_path.read_text(encoding="utf-8") == render_markdown(report)
    assert (
        validator_cli.run_control(
            json_path,
            ROOT / "contracts/statistical-consolidated-report-v1.0.schema.json",
            markdown_path,
        )[1]
        == []
    )
    assert generator.main(["--root", str(root)]) == 0
    assert validator_cli.main(["--report", str(json_path), "--markdown", str(markdown_path)]) == 0
    assert "verdict=match" in capsys.readouterr().out

    markdown_path.write_text("drift\n", encoding="utf-8")
    assert validator_cli.main(["--report", str(json_path), "--markdown", str(markdown_path)]) == 1
    assert "invalide" in capsys.readouterr().err

    monkeypatch.setattr(generator, "run_control", lambda **_kwargs: (None, ["synthetic failure"]))
    assert generator.main([]) == 1
    assert "synthetic failure" in capsys.readouterr().err


def test_invalid_standard_identity_seed_fingerprint_and_schema_infrastructure_are_visible(
    tmp_path: Path,
) -> None:
    standard = _workspace(tmp_path / "standard")
    path = standard / "docs/standards/STD-STAT-001.md"
    path.write_text(
        path.read_text(encoding="utf-8").replace("**Version :** 1.0", "**Version :** 2.0"),
        encoding="utf-8",
    )
    assert build_consolidated_report(standard)["verdict"]["status"] == "version_incompatibility"

    identity = _workspace(tmp_path / "identity")
    _mutate(
        identity,
        "contracts/mca-prng-v1-vectors.json",
        lambda value: value.update(contractId="other-prng"),
    )
    assert build_consolidated_report(identity)["verdict"]["status"] == "version_incompatibility"

    seeds = _workspace(tmp_path / "seeds")
    _mutate(
        seeds,
        "contracts/statistical-distribution-seeds-v1.0.json",
        lambda value: value.update(population_fingerprint="0" * 64),
    )
    seed_report = build_consolidated_report(seeds)
    assert seed_report["verdict"]["status"] == "invalid_evidence"
    assert (
        next(
            source
            for source in seed_report["sources"]
            if source["id"] == "distribution_seed_population"
        )["fingerprint_valid"]
        is False
    )

    schema = _workspace(tmp_path / "bad-schema")
    (schema / "contracts/statistical-parity-report-v1.1.schema.json").write_text(
        "[]", encoding="utf-8"
    )
    assert any(
        item["code"] == "schema_invalid"
        for item in build_consolidated_report(schema)["diagnostics"]
    )


def test_report_validator_detects_source_set_priority_and_diagnostic_order_drift() -> None:
    report = finalize_report(build_consolidated_report())
    report["generation"]["source_set_sha256"] = "0" * 64
    report["verdict"]["priority_order"] = list(reversed(VERDICT_PRIORITY))
    report["integrity"]["content_sha256"] = "0" * 64
    issues = validate_report(report, SCHEMA)
    assert any("source-set" in issue for issue in issues)
    assert any("priority" in issue for issue in issues)

    diagnostic_report = deepcopy(report)
    diagnostic_report["diagnostics"] = [
        {
            "source": "z",
            "classification": "normative_divergence",
            "code": "z",
            "message": "z",
            "consequence": "contributes_to_consolidated_verdict",
        },
        {
            "source": "a",
            "classification": "infrastructure_error",
            "code": "a",
            "message": "a",
            "consequence": "generator_failure",
        },
    ]
    diagnostic_report["summary"]["diagnostic_count"] = 2
    assert any("ordered" in issue for issue in validate_report(diagnostic_report, SCHEMA))


def test_renderer_handles_unavailable_distribution_and_false_batch_value(tmp_path: Path) -> None:
    root = _workspace(tmp_path)
    (root / "reports/statistical-distribution-evidence.json").unlink()
    report = finalize_report(build_consolidated_report(root))
    markdown = render_markdown(report)
    assert "Aucun scénario exploitable" in markdown
    assert "Diagnostics structurés" in markdown


def test_validator_and_generator_report_unreadable_inputs(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    report, issues = generator.run_control(root=tmp_path, schema_path=tmp_path / "missing.json")
    assert report is None and issues
    assert validator_cli.run_control(tmp_path / "missing.json")[0] is None
    assert validator_cli.main(["--report", str(tmp_path / "missing.json")]) == 1
    assert "invalide" in capsys.readouterr().err


def test_script_entrypoints_delegate_to_main(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["generate_statistical_consolidated_report.py", "--help"])
    with pytest.raises(SystemExit, match="0"):
        runpy.run_path(
            str(ROOT / "Scripts/generate_statistical_consolidated_report.py"),
            run_name="__main__",
        )
    monkeypatch.setattr(sys, "argv", ["validate_statistical_consolidated_report.py", "--help"])
    with pytest.raises(SystemExit, match="0"):
        runpy.run_path(
            str(ROOT / "Scripts/validate_statistical_consolidated_report.py"),
            run_name="__main__",
        )


def test_report_schema_is_itself_valid() -> None:
    Draft202012Validator.check_schema(SCHEMA)


def test_specialized_diagnostic_adapters_preserve_every_available_location() -> None:
    records, _ = io_module.load_sources()
    parity = records["deterministic_parity"]
    case = parity.data["cases"][0]
    case["python"] = {
        "status": "engine_error",
        "error": {"type": "SyntheticError", "message": "engine"},
    }
    case["typescript"] = {
        "status": "normative_divergence",
        "differences": [
            {
                "path": "/risk_score",
                "kind": "value_mismatch",
                "expected": 0.6667,
                "actual": 0.5,
            }
        ],
    }
    case["inter_engine"] = {
        "status": "engine_divergence",
        "differences": [{"path": "/seed", "kind": "value_mismatch"}],
    }
    validation = parity.data["validation_alignment"]
    validation["cases"][0]["status"] = "divergence"
    validation["engines"]["python"] = {
        "engine": "python",
        "status": "engine_error",
        "error": {"type": "SyntheticError", "message": "validation"},
    }

    diagnostics = diagnostic_module.parity_diagnostics(parity)
    assert {item["classification"] for item in diagnostics} == {
        "engine_error",
        "normative_divergence",
        "interlanguage_divergence",
    }
    assert any(item.get("fixture_id") == "backlog-inclusive-minima" for item in diagnostics)
    assert any(item.get("engine") == "python_vs_typescript" for item in diagnostics)
    assert diagnostic_module._metric_by_id(
        records["distribution_evidence"], "missing", "missing"
    ) == (None, None)


def test_all_semantic_inconsistency_guards_are_actionable() -> None:
    records, _ = io_module.load_sources()
    corpus = records["reference_corpus"].data
    probes = records["validation_probes"].data

    probe_record = records["validation_probes"]
    probe_record.data["cases"] = probe_record.data["cases"][:-1]
    probe_record.data["cases"][1]["id"] = probe_record.data["cases"][0]["id"]
    probe_issues = source_validation._validate_probes(probe_record)
    assert len(probe_issues) == 2

    parity = deepcopy(records["deterministic_parity"].data)
    parity["cases"][0]["id"] = "other-case"
    parity["summary"]["case_count"] = 999
    parity["validation_alignment"]["cases"][0]["id"] = "other-probe"
    parity["validation_alignment"]["summary"]["probe_count"] = 999
    parity["status"] = "engine_error"
    parity_issues = parity_validation.parity_internal_issues(parity, corpus, probes)
    assert {path for path, _message in parity_issues} >= {
        "/cases",
        "/summary",
        "/validation_alignment/cases",
        "/validation_alignment/summary",
        "/status",
    }
    parity["summary"]["engine_error_cases"] = 1
    assert parity_validation.parity_status(parity) == "engine_error"
    parity["summary"]["engine_error_cases"] = 0
    parity["summary"]["normative_divergence_cases"] = 1
    assert parity_validation.parity_status(parity) == "divergence"

    exact = deepcopy(records["exact_replay"].data)
    exact["cases"][0]["id"] = "other-case"
    exact["cases"][0]["python_batches"].pop()
    exact["cases"][0]["interlanguage"].pop()
    exact["cases"][1]["batch_independent"] = False
    exact["batching"]["independent"] = True
    exact["summary"]["case_count"] = 999
    exact["status"] = "engine_error"
    exact["coverage"] = {}
    exact_issues = exact_validation.exact_internal_issues(exact, corpus)
    assert {path for path, _message in exact_issues} >= {
        "/cases",
        "/summary",
        "/status",
        "/coverage",
    }

    calibration = records["distribution_calibration"]
    calibration.data["repetitions"] = 199
    assert (
        distribution_validation.validate_calibration(calibration, records["distribution_protocol"])[
            0
        ]["classification"]
        == "version_incompatibility"
    )

    evidence = deepcopy(records["distribution_evidence"].data)
    evidence["protocol"]["version"] = "2.0"
    assert not distribution_validation.distribution_protocol_alignment(
        evidence, records["distribution_protocol"].data
    )
    evidence = deepcopy(records["distribution_evidence"].data)
    evidence["inference"] = {}
    assert not distribution_validation.distribution_protocol_alignment(
        evidence, records["distribution_protocol"].data
    )
    records["distribution_evidence"].data["seed_population"]["fingerprint"] = "0" * 64
    records["distribution_evidence"].data["inference"] = {}
    distribution_issues = distribution_validation.validate_distribution(
        records["distribution_evidence"],
        records["distribution_protocol"],
        records["distribution_seed_population"],
    )
    assert any(item["code"] == "protocol_incompatibility" for item in distribution_issues)
    assert any(item["code"] == "seed_population_incompatibility" for item in distribution_issues)
    direct = validation_common.diagnostic(
        records["deterministic_parity"],
        "infrastructure_error",
        "synthetic",
        "synthetic",
    )
    assert direct["classification"] == "infrastructure_error"


def test_proof_section_status_branches_and_small_io_helpers(tmp_path: Path) -> None:
    records, diagnostics = io_module.load_sources()
    parity = records["deterministic_parity"]
    for key, expected in (
        ("engine_error_cases", "engine_error"),
        ("normative_divergence_cases", "normative_divergence"),
        ("engine_divergence_cases", "interlanguage_divergence"),
    ):
        original = parity.data["summary"][key]
        parity.data["summary"][key] = 1
        assert section_module._parity_level(parity, diagnostics) == expected
        parity.data["summary"][key] = original

    exact = records["exact_replay"]
    first_batch = exact.data["cases"][0]["python_batches"][0]
    first_batch["status"] = "engine_error"
    assert section_module._batch_level(exact, diagnostics) == "engine_error"
    first_batch["status"] = "normative_divergence"
    assert section_module._batch_level(exact, diagnostics) == "normative_divergence"

    distribution = records["distribution_evidence"]
    distribution.data["status"] = "invalid"
    distribution.data["error_classification"] = "infrastructure_error"
    assert section_module._distribution_level(distribution, diagnostics) == ("infrastructure_error")

    duplicate = _workspace(tmp_path / "duplicate")
    (duplicate / "contracts/mca-prng-v1-vectors.json").write_text(
        '{"contractId":"mca-prng-v1","contractId":"duplicate","version":1}',
        encoding="utf-8",
    )
    assert any(
        item["code"] == "source_corrupt"
        for item in build_consolidated_report(duplicate)["diagnostics"]
    )

    non_object = _workspace(tmp_path / "non-object")
    (non_object / "contracts/mca-prng-v1-vectors.json").write_text("[]", encoding="utf-8")
    assert build_consolidated_report(non_object)["verdict"]["status"] == ("version_incompatibility")

    incompatible = _workspace(tmp_path / "version")
    _mutate(
        incompatible,
        "contracts/mca-prng-v1-vectors.json",
        lambda value: value.update(version=2),
    )
    assert any(
        item["code"] == "version_incompatibility"
        for item in build_consolidated_report(incompatible)["diagnostics"]
    )
    assert render_module._optional(7) == "7"
    assert not render_module.verify_report_fingerprint({})


def test_generator_rejects_a_non_object_report_schema(tmp_path: Path) -> None:
    root = _workspace(tmp_path)
    schema = tmp_path / "schema.json"
    schema.write_text("[]", encoding="utf-8")
    report, issues = generator.run_control(root=root, schema_path=schema)
    assert report is None
    assert "must be an object" in issues[0]


def test_documentation_and_backlog_preserve_scope_and_informational_enforcement() -> None:
    consolidation = (ROOT / "docs/statistical-consolidated-report.md").read_text(encoding="utf-8")
    architecture = (ROOT / "ARCHITECTURE.md").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    documentation_map = (ROOT / "docs/README.md").read_text(encoding="utf-8")
    critical_paths = (ROOT / "docs/critical-paths.md").read_text(encoding="utf-8")
    risks = (ROOT / "docs/risk-control-matrix.md").read_text(encoding="utf-8")
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    expectations = (ROOT / "docs/backlog-expectations/feature-02-statistical-core.md").read_text(
        encoding="utf-8"
    )
    backlog = (ROOT / "docs/backlog.md").read_text(encoding="utf-8")
    consolidation_text = " ".join(consolidation.split())

    assert "ne recalcule aucun résultat statistique d’autorité" in consolidation_text
    assert "ne devient jamais une preuve exacte" in consolidation_text
    assert "L’enforcement complet dans\n`main` appartient au PBI 2.21" in consolidation
    assert "Consolidation des preuves statistiques" in architecture
    assert "État consolidé vérifiable" in readme
    assert "statistical-consolidated-report.md" in documentation_map
    assert "reports/statistical-consolidated-report.json" in critical_paths
    assert "Le rapport consolidé vérifie 10 sources" in risks
    assert "Rapport consolidé de conformité statistique — PBI 2.19" in changelog
    assert "dix sources spécialisées" in expectations
    assert (
        "| 2.19 | Rapport consolidé de parité déterministe, exacte et distributionnelle "
        "disponible | M | Sol Très élevé | 01/08/2026 |"
    ) in backlog
