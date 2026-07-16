#!/usr/bin/env python3
"""
Fail fast if repository-level DoD compliance guards are not met.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from check_e2e_coverage import load_validated_config

ROOT = Path(__file__).resolve().parents[1]


def _read(relpath: str, root: Path = ROOT) -> str:
    return (root / relpath).read_text(encoding="utf-8")


def _ok(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def collect_dod_errors(root: Path = ROOT) -> list[str]:
    errors: list[str] = []

    # Docs presence and linkage
    dod = root / "docs/definition-of-done.md"
    critical = root / "docs/critical-paths.md"
    traceability = root / "docs/vitals-traceability.md"
    vitals_map = root / "docs/vitals-coverage-map.json"
    _ok(dod.exists(), "Missing docs/definition-of-done.md", errors)
    _ok(critical.exists(), "Missing docs/critical-paths.md", errors)
    _ok(traceability.exists(), "Missing docs/vitals-traceability.md", errors)
    _ok(vitals_map.exists(), "Missing docs/vitals-coverage-map.json", errors)
    readme = _read("README.md", root)
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
        "docs/vitals-traceability.md" in readme,
        "README must link docs/vitals-traceability.md",
        errors,
    )
    _ok(
        "Integration: couverture globale >= 80%."
        in _read("docs/definition-of-done.md", root),
        "DoD must define integration coverage >= 80%",
        errors,
    )

    # Frontend script guards
    package_json = json.loads(_read("frontend/package.json", root))
    scripts = package_json.get("scripts", {})
    for required in ["lint", "build", "test:e2e", "test:unit:coverage"]:
        _ok(required in scripts, f"Missing frontend script: {required}", errors)

    # Vitest unit coverage thresholds
    vitest = _read("frontend/vitest.config.js", root)
    for metric in ["statements", "branches", "functions", "lines"]:
        m = re.search(rf"{metric}\s*:\s*(\d+)", vitest)
        _ok(bool(m), f"Missing Vitest threshold for {metric}", errors)
        if m:
            _ok(int(m.group(1)) >= 80, f"Vitest {metric} threshold must be >= 80", errors)

    # E2E coverage thresholds and executable orchestration
    try:
        e2e_config = load_validated_config(
            root / "frontend" / "e2e-coverage.config.json"
        )
    except ValueError as exc:
        errors.extend(str(exc).splitlines())
        e2e_config = None
    if e2e_config is not None:
        for metric in ["statements", "branches", "functions", "lines"]:
            _ok(
                float(e2e_config["thresholds"][metric]) >= 80,
                f"E2E {metric} threshold must be >= 80",
                errors,
            )
    runner = root / "frontend" / "scripts" / "run-e2e-coverage.mjs"
    validator = root / "Scripts" / "check_e2e_coverage.py"
    _ok(runner.exists(), "Missing executable E2E coverage runner", errors)
    _ok(validator.exists(), "Missing E2E coverage artifact validator", errors)
    _ok(
        scripts.get("test:e2e") == "node scripts/run-e2e-coverage.mjs",
        "Frontend test:e2e must use the blocking E2E coverage runner",
        errors,
    )
    _ok(
        scripts.get("test:e2e:coverage:console")
        == "node scripts/run-e2e-coverage.mjs --reporter=line",
        "Frontend E2E coverage console script must use the blocking runner",
        errors,
    )

    # CI checks expected by DoD
    ci = _read(".github/workflows/ci.yml", root)
    _ok(
        "python Scripts/quality_gate.py ci" in ci,
        "CI must run the shared CI quality gate",
        errors,
    )
    _ok(
        "Scripts/quality_gate.py" in ci,
        "CI must delegate backend tests to the shared quality gate",
        errors,
    )
    _ok(
        "--cov-fail-under=80" in _read("Scripts/quality_gate.py", root),
        "Shared quality gate must enforce backend coverage >= 80",
        errors,
    )
    _ok(
        ("services:" in ci) and ("mongo:" in ci) and ("image: mongo:7" in ci),
        "CI must declare a real MongoDB service for integration tests",
        errors,
    )
    pages = _read(".github/workflows/pages.yml", root)
    _ok(
        'const requiredJobs = ["quality-gate"]' in pages,
        "Pages must wait for the shared quality-gate job",
        errors,
    )

    # Coverage task integration checks (VS Code): optional local developer file.
    tasks_path = root / ".vscode" / "tasks.json"
    if tasks_path.exists():
        tasks = tasks_path.read_text(encoding="utf-8")
        _ok(
            '"label": "Coverage: 8 terminaux"' in tasks,
            "Missing coverage aggregate task (8 terminaux)",
            errors,
        )
        _ok(
            '"label": "Coverage Vitals Compliance"' in tasks,
            "Missing vitals compliance coverage task",
            errors,
        )
        _ok(
            '"label": "Coverage Vitals Rates"' in tasks,
            "Missing vitals coverage rates task",
            errors,
        )
        _ok(
            '"label": "Coverage Back (Full)"' in tasks,
            "Missing backend full coverage task",
            errors,
        )
        _ok(
            '"label": "Coverage Integration (Backend API)"' not in tasks,
            "Coverage workflow should avoid duplicate backend integration task",
            errors,
        )
        _ok(
            '"label": "Coverage Repo Compliance"' not in tasks,
            "Coverage workflow should avoid duplicate repo compliance task",
            errors,
        )
        _ok(
            "--cov=backend" in tasks,
            "Coverage workflow must measure backend coverage",
            errors,
        )
        _ok(
            "--cov-fail-under=80" in tasks,
            "Coverage task must enforce backend coverage >= 80",
            errors,
        )

    return errors


def main() -> int:
    errors = collect_dod_errors(ROOT)
    if errors:
        print("ERROR: DoD compliance check failed.", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
