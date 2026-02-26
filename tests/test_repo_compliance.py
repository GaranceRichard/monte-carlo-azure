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
    readme = _read("README.md")

    assert dod.exists(), "Missing docs/definition-of-done.md"
    assert critical.exists(), "Missing docs/critical-paths.md"
    assert "docs/definition-of-done.md" in readme
    assert "docs/critical-paths.md" in readme


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
    content = _read("frontend/tests/e2e/coverage.spec.js")
    checks = {
        "statements": r"summary\.statements\.pct\)\.toBeGreaterThanOrEqual\((\d+)\)",
        "branches": r"summary\.branches\.pct\)\.toBeGreaterThanOrEqual\((\d+)\)",
        "functions": r"summary\.functions\.pct\)\.toBeGreaterThanOrEqual\((\d+)\)",
        "lines": r"summary\.lines\.pct\)\.toBeGreaterThanOrEqual\((\d+)\)",
    }
    for metric, pattern in checks.items():
        match = re.search(pattern, content)
        assert match, f"Missing e2e threshold assertion for {metric}"
        value = int(match.group(1))
        assert value >= 80, f"E2E threshold too low for {metric}: {value}"


def test_ci_enforces_required_checks() -> None:
    ci = _read(".github/workflows/ci.yml")

    # Frontend checks
    assert "npm run lint -- --max-warnings 0" in ci
    assert "npm run test:e2e" in ci
    assert "npm run build" in ci

    # Backend checks (project can use pytest or manage.py style)
    assert ("python -m pytest" in ci) or ("python manage.py test" in ci)

    # Coverage gate for backend should be explicit in CI.
    assert (
        "--cov-fail-under=80" in ci
    ), "Backend CI should enforce a minimum coverage threshold (>=80%)."


def test_coverage_tasks_separate_repo_compliance_and_integration() -> None:
    tasks_content = _read(".vscode/tasks.json")
    assert '"label": "Coverage: 7 terminaux"' in tasks_content
    assert '"label": "Coverage Integration (Backend API)"' in tasks_content
    assert '"label": "Coverage DoD Compliance (Repo)"' in tasks_content
    assert "tests/test_repo_compliance.py" in tasks_content
    assert "--cov=tests.test_repo_compliance" in tasks_content
    assert "tests/test_api_config.py" in tasks_content
    assert "tests/test_api_health.py" in tasks_content
    assert "tests/test_api_simulate.py" in tasks_content
    assert "--cov-fail-under=80" in tasks_content

