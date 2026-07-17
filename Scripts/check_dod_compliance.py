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
from check_python_coverage import load_policy

ROOT = Path(__file__).resolve().parents[1]


def _read(relpath: str, root: Path = ROOT) -> str:
    return (root / relpath).read_text(encoding="utf-8")


def _ok(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def _workflow_job_block(workflow: str, job_name: str) -> str | None:
    match = re.search(
        rf"(?ms)^  {re.escape(job_name)}:\s*\n(?P<body>.*?)(?=^  [\w-]+:\s*\n|\Z)",
        workflow,
    )
    return match.group("body") if match else None


def pages_workflow_run_errors(pages: str, ci_workflow_name: str = "CI") -> list[str]:
    errors: list[str] = []
    escaped_name = re.escape(ci_workflow_name)
    _ok(
        bool(re.search(r"(?m)^  workflow_run:\s*$", pages))
        and bool(
            re.search(
                rf"(?m)^    workflows:\s*\[\s*[\"']{escaped_name}[\"']\s*\]\s*$",
                pages,
            )
        )
        and bool(re.search(r"(?m)^    types:\s*\[\s*completed\s*\]\s*$", pages))
        and bool(re.search(r"(?m)^    branches:\s*\[\s*main\s*\]\s*$", pages)),
        "Pages must run after the completed CI workflow on main",
        errors,
    )
    _ok(
        not re.search(r"(?m)^  workflow_dispatch:\s*$", pages),
        "Pages workflow_dispatch must not bypass CI validation",
        errors,
    )

    gate_job = _workflow_job_block(pages, "quality-gate")
    deploy_job = _workflow_job_block(pages, "build-and-deploy")
    required_gate_conditions = (
        "github.event_name == 'workflow_run'",
        f"github.event.workflow_run.name == '{ci_workflow_name}'",
        "github.event.workflow_run.event == 'push'",
        "github.event.workflow_run.head_branch == 'main'",
        "github.event.workflow_run.conclusion == 'success'",
    )
    _ok(
        gate_job is not None
        and all(condition in gate_job for condition in required_gate_conditions),
        "Pages quality-gate must require a successful CI push on main",
        errors,
    )
    _ok(
        deploy_job is not None
        and bool(re.search(r"(?m)^    needs:\s*quality-gate\s*$", deploy_job)),
        "Pages must wait for the shared quality-gate job",
        errors,
    )
    if deploy_job is not None:
        _ok(
            "ref: ${{ github.event.workflow_run.head_sha }}" in deploy_job,
            "Pages must checkout the exact SHA validated by CI",
            errors,
        )
        job_header = deploy_job.split("\n    steps:", maxsplit=1)[0]
        _ok(
            not re.search(
                r"(?mi)^    if:.*(?:always|failure|cancelled)\s*\(",
                job_header,
            ),
            "Pages deployment must not bypass a failed or cancelled quality-gate",
            errors,
        )

    polling_markers = (
        "actions/github-script",
        "actions/runs",
        "github.paginate",
        "listWorkflowRunsForRepo",
        "wait-for-ci.cjs",
    )
    _ok(
        not any(marker in pages for marker in polling_markers),
        "Pages must not poll the GitHub Actions API",
        errors,
    )
    return errors


def _append_maintainability_errors(root: Path, errors: list[str]) -> None:
    required = (
        "Scripts/check_maintainability.py",
        "Scripts/check_python_coverage.py",
        "Scripts/maintainability_common.py",
        "Scripts/maintainability_config.py",
        "Scripts/maintainability_dependencies.py",
        "Scripts/maintainability_metrics.py",
        "Scripts/maintainability_ratchet.py",
        "config/maintainability.json",
        "config/maintainability-baseline.json",
        "config/maintainability-exceptions.json",
        "docs/maintainability.md",
        ".coveragerc",
    )
    for relpath in required:
        _ok((root / relpath).exists(), f"Missing maintainability control file: {relpath}", errors)
    _ok(
        "docs/maintainability.md" in _read("README.md", root),
        "README must link docs/maintainability.md",
        errors,
    )
    gate_path = root / "Scripts" / "quality_gate.py"
    if gate_path.exists():
        _ok(
            "Scripts/check_maintainability.py" in gate_path.read_text(encoding="utf-8"),
            "Shared quality gate must run the maintainability ratchet",
            errors,
        )


def _append_python_coverage_errors(root: Path, errors: list[str]) -> None:
    try:
        policy = load_policy(root / ".coveragerc")
    except ValueError as exc:
        errors.append(str(exc))
        return
    checks = (
        (policy["sources"] == ["backend", "Scripts", "run_app"],
         "Python coverage must include backend, Scripts and run_app"),
        (policy["branch"], "Python branch coverage must remain enabled"),
        (float(policy["globalThreshold"]) >= 80,
         "Global Python coverage threshold must be >= 80"),
        (float(policy["perFileThreshold"]) >= 80,
         "Per-file Python coverage threshold must be >= 80"),
        (policy["requireNoMissingLines"],
         "Python coverage must reject every uncovered line"),
    )
    for condition, message in checks:
        _ok(condition, message, errors)


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
    _append_maintainability_errors(root, errors)
    _append_python_coverage_errors(root, errors)
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
    gate = _read("Scripts/quality_gate.py", root)
    _ok("--cov-config=.coveragerc" in gate, "Shared quality gate must use .coveragerc", errors)
    _ok(
        "Scripts/check_python_coverage.py" in gate,
        "Shared quality gate must validate the Python coverage report",
        errors,
    )
    _ok(
        ("services:" in ci) and ("mongo:" in ci) and ("image: mongo:7" in ci),
        "CI must declare a real MongoDB service for integration tests",
        errors,
    )
    pages = _read(".github/workflows/pages.yml", root)
    errors.extend(pages_workflow_run_errors(pages, "CI"))

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
            '"label": "Coverage Python (Full)"' in tasks,
            "Missing complete Python coverage task",
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
            "--cov-config=.coveragerc" in tasks,
            "Coverage workflow must use the declared Python scope",
            errors,
        )
        _ok(
            ".coverage.python.json" in tasks,
            "Coverage task must produce the Python coverage artifact",
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
