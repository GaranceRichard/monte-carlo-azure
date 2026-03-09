from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))
import check_vitals_compliance as vitals_compliance  # noqa: E402


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


def test_metric_pct_handles_missing_totals() -> None:
    assert vitals_compliance._metric_pct({"covered": 0, "total": 0}) is None


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
