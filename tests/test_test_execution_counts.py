from __future__ import annotations

import hashlib
import json
import runpy
import subprocess
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

import pytest

from Scripts import report_test_execution_counts as counts

ROOT = Path(__file__).resolve().parents[1]


def _logical(
    framework: str,
    name: str,
    *,
    status: str = "classified",
    nature: str | None = "unit",
) -> dict[str, Any]:
    extension = "py" if framework == "pytest" else "ts"
    source = f"tests/{framework}.{extension}"
    selector = name if framework == "pytest" else f"suite > {name} [1:1]"
    record = {
        "logicalCaseId": f"{framework}:{source}::{selector}",
        "framework": framework,
        "sourcePath": source,
        "selector": selector,
        "status": status,
    }
    if nature is not None:
        record["nature"] = nature
    return record


def _instance(
    logical: dict[str, Any],
    suffix: str,
    *,
    executed: bool = True,
    attempts: int = 1,
    result: str = "passed",
) -> dict[str, Any]:
    return {
        "instanceId": f"{logical['framework']}-{suffix}",
        "logicalCaseId": logical["logicalCaseId"],
        "executed": executed,
        "attempts": attempts,
        "result": result,
    }


def _repository(tmp_path: Path) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    inventory = [
        _logical("pytest", "test_parameterized"),
        _logical("vitest", "dynamic each", status="unresolved", nature=None),
        _logical("playwright", "project retry", nature="e2e"),
    ]
    native = {
        "pytest": [
            _instance(inventory[0], "parameter-1"),
            _instance(inventory[0], "parameter-2", executed=False, attempts=0, result="skipped"),
        ],
        "vitest": [
            _instance(inventory[1], "each-1", attempts=2),
            _instance(inventory[1], "each-2", result="todo", executed=False, attempts=0),
        ],
        "playwright": [
            _instance(inventory[2], "chromium", attempts=2),
            _instance(inventory[2], "firefox", result="infrastructureError"),
        ],
    }
    reports = tmp_path / "reports"
    reports.mkdir()
    (reports / "test-classification-inventory.json").write_text(
        json.dumps(inventory, indent=2) + "\n", encoding="utf-8"
    )
    native_root = reports / "test-execution-native"
    native_root.mkdir()
    for framework, instances in native.items():
        (native_root / f"{framework}.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "framework": framework,
                    "complete": True,
                    "instances": instances,
                    "anomalies": [],
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    return inventory, native


def test_consolidation_separates_logical_instances_attempts_and_results(tmp_path: Path) -> None:
    inventory, _native = _repository(tmp_path)

    report = counts.consolidate(tmp_path)

    assert report["totals"] == {
        "logicalCases": 3,
        "collectedInstances": 6,
        "executedInstances": 4,
        "skippedInstances": 2,
        "attempts": 6,
        "retries": 2,
        "results": {
            "passed": 3,
            "failed": 0,
            "skipped": 1,
            "todo": 1,
            "infrastructureError": 1,
        },
    }
    assert report["frameworks"]["pytest"]["logicalCases"] == 1
    assert report["frameworks"]["pytest"]["collectedInstances"] == 2
    assert report["classificationStatuses"]["unresolved"]["collectedInstances"] == 2
    assert "unresolved" not in report["natures"]
    assert report["natures"]["unit"]["logicalCases"] == 1
    assert [item["logicalCaseId"] for item in report["logicalCases"]] == sorted(
        item["logicalCaseId"] for item in inventory
    )
    raw_inventory = (tmp_path / "reports/test-classification-inventory.json").read_bytes()
    assert report["classificationInventorySha256"] == hashlib.sha256(raw_inventory).hexdigest()


def test_two_consolidations_are_byte_identical_and_cli_writes_the_report(tmp_path: Path) -> None:
    _repository(tmp_path)
    first = counts.write_report(counts.consolidate(tmp_path), tmp_path / "first.json")
    second = counts.write_report(counts.consolidate(tmp_path), tmp_path / "second.json")
    assert first == second

    assert counts.main(["--root", str(tmp_path), "--output", "cli.json"]) == 0
    assert (tmp_path / "cli.json").read_bytes() == first


@pytest.mark.parametrize(
    ("mutation", "message"),
    [
        (lambda data: data["pytest"].append(deepcopy(data["pytest"][0])), "belongs more than once"),
        (
            lambda data: data["pytest"][0].update(logicalCaseId="pytest:missing::test"),
            "Orphan native instance",
        ),
        (lambda data: data["vitest"].clear(), "absent from complete collection"),
        (
            lambda data: data["playwright"][0].update(attempts=0),
            "attempts contradict executed",
        ),
        (
            lambda data: data["vitest"][0].update(result="unknown"),
            "unsupported result",
        ),
    ],
)
def test_invalid_native_instances_are_rejected(tmp_path: Path, mutation, message: str) -> None:
    _inventory, native = _repository(tmp_path)
    mutation(native)
    for framework, instances in native.items():
        path = tmp_path / f"reports/test-execution-native/{framework}.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["instances"] = instances
        path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        counts.consolidate(tmp_path)


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda payload: payload.update(complete=False), "not complete"),
        (
            lambda payload: payload.update(anomalies=["ambiguous declaration position"]),
            "matching anomalies",
        ),
        (lambda payload: payload.update(schemaVersion=2), "artifact schema"),
        (lambda payload: payload.update(framework="unknown"), "Unsupported native"),
        (lambda payload: payload.update(instances={}), "instances must be an array"),
    ],
)
def test_incomplete_ambiguous_or_malformed_collection_is_rejected(
    tmp_path: Path, change, message: str
) -> None:
    _repository(tmp_path)
    path = tmp_path / "reports/test-execution-native/playwright.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    change(payload)
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        counts.consolidate(tmp_path)


def test_missing_framework_duplicate_json_and_invalid_inventory_are_rejected(
    tmp_path: Path,
) -> None:
    _repository(tmp_path)
    with pytest.raises(ValueError, match="missing: vitest"):
        counts.consolidate(
            tmp_path,
            native_paths=[
                Path("reports/test-execution-native/playwright.json"),
                Path("reports/test-execution-native/pytest.json"),
            ],
        )
    pytest_path = tmp_path / "reports/test-execution-native/pytest.json"
    pytest_path.write_text('{"schemaVersion":1,"schemaVersion":1}', encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate JSON property"):
        counts.load_json(pytest_path)
    pytest_path.write_text("{", encoding="utf-8")
    with pytest.raises(ValueError, match="Invalid JSON"):
        counts.load_json(pytest_path)
    with pytest.raises(ValueError, match="Missing execution-count artifact"):
        counts.load_json(tmp_path / "absent.json")

    assert counts._validate_inventory([_logical("pytest", "one")])[0]["framework"] == "pytest"
    for invalid, message in [
        ([], "non-empty"),
        ([None], "record at index"),
        ([{"framework": "pytest"}], "Missing logicalCaseId"),
        ([_logical("pytest", "one"), _logical("pytest", "one")], "Duplicate logicalCaseId"),
        ([_logical("unknown", "one")], "Unsupported framework"),
    ]:
        with pytest.raises(ValueError, match=message):
            counts._validate_inventory(invalid)


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda value: None, "expected an object"),
        (lambda value: value.pop("result"), "missing result"),
        (lambda value: value.update(instanceId=""), "instanceId must be non-empty"),
        (lambda value: value.update(logicalCaseId=""), "logicalCaseId must be non-empty"),
        (lambda value: value.update(executed=1), "executed must be boolean"),
        (lambda value: value.update(attempts=-1), "attempts must be a non-negative integer"),
    ],
)
def test_native_instance_contract_rejects_invalid_fields(change, message: str) -> None:
    logical = _logical("pytest", "test_one")
    value: Any = _instance(logical, "one")
    if message == "expected an object":
        value = None
    else:
        change(value)
    with pytest.raises(ValueError, match=message):
        counts._validate_instance(value, "pytest", 0)


def test_aggregate_invariants_and_cross_artifact_conflicts_are_rejected(tmp_path: Path) -> None:
    base = counts._empty_totals()
    for field, message in [
        ("collectedInstances", "collectedInstances invariant"),
        ("attempts", "attempts invariant"),
        ("passed", "result totals"),
    ]:
        invalid = deepcopy(base)
        if field == "passed":
            invalid["results"][field] = 1
        else:
            invalid[field] = 1
        with pytest.raises(ValueError, match=message):
            counts._validate_counts(invalid, "synthetic")

    inventory, _native = _repository(tmp_path)
    native_root = tmp_path / "reports/test-execution-native"
    with pytest.raises(ValueError, match="Duplicate native execution artifact"):
        counts.consolidate(
            tmp_path,
            native_paths=[
                native_root / "playwright.json",
                native_root / "playwright.json",
                native_root / "pytest.json",
                native_root / "vitest.json",
            ],
        )
    path = native_root / "pytest.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["anomalies"] = "not-an-array"
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match="anomalies must be an array"):
        counts.consolidate(tmp_path)

    path = native_root / "pytest.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["anomalies"] = []
    payload["instances"][0]["logicalCaseId"] = inventory[1]["logicalCaseId"]
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match="Framework mismatch"):
        counts.consolidate(tmp_path)


def test_script_entrypoint_uses_cli_arguments(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _repository(tmp_path)
    monkeypatch.setattr(
        sys,
        "argv",
        ["report_test_execution_counts.py", "--root", str(tmp_path), "--output", "runpy.json"],
    )
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_path(str(ROOT / "Scripts/report_test_execution_counts.py"), run_name="__main__")
    assert exit_info.value.code == 0
    assert (tmp_path / "runpy.json").is_file()


def test_report_shape_conforms_to_versioned_schema(tmp_path: Path) -> None:
    _repository(tmp_path)
    report = counts.consolidate(tmp_path)
    schema = json.loads(
        (ROOT / "config/test-execution-counts.schema.json").read_text(encoding="utf-8")
    )
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert report["schemaVersion"] == schema["x-schemaVersion"]
    assert set(report) == set(schema["required"])
    assert set(report["frameworks"]) == {"pytest", "vitest", "playwright"}
    required_counts = set(schema["$defs"]["counts"]["required"])
    required_results = set(schema["$defs"]["results"]["required"])
    for aggregate in [
        report["totals"],
        *report["frameworks"].values(),
        *report["classificationStatuses"].values(),
        *report["natures"].values(),
        *report["logicalCases"],
    ]:
        assert required_counts <= set(aggregate)
        assert set(aggregate["results"]) == required_results
        counts._validate_counts(aggregate, "schema test")


def test_pytest_native_hooks_count_parameters_classes_skip_xfail_and_setup_error(
    tmp_path: Path,
) -> None:
    tests_root = tmp_path / "tests"
    tests_root.mkdir()
    source = tests_root / "test_native.py"
    source.write_text(
        """import pytest

@pytest.mark.parametrize("value", [1, 2])
def test_parameter(value):
    assert value

class TestExample:
    def test_method(self):
        assert True

@pytest.mark.skip(reason="not executed")
def test_skip():
    raise AssertionError

@pytest.mark.xfail(reason="expected")
def test_xfail():
    assert False

@pytest.fixture
def broken():
    raise RuntimeError("setup failed")

def test_setup_error(broken):
    pass
""",
        encoding="utf-8",
    )
    logical = []
    for selector in [
        "test_parameter",
        "TestExample::test_method",
        "test_skip",
        "test_xfail",
        "test_setup_error",
    ]:
        logical.append(
            {
                "logicalCaseId": f"pytest:tests/test_native.py::{selector}",
                "framework": "pytest",
                "sourcePath": "tests/test_native.py",
                "selector": selector,
                "status": "classified",
                "nature": "unit",
            }
        )
    reports = tmp_path / "reports"
    reports.mkdir()
    (reports / "test-classification-inventory.json").write_text(
        json.dumps(logical), encoding="utf-8"
    )
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "-p",
            "tests.execution_counts_plugin",
            "--rootdir",
            str(tmp_path),
            str(source),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 1, completed.stdout + completed.stderr
    native = json.loads((reports / "test-execution-native/pytest.json").read_text(encoding="utf-8"))
    assert native["complete"] is True
    assert native["anomalies"] == []
    assert len(native["instances"]) == 6
    by_id = {item["instanceId"]: item for item in native["instances"]}
    assert by_id["tests/test_native.py::test_skip"]["executed"] is False
    assert by_id["tests/test_native.py::test_xfail"]["executed"] is True
    assert by_id["tests/test_native.py::test_setup_error"]["result"] == "infrastructureError"
    assert all(item["attempts"] == int(item["executed"]) for item in native["instances"])
