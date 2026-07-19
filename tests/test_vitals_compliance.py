from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))
import check_vitals_compliance as vitals_compliance  # noqa: E402
import report_vitals_coverage  # noqa: E402


def _read(relpath: str) -> str:
    return (ROOT / relpath).read_text(encoding="utf-8")


def _critical_vital_titles() -> list[str]:
    content = _read("docs/critical-paths.md")
    titles: list[str] = []
    in_official_list = False
    for line in content.splitlines():
        if line.strip() == "## Liste officielle des points vitaux":
            in_official_list = True
            continue
        if not in_official_list:
            continue
        if line.startswith("## "):
            break
        if line.startswith("- "):
            titles.append(line[2:].split(":", 1)[0].strip())
    return titles


def _traceability_sections() -> dict[str, list[str]]:
    content = _read("docs/vitals-traceability.md")
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for line in content.splitlines():
        if line.startswith("### "):
            current = line[4:].strip()
            sections[current] = []
            continue
        if current is None:
            continue
        match = re.match(r"- `([^`]+)`", line.strip())
        if match:
            sections[current].append(match.group(1))
    return sections


def test_each_critical_vital_has_traceability_section_and_existing_test_files() -> None:
    sections = _traceability_sections()
    for title in _critical_vital_titles():
        assert title in sections, f"Missing traceability section for vital: {title}"
        assert sections[title], f"Vital must reference at least one test: {title}"
        for relpath in sections[title]:
            assert (ROOT / relpath).exists(), (
                "Missing referenced test file for vital "
                f"{title}: {relpath}"
            )


def test_main_validation_dag_runs_vitals_compliance() -> None:
    tasks_path = ROOT / ".vscode" / "tasks.json"
    if not tasks_path.exists():
        pytest.skip(".vscode/tasks.json is optional in this checkout")
    tasks = __import__("json").loads(tasks_path.read_text(encoding="utf-8"))["tasks"]
    labels = [task["label"] for task in tasks]
    contract = __import__("json").loads(
        (ROOT / "config/test-execution-profiles.json").read_text(encoding="utf-8")
    )
    aggregate = next(node for node in contract["nodes"] if node["id"] == "aggregate")

    assert labels.count("Validation : profil main") == 1
    assert "Coverage:" + " 8 terminaux" not in labels
    assert "Coverage Vitals Compliance" in labels
    assert "Coverage Vitals Rates" in labels
    assert aggregate["commands"].count("Vitals coverage report") == 1
    assert aggregate["commands"].count("Vitals compliance") == 1


def test_vitals_compliance_script_exists() -> None:
    script = ROOT / "Scripts" / "check_vitals_compliance.py"
    assert script.exists(), "Missing Scripts/check_vitals_compliance.py"


def test_metric_pct_normalizes_empty_measurable_sets() -> None:
    assert vitals_compliance._metric_pct({"covered": 0, "total": 0}) == 100.0
    assert report_vitals_coverage._pct(0, 0) == "100.00%"


def test_vitals_preserve_empty_istanbul_function_and_branch_metrics() -> None:
    empty = {"total": 0, "covered": 0, "skipped": 0, "pct": 100}
    metrics = report_vitals_coverage._summary_istanbul_metrics(
        {
            "summary": {
                "statements": {"total": 1, "covered": 1, "skipped": 0, "pct": 100},
                "branches": empty,
                "functions": empty,
                "lines": {"total": 1, "covered": 1, "skipped": 0, "pct": 100},
            }
        }
    )

    assert metrics["branches"] == {"covered": 0, "total": 0}
    assert metrics["functions"] == {"covered": 0, "total": 0}
    assert vitals_compliance._metric_pct(metrics["branches"]) == 100.0
    assert vitals_compliance._metric_pct(metrics["functions"]) == 100.0


def test_append_vitals_rate_errors_flags_metrics_below_threshold(monkeypatch) -> None:
    monkeypatch.setattr(
        vitals_compliance,
        "build_vitals_report",
        lambda: [
            {
                "title": "Flux onboarding critique",
                "sources": {
                    "frontend_unit": {
                        "matched": ["frontend/src/App.tsx"],
                        "metrics": {
                            "statements": {"covered": 98, "total": 100},
                            "branches": {"covered": 89, "total": 100},
                            "functions": {"covered": 96, "total": 100},
                            "lines": {"covered": 100, "total": 100},
                        },
                    }
                },
            }
        ],
    )
    errors: list[str] = []

    vitals_compliance._append_vitals_rate_errors(errors)

    assert any("branches = 89.00%" in err for err in errors)
    assert not any("statements = 98.00%" in err for err in errors)


def test_append_vitals_rate_errors_flags_missing_matches(monkeypatch) -> None:
    monkeypatch.setattr(
        vitals_compliance,
        "build_vitals_report",
        lambda: [
            {
                "title": "Cookie IDMontecarlo",
                "sources": {
                    "e2e": {
                        "matched": [],
                        "metrics": {
                            "statements": {"covered": 0, "total": 0},
                            "branches": {"covered": 0, "total": 0},
                            "functions": {"covered": 0, "total": 0},
                            "lines": {"covered": 0, "total": 0},
                        },
                    }
                },
            }
        ],
    )
    errors: list[str] = []

    vitals_compliance._append_vitals_rate_errors(errors)

    assert "Vital coverage source has no matching files: Cookie IDMontecarlo / e2e" in errors


def test_vitals_aggregation_is_built_once_then_reused(
    tmp_path: Path,
    monkeypatch,
) -> None:
    source_paths = [
        tmp_path / "docs" / "vitals-coverage-map.json",
        tmp_path / "frontend" / "coverage" / "coverage-final.json",
        tmp_path / ".coverage.python.json",
        tmp_path / "frontend" / "coverage" / "e2e-coverage-summary.json",
        tmp_path / "frontend" / "e2e-coverage.config.json",
    ]
    for source_path in source_paths:
        source_path.parent.mkdir(parents=True, exist_ok=True)
        source_path.write_text("{}\n", encoding="utf-8")

    calls = 0

    def fake_load(_root: Path) -> dict:
        nonlocal calls
        calls += 1
        perfect = {
            metric: {"covered": 100, "total": 100}
            for metric in ("statements", "branches", "functions", "lines")
        }
        return {
            "mapping": {
                "vitals": [
                    {
                        "title": "Vital",
                        "sources": {"frontend_unit": ["frontend/src/App.tsx"]},
                    }
                ]
            },
            "frontend_unit_files": {
                "frontend/src/App.tsx": {"summary": perfect}
            },
            "backend_files": {},
            "e2e_files": {},
        }

    monkeypatch.setattr(
        report_vitals_coverage,
        "load_coverage_artifacts",
        fake_load,
    )
    report_path = tmp_path / "frontend" / "coverage" / "vitals-report.json"

    report_vitals_coverage.write_vitals_report_bundle(report_path, tmp_path)
    bundle = report_vitals_coverage.load_vitals_report_bundle(report_path, tmp_path)
    monkeypatch.setattr(
        vitals_compliance,
        "build_vitals_report",
        lambda: pytest.fail("Vitals aggregation must not be rebuilt"),
    )
    errors: list[str] = []
    vitals_compliance._append_vitals_rate_errors(errors, bundle["report"])

    assert calls == 1
    assert errors == []


def test_extractors_and_invalid_metric_paths() -> None:
    critical = "intro\n## Liste officielle des points vitaux\n- Vital: detail\n## End\n- ignored"
    assert vitals_compliance._extract_critical_vitals(critical) == ["Vital: detail"]
    traceability = "ignored\n### Vital\ntext\n- `tests/test_vital.py`\n"
    assert vitals_compliance._extract_traceability_sections(traceability) == {
        "Vital": ["tests/test_vital.py"]
    }
    assert vitals_compliance._metric_pct({"covered": -1, "total": 2}) is None
    assert vitals_compliance._metric_pct({"covered": 3, "total": 2}) is None
    assert vitals_compliance._metric_pct({"covered": 1, "total": 2}) == 50.0
    assert report_vitals_coverage._pct(1, 0) == "n/a"
    assert report_vitals_coverage._pct(1, 2) == "50.00%"


def test_vitals_rate_errors_cover_empty_invalid_and_build_failure(monkeypatch) -> None:
    errors: list[str] = []
    vitals_compliance._append_vitals_rate_errors(
        errors,
        [
            {"title": "Empty", "sources": {}},
            {
                "title": "Invalid",
                "sources": {
                    "backend": {
                        "matched": ["backend/a.py"],
                        "metrics": {"lines": {"covered": 3, "total": 2}},
                    }
                },
            },
        ],
    )
    assert "Vital has no coverage sources: Empty" in errors
    assert any("has no data" in error for error in errors)

    monkeypatch.setattr(
        vitals_compliance,
        "build_vitals_report",
        lambda: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    errors = []
    vitals_compliance._append_vitals_rate_errors(errors)
    assert errors == ["Unable to build vitals coverage report: boom"]


def _perfect_report() -> list[dict]:
    return [
        {
            "title": "Vital",
            "sources": {
                "backend": {
                    "matched": ["backend/a.py"],
                    "metrics": {
                        "statements": {"covered": 1, "total": 1},
                        "branches": {"covered": 0, "total": 0},
                        "lines": {"covered": 1, "total": 1},
                    },
                }
            },
        }
    ]


def test_vitals_compliance_main_success_and_structural_failures(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    critical = tmp_path / "critical.md"
    traceability = tmp_path / "trace.md"
    tasks = tmp_path / "tasks.json"
    monkeypatch.setattr(vitals_compliance, "CRITICAL_PATHS", critical)
    monkeypatch.setattr(vitals_compliance, "TRACEABILITY", traceability)
    monkeypatch.setattr(vitals_compliance, "TASKS", tasks)
    monkeypatch.setattr(
        vitals_compliance,
        "EXECUTION_PROFILES",
        tmp_path / "config/test-execution-profiles.json",
    )
    monkeypatch.setattr(vitals_compliance, "ROOT", tmp_path)

    assert vitals_compliance.main([]) == 1
    assert "Missing docs/critical-paths.md" in capsys.readouterr().err

    critical.write_text(
        "## Liste officielle des points vitaux\n"
        "- Vital: detail\n- Missing: detail\n- Ghost: detail\n",
        encoding="utf-8",
    )
    traceability.write_text(
        "### Vital\n- `tests/missing.py`\n### Missing\n",
        encoding="utf-8",
    )
    tasks.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(vitals_compliance, "build_vitals_report", _perfect_report)
    assert vitals_compliance.main([]) == 1
    error = capsys.readouterr().err
    assert "Missing referenced test file" in error
    assert "Vital has no referenced tests" in error
    assert "Missing traceability section for vital: Ghost" in error
    assert "Missing VS Code task" in error

    vitals_compliance.EXECUTION_PROFILES.parent.mkdir()
    vitals_compliance.EXECUTION_PROFILES.write_text('{"nodes": []}', encoding="utf-8")
    legacy = "Coverage:" + " 8 terminaux"
    tasks.write_text(
        __import__("json").dumps(
            {
                "tasks": [
                    {"label": "Coverage Vitals Compliance"},
                    {"label": "Coverage Vitals Rates"},
                    {"label": legacy},
                ]
            }
        ),
        encoding="utf-8",
    )
    assert vitals_compliance.main([]) == 1
    error = capsys.readouterr().err
    assert "Legacy coverage validation task must be removed" in error
    assert "Main DAG aggregate must include Vitals coverage report once" in error
    assert "Main DAG aggregate must include Vitals compliance once" in error

    test_file = tmp_path / "tests" / "ok.py"
    test_file.parent.mkdir()
    test_file.write_text("", encoding="utf-8")
    traceability.write_text("### Vital\n- `tests/ok.py`\n", encoding="utf-8")
    critical.write_text(
        "## Liste officielle des points vitaux\n- Vital: detail\n", encoding="utf-8"
    )
    tasks.write_text(
        '{"tasks": ['
        '{"label": "Coverage Vitals Compliance"},'
        '{"label": "Coverage Vitals Rates"},'
        '{"label": "Validation : profil main"}'
        "]}",
        encoding="utf-8",
    )
    vitals_compliance.EXECUTION_PROFILES.write_text(
        '{"nodes": [{"id": "aggregate", "commands": '
        '["Vitals coverage report", "Vitals compliance"]}]}',
        encoding="utf-8",
    )
    assert vitals_compliance.main([]) == 0


def test_vitals_compliance_main_loads_report_and_rejects_invalid_bundle(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    monkeypatch.setattr(vitals_compliance, "CRITICAL_PATHS", ROOT / "docs/critical-paths.md")
    monkeypatch.setattr(vitals_compliance, "TRACEABILITY", ROOT / "docs/vitals-traceability.md")
    monkeypatch.setattr(vitals_compliance, "TASKS", ROOT / ".vscode/tasks.json")
    monkeypatch.setattr(vitals_compliance, "ROOT", ROOT)
    report = tmp_path / "bad.json"
    report.write_text("{}", encoding="utf-8")
    assert vitals_compliance.main(["--report-json", str(report)]) == 1
    assert "Invalid Vitals coverage report schema" in capsys.readouterr().err


def test_raw_payload_and_istanbul_aggregation_resolution() -> None:
    payload = {
        "statementMap": {
            "0": {"start": {"line": 1}},
            "1": {"start": {}},
            "2": {"start": {"line": 1}},
        },
        "s": {"0": 0, "1": 1, "2": 1},
        "fnMap": {"0": {}, "1": {}},
        "f": {"0": 1, "1": 0},
        "b": {"0": [1, 0]},
    }
    metrics = report_vitals_coverage._raw_istanbul_metrics(payload)
    assert metrics["statements"] == {"covered": 2, "total": 3}
    assert metrics["functions"] == {"covered": 1, "total": 2}
    assert metrics["branches"] == {"covered": 1, "total": 2}
    assert metrics["lines"] == {"covered": 1, "total": 1}
    assert report_vitals_coverage._payload_metrics({})["lines"] == {
        "covered": 0,
        "total": 0,
    }

    aggregated = report_vitals_coverage._aggregate_istanbul(
        {
            "C:/repo/src/exact.ts": {"summary": {"lines": {"covered": 1, "total": 1}}},
            "C:/other/unique.ts": payload,
        },
        ["C:/repo/src/exact.ts", "other/unique.ts", "missing.ts"],
    )
    assert len(aggregated["matched"]) == 2
    basename = report_vitals_coverage._aggregate_istanbul(
        {"C:/unique/name.ts": payload}, ["different/name.ts"]
    )
    assert basename["matched"] == ["C:/unique/name.ts"]


def test_backend_aggregation_and_report_building_cover_each_source() -> None:
    backend = report_vitals_coverage._aggregate_backend(
        {
            "C:/repo/backend/a.py": {
                "summary": {
                    "num_statements": 3,
                    "num_branches": 2,
                    "covered_branches": 1,
                },
                "missing_lines": [2],
            }
        },
        ["C:/repo/backend/a.py", "missing.py"],
    )
    assert backend["metrics"]["lines"] == {"covered": 2, "total": 3}
    basename_backend = report_vitals_coverage._aggregate_backend(
        {"C:/repo/backend/a.py": {"summary": {"num_statements": 1}}}, ["a.py"]
    )
    assert basename_backend["matched"] == ["C:/repo/backend/a.py"]
    artifacts = {
        "mapping": {
            "vitals": [
                {
                    "title": "All",
                    "sources": {
                        "frontend_unit": ["a.ts"],
                        "backend": ["a.py"],
                        "e2e": ["a.ts"],
                    },
                }
            ]
        },
        "frontend_unit_files": {},
        "backend_files": {},
        "e2e_files": {},
    }
    report = report_vitals_coverage.build_vitals_report(artifacts)
    assert set(report[0]["sources"]) == {"frontend_unit", "backend", "e2e"}


def test_load_artifacts_bundle_validation_render_and_main(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    paths = report_vitals_coverage._paths(tmp_path)
    for path in paths.values():
        path.parent.mkdir(parents=True, exist_ok=True)
    paths["mapping"].write_text('{"vitals": []}', encoding="utf-8")
    paths["frontend_unit"].write_text("{}", encoding="utf-8")
    paths["backend"].write_text('{"files": {}}', encoding="utf-8")
    paths["e2e"].write_text("{}", encoding="utf-8")
    paths["e2e_config"].write_text("{}", encoding="utf-8")
    monkeypatch.setattr(
        report_vitals_coverage,
        "load_validated_artifact",
        lambda *_a: {"byFile": []},
    )
    artifacts = report_vitals_coverage.load_coverage_artifacts(tmp_path)
    assert artifacts["mapping"] == {"vitals": []}

    bundle_path = tmp_path / "bundle.json"
    bundle = report_vitals_coverage.write_vitals_report_bundle(bundle_path, tmp_path)
    assert report_vitals_coverage.load_vitals_report_bundle(bundle_path, tmp_path) == bundle
    report_vitals_coverage.render_vitals_report(_perfect_report())
    assert "statements=100.00%" in capsys.readouterr().out

    for bad_payload, message in [
        ("not json", "Invalid Vitals coverage report artifact"),
        ("{}", "schema"),
        ('{"schemaVersion": 1, "report": {}}', "payload"),
        ('{"schemaVersion": 1, "report": [], "sourceArtifacts": []}', "identities"),
    ]:
        bundle_path.write_text(bad_payload, encoding="utf-8")
        with pytest.raises(ValueError, match=message):
            report_vitals_coverage.load_vitals_report_bundle(bundle_path, tmp_path)

    monkeypatch.setattr(report_vitals_coverage, "build_vitals_report", lambda: _perfect_report())
    assert report_vitals_coverage.main([]) == 0
    monkeypatch.setattr(
        report_vitals_coverage,
        "build_vitals_report",
        lambda: (_ for _ in ()).throw(ValueError("boom")),
    )
    assert report_vitals_coverage.main([]) == 1
    assert "Unable to build" in capsys.readouterr().out


def test_bundle_identity_validation_and_output_main(tmp_path: Path, monkeypatch, capsys) -> None:
    source = tmp_path / "source.json"
    source.write_text("{}", encoding="utf-8")
    bundle_path = tmp_path / "bundle.json"
    base = {"schemaVersion": 1, "report": [], "sourceArtifacts": []}

    for identity, message in [
        ("invalid", "Invalid Vitals source artifact identity"),
        ({"path": "missing.json"}, "Missing Vitals source artifact"),
    ]:
        payload = {**base, "sourceArtifacts": [identity]}
        bundle_path.write_text(__import__("json").dumps(payload), encoding="utf-8")
        with pytest.raises(ValueError, match=message):
            report_vitals_coverage.load_vitals_report_bundle(bundle_path, tmp_path)

    identity = report_vitals_coverage._artifact_identity(source, tmp_path)
    payload = {**base, "sourceArtifacts": [identity]}
    bundle_path.write_text(__import__("json").dumps(payload), encoding="utf-8")
    source.write_text("changed", encoding="utf-8")
    with pytest.raises(ValueError, match="Stale Vitals coverage report"):
        report_vitals_coverage.load_vitals_report_bundle(bundle_path, tmp_path)

    report = [
        {
            "title": "Functions",
            "sources": {
                "frontend": {
                    "metrics": {
                        "statements": {"covered": 1, "total": 1},
                        "branches": {"covered": 1, "total": 1},
                        "functions": {"covered": 1, "total": 1},
                        "lines": {"covered": 1, "total": 1},
                    }
                }
            },
        }
    ]
    report_vitals_coverage.render_vitals_report(report)
    assert "functions=100.00%" in capsys.readouterr().out

    output = tmp_path / "output.json"
    monkeypatch.setattr(
        report_vitals_coverage,
        "write_vitals_report_bundle",
        lambda path: {"report": report},
    )
    assert report_vitals_coverage.main(["--output", str(output)]) == 0
