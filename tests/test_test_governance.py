from __future__ import annotations

import json
import runpy
import sys
from collections import Counter
from copy import deepcopy
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from Scripts import check_test_governance, quality_gate
from Scripts import test_governance_reporting as governance_reporting
from Scripts.test_classifier_discovery import LogicalCase
from Scripts.test_execution_profiles import node_for_command
from Scripts.test_governance_contract import load_json
from Scripts.test_governance_detection import discover_mechanisms
from Scripts.test_governance_reporting import build_report, collect_runtime, write_report
from Scripts.test_governance_runtime_validation import validate_runtime_governance
from Scripts.test_governance_validation import validate_governance
from tests import execution_counts_plugin

ROOT = Path(__file__).resolve().parents[1]
TODAY = date(2026, 7, 20)


def _profiles() -> dict[str, Any]:
    return {
        "profiles": [
            {"id": "pr", "includes": ["pr"]},
            {"id": "main", "includes": ["pr", "main"]},
            {"id": "nightly", "includes": ["pr", "main", "nightly"]},
            {"id": "release", "includes": ["pr", "main", "release"]},
        ]
    }


def _logical(
    framework: str = "pytest",
    selector: str = "test_behavior",
    *,
    source: str | None = None,
    profile: str = "main",
    criticality: str = "high",
) -> dict[str, Any]:
    source_path = source or (
        "tests/test_controls.py" if framework == "pytest" else f"frontend/src/{framework}.test.ts"
    )
    logical_id = f"{framework}:{source_path}::{selector}"
    return {
        "logicalCaseId": logical_id,
        "framework": framework,
        "sourcePath": source_path,
        "selector": selector,
        "status": "classified",
        "nature": "integration",
        "executionProfile": profile,
        "criticality": criticality,
    }


def _case(record: dict[str, Any], *, modifiers=(), calls=()) -> LogicalCase:
    return LogicalCase(
        record["framework"],
        record["sourcePath"],
        record["selector"],
        {
            "imports": [],
            "calls": list(calls),
            "fixtures": [],
            "resources": [],
            "modifiers": list(modifiers),
            "conditional": False,
            "dynamicTitle": False,
        },
    )


def _entry(record: dict[str, Any], state: str = "quarantine", **changes: Any) -> dict[str, Any]:
    value = {
        "logicalCaseId": record["logicalCaseId"],
        "state": state,
        "justification": "Temporary controlled exception.",
        "cause": "Observed environmental instability.",
        "owner": "technical-owner",
        "ticket": "PBI-123",
        "criticality": record.get("criticality", "high"),
        "risk": "The regression could remain undetected.",
        "enteredOn": "2026-07-01",
        "expiresOn": "2026-08-15",
        "executionProfile": record["executionProfile"],
    }
    value.update(changes)
    return value


def _contract(*entries: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0.0",
        "schema": "config/test-governance.schema.json",
        "entries": list(entries),
    }


def _detection(record: dict[str, Any], state: str, marker: str = "quarantine") -> dict[str, Any]:
    return {
        "framework": record["framework"],
        "sourcePath": record["sourcePath"],
        "logicalCaseId": record["logicalCaseId"],
        "state": state,
        "marker": marker,
        "line": 3,
    }


def _instance(
    record: dict[str, Any],
    *,
    attempts: int = 1,
    results: list[str] | None = None,
    executed: bool = True,
) -> dict[str, Any]:
    observed = results if results is not None else (["passed"] if executed else [])
    final = observed[-1] if observed else "skipped"
    return {
        "instanceId": f"{record['framework']}:instance",
        "logicalCaseId": record["logicalCaseId"],
        "executed": executed,
        "attempts": attempts,
        "attemptResults": observed,
        "initialResult": observed[0] if observed else final,
        "finalResult": final,
        "result": final,
    }


def _write_native(
    root: Path,
    profile: str,
    record: dict[str, Any],
    instances: list[dict[str, Any]],
    *,
    primary: bool = True,
    complete: bool = True,
    anomalies: list[str] | None = None,
) -> Path:
    if primary:
        nodes = {"pytest": "backend-tests", "vitest": "frontend-tests", "playwright": "e2e"}
        relative = (
            f"reports/test-execution-artifacts/{profile}/"
            f"{nodes[record['framework']]}/{record['framework']}.json"
        )
        path = root / relative
    else:
        path = root / f"reports/test-execution-native/{record['framework']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "framework": record["framework"],
                "complete": complete,
                "instances": instances,
                "anomalies": anomalies or [],
            }
        ),
        encoding="utf-8",
    )
    return path


def test_versioned_contract_and_report_schemas_are_distinct_and_complete() -> None:
    contract = load_json(ROOT / "config/test-governance.json")
    schema = load_json(ROOT / "config/test-governance.schema.json")
    report_schema = load_json(ROOT / "config/test-governance-report.schema.json")

    assert contract == {
        "schemaVersion": "1.0.0",
        "schema": "config/test-governance.schema.json",
        "entries": [],
    }
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    required = set(schema["$defs"]["entry"]["required"])
    assert required >= {
        "logicalCaseId",
        "state",
        "justification",
        "cause",
        "owner",
        "ticket",
        "criticality",
        "risk",
        "enteredOn",
        "expiresOn",
    }
    assert report_schema["x-schemaVersion"] == "1.0.0"
    assert report_schema["properties"]["schema"]["const"] == (
        "config/test-governance-report.schema.json"
    )
    assert "config/test-classification.schema.json" not in json.dumps(schema)


def test_detection_covers_pytest_vitest_playwright_unknown_markers_and_global_retries(
    tmp_path: Path,
) -> None:
    source = tmp_path / "tests/test_controls.py"
    source.parent.mkdir()
    source.write_text(
        """import pytest
import unittest

pytestmark = pytest.mark.module_unknown
pytest.importorskip("optional_dependency")

@pytest.mark.parametrize("value", [1])
@pytest.mark.skipif(True, reason="conditional")
def test_skip(value):
    pytest.skip("runtime")

@pytest.mark.xfail(reason="expected")
def test_expected():
    pytest.xfail("runtime expected")

@pytest.mark.flaky
def test_retry():
    assert True

@pytest.mark.unknown_marker
async def test_unknown():
    assert True

@unittest.skip("disabled")
def test_unittest_skip():
    assert True

@unittest.expectedFailure
def test_unittest_expected():
    assert False

@pytest.mark.quarantine
class TestQuarantined:
    def test_runs(self):
        assert True
""",
        encoding="utf-8",
    )
    pytest_record = _logical(source="tests/test_controls.py")
    vitest_skip = _logical("vitest", "suite > skipped [4:2]")
    vitest_unknown = _logical("vitest", "suite > unknown [8:2]")
    playwright = _logical(
        "playwright",
        "flow > @quarantine recovers [12:1]",
        source="frontend/tests/e2e/flow.spec.js",
    )
    cases = [
        _case(pytest_record),
        _case(vitest_skip, modifiers=("skip", "retry"), calls=("test.skip",)),
        _case(vitest_unknown, modifiers=("mystery",)),
        _case(playwright, calls=("test.fail", "test.fixme")),
    ]
    (tmp_path / "requirements.txt").write_text("pytest-rerunfailures>=1\n", encoding="utf-8")
    (tmp_path / "pytest.ini").write_text("addopts = --reruns 2\n", encoding="utf-8")
    (tmp_path / "pyproject.toml").write_text("addopts='--reruns=3'\n", encoding="utf-8")
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    e2e = frontend / "tests/e2e"
    e2e.mkdir(parents=True)
    (e2e / "flow.spec.js").write_text(
        "test.describe.configure({ mode: 'serial', retries: 2 });\n",
        encoding="utf-8",
    )
    (frontend / "package.json").write_text('{"scripts":{"test":"playwright --retries 2"}}')
    (frontend / "vitest.config.js").write_text("export default { test: { retry: 2 } };")
    (frontend / "playwright.config.ts").write_text("export default { retries: 1 };")

    detections = discover_mechanisms(tmp_path, cases=cases)
    states = Counter(item["state"] for item in detections)
    markers = {item["marker"] for item in detections}

    assert states.keys() >= {
        "skipped",
        "expected_failure",
        "retry",
        "quarantine",
        "unknown",
        "disabled",
    }
    assert {"pytest.skip", "pytest.xfail", "test.fail", "@quarantine", "mystery"} <= markers
    assert sum(item["logicalCaseId"] is None for item in detections) == 9


def test_javascript_detection_accepts_neutral_modifiers_and_zero_position() -> None:
    record = _logical("vitest", "dynamic title")
    case = _case(record, modifiers=("each", "concurrent", "sequential"), calls=("helper",))
    assert discover_mechanisms(ROOT, cases=[case]) == []


def test_contract_validation_accepts_executable_quarantine_with_preserved_retry() -> None:
    record = _logical(criticality="critical")
    entry = _entry(
        record,
        compensatingMeasure="Run the deterministic contract suite on every change.",
        retryPolicy={"maxAttempts": 2, "preserveFirstFailure": True},
    )
    detections = [
        _detection(record, "quarantine"),
        _detection(record, "retry", "pytest.mark.flaky"),
    ]

    assert validate_governance(
        _contract(entry), [record], detections, _profiles(), today=TODAY
    ) == []


def test_contract_validation_blocks_shape_date_and_retry_policy_defects() -> None:
    record = _logical()
    base = _entry(record, "retry", retryPolicy={"maxAttempts": 2, "preserveFirstFailure": True})
    invalid_entries: list[Any] = [
        None,
        {**base, "logicalCaseId": "", "extra": True},
        {**base, "state": "mystery"},
        {**base, "criticality": "urgent"},
        {**base, "executionProfile": "weekly"},
        {**base, "enteredOn": None},
        {**base, "enteredOn": "2026-13-01"},
        {**base, "enteredOn": "20260701"},
        {**base, "enteredOn": "2026-09-01"},
        {**base, "expiresOn": "2026-06-01"},
        {**base, "expiresOn": "2026-07-19"},
        {**base, "retryPolicy": []},
        {**base, "retryPolicy": {"maxAttempts": 1, "preserveFirstFailure": False}},
        {key: value for key, value in base.items() if key != "retryPolicy"},
        {key: value for key, value in base.items() if key != "justification"},
    ]
    errors = validate_governance(
        _contract(*invalid_entries),
        [record],
        [_detection(record, "retry")],
        _profiles(),
        today=TODAY,
    )

    assert any("must be an object" in error for error in errors)
    assert any("unknown fields" in error for error in errors)
    assert any("canonical date" in error for error in errors)
    assert any("in the future" in error for error in errors)
    assert any("precedes" in error for error in errors)
    assert any("expired" in error for error in errors)
    assert any("preserve the first failure" in error for error in errors)
    assert any("retry requires retryPolicy" in error for error in errors)


def test_contract_validation_blocks_top_level_orphan_and_lifecycle_defects() -> None:
    critical = _logical(criticality="critical")
    orphan = _logical(selector="test_orphan")
    missing = _logical(selector="test_missing")
    entry = _entry(critical, "quarantine", criticality="critical")
    orphan_entry = _entry(orphan, executionProfile="weekly")
    duplicate = deepcopy(entry)
    errors = validate_governance(
        {
            "schemaVersion": "0.0.0",
            "schema": "wrong.json",
            "entries": [entry, duplicate, orphan_entry],
            "extra": True,
        },
        [critical],
        [
            _detection(critical, "quarantine"),
            _detection(critical, "skipped", "pytest.skip"),
            _detection(missing, "unknown", "pytest.mark.mystery"),
            {**_detection(missing, "retry", "--reruns 2"), "logicalCaseId": None},
        ],
        _profiles(),
        today=TODAY,
    )

    assert any("top-level shape" in error for error in errors)
    assert any("schemaVersion" in error for error in errors)
    assert any("schema path" in error for error in errors)
    assert any("duplicate governance" in error for error in errors)
    assert any("critical quarantine" in error for error in errors)
    assert any("critical test cannot be ignored" in error for error in errors)
    assert any("quarantine must remain executable" in error for error in errors)
    assert any("unknown test marker" in error for error in errors)
    assert any("global or unassigned" in error for error in errors)
    assert any("orphan governance entry" in error for error in errors)
    assert any("unknown execution profile" in error for error in errors)

    expected_failure = validate_governance(
        _contract(_entry(critical, "expected_failure", criticality="critical")),
        [critical],
        [_detection(critical, "expected_failure", "pytest.mark.xfail")],
        _profiles(),
        today=TODAY,
    )
    assert any("critical test cannot be ignored" in error for error in expected_failure)


def test_contract_validation_blocks_ungoverned_mismatch_and_invalid_container_types() -> None:
    record = _logical()
    mismatched = _entry(record, "disabled", executionProfile="pr")
    detections = [_detection(record, "retry")]
    errors = validate_governance(
        _contract(mismatched), [record], detections, _profiles(), today=TODAY
    )
    ungoverned = validate_governance(
        _contract(), [record], detections, _profiles(), today=TODAY
    )

    assert any("state mismatch" in error for error in errors)
    assert any("execution profile mismatch" in error for error in errors)
    assert any("retry can mask" in error for error in errors)
    assert any("ungoverned" in error for error in ungoverned)
    assert validate_governance([], [record], [], _profiles(), today=TODAY) == [
        "test-governance contract must be an object"
    ]
    assert "entries must be an array" in " ".join(
        validate_governance(
            {
                "schemaVersion": "1.0.0",
                "schema": "config/test-governance.schema.json",
                "entries": {},
            },
            [record],
            [],
            _profiles(),
            today=TODAY,
        )
    )
    assert "classification inventory" in " ".join(
        validate_governance(_contract(), {}, [], _profiles(), today=TODAY)
    )


def test_runtime_collection_preserves_attempt_history_and_profile_selection(tmp_path: Path) -> None:
    pytest_record = _logical(profile="pr")
    vitest_record = _logical("vitest", "suite > retry [1:1]", profile="main")
    nightly_record = _logical("playwright", "flow > nightly [1:1]", profile="nightly")
    _write_native(
        tmp_path,
        "main",
        pytest_record,
        [_instance(pytest_record)],
        primary=False,
    )
    _write_native(
        tmp_path,
        "main",
        vitest_record,
        [_instance(vitest_record, attempts=2, results=["failed", "passed"])],
    )
    stale_fallback = _write_native(
        tmp_path,
        "main",
        vitest_record,
        [_instance(vitest_record, attempts=3, results=["failed", "failed", "passed"])],
        primary=False,
    )
    stale_fallback.touch()

    runtime, complete, errors = collect_runtime(
        tmp_path,
        [pytest_record, vitest_record, nightly_record],
        _profiles(),
        "main",
        require_runtime=True,
    )

    assert errors == []
    assert complete is True
    assert len(runtime) == 2
    retried = next(item for item in runtime if item["framework"] == "vitest")
    assert retried["initialResult"] == "failed"


def test_attempt_history_contract_accepts_visible_nonexecution_and_rejects_bad_types() -> None:
    record = _logical()
    assert governance_reporting._valid_attempt_history(
        _instance(record, attempts=0, executed=False)
    )
    invalid = _instance(record)
    invalid["attempts"] = "one"
    assert not governance_reporting._valid_attempt_history(invalid)


def test_runtime_governance_blocks_dynamic_ignores_blind_retries_and_quarantine_nonexecution(
) -> None:
    critical = _logical(criticality="critical")
    retry = _logical(selector="test_retry")
    quarantine = _logical(selector="test_quarantine")
    entries = [
        _entry(
            retry,
            "retry",
            retryPolicy={"maxAttempts": 2, "preserveFirstFailure": True},
        ),
        _entry(quarantine, compensatingMeasure="Run the deterministic probe."),
    ]
    runtime = [
        _instance(critical, attempts=0, executed=False),
        _instance(retry, attempts=3, results=["failed", "failed", "passed"]),
        _instance(quarantine, attempts=0, executed=False),
    ]

    errors = validate_runtime_governance(
        _contract(*entries), [critical, retry, quarantine], runtime
    )

    assert any("ungoverned runtime skipped" in error for error in errors)
    assert any("critical test cannot be ignored at runtime" in error for error in errors)
    assert any("exceeds governed maximum" in error for error in errors)
    assert any("quarantine did not execute" in error for error in errors)

    retry_without_entry = _instance(
        retry, attempts=2, results=["failed", "passed"]
    )
    assert validate_runtime_governance(_contract(), [retry], [retry_without_entry]) == [
        f"ungoverned runtime retry: {retry['logicalCaseId']}"
    ]
    governed_retry = _entry(
        retry,
        "retry",
        retryPolicy={"maxAttempts": 2, "preserveFirstFailure": True},
    )
    assert validate_runtime_governance(
        _contract(governed_retry),
        {},
        [retry_without_entry, {"logicalCaseId": None}],
    ) == []


def test_runtime_collection_rejects_missing_incomplete_malformed_and_hidden_history(
    tmp_path: Path,
) -> None:
    record = _logical()
    path = _write_native(
        tmp_path,
        "main",
        record,
        [_instance(record, attempts=2, results=["failed"])],
        complete=False,
        anomalies=["collector error"],
    )
    _runtime, complete, errors = collect_runtime(
        tmp_path, [record], _profiles(), "main", require_runtime=True
    )
    assert complete is False
    assert any("incomplete" in error for error in errors)
    assert any("hides attempt history" in error for error in errors)

    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["instances"] = {}
    path.write_text(json.dumps(payload), encoding="utf-8")
    assert any(
        "invalid native runtime instances" in error
        for error in collect_runtime(
            tmp_path, [record], _profiles(), "main", require_runtime=True
        )[2]
    )

    payload["framework"] = "vitest"
    path.write_text(json.dumps(payload), encoding="utf-8")
    assert any(
        "invalid native runtime evidence" in error
        for error in collect_runtime(
            tmp_path, [record], _profiles(), "main", require_runtime=True
        )[2]
    )

    path.unlink()
    assert collect_runtime(
        tmp_path, [record], _profiles(), "main", require_runtime=True
    )[2] == ["missing native runtime evidence for pytest"]
    assert collect_runtime(
        tmp_path, [record], _profiles(), "main", require_runtime=False
    )[2] == []


def test_runtime_collection_reports_framework_mismatch_and_missing_cases(tmp_path: Path) -> None:
    first = _logical(selector="test_first")
    second = _logical(selector="test_second")
    wrong = _logical("vitest", "suite > wrong [1:1]")
    instance = _instance(first)
    instance["logicalCaseId"] = wrong["logicalCaseId"]
    _write_native(tmp_path, "main", first, [None, instance, _instance(first)])
    inventory = [first, second, wrong]

    runtime, complete, errors = collect_runtime(
        tmp_path, inventory, _profiles(), "main", require_runtime=True
    )

    assert len(runtime) == 1
    assert complete is False
    assert any("framework mismatch" in error for error in errors)
    assert any("misses 1" in error for error in errors)
    assert collect_runtime(tmp_path, [], _profiles(), "main", require_runtime=True) == (
        [],
        False,
        [],
    )


def test_consolidated_report_contains_counts_expirations_profiles_and_instability(
    tmp_path: Path,
) -> None:
    quarantine = _logical("vitest", "suite > @quarantine [1:1]")
    retry = _logical(selector="test_retry")
    disabled = _logical(selector="test_disabled")
    entries = [
        _entry(quarantine, expiresOn="2026-07-19"),
        _entry(
            retry,
            "retry",
            expiresOn="2026-08-01",
            retryPolicy={"maxAttempts": 2, "preserveFirstFailure": True},
        ),
        _entry(disabled, "disabled", expiresOn="2026-10-01"),
    ]
    detections = [
        _detection(quarantine, "quarantine"),
        _detection(retry, "retry"),
        _detection(disabled, "disabled"),
        _detection(_logical(selector="test_skip"), "skipped"),
        _detection(_logical(selector="test_expected"), "expected_failure"),
    ]
    runtime = [
        {**_instance(quarantine, attempts=2, results=["failed", "passed"]), "framework": "vitest"},
        {**_instance(retry), "framework": "pytest"},
        {**_instance(disabled, attempts=0, executed=False), "framework": "pytest"},
    ]
    inventory = [quarantine, retry, disabled]

    report = build_report(
        _contract(*entries),
        inventory,
        detections,
        _profiles(),
        "nightly",
        runtime,
        True,
        ["synthetic violation"],
        today=TODAY,
    )
    output = tmp_path / "report.json"
    write_report(report, output)

    assert report["expirations"] == {
        "expired": [quarantine["logicalCaseId"]],
        "dueWithin30Days": [retry["logicalCaseId"]],
    }
    assert report["summary"]["instabilityRatePercent"] == pytest.approx(50.0)
    assert report["summary"]["attempts"] == 3
    assert report["summary"]["retries"] == 1
    assert report["summary"]["skippedCases"] == 1
    assert len(report["runtimeDetails"]) == 3
    assert all(item["selectedInProfile"] for item in report["entries"])
    assert json.loads(output.read_text(encoding="utf-8")) == report


def test_pytest_attempt_reporting_covers_pass_fail_rerun_skip_and_infrastructure() -> None:
    reports = [
        SimpleNamespace(when="call", outcome="passed"),
        SimpleNamespace(when="call", outcome="failed"),
        SimpleNamespace(when="call", outcome="rerun"),
        SimpleNamespace(when="call", outcome="skipped"),
    ]
    assert execution_counts_plugin._attempt_results(reports, True) == [
        "passed",
        "failed",
        "failed",
        "skipped",
    ]
    assert execution_counts_plugin._attempt_results([], True) == ["infrastructureError"]
    assert execution_counts_plugin._attempt_results([], False) == []
    assert execution_counts_plugin._attempt_results(
        [
            SimpleNamespace(when="call", outcome="passed"),
            SimpleNamespace(when="teardown", outcome="failed"),
        ],
        True,
    ) == ["infrastructureError"]


def test_governance_control_occurs_once_in_every_gate_plan_and_maps_to_aggregate() -> None:
    execution_contract = load_json(ROOT / "config/test-execution-profiles.json")
    for profile in ("pr", "main", "nightly", "release"):
        context = quality_gate.build_change_context("ci", [], execution_profile=profile)
        plan = quality_gate.build_execution_plan(context)
        commands = [
            command
            for command in plan.commands
            if command.step == "Test governance compliance"
        ]
        assert len(commands) == 1
        assert "--require-runtime" in commands[0].argv
        assert node_for_command(execution_contract, profile, commands[0].step) == "aggregate"

    targeted = quality_gate.build_change_context("fast", ["README.md"], execution_profile="pr")
    command = next(
        item
        for item in quality_gate.build_execution_plan(targeted).commands
        if item.step == "Test governance compliance"
    )
    assert "--require-runtime" not in command.argv


def test_real_repository_has_no_ignored_or_retry_mechanism_after_audit() -> None:
    detections = discover_mechanisms(ROOT)
    contract = load_json(ROOT / "config/test-governance.json")
    inventory = load_json(ROOT / "reports/test-classification-inventory.json")
    execution_contract = load_json(ROOT / "config/test-execution-profiles.json")

    assert detections == []
    assert validate_governance(
        contract, inventory, detections, execution_contract, today=TODAY
    ) == []


def test_check_repository_and_cli_success_failure_and_input_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    (tmp_path / "config").mkdir()
    (tmp_path / "reports").mkdir()
    (tmp_path / "config/test-governance.json").write_text(json.dumps(_contract()))
    (tmp_path / "config/test-execution-profiles.json").write_text(json.dumps(_profiles()))
    (tmp_path / "reports/test-classification-inventory.json").write_text("[]")
    report, errors = check_test_governance.check_repository(
        tmp_path,
        contract_path=Path("config/test-governance.json"),
        inventory_path=Path("reports/test-classification-inventory.json"),
        execution_contract_path=Path("config/test-execution-profiles.json"),
        output_path=Path("reports/test-governance-report.json"),
        profile="main",
        require_runtime=False,
        today=TODAY,
        cases=[],
    )
    assert errors == []
    assert report["summary"]["logicalCases"] == 0

    monkeypatch.setattr(
        check_test_governance,
        "check_repository",
        lambda *_args, **_kwargs: ({"summary": {"ok": 1}}, []),
    )
    assert check_test_governance.main([]) == 0
    assert '"ok": 1' in capsys.readouterr().out
    monkeypatch.setattr(
        check_test_governance,
        "check_repository",
        lambda *_args, **_kwargs: ({"summary": {}}, ["blocked"]),
    )
    assert check_test_governance.main([]) == 1
    assert "blocked" in capsys.readouterr().err
    monkeypatch.setattr(
        check_test_governance,
        "check_repository",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError("invalid")),
    )
    assert check_test_governance.main([]) == 2
    assert "could not run" in capsys.readouterr().err


def test_duplicate_and_invalid_json_are_rejected(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"schemaVersion":1,"schemaVersion":1}', encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate JSON property"):
        load_json(duplicate)
    duplicate.write_text("{", encoding="utf-8")
    with pytest.raises(ValueError, match="Invalid test-governance JSON"):
        load_json(duplicate)
    with pytest.raises(ValueError, match="Missing test-governance input"):
        load_json(tmp_path / "missing.json")


def test_script_entrypoint_uses_main(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        check_test_governance,
        "main",
        lambda _argv=None: 0,
    )
    monkeypatch.setitem(sys.modules, "Scripts.check_test_governance", check_test_governance)
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_path(str(ROOT / "Scripts/check_test_governance.py"), run_name="__main__")
    assert exit_info.value.code in {0, 1, 2}
