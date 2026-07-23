from __future__ import annotations

import io
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import check_dod_compliance  # noqa: E402
import check_naming_convention  # noqa: E402
import pre_commit_guard  # noqa: E402
import quality_gate  # noqa: E402


def _run_git(repository: Path, *args: str, input_text: str | None = None) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
        input=input_text,
        encoding="utf-8",
    )
    return result.stdout.strip()


def _oid(character: str) -> str:
    return character * 40


def _pre_push_line(
    local_ref: str,
    local_sha: str,
    remote_ref: str,
    remote_sha: str,
) -> str:
    return f"{local_ref} {local_sha} {remote_ref} {remote_sha}\n"


def _mock_push_git(
    monkeypatch,
    *,
    commits_by_range: dict[str, tuple[str, ...]],
    paths_by_commit: dict[str, tuple[str, ...]],
) -> None:
    monkeypatch.setattr(
        quality_gate,
        "resolve_commit_sha",
        lambda sha, _root=quality_gate.ROOT: sha,
    )

    def fake_git_output(args: list[str], **_kwargs: object) -> str:
        if args[0] == "rev-list":
            range_key = next(
                (
                    argument
                    for argument in args
                    if ".." in argument or _is_oid_argument(argument)
                ),
                "",
            )
            return "".join(f"{sha}\n" for sha in commits_by_range.get(range_key, ()))
        if args[0] == "diff-tree":
            commit_sha = args[-1]
            return "".join(f"{path}\n" for path in paths_by_commit.get(commit_sha, ()))
        return ""

    monkeypatch.setattr(quality_gate, "_git_output", fake_git_output)


def _is_oid_argument(value: str) -> bool:
    return len(value) in {40, 64} and all(
        character in "0123456789abcdef" for character in value
    )


def _put_index_blob(repository: Path, path: str, content: str) -> None:
    blob = _run_git(repository, "hash-object", "-w", "--stdin", input_text=content)
    _run_git(repository, "update-index", "--add", "--cacheinfo", f"100644,{blob},{path}")


def _copy_dod_fixture(destination: Path) -> None:
    paths = [
        "README.md",
        "docs/definition-of-done.md",
        "docs/critical-paths.md",
        "docs/vitals-traceability.md",
        "docs/vitals-coverage-map.json",
        "docs/maintainability.md",
        "config/maintainability.json",
        "config/maintainability-baseline.json",
        "config/maintainability-exceptions.json",
        "frontend/package.json",
        "frontend/vitest.config.js",
        "frontend/e2e-coverage.config.json",
        "frontend/scripts/run-e2e-coverage.mjs",
        "frontend/tests/e2e/coverage.spec.js",
        "Scripts/check_e2e_coverage.py",
        "Scripts/check_maintainability.py",
        "Scripts/check_python_coverage.py",
        "Scripts/maintainability_common.py",
        "Scripts/maintainability_config.py",
        "Scripts/maintainability_dependencies.py",
        "Scripts/maintainability_metrics.py",
        "Scripts/maintainability_ratchet.py",
        ".coveragerc",
        ".github/workflows/ci.yml",
        ".github/workflows/pages.yml",
        "Scripts/quality_gate.py",
        "Scripts/quality_gate_plan.py",
        ".vscode/tasks.json",
    ]
    for relpath in paths:
        source = ROOT / relpath
        target = destination / relpath
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def _write_current_proof_contract(root: Path) -> dict[str, object]:
    nodes = [
        {
            "id": "preflight",
            "order": 10,
            "needs": [],
            "commands": ["Current preflight"],
            "profiles": ["pr", "main"],
            "aggregator": False,
        },
        {
            "id": "backend-static",
            "order": 20,
            "needs": ["preflight"],
            "commands": ["Current backend static"],
            "profiles": ["pr", "main"],
            "aggregator": False,
        },
        {
            "id": "frontend-static",
            "order": 30,
            "needs": ["backend-static"],
            "commands": ["Current frontend static"],
            "profiles": ["pr", "main"],
            "aggregator": False,
        },
        {
            "id": "aggregate",
            "order": 100,
            "needs": ["frontend-static"],
            "commands": ["Current aggregate"],
            "profiles": ["pr", "main"],
            "aggregator": True,
        },
    ]
    contract: dict[str, object] = {
        "profiles": [
            {"id": "pr", "includes": ["pr"]},
            {"id": "main", "includes": ["pr", "main"]},
        ],
        "nodes": nodes,
    }
    destination = root / "config/test-execution-profiles.json"
    destination.parent.mkdir(parents=True)
    destination.write_text(json.dumps(contract), encoding="utf-8")
    return contract


@contextmanager
def _temporary_repository_snapshot():
    with tempfile.TemporaryDirectory(prefix="quality-gate-test-") as directory:
        yield Path(directory)


def _assert_current_proofs_replace_residuals(
    root: Path,
    monkeypatch,
    *,
    parallel: bool,
    profile: str,
) -> None:
    import Scripts.quality_gate_dag as quality_gate_dag
    from Scripts.test_strategy_nodes import node_evidence
    from Scripts.test_strategy_summary import quality_gate_conclusion

    contract = _write_current_proof_contract(root)
    commands = tuple(
        quality_gate.GateCommand(step, (sys.executable, "-V"), "Correct the test.")
        for step in (
            "Current preflight",
            "Current backend static",
            "Current frontend static",
            "Current aggregate",
        )
    )
    plan = quality_gate.GateExecutionPlan(
        context=quality_gate.build_change_context("fast", ["Scripts/quality_gate.py"]),
        commands=commands,
        docker_smoke=False,
        execution_profile=profile,
    )
    quality_gate_dag._write_result(root, profile, "preflight", 23, 9.0)
    quality_gate_dag._write_result(root, profile, "backend-static", 19, 8.0)
    observed: dict[str, object] = {}

    def fake_run(
        command: quality_gate.GateCommand,
        *,
        validation_root: Path,
        extra_env: dict[str, str],
        **_kwargs: object,
    ) -> int:
        assert extra_env["TEST_EXECUTION_NODE"] == {
            "Current preflight": "preflight",
            "Current backend static": "backend-static",
            "Current frontend static": "frontend-static",
            "Current aggregate": "aggregate",
        }[command.step]
        if command.step == "Current backend static":
            quality_gate_dag._write_result(validation_root, profile, "preflight", 23, 7.0)
        elif command.step == "Current frontend static":
            quality_gate_dag._write_result(
                validation_root, profile, "backend-static", 19, 6.0
            )
        elif command.step == "Current aggregate":
            nodes, evidence, violations = node_evidence(
                validation_root,
                profile,
                contract,
                [{"framework": "pytest"}],
            )
            observed["codes"] = {
                item["id"]: item["exitCode"] for item in nodes if item["required"]
            }
            observed["conclusion"] = quality_gate_conclusion(evidence, violations)["status"]
            observed["aggregateExisted"] = (
                validation_root
                / f"reports/test-execution-artifacts/{profile}/aggregate/result.json"
            ).exists()
        return 0

    with monkeypatch.context() as patch:
        patch.setattr(quality_gate, "_run_command", fake_run)
        patch.setattr(quality_gate_dag, "_prepare_aggregate_inputs", lambda *_args: None)
        assert (
            quality_gate._execute_gate_plan(
                plan,
                validation_root=root,
                runtime_temp_root=root / ".tmp",
                isolated_validation=False,
                parallel=parallel,
            )
            == 0
        )
    assert observed == {
        "codes": {"preflight": 0, "backend-static": 0, "frontend-static": 0},
        "conclusion": "compliant",
        "aggregateExisted": False,
    }
    result = json.loads(
        (root / f"reports/test-execution-artifacts/{profile}/aggregate/result.json").read_text(
            encoding="utf-8"
        )
    )
    assert set(result) == {
        "schemaVersion",
        "profile",
        "node",
        "exitCode",
        "durationSeconds",
    }
    assert result["profile"] == profile
    assert result["node"] == "aggregate"
    assert result["exitCode"] == 0


def _assert_current_failure_replaces_residual_success(
    root: Path,
    monkeypatch,
    *,
    parallel: bool,
) -> None:
    import Scripts.quality_gate_dag as quality_gate_dag

    _write_current_proof_contract(root)
    plan = quality_gate.GateExecutionPlan(
        context=quality_gate.build_change_context("fast", ["Scripts/quality_gate.py"]),
        commands=tuple(
            quality_gate.GateCommand(step, (sys.executable, "-V"), "Correct the test.")
            for step in (
                "Current preflight",
                "Current backend static",
                "Current frontend static",
                "Current aggregate",
            )
        ),
        docker_smoke=False,
        execution_profile="pr",
    )
    quality_gate_dag._write_result(root, "pr", "preflight", 0, 4.0)
    calls: list[str] = []

    def fake_run(command: quality_gate.GateCommand, **_kwargs: object) -> int:
        calls.append(command.step)
        return 23 if command.step == "Current preflight" else 0

    with monkeypatch.context() as patch:
        patch.setattr(quality_gate, "_run_command", fake_run)
        patch.setattr(quality_gate_dag, "_prepare_aggregate_inputs", lambda *_args: None)
        assert (
            quality_gate._execute_gate_plan(
                plan,
                validation_root=root,
                runtime_temp_root=root / ".tmp",
                isolated_validation=False,
                parallel=parallel,
            )
            == 23
        )
    assert calls == ["Current preflight"]
    result = json.loads(
        (root / "reports/test-execution-artifacts/pr/preflight/result.json").read_text(
            encoding="utf-8"
        )
    )
    assert result["exitCode"] == 23


@pytest.fixture
def indexed_repository(tmp_path: Path) -> Path:
    repository = tmp_path / "repository"
    repository.mkdir()
    _run_git(repository, "init")
    return repository


def test_change_context_characterizes_mode_inputs(monkeypatch) -> None:
    staged_calls = 0

    def fake_staged_changes() -> tuple[quality_gate.StagedChange, ...]:
        nonlocal staged_calls
        staged_calls += 1
        return (
            quality_gate.StagedChange("M", ("README.md",)),
            quality_gate.StagedChange("M", ("docs/definition-of-done.md",)),
        )

    monkeypatch.setattr(quality_gate, "staged_changes", fake_staged_changes)

    fast = quality_gate.resolve_change_context("fast")
    push = quality_gate.resolve_change_context("push")
    ci = quality_gate.resolve_change_context("ci", ["backend/api.py"])

    assert staged_calls == 1
    assert fast.mode == "fast"
    assert fast.changed_paths == ("README.md", "docs/definition-of-done.md")
    assert fast.changed_paths_source == quality_gate.InputSource.GIT_INDEX
    assert fast.staged_changes == fake_staged_changes()
    assert fast.documentation_only
    assert fast.classification is not None
    assert fast.classification.level == quality_gate.ChangeLevel.MASSIVE
    assert fast.classification.trigger_paths == ("docs/definition-of-done.md",)

    assert push.mode == "push"
    assert push.changed_paths == ()
    assert push.changed_paths_source == quality_gate.InputSource.HEAD
    assert not push.documentation_only
    assert push.classification is not None
    assert push.classification.level == quality_gate.ChangeLevel.MASSIVE

    assert ci.mode == "ci"
    assert ci.changed_paths == ("backend/api.py",)
    assert ci.changed_paths_source is None
    assert not ci.documentation_only
    assert ci.classification is not None
    assert ci.classification.level == quality_gate.ChangeLevel.IMPACTED


def test_change_context_rejects_unknown_modes() -> None:
    try:
        quality_gate.build_change_context("unknown", [])
    except ValueError as exc:
        assert str(exc) == "Unsupported mode: unknown"
    else:
        raise AssertionError("An unsupported mode must be rejected.")


@pytest.mark.parametrize(
    ("paths", "expected_level", "expected_triggers"),
    [
        (
            ["docs/user-guide.md", "README.md"],
            quality_gate.ChangeLevel.TARGETED,
            ("docs/user-guide.md", "README.md"),
        ),
        (
            ["tests/test_api_health.py"],
            quality_gate.ChangeLevel.TARGETED,
            ("tests/test_api_health.py",),
        ),
        (
            ["backend/api_config.py"],
            quality_gate.ChangeLevel.TARGETED,
            ("backend/api_config.py",),
        ),
        (
            ["frontend/src/components/AppHeader.tsx"],
            quality_gate.ChangeLevel.TARGETED,
            ("frontend/src/components/AppHeader.tsx",),
        ),
        (
            ["frontend/src/utils/math.ts"],
            quality_gate.ChangeLevel.IMPACTED,
            ("frontend/src/utils/math.ts",),
        ),
        (
            ["backend/mc_core.py"],
            quality_gate.ChangeLevel.MASSIVE,
            ("backend/mc_core.py",),
        ),
        (
            ["backend/api_models.py", "frontend/src/types.ts"],
            quality_gate.ChangeLevel.MASSIVE,
            ("backend/api_models.py", "frontend/src/types.ts"),
        ),
        (
            ["requirements.txt", "frontend/package-lock.json"],
            quality_gate.ChangeLevel.MASSIVE,
            ("requirements.txt", "frontend/package-lock.json"),
        ),
        (
            [
                ".githooks/pre-push",
                "Scripts/quality_gate.py",
                ".github/workflows/ci.yml",
                "frontend/vitest.config.js",
                "frontend/tests/e2e/coverage.spec.js",
            ],
            quality_gate.ChangeLevel.MASSIVE,
            (
                ".githooks/pre-push",
                "Scripts/quality_gate.py",
                ".github/workflows/ci.yml",
                "frontend/vitest.config.js",
                "frontend/tests/e2e/coverage.spec.js",
            ),
        ),
        (
            ["experimental/new_system.xyz"],
            quality_gate.ChangeLevel.MASSIVE,
            ("experimental/new_system.xyz",),
        ),
    ],
)
def test_change_classification_rules(
    paths: list[str],
    expected_level: quality_gate.ChangeLevel,
    expected_triggers: tuple[str, ...],
) -> None:
    classification = quality_gate.classify_changes(paths)

    assert classification.level == expected_level
    assert classification.trigger_paths == expected_triggers
    assert classification.justification
    assert [decision.path for decision in classification.path_decisions] == paths
    assert all(decision.justification for decision in classification.path_decisions)


def test_change_classification_uses_the_highest_level_across_mixed_paths() -> None:
    classification = quality_gate.classify_changes(
        [
            "backend/api_config.py",
            "frontend/src/utils/math.ts",
            ".github/workflows/ci.yml",
        ]
    )

    assert classification.level == quality_gate.ChangeLevel.MASSIVE
    assert classification.trigger_paths == (".github/workflows/ci.yml",)
    assert [decision.level for decision in classification.path_decisions] == [
        quality_gate.ChangeLevel.TARGETED,
        quality_gate.ChangeLevel.IMPACTED,
        quality_gate.ChangeLevel.MASSIVE,
    ]


def test_empty_or_ambiguous_change_set_is_massive_by_default() -> None:
    empty = quality_gate.classify_changes([])
    ambiguous = quality_gate.classify_changes(["../outside.py"])

    assert empty.level == quality_gate.ChangeLevel.MASSIVE
    assert empty.trigger_paths == ()
    assert ambiguous.level == quality_gate.ChangeLevel.MASSIVE
    assert ambiguous.trigger_paths == ("../outside.py",)


def test_documentation_only_selects_only_general_mandatory_controls() -> None:
    context = quality_gate.build_change_context("push", ["docs/user-guide.md"])
    plan = quality_gate.build_execution_plan(context)

    assert plan.resolution is not None
    assert plan.resolution.level == quality_gate.ChangeLevel.TARGETED
    assert [command.step for command in plan.commands] == [
        "Repository hygiene (README, encoding, secrets and DoD)",
        "Test classification compliance",
        "Identity boundary",
        "Naming convention",
        "Maintainability ratchet",
        "Test governance compliance",
    ]


def test_isolated_backend_test_selects_only_that_test_and_no_frontend() -> None:
    context = quality_gate.build_change_context("fast", ["tests/test_api_health.py"])
    plan = quality_gate.build_execution_plan(context)

    assert plan.resolution is not None
    assert plan.resolution.backend_tests == ("tests/test_api_health.py",)
    assert plan.resolution.frontend_tests == ()
    assert plan.commands[-1].argv == (
        sys.executable,
        "-m",
        "pytest",
        "-q",
        "tests/test_api_health.py",
    )
    assert all(command.argv[0] != quality_gate.NPM_COMMAND for command in plan.commands)


def test_local_backend_module_selects_its_direct_test() -> None:
    context = quality_gate.build_change_context("push", ["backend/api_config.py"])
    plan = quality_gate.build_execution_plan(context)

    assert plan.resolution is not None
    assert plan.resolution.level == quality_gate.ChangeLevel.TARGETED
    assert plan.resolution.backend_tests == ("tests/test_api_config.py",)
    assert [command.step for command in plan.commands][-1] == "Selected backend tests"
    assert "Backend lint (Ruff)" not in [command.step for command in plan.commands]


def test_local_frontend_component_selects_its_colocated_test() -> None:
    context = quality_gate.build_change_context(
        "push", ["frontend/src/components/AppHeader.tsx"]
    )
    plan = quality_gate.build_execution_plan(context)

    assert plan.resolution is not None
    assert plan.resolution.frontend_tests == (
        "frontend/src/components/AppHeader.test.jsx",
    )
    assert plan.commands[-1].argv == (
        quality_gate.NPM_COMMAND,
        "--prefix",
        "frontend",
        "run",
        "test:unit",
        "--",
        "src/components/AppHeader.test.jsx",
    )
    assert all(
        command.argv[:3] != (sys.executable, "-m", "pytest")
        for command in plan.commands
    )


def test_shared_frontend_utility_adds_domain_controls_and_nearby_tests() -> None:
    context = quality_gate.build_change_context(
        "push", ["frontend/src/utils/math.ts"]
    )
    resolution = quality_gate.resolve_tests(context)
    plan = quality_gate.build_execution_plan(context)

    assert resolution.level == quality_gate.ChangeLevel.IMPACTED
    assert resolution.impacted_domains == (quality_gate.ChangeDomain.FRONTEND,)
    assert resolution.frontend_tests == (
        "frontend/src/utils/math.test.ts",
        "frontend/src/utils/simulation.test.ts",
        "frontend/src/utils/forecastDiagnostics.test.ts",
    )
    assert [command.step for command in plan.commands] == [
        "Repository hygiene (README, encoding, secrets and DoD)",
        "Test classification compliance",
        "Identity boundary",
        "Naming convention",
        "Maintainability ratchet",
        "Test governance compliance",
        "Frontend lint (ESLint, zero warning)",
        "Frontend typecheck (TypeScript)",
        "Selected frontend unit tests (Vitest)",
    ]


def test_combined_backend_and_frontend_change_aggregates_without_cross_domain_suites() -> None:
    context = quality_gate.build_change_context(
        "push",
        [
            "backend/api_config.py",
            "frontend/src/components/AppHeader.tsx",
        ],
    )
    plan = quality_gate.build_execution_plan(context)

    assert plan.resolution is not None
    assert plan.resolution.domains == (
        quality_gate.ChangeDomain.BACKEND,
        quality_gate.ChangeDomain.FRONTEND,
    )
    assert [command.step for command in plan.commands] == [
        "Repository hygiene (README, encoding, secrets and DoD)",
        "Test classification compliance",
        "Identity boundary",
        "Naming convention",
        "Maintainability ratchet",
        "Test governance compliance",
        "Selected backend tests",
        "Selected frontend unit tests (Vitest)",
    ]


def test_massive_and_unknown_changes_use_the_complete_push_plan() -> None:
    massive = quality_gate.build_execution_plan(
        quality_gate.build_change_context("push", ["Scripts/quality_gate.py"])
    )
    unknown = quality_gate.build_execution_plan(
        quality_gate.build_change_context("push", ["experimental/new_system.xyz"])
    )

    assert massive.resolution is not None
    assert massive.resolution.level == quality_gate.ChangeLevel.MASSIVE
    assert unknown.resolution is not None
    assert unknown.resolution.level == quality_gate.ChangeLevel.MASSIVE
    assert [command.argv for command in massive.commands] == [
        command.argv for command in unknown.commands
    ]
    assert "Versioned Python coverage" in [
        command.step for command in massive.commands
    ]
    assert "End-to-end tests (Playwright)" in [
        command.step for command in massive.commands
    ]


def test_unresolvable_targeted_dependency_falls_back_to_massive() -> None:
    context = quality_gate.build_change_context(
        "push", ["frontend/src/components/PublicConnectNotice.tsx"]
    )
    plan = quality_gate.build_execution_plan(context)

    assert context.classification is not None
    assert context.classification.level == quality_gate.ChangeLevel.TARGETED
    assert plan.resolution is not None
    assert plan.resolution.level == quality_gate.ChangeLevel.MASSIVE
    assert plan.resolution.unresolved_paths == (
        "frontend/src/components/PublicConnectNotice.tsx",
    )
    assert "Frontend unit coverage" in [command.step for command in plan.commands]


def test_aggregated_plan_contains_no_duplicate_commands() -> None:
    context = quality_gate.build_change_context(
        "push",
        [
            "backend/api_config.py",
            "tests/test_api_config.py",
            "frontend/src/components/AppHeader.tsx",
            "frontend/src/components/AppHeader.test.jsx",
        ],
    )
    plan = quality_gate.build_execution_plan(context)
    argv = [command.argv for command in plan.commands]

    assert len(argv) == len(set(argv))
    assert plan.resolution is not None
    assert plan.resolution.backend_tests == ("tests/test_api_config.py",)
    assert plan.resolution.frontend_tests == (
        "frontend/src/components/AppHeader.test.jsx",
    )


def test_impacted_backend_plan_is_ordered_and_contains_no_duplicate_commands() -> None:
    plan = quality_gate.build_execution_plan(
        quality_gate.build_change_context("push", ["backend/api.py"])
    )
    argv = [command.argv for command in plan.commands]

    assert [command.step for command in plan.commands] == [
        "Repository hygiene (README, encoding, secrets and DoD)",
        "Test classification compliance",
        "Identity boundary",
        "Naming convention",
        "Maintainability ratchet",
        "Test governance compliance",
        "Backend lint (Ruff)",
        "Selected backend tests",
    ]
    assert len(argv) == len(set(argv))


def test_impacted_frontend_plan_is_ordered_and_contains_no_duplicate_commands() -> None:
    plan = quality_gate.build_execution_plan(
        quality_gate.build_change_context("push", ["frontend/src/utils/math.ts"])
    )
    argv = [command.argv for command in plan.commands]

    assert [command.step for command in plan.commands] == [
        "Repository hygiene (README, encoding, secrets and DoD)",
        "Test classification compliance",
        "Identity boundary",
        "Naming convention",
        "Maintainability ratchet",
        "Test governance compliance",
        "Frontend lint (ESLint, zero warning)",
        "Frontend typecheck (TypeScript)",
        "Selected frontend unit tests (Vitest)",
    ]
    assert len(argv) == len(set(argv))


def test_mixed_impacted_plan_keeps_lint_typecheck_tests_order_without_repetition() -> None:
    plan = quality_gate.build_execution_plan(
        quality_gate.build_change_context(
            "push",
            ["backend/api.py", "frontend/src/utils/math.ts"],
        )
    )
    argv = [command.argv for command in plan.commands]

    assert [command.step for command in plan.commands] == [
        "Repository hygiene (README, encoding, secrets and DoD)",
        "Test classification compliance",
        "Identity boundary",
        "Naming convention",
        "Maintainability ratchet",
        "Test governance compliance",
        "Backend lint (Ruff)",
        "Frontend lint (ESLint, zero warning)",
        "Frontend typecheck (TypeScript)",
        "Selected backend tests",
        "Selected frontend unit tests (Vitest)",
    ]
    assert len(argv) == len(set(argv))


def test_plan_selection_output_explains_level_triggers_and_commands(capsys) -> None:
    context = quality_gate.build_change_context(
        "push", ["frontend/src/utils/math.ts"]
    )
    plan = quality_gate.build_execution_plan(context)

    quality_gate._print_plan_selection(plan)

    output = capsys.readouterr().out
    assert "Change validation level: impacted" in output
    assert "Trigger paths: frontend/src/utils/math.ts" in output
    assert "Selected commands:" in output
    assert "Frontend lint (ESLint, zero warning)" in output
    assert "Selected frontend unit tests (Vitest)" in output

    staged_context = quality_gate.build_change_context(
        "fast",
        ["README.md", "backend/api.py"],
        staged_change_entries=(
            quality_gate.StagedChange("M", ("README.md",)),
            quality_gate.StagedChange("R", ("backend/old.py", "backend/api.py")),
        ),
    )
    quality_gate._print_plan_selection(
        quality_gate.build_execution_plan(staged_context)
    )
    staged_output = capsys.readouterr().out
    assert "Staged changes: M README.md, R backend/old.py -> backend/api.py" in staged_output


def test_fast_push_and_ci_modes_have_the_expected_scope() -> None:
    fast_steps = [command.step for command in quality_gate.execution_plan("fast", False)]
    push_steps = [command.step for command in quality_gate.execution_plan("push", False)]
    ci_steps = [command.step for command in quality_gate.execution_plan("ci", False)]

    assert fast_steps == ci_steps
    assert "Backend tests" in fast_steps
    assert "Frontend unit tests (Vitest)" in fast_steps
    assert "Versioned Python coverage" not in fast_steps
    assert "Frontend unit coverage" not in fast_steps
    assert "Backend tests" not in push_steps
    assert "Frontend unit tests (Vitest)" not in push_steps
    assert "Versioned Python coverage" in push_steps
    assert "Python coverage scope and per-file compliance" in push_steps
    assert "Frontend unit coverage" in push_steps
    assert "End-to-end tests (Playwright)" in push_steps
    assert "Release or container checks" in push_steps
    assert "Versioned Python coverage" not in ci_steps
    push_commands = quality_gate.execution_plan("push", False)
    assert all("docker" not in " ".join(command.argv).lower() for command in push_commands)


def test_fast_plan_reads_index_push_reads_commits_and_ci_reads_workspace() -> None:
    fast = quality_gate.build_execution_plan(
        quality_gate.build_change_context("fast", ["backend/api.py"])
    )
    push = quality_gate.build_execution_plan(
        quality_gate.build_change_context("push", ["backend/api.py"])
    )
    ci = quality_gate.build_execution_plan(
        quality_gate.build_change_context("ci", ["backend/api.py"])
    )

    assert all(
        command.input_sources == (quality_gate.InputSource.GIT_INDEX,)
        for command in fast.commands
    )
    assert all(
        command.input_sources == (quality_gate.InputSource.HEAD,)
        for command in push.commands
    )
    assert all(
        command.input_sources == (quality_gate.InputSource.WORKSPACE,)
        for command in ci.commands
    )


def test_pre_push_update_of_one_commit(monkeypatch) -> None:
    remote_sha = _oid("a")
    local_sha = _oid("b")
    updates = quality_gate.parse_pre_push_updates(
        _pre_push_line(
            "refs/heads/main",
            local_sha,
            "refs/heads/main",
            remote_sha,
        )
    )
    _mock_push_git(
        monkeypatch,
        commits_by_range={f"{remote_sha}..{local_sha}": (local_sha,)},
        paths_by_commit={local_sha: ("backend/api.py",)},
    )

    plan = quality_gate.build_push_validation_plan(updates, "origin")

    assert [target.terminal_sha for target in plan.targets] == [local_sha]
    assert plan.targets[0].changed_paths == ("backend/api.py",)
    assert plan.ranges[0].revision_args == (
        "--reverse",
        "--topo-order",
        f"{remote_sha}..{local_sha}",
    )
    assert plan.ranges[0].terminal_sha == local_sha


def test_pre_push_multiple_commits_keep_range_but_validate_only_terminal_sha(
    monkeypatch,
) -> None:
    remote_sha = _oid("a")
    first_sha = _oid("b")
    local_sha = _oid("c")
    updates = quality_gate.parse_pre_push_updates(
        _pre_push_line(
            "refs/heads/main",
            local_sha,
            "refs/heads/main",
            remote_sha,
        )
    )
    _mock_push_git(
        monkeypatch,
        commits_by_range={
            f"{remote_sha}..{local_sha}": (first_sha, local_sha),
        },
        paths_by_commit={
            first_sha: ("backend/api.py", "README.md"),
            local_sha: ("frontend/src/App.tsx", "backend/api.py"),
        },
    )

    plan = quality_gate.build_push_validation_plan(updates, "origin")

    assert [target.terminal_sha for target in plan.targets] == [local_sha]
    assert plan.ranges[0].commit_shas == (first_sha, local_sha)
    assert plan.ranges[0].changed_paths == (
        "backend/api.py",
        "README.md",
        "frontend/src/App.tsx",
    )
    assert plan.targets[0].changed_paths == plan.ranges[0].changed_paths
    context = quality_gate.build_push_change_context(plan.targets[0])
    assert context.changed_paths == plan.ranges[0].changed_paths
    assert context.terminal_sha == local_sha
    assert context.introduced_commit_shas == (first_sha, local_sha)
    assert context.revision_ranges == (plan.ranges[0].revision_args,)


def test_pre_push_remote_branch_creation_uses_remote_reachability(monkeypatch) -> None:
    local_sha = _oid("c")
    updates = quality_gate.parse_pre_push_updates(
        _pre_push_line(
            "refs/heads/topic",
            local_sha,
            "refs/heads/topic",
            "0" * 40,
        )
    )
    _mock_push_git(
        monkeypatch,
        commits_by_range={local_sha: ()},
        paths_by_commit={local_sha: ("backend/new_module.py",)},
    )

    plan = quality_gate.build_push_validation_plan(updates, "origin")

    assert plan.updates[0].is_creation
    assert plan.ranges[0].revision_args == (
        "--reverse",
        "--topo-order",
        local_sha,
        "--not",
        "--remotes=origin",
    )
    assert [target.terminal_sha for target in plan.targets] == [local_sha]
    assert plan.ranges[0].commit_shas == (local_sha,)
    assert plan.ranges[0].changed_paths == ("backend/new_module.py",)


def test_pre_push_remote_branch_deletion_runs_no_commit_validation(monkeypatch) -> None:
    updates = quality_gate.parse_pre_push_updates(
        _pre_push_line(
            "(delete)",
            "0" * 40,
            "refs/heads/obsolete",
            _oid("d"),
        )
    )
    monkeypatch.setattr(
        quality_gate,
        "_git_output",
        lambda *_args, **_kwargs: pytest.fail("A deletion must not resolve a range."),
    )

    plan = quality_gate.build_push_validation_plan(updates, "origin")

    assert plan.updates[0].is_deletion
    assert plan.ranges[0].revision_args == ()
    assert plan.targets == ()

    monkeypatch.setattr(
        quality_gate,
        "build_push_validation_plan",
        lambda *_args, **_kwargs: plan,
    )
    monkeypatch.setattr(
        quality_gate,
        "detached_commit_worktree",
        lambda *_args, **_kwargs: pytest.fail(
            "A reference deletion must not create a worktree."
        ),
    )
    assert quality_gate.run_pre_push_gate(
        _pre_push_line(
            "(delete)",
            "0" * 40,
            "refs/heads/obsolete",
            _oid("d"),
        ),
        remote_name="origin",
    ) == 0


def test_pre_push_two_references_with_same_terminal_sha_validate_it_once(
    monkeypatch,
) -> None:
    shared_terminal = _oid("d")
    updates = quality_gate.parse_pre_push_updates(
        _pre_push_line(
            "refs/heads/main",
            shared_terminal,
            "refs/heads/main",
            _oid("a"),
        )
        + _pre_push_line(
            "refs/heads/release",
            shared_terminal,
            "refs/heads/release",
            _oid("b"),
        )
    )
    _mock_push_git(
        monkeypatch,
        commits_by_range={
            f"{_oid('a')}..{shared_terminal}": (_oid("c"), shared_terminal),
            f"{_oid('b')}..{shared_terminal}": (shared_terminal,),
        },
        paths_by_commit={
            _oid("c"): ("backend/api.py",),
            shared_terminal: ("frontend/src/App.tsx",),
        },
    )

    plan = quality_gate.build_push_validation_plan(updates, "origin")

    assert len(plan.ranges) == 2
    assert len(plan.targets) == 1
    assert plan.targets[0].terminal_sha == shared_terminal
    assert plan.targets[0].ranges == plan.ranges
    assert plan.targets[0].changed_paths == (
        "backend/api.py",
        "frontend/src/App.tsx",
    )
    context = quality_gate.build_push_change_context(plan.targets[0])
    assert context.introduced_commit_shas == (_oid("c"), shared_terminal)
    assert context.revision_ranges == tuple(
        commit_range.revision_args for commit_range in plan.ranges
    )


def test_pre_push_two_references_with_distinct_terminal_shas_validate_both(
    monkeypatch,
) -> None:
    shared_sha = _oid("c")
    main_sha = _oid("d")
    topic_sha = _oid("e")
    updates = quality_gate.parse_pre_push_updates(
        _pre_push_line(
            "refs/heads/main",
            main_sha,
            "refs/heads/main",
            _oid("a"),
        )
        + _pre_push_line(
            "refs/heads/topic",
            topic_sha,
            "refs/heads/topic",
            _oid("b"),
        )
    )
    _mock_push_git(
        monkeypatch,
        commits_by_range={
            f"{_oid('a')}..{main_sha}": (shared_sha, main_sha),
            f"{_oid('b')}..{topic_sha}": (shared_sha, topic_sha),
        },
        paths_by_commit={
            shared_sha: ("README.md",),
            main_sha: ("backend/api.py",),
            topic_sha: ("frontend/src/App.tsx",),
        },
    )

    plan = quality_gate.build_push_validation_plan(updates, "origin")

    assert len(plan.ranges) == 2
    assert [target.terminal_sha for target in plan.targets] == [main_sha, topic_sha]
    assert plan.targets[0].changed_paths == ("README.md", "backend/api.py")
    assert plan.targets[1].changed_paths == ("README.md", "frontend/src/App.tsx")


def test_pre_push_invalid_stdin_and_unresolvable_sha_are_rejected(
    monkeypatch, capsys
) -> None:
    with pytest.raises(ValueError, match="no reference updates"):
        quality_gate.parse_pre_push_updates("")
    with pytest.raises(ValueError, match="expected 4 fields"):
        quality_gate.parse_pre_push_updates("refs/heads/main too-few-fields\n")
    with pytest.raises(ValueError, match="not a full OID"):
        quality_gate.parse_pre_push_updates(
            _pre_push_line(
                "refs/heads/main",
                "not-a-sha",
                "refs/heads/main",
                _oid("a"),
            )
        )

    monkeypatch.setattr(
        quality_gate,
        "resolve_commit_sha",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            ValueError("Unable to resolve pushed SHA as a commit")
        ),
    )
    code = quality_gate.run_pre_push_gate(
        _pre_push_line(
            "refs/heads/main",
            _oid("b"),
            "refs/heads/main",
            _oid("a"),
        ),
        remote_name="origin",
    )

    assert code == 2
    assert "Unable to resolve pushed SHA" in capsys.readouterr().err


def test_pre_push_executes_once_per_terminal_sha_with_aggregated_context(
    tmp_path: Path, monkeypatch
) -> None:
    terminal_sha = _oid("c")
    worktree = tmp_path / "terminal-worktree"
    worktree.mkdir()
    executed_roots: list[Path] = []
    contexts: list[quality_gate.ChangeContext] = []
    cleaned: list[str] = []

    monkeypatch.setattr(
        quality_gate,
        "build_push_validation_plan",
        lambda *_args, **_kwargs: quality_gate.PushValidationPlan(
            updates=(),
            ranges=(),
            targets=(
                quality_gate.PushValidationTarget(
                    terminal_sha=terminal_sha,
                    ranges=(),
                    changed_paths=("backend/api.py", "frontend/src/App.tsx"),
                ),
            ),
        ),
    )

    @contextmanager
    def fake_worktree(commit_sha: str, _repository_root: Path):
        try:
            yield worktree
        finally:
            cleaned.append(commit_sha)

    def fake_execute(
        plan: quality_gate.GateExecutionPlan,
        *,
        validation_root: Path,
        **_kwargs: object,
    ) -> int:
        executed_roots.append(validation_root)
        contexts.append(plan.context)
        return 0

    monkeypatch.setattr(quality_gate, "detached_commit_worktree", fake_worktree)
    monkeypatch.setattr(quality_gate, "_execute_gate_plan", fake_execute)

    assert quality_gate.run_pre_push_gate(
        _pre_push_line(
            "refs/heads/main",
            terminal_sha,
            "refs/heads/main",
            _oid("a"),
        ),
        remote_name="origin",
    ) == 0
    assert executed_roots == [worktree]
    assert quality_gate.ROOT not in executed_roots
    assert cleaned == [terminal_sha]
    assert len(contexts) == 1
    context = contexts[0]
    assert context.mode == "push"
    assert context.changed_paths == ("backend/api.py", "frontend/src/App.tsx")
    assert context.changed_paths_source == quality_gate.InputSource.HEAD
    assert not context.documentation_only
    assert context.terminal_sha == terminal_sha
    assert context.introduced_commit_shas == ()
    assert context.revision_ranges == ()
    assert context.classification is not None
    assert context.classification.level == quality_gate.ChangeLevel.MASSIVE
    assert context.classification.trigger_paths == ("frontend/src/App.tsx",)


def test_detached_worktree_cleanup_runs_after_success_and_failure(
    tmp_path: Path, monkeypatch
) -> None:
    calls: list[tuple[str, ...]] = []

    def fake_worktree_command(
        args: list[str],
        *,
        repository_root: Path,
    ) -> subprocess.CompletedProcess[str]:
        calls.append(tuple(args))
        if args[0] == "add":
            Path(args[-2]).mkdir(parents=True)
        return subprocess.CompletedProcess(args, 0, "", "")

    monkeypatch.setattr(quality_gate, "_run_worktree_command", fake_worktree_command)

    with quality_gate.detached_commit_worktree(_oid("a"), tmp_path):
        pass
    assert [call[0] for call in calls] == ["add", "remove", "prune"]

    calls.clear()
    with pytest.raises(RuntimeError, match="validation failed"):
        with quality_gate.detached_commit_worktree(_oid("b"), tmp_path):
            raise RuntimeError("validation failed")
    assert [call[0] for call in calls] == ["add", "remove", "prune"]

    calls.clear()
    with pytest.raises(KeyboardInterrupt):
        with quality_gate.detached_commit_worktree(_oid("c"), tmp_path):
            raise KeyboardInterrupt
    assert [call[0] for call in calls] == ["add", "remove", "prune"]


def test_pre_push_stops_after_failure_but_cleans_the_failed_worktree(
    tmp_path: Path, monkeypatch
) -> None:
    first_sha = _oid("b")
    second_sha = _oid("c")
    cleaned: list[str] = []
    executed: list[str] = []

    monkeypatch.setattr(
        quality_gate,
        "build_push_validation_plan",
        lambda *_args, **_kwargs: quality_gate.PushValidationPlan(
            updates=(),
            ranges=(),
            targets=(
                quality_gate.PushValidationTarget(
                    terminal_sha=first_sha,
                    ranges=(),
                    changed_paths=("backend/api.py",),
                ),
                quality_gate.PushValidationTarget(
                    terminal_sha=second_sha,
                    ranges=(),
                    changed_paths=("frontend/src/App.tsx",),
                ),
            ),
        ),
    )

    @contextmanager
    def fake_worktree(commit_sha: str, _repository_root: Path):
        try:
            yield tmp_path / commit_sha
        finally:
            cleaned.append(commit_sha)

    def fail_first(
        _plan: quality_gate.GateExecutionPlan,
        *,
        validation_root: Path,
        **_kwargs: object,
    ) -> int:
        executed.append(validation_root.name)
        return 17

    monkeypatch.setattr(quality_gate, "detached_commit_worktree", fake_worktree)
    monkeypatch.setattr(quality_gate, "_execute_gate_plan", fail_first)

    assert quality_gate.run_pre_push_gate(
        _pre_push_line(
            "refs/heads/main",
            second_sha,
            "refs/heads/main",
            _oid("a"),
        ),
        remote_name="origin",
    ) == 17
    assert executed == [first_sha]
    assert cleaned == [first_sha]


def test_staged_snapshot_ignores_workspace_edits_and_reflects_deletes_and_renames(
    indexed_repository: Path,
) -> None:
    valid_readme = "# Pr\u00e9vision\n\nLa qualit\u00e9 reste document\u00e9e.\n"
    _put_index_blob(indexed_repository, "README.md", valid_readme)
    _put_index_blob(
        indexed_repository,
        "backend/old_module.py",
        "def calculate_forecast():\n    return 1\n",
    )
    _run_git(indexed_repository, "update-index", "--force-remove", "backend/old_module.py")
    _put_index_blob(
        indexed_repository,
        "backend/renamed_module.py",
        "def calculate_forecast():\n    return 1\n",
    )
    _put_index_blob(
        indexed_repository,
        "backend/deleted_module.py",
        "def calculate_deleted_forecast():\n    return 1\n",
    )
    _run_git(indexed_repository, "update-index", "--force-remove", "backend/deleted_module.py")

    (indexed_repository / "backend").mkdir()
    (indexed_repository / "README.md").write_text(
        "# Pr\u00c3\u00a9vision\n\nSecuriser le perimetre, la capacite, la securite, "
        "la qualite et le deploiement.\n",
        encoding="utf-8",
    )
    (indexed_repository / "backend" / "renamed_module.py").write_text(
        "def calcul_arrime():\n    return 1\n",
        encoding="utf-8",
    )
    (indexed_repository / "backend" / "deleted_module.py").write_text(
        "def calcul_arrime_supprime():\n    return 1\n",
        encoding="utf-8",
    )
    (indexed_repository / "backend" / "old_module.py").write_text(
        "def calcul_arrime_ancien():\n    return 1\n",
        encoding="utf-8",
    )

    with quality_gate.staged_index_snapshot(indexed_repository) as snapshot:
        assert (snapshot / "README.md").read_text(encoding="utf-8") == valid_readme
        assert pre_commit_guard.check_readme_encoding(snapshot / "README.md") == 0
        assert pre_commit_guard.check_readme_french_accents(snapshot / "README.md") == 0
        assert check_naming_convention.collect_naming_violations(snapshot) == []
        assert not (snapshot / "backend" / "deleted_module.py").exists()
        assert not (snapshot / "backend" / "old_module.py").exists()
        assert (snapshot / "backend" / "renamed_module.py").exists()

    assert pre_commit_guard.check_readme_encoding(indexed_repository / "README.md") == 1
    assert pre_commit_guard.check_readme_french_accents(
        indexed_repository / "README.md"
    ) == 1
    assert check_naming_convention.collect_naming_violations(indexed_repository)


def test_invalid_staged_readme_and_code_are_blocked_even_if_workspace_is_valid(
    indexed_repository: Path,
) -> None:
    _put_index_blob(
        indexed_repository,
        "README.md",
        "# Pr\u00c3\u00a9vision\n\nSecuriser le perimetre, la capacite, la securite, "
        "la qualite et le deploiement.\n",
    )
    _put_index_blob(
        indexed_repository,
        "backend/forecast.py",
        "def calcul_arrime():\n    return 1\n",
    )

    (indexed_repository / "backend").mkdir()
    (indexed_repository / "README.md").write_text(
        "# Pr\u00e9vision\n\nLa qualit\u00e9 reste document\u00e9e.\n",
        encoding="utf-8",
    )
    (indexed_repository / "backend" / "forecast.py").write_text(
        "def calculate_forecast():\n    return 1\n",
        encoding="utf-8",
    )

    with quality_gate.staged_index_snapshot(indexed_repository) as snapshot:
        assert pre_commit_guard.check_readme_encoding(snapshot / "README.md") == 1
        assert pre_commit_guard.check_readme_french_accents(snapshot / "README.md") == 1
        violations = check_naming_convention.collect_naming_violations(snapshot)

    assert [violation.identifier for violation in violations] == ["calcul_arrime"]
    assert pre_commit_guard.check_readme_french_accents(
        indexed_repository / "README.md"
    ) == 0
    assert check_naming_convention.collect_naming_violations(indexed_repository) == []


def test_dod_control_uses_the_supplied_staged_root_and_ignores_workspace_changes(
    tmp_path: Path,
) -> None:
    staged_root = tmp_path / "staged"
    workspace_root = tmp_path / "workspace"
    _copy_dod_fixture(staged_root)
    shutil.copytree(staged_root, workspace_root)

    assert check_dod_compliance.collect_dod_errors(staged_root) == []

    workspace_readme = workspace_root / "README.md"
    workspace_readme.write_text(
        workspace_readme.read_text(encoding="utf-8").replace(
            "docs/definition-of-done.md",
            "docs/missing-definition-of-done.md",
        ),
        encoding="utf-8",
    )

    assert any(
        "README must link docs/definition-of-done.md" in error
        for error in check_dod_compliance.collect_dod_errors(workspace_root)
    )
    assert check_dod_compliance.collect_dod_errors(staged_root) == []

    staged_readme = staged_root / "README.md"
    staged_readme.write_text(
        staged_readme.read_text(encoding="utf-8").replace(
            "docs/definition-of-done.md",
            "docs/missing-definition-of-done.md",
        ),
        encoding="utf-8",
    )
    assert any(
        "README must link docs/definition-of-done.md" in error
        for error in check_dod_compliance.collect_dod_errors(staged_root)
    )


def test_fast_executes_composite_dod_identity_and_naming_from_snapshot(
    tmp_path: Path, monkeypatch
) -> None:
    snapshot = tmp_path / "snapshot"
    snapshot.mkdir()
    calls: list[tuple[str, Path, Path, bool, dict[str, str] | None]] = []

    @contextmanager
    def fake_snapshot():
        yield snapshot

    def fake_run(
        command: quality_gate.GateCommand,
        *,
        validation_root: Path,
        runtime_temp_root: Path,
        isolated_validation: bool,
        extra_env: dict[str, str] | None,
    ) -> int:
        calls.append(
            (
                command.step,
                validation_root,
                runtime_temp_root,
                isolated_validation,
                extra_env,
            )
        )
        return 0

    monkeypatch.setattr(quality_gate, "staged_index_snapshot", fake_snapshot)
    monkeypatch.setattr(quality_gate, "_run_command", fake_run)

    assert quality_gate.run_gate("fast", paths=["README.md"]) == 0
    assert [step for step, _root, _temp, _isolated, _env in calls] == [
        "Repository hygiene (README, encoding, secrets and DoD)",
        "Test classification compliance",
        "Identity boundary",
        "Naming convention",
        "Maintainability ratchet",
        "Test governance compliance",
    ]
    assert all(root == snapshot for _step, root, _temp, _isolated, _env in calls)
    assert all(
        temp == snapshot.parent / ".tmp" / "pytest"
        for _step, _root, temp, _isolated, _env in calls
    )
    assert all(isolated for _step, _root, _temp, isolated, _env in calls)
    assert all(
        env is not None and env["GIT_WORK_TREE"] == str(ROOT.resolve())
        for _step, _root, _temp, _isolated, env in calls
    )
    assert all(
        env is not None and env["MONTECARLO_E2E_PYTHON"] == sys.executable
        for _step, _root, _temp, _isolated, env in calls
    )


def test_isolated_sequential_execution_injects_the_host_python(
    tmp_path: Path, monkeypatch
) -> None:
    command = quality_gate.GateCommand("Check", ("python", "-V"), "Fix the check.")
    plan = quality_gate.GateExecutionPlan(
        context=quality_gate.build_change_context("push", ["README.md"]),
        commands=(command,),
        docker_smoke=False,
    )
    observed_environments: list[dict[str, str] | None] = []
    monkeypatch.setattr(
        quality_gate,
        "_run_command",
        lambda *_args, extra_env, **_kwargs: observed_environments.append(extra_env) or 0,
    )

    assert quality_gate._execute_gate_plan(
        plan,
        validation_root=tmp_path,
        runtime_temp_root=tmp_path / ".tmp",
        isolated_validation=True,
    ) == 0
    assert observed_environments == [{"MONTECARLO_E2E_PYTHON": sys.executable}]
    _assert_current_proofs_replace_residuals(
        tmp_path / "sequential-current",
        monkeypatch,
        parallel=False,
        profile="pr",
    )
    _assert_current_proofs_replace_residuals(
        tmp_path / "parallel-current",
        monkeypatch,
        parallel=True,
        profile="main",
    )
    _assert_current_failure_replaces_residual_success(
        tmp_path / "sequential-failure",
        monkeypatch,
        parallel=False,
    )
    _assert_current_failure_replaces_residual_success(
        tmp_path / "parallel-failure",
        monkeypatch,
        parallel=True,
    )


@pytest.mark.parametrize(
    ("parallel", "selected_node"),
    [(True, None), (False, "e2e")],
    ids=("parallel", "selected-node"),
)
def test_isolated_dag_execution_injects_the_host_python(
    tmp_path: Path, monkeypatch, parallel: bool, selected_node: str | None
) -> None:
    command = quality_gate.GateCommand("Check", ("python", "-V"), "Fix the check.")
    plan = quality_gate.GateExecutionPlan(
        context=quality_gate.build_change_context("push", ["README.md"]),
        commands=(command,),
        docker_smoke=False,
    )
    observed_options: dict[str, object] = {}

    import Scripts.quality_gate_dag as quality_gate_dag

    def fake_execute_gate_plan(*_args: object, **options: object) -> int:
        observed_options.update(options)
        return 0

    monkeypatch.setattr(quality_gate_dag, "execute_gate_plan", fake_execute_gate_plan)

    assert quality_gate._execute_gate_plan(
        plan,
        validation_root=tmp_path,
        runtime_temp_root=tmp_path / ".tmp",
        isolated_validation=True,
        selected_node=selected_node,
        parallel=parallel,
    ) == 0
    assert observed_options["command_env"] == {"MONTECARLO_E2E_PYTHON": sys.executable}


@pytest.mark.parametrize("isolated_validation", [False, True])
def test_command_environment_preserves_existing_values_without_mutating_input(
    isolated_validation: bool,
) -> None:
    command_env = {"EXISTING": "value"}

    environment = quality_gate._command_environment(
        command_env,
        isolated_validation=isolated_validation,
    )

    assert environment["EXISTING"] == "value"
    if isolated_validation:
        assert environment["MONTECARLO_E2E_PYTHON"] == sys.executable
    else:
        assert "MONTECARLO_E2E_PYTHON" not in environment
    assert environment is not command_env
    assert command_env == {"EXISTING": "value"}


@pytest.mark.parametrize("failing_step", [None, "Frontend build"])
def test_isolated_frontend_plan_shares_one_dependency_exposure_and_cleans_it(
    tmp_path: Path, monkeypatch, failing_step: str | None
) -> None:
    host_root = tmp_path / "host"
    host_dependencies = host_root / "frontend" / "node_modules"
    host_dependencies.mkdir(parents=True)
    (host_dependencies / "dependency.txt").write_text("host dependency", encoding="utf-8")
    executable_suffix = ".cmd" if os.name == "nt" else ""
    dependency_executables = {
        "lint": host_dependencies / ".bin" / f"eslint{executable_suffix}",
        "typecheck": host_dependencies / ".bin" / f"tsc{executable_suffix}",
        "test:unit": host_dependencies / ".bin" / f"vitest{executable_suffix}",
        "build": host_dependencies / ".bin" / f"vite{executable_suffix}",
        "test:e2e": host_dependencies / "@playwright" / "test" / "cli.js",
    }
    for executable in dependency_executables.values():
        executable.parent.mkdir(parents=True, exist_ok=True)
        executable.write_text("host dependency executable\n", encoding="utf-8")
    (host_root / "frontend" / "src").mkdir()
    (host_root / "frontend" / "src" / "host-only.ts").write_text(
        "throw new Error('must not be read');\n",
        encoding="utf-8",
    )
    validation_root = tmp_path / "worktree" / "repository"
    validated_frontend = validation_root / "frontend"
    (validated_frontend / "src").mkdir(parents=True)
    (validated_frontend / "package.json").write_text("{}\n", encoding="utf-8")
    (validated_frontend / "playwright.config.js").write_text(
        "// detached config\n",
        encoding="utf-8",
    )
    (validated_frontend / "src" / "validated.ts").write_text(
        "export const validated = true;\n",
        encoding="utf-8",
    )
    runtime_temp_root = validation_root.parent / ".tmp" / "pytest"
    commands = tuple(
        quality_gate.GateCommand(
            step,
            (quality_gate.NPM_COMMAND, "--prefix", "frontend", "run", script),
            "Correct the frontend command.",
        )
        for step, script in (
            ("Frontend lint", "lint"),
            ("Frontend typecheck", "typecheck"),
            ("Frontend unit tests", "test:unit"),
            ("Frontend build", "build"),
            ("End-to-end tests", "test:e2e"),
        )
    )
    plan = quality_gate.GateExecutionPlan(
        context=quality_gate.build_change_context("push", ["frontend/src/App.tsx"]),
        commands=commands,
        docker_smoke=False,
    )
    link_calls = 0
    command_calls: list[str] = []
    link_directory = quality_gate._link_directory
    monkeypatch.setattr(quality_gate, "ROOT", host_root)

    def counted_link(source: Path, destination: Path) -> None:
        nonlocal link_calls
        link_calls += 1
        link_directory(source, destination)

    def run_command(
        command: quality_gate.GateCommand,
        *,
        validation_root: Path,
        extra_env: dict[str, str] | None,
        **_kwargs: object,
    ) -> int:
        dependency_link = validation_root / "frontend" / "node_modules"
        assert dependency_link.resolve() == host_dependencies.resolve()
        assert (validation_root / "frontend" / "package.json").exists()
        assert (validation_root / "frontend" / "playwright.config.js").exists()
        assert (validation_root / "frontend" / "src" / "validated.ts").exists()
        assert not (validation_root / "frontend" / "src" / "host-only.ts").exists()
        script = command.argv[4]
        exposed_executable = dependency_executables[script].relative_to(host_dependencies)
        assert (dependency_link / exposed_executable).is_file()
        if script == "test:e2e":
            assert (dependency_link / ".bin" / f"vite{executable_suffix}").is_file()
        assert str(host_root) not in " ".join(command.argv)
        assert extra_env == {"MONTECARLO_E2E_PYTHON": sys.executable}
        command_calls.append(command.step)
        return 17 if command.step == failing_step else 0

    monkeypatch.setattr(quality_gate, "_link_directory", counted_link)
    monkeypatch.setattr(quality_gate, "_run_command", run_command)

    result = quality_gate._execute_gate_plan(
        plan,
        validation_root=validation_root,
        runtime_temp_root=runtime_temp_root,
        isolated_validation=True,
    )

    assert result == (17 if failing_step else 0)
    assert link_calls == 1
    expected_calls = [command.step for command in commands]
    if failing_step:
        expected_calls = expected_calls[: expected_calls.index(failing_step) + 1]
    assert command_calls == expected_calls
    assert not (validated_frontend / "node_modules").exists()
    assert host_dependencies.exists()


def test_isolated_frontend_plan_reports_missing_host_dependencies(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    host_root = tmp_path / "host"
    validation_root = tmp_path / "snapshot" / "repository"
    (validation_root / "frontend").mkdir(parents=True)
    command = quality_gate.GateCommand(
        "Frontend lint",
        (quality_gate.NPM_COMMAND, "--prefix", "frontend", "run", "lint"),
        "Correct the frontend command.",
    )
    plan = quality_gate.GateExecutionPlan(
        context=quality_gate.build_change_context("fast", ["frontend/src/App.tsx"]),
        commands=(command,),
        docker_smoke=False,
    )
    monkeypatch.setattr(quality_gate, "ROOT", host_root)
    monkeypatch.setattr(
        quality_gate,
        "_run_command",
        lambda *_args, **_kwargs: pytest.fail("Frontend command must not run."),
    )

    assert quality_gate._execute_gate_plan(
        plan,
        validation_root=validation_root,
        runtime_temp_root=validation_root.parent / ".tmp" / "pytest",
        isolated_validation=True,
    ) == 1
    assert str(host_root / "frontend" / "node_modules") in capsys.readouterr().err


def test_frontend_dependency_exposure_cleans_after_interruption(
    tmp_path: Path, monkeypatch
) -> None:
    host_root = tmp_path / "host"
    (host_root / "frontend" / "node_modules").mkdir(parents=True)
    validation_root = tmp_path / "snapshot" / "repository"
    (validation_root / "frontend").mkdir(parents=True)
    monkeypatch.setattr(quality_gate, "ROOT", host_root)

    with pytest.raises(KeyboardInterrupt):
        with quality_gate.exposed_frontend_dependencies(validation_root):
            assert (validation_root / "frontend" / "node_modules").exists()
            raise KeyboardInterrupt

    assert not (validation_root / "frontend" / "node_modules").exists()


def test_push_plan_locks_command_order_sources_and_coverage_artifacts() -> None:
    plan = quality_gate.build_execution_plan(
        quality_gate.build_change_context("push", ["Scripts/quality_gate.py"])
    )

    assert [command.argv for command in plan.commands] == [
        (sys.executable, "Scripts/pre_commit_guard.py"),
        (sys.executable, "Scripts/check_test_classification.py"),
        (sys.executable, "Scripts/check_identity_boundary.py"),
        (sys.executable, "Scripts/check_naming_convention.py"),
        (sys.executable, "Scripts/check_maintainability.py"),
        (sys.executable, "-m", "ruff", "check", "."),
        (
            quality_gate.NPM_COMMAND,
            "--prefix",
            "frontend",
            "run",
            "lint",
            "--",
            "--max-warnings",
            "0",
        ),
        (quality_gate.NPM_COMMAND, "--prefix", "frontend", "run", "typecheck"),
        (
            sys.executable,
            "Scripts/test_execution_profiles.py",
            "--check",
            "--select-profile",
            "main",
            "--select-framework",
            "pytest",
            "--selection-output",
            "reports/test-execution-artifacts/main/backend-tests/pytest-args.txt",
        ),
        (
            sys.executable,
            "-m",
            "pytest",
            "--cov",
            "--cov-config=.coveragerc",
            "--cov-report=json:reports/test-execution-artifacts/main/backend-tests/coverage.json",
            "--cov-report=term-missing",
            "-q",
            "@reports/test-execution-artifacts/main/backend-tests/pytest-args.txt",
        ),
        (
            sys.executable,
            "Scripts/check_python_coverage.py",
            "--report",
            "reports/test-execution-artifacts/main/backend-tests/coverage.json",
        ),
        (
            quality_gate.NPM_COMMAND,
            "--prefix",
            "frontend",
            "run",
            "test:unit:coverage",
        ),
        (quality_gate.NPM_COMMAND, "--prefix", "frontend", "run", "build"),
        (quality_gate.NPM_COMMAND, "--prefix", "frontend", "run", "test:e2e"),
        (sys.executable, "Scripts/test_execution_profiles.py", "--check"),
        (sys.executable, "Scripts/report_test_execution_counts.py", "--check"),
        (
            sys.executable,
            "Scripts/report_vitals_coverage.py",
            "--output",
            "frontend/coverage/vitals-coverage-report.json",
        ),
        (
            sys.executable,
            "Scripts/check_vitals_compliance.py",
            "--report-json",
            "frontend/coverage/vitals-coverage-report.json",
        ),
        (
            sys.executable,
            "Scripts/check_test_governance.py",
            "--profile",
            "main",
            "--require-runtime",
        ),
        (
            sys.executable,
            "Scripts/report_test_strategy.py",
            "--profile",
            "main",
        ),
    ]
    assert plan.commands[0].input_sources == (quality_gate.InputSource.HEAD,)
    assert all(
        command.input_sources == (quality_gate.InputSource.HEAD,)
        for command in plan.commands
    )
    assert {
        command.step: command.coverage_artifacts
        for command in plan.commands
        if command.coverage_artifacts
    } == {
        "Versioned Python coverage": (".coverage", ".coverage.python.json"),
        "Frontend unit coverage": (
            "frontend/coverage/coverage-final.json",
            "frontend/coverage/index.html",
        ),
        "End-to-end tests (Playwright)": (
            "frontend/coverage/e2e-coverage-summary.json",
        ),
        "Vitals coverage report": (
            "frontend/coverage/vitals-coverage-report.json",
        ),
    }
    assert plan.coverage_artifacts == (
        ".coverage",
        ".coverage.python.json",
        "frontend/coverage/coverage-final.json",
        "frontend/coverage/index.html",
        "frontend/coverage/e2e-coverage-summary.json",
        "frontend/coverage/vitals-coverage-report.json",
    )
    assert not plan.docker_smoke


def test_main_nightly_and_release_use_coverage_without_simple_test_duplicates() -> None:
    plans = [
        quality_gate.execution_plan("push", False),
        quality_gate.execution_plan("nightly", False),
        quality_gate.execution_plan("release", False),
        quality_gate.build_execution_plan(
            quality_gate.build_change_context("ci", [], execution_profile="main")
        ).commands,
    ]
    for commands in plans:
        pytest_commands = [
            command
            for command in commands
            if command.argv[:3] == (sys.executable, "-m", "pytest")
        ]
        frontend_unit_commands = [
            command
            for command in commands
            if command.argv[:4]
            == (quality_gate.NPM_COMMAND, "--prefix", "frontend", "run")
            and command.argv[4] in {"test:unit", "test:unit:coverage"}
        ]

        assert len(pytest_commands) == 1
        assert "--cov" in pytest_commands[0].argv
        assert "--cov-config=.coveragerc" in pytest_commands[0].argv
        assert [command.argv[4] for command in frontend_unit_commands] == [
            "test:unit:coverage",
        ]


def test_naming_convention_runs_once_in_the_main_plan() -> None:
    plan = quality_gate.build_execution_plan(
        quality_gate.build_change_context("push", ["Scripts/quality_gate.py"])
    )

    assert sum(command.step == "Naming convention" for command in plan.commands) == 1
    assert all(
        check.name != "Naming convention"
        for check in pre_commit_guard.guard_plan(["Scripts/quality_gate.py"])
    )


def test_maintainability_ratchet_runs_once_in_the_main_plan() -> None:
    plan = quality_gate.build_execution_plan(
        quality_gate.build_change_context("push", ["Scripts/quality_gate.py"])
    )

    assert sum(command.step == "Maintainability ratchet" for command in plan.commands) == 1


def test_documentation_only_fast_path_skips_expensive_checks() -> None:
    paths = ["README.md", "docs/definition-of-done.md"]

    assert quality_gate.is_documentation_only(paths)
    steps = [command.step for command in quality_gate.execution_plan("fast", True)]
    assert steps == [
        "Repository hygiene (README, encoding, secrets and DoD)",
        "Test classification compliance",
        "Identity boundary",
        "Naming convention",
        "Maintainability ratchet",
        "Test governance compliance",
    ]
    assert not quality_gate.is_documentation_only(["README.md", "backend/api.py"])


def test_pytest_command_uses_unique_workspace_basetemps_without_global_temp_access(
    tmp_path: Path, monkeypatch
) -> None:
    basetemps: list[Path] = []

    def forbidden_global_temp() -> str:
        pytest.fail("The gate must not consult the global user temporary directory.")

    def run(argv: tuple[str, ...], **_kwargs: object) -> subprocess.CompletedProcess[str]:
        basetemp = Path(argv[argv.index("--basetemp") + 1])
        assert basetemp.is_dir()
        basetemps.append(basetemp)
        return subprocess.CompletedProcess(argv, 0)

    monkeypatch.setattr(quality_gate.tempfile, "gettempdir", forbidden_global_temp)
    monkeypatch.setattr(quality_gate.subprocess, "run", run)
    command = quality_gate.GateCommand(
        "Selected backend tests",
        (sys.executable, "-m", "pytest", "-q", "tests/test_api_health.py"),
        "Correct the test.",
        backend_test=True,
    )

    assert quality_gate._run_command(command, validation_root=tmp_path) == 0
    assert quality_gate._run_command(command, validation_root=tmp_path) == 0

    assert len(set(basetemps)) == 2
    assert all(path.parent == tmp_path / ".tmp" / "pytest" for path in basetemps)
    assert all(path.name.startswith("selected-backend-tests-") for path in basetemps)
    assert all(not path.exists() for path in basetemps)


@pytest.mark.parametrize("return_code", [0, 23])
def test_pytest_basetemp_is_cleaned_after_success_and_failure(
    tmp_path: Path, monkeypatch, return_code: int
) -> None:
    basetemp: Path | None = None

    def run(argv: tuple[str, ...], **_kwargs: object) -> subprocess.CompletedProcess[str]:
        nonlocal basetemp
        basetemp = Path(argv[argv.index("--basetemp") + 1])
        assert basetemp.exists()
        return subprocess.CompletedProcess(argv, return_code)

    monkeypatch.setattr(quality_gate.subprocess, "run", run)
    command = quality_gate.GateCommand(
        "Backend tests",
        (sys.executable, "-m", "pytest", "-q"),
        "Correct the test.",
        backend_test=True,
    )

    assert quality_gate._run_command(command, validation_root=tmp_path) == return_code
    assert basetemp is not None
    assert not basetemp.exists()


def test_pytest_basetemp_is_cleaned_after_interruption(tmp_path: Path, monkeypatch) -> None:
    basetemp: Path | None = None

    def interrupt(argv: tuple[str, ...], **_kwargs: object) -> None:
        nonlocal basetemp
        basetemp = Path(argv[argv.index("--basetemp") + 1])
        assert basetemp.exists()
        raise KeyboardInterrupt

    monkeypatch.setattr(quality_gate.subprocess, "run", interrupt)
    command = quality_gate.GateCommand(
        "Versioned Python coverage",
        (sys.executable, "-m", "pytest", "--cov", "-q"),
        "Correct the test.",
        backend_test=True,
    )

    with pytest.raises(KeyboardInterrupt):
        quality_gate._run_command(command, validation_root=tmp_path)
    assert basetemp is not None
    assert not basetemp.exists()


def test_pytest_basetemp_cleanup_removes_only_the_expected_directory(
    tmp_path: Path,
) -> None:
    runtime_temp_root = tmp_path / ".tmp" / "pytest"
    basetemp = runtime_temp_root / "backend-tests-123-normal"
    sibling = runtime_temp_root / "backend-tests-456-sibling"
    basetemp.mkdir(parents=True)
    sibling.mkdir()
    (basetemp / "result.txt").write_text("ok", encoding="utf-8")

    quality_gate._remove_pytest_basetemp(
        basetemp,
        runtime_temp_root,
        expected_prefix="backend-tests-123-",
    )

    assert not basetemp.exists()
    assert sibling.exists()


def test_pytest_basetemp_cleanup_removes_a_readonly_file(tmp_path: Path) -> None:
    runtime_temp_root = tmp_path / ".tmp" / "pytest"
    basetemp = runtime_temp_root / "backend-tests-123-readonly"
    basetemp.mkdir(parents=True)
    readonly_file = basetemp / "readonly.txt"
    readonly_file.write_text("locked", encoding="utf-8")
    readonly_file.chmod(stat.S_IREAD)

    quality_gate._remove_pytest_basetemp(
        basetemp,
        runtime_temp_root,
        expected_prefix="backend-tests-123-",
    )

    assert not basetemp.exists()


def test_pytest_basetemp_cleanup_handles_readonly_git_objects(tmp_path: Path) -> None:
    runtime_temp_root = tmp_path / ".tmp" / "pytest"
    basetemp = runtime_temp_root / "backend-tests-123-git"
    git_object = basetemp / "repository" / ".git" / "objects" / "ab" / "object"
    git_object.parent.mkdir(parents=True)
    git_object.write_bytes(b"temporary git object")
    git_object.chmod(stat.S_IREAD)

    quality_gate._remove_pytest_basetemp(
        basetemp,
        runtime_temp_root,
        expected_prefix="backend-tests-123-",
    )

    assert not basetemp.exists()


def test_pytest_basetemp_cleanup_retries_the_failing_path(
    tmp_path: Path, monkeypatch
) -> None:
    runtime_temp_root = tmp_path / ".tmp" / "pytest"
    basetemp = runtime_temp_root / "backend-tests-123-retry"
    blocked_file = basetemp / "blocked.txt"
    blocked_file.parent.mkdir(parents=True)
    blocked_file.write_text("locked", encoding="utf-8")
    attempts: list[Path] = []

    def rmtree(path: Path, *, onexc) -> None:
        def retry(failing_path: str) -> None:
            attempts.append(Path(failing_path))
            Path(failing_path).unlink()

        onexc(retry, str(blocked_file), PermissionError("read-only"))
        Path(path).rmdir()

    monkeypatch.setattr(quality_gate, "_is_windows", lambda: True)
    monkeypatch.setattr(quality_gate.shutil, "rmtree", rmtree)

    quality_gate._remove_pytest_basetemp(
        basetemp,
        runtime_temp_root,
        expected_prefix="backend-tests-123-",
    )

    assert attempts == [blocked_file]
    assert not basetemp.exists()


def test_pytest_basetemp_cleanup_propagates_a_persistent_permission_error(
    tmp_path: Path, monkeypatch
) -> None:
    runtime_temp_root = tmp_path / ".tmp" / "pytest"
    basetemp = runtime_temp_root / "backend-tests-123-persistent"
    blocked_file = basetemp / "blocked.txt"
    blocked_file.parent.mkdir(parents=True)
    blocked_file.write_text("locked", encoding="utf-8")

    def rmtree(_path: Path, *, onexc) -> None:
        def retry(_failing_path: str) -> None:
            raise PermissionError("still locked")

        onexc(retry, str(blocked_file), PermissionError("read-only"))

    monkeypatch.setattr(quality_gate, "_is_windows", lambda: True)
    monkeypatch.setattr(quality_gate.shutil, "rmtree", rmtree)

    with pytest.raises(PermissionError, match="still locked"):
        quality_gate._remove_pytest_basetemp(
            basetemp,
            runtime_temp_root,
            expected_prefix="backend-tests-123-",
        )


def test_retry_windows_readonly_removal_restores_permissions_and_retries(
    monkeypatch,
) -> None:
    chmod_calls: list[tuple[str, int]] = []
    retry_calls: list[str] = []
    path = "readonly.txt"

    monkeypatch.setattr(quality_gate, "_is_windows", lambda: True)
    monkeypatch.setattr(
        quality_gate.os,
        "chmod",
        lambda value, mode: chmod_calls.append((value, mode)),
    )

    quality_gate._retry_windows_readonly_removal(
        retry_calls.append,
        path,
        PermissionError("read-only"),
    )

    assert chmod_calls == [(path, stat.S_IREAD | stat.S_IWRITE)]
    assert retry_calls == [path]


def test_retry_windows_readonly_removal_rethrows_unsupported_errors(monkeypatch) -> None:
    retry_calls: list[str] = []
    permission_error = PermissionError("read-only")
    monkeypatch.setattr(quality_gate, "_is_windows", lambda: False)
    with pytest.raises(PermissionError) as non_windows:
        quality_gate._retry_windows_readonly_removal(
            retry_calls.append,
            "readonly.txt",
            permission_error,
        )
    assert non_windows.value is permission_error

    other_error = OSError("other")
    monkeypatch.setattr(quality_gate, "_is_windows", lambda: True)
    with pytest.raises(OSError) as incompatible:
        quality_gate._retry_windows_readonly_removal(
            retry_calls.append,
            "readonly.txt",
            other_error,
        )
    assert incompatible.value is other_error
    assert retry_calls == []


def test_pytest_basetemp_cleanup_rejects_a_path_outside_runtime_root(
    tmp_path: Path,
) -> None:
    runtime_temp_root = tmp_path / ".tmp" / "pytest"
    outside = tmp_path / "outside" / "backend-tests-123-unsafe"
    outside.mkdir(parents=True)

    with pytest.raises(ValueError, match="unexpected Pytest basetemp"):
        quality_gate._remove_pytest_basetemp(
            outside,
            runtime_temp_root,
            expected_prefix="backend-tests-123-",
        )

    assert outside.exists()


@pytest.mark.parametrize("mode", ["fast", "push", "ci"])
def test_all_gate_modes_apply_the_same_pytest_basetemp_strategy(
    tmp_path: Path, mode: str
) -> None:
    command = next(
        command
        for command in quality_gate.execution_plan(mode, False)
        if quality_gate._is_direct_pytest_command(command)
    )
    isolated_validation = mode in {"fast", "push"}
    validation_root = (
        tmp_path / mode / "repository" if isolated_validation else tmp_path / mode
    )
    validation_root.mkdir(parents=True)
    runtime_temp_root = quality_gate._runtime_temp_root(
        validation_root,
        isolated_validation=isolated_validation,
    )

    with quality_gate._command_argv(
        command,
        validation_root,
        runtime_temp_root,
        isolated_validation=isolated_validation,
    ) as argv:
        basetemp = Path(argv[argv.index("--basetemp") + 1])
        assert basetemp.parent == runtime_temp_root
        assert basetemp.name.startswith(quality_gate._pytest_basetemp_prefix(command))
        assert basetemp.exists()
        if isolated_validation:
            assert not quality_gate._is_descendant(basetemp, validation_root)
        else:
            assert basetemp.parent == validation_root / ".tmp" / "pytest"

    assert not basetemp.exists()


def test_isolated_validation_rejects_a_runtime_temp_descendant(tmp_path: Path) -> None:
    validation_root = tmp_path / "snapshot" / "repository"
    validation_root.mkdir(parents=True)
    command = quality_gate.GateCommand(
        "Backend tests",
        (sys.executable, "-m", "pytest", "-q"),
        "Correct the test.",
        backend_test=True,
    )

    with pytest.raises(ValueError, match="outside the isolated validation root"):
        with quality_gate._command_argv(
            command,
            validation_root,
            validation_root / ".tmp" / "pytest",
            isolated_validation=True,
        ):
            pytest.fail("An unsafe basetemp must be rejected before command execution.")


def test_external_snapshot_basetemp_supports_a_nested_git_repository(
    tmp_path: Path, monkeypatch
) -> None:
    validation_root = tmp_path / "snapshot" / "repository"
    validation_root.mkdir(parents=True)
    runtime_temp_root = quality_gate._runtime_temp_root(
        validation_root,
        isolated_validation=True,
    )
    observed_basetemp: Path | None = None
    run_process = subprocess.run
    monkeypatch.setenv("GIT_DIR", str(validation_root / ".git-from-index"))
    monkeypatch.setenv("GIT_WORK_TREE", str(validation_root))
    monkeypatch.setenv("GIT_INDEX_FILE", str(validation_root / ".git-index-from-index"))
    monkeypatch.setenv(
        "GIT_OBJECT_DIRECTORY",
        str(validation_root / ".git-objects-from-index"),
    )

    def run(argv: tuple[str, ...], **_kwargs: object) -> subprocess.CompletedProcess[str]:
        nonlocal observed_basetemp
        observed_basetemp = Path(argv[argv.index("--basetemp") + 1])
        nested_repository = observed_basetemp / "nested-repository"
        command_env = _kwargs["env"]
        assert isinstance(command_env, dict)
        assert "GIT_DIR" not in command_env
        assert "GIT_WORK_TREE" not in command_env
        assert "GIT_INDEX_FILE" not in command_env
        assert "GIT_OBJECT_DIRECTORY" not in command_env
        result = run_process(
            ["git", "init", str(nested_repository)],
            check=False,
            capture_output=True,
            text=True,
            env=command_env,
        )
        assert result.returncode == 0
        assert (nested_repository / ".git").is_dir()
        return subprocess.CompletedProcess(argv, 0)

    monkeypatch.setattr(quality_gate.subprocess, "run", run)
    command = quality_gate.GateCommand(
        "Backend tests",
        (sys.executable, "-m", "pytest", "-q"),
        "Correct the test.",
        backend_test=True,
    )

    assert (
        quality_gate._run_command(
            command,
            validation_root=validation_root,
            runtime_temp_root=runtime_temp_root,
            isolated_validation=True,
        )
        == 0
    )
    assert observed_basetemp is not None
    assert not quality_gate._is_descendant(observed_basetemp, validation_root)
    assert not observed_basetemp.exists()


def test_first_failed_command_exit_code_is_propagated(monkeypatch) -> None:
    failure = quality_gate.GateCommand(
        "Repository hygiene (README, encoding, secrets and DoD)",
        ("missing-command",),
        "Fix it.",
    )
    skipped = quality_gate.GateCommand(
        "Test classification compliance",
        ("also-missing",),
        "Fix it.",
    )
    calls: list[str] = []

    monkeypatch.setattr(
        quality_gate,
        "build_execution_plan",
        lambda context: quality_gate.GateExecutionPlan(
            context=context,
            commands=(failure, skipped),
            docker_smoke=False,
        ),
    )

    @contextmanager
    def fake_snapshot():
        with _temporary_repository_snapshot() as snapshot:
            yield snapshot

    monkeypatch.setattr(quality_gate, "staged_index_snapshot", fake_snapshot)
    monkeypatch.setattr(quality_gate, "_index_git_environment", lambda: {})

    def fake_run(
        command: quality_gate.GateCommand,
        **_kwargs: object,
    ) -> int:
        calls.append(command.step)
        return 23

    monkeypatch.setattr(quality_gate, "_run_command", fake_run)

    assert quality_gate.run_gate("fast", paths=["README.md"]) == 23
    assert calls == ["Repository hygiene (README, encoding, secrets and DoD)"]


def test_push_never_runs_docker_but_ci_runs_the_docker_smoke(monkeypatch) -> None:
    monkeypatch.setattr(quality_gate, "_run_command", lambda _command, **_kwargs: 0)
    monkeypatch.setattr(quality_gate, "_ensure_frontend_dependencies", lambda: 0)
    docker_called = False

    def run_docker_smoke() -> int:
        nonlocal docker_called
        docker_called = True
        return 0

    monkeypatch.setattr(quality_gate, "_run_docker_smoke", run_docker_smoke)

    assert quality_gate.run_gate("push", paths=["backend/api.py"]) == 0
    assert not docker_called
    assert quality_gate.run_gate(
        "ci", paths=["backend/api.py"], execution_profile="main"
    ) == 0
    assert docker_called


def test_real_docker_smoke_is_blocked_without_env(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    monkeypatch.setattr(quality_gate, "ROOT", tmp_path)
    monkeypatch.setattr(
        quality_gate,
        "_run_command",
        lambda *_args, **_kwargs: pytest.fail("Docker must not start without .env."),
    )

    assert quality_gate._run_docker_smoke() == 1
    assert ".env is required for Docker smoke testing" in capsys.readouterr().err


def test_docker_smoke_retries_a_transient_connection_reset(monkeypatch) -> None:
    responses = iter(
        [
            ConnectionResetError("backend is still starting"),
            (200, ""),
            (200, '{"status":"ok"}'),
            (200, ""),
            (200, '{"mode":"backlog_to_weeks"}'),
            *[(200, "")] * 20,
            (429, ""),
        ]
    )

    monkeypatch.setattr(quality_gate.time, "sleep", lambda _: None)

    urls: list[str] = []

    def request(url: str, *_args: object, **_kwargs: object) -> tuple[int, str]:
        urls.append(url)
        response = next(responses)
        if isinstance(response, OSError):
            raise response
        return response

    monkeypatch.setattr(quality_gate, "_request", request)

    assert quality_gate._run_docker_http_smoke() is None
    assert all(url.startswith("http://127.0.0.1:18080/") for url in urls)


def test_hooks_and_ci_delegate_to_the_central_command() -> None:
    pre_commit = (ROOT / ".githooks" / "pre-commit").read_text(encoding="utf-8")
    pre_push = (ROOT / ".githooks" / "pre-push").read_text(encoding="utf-8")
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")

    assert "Scripts/quality_gate.py\" fast" in pre_commit
    assert "Scripts/quality_gate.py\" push" in pre_push
    assert '--remote-name "${1:-}"' in pre_push
    assert '--remote-url "${2:-}"' in pre_push
    assert "python Scripts/quality_gate.py ci" in ci
    assert "npm run lint" not in ci
    assert "npm run test:e2e" not in ci


def test_ci_mode_statically_keeps_the_docker_smoke() -> None:
    gate = (ROOT / "Scripts" / "quality_gate_dag.py").read_text(encoding="utf-8")
    plan = (ROOT / "Scripts" / "quality_gate_plan.py").read_text(encoding="utf-8")
    docker = (ROOT / "Scripts" / "quality_gate.py").read_text(encoding="utf-8")

    assert 'context.mode in {"ci", "nightly", "release"}' in plan
    assert 'plan.docker_smoke and node == "release-or-container-checks"' in gate
    assert '("docker", "compose", "build")' in docker


def test_vscode_main_validation_task_is_unique_and_uses_the_shared_dag() -> None:
    tasks = json.loads((ROOT / ".vscode" / "tasks.json").read_text(encoding="utf-8"))
    labels = [task["label"] for task in tasks["tasks"]]
    label = "Validation : profil main"
    legacy = "Coverage:" + " 8 terminaux"

    assert labels.count(label) == 1
    assert legacy not in labels
    task = next(task for task in tasks["tasks"] if task["label"] == label)
    assert task["args"] == ["Scripts/quality_gate.py", "ci", "--profile", "main"]
    assert "dependsOn" not in task
    assert "dependsOrder" not in task
    assert not (ROOT / ".vscode/scripts" / ("run-" + "coverage-staged.ps1")).exists()


def test_main_validation_preserves_each_historical_control_once_in_the_dag() -> None:
    plan = quality_gate.build_execution_plan(
        quality_gate.build_change_context("ci", [], execution_profile="main")
    )
    steps = [command.step for command in plan.commands]
    historical_controls = (
        "Test classification compliance",
        "Naming convention",
        "Frontend lint (ESLint, zero warning)",
        "Frontend typecheck (TypeScript)",
        "Frontend build",
        "Versioned Python coverage",
        "Python coverage scope and per-file compliance",
        "Frontend unit coverage",
        "End-to-end tests (Playwright)",
        "Vitals coverage report",
        "Vitals compliance",
        "Verify global execution count reference",
        "Test strategy reporting",
    )
    contract = json.loads(
        (ROOT / "config/test-execution-profiles.json").read_text(encoding="utf-8")
    )
    aggregate = next(node for node in contract["nodes"] if node["id"] == "aggregate")

    assert plan.execution_profile == "main"
    assert all(steps.count(control) == 1 for control in historical_controls)
    assert set(aggregate["needs"]) == {
        "backend-static",
        "frontend-static",
        "backend-tests",
        "frontend-tests",
        "e2e",
        "release-or-container-checks",
    }


def test_workspace_pytest_temporaries_are_git_ignored() -> None:
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")

    assert ".tmp/" in gitignore.splitlines()


def test_complete_coverage_task_scripts_are_selectively_publishable() -> None:
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    required_scripts = {
        ".vscode/scripts/run-e2e-coverage.ps1",
        ".vscode/scripts/run-vitals-coverage.ps1",
        ".vscode/scripts/run-vitals-compliance.ps1",
    }

    assert ".vscode/*" in gitignore
    assert "!.vscode/scripts/" in gitignore
    assert ".vscode/scripts/*" in gitignore
    assert {
        line.removeprefix("!")
        for line in gitignore
        if line.startswith("!.vscode/scripts/") and line.endswith(".ps1")
    } == required_scripts
    assert all((ROOT / path).is_file() for path in required_scripts)
    assert not any(
        line in {
            "!.vscode/settings.json",
            "!.vscode/launch.json",
            "!.vscode/scripts/health-watch.ps1",
            "!.vscode/scripts/start-mongo-dev.ps1",
            "!.vscode/scripts/run-front-coverage-staged.ps1",
        }
        for line in gitignore
    )


def test_vscode_coverage_artifacts_and_e2e_threshold_state_are_locked() -> None:
    vitals_rates = (
        ROOT / ".vscode" / "scripts" / "run-vitals-coverage.ps1"
    ).read_text(encoding="utf-8")
    vitals_compliance = (
        ROOT / ".vscode" / "scripts" / "run-vitals-compliance.ps1"
    ).read_text(encoding="utf-8")
    e2e_config = json.loads(
        (ROOT / "frontend" / "e2e-coverage.config.json").read_text(encoding="utf-8")
    )
    package_scripts = json.loads(
        (ROOT / "frontend" / "package.json").read_text(encoding="utf-8")
    )["scripts"]
    for script in (vitals_rates, vitals_compliance):
        assert 'frontend\\coverage\\coverage-final.json' in script
        assert '".coverage.python.json"' in script
        assert 'frontend\\coverage\\e2e-coverage-summary.json' in script
        assert "vitals-coverage-report.json" in script
    assert set(e2e_config["thresholds"]) == {
        "statements",
        "branches",
        "functions",
        "lines",
    }
    assert all(value >= 80 for value in e2e_config["thresholds"].values())
    assert package_scripts["test:e2e"] == "node scripts/run-e2e-coverage.mjs"


def test_dod_reports_invalid_python_and_e2e_policies(tmp_path: Path) -> None:
    _copy_dod_fixture(tmp_path)
    (tmp_path / ".coveragerc").write_text("[run]\nbranch = invalid\n", encoding="utf-8")
    (tmp_path / "frontend/e2e-coverage.config.json").write_text(
        '{"schemaVersion": 2}', encoding="utf-8"
    )
    errors = check_dod_compliance.collect_dod_errors(tmp_path)
    assert any("Invalid Python coverage configuration" in error for error in errors)
    assert any("E2E coverage" in error for error in errors)


def test_dod_main_reports_failure_and_success(monkeypatch, capsys) -> None:
    monkeypatch.setattr(check_dod_compliance, "collect_dod_errors", lambda _root: ["boom"])
    assert check_dod_compliance.main() == 1
    assert "boom" in capsys.readouterr().err
    monkeypatch.setattr(check_dod_compliance, "collect_dod_errors", lambda _root: [])
    assert check_dod_compliance.main() == 0


def test_git_helpers_and_staged_listing_cover_failures(tmp_path: Path, monkeypatch, capsys) -> None:
    class Result:
        def __init__(self, code=0, stdout="", stderr=""):
            self.returncode = code
            self.stdout = stdout
            self.stderr = stderr

    monkeypatch.setattr(
        quality_gate.subprocess,
        "run",
        lambda *_a, **_k: Result(stdout="ABCDEF" * 7),
    )
    assert quality_gate._git_output(["status"], repository_root=tmp_path)
    monkeypatch.setattr(
        quality_gate.subprocess,
        "run",
        lambda *_a, **_k: Result(1, stderr="git failed"),
    )
    with pytest.raises(RuntimeError, match="git failed"):
        quality_gate._git_output(["status"], repository_root=tmp_path)
    with pytest.raises(ValueError, match="Unable to resolve pushed SHA"):
        quality_gate.resolve_commit_sha("a" * 40, tmp_path)

    monkeypatch.setattr(
        quality_gate.subprocess,
        "run",
        lambda *_a, **_k: Result(0, stdout="not-an-oid"),
    )
    with pytest.raises(ValueError, match="invalid commit SHA"):
        quality_gate.resolve_commit_sha("a" * 40, tmp_path)

    monkeypatch.setattr(
        quality_gate.subprocess,
        "run",
        lambda *_a, **_k: Result(1, stderr="index failed"),
    )
    with pytest.raises(RuntimeError, match="checkout-index"):
        quality_gate._checkout_index(tmp_path, tmp_path)

    monkeypatch.setattr(
        quality_gate,
        "read_staged_changes",
        lambda *_a, **_k: (_ for _ in ()).throw(
            quality_gate.GitStagingError("index failed")
        ),
    )
    with pytest.raises(RuntimeError, match="git diff"):
        quality_gate.staged_files()
    assert "index failed" in capsys.readouterr().err


def test_index_environment_resolution_fails_closed(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(
        quality_gate,
        "index_git_environment",
        lambda _root: (_ for _ in ()).throw(
            quality_gate.GitStagingError("missing commit index")
        ),
    )

    with pytest.raises(RuntimeError, match="missing commit index"):
        quality_gate._index_git_environment(tmp_path)


def test_push_plan_rejects_missing_remote_git_errors_and_invalid_revisions(
    tmp_path: Path, monkeypatch
) -> None:
    update = quality_gate.PrePushRefUpdate(
        "refs/heads/main", "a" * 40, "refs/heads/main", "b" * 40
    )
    with pytest.raises(ValueError, match="remote name"):
        quality_gate.build_push_validation_plan((update,), "", tmp_path)

    monkeypatch.setattr(quality_gate, "resolve_commit_sha", lambda sha, _root: sha)
    monkeypatch.setattr(
        quality_gate,
        "_git_output",
        lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    with pytest.raises(ValueError, match="commit range"):
        quality_gate.build_push_validation_plan((update,), "origin", tmp_path)

    calls = iter(["invalid\n"])
    monkeypatch.setattr(quality_gate, "_git_output", lambda *_a, **_k: next(calls))
    with pytest.raises(ValueError, match="invalid commit SHA"):
        quality_gate.build_push_validation_plan((update,), "origin", tmp_path)

    monkeypatch.setattr(
        quality_gate,
        "_git_output",
        lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("diff")),
    )
    with pytest.raises(ValueError, match="changed files"):
        quality_gate._changed_paths_for_commits(("a" * 40,), tmp_path)


def test_remaining_classification_and_command_paths(tmp_path: Path) -> None:
    assert quality_gate.parse_pre_push_updates("\nrefs/a " + "a" * 40 + " refs/b " + "b" * 40)
    decision = quality_gate._classify_changed_path("backend/__init__.py")
    assert decision.level == quality_gate.ChangeLevel.IMPACTED
    unknown = quality_gate._classify_changed_path("backend/unknown.py")
    assert quality_gate._resolve_path_tests(unknown) is None
    assert quality_gate._resolve_path_tests(
        quality_gate.PathClassification("unknown.txt", quality_gate.ChangeLevel.MASSIVE, "unknown")
    ) is None
    command = quality_gate.GateCommand("Echo", ("echo", "ok"), "Fix")
    with quality_gate._command_argv(
        command, tmp_path, tmp_path / ".tmp/pytest", isolated_validation=False
    ) as argv:
        assert argv == command.argv
    with pytest.raises(ValueError, match="Unsupported mode"):
        quality_gate.resolve_change_context("unknown", [])


def test_run_command_start_failure_and_environment_cleanup(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    command = quality_gate.GateCommand("Tool", ("missing",), "Install it", backend_test=True)
    monkeypatch.setenv("GIT_DIR", "bad")
    monkeypatch.setenv("GIT_WORK_TREE", "bad")
    monkeypatch.setattr(
        quality_gate.subprocess,
        "run",
        lambda *_a, **_k: (_ for _ in ()).throw(OSError("missing")),
    )
    assert quality_gate._run_command(
        command,
        validation_root=tmp_path,
        extra_env={"EXTRA": "1"},
    ) == 127
    assert "could not start" in capsys.readouterr().err


def test_frontend_link_guards_and_platform_paths(tmp_path: Path, monkeypatch) -> None:
    source = tmp_path / "source"
    source.mkdir()
    destination = tmp_path / "destination"
    destination.mkdir()
    with pytest.raises(FileExistsError):
        quality_gate._link_directory(source, destination)

    destination.rmdir()

    class FakeLink:
        def __init__(self, target: Path) -> None:
            self.target = target
            self.linked = False
            self.parent = destination.parent

        def exists(self):
            return False

        def __fspath__(self):
            return str(destination)

        def symlink_to(self, target, target_is_directory=False):
            assert target_is_directory
            self.target = target
            self.linked = True

        def is_symlink(self):
            return self.linked

        def resolve(self):
            return self.target.resolve()

        def unlink(self):
            self.linked = False

    fake = FakeLink(source)
    quality_gate._link_directory(source, fake)
    assert fake.linked
    quality_gate._remove_frontend_dependency_link(fake, source)
    assert not fake.linked

    bad = tmp_path / "bad"
    bad.mkdir()
    with pytest.raises(OSError, match="non-link"):
        quality_gate._remove_frontend_dependency_link(bad, source)
    bad.rmdir()
    other = tmp_path / "other"
    other.mkdir()
    fake = FakeLink(other)
    fake.linked = True
    with pytest.raises(OSError, match="unexpected target"):
        quality_gate._remove_frontend_dependency_link(fake, source)

    missing_root = tmp_path / "validation"
    monkeypatch.setattr(
        quality_gate,
        "_frontend_dependency_paths",
        lambda _root: (tmp_path / "missing", missing_root / "node_modules"),
    )
    with pytest.raises(FileNotFoundError, match="dependencies are missing"):
        with quality_gate.exposed_frontend_dependencies(missing_root):
            pass


def test_is_windows_matches_the_host_platform() -> None:
    assert quality_gate._is_windows() is (os.name == "nt")


def test_frontend_dependency_junction_removal_uses_rmdir(
    tmp_path: Path, monkeypatch
) -> None:
    source = tmp_path / "source"
    source.mkdir()

    class JunctionPath:
        def __fspath__(self) -> str:
            return str(tmp_path / "junction")

        def is_symlink(self) -> bool:
            return False

        def resolve(self) -> Path:
            return source.resolve()

    destination = JunctionPath()
    removed: list[object] = []
    monkeypatch.setattr(
        quality_gate.os.path,
        "isjunction",
        lambda candidate: candidate is destination,
    )
    monkeypatch.setattr(quality_gate.os, "rmdir", removed.append)

    quality_gate._remove_frontend_dependency_link(destination, source)

    assert removed == [destination]


def test_windows_link_failure_and_worktree_cleanup_errors(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    source = tmp_path / "source"
    source.mkdir()
    destination = tmp_path / "destination"
    junction_calls: list[list[str]] = []

    def fail_symlink(*_args, **_kwargs) -> None:
        raise OSError("symlink failed")

    def fail_junction(command, **_kwargs):
        junction_calls.append(command)
        return subprocess.CompletedProcess(command, 1, stdout="", stderr="junction")

    monkeypatch.setattr(quality_gate, "_is_windows", lambda: True)
    monkeypatch.setattr(Path, "symlink_to", fail_symlink)
    monkeypatch.setattr(quality_gate.subprocess, "run", fail_junction)
    with pytest.raises(OSError, match="junction"):
        quality_gate._link_directory(source, destination)
    assert junction_calls == [
        ["cmd.exe", "/c", "mklink", "/J", str(destination), str(source)]
    ]

    monkeypatch.setattr(
        quality_gate,
        "_run_worktree_command",
        lambda *_a, **_k: subprocess.CompletedProcess([], 1, stdout="", stderr="cleanup"),
    )
    with pytest.raises(RuntimeError, match="clean detached"):
        quality_gate._cleanup_detached_worktree(tmp_path, tmp_path)

    calls = iter(
        [
            subprocess.CompletedProcess([], 1, stdout="", stderr="add failed"),
            subprocess.CompletedProcess([], 1, stdout="", stderr="cleanup failed"),
        ]
    )
    monkeypatch.setattr(quality_gate, "_run_worktree_command", lambda *_a, **_k: next(calls))
    monkeypatch.setattr(
        quality_gate,
        "_cleanup_detached_worktree",
        lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("cleanup failed")),
    )
    with pytest.raises(RuntimeError, match="Unable to create"):
        with quality_gate.detached_commit_worktree("a" * 40, tmp_path):
            pass
    assert "cleanup failed" in capsys.readouterr().err


def test_request_success_http_error_and_docker_log_command(monkeypatch) -> None:
    class Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return b"ok"

    monkeypatch.setattr(quality_gate.urllib.request, "urlopen", lambda *_a, **_k: Response())
    assert quality_gate._request("http://example.test") == (200, "ok")
    error = quality_gate.urllib.error.HTTPError(
        "http://example.test", 429, "limited", {}, io.BytesIO(b"limited")
    )
    monkeypatch.setattr(
        quality_gate.urllib.request,
        "urlopen",
        lambda *_a, **_k: (_ for _ in ()).throw(error),
    )
    assert quality_gate._request("http://example.test", b"{}", {"X": "1"}) == (429, "limited")
    calls = []
    monkeypatch.setattr(quality_gate.subprocess, "run", lambda *a, **k: calls.append((a, k)))
    quality_gate._docker_logs()
    assert calls


@pytest.mark.parametrize(
    ("responses", "message"),
    [
        ([(500, "")] * 30, "did not become ready"),
        ([(200, ""), (500, "bad")], "Mongo health"),
        ([(200, ""), (200, '{"status":"ok"}'), (500, "")], "POST /simulate"),
        (
            [(200, ""), (200, '{"status":"ok"}'), (200, ""), (200, "[]")],
            "history",
        ),
    ],
)
def test_docker_http_smoke_reports_protocol_failures(monkeypatch, responses, message) -> None:
    iterator = iter(responses)
    monkeypatch.setattr(quality_gate, "_request", lambda *_a, **_k: next(iterator))
    monkeypatch.setattr(quality_gate.time, "sleep", lambda _seconds: None)
    with pytest.raises(RuntimeError, match=message):
        quality_gate._run_docker_http_smoke()


def test_docker_rate_limit_failures_and_smoke_orchestration(tmp_path: Path, monkeypatch) -> None:
    prefix = [(200, ""), (200, '{"status":"ok"}'), (200, ""), (200, '{"mode":"backlog_to_weeks"}')]
    for tail, message in [
        ([(429, "")], "too early"),
        ([(200, "")] * 21, "Expected HTTP 429"),
    ]:
        iterator = iter([*prefix, *tail])
        monkeypatch.setattr(quality_gate, "_request", lambda *_a, **_k: next(iterator))
        with pytest.raises(RuntimeError, match=message):
            quality_gate._run_docker_http_smoke()

    (tmp_path / ".env").write_text("ok", encoding="utf-8")
    assert quality_gate._validate_docker_smoke_configuration(tmp_path)
    monkeypatch.setattr(quality_gate, "_validate_docker_smoke_configuration", lambda: True)
    commands = []
    monkeypatch.setattr(
        quality_gate,
        "_run_command",
        lambda command, **_kwargs: commands.append(command.step) or 0,
    )
    monkeypatch.setattr(
        quality_gate,
        "_run_docker_http_smoke",
        lambda: (_ for _ in ()).throw(RuntimeError("smoke")),
    )
    monkeypatch.setattr(quality_gate, "_docker_logs", lambda: commands.append("logs"))
    assert quality_gate._run_docker_smoke() == 1
    assert commands == ["Docker build", "Docker start", "logs", "Docker cleanup"]

    commands.clear()
    monkeypatch.setattr(quality_gate, "_run_command", lambda command, **_k: 7)
    assert quality_gate._run_docker_smoke() == 7


def test_execute_plan_dependency_error_pre_push_interrupt_and_main_dispatch(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    context = quality_gate.build_change_context("push", ["frontend/src/App.tsx"])
    command = quality_gate.GateCommand(
        "Frontend", (quality_gate.NPM_COMMAND, "--version"), "Fix"
    )
    plan = quality_gate.GateExecutionPlan(context, (command,), False)
    monkeypatch.setattr(quality_gate, "_ensure_frontend_dependencies", lambda: 0)

    @contextmanager
    def broken_dependencies(_root):
        raise OSError("link")
        yield

    monkeypatch.setattr(quality_gate, "exposed_frontend_dependencies", broken_dependencies)
    assert quality_gate._execute_gate_plan(
        plan,
        validation_root=tmp_path,
        runtime_temp_root=tmp_path / ".tmp",
        isolated_validation=True,
    ) == 1
    assert "unable to expose" in capsys.readouterr().err

    assert quality_gate.run_pre_push_gate("bad", remote_name="origin") == 2
    target = quality_gate.PushValidationTarget("a" * 40, (), ())
    validation = quality_gate.PushValidationPlan((), (), (target,))
    monkeypatch.setattr(quality_gate, "parse_pre_push_updates", lambda _text: ())
    monkeypatch.setattr(quality_gate, "build_push_validation_plan", lambda *_a, **_k: validation)
    monkeypatch.setattr(
        quality_gate,
        "detached_commit_worktree",
        lambda *_a, **_k: (_ for _ in ()).throw(KeyboardInterrupt()),
    )
    assert quality_gate.run_pre_push_gate("", remote_name="origin") == 1

    monkeypatch.setattr(quality_gate, "run_pre_push_gate", lambda *a, **k: 4)
    monkeypatch.setattr(quality_gate.sys, "stdin", io.StringIO("updates"))
    assert quality_gate.main(["push", "--remote-name", "origin"]) == 4
    monkeypatch.setattr(quality_gate, "run_gate", lambda mode: 5)
    assert quality_gate.main(["ci"]) == 5


def test_remaining_quality_gate_success_and_cleanup_paths(tmp_path: Path, monkeypatch) -> None:
    oid = "a" * 40
    monkeypatch.setattr(quality_gate, "_git_output", lambda *_a, **_k: oid.upper())
    assert quality_gate.resolve_commit_sha(oid, tmp_path) == oid

    monkeypatch.setattr(
        quality_gate,
        "read_staged_changes",
        lambda *_a, **_k: (
            quality_gate.StagedChange("M", ("backend/api.py",)),
        ),
    )
    assert quality_gate.staged_files() == ["backend/api.py"]
    monkeypatch.setattr(
        quality_gate.subprocess,
        "run",
        lambda *_a, **_k: subprocess.CompletedProcess(["git"], 0, "", ""),
    )
    assert quality_gate._run_worktree_command(["prune"], repository_root=tmp_path).returncode == 0

    with pytest.raises(RuntimeError, match="plain"):
        quality_gate._retry_windows_readonly_removal(
            lambda _path: None, str(tmp_path), RuntimeError("plain")
        )
    runtime = tmp_path / "runtime"
    runtime.mkdir()
    absent = runtime / "step-absent"
    quality_gate._remove_pytest_basetemp(absent, runtime, expected_prefix="step-")
    persistent = runtime / "step-persistent"
    persistent.mkdir()
    monkeypatch.setattr(quality_gate.shutil, "rmtree", lambda *_a, **_k: None)
    with pytest.raises(OSError, match="still exists"):
        quality_gate._remove_pytest_basetemp(persistent, runtime, expected_prefix="step-")

    bad_context = quality_gate.ChangeContext(
        mode="bad", changed_paths=(), changed_paths_source=None, documentation_only=False
    )
    with pytest.raises(ValueError, match="Unsupported mode"):
        quality_gate.build_execution_plan(bad_context)


def test_link_rethrow_unexpected_exposure_and_cleanup_propagation(
    tmp_path: Path, monkeypatch
) -> None:
    source = tmp_path / "source"
    source.mkdir()

    class BrokenDestination:
        parent = tmp_path

        def __fspath__(self):
            return str(tmp_path / "broken")

        def exists(self):
            return False

        def is_symlink(self):
            return False

        def symlink_to(self, *_a, **_k):
            raise OSError("symlink failed")

    monkeypatch.setattr(quality_gate, "_is_windows", lambda: False)
    with pytest.raises(OSError, match="symlink failed"):
        quality_gate._link_directory(source, BrokenDestination())

    destination = tmp_path / "destination"
    destination.mkdir()
    monkeypatch.setattr(
        quality_gate,
        "_frontend_dependency_paths",
        lambda _root: (source, destination),
    )
    monkeypatch.setattr(quality_gate, "_link_directory", lambda *_a: None)
    other = tmp_path / "other"
    monkeypatch.setattr(
        destination.__class__,
        "resolve",
        lambda self: other if self == destination else self,
    )
    monkeypatch.setattr(quality_gate, "_remove_frontend_dependency_link", lambda *_a: None)
    with pytest.raises(OSError, match="unexpected target"):
        with quality_gate.exposed_frontend_dependencies(tmp_path):
            pass

    calls = iter([subprocess.CompletedProcess([], 0, stdout="", stderr="")])
    monkeypatch.setattr(quality_gate, "_run_worktree_command", lambda *_a, **_k: next(calls))
    monkeypatch.setattr(
        quality_gate,
        "_cleanup_detached_worktree",
        lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("cleanup only")),
    )
    with pytest.raises(RuntimeError, match="cleanup only"):
        with quality_gate.detached_commit_worktree("a" * 40, tmp_path):
            pass


def test_docker_smoke_success_and_pre_push_reference_output(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(quality_gate, "_validate_docker_smoke_configuration", lambda: True)
    commands: list[str] = []
    monkeypatch.setattr(
        quality_gate,
        "_run_command",
        lambda command, **_k: commands.append(command.step) or 0,
    )
    monkeypatch.setattr(quality_gate, "_run_docker_http_smoke", lambda: None)
    assert quality_gate._run_docker_smoke() == 0
    assert commands[-1] == "Docker cleanup"

    update = quality_gate.PrePushRefUpdate(
        "refs/heads/main", "a" * 40, "refs/heads/main", "b" * 40
    )
    commit_range = quality_gate.PushCommitRange(
        update, "a" * 40, ("--reverse", "b..a"), ("a" * 40,), ("README.md",)
    )
    validation = quality_gate.PushValidationPlan((update,), (commit_range,), ())
    monkeypatch.setattr(quality_gate, "parse_pre_push_updates", lambda _text: (update,))
    monkeypatch.setattr(quality_gate, "build_push_validation_plan", lambda *_a, **_k: validation)
    assert (
        quality_gate.run_pre_push_gate(
            "update", remote_name="origin", repository_root=tmp_path
        )
        == 0
    )
