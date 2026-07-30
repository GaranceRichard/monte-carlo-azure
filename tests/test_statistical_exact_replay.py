from __future__ import annotations

import json
import runpy
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest

from Scripts import run_statistical_exact_replay as replay_control
from Scripts import statistical_exact_replay as exact_replay
from Scripts import statistical_exact_replay_support as replay_support
from Scripts import validate_statistical_reference_corpus as corpus_validation

BATCH_SIZES = (125, 128, 1000, 2048)


def _corpus() -> dict[str, Any]:
    corpus = corpus_validation.load_json(corpus_validation.CORPUS_PATH)
    assert isinstance(corpus, dict)
    return corpus


def _single_case_corpus() -> dict[str, Any]:
    corpus = deepcopy(_corpus())
    corpus["cases"] = [corpus["cases"][0]]
    return corpus


def _matching_engine_report(
    engine: str,
    corpus: dict[str, Any],
    batch_size: int | None = None,
) -> dict[str, Any]:
    report = {
        "engine": engine,
        "corpus_id": corpus["corpus_id"],
        "schema_version": corpus["schema_version"],
        "normative_contract": deepcopy(corpus["normative_contract"]),
        "prng_contract": corpus["prng_contract"]["id"],
        "status": "completed",
        "cases": [
            {
                "id": case["id"],
                "status": "ok",
                "result": deepcopy(case["expected_result"]),
            }
            for case in corpus["cases"]
        ],
    }
    if batch_size is not None:
        report["batch_size"] = batch_size
    return report


def _matching_report(corpus: dict[str, Any] | None = None) -> dict[str, Any]:
    reference = corpus or _corpus()
    return exact_replay.build_exact_replay_report(
        reference,
        BATCH_SIZES,
        [_matching_engine_report("python", reference, batch_size) for batch_size in BATCH_SIZES],
        _matching_engine_report("typescript", reference),
    )


def test_versioned_corpus_covers_every_exact_replay_dimension_and_reports_a_gap() -> None:
    corpus = _corpus()

    coverage = replay_support.build_proof_coverage(corpus)

    assert coverage == {
        "modes": ["weeks_to_items", "backlog_to_weeks"],
        "censorship": ["not_applicable", "none", "partial", "total"],
        "percentiles": ["complete", "partial", "absent"],
        "risk_score": ["present", "absent"],
        "reliability_labels": ["fragile", "incertain", "fiable", "non fiable"],
        "histograms": ["exact", "aggregated"],
    }
    assert replay_support.proof_coverage_issues(coverage) == []

    incomplete = deepcopy(corpus)
    incomplete["cases"] = [
        case
        for case in incomplete["cases"]
        if case["id"] not in replay_support.AGGREGATED_HISTOGRAM_CASE_IDS
    ]

    assert replay_support.proof_coverage_issues(
        replay_support.build_proof_coverage(incomplete)
    ) == ["Couverture de rejeu incomplète pour histograms: aggregated."]


def test_batch_plan_requires_every_geometry_and_strict_unique_positive_integers() -> None:
    corpus = _corpus()

    assert replay_control.validate_batch_plan(corpus, BATCH_SIZES) == []
    assert replay_control.validate_batch_plan(corpus, ()) == [
        "Au moins une taille de batch backend est requise."
    ]
    for invalid_size in (True, 0, -1):
        assert replay_control.validate_batch_plan(
            corpus,
            (invalid_size, 128, 1000, 2048),
        ) == ["Chaque taille de batch backend doit être un entier strictement positif."]
    assert replay_control.validate_batch_plan(
        corpus,
        (125, 125, 128, 1000, 2048),
    ) == ["Les tailles de batch backend doivent être uniques."]
    assert replay_control.validate_batch_plan(corpus, (125,)) == [
        "Le plan de batch doit couvrir un dernier lot non divisible.",
        "Le plan de batch doit couvrir un lot unique exactement égal à la population.",
        "Le plan de batch doit couvrir un lot supérieur à la population.",
    ]
    assert replay_control.validate_batch_plan(corpus, (1000, 2048)) == [
        "Le plan de batch doit couvrir un découpage divisible en plusieurs lots.",
        "Le plan de batch doit couvrir un dernier lot non divisible.",
    ]


def test_matching_synthetic_report_proves_all_80_normative_and_64_pairwise_runs() -> None:
    report = _matching_report()

    assert report["report_version"] == "1.0"
    assert report["proof_kind"] == "exact_replay"
    assert report["enforcement"] == "informational"
    assert report["distributional_equivalence"] == "not_evaluated"
    assert report["status"] == "match"
    assert report["comparison_policy"] == {
        "authority": "versioned_corpus_expected_result",
        "engine_as_oracle": False,
        "field_presence": "exact",
        "primitive_types": "exact_json_types",
        "numeric_tolerance": "none",
        "numeric_rounding": "none",
        "distribution_order": "significant",
        "silent_normalization": False,
    }
    assert report["summary"] == {
        "case_count": 16,
        "python_case_executions": 64,
        "typescript_case_executions": 16,
        "normative_comparisons": 80,
        "normative_matches": 80,
        "interlanguage_comparisons": 64,
        "interlanguage_matches": 64,
        "batch_independent_cases": 16,
        "engine_error_cases": 0,
        "diagnostic_count": 0,
    }
    assert report["batching"] == {
        "python_batch_sizes": [125, 128, 1000, 2048],
        "typescript_execution": "simulation_major_sequential",
        "independence_rule": "every_python_batch_matches_corpus",
        "independent": True,
    }
    assert report["diagnostics"] == []
    assert all(case["outcomes"] == ["match"] for case in report["cases"])

    assert report["cases"][0]["python_batches"] == [
        {
            "batch_size": 125,
            "batch_count": 8,
            "last_batch_size": 125,
            "divisible": True,
            "status": "match",
            "differences": [],
        },
        {
            "batch_size": 128,
            "batch_count": 8,
            "last_batch_size": 104,
            "divisible": False,
            "status": "match",
            "differences": [],
        },
        {
            "batch_size": 1000,
            "batch_count": 1,
            "last_batch_size": 1000,
            "divisible": True,
            "status": "match",
            "differences": [],
        },
        {
            "batch_size": 2048,
            "batch_count": 1,
            "last_batch_size": 1000,
            "divisible": False,
            "status": "match",
            "differences": [],
        },
    ]


def test_normative_diagnostics_preserve_types_values_presence_and_array_order() -> None:
    expected = {
        "flag": True,
        "optional": {"amount": 7},
        "ordered": [{"x": 1}, {"x": 2}],
        "value": 10,
    }
    actual = {
        "flag": 1,
        "ordered": [{"x": 2}, {"x": 1}],
        "unexpected": "field",
        "value": 11,
    }
    case_report = {"status": "ok", "result": actual}

    comparison = replay_support.normative_comparison(expected, case_report)
    diagnostics = replay_support.normative_diagnostics(
        case_id="diagnostic-case",
        engine="python",
        batch_size=128,
        expected=expected,
        case_report=case_report,
        comparison=comparison,
    )
    by_path = {diagnostic["path"]: diagnostic for diagnostic in diagnostics}

    assert comparison["status"] == "normative_divergence"
    assert [
        (difference["path"], difference["kind"]) for difference in comparison["differences"]
    ] == [
        ("/flag", "type_mismatch"),
        ("/optional", "missing_actual"),
        ("/ordered/0/x", "value_mismatch"),
        ("/ordered/1/x", "value_mismatch"),
        ("/unexpected", "unexpected_actual"),
        ("/value", "value_mismatch"),
    ]
    assert by_path["/flag"] == {
        "case_id": "diagnostic-case",
        "engine": "python",
        "batch_size": 128,
        "comparison": "normative",
        "classification": "normative_divergence",
        "path": "/flag",
        "kind": "type_mismatch",
        "expected": {"present": True, "type": "boolean", "value": True},
        "actual": {"present": True, "type": "number", "value": 1},
    }
    assert by_path["/optional"]["actual"] == {"present": False}
    assert by_path["/unexpected"]["expected"] == {"present": False}
    assert by_path["/ordered/0/x"]["expected"]["value"] == 1
    assert by_path["/ordered/0/x"]["actual"]["value"] == 2
    assert by_path["/value"]["expected"]["value"] == 10
    assert by_path["/value"]["actual"]["value"] == 11

    pointer_value = {"a/b~c": [{"value": "found"}]}
    assert replay_support.state_at_pointer(pointer_value, "") == {
        "present": True,
        "type": "object",
        "value": pointer_value,
    }
    assert replay_support.state_at_pointer(pointer_value, "/") == {
        "present": True,
        "type": "object",
        "value": pointer_value,
    }
    assert replay_support.state_at_pointer(pointer_value, "/a~1b~0c/0/value") == {
        "present": True,
        "type": "string",
        "value": "found",
    }
    assert replay_support.state_at_pointer(pointer_value, "/a~1b~0c/1") == {"present": False}
    assert replay_support.state_at_pointer(pointer_value, "/a~1b~0c/not-an-index") == {
        "present": False
    }


def test_engine_errors_identify_missing_and_fatal_case_reports_precisely() -> None:
    corpus = _single_case_corpus()
    expected = corpus["cases"][0]["expected_result"]
    missing = replay_support.normative_comparison(expected, None)

    assert missing == {
        "status": "engine_error",
        "error": {
            "type": "MissingCaseReport",
            "message": "engine produced no case report",
        },
    }
    missing_diagnostic = replay_support.normative_diagnostics(
        case_id=corpus["cases"][0]["id"],
        engine="python",
        batch_size=125,
        expected=expected,
        case_report=None,
        comparison=missing,
    )
    assert missing_diagnostic[0]["actual"] == {
        "present": False,
        "error": missing["error"],
    }

    python_report = _matching_engine_report("python", corpus, 125)
    python_report["cases"] = []
    typescript_report = _matching_engine_report("typescript", corpus)
    typescript_report["status"] = "engine_error"
    typescript_report["error"] = {
        "type": "RuntimeError",
        "message": "TypeScript unavailable",
    }
    typescript_report["cases"] = []

    report = exact_replay.build_exact_replay_report(
        corpus,
        (125,),
        [python_report],
        typescript_report,
    )

    assert report["status"] == "engine_error"
    assert report["cases"][0]["outcomes"] == ["engine_error"]
    assert report["cases"][0]["interlanguage"] == [
        {
            "python_batch_size": 125,
            "status": "not_compared",
            "differences": [],
        }
    ]
    assert report["summary"]["engine_error_cases"] == 1
    diagnostics = {
        (diagnostic["engine"], diagnostic["batch_size"]): diagnostic
        for diagnostic in report["diagnostics"]
    }
    assert diagnostics[("typescript", None)]["actual"]["error"] == {
        "type": "RuntimeError",
        "message": "TypeScript unavailable",
    }
    assert diagnostics[("python", 125)]["actual"]["error"]["type"] == "MissingCaseReport"


def test_interlanguage_diagnostic_keeps_corpus_as_authority_for_two_wrong_engines() -> None:
    corpus = _single_case_corpus()
    expected_seed = corpus["cases"][0]["expected_result"]["seed"]
    python_report = _matching_engine_report("python", corpus, 125)
    typescript_report = _matching_engine_report("typescript", corpus)
    python_report["cases"][0]["result"]["seed"] = expected_seed + 1
    typescript_report["cases"][0]["result"]["seed"] = expected_seed + 2

    report = exact_replay.build_exact_replay_report(
        corpus,
        (125,),
        [python_report],
        typescript_report,
    )

    assert report["status"] == "divergence"
    assert report["comparison_policy"]["authority"] == "versioned_corpus_expected_result"
    assert report["comparison_policy"]["engine_as_oracle"] is False
    assert report["cases"][0]["outcomes"] == [
        "normative_divergence",
        "interlanguage_divergence",
    ]
    interlanguage = next(
        diagnostic
        for diagnostic in report["diagnostics"]
        if diagnostic["classification"] == "interlanguage_divergence"
    )
    assert interlanguage == {
        "case_id": corpus["cases"][0]["id"],
        "engine": "python_vs_typescript",
        "batch_size": 125,
        "comparison": "interlanguage",
        "classification": "interlanguage_divergence",
        "path": "/seed",
        "kind": "value_mismatch",
        "expected": {
            "present": True,
            "type": "number",
            "value": expected_seed,
        },
        "actual": {
            "python": {
                "present": True,
                "type": "number",
                "value": expected_seed + 1,
            },
            "typescript": {
                "present": True,
                "type": "number",
                "value": expected_seed + 2,
            },
        },
    }


def test_identical_wrong_python_output_in_every_batch_is_not_batch_independence() -> None:
    corpus = _single_case_corpus()
    expected_seed = corpus["cases"][0]["expected_result"]["seed"]
    python_reports = [
        _matching_engine_report("python", corpus, batch_size) for batch_size in BATCH_SIZES
    ]
    for report in python_reports:
        report["cases"][0]["result"]["seed"] = expected_seed + 1

    report = exact_replay.build_exact_replay_report(
        corpus,
        BATCH_SIZES,
        python_reports,
        _matching_engine_report("typescript", corpus),
    )

    case = report["cases"][0]
    assert report["status"] == "divergence"
    assert report["batching"]["independence_rule"] == "every_python_batch_matches_corpus"
    assert report["batching"]["independent"] is False
    assert case["batch_independent"] is False
    assert [entry["status"] for entry in case["python_batches"]] == ["normative_divergence"] * 4
    assert [entry["status"] for entry in case["interlanguage"]] == ["interlanguage_divergence"] * 4
    assert case["outcomes"] == [
        "normative_divergence",
        "interlanguage_divergence",
    ]
    assert report["summary"]["normative_matches"] == 1
    assert report["summary"]["batch_independent_cases"] == 0


def test_engine_report_protocol_validates_headers_case_set_order_and_statuses() -> None:
    corpus = _single_case_corpus()
    valid_python = _matching_engine_report("python", corpus, 125)
    valid_typescript = _matching_engine_report("typescript", corpus)

    assert (
        replay_control.validate_engine_report(
            valid_python,
            engine="python",
            corpus=corpus,
            batch_size=125,
        )
        == []
    )
    assert (
        replay_control.validate_engine_report(
            valid_typescript,
            engine="typescript",
            corpus=corpus,
            batch_size=None,
        )
        == []
    )
    assert replay_control.validate_engine_report(
        "not-an-object",
        engine="python",
        corpus=corpus,
        batch_size=125,
    ) == ["Le runner n'a pas produit un objet de rapport."]

    wrong_header = deepcopy(valid_python)
    wrong_header["normative_contract"] = {"id": "STD-STAT-001", "version": "0"}
    assert replay_control.validate_engine_report(
        wrong_header,
        engine="python",
        corpus=corpus,
        batch_size=125,
    ) == ["Header moteur divergent pour normative_contract."]

    cases_not_a_list = deepcopy(valid_python)
    cases_not_a_list["cases"] = {}
    assert replay_control.validate_engine_report(
        cases_not_a_list,
        engine="python",
        corpus=corpus,
        batch_size=125,
    ) == ["Le rapport moteur doit contenir une liste de cas."]

    for invalid_cases in (
        [],
        [*valid_python["cases"], deepcopy(valid_python["cases"][0])],
        [
            *valid_python["cases"],
            {"id": "extra-case", "status": "ok", "result": {}},
        ],
    ):
        invalid = deepcopy(valid_python)
        invalid["cases"] = invalid_cases
        assert (
            "Le rapport moteur doit conserver exactement les cas du corpus dans leur ordre."
            in replay_control.validate_engine_report(
                invalid,
                engine="python",
                corpus=corpus,
                batch_size=125,
            )
        )

    invalid_report_status = deepcopy(valid_python)
    invalid_report_status["status"] = "running"
    assert replay_control.validate_engine_report(
        invalid_report_status,
        engine="python",
        corpus=corpus,
        batch_size=125,
    ) == ["Le statut du rapport moteur est invalide."]

    invalid_case_status = deepcopy(valid_python)
    invalid_case_status["cases"][0]["status"] = "skipped"
    assert replay_control.validate_engine_report(
        invalid_case_status,
        engine="python",
        corpus=corpus,
        batch_size=125,
    ) == ["Chaque rapport de cas moteur doit porter un résultat ou une erreur valide."]

    missing_result = deepcopy(valid_python)
    del missing_result["cases"][0]["result"]
    assert replay_control.validate_engine_report(
        missing_result,
        engine="python",
        corpus=corpus,
        batch_size=125,
    ) == ["Chaque rapport de cas moteur doit porter un résultat ou une erreur valide."]

    missing_error = deepcopy(valid_python)
    missing_error["status"] = "engine_error"
    missing_error["cases"][0] = {
        "id": valid_python["cases"][0]["id"],
        "status": "engine_error",
    }
    assert replay_control.validate_engine_report(
        missing_error,
        engine="python",
        corpus=corpus,
        batch_size=125,
    ) == ["Chaque rapport de cas moteur doit porter un résultat ou une erreur valide."]

    non_object_case = deepcopy(valid_python)
    non_object_case["cases"] = [None]
    assert replay_control.validate_engine_report(
        non_object_case,
        engine="python",
        corpus=corpus,
        batch_size=125,
    ) == [
        "Le rapport moteur doit conserver exactement les cas du corpus dans leur ordre.",
        "Chaque rapport de cas moteur doit porter un résultat ou une erreur valide.",
    ]


def test_control_rejects_invalid_corpus_coverage_and_batch_plan_before_engines(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    executed: list[str] = []

    def python_runner(_corpus: dict[str, Any], _batch_size: int) -> dict[str, Any]:
        executed.append("python")
        return {}

    def typescript_runner(_corpus_path: Path) -> dict[str, Any]:
        executed.append("typescript")
        return {}

    invalid_corpus = replay_control.run_control(
        schema_path=tmp_path / "missing-schema.json",
        corpus_path=tmp_path / "missing-corpus.json",
        evidence_path=tmp_path / "invalid-corpus.json",
        python_runner=python_runner,
        typescript_runner=typescript_runner,
    )
    assert invalid_corpus["status"] == "invalid_corpus"
    assert invalid_corpus["invalidity"] == "schema_invalid"
    assert executed == []

    incomplete = deepcopy(_corpus())
    incomplete["cases"] = [
        case
        for case in incomplete["cases"]
        if case["id"] not in replay_support.AGGREGATED_HISTOGRAM_CASE_IDS
    ]
    monkeypatch.setattr(
        replay_control,
        "validate_for_execution",
        lambda _schema, _corpus_path: (incomplete, None, []),
    )
    invalid_coverage = replay_control.run_control(
        evidence_path=tmp_path / "invalid-coverage.json",
        python_runner=python_runner,
        typescript_runner=typescript_runner,
    )
    assert invalid_coverage["status"] == "invalid_corpus"
    assert invalid_coverage["invalidity"] == "proof_coverage_invalid"
    assert executed == []

    complete = _corpus()
    monkeypatch.setattr(
        replay_control,
        "validate_for_execution",
        lambda _schema, _corpus_path: (complete, None, []),
    )
    invalid_plan = replay_control.run_control(
        evidence_path=tmp_path / "invalid-plan.json",
        batch_sizes=(125,),
        python_runner=python_runner,
        typescript_runner=typescript_runner,
    )
    assert invalid_plan["status"] == "invalid_configuration"
    assert invalid_plan["invalidity"] == "batch_plan_invalid"
    assert executed == []


def test_control_encapsulates_runner_and_protocol_errors_as_engine_evidence(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    corpus = _corpus()
    monkeypatch.setattr(
        replay_control,
        "validate_for_execution",
        lambda _schema, _corpus_path: (corpus, None, []),
    )

    def invalid_python_report(
        _corpus: dict[str, Any],
        _batch_size: int,
    ) -> dict[str, Any]:
        return {}

    def failing_typescript_runner(_corpus_path: Path) -> dict[str, Any]:
        raise RuntimeError("TypeScript runner failed")

    report = replay_control.run_control(
        evidence_path=tmp_path / "engine-errors.json",
        python_runner=invalid_python_report,
        typescript_runner=failing_typescript_runner,
    )

    assert report["status"] == "engine_error"
    assert report["summary"]["engine_error_cases"] == 16
    assert report["summary"]["diagnostic_count"] == 80
    errors = {
        diagnostic["actual"]["error"]["type"]
        for diagnostic in report["diagnostics"]
        if diagnostic["classification"] == "engine_error"
    }
    assert errors == {"EngineReportError", "RuntimeError"}
    assert any(
        "Header moteur divergent" in diagnostic["actual"]["error"]["message"]
        for diagnostic in report["diagnostics"]
        if diagnostic["actual"]["error"]["type"] == "EngineReportError"
    )
    assert any(
        diagnostic["actual"]["error"]
        == {"type": "RuntimeError", "message": "TypeScript runner failed"}
        for diagnostic in report["diagnostics"]
    )
    assert json.loads((tmp_path / "engine-errors.json").read_text(encoding="utf-8")) == report


def test_control_writes_byte_stable_json_for_the_same_validated_inputs(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    corpus = _corpus()
    monkeypatch.setattr(
        replay_control,
        "validate_for_execution",
        lambda _schema, _corpus_path: (corpus, None, []),
    )

    def python_runner(
        validated_corpus: dict[str, Any],
        batch_size: int,
    ) -> dict[str, Any]:
        return _matching_engine_report("python", validated_corpus, batch_size)

    def typescript_runner(_corpus_path: Path) -> dict[str, Any]:
        return _matching_engine_report("typescript", corpus)

    first_path = tmp_path / "first" / "proof.json"
    second_path = tmp_path / "second" / "proof.json"
    first = replay_control.run_control(
        corpus_path=tmp_path / "corpus.json",
        evidence_path=first_path,
        python_runner=python_runner,
        typescript_runner=typescript_runner,
    )
    second = replay_control.run_control(
        corpus_path=tmp_path / "corpus.json",
        evidence_path=second_path,
        python_runner=python_runner,
        typescript_runner=typescript_runner,
    )

    assert first == second
    assert first["status"] == "match"
    assert first_path.read_bytes() == second_path.read_bytes()
    assert first_path.read_bytes().endswith(b"\n")
    assert json.loads(first_path.read_text(encoding="utf-8")) == first


def test_cli_keeps_divergence_informational_but_fails_invalidity_and_engine_error(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    matching = _matching_report()
    divergence = deepcopy(matching)
    divergence["status"] = "divergence"
    invalid = {
        "status": "invalid_configuration",
        "invalidity": "batch_plan_invalid",
        "diagnostics": ["bad plan"],
    }
    engine_error = deepcopy(matching)
    engine_error["status"] = "engine_error"
    reports = iter((divergence, invalid, engine_error))
    calls: list[dict[str, Any]] = []

    def fake_run_control(**kwargs: Any) -> dict[str, Any]:
        calls.append(kwargs)
        return next(reports)

    monkeypatch.setattr(replay_control, "run_control", fake_run_control)

    assert (
        replay_control.main(
            [
                "--schema",
                str(tmp_path / "schema.json"),
                "--corpus",
                str(tmp_path / "corpus.json"),
                "--evidence",
                str(tmp_path / "evidence.json"),
                "--batch-size",
                "125",
                "--batch-size",
                "128",
                "--batch-size",
                "1000",
                "--batch-size",
                "2048",
            ]
        )
        == 0
    )
    assert calls[0]["batch_sizes"] == BATCH_SIZES
    assert "statut=divergence" in capsys.readouterr().out

    assert replay_control.main([]) == 1
    invalid_output = capsys.readouterr().out
    assert "Preuve inexécutable (batch_plan_invalid)" in invalid_output
    assert "1 diagnostic(s)" in invalid_output

    assert replay_control.main([]) == 1
    engine_output = capsys.readouterr().out
    assert "statut=engine_error" in engine_output
    assert "comparaisons normatives=80/80" in engine_output


def test_control_script_entrypoint_propagates_failure_code(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    evidence_path = tmp_path / "entrypoint-evidence.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            str(replay_control.__file__),
            "--schema",
            str(tmp_path / "missing-schema.json"),
            "--corpus",
            str(tmp_path / "missing-corpus.json"),
            "--evidence",
            str(evidence_path),
        ],
    )

    with pytest.raises(SystemExit) as stopped:
        runpy.run_path(str(replay_control.__file__), run_name="__main__")

    assert stopped.value.code == 1
    assert json.loads(evidence_path.read_text(encoding="utf-8"))["status"] == "invalid_corpus"
    assert "statut=invalid_corpus" in capsys.readouterr().out


def test_real_versioned_corpus_control_executes_completely_as_informational_evidence(
    tmp_path: Path,
) -> None:
    evidence_path = tmp_path / "real-exact-replay.json"

    report = replay_control.run_control(evidence_path=evidence_path)

    assert report["proof_kind"] == "exact_replay"
    assert report["enforcement"] == "informational"
    assert report["distributional_equivalence"] == "not_evaluated"
    assert report["status"] in {"match", "divergence"}
    assert report["summary"]["case_count"] == 16
    assert report["summary"]["python_case_executions"] == 64
    assert report["summary"]["typescript_case_executions"] == 16
    assert report["summary"]["normative_comparisons"] == 80
    assert report["summary"]["interlanguage_comparisons"] == 64
    assert report["summary"]["engine_error_cases"] == 0
    assert report["batching"]["python_batch_sizes"] == list(BATCH_SIZES)
    assert all(
        entry["status"] in {"match", "normative_divergence"}
        for case in report["cases"]
        for entry in (case["typescript"], *case["python_batches"])
    )
    assert all(
        entry["status"] in {"match", "interlanguage_divergence"}
        for case in report["cases"]
        for entry in case["interlanguage"]
    )
    assert json.loads(evidence_path.read_text(encoding="utf-8")) == report
