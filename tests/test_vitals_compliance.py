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


def test_coverage_task_runs_vitals_compliance() -> None:
    tasks_path = ROOT / ".vscode" / "tasks.json"
    if not tasks_path.exists():
        pytest.skip(".vscode/tasks.json is optional in this checkout")
    content = tasks_path.read_text(encoding="utf-8")
    assert '"label": "Coverage: 8 terminaux"' in content
    assert '"label": "Coverage Vitals Compliance"' in content
    assert '"label": "Coverage Vitals Rates"' in content
    assert '"Coverage Vitals Compliance"' in content


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
        tmp_path / ".coverage.backend.json",
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
