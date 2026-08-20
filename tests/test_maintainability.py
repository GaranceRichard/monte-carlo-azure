from __future__ import annotations

import json
import runpy
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import change_cost_baseline_render  # noqa: E402
import check_maintainability  # noqa: E402
import dependency_graph  # noqa: E402
import dependency_graph_common  # noqa: E402
import dependency_graph_render  # noqa: E402
import maintainability_config  # noqa: E402
import maintainability_dependencies  # noqa: E402
import maintainability_metrics  # noqa: E402
import report_change_cost_baseline  # noqa: E402
import report_dependency_graph  # noqa: E402

RATCHET_LIMITS = {
    "file.lines": 350,
    "file.complexity": 50,
    "function.lines": 50,
    "function.complexity": 15,
}


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
    errors = check_maintainability.compare_snapshot(_snapshot(value=21), _snapshot(value=20), [])

    assert errors == [
        "src/module.py: metric=function.complexity symbol=calculate baseline=20 observed=21 limit=2"
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

    assert check_maintainability.compare_snapshot(_snapshot(), _empty_baseline(), [exception]) == []


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
        check_maintainability.load_inputs(config_path, baseline_path, exceptions_path)
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


def test_repository_ratchet_limits_and_baseline_are_locked() -> None:
    config = json.loads((ROOT / "config" / "maintainability.json").read_text(encoding="utf-8"))
    baseline = json.loads(
        (ROOT / "config" / "maintainability-baseline.json").read_text(encoding="utf-8")
    )

    assert config["limits"] == RATCHET_LIMITS
    assert baseline["limits"] == RATCHET_LIMITS


def test_lower_ratchet_limits_block_the_first_new_violation() -> None:
    limits = {**RATCHET_LIMITS, "file.lines": 2}
    debt = maintainability_metrics.collect_metric_debt(
        {
            "src/at-limit.py": "first = 1\nsecond = 2\n",
            "src/over-limit.py": "first = 1\nsecond = 2\nthird = 3\n",
        },
        limits,
    )

    assert [item for item in debt if item["metric"] == "file.lines"] == [
        {
            "path": "src/over-limit.py",
            "metric": "file.lines",
            "limit": 2,
            "value": 3,
        }
    ]
    snapshot = {**_empty_baseline(), "limits": limits, "metrics": debt}
    baseline = {**_empty_baseline(), "limits": limits}
    assert any(
        "baseline=none" in error
        for error in check_maintainability.compare_snapshot(snapshot, baseline, [])
    )


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
    assert ("web/a.ts", "external") in dependencies

    observed_texts = {
        "pkg/__init__.py": "",
        "pkg/a.py": "from . import b\nimport external.lib\n",
        "pkg/b.py": "from . import a\n",
        "frontend/src/api.ts": "export const api = 1;\n",
        "frontend/src/api/internal.ts": "export type Internal = string;\n",
        "frontend/src/consumer.ts": (
            'import type { Internal } from "./api/internal";\n'
            'import value from "@scope/package/subpath";\n'
            'import "./style.css";\n'
            'const lazy = import("./lazy");\n'
        ),
        "frontend/src/lazy.ts": "export const lazy = true;\n",
        "frontend/src/style.css": "body {}\n",
        "frontend/scripts/run.mjs": (
            'const module = await server.ssrLoadModule("/src/consumer.ts");\n'
        ),
    }
    observed_edges = dependency_graph.collect_import_edges(observed_texts, set(observed_texts))
    targets = {item["target"] for item in observed_edges}
    assert {
        "pkg/b.py",
        "external:python:external",
        "external:npm:@scope/package",
        "frontend/src/style.css",
    } <= targets
    assert {"js-dynamic-import", "js-runtime-load"} <= {item["kind"] for item in observed_edges}
    assert (
        dependency_graph.elementary_cycles(set(observed_texts), observed_edges)[0]["phase"]
        == "runtime"
    )
    assert dependency_graph.deep_imports(observed_edges)[0]["crossedBoundary"] == (
        "frontend/src/api"
    )
    assert (
        dependency_graph.api_bypasses(observed_edges, set(observed_texts))[0]["facade"]
        == "frontend/src/api.ts"
    )

    unresolved = dependency_graph.collect_import_edges(
        {"frontend/src/a.ts": 'import "./missing";\n'},
        {"frontend/src/a.ts"},
    )
    assert unresolved[0]["target"] == "unresolved:frontend/src/missing"
    self_edge = {
        "source": "frontend/src/a.ts",
        "target": "frontend/src/a.ts",
        "line": 1,
        "kind": "synthetic",
        "phase": "compile",
        "specifier": "./a",
        "resolution": "internal",
    }
    assert dependency_graph.elementary_cycles({"frontend/src/a.ts"}, [self_edge])[0] == {
        "id": "CYC-001",
        "phase": "compile-involved",
        "nodes": ["frontend/src/a.ts"],
        "edges": [self_edge],
    }


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
        tmp_path,
        ["binary.bin", "controls.txt", "deleted.txt", "empty.txt", "invalid.txt"],
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

    monkeypatch.setattr(dependency_graph_common.subprocess, "run", lambda *_a, **_k: Result(0))
    assert dependency_graph.repository_paths(tmp_path) == ["a.py", "b.py"]
    monkeypatch.setattr(dependency_graph_common.subprocess, "run", lambda *_a, **_k: Result(1))
    with pytest.raises(RuntimeError, match="boom"):
        dependency_graph.repository_paths(tmp_path)


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
    exceptions_path.write_text(json.dumps({"schemaVersion": 1, "exceptions": []}), encoding="utf-8")
    with pytest.raises(ValueError, match="limits differ"):
        maintainability_config.load_inputs(config_path, baseline_path, exceptions_path)

    exceptions_path.write_text(json.dumps({"schemaVersion": 1, "exceptions": {}}), encoding="utf-8")
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
    exceptions_path.write_text(json.dumps({"schemaVersion": 1, "exceptions": []}), encoding="utf-8")
    monkeypatch.setattr(check_maintainability, "_tracked_paths", lambda _root: [])
    args = [
        "--root",
        str(tmp_path),
        "--config",
        str(config_path),
        "--baseline",
        str(baseline_path),
        "--exceptions",
        str(exceptions_path),
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

    report_path = tmp_path / "dependency-graph.json"
    document_path = tmp_path / "dependency-graph.md"
    graph_args = [
        "--root",
        str(ROOT),
        "--report",
        str(report_path),
        "--document",
        str(document_path),
    ]
    assert report_dependency_graph.main(graph_args) == 0
    assert report_dependency_graph.main([*graph_args, "--check"]) == 0
    document_path.write_text("stale\n", encoding="utf-8")
    assert report_dependency_graph.main([*graph_args, "--check"]) == 1
    assert "outputs are stale" in capsys.readouterr().err

    report = report_dependency_graph.build_report(ROOT)
    markdown_writer = getattr(dependency_graph_render, "render_" + "markdown")
    assert (
        json.loads((ROOT / "reports/dependency-graph.json").read_text(encoding="utf-8")) == report
    )
    assert (ROOT / "docs/dependency-graph.md").read_text(encoding="utf-8") == markdown_writer(
        report
    )
    assert {
        key: report["summary"][key]
        for key in ("cycles", "runtimeCycles", "missingEntrypoints", "apiBypasses")
    } == {
        "cycles": 2,
        "runtimeCycles": 0,
        "missingEntrypoints": 5,
        "apiBypasses": 2,
    }
    assert [cycle["nodes"] for cycle in report["observed"]["cycles"]] == [
        [
            "frontend/src/demoData.ts",
            "frontend/src/hooks/usePortfolioReport.ts",
            "frontend/src/hooks/simulationForecastService.ts",
            "frontend/src/hooks/simulationForecastCore.ts",
        ],
        [
            "frontend/src/hooks/simulationForecastCore.ts",
            "frontend/src/hooks/simulationForecastService.ts",
        ],
    ]
    assert {
        (item["source"], item["target"], item["line"], item["facade"])
        for item in report["interpretation"]["apiBypasses"]
    } == {
        (
            "frontend/src/hooks/simulationForecastCore.ts",
            "frontend/src/api/simulationMappers.ts",
            4,
            "frontend/src/api.ts",
        ),
        (
            "frontend/src/hooks/useSimulationHistory.ts",
            "frontend/src/storage/simulationHistoryMappers.ts",
            3,
            "frontend/src/storage.ts",
        ),
    }
    assert any(
        item["declaredIn"] == "Dockerfile" and item["target"] == "backend/api.py"
        for item in report["observed"]["entrypoints"]
    )
    assert any(
        item["kind"] == "js-runtime-load"
        and item["target"] == "frontend/src/statisticalCorpusRunner.ts"
        for item in report["observed"]["edges"]
    )
    report["interpretation"]["apiBypasses"] = []
    assert "Aucun selon la convention" in markdown_writer(report)

    change_report = report_change_cost_baseline.build_report(ROOT)
    change_markdown_writer = getattr(change_cost_baseline_render, "render_" + "markdown")
    assert (
        json.loads((ROOT / "reports/change-cost-baseline.json").read_text(encoding="utf-8"))
        == change_report
    )
    assert (ROOT / "docs/change-cost-baseline.md").read_text(
        encoding="utf-8"
    ) == change_markdown_writer(change_report)
    assert len(change_report["scenarios"]) == 3
    assert all(
        scenario["metrics"]["confirmedHotspotCount"] >= 1 for scenario in change_report["scenarios"]
    )
    without_hotspots = {**change_report, "confirmedHotspots": []}
    assert "Aucun fichier" in change_markdown_writer(without_hotspots)

    change_report_path = tmp_path / "change-cost.json"
    change_document_path = tmp_path / "change-cost.md"
    change_args = [
        "--root",
        str(ROOT),
        "--report",
        str(change_report_path),
        "--document",
        str(change_document_path),
    ]
    assert report_change_cost_baseline.main(change_args) == 0
    assert report_change_cost_baseline.main([*change_args, "--check"]) == 0
    change_document_path.write_text("stale\n", encoding="utf-8")
    assert report_change_cost_baseline.main([*change_args, "--check"]) == 1
    assert "outputs are stale" in capsys.readouterr().err

    synthetic_root = tmp_path / "synthetic-change-cost"
    synthetic_paths = {
        "backend/api_models.py": "one\n",
        "frontend/src/hooks/simulationForecastCore.ts": "one\ntwo\nthree\n",
        "config/test-execution-profiles.json": "{}\n",
    }
    for relative, content in synthetic_paths.items():
        target = synthetic_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    synthetic_scenarios = (
        {
            "id": "one",
            "title": "one",
            "justification": "fact",
            "evidence": [],
            "files": ["backend/api_models.py", "frontend/src/hooks/simulationForecastCore.ts"],
        },
        {
            "id": "two",
            "title": "two",
            "justification": "fact",
            "evidence": [],
            "files": [
                "frontend/src/hooks/simulationForecastCore.ts",
                "config/test-execution-profiles.json",
            ],
        },
    )
    synthetic_graph = {
        "schemaVersion": 1,
        "observed": {
            "nodes": [{"path": path} for path in synthetic_paths],
            "edges": [
                {
                    "source": "frontend/src/hooks/simulationForecastCore.ts",
                    "target": "backend/api_models.py",
                    "resolution": "internal",
                },
                {
                    "source": "config/test-execution-profiles.json",
                    "target": "frontend/src/hooks/simulationForecastCore.ts",
                    "resolution": "internal",
                },
            ],
        },
    }
    measured = report_change_cost_baseline.calculate_baseline(
        synthetic_root, synthetic_graph, synthetic_scenarios
    )
    assert [item["path"] for item in measured["confirmedHotspots"]] == [
        "frontend/src/hooks/simulationForecastCore.ts"
    ]
    with pytest.raises(ValueError, match="Scenario files are missing"):
        report_change_cost_baseline.calculate_baseline(
            synthetic_root, synthetic_graph, ({"files": ["backend/missing.py"]},)
        )
    with pytest.raises(ValueError, match="No layer attribution"):
        report_change_cost_baseline._layer("unknown/file.txt")

    change_script = ROOT / "Scripts/report_change_cost_baseline.py"
    monkeypatch.setattr(sys, "argv", [str(change_script), "--check"])
    with pytest.raises(SystemExit) as exc:
        runpy.run_path(str(change_script), run_name="__main__")
    assert exc.value.code == 0

    script = ROOT / "Scripts/report_dependency_graph.py"
    monkeypatch.setattr(sys, "argv", [str(script), "--check"])
    with pytest.raises(SystemExit) as exc:
        runpy.run_path(str(script), run_name="__main__")
    assert exc.value.code == 0

    monkeypatch.setattr(
        report_dependency_graph,
        "build_report",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("synthetic failure")),
    )
    assert report_dependency_graph.main([]) == 2
    assert "synthetic failure" in capsys.readouterr().err

    monkeypatch.setattr(
        report_change_cost_baseline,
        "build_report",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("synthetic failure")),
    )
    assert report_change_cost_baseline.main([]) == 2
    assert "synthetic failure" in capsys.readouterr().err
