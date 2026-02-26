#!/usr/bin/env python3
"""
Fail fast if repository-level DoD compliance guards are not met.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(relpath: str) -> str:
    return (ROOT / relpath).read_text(encoding="utf-8")


def _ok(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    errors: list[str] = []

    # Docs presence and linkage
    dod = ROOT / "docs/definition-of-done.md"
    critical = ROOT / "docs/critical-paths.md"
    _ok(dod.exists(), "Missing docs/definition-of-done.md", errors)
    _ok(critical.exists(), "Missing docs/critical-paths.md", errors)
    readme = _read("README.md")
    _ok(
        "docs/definition-of-done.md" in readme,
        "README must link docs/definition-of-done.md",
        errors,
    )
    _ok(
        "docs/critical-paths.md" in readme,
        "README must link docs/critical-paths.md",
        errors,
    )
    _ok(
        "Integration: couverture globale >= 80%." in _read("docs/definition-of-done.md"),
        "DoD must define integration coverage >= 80%",
        errors,
    )

    # Frontend script guards
    package_json = json.loads(_read("frontend/package.json"))
    scripts = package_json.get("scripts", {})
    for required in ["lint", "build", "test:e2e", "test:unit:coverage"]:
        _ok(required in scripts, f"Missing frontend script: {required}", errors)

    # Vitest unit coverage thresholds
    vitest = _read("frontend/vitest.config.js")
    for metric in ["statements", "branches", "functions", "lines"]:
        m = re.search(rf"{metric}\s*:\s*(\d+)", vitest)
        _ok(bool(m), f"Missing Vitest threshold for {metric}", errors)
        if m:
            _ok(int(m.group(1)) >= 80, f"Vitest {metric} threshold must be >= 80", errors)

    # E2E coverage thresholds
    e2e_cov = _read("frontend/tests/e2e/coverage.spec.js")
    checks = {
        "statements": r"summary\.statements\.pct\)\.toBeGreaterThanOrEqual\((\d+)\)",
        "branches": r"summary\.branches\.pct\)\.toBeGreaterThanOrEqual\((\d+)\)",
        "functions": r"summary\.functions\.pct\)\.toBeGreaterThanOrEqual\((\d+)\)",
        "lines": r"summary\.lines\.pct\)\.toBeGreaterThanOrEqual\((\d+)\)",
    }
    for metric, pattern in checks.items():
        m = re.search(pattern, e2e_cov)
        _ok(bool(m), f"Missing E2E threshold assertion for {metric}", errors)
        if m:
            _ok(int(m.group(1)) >= 80, f"E2E {metric} threshold must be >= 80", errors)

    # CI checks expected by DoD
    ci = _read(".github/workflows/ci.yml")
    _ok("npm run lint -- --max-warnings 0" in ci, "CI must run frontend lint", errors)
    _ok("npm run test:e2e" in ci, "CI must run E2E tests", errors)
    _ok("npm run build" in ci, "CI must run frontend build", errors)
    _ok(
        ("python -m pytest" in ci) or ("python manage.py test" in ci),
        "CI must run backend tests",
        errors,
    )
    _ok("--cov-fail-under=80" in ci, "CI must enforce backend coverage >= 80", errors)

    # Coverage task integration checks (VS Code): optional local developer file.
    tasks_path = ROOT / ".vscode" / "tasks.json"
    if tasks_path.exists():
        tasks = tasks_path.read_text(encoding="utf-8")
        _ok(
            '"label": "Coverage: 7 terminaux"' in tasks,
            "Missing coverage aggregate task (7 terminaux)",
            errors,
        )
        _ok(
            '"label": "Coverage Repo Compliance"' in tasks,
            "Missing repo DoD compliance task in coverage workflow",
            errors,
        )
        _ok(
            "tests/test_repo_compliance.py" in tasks,
            "Coverage task must execute tests/test_repo_compliance.py",
            errors,
        )
        _ok(
            "--cov=tests.test_repo_compliance" in tasks,
            "Coverage task must measure DoD compliance test coverage",
            errors,
        )
        _ok(
            '"label": "Coverage Integration (Backend API)"' in tasks,
            "Missing dedicated integration coverage task (backend API)",
            errors,
        )
        _ok(
            "tests/test_api_config.py" in tasks,
            "Integration coverage task must include tests/test_api_config.py",
            errors,
        )
        _ok(
            "tests/test_api_health.py" in tasks,
            "Integration coverage task must include tests/test_api_health.py",
            errors,
        )
        _ok(
            "tests/test_api_simulate.py" in tasks,
            "Integration coverage task must include tests/test_api_simulate.py",
            errors,
        )
        _ok(
            "--cov-fail-under=80" in tasks,
            "Coverage task must enforce integration coverage >= 80",
            errors,
        )

    if errors:
        print("ERROR: DoD compliance check failed.", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
