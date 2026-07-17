from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import check_maintainability  # noqa: E402
import maintainability_config  # noqa: E402
import maintainability_dependencies  # noqa: E402
import maintainability_metrics  # noqa: E402


def _config() -> dict:
    return {
        "schemaVersion": 1,
        "sourcePatterns": ["src/*.py", "src/**/*.py"],
        "limits": {
            "file.lines": 10,
            "file.complexity": 5,
            "function.lines": 4,
            "function.complexity": 2,
        },
        "dependencyRules": [],
    }


def _snapshot(*, value: int = 20) -> dict:
    return {
        "schemaVersion": 1,
        "limits": _config()["limits"],
        "metrics": [
            {
                "path": "src/module.py",
                "metric": "function.complexity",
                "limit": 2,
                "value": value,
                "symbol": "calculate",
            }
        ],
        "cycles": [],
        "dependencyViolations": [],
        "mojibake": [],
    }


def _empty_baseline() -> dict:
    baseline = _snapshot()
    baseline["metrics"] = []
    return baseline


def test_identical_baseline_passes() -> None:
    snapshot = _snapshot()

    assert check_maintainability.compare_snapshot(snapshot, snapshot, []) == []


def test_improvement_passes_while_debt_remains_above_the_limit() -> None:
    baseline = _snapshot(value=20)
    improved = _snapshot(value=18)

    assert check_maintainability.compare_snapshot(improved, baseline, []) == []


def test_new_violation_fails() -> None:
    errors = check_maintainability.compare_snapshot(_snapshot(), _empty_baseline(), [])

    assert len(errors) == 1
    assert "baseline=none" in errors[0]


def test_aggravation_reports_file_metric_baseline_and_observed_value() -> None:
    errors = check_maintainability.compare_snapshot(
        _snapshot(value=21), _snapshot(value=20), []
    )

    assert errors == [
        "src/module.py: metric=function.complexity symbol=calculate "
        "baseline=20 observed=21 limit=2"
    ]


def test_justified_declarative_exception_passes() -> None:
    exception = {
        "id": "synthetic-complexity",
        "kind": "metric",
        "path": "src/module.py",
        "metric": "function.complexity",
        "symbol": "calculate",
        "justification": "Synthetic fixture intentionally exercises a complex function.",
    }

    assert (
        check_maintainability.compare_snapshot(
            _snapshot(), _empty_baseline(), [exception]
        )
        == []
    )


def test_windows_and_linux_paths_share_one_normalized_form() -> None:
    assert check_maintainability.normalize_path(r"frontend\src\hooks\useData.ts") == (
        "frontend/src/hooks/useData.ts"
    )
    assert check_maintainability.normalize_path("./frontend/src/hooks/useData.ts") == (
        "frontend/src/hooks/useData.ts"
    )


def test_new_dependency_cycle_is_detected(tmp_path: Path) -> None:
    source = tmp_path / "src"
    source.mkdir()
    (source / "a.py").write_text("import src.b\n", encoding="utf-8")
    (source / "b.py").write_text("import src.a\n", encoding="utf-8")

    snapshot = check_maintainability.build_snapshot(
        tmp_path,
        _config(),
        tracked_paths=["src/a.py", "src/b.py"],
    )
    errors = check_maintainability.compare_snapshot(snapshot, _empty_baseline(), [])

    assert snapshot["cycles"] == [
        {
            "nodes": ["src/a.py", "src/b.py"],
            "edges": [["src/a.py", "src/b.py"], ["src/b.py", "src/a.py"]],
        }
    ]
    assert any("metric=dependency.cycle" in error for error in errors)


def test_new_documented_dependency_direction_violation_is_detected(
    tmp_path: Path,
) -> None:
    source = tmp_path / "src"
    source.mkdir()
    (source / "a.py").write_text("import src.b\n", encoding="utf-8")
    (source / "b.py").write_text("VALUE = 1\n", encoding="utf-8")
    config = _config()
    config["dependencyRules"] = [
        {
            "id": "synthetic-direction",
            "sourcePatterns": ["src/a.py"],
            "forbiddenPatterns": ["src/b.py"],
        }
    ]

    snapshot = check_maintainability.build_snapshot(
        tmp_path,
        config,
        tracked_paths=["src/a.py", "src/b.py"],
    )
    errors = check_maintainability.compare_snapshot(snapshot, _empty_baseline(), [])

    assert snapshot["dependencyViolations"] == [
        {"rule": "synthetic-direction", "source": "src/a.py", "target": "src/b.py"}
    ]
    assert any("metric=dependency.direction" in error for error in errors)


def test_new_mojibake_is_detected_in_a_tracked_text_file(tmp_path: Path) -> None:
    (tmp_path / "notes.md").write_text("Fran\u00c3\u00a7ais cassé\n", encoding="utf-8")

    snapshot = check_maintainability.build_snapshot(
        tmp_path,
        _config(),
        tracked_paths=["notes.md"],
    )
    errors = check_maintainability.compare_snapshot(snapshot, _empty_baseline(), [])

    assert snapshot["mojibake"] == [
        {"path": "notes.md", "pattern": "utf8-as-latin1-a-tilde", "count": 1}
    ]
    assert any("notes.md: metric=mojibake" in error for error in errors)


def test_exception_without_justification_is_rejected(tmp_path: Path) -> None:
    config_path = tmp_path / "config.json"
    baseline_path = tmp_path / "baseline.json"
    exceptions_path = tmp_path / "exceptions.json"
    config_path.write_text(json.dumps(_config()), encoding="utf-8")
    baseline_path.write_text(json.dumps(_empty_baseline()), encoding="utf-8")
    exceptions_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "exceptions": [{"id": "missing-reason", "kind": "metric"}],
            }
        ),
        encoding="utf-8",
    )

    try:
        check_maintainability.load_inputs(
            config_path, baseline_path, exceptions_path
        )
    except ValueError as exc:
        assert "requires a justification" in str(exc)
    else:
        raise AssertionError("An unjustified exception must be rejected.")


def test_python_and_javascript_metrics_cover_supported_constructs() -> None:
    python_text = """class Worker:
    async def run(self, values):
        return [value for value in values if value and value > 1]

def choose(a, b):
    return a if a or b else b
"""
    lines, complexity, functions = maintainability_metrics.source_metrics("worker.py", python_text)
    assert lines == 5
    assert complexity > 1
    assert [item.symbol for item in functions] == ["Worker.run", "choose"]
    assert all(item.complexity > 1 for item in functions)

    javascript = """// ignored if (x)
const choose = (value) => {
  if (value && value > 1) { return value; }
  return 0;
};
const choose = (value) => { return value ? 1 : 0; };
broken(value) {
"""
    _, js_complexity, js_functions = maintainability_metrics.source_metrics("worker.ts", javascript)
    assert js_complexity > 1
    assert [item.symbol for item in js_functions] == ["choose", "choose#2"]

    nested = "def outer():\n    def inner():\n        return 1\n    return inner()\n"
    maintainability_metrics.source_metrics("nested.py", nested)


def test_metric_debt_records_file_and_function_values() -> None:
    limits = {key: 0 for key in _config()["limits"]}
    debt = maintainability_metrics.collect_metric_debt(
        {"src/a.py": "def work(flag):\n    if flag:\n        return 1\n    return 0\n"},
        limits,
    )
    assert {item["metric"] for item in debt} == {
        "file.lines",
        "file.complexity",
        "function.lines",
        "function.complexity",
    }
    assert any(item.get("symbol") == "work" for item in debt)


def test_dependency_collection_resolves_relative_external_and_js_imports() -> None:
    texts = {
        "pkg/__init__.py": "from . import helper\n",
        "pkg/a.py": "from . import helper\n",
        "pkg/helper.py": "import external.package\n",
        "web/a.ts": "export { value } from './b'; import('external');\n",
        "web/b.ts": "export const value = 1;\n",
    }
    dependencies = maintainability_dependencies.collect_dependencies(texts)
    assert ("pkg/a.py", "pkg/helper.py") in dependencies
    assert ("pkg/helper.py", "external/package.py") in dependencies
    assert ("web/a.ts", "web/b.ts") in dependencies


def test_cycles_include_self_edges_and_ignore_edges_outside_graph() -> None:
    cycles = maintainability_dependencies.cyclic_components(
        {"a.py", "b.py"},
        {("a.py", "a.py"), ("b.py", "outside.py")},
    )
    assert cycles == [{"nodes": ["a.py"], "edges": [["a.py", "a.py"]]}]


def test_mojibake_scanner_handles_binary_invalid_utf8_empty_and_control_data(
    tmp_path: Path,
) -> None:
    (tmp_path / "binary.bin").write_bytes(b"a\0b")
    (tmp_path / "invalid.txt").write_bytes(b"\xff")
    (tmp_path / "empty.txt").write_bytes(b"")
    (tmp_path / "controls.txt").write_bytes(bytes(range(1, 9)))
    debt = check_maintainability._mojibake_debt(
        tmp_path, ["binary.bin", "controls.txt", "empty.txt", "invalid.txt"]
    )
    assert debt == [{"path": "invalid.txt", "pattern": "invalid-utf8", "count": 1}]
    assert not check_maintainability._is_probably_binary(b"")


def test_tracked_path_failure_and_success(tmp_path: Path, monkeypatch) -> None:
    class Result:
        def __init__(self, code: int) -> None:
            self.returncode = code
            self.stdout = b"b.py\0a.py\0"
            self.stderr = b"boom"

    monkeypatch.setattr(check_maintainability.subprocess, "run", lambda *_a, **_k: Result(0))
    assert check_maintainability._tracked_paths(tmp_path) == ["a.py", "b.py"]
    monkeypatch.setattr(check_maintainability.subprocess, "run", lambda *_a, **_k: Result(1))
    with pytest.raises(ValueError, match="Unable to list tracked files"):
        check_maintainability._tracked_paths(tmp_path)


def test_configuration_rejects_invalid_json_schema_payload_and_limit_drift(tmp_path: Path) -> None:
    bad = tmp_path / "bad.json"
    bad.write_text("not json", encoding="utf-8")
    with pytest.raises(ValueError, match="Invalid config"):
        maintainability_config.read_json(bad, "config")

    bad.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="schemaVersion"):
        maintainability_config.read_json(bad, "config")

    config = _config()
    config_path = tmp_path / "config.json"
    baseline_path = tmp_path / "baseline.json"
    exceptions_path = tmp_path / "exceptions.json"
    config_path.write_text(json.dumps(config), encoding="utf-8")
    changed = _empty_baseline()
    changed["limits"] = {**changed["limits"], "file.lines": 999}
    baseline_path.write_text(json.dumps(changed), encoding="utf-8")
    exceptions_path.write_text(
        json.dumps({"schemaVersion": 1, "exceptions": []}), encoding="utf-8"
    )
    with pytest.raises(ValueError, match="limits differ"):
        maintainability_config.load_inputs(config_path, baseline_path, exceptions_path)

    exceptions_path.write_text(
        json.dumps({"schemaVersion": 1, "exceptions": {}}), encoding="utf-8"
    )
    with pytest.raises(ValueError, match="exceptions list"):
        maintainability_config.load_inputs(config_path, baseline_path, exceptions_path)


def test_ratchet_existing_cycle_direction_and_mojibake_debt_stays_stable() -> None:
    baseline = _empty_baseline()
    baseline["cycles"] = [{"nodes": ["a", "b"], "edges": [["a", "b"], ["b", "a"]]}]
    baseline["dependencyViolations"] = [{"rule": "r", "source": "a", "target": "b"}]
    baseline["mojibake"] = [{"path": "notes", "pattern": "invalid", "count": 2}]
    assert check_maintainability.compare_snapshot(baseline, baseline, []) == []

    snapshot = json.loads(json.dumps(baseline))
    snapshot["cycles"][0]["edges"].append(["a", "a"])
    snapshot["mojibake"][0]["count"] = 3
    errors = check_maintainability.compare_snapshot(snapshot, baseline, [])
    assert any("new_edges" in error for error in errors)
    assert any("baseline=2 observed=3" in error for error in errors)
    exception = {
        "kind": "mojibake",
        "path": "notes",
        "pattern": "invalid",
        "justification": "Synthetic exception.",
    }
    assert not any(
        "metric=mojibake" in error
        for error in check_maintainability.compare_snapshot(snapshot, baseline, [exception])
    )


def test_cli_writes_baseline_passes_fails_and_reports_loading_error(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    config_path = tmp_path / "config.json"
    baseline_path = tmp_path / "baseline.json"
    exceptions_path = tmp_path / "exceptions.json"
    config_path.write_text(json.dumps(_config()), encoding="utf-8")
    exceptions_path.write_text(
        json.dumps({"schemaVersion": 1, "exceptions": []}), encoding="utf-8"
    )
    monkeypatch.setattr(check_maintainability, "_tracked_paths", lambda _root: [])
    args = [
        "--root", str(tmp_path), "--config", str(config_path),
        "--baseline", str(baseline_path), "--exceptions", str(exceptions_path),
    ]
    assert check_maintainability.main([*args, "--write-baseline"]) == 0
    assert baseline_path.read_text(encoding="utf-8").endswith("\n")
    assert check_maintainability.main(args) == 0
    assert "ratchet passed" in capsys.readouterr().out

    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    baseline["metrics"] = []
    baseline_path.write_text(json.dumps(baseline), encoding="utf-8")
    source = tmp_path / "src"
    source.mkdir()
    (source / "large.py").write_text("\n".join(f"x{i} = {i}" for i in range(20)), encoding="utf-8")
    assert check_maintainability.main(args) == 1
    assert "new or aggravated debt" in capsys.readouterr().err
    assert check_maintainability.main(["--config", str(tmp_path / "missing")]) == 2
    assert "could not run" in capsys.readouterr().err
