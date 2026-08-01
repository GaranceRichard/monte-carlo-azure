from __future__ import annotations

import json
import runpy
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from Scripts import calibrate_statistical_distribution as calibration_cli
from Scripts import run_statistical_distribution as distribution_control
from Scripts import statistical_distribution_calibration as calibration
from Scripts import statistical_distribution_evidence as evidence_validation
from Scripts import statistical_distribution_metrics as metrics
from Scripts import statistical_distribution_protocol as protocol_validation
from Scripts import statistical_distribution_runner as runner
from Scripts import statistical_distribution_statistics as statistics
from Scripts import validate_statistical_distribution_calibration as calibration_validator_cli
from Scripts import validate_statistical_distribution_evidence as evidence_cli
from Scripts import validate_statistical_distribution_protocol as protocol_cli


def _bundle() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    return protocol_validation.validate_protocol_bundle()


def _fast_protocol() -> dict[str, Any]:
    protocol, _seeds, _corpus = _bundle()
    candidate = deepcopy(protocol)
    candidate["inference"]["permutations"] = 3
    candidate["inference"]["equivalence_margins"] = {
        "pooled_cdf": 1.0,
        "pooled_rate": 1.0,
        "cohort_rate": 1.0,
        "conditional_cdf": 1.0,
    }
    return candidate


def _result(reference: dict[str, Any]) -> dict[str, Any]:
    count = reference["input"]["n_sims"]
    result: dict[str, Any] = {
        "result_kind": reference["input"]["mode"],
        "result_percentiles": {"P50": 1, "P70": 1, "P90": 1},
        "risk_score": 0,
        "result_distribution": [{"x": 1, "count": count}],
        "samples_count": len(reference["input"]["throughput_samples"]),
        "throughput_reliability": {
            "cv": 0,
            "iqr_ratio": 0,
            "slope_norm": 0,
            "label": "fiable",
            "samples_count": len(reference["input"]["throughput_samples"]),
        },
        "seed": reference["seed"],
    }
    if reference["input"]["mode"] == "backlog_to_weeks":
        result["completion_summary"] = {
            "completed_count": count,
            "censored_count": 0,
            "censored_rate": 0,
            "horizon_weeks": 521,
        }
    return result


def _engine_report(plan: dict[str, Any], engine: str) -> dict[str, Any]:
    return {
        "engine": engine,
        "proof_kind": plan["proof_kind"],
        "protocol_version": plan["protocol_version"],
        "cohort_id": plan["cohort_id"],
        "corpus_id": plan["corpus_id"],
        "schema_version": plan["schema_version"],
        "normative_contract": deepcopy(plan["normative_contract"]),
        "prng_contract": plan["prng_contract"]["id"],
        "status": "completed",
        "cases": [
            {"id": case["id"], "status": "ok", "result": _result(case)}
            for case in plan["cases"]
        ],
    }


def _write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value), encoding="utf-8")


def test_closed_protocol_seed_population_and_schema_are_independently_valid() -> None:
    protocol, seeds, corpus = _bundle()

    assert protocol["version"] == "1.0"
    assert len(protocol["scenarios"]) == 5
    assert protocol["cohort_assignment"]["same_seed_pairing"] is False
    cohorts = protocol_validation.partitioned_seeds(seeds)
    assert len(cohorts["cohort-a"]) == len(cohorts["cohort-b"]) == 128
    assert set(cohorts["cohort-a"]).isdisjoint(cohorts["cohort-b"])
    assert len(set(protocol_validation.generate_seed_population(seeds))) == 256
    assert protocol_validation.protocol_semantic_issues(protocol, corpus, seeds) == ([], [])

    schema = protocol_validation.load_json(protocol_validation.PROTOCOL_SCHEMA_PATH)
    invalid = deepcopy(protocol)
    invalid["hidden_tolerance"] = True
    issues = protocol_validation.schema_issues(invalid, schema, "protocole")
    assert "Additional properties are not allowed" in issues[0]
    assert protocol_validation.schema_issues({}, {"type": 7}, "cassé")[0].startswith(
        "Schéma cassé invalide"
    )


def test_json_loading_and_protocol_bundle_fail_explicitly(tmp_path: Path) -> None:
    missing = tmp_path / "missing.json"
    with pytest.raises(protocol_validation.ProtocolBundleError) as unreadable:
        protocol_validation.load_json(missing)
    assert unreadable.value.classification == "protocol_error"

    malformed = tmp_path / "malformed.json"
    malformed.write_text("{", encoding="utf-8")
    with pytest.raises(protocol_validation.ProtocolBundleError) as invalid_json:
        protocol_validation.load_json(malformed)
    assert "JSON invalide" in invalid_json.value.diagnostics[0]

    protocol, seeds, corpus = _bundle()
    invalid_protocol = deepcopy(protocol)
    invalid_protocol["version"] = "2.0"
    protocol_path = tmp_path / "protocol.json"
    _write_json(protocol_path, invalid_protocol)
    with pytest.raises(protocol_validation.ProtocolBundleError) as structural:
        protocol_validation.validate_protocol_bundle(protocol_path=protocol_path)
    assert structural.value.classification == "protocol_error"

    incompatible = deepcopy(corpus)
    incompatible["normative_contract"]["version"] = "2.0"
    corpus_path = tmp_path / "corpus.json"
    _write_json(corpus_path, incompatible)
    with pytest.raises(protocol_validation.ProtocolBundleError) as version:
        protocol_validation.validate_protocol_bundle(corpus_path=corpus_path)
    assert version.value.classification == "version_incompatibility"

    bad_seeds = deepcopy(seeds)
    bad_seeds["population_fingerprint"] = "0" * 64
    seeds_path = tmp_path / "seeds.json"
    _write_json(seeds_path, bad_seeds)
    with pytest.raises(protocol_validation.ProtocolBundleError) as semantic:
        protocol_validation.validate_protocol_bundle(seeds_path=seeds_path)
    assert "population de seeds" in semantic.value.diagnostics[0]


def test_protocol_semantics_report_every_non_structural_fault() -> None:
    protocol, seeds, corpus = _bundle()
    candidate = deepcopy(protocol)
    candidate["scenarios"][1]["id"] = candidate["scenarios"][0]["id"]
    candidate["scenarios"][0]["source_case_id"] = "absent"
    candidate["scenarios"][1]["mode"] = "backlog_to_weeks"
    candidate["scenarios"][2]["cohort_size"] = 999
    candidate["scenarios"] = [
        scenario
        for scenario in candidate["scenarios"]
        if scenario["distribution_view"] != "structural-censor-state"
    ]
    candidate["scenarios"] = [
        {**scenario, "mode": "weeks_to_items"} for scenario in candidate["scenarios"]
    ]
    candidate["inference"]["permutations"] = 1
    bad_seeds = deepcopy(seeds)
    bad_seeds["partitions"][0]["fingerprint"] = "0" * 64
    bad_seeds["partitions"][1]["offset"] = 127

    _versions, issues = protocol_validation.protocol_semantic_issues(
        candidate, corpus, bad_seeds,
    )

    joined = " ".join(issues)
    assert "empreinte de cohort-a" in joined
    assert "contiguës" in joined
    assert "identifiants" in joined
    assert "cas source absent" in joined
    assert "mode divergent" in joined
    assert "hors population" in joined
    assert "deux modes" in joined
    assert "censure structurelle" in joined
    assert "permutations" in joined


def test_seed_collision_guard_and_population_fingerprint_diagnostics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _protocol, seeds, _corpus = _bundle()
    duplicate = deepcopy(seeds)
    monkeypatch.setattr(
        protocol_validation,
        "generate_seed_population",
        lambda _document: [1] * 256,
    )
    issues = protocol_validation.seed_semantic_issues(duplicate)
    assert "population unique" in issues[0]
    assert "population de seeds" in issues[1]
    assert any("cohort-b" in issue for issue in issues)


def test_statistical_primitives_cover_discrete_rates_permutations_and_decisions() -> None:
    left = [{1.0: 2, 2.0: 1}, {2.0: 1}]
    right = [{1.0: 1, 2.0: 3}, {2.0: 1}]
    assert statistics.pooled_counts(left) == {1.0: 2, 2.0: 2}
    assert statistics.ks_distance({}, {1.0: 1}) == 1
    assert statistics.ks_distance({1.0: 1}, {1.0: 1}) == 0
    assert statistics.dkw_radius(0, 1, 0.05) == 1
    assert 0 < statistics.dkw_radius(100, 100, 0.05) < 1
    assert statistics.wilson_interval(0, 0, 0.05) == (0, 1)
    assert statistics.wilson_interval(5, 10, 0.05)[0] < 0.5
    assert statistics.rate_difference_interval((5, 10), (4, 10), 0.05)[0] < 0.1
    assert statistics.rate_block_effect([(0, 0)], [(0, 1)]) == 1
    assert statistics.count_block_effect(left, right) > 0
    p_value = statistics.permutation_p_value(
        left,
        right,
        statistics.count_block_effect,
        permutations=7,
        seed=1,
    )
    assert 0 < p_value <= 1

    count_metric = statistics.compare_count_blocks(
        "cdf", left, right, alpha=0.05, margin=1, permutations=7, seed=2,
    )
    rate_metric = statistics.compare_rate_blocks(
        "rate", [(5, 10), (4, 10)], [(5, 10), (5, 10)],
        alpha=0.05, margin=1, permutations=7, seed=3,
    )
    mismatch = statistics.exact_metric("exact", [1], [2])
    match = statistics.exact_metric("same", [1], [1])
    undecided = {
        "id": "gray",
        "observed": {"effect": 0.2},
        "equivalence_margin": 0.1,
        "equivalence_supported": False,
        "raw_p_value": 1.0,
    }
    divergent = {
        "id": "different",
        "observed": {"effect": 1.0},
        "equivalence_margin": 0.1,
        "equivalence_supported": False,
        "raw_p_value": 0.0001,
    }
    family = [count_metric, rate_metric, mismatch, match, undecided, divergent]
    statistics.holm_adjust(family, 0.05)
    assert [metric["verdict"] for metric in family] == [
        "match",
        "match",
        "divergence",
        "match",
        "inconclusive",
        "divergence",
    ]
    assert statistics.aggregate_verdict([]) == "inconclusive"
    assert statistics.aggregate_verdict(["match"]) == "match"
    assert statistics.aggregate_verdict(["match", "inconclusive"]) == "inconclusive"
    assert statistics.aggregate_verdict(["match", "divergence"]) == "divergence"


def test_metric_extraction_covers_censoring_absence_and_all_metric_kinds() -> None:
    result = {
        "result_distribution": [{"x": 1, "count": 8}],
        "completion_summary": {
            "completed_count": 8,
            "censored_count": 2,
            "censored_rate": 0.2,
            "horizon_weeks": 521,
        },
        "result_percentiles": {"P50": 1},
        "risk_score": 0.1,
        "throughput_reliability": {"label": "fiable"},
    }
    assert metrics.outcome_block(result) == {1.0: 8, 522.0: 2}
    without_completion = deepcopy(result)
    del without_completion["completion_summary"]
    assert metrics.outcome_block(without_completion) == {1.0: 8}
    assert metrics.presence_blocks([result], "result_percentiles", "P90") == [(0, 1)]
    assert metrics.presence_blocks([result], "risk_score") == [(1, 1)]
    assert metrics.value_blocks([result], "result_percentiles", "P50") == [{1.0: 1}]
    assert metrics.value_blocks([result], "result_percentiles", "P90") == []
    assert metrics.scenario_results(
        {"cases": [{"id": "a:0", "result": result}, {"id": "b:0", "result": {}}]},
        "a",
    ) == [result]

    inference = deepcopy(_fast_protocol()["inference"])
    assert metrics.compare_values(
        "absent", [], [], inference=inference, alpha=0.05, seed=1,
    )["kind"] == "exact_structural"
    assert metrics.compare_values(
        "weak", [{1.0: 1}], [], inference=inference, alpha=0.05, seed=1,
    )["diagnostic"].startswith("Observations")
    assert metrics.insufficient_metric("x", 1, 2, 0.5)["sample_sizes"]["typescript"] == 2

    many = [deepcopy(result) for _ in range(8)]
    common = {"inference": inference, "alpha": 0.05, "seed": 3}
    for metric_id in (
        "outcome_cdf",
        "censored_rate",
        "completion_count",
        "P50_presence",
        "risk_score_presence",
        "P50_values",
        "risk_score_values",
        "throughput_reliability",
    ):
        compared = metrics.inferential_metric(metric_id, many, many, **common)
        assert compared["observed"]["effect"] == 0

    scenario = {
        "metrics": [
            "outcome_cdf",
            "censored_rate",
            "P50_presence",
            "risk_score_presence",
            "throughput_reliability",
        ]
    }
    structural = metrics.structural_metrics(scenario, many, many)
    assert all(metric["equivalence_supported"] for metric in structural)


def test_execution_plans_are_disjoint_and_engine_protocol_is_strict() -> None:
    protocol, seeds, corpus = _bundle()
    python_plan = runner.build_execution_plan(protocol, seeds, corpus, "python")
    typescript_plan = runner.build_execution_plan(protocol, seeds, corpus, "typescript")
    assert python_plan["cohort_id"] == "cohort-a"
    assert typescript_plan["cohort_id"] == "cohort-b"
    assert {case["seed"] for case in python_plan["cases"]}.isdisjoint(
        {case["seed"] for case in typescript_plan["cases"]}
    )
    assert "expected_result" not in json.dumps(python_plan)

    report = _engine_report(python_plan, "python")
    runner.validate_engine_report(report, python_plan, "python")
    for mutate, expected in (
        (lambda value: value.__setitem__("cohort_id", "bad"), "Header"),
        (lambda value: value.__setitem__("cases", {}), "liste de cas"),
        (lambda value: value["cases"].reverse(), "ordre"),
        (lambda value: value["cases"][0].__setitem__("status", "engine_error"), "échoué"),
    ):
        invalid = deepcopy(report)
        mutate(invalid)
        with pytest.raises(runner.EngineExecutionError, match=expected):
            runner.validate_engine_report(invalid, python_plan, "python")
    fatal = deepcopy(report)
    fatal["status"] = "engine_error"
    fatal["error"] = {"type": "RuntimeError"}
    with pytest.raises(runner.EngineExecutionError, match="échoué"):
        runner.validate_engine_report(fatal, python_plan, "python")


def test_python_plan_and_typescript_bridge_error_classification(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    protocol, seeds, corpus = _bundle()
    plan = runner.build_execution_plan(protocol, seeds, corpus, "python")
    plan["cases"] = plan["cases"][:1]
    python_report = runner.run_python_plan(plan)
    assert python_report["proof_kind"] == "distributional_parity"
    assert python_report["cases"][0]["status"] == "ok"

    monkeypatch.setattr(runner.shutil, "which", lambda _name: None)
    with pytest.raises(runner.InfrastructureError, match="introuvable"):
        runner.run_typescript_plan(plan)

    monkeypatch.setattr(runner.shutil, "which", lambda _name: "node")

    def os_error(*_args: Any, **_kwargs: Any) -> Any:
        raise OSError("blocked")

    monkeypatch.setattr(runner.subprocess, "run", os_error)
    with pytest.raises(runner.InfrastructureError, match="inexécutable"):
        runner.run_typescript_plan(plan)

    class Completed:
        returncode = 1
        stderr = "failed"
        stdout = ""

    monkeypatch.setattr(runner.subprocess, "run", lambda *_args, **_kwargs: Completed())
    with pytest.raises(runner.InfrastructureError, match="a échoué"):
        runner.run_typescript_plan(plan)

    Completed.returncode = 0
    Completed.stderr = ""
    Completed.stdout = "not-json"
    with pytest.raises(runner.InfrastructureError, match="JSON invalide"):
        runner.run_typescript_plan(plan)
    Completed.stdout = "[]"
    with pytest.raises(runner.InfrastructureError, match="objet JSON"):
        runner.run_typescript_plan(plan)
    Completed.stdout = json.dumps(_engine_report(plan, "typescript"))
    assert runner.run_typescript_plan(plan)["engine"] == "typescript"


def test_evidence_supports_match_divergence_inconclusive_and_invalid(tmp_path: Path) -> None:
    protocol, seeds, corpus = _bundle()
    protocol = _fast_protocol()
    python_plan = runner.build_execution_plan(protocol, seeds, corpus, "python")
    typescript_plan = runner.build_execution_plan(protocol, seeds, corpus, "typescript")
    python_report = _engine_report(python_plan, "python")
    typescript_report = _engine_report(typescript_plan, "typescript")

    matching = runner.build_distribution_evidence(
        protocol, seeds, corpus, python_report, typescript_report,
    )
    assert matching["status"] == "match"
    assert matching["summary"]["matches"] == 49
    assert matching["diagnostics"] == []
    assert runner.verify_artifact_fingerprint(matching)

    divergent_report = deepcopy(typescript_report)
    divergent_report["cases"][0]["result"]["throughput_reliability"]["label"] = "fragile"
    divergent = runner.build_distribution_evidence(
        protocol, seeds, corpus, python_report, divergent_report,
    )
    assert divergent["status"] == "divergence"
    assert divergent["diagnostics"][0]["classification"] == "distributional_divergence"

    inconclusive_report = deepcopy(typescript_report)
    for case in inconclusive_report["cases"]:
        case["result"].pop("risk_score", None)
    inconclusive = runner.build_distribution_evidence(
        protocol, seeds, corpus, python_report, inconclusive_report,
    )
    assert inconclusive["status"] in {"divergence", "inconclusive"}
    assert any(
        diagnostic["classification"] in {
            "distributional_divergence",
            "statistically_inconclusive",
        }
        for diagnostic in inconclusive["diagnostics"]
    )

    invalid = runner.invalid_evidence("protocol_error", ["bad protocol"])
    assert invalid["status"] == "invalid"
    assert runner.verify_artifact_fingerprint(invalid)
    tampered = deepcopy(invalid)
    tampered["diagnostics"][0]["message"] = "changed"
    assert not runner.verify_artifact_fingerprint(tampered)
    output = tmp_path / "nested" / "evidence.json"
    runner.write_evidence(matching, output)
    assert output.read_bytes().endswith(b"\n")


def test_evidence_validator_rejects_schema_summary_status_and_fingerprint(tmp_path: Path) -> None:
    protocol, seeds, corpus = _bundle()
    fast = _fast_protocol()
    left_plan = runner.build_execution_plan(fast, seeds, corpus, "python")
    right_plan = runner.build_execution_plan(fast, seeds, corpus, "typescript")
    report = runner.build_distribution_evidence(
        fast,
        seeds,
        corpus,
        _engine_report(left_plan, "python"),
        _engine_report(right_plan, "typescript"),
    )
    path = tmp_path / "evidence.json"
    _write_json(path, report)
    validated, issues = evidence_validation.validate_evidence(path)
    assert validated == report
    assert issues == []

    malformed = deepcopy(report)
    malformed["summary"]["matches"] -= 1
    malformed["error_classification"] = "engine_error"
    malformed["status"] = "inconclusive"
    assert {
        "Le résumé de la preuve est incohérent avec les métriques.",
        "Une preuve exécutée ne doit pas porter de classification d'erreur.",
        "Le verdict global est incohérent avec les scénarios.",
        "L'empreinte déterministe de la preuve est incohérente.",
    }.issubset(evidence_validation.evidence_semantic_issues(malformed))

    invalid = runner.invalid_evidence("protocol_error", ["bad"])
    invalid["error_classification"] = None
    invalid["scenarios"] = deepcopy(report["scenarios"])
    assert any(
        "preuve invalide" in issue
        for issue in evidence_validation.evidence_semantic_issues(invalid)
    )
    structural = deepcopy(report)
    structural["unknown"] = True
    _write_json(path, structural)
    assert evidence_validation.validate_evidence(path)[0] is None


def test_control_classifies_protocol_engine_and_infrastructure_errors(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    protocol, seeds, corpus = _bundle()
    fast = _fast_protocol()
    monkeypatch.setattr(
        distribution_control,
        "validate_protocol_bundle",
        lambda **_kwargs: (fast, seeds, corpus),
    )

    def python_engine(plan: dict[str, Any]) -> dict[str, Any]:
        return _engine_report(plan, "python")

    def typescript_engine(plan: dict[str, Any]) -> dict[str, Any]:
        return _engine_report(plan, "typescript")

    output = tmp_path / "proof.json"
    matched = distribution_control.run_control(
        evidence_path=output,
        python_runner=python_engine,
        typescript_runner=typescript_engine,
    )
    assert matched["status"] == "match"
    assert json.loads(output.read_text(encoding="utf-8")) == matched

    monkeypatch.setattr(
        distribution_control,
        "validate_protocol_bundle",
        lambda **_kwargs: (_ for _ in ()).throw(
            protocol_validation.ProtocolBundleError("version_incompatibility", ["bad version"])
        ),
    )
    assert distribution_control.run_control(evidence_path=output)["error_classification"] == (
        "version_incompatibility"
    )

    monkeypatch.setattr(
        distribution_control,
        "validate_protocol_bundle",
        lambda **_kwargs: (fast, seeds, corpus),
    )

    def bad_engine(_plan: dict[str, Any]) -> dict[str, Any]:
        raise runner.EngineExecutionError("engine failed")

    def bad_infrastructure(_plan: dict[str, Any]) -> dict[str, Any]:
        raise runner.InfrastructureError("node failed")

    assert distribution_control.run_control(
        evidence_path=output, python_runner=bad_engine,
    )["error_classification"] == "engine_error"
    assert distribution_control.run_control(
        evidence_path=output, python_runner=bad_infrastructure,
    )["error_classification"] == "infrastructure_error"


def test_calibration_is_stable_calibrated_and_exposes_size_effects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    protocol, _seeds, _corpus = _bundle()
    first = calibration.build_calibration_report(protocol)
    second = calibration.build_calibration_report(protocol)
    assert first == second
    assert first["status"] == "calibrated"
    assert first["false_positive"]["observed_rate"] == 0
    assert first["production_sensitivity"]["passed"] is True
    assert calibration.verify_calibration_fingerprint(first)
    assert not calibration.verify_calibration_fingerprint({})
    grid = {(entry["cohort_size"], entry["n_sims"]): entry for entry in first["grid"]}
    assert grid[(16, 1000)]["same_law"]["pooled_cdf_match"] == 0
    assert grid[(64, 1000)]["same_law"]["pooled_cdf_match"] >= 0.99
    assert calibration._score_p_value(0, 0, 10) == 1
    assert calibration._binomial_envelope(0, 0.05, 0.99) == 0
    assert calibration._binomial_envelope(2, 0.05, 2.0) == 2
    assert calibration._count_pairwise(
        (np.array([1]), np.array([1])), lambda left, right: left == right,
    ) == 1
    assert calibration._false_positive_families(
        np.random.Generator(np.random.PCG64(1)),
        repetitions=1,
        family_size=1,
        size=1000,
        alpha=1,
        margin=0,
    ) == 1

    monkeypatch.setattr(calibration, "_false_positive_families", lambda *_args, **_kwargs: 200)
    monkeypatch.setattr(calibration, "_presence_power", lambda *_args, **_kwargs: 0.0)
    invalid = calibration.build_calibration_report(protocol)
    assert invalid["status"] == "invalid"
    assert len(invalid["diagnostics"]) == 2


def test_cli_commands_and_entrypoints_report_success_and_failure(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    assert protocol_cli.main([]) == 0
    assert "256 seeds" in capsys.readouterr().out
    assert protocol_cli.main(["--protocol", str(tmp_path / "missing.json")]) == 1
    assert "invalide" in capsys.readouterr().out

    calibration_output = tmp_path / "calibration.json"
    assert calibration_cli.main(["--output", str(calibration_output)]) == 0
    assert calibration_output.exists()
    assert calibration_cli.main([
        "--protocol",
        str(tmp_path / "missing-protocol.json"),
        "--output",
        str(calibration_output),
    ]) == 1
    assert calibration_validator_cli.main(["--report", str(calibration_output)]) == 0
    assert calibration_validator_cli.main([
        "--report", str(tmp_path / "missing-calibration.json"),
    ]) == 1
    calibration_output.write_text("{}", encoding="utf-8")
    assert calibration_validator_cli.main(["--report", str(calibration_output)]) == 1

    valid_evidence = runner.invalid_evidence("protocol_error", ["invalid by design"])
    evidence_path = tmp_path / "evidence.json"
    runner.write_evidence(valid_evidence, evidence_path)
    assert evidence_cli.main([str(evidence_path)]) == 0
    evidence_path.write_text("{}", encoding="utf-8")
    assert evidence_cli.main([str(evidence_path)]) == 1
    assert evidence_cli.main([str(tmp_path / "missing-evidence.json")]) == 1

    monkeypatch.setattr(
        distribution_control,
        "run_control",
        lambda **_kwargs: runner.invalid_evidence("protocol_error", ["bad"]),
    )
    assert distribution_control.main([]) == 1
    assert "statut=invalid" in capsys.readouterr().out
    matching = runner.invalid_evidence("protocol_error", ["bad"])
    matching["status"] = "inconclusive"
    monkeypatch.setattr(distribution_control, "run_control", lambda **_kwargs: matching)
    assert distribution_control.main([]) == 0

    for module, cli_file in (
        (protocol_cli, protocol_cli.__file__),
        (calibration_cli, calibration_cli.__file__),
        (calibration_validator_cli, calibration_validator_cli.__file__),
        (evidence_cli, evidence_cli.__file__),
        (distribution_control, distribution_control.__file__),
    ):
        monkeypatch.setattr(module, "main", lambda _argv=None: 0)
        monkeypatch.setattr(sys, "argv", [str(cli_file)])
        with pytest.raises(SystemExit) as stopped:
            runpy.run_path(str(cli_file), run_name="__main__")
        assert stopped.value.code == 0


def test_real_distributional_runner_is_informative_complete_and_stable(tmp_path: Path) -> None:
    first_path = tmp_path / "first.json"
    second_path = tmp_path / "second.json"

    first = distribution_control.run_control(evidence_path=first_path)
    second = distribution_control.run_control(evidence_path=second_path)

    assert first["status"] == "match"
    assert first["proof_kind"] == "distributional_parity"
    assert first["enforcement"] == "informational"
    assert first["summary"] == {
        "scenario_count": 5,
        "metric_count": 49,
        "matches": 49,
        "divergences": 0,
        "inconclusive": 0,
    }
    assert first == second
    assert first_path.read_bytes() == second_path.read_bytes()
    assert runner.verify_artifact_fingerprint(first)


def test_distributional_authorities_are_documented_without_product_chronology() -> None:
    root = protocol_validation.ROOT
    protocol_doc = (root / "docs/statistical-distribution-protocol.md").read_text(encoding="utf-8")
    readme = (root / "README.md").read_text(encoding="utf-8")
    backlog = (root / "docs/backlog.md").read_text(encoding="utf-8")
    expected_references = {
        "ARCHITECTURE.md": [
            "statistical-distribution-protocol-v1.0.json",
            "reports/statistical-distribution-evidence.json",
        ],
        "CHANGELOG.md": [
            "Protocole de parité distributionnelle",
            "reports/statistical-distribution-calibration.json",
        ],
        "docs/risk-control-matrix.md": [
            "docs/statistical-distribution-protocol.md",
            "49 métriques",
        ],
        "docs/critical-paths.md": [
            "cohorts disjointes",
            "49 métriques",
        ],
        "docs/backlog-expectations/feature-02-statistical-core.md": [
            "Scripts/run_statistical_distribution.py",
            "0 famille faussement positive",
        ],
        "docs/statistical-parity-audit.md": [
            "Protocole postérieur — PBI 2.18",
        ],
    }
    for path, needles in expected_references.items():
        content = (root / path).read_text(encoding="utf-8")
        assert all(needle in content for needle in needles), path
    assert "Dvoretzky" in protocol_doc
    assert "Newcombe–Wilson" in protocol_doc
    assert "Holm–Bonferroni" in protocol_doc
    assert "inconclusive" in protocol_doc
    assert "backtesting" in protocol_doc
    assert "Validation distributionnelle distincte" in readme
    assert "PBI 2.18" not in readme
    assert "| 2.18 | Protocole de parité distributionnelle" in backlog
    completed_line = (
        "| 2.18 | Protocole de parité distributionnelle versionné et testable "
        "| M | Sol Très élevé | 01/08/2026 |"
    )
    assert completed_line in backlog
    assert "**Prochain PBI :** `2.20`" in backlog
