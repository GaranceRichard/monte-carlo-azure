from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import check_dod_compliance  # noqa: E402


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


def test_maintainability_control_is_versioned_documented_and_delegated() -> None:
    required = [
        "Scripts/check_maintainability.py",
        "Scripts/maintainability_common.py",
        "Scripts/maintainability_config.py",
        "Scripts/maintainability_dependencies.py",
        "Scripts/maintainability_metrics.py",
        "Scripts/maintainability_ratchet.py",
        "config/maintainability.json",
        "config/maintainability-baseline.json",
        "config/maintainability-exceptions.json",
        "docs/maintainability.md",
    ]

    assert all((ROOT / path).is_file() for path in required)
    assert "docs/maintainability.md" in _read("README.md")
    assert "Scripts/check_maintainability.py" in _read("Scripts/quality_gate_plan.py")


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
    gate = _read("Scripts/quality_gate.py") + _read("Scripts/quality_gate_plan.py")
    pages = _read(".github/workflows/pages.yml")

    node24_action_versions = {
        "actions/checkout": "v6",
        "actions/setup-python": "v6",
        "actions/setup-node": "v6",
        "actions/upload-artifact": "v7",
        "actions/download-artifact": "v8",
        "docker/login-action": "v4",
        "docker/build-push-action": "v7",
    }
    for action, expected_version in node24_action_versions.items():
        versions = set(re.findall(rf"uses:\s*{re.escape(action)}@([^\s#]+)", ci))
        assert versions == {expected_version}, (
            f"{action} must use its current Node 24 version {expected_version}"
        )
    assert "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24" not in ci

    assert "python Scripts/quality_gate.py ci" in ci
    assert "npm run lint" not in ci
    assert "npm run test:e2e" not in ci
    assert "npm run build" not in ci
    assert "--cov-config=.coveragerc" in gate
    assert "Scripts/check_python_coverage.py" in gate
    assert check_dod_compliance.pages_workflow_run_errors(pages) == []
    gate_job = check_dod_compliance._workflow_job_block(pages, "quality-gate")
    deploy_job = check_dod_compliance._workflow_job_block(pages, "build-and-deploy")
    assert gate_job is not None
    assert deploy_job is not None
    assert re.search(r"(?m)^    needs:\s*quality-gate\s*$", deploy_job)
    assert 'workflows: ["CI"]' in pages
    assert "types: [completed]" in pages
    assert "branches: [main]" in pages
    assert "workflow_dispatch:" not in pages
    assert "backend-tests" not in pages
    assert "frontend-tests" not in pages


def test_pages_allows_only_successful_ci_pushes_on_main() -> None:
    pages = _read(".github/workflows/pages.yml")
    gate_job = check_dod_compliance._workflow_job_block(pages, "quality-gate")
    deploy_job = check_dod_compliance._workflow_job_block(pages, "build-and-deploy")
    assert gate_job is not None
    assert deploy_job is not None
    job_header = deploy_job.split("\n    steps:", maxsplit=1)[0]
    conclusion = re.search(
        r"github\.event\.workflow_run\.conclusion == '([^']+)'",
        gate_job,
    )

    assert conclusion
    assert conclusion.group(1) == "success"
    assert "github.event.workflow_run.event == 'push'" in gate_job
    assert "github.event.workflow_run.head_branch == 'main'" in gate_job
    assert re.search(r"(?m)^    needs:\s*quality-gate\s*$", job_header)
    assert not re.search(
        r"(?mi)^    if:.*(?:always|failure|cancelled)\s*\(",
        job_header,
    )
    for blocked in (
        "failure",
        "cancelled",
        "timed_out",
        "action_required",
        "neutral",
        "skipped",
        None,
    ):
        assert blocked != conclusion.group(1)


def test_pages_checks_out_only_the_sha_validated_by_ci_and_has_no_polling() -> None:
    pages = _read(".github/workflows/pages.yml")
    deploy_job = check_dod_compliance._workflow_job_block(pages, "build-and-deploy")
    assert deploy_job is not None

    assert "ref: ${{ github.event.workflow_run.head_sha }}" in deploy_job
    assert "ref: main" not in deploy_job
    for marker in (
        "actions/github-script",
        "actions/runs",
        "github.paginate",
        "listWorkflowRunsForRepo",
        "wait-for-ci.cjs",
    ):
        assert marker not in pages
    assert not (ROOT / ".github" / "scripts" / "wait-for-ci.cjs").exists()
    assert not (ROOT / ".github" / "scripts" / "wait-for-ci.test.cjs").exists()


def test_pages_dod_rejects_a_poll_or_a_checkout_other_than_validated_sha() -> None:
    pages = _read(".github/workflows/pages.yml")

    wrong_sha = pages.replace(
        "ref: ${{ github.event.workflow_run.head_sha }}",
        "ref: main",
    )
    assert "Pages must checkout the exact SHA validated by CI" in (
        check_dod_compliance.pages_workflow_run_errors(wrong_sha)
    )

    polling = pages + "\n# actions/github-script polling\n"
    assert "Pages must not poll the GitHub Actions API" in (
        check_dod_compliance.pages_workflow_run_errors(polling)
    )


def test_coverage_tasks_separate_repo_compliance_and_python_full() -> None:
    tasks_path = ROOT / ".vscode" / "tasks.json"
    if not tasks_path.exists():
        # Optional local developer tooling file; may be absent in CI checkouts.
        return
    tasks_content = tasks_path.read_text(encoding="utf-8")
    assert tasks_content.count('"label": "Validation : profil main"') == 1
    assert '"label": "Coverage Python (Full)"' in tasks_content
    assert '"label": "Coverage Vitals Compliance"' in tasks_content
    assert '"label": "Coverage Vitals Rates"' in tasks_content
    assert '"label": "Coverage Integration (Backend API)"' not in tasks_content
    assert '"label": "Coverage Repo Compliance"' not in tasks_content
    assert "tests/test_repo_compliance.py" not in tasks_content
    assert "--cov=tests.test_repo_compliance" not in tasks_content
    assert "--cov-config=.coveragerc" in tasks_content
    assert ".coverage.python.json" in tasks_content


def test_no_active_legacy_validation_reference_remains(tmp_path: Path) -> None:
    legacy = "Coverage:" + " 8 terminaux"
    changelog = tmp_path / "CHANGELOG.md"
    ignored = tmp_path / ".tmp" / "ignored.md"
    residual = tmp_path / "docs" / "active.md"
    changelog.write_text(legacy, encoding="utf-8")
    ignored.parent.mkdir()
    ignored.write_text(legacy, encoding="utf-8")
    residual.parent.mkdir()
    residual.write_text(f"prefix {legacy} suffix\n", encoding="utf-8")

    assert check_dod_compliance.active_legacy_validation_references(tmp_path) == [
        "docs/active.md:1"
    ]
    assert check_dod_compliance.active_legacy_validation_references(ROOT) == []

    errors: list[str] = []
    check_dod_compliance._append_main_validation_task_errors(tmp_path / "absent", errors)
    assert errors == []
