from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(relpath: str) -> str:
    return (ROOT / relpath).read_text(encoding="utf-8")


def test_dod_docs_exist_and_are_linked_from_readme() -> None:
    dod = ROOT / "docs/definition-of-done.md"
    critical = ROOT / "docs/critical-paths.md"
    traceability = ROOT / "docs/vitals-traceability.md"
    vitals_map = ROOT / "docs/vitals-coverage-map.json"
    readme = _read("README.md")

    assert dod.exists(), "Missing docs/definition-of-done.md"
    assert critical.exists(), "Missing docs/critical-paths.md"
    assert traceability.exists(), "Missing docs/vitals-traceability.md"
    assert vitals_map.exists(), "Missing docs/vitals-coverage-map.json"
    assert "docs/definition-of-done.md" in readme
    assert "docs/critical-paths.md" in readme
    assert "docs/vitals-traceability.md" in readme
    assert "docs/vitals-coverage-map.json" in readme


def test_dod_contains_required_sections() -> None:
    content = _read("docs/definition-of-done.md")
    for heading in [
        "1. Verifications obligatoires",
        "2. Couverture de code",
        "3. Exigences minimales par feature",
        "4. Pyramide de tests",
        "5. Securite, configuration et robustesse",
        "6. Qualite de changement",
    ]:
        assert heading in content, f"Missing DoD heading: {heading}"
    assert ">= 80%" in content
    assert "docs/critical-paths.md" in content
    assert "Integration: couverture globale >= 80%." in content


def test_frontend_required_scripts_exist() -> None:
    package_json = json.loads(_read("frontend/package.json"))
    scripts = package_json.get("scripts", {})
    for script in ["lint", "build", "test:e2e", "test:unit:coverage"]:
        assert script in scripts, f"Missing frontend script: {script}"


def test_frontend_unit_coverage_thresholds_are_at_least_80() -> None:
    content = _read("frontend/vitest.config.js")
    thresholds = {}
    for metric in ["statements", "branches", "functions", "lines"]:
        match = re.search(rf"{metric}\s*:\s*(\d+)", content)
        assert match, f"Missing {metric} threshold in vitest config"
        thresholds[metric] = int(match.group(1))

    for metric, threshold in thresholds.items():
        assert threshold >= 80, f"Vitest threshold too low for {metric}: {threshold}"


def test_e2e_coverage_thresholds_are_at_least_80() -> None:
    config = json.loads(_read("frontend/e2e-coverage.config.json"))
    assert set(config["thresholds"]) == {
        "statements",
        "branches",
        "functions",
        "lines",
    }
    for metric, value in config["thresholds"].items():
        assert value >= 80, f"E2E threshold too low for {metric}: {value}"

    scripts = json.loads(_read("frontend/package.json"))["scripts"]
    assert scripts["test:e2e"] == "node scripts/run-e2e-coverage.mjs"
    assert (
        scripts["test:e2e:coverage:console"]
        == "node scripts/run-e2e-coverage.mjs --reporter=line"
    )


def test_ci_enforces_required_checks() -> None:
    ci = _read(".github/workflows/ci.yml")
    gate = _read("Scripts/quality_gate.py")
    pages = _read(".github/workflows/pages.yml")

    assert "python Scripts/quality_gate.py ci" in ci
    assert "npm run lint" not in ci
    assert "npm run test:e2e" not in ci
    assert "npm run build" not in ci
    assert "--cov-fail-under=80" in gate
    assert 'const requiredJobs = ["quality-gate"]' in pages
    assert "backend-tests" not in pages
    assert "frontend-tests" not in pages


def test_coverage_tasks_separate_repo_compliance_and_backend_full() -> None:
    tasks_path = ROOT / ".vscode" / "tasks.json"
    if not tasks_path.exists():
        # Optional local developer tooling file; may be absent in CI checkouts.
        return
    tasks_content = tasks_path.read_text(encoding="utf-8")
    assert '"label": "Coverage: 8 terminaux"' in tasks_content
    assert '"label": "Coverage Back (Full)"' in tasks_content
    assert '"label": "Coverage Vitals Compliance"' in tasks_content
    assert '"label": "Coverage Vitals Rates"' in tasks_content
    assert '"label": "Coverage Integration (Backend API)"' not in tasks_content
    assert '"label": "Coverage Repo Compliance"' not in tasks_content
    assert "tests/test_repo_compliance.py" not in tasks_content
    assert "--cov=tests.test_repo_compliance" not in tasks_content
    assert "--cov=backend" in tasks_content
    assert "--cov-fail-under=80" in tasks_content
