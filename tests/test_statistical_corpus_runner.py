from __future__ import annotations

import json
import runpy
import sys
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from Scripts import run_statistical_reference_corpus as corpus_control
from Scripts import statistical_corpus_runner as corpus_runner
from Scripts import statistical_parity_report as parity_report
from Scripts import validate_statistical_reference_corpus as corpus_validation

VALIDATION_PROBES_PATH = (
    Path(__file__).resolve().parents[1] / "contracts" / "statistical-validation-probes-v1.0.json"
)


def _corpus() -> dict[str, Any]:
    corpus = corpus_validation.load_json(corpus_validation.CORPUS_PATH)
    assert isinstance(corpus, dict)
    return corpus


def _single_case_corpus() -> dict[str, Any]:
    corpus = deepcopy(_corpus())
    corpus["cases"] = [corpus["cases"][0]]
    return corpus


def _validation_probes() -> dict[str, Any]:
    probes = corpus_validation.load_json(VALIDATION_PROBES_PATH)
    assert isinstance(probes, dict)
    return probes


def _matching_engine_report(engine: str, corpus: dict[str, Any]) -> dict[str, Any]:
    return {
        "engine": engine,
        "corpus_id": corpus["corpus_id"],
        "schema_version": corpus["schema_version"],
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


def _matching_validation_report(
    engine: str,
    probes: dict[str, Any],
) -> dict[str, Any]:
    return {
        "engine": engine,
        "schema_version": probes["schema_version"],
        "normative_contract": probes["normative_contract"],
        "status": "completed",
        "cases": [{"id": probe["id"], "accepted": probe["accepted"]} for probe in probes["cases"]],
    }


def test_python_runner_executes_all_cases_with_exact_canonical_results() -> None:
    corpus = _corpus()
    engine_report = corpus_runner.run_python_corpus(corpus)

    assert engine_report["engine"] == "python"
    assert engine_report["status"] == "completed"
    assert len(engine_report["cases"]) == 16
    expected = {case["id"]: case["expected_result"] for case in corpus["cases"]}
    actual = {case["id"]: case["result"] for case in engine_report["cases"]}
    matching = [
        case_id
        for case_id in expected
        if parity_report.compare_canonical(expected[case_id], actual[case_id]) == []
    ]
    assert matching == list(expected)
    assert actual["histogram-aggregated-contiguous-101"]["result_distribution"] == (
        expected["histogram-aggregated-contiguous-101"]["result_distribution"]
    )
    assert actual["histogram-aggregated-discontinuous"]["result_distribution"] == [
        {"x": 50, "count": 994},
        {"x": 9999, "count": 6},
    ]
    assert actual["weeks-total-censorship"]["result_percentiles"] == {}
    assert "risk_score" not in actual["weeks-total-censorship"]
    assert actual["weeks-exact-horizon-completion"]["completion_summary"] == {
        "completed_count": 1000,
        "censored_count": 0,
        "censored_rate": 0.0,
        "horizon_weeks": 521,
    }


def test_python_runner_reports_case_errors_without_stopping_following_cases() -> None:
    corpus = deepcopy(_corpus())
    corpus["cases"] = corpus["cases"][:2]

    def execute_case(reference_case: dict[str, Any]) -> dict[str, Any]:
        if reference_case["id"] == corpus["cases"][0]["id"]:
            raise RuntimeError("simulated Python failure")
        return {"seed": reference_case["seed"]}

    report = corpus_runner.run_python_corpus(corpus, execute_case)

    assert report["status"] == "engine_error"
    assert report["cases"][0] == {
        "id": corpus["cases"][0]["id"],
        "status": "engine_error",
        "error": {"type": "RuntimeError", "message": "simulated Python failure"},
    }
    assert report["cases"][1]["status"] == "ok"
    assert corpus_runner.error_payload("failure") == {
        "type": "str",
        "message": "failure",
    }


def test_shared_validation_probes_match_in_python_and_typescript() -> None:
    probes = _validation_probes()
    expected = {probe["id"]: probe["accepted"] for probe in probes["cases"]}

    python_report = corpus_runner.run_python_validation_probes(probes)
    typescript_report = corpus_runner.run_typescript_validation_probes(VALIDATION_PROBES_PATH)
    python_results = {case["id"]: case["accepted"] for case in python_report["cases"]}
    typescript_results = {case["id"]: case["accepted"] for case in typescript_report["cases"]}

    assert python_report["status"] == "completed"
    assert typescript_report["status"] == "completed"
    assert python_results == expected
    assert typescript_results == expected
    assert python_results == typescript_results


def test_typescript_bridge_parses_report_and_classifies_failures(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    corpus_path = tmp_path / "corpus.json"
    corpus_path.write_text("{}", encoding="utf-8")
    valid_report = {"engine": "typescript", "status": "completed", "cases": []}

    def completed(**updates: object) -> SimpleNamespace:
        values: dict[str, object] = {
            "returncode": 0,
            "stdout": json.dumps(valid_report),
            "stderr": "",
        }
        values.update(updates)
        return SimpleNamespace(**values)

    monkeypatch.setattr(corpus_runner.subprocess, "run", lambda *_args, **_kwargs: completed())
    assert (
        corpus_runner.run_typescript_corpus(
            corpus_path,
            node_executable="node-test",
            python_executable="python-test",
        )
        == valid_report
    )

    monkeypatch.setattr(
        corpus_runner.subprocess,
        "run",
        lambda *_args, **_kwargs: completed(returncode=7, stdout="", stderr="bridge error"),
    )
    with pytest.raises(RuntimeError, match="exit code 7: bridge error"):
        corpus_runner.run_typescript_corpus(corpus_path, node_executable="node-test")

    monkeypatch.setattr(
        corpus_runner.subprocess,
        "run",
        lambda *_args, **_kwargs: completed(stdout="not-json"),
    )
    with pytest.raises(RuntimeError, match="invalid JSON"):
        corpus_runner.run_typescript_corpus(corpus_path, node_executable="node-test")

    monkeypatch.setattr(
        corpus_runner.subprocess,
        "run",
        lambda *_args, **_kwargs: completed(stdout='{"engine":"other"}'),
    )
    with pytest.raises(RuntimeError, match="invalid engine report"):
        corpus_runner.run_typescript_corpus(corpus_path, node_executable="node-test")

    monkeypatch.setattr(corpus_runner.shutil, "which", lambda _name: None)
    with pytest.raises(RuntimeError, match="Node.js executable"):
        corpus_runner._resolved_node_executable(None)


def test_typescript_validation_bridge_classifies_protocol_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    valid_report = {"engine": "typescript", "status": "completed", "cases": []}

    def completed(**updates: object) -> SimpleNamespace:
        values: dict[str, object] = {
            "returncode": 0,
            "stdout": json.dumps(valid_report),
            "stderr": "",
        }
        values.update(updates)
        return SimpleNamespace(**values)

    monkeypatch.setattr(
        corpus_runner.subprocess,
        "run",
        lambda *_args, **_kwargs: completed(),
    )
    assert (
        corpus_runner.run_typescript_validation_probes(
            VALIDATION_PROBES_PATH,
            node_executable="node-test",
        )
        == valid_report
    )

    monkeypatch.setattr(
        corpus_runner.subprocess,
        "run",
        lambda *_args, **_kwargs: completed(returncode=5, stderr="probe failure"),
    )
    with pytest.raises(RuntimeError, match="exit code 5: probe failure"):
        corpus_runner.run_typescript_validation_probes(
            VALIDATION_PROBES_PATH,
            node_executable="node-test",
        )

    monkeypatch.setattr(
        corpus_runner.subprocess,
        "run",
        lambda *_args, **_kwargs: completed(stdout="not-json"),
    )
    with pytest.raises(RuntimeError, match="invalid JSON"):
        corpus_runner.run_typescript_validation_probes(
            VALIDATION_PROBES_PATH,
            node_executable="node-test",
        )

    monkeypatch.setattr(
        corpus_runner.subprocess,
        "run",
        lambda *_args, **_kwargs: completed(stdout='{"engine":"other"}'),
    )
    with pytest.raises(RuntimeError, match="invalid engine report"):
        corpus_runner.run_typescript_validation_probes(
            VALIDATION_PROBES_PATH,
            node_executable="node-test",
        )


def test_exact_comparator_preserves_absence_order_types_lengths_and_values() -> None:
    assert parity_report.compare_canonical({"same": [1]}, {"same": [1]}) == []
    differences = parity_report.compare_canonical(
        {"missing": 1, "array": [1, 2], "object": {"value": 2}},
        {"extra": 3, "array": [1], "object": [2]},
    )
    assert {difference["kind"] for difference in differences} == {
        "missing_actual",
        "unexpected_actual",
        "array_length",
        "type_mismatch",
    }
    assert any(difference["path"] == "/array/1" for difference in differences)
    assert parity_report.compare_canonical(1, 2) == [
        {"path": "/", "kind": "value_mismatch", "expected": 1, "actual": 2}
    ]
    escaped = parity_report.compare_canonical({"a/b~c": 1}, {})
    assert escaped[0]["path"] == "/a~1b~0c"


def test_parity_report_distinguishes_normative_engine_and_execution_divergences() -> None:
    corpus = _single_case_corpus()
    python = _matching_engine_report("python", corpus)
    typescript = _matching_engine_report("typescript", corpus)

    matching = parity_report.build_parity_report(corpus, python, typescript)
    assert matching["status"] == "match"
    assert matching["summary"]["matching_cases"] == 1

    typescript["cases"][0]["result"]["seed"] = 9
    divergent = parity_report.build_parity_report(corpus, python, typescript)
    case = divergent["cases"][0]
    assert divergent["status"] == "divergence"
    assert case["outcomes"] == ["normative_divergence", "engine_divergence"]
    assert case["typescript"]["differences"] == [
        {"path": "/seed", "kind": "value_mismatch", "expected": 0, "actual": 9}
    ]

    typescript["status"] = "engine_error"
    typescript["cases"] = [
        {
            "id": corpus["cases"][0]["id"],
            "status": "engine_error",
            "error": {"type": "Error", "message": "simulated TypeScript failure"},
        }
    ]
    failed = parity_report.build_parity_report(corpus, python, typescript)
    assert failed["status"] == "engine_error"
    assert failed["cases"][0]["outcomes"] == ["engine_error"]
    assert failed["cases"][0]["inter_engine"]["status"] == "not_compared"
    assert failed["summary"]["fatal_engine_errors"] == 1

    typescript["cases"] = []
    missing = parity_report.build_parity_report(corpus, python, typescript)
    assert missing["cases"][0]["typescript"]["error"]["type"] == "MissingCaseReport"


def test_parity_report_includes_validation_alignment_without_blocking_it() -> None:
    corpus = _single_case_corpus()
    probes = deepcopy(_validation_probes())
    probes["cases"] = probes["cases"][:2]
    python = _matching_validation_report("python", probes)
    typescript = _matching_validation_report("typescript", probes)

    matching = parity_report.build_parity_report(
        corpus,
        _matching_engine_report("python", corpus),
        _matching_engine_report("typescript", corpus),
        validation_probes=probes,
        python_validation_report=python,
        typescript_validation_report=typescript,
    )

    assert matching["status"] == "match"
    assert matching["enforcement"] == "informational"
    assert matching["validation_alignment"]["summary"] == {
        "probe_count": 2,
        "matching_probes": 2,
        "divergent_probes": 0,
        "engine_errors": 0,
    }
    assert "Alignement de validation PBI 2.13" in parity_report.render_markdown(matching)

    typescript["cases"][0]["accepted"] = not probes["cases"][0]["accepted"]
    divergent = parity_report.build_parity_report(
        corpus,
        _matching_engine_report("python", corpus),
        _matching_engine_report("typescript", corpus),
        validation_probes=probes,
        python_validation_report=python,
        typescript_validation_report=typescript,
    )
    assert divergent["status"] == "divergence"
    assert divergent["validation_alignment"]["summary"]["divergent_probes"] == 1

    typescript["status"] = "engine_error"
    typescript["cases"] = []
    failed = parity_report.build_parity_report(
        corpus,
        _matching_engine_report("python", corpus),
        _matching_engine_report("typescript", corpus),
        validation_probes=probes,
        python_validation_report=python,
        typescript_validation_report=typescript,
    )
    assert failed["status"] == "engine_error"
    assert failed["validation_alignment"]["summary"]["engine_errors"] == 1
    assert "typescript_accepted" not in failed["validation_alignment"]["cases"][0]
    assert "`omis`" in parity_report.render_markdown(failed)


def test_report_rendering_is_deterministic_readable_and_writable(tmp_path: Path) -> None:
    corpus = _single_case_corpus()
    report = parity_report.build_parity_report(
        corpus,
        _matching_engine_report("python", corpus),
        _matching_engine_report("typescript", corpus),
    )
    json_text = parity_report.render_json(report)
    markdown = parity_report.render_markdown(report)
    assert parity_report.render_json(report) == json_text
    assert '"enforcement": "informational"' in json_text
    assert "| Python / norme | TypeScript / norme |" in markdown
    assert "sans tolérance numérique" in markdown

    json_path = tmp_path / "nested/report.json"
    markdown_path = tmp_path / "other/report.md"
    parity_report.write_reports(report, json_path, markdown_path)
    assert json.loads(json_path.read_text(encoding="utf-8")) == report
    assert markdown_path.read_text(encoding="utf-8") == markdown

    invalid = parity_report.invalid_corpus_report("schema_invalid", ["bad schema"])
    invalid_markdown = parity_report.render_markdown(invalid)
    assert "`invalid_corpus` (`schema_invalid`)" in invalid_markdown
    assert "- bad schema" in invalid_markdown


def test_validation_rejects_invalid_schema_and_corpus_before_engines(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    schema_path = tmp_path / "schema.json"
    corpus_path = tmp_path / "corpus.json"

    missing_schema = tmp_path / "missing.json"
    assert corpus_control.validate_for_execution(missing_schema, corpus_path)[1] == "schema_invalid"

    schema_path.write_text("[]", encoding="utf-8")
    result = corpus_control.validate_for_execution(schema_path, corpus_path)
    assert result[1:] == (
        "schema_invalid",
        [f"{schema_path.as_posix()}:/: schema must be a JSON object"],
    )

    schema_path.write_text('{"type":7}', encoding="utf-8")
    assert corpus_control.validate_for_execution(schema_path, corpus_path)[1] == "schema_invalid"

    schema_path.write_text(
        corpus_validation.SCHEMA_PATH.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    corpus_path.write_text("{", encoding="utf-8")
    assert corpus_control.validate_for_execution(schema_path, corpus_path)[1] == "corpus_invalid"

    corpus_path.write_text("[]", encoding="utf-8")
    result = corpus_control.validate_for_execution(schema_path, corpus_path)
    assert result[1:] == (
        "corpus_invalid",
        [f"{corpus_path.as_posix()}:/: corpus must be a JSON object"],
    )

    invalid_corpus = _corpus()
    invalid_corpus["cases"][0]["seed"] = -1
    corpus_path.write_text(json.dumps(invalid_corpus), encoding="utf-8")
    assert corpus_control.validate_for_execution(schema_path, corpus_path)[1] == "corpus_invalid"

    executed: list[str] = []
    report = corpus_control.run_control(
        schema_path=schema_path,
        corpus_path=corpus_path,
        json_report_path=tmp_path / "invalid.json",
        markdown_report_path=tmp_path / "invalid.md",
        python_runner=lambda _corpus: executed.append("python") or {},
        typescript_runner=lambda _path: executed.append("typescript") or {},
    )
    assert report["status"] == "invalid_corpus"
    assert executed == []


def test_execution_rejects_incomplete_pbi_215_scope_before_engines(
    tmp_path: Path,
) -> None:
    schema_path = tmp_path / "schema.json"
    corpus_path = tmp_path / "corpus.json"
    schema_path.write_text(
        corpus_validation.SCHEMA_PATH.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    corpus = _corpus()
    corpus["cases"] = [
        case
        for case in corpus["cases"]
        if case["id"] != "reliability-seven-observations-degraded"
    ]
    corpus_path.write_text(json.dumps(corpus), encoding="utf-8")

    validated, invalidity, diagnostics = corpus_control.validate_for_execution(
        schema_path,
        corpus_path,
    )
    assert validated is None
    assert invalidity == "corpus_invalid"
    assert any(
        "missing required PBI 2.15 case: reliability-seven-observations-degraded"
        in diagnostic
        for diagnostic in diagnostics
    )

    executed: list[str] = []
    report = corpus_control.run_control(
        schema_path=schema_path,
        corpus_path=corpus_path,
        json_report_path=tmp_path / "invalid.json",
        markdown_report_path=tmp_path / "invalid.md",
        python_runner=lambda _corpus: executed.append("python") or {},
        typescript_runner=lambda _path: executed.append("typescript") or {},
    )
    assert report["status"] == "invalid_corpus"
    assert executed == []


def test_control_reports_invalid_validation_probe_document(tmp_path: Path) -> None:
    invalid_probes = tmp_path / "validation-probes.json"
    invalid_probes.write_text("[]", encoding="utf-8")

    report = corpus_control.run_control(
        validation_probes_path=invalid_probes,
        json_report_path=tmp_path / "report.json",
        markdown_report_path=tmp_path / "report.md",
    )

    assert report["status"] == "invalid_corpus"
    assert report["invalidity"] == "validation_probes_invalid"

    valid, invalidity, diagnostics = corpus_control.validate_for_execution(
        corpus_validation.SCHEMA_PATH,
        corpus_validation.CORPUS_PATH,
    )
    assert isinstance(valid, dict)
    assert invalidity is None
    assert diagnostics == []


def test_control_reports_fatal_engine_errors_and_cli_statuses(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    corpus = _corpus()

    def python_runner(_corpus: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("fatal Python runner failure")

    report = corpus_control.run_control(
        json_report_path=tmp_path / "report.json",
        markdown_report_path=tmp_path / "report.md",
        python_runner=python_runner,
        typescript_runner=lambda _path: _matching_engine_report("typescript", corpus),
    )
    assert report["status"] == "engine_error"
    assert report["engines"]["python"]["error"] == {
        "type": "RuntimeError",
        "message": "fatal Python runner failure",
    }

    probes = _validation_probes()

    def python_validation_runner(_probes: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("fatal validation runner failure")

    validation_failure = corpus_control.run_control(
        json_report_path=tmp_path / "validation-error.json",
        markdown_report_path=tmp_path / "validation-error.md",
        python_runner=lambda _corpus: _matching_engine_report("python", corpus),
        typescript_runner=lambda _path: _matching_engine_report(
            "typescript",
            corpus,
        ),
        python_validation_runner=python_validation_runner,
        typescript_validation_runner=lambda _path: _matching_validation_report(
            "typescript",
            probes,
        ),
    )
    assert validation_failure["status"] == "engine_error"
    assert validation_failure["validation_alignment"]["engines"]["python"]["error"] == {
        "type": "RuntimeError",
        "message": "fatal validation runner failure",
    }

    invalid = parity_report.invalid_corpus_report("corpus_invalid", ["bad corpus"])
    monkeypatch.setattr(corpus_control, "run_control", lambda **_kwargs: invalid)
    assert corpus_control.main([]) == 1
    output = capsys.readouterr().out
    assert "status=invalid_corpus" in output
    assert "1 diagnostic(s)" in output

    engine_error = deepcopy(report)
    monkeypatch.setattr(corpus_control, "run_control", lambda **_kwargs: engine_error)
    assert corpus_control.main([]) == 1
    engine_output = capsys.readouterr().out
    assert "engine error cases=16" in engine_output
    assert "fatal engine errors=1" in engine_output

    matching = parity_report.build_parity_report(
        _single_case_corpus(),
        _matching_engine_report("python", _single_case_corpus()),
        _matching_engine_report("typescript", _single_case_corpus()),
    )
    monkeypatch.setattr(corpus_control, "run_control", lambda **_kwargs: matching)
    assert (
        corpus_control.main(
            [
                "--schema",
                "schema.json",
                "--corpus",
                "corpus.json",
                "--json-report",
                "report.json",
                "--markdown-report",
                "report.md",
                "--validation-probes",
                "validation-probes.json",
            ]
        )
        == 0
    )
    assert "matches=1" in capsys.readouterr().out


def test_control_script_entrypoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(corpus_control, "main", lambda _argv=None: 0)
    monkeypatch.setattr(sys, "argv", [str(corpus_control.__file__)])
    with pytest.raises(SystemExit) as stopped:
        runpy.run_path(str(corpus_control.__file__), run_name="__main__")
    assert stopped.value.code == 0
