from __future__ import annotations

import json
import runpy
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable

import pytest
from jsonschema.exceptions import SchemaError

from Scripts import validate_statistical_reference_corpus as corpus_validation


def _contract() -> tuple[dict[str, object], dict[str, object]]:
    schema = corpus_validation.load_json(corpus_validation.SCHEMA_PATH)
    instance = corpus_validation.load_json(corpus_validation.VALID_EXAMPLE_PATH)
    assert isinstance(schema, dict)
    assert isinstance(instance, dict)
    return schema, instance


def _issues_for(
    update: Callable[[dict[str, Any]], None],
) -> list[corpus_validation.ValidationIssue]:
    schema, instance = _contract()
    invalid = deepcopy(instance)
    update(invalid)
    return corpus_validation.validate_instance(invalid, schema)


def test_bundled_control_accepts_minimal_contract_and_rejects_negative_example(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert corpus_validation.main([]) == 0
    output = capsys.readouterr()
    assert "schema 1.0 is valid" in output.out
    assert output.err == ""

    schema, instance = _contract()
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["x-schemaVersion"] == instance["schema_version"] == "1.0"
    assert instance["prng_contract"]["id"] == "mca-prng-v1"
    assert len(instance["cases"]) == 1


def test_script_entrypoint_runs_the_autonomous_control(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(sys, "argv", [str(corpus_validation.SCHEMA_PATH)])
    with pytest.raises(SystemExit) as stopped:
        runpy.run_path(
            str(
                corpus_validation.ROOT
                / "Scripts/validate_statistical_reference_corpus.py"
            ),
            run_name="__main__",
        )
    assert stopped.value.code == 0
    assert "positive example accepted" in capsys.readouterr().out


@pytest.mark.parametrize(
    ("update", "path", "keyword"),
    [
        (
            lambda value: value.__setitem__("schema_version", "2.0"),
            "/schema_version",
            "const",
        ),
        (
            lambda value: value["cases"][0]["input"].__setitem__("n_sims", 999),
            "/cases/0/input/n_sims",
            "minimum",
        ),
        (
            lambda value: value["cases"][0].__setitem__("seed", 4294967296),
            "/cases/0/seed",
            "maximum",
        ),
        (
            lambda value: value["cases"][0]["input"].__setitem__(
                "throughput_samples", [0, 0, 0, 0, 0, 1]
            ),
            "/cases/0/input/throughput_samples",
            "minContains",
        ),
        (
            lambda value: value["cases"][0]["input"].__setitem__(
                "backlog_size", 1
            ),
            "/cases/0/input",
            "not",
        ),
        (
            lambda value: value["cases"][0]["expected_result"].__setitem__(
                "completion_summary",
                {
                    "completed_count": 1000,
                    "censored_count": 0,
                    "censored_rate": 0,
                    "horizon_weeks": 521,
                },
            ),
            "/cases/0/expected_result",
            "not",
        ),
        (
            lambda value: value["cases"][0]["expected_result"].__setitem__(
                "unexpected", True
            ),
            "/cases/0/expected_result",
            "additionalProperties",
        ),
    ],
)
def test_schema_rejects_contract_drift_with_localized_actionable_diagnostics(
    update: Callable[[dict[str, Any]], None],
    path: str,
    keyword: str,
) -> None:
    issues = _issues_for(update)
    assert any(
        issue.instance_path == path and issue.keyword == keyword for issue in issues
    )
    rendered = "\n".join(
        issue.render(Path("candidate.json")) for issue in issues
    )
    assert f"candidate.json:{path}" in rendered
    assert f"[{keyword}]" in rendered
    assert "(schema /" in rendered


def test_backlog_mode_requires_only_backlog_input_and_completion_result() -> None:
    schema, instance = _contract()
    case = instance["cases"][0]
    case["input"] = {
        "throughput_samples": [1, 1, 1, 1, 1, 1],
        "include_zero_weeks": False,
        "mode": "backlog_to_weeks",
        "backlog_size": 1,
        "n_sims": 1000,
    }
    case["expected_result"] = {
        "result_kind": "weeks",
        "result_percentiles": {"P50": 1, "P70": 1, "P90": 1},
        "risk_score": 0,
        "result_distribution": [{"x": 1, "count": 1000}],
        "completion_summary": {
            "completed_count": 1000,
            "censored_count": 0,
            "censored_rate": 0,
            "horizon_weeks": 521,
        },
        "samples_count": 6,
        "throughput_reliability": {
            "cv": 0,
            "iqr_ratio": 0,
            "slope_norm": 0,
            "label": "incertain",
            "samples_count": 6,
        },
        "seed": 0,
    }
    assert corpus_validation.validate_instance(instance, schema) == []


def test_contract_control_rejects_duplicate_case_identifiers() -> None:
    schema, instance = _contract()
    duplicate = deepcopy(instance["cases"][0])
    duplicate["description"] = "Different content must not make a duplicate identifier valid."
    instance["cases"].append(duplicate)
    issues = corpus_validation.validate_contract(instance, schema)
    assert any(
        issue.instance_path == "/cases/1/id"
        and issue.keyword == "uniqueCaseId"
        and "/cases/0/id" in issue.message
        for issue in issues
    )
    assert corpus_validation.validate_contract([], schema)
    assert corpus_validation.validate_contract({"cases": [None]}, schema)


def test_cli_reports_invalid_custom_instance_and_parse_failures(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    invalid_path = tmp_path / "invalid.json"
    invalid_path.write_text('{"schema_version":"2.0"}', encoding="utf-8")
    assert corpus_validation.main([str(invalid_path)]) == 1
    first = capsys.readouterr()
    assert f"{invalid_path.as_posix()}:/schema_version: [const]" in first.err
    assert "validation failed" in first.err

    duplicate_path = tmp_path / "duplicate.json"
    duplicate_path.write_text('{"schema_version":"1.0","schema_version":"1.0"}', encoding="utf-8")
    assert corpus_validation.main([str(duplicate_path)]) == 1
    assert "duplicate JSON property: schema_version" in capsys.readouterr().err

    malformed_path = tmp_path / "malformed.json"
    malformed_path.write_text('{"schema_version":', encoding="utf-8")
    with pytest.raises(ValueError, match=r"malformed\.json:1:19: invalid JSON"):
        corpus_validation.load_json(malformed_path)


def test_control_reports_invalid_schema_and_negative_probe_regressions(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    original_schema_path = corpus_validation.SCHEMA_PATH
    _schema, instance = _contract()
    invalid_schema = tmp_path / "schema.json"
    invalid_schema.write_text(
        json.dumps({"$schema": "https://json-schema.org/draft/2020-12/schema", "type": 7}),
        encoding="utf-8",
    )
    monkeypatch.setattr(corpus_validation, "SCHEMA_PATH", invalid_schema)
    assert corpus_validation.main([]) == 1
    assert "7 is not valid under any of the given schemas" in capsys.readouterr().err

    non_object_schema = tmp_path / "non-object-schema.json"
    non_object_schema.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(corpus_validation, "SCHEMA_PATH", non_object_schema)
    assert corpus_validation.run_control() == [
        f"{non_object_schema.as_posix()}:/: schema must be a JSON object"
    ]

    valid_negative = tmp_path / "valid-negative.json"
    valid_negative.write_text(json.dumps(instance), encoding="utf-8")
    monkeypatch.setattr(corpus_validation, "SCHEMA_PATH", original_schema_path)
    monkeypatch.setattr(corpus_validation, "INVALID_EXAMPLE_PATH", valid_negative)
    assert any(
        "negative example was unexpectedly accepted"
        in error
        for error in corpus_validation.run_control()
    )

    wrong_negative = deepcopy(instance)
    wrong_negative["schema_version"] = "2.0"
    wrong_negative_path = tmp_path / "wrong-negative.json"
    wrong_negative_path.write_text(json.dumps(wrong_negative), encoding="utf-8")
    monkeypatch.setattr(corpus_validation, "INVALID_EXAMPLE_PATH", wrong_negative_path)
    assert any(
        "did not produce the expected actionable diagnostic"
        in error
        for error in corpus_validation.run_control()
    )

    with pytest.raises(SchemaError):
        corpus_validation.Draft202012Validator.check_schema({"type": 7})
