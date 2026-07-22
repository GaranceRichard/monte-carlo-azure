from __future__ import annotations

import json
import re
import runpy
import sys
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace

import pytest

from Scripts import classify_tests, quality_gate, quality_gate_dag, quality_gate_plan
from Scripts import test_execution_profiles as profiles
from Scripts import test_execution_profiles_graph as profile_graph
from Scripts import test_execution_profiles_validation as profile_validation
from Scripts.test_classifier_discovery import LogicalCase
from Scripts.test_classifier_engine import classify_case

ROOT = Path(__file__).resolve().parents[1]


def _contract() -> dict:
    return deepcopy(profiles.load_json(ROOT / profiles.DEFAULT_CONTRACT))


def _inventory() -> list[dict]:
    return [
        {
            "logicalCaseId": "pytest:tests/pr.py::test_pr",
            "framework": "pytest",
            "sourcePath": "tests/pr.py",
            "selector": "test_pr",
            "status": "classified",
            "executionProfile": "pr",
            "nature": "unit",
            "purposes": ["functional"],
            "criticality": "critical",
        },
        {
            "logicalCaseId": "vitest:frontend/src/main.test.ts::main [1:1]",
            "framework": "vitest",
            "sourcePath": "frontend/src/main.test.ts",
            "selector": "main [1:1]",
            "status": "classified",
            "executionProfile": "main",
            "nature": "component",
            "purposes": ["functional"],
        },
        {
            "logicalCaseId": "pytest:tests/nightly.py::test_nightly",
            "framework": "pytest",
            "sourcePath": "tests/nightly.py",
            "selector": "test_nightly",
            "status": "classified",
            "executionProfile": "nightly",
            "nature": "integration",
            "purposes": ["performance"],
        },
        {
            "logicalCaseId": "playwright:frontend/tests/release.spec.js::release [1:1]",
            "framework": "playwright",
            "sourcePath": "frontend/tests/release.spec.js",
            "selector": "release [1:1]",
            "status": "classified",
            "executionProfile": "release",
            "nature": "e2e",
            "purposes": ["migration_recovery"],
        },
    ]


def _case(framework: str, source_path: str, selector: str, **evidence: object) -> LogicalCase:
    observed = {
        "imports": [],
        "calls": [],
        "fixtures": [],
        "resources": [],
        "modifiers": [],
        "conditional": False,
        "dynamicTitle": False,
    }
    observed.update(evidence)
    return LogicalCase(framework, source_path, selector, observed)


def test_real_contract_and_all_four_profile_attributions_are_valid() -> None:
    contract = _contract()
    rules = classify_tests.load_json(ROOT / "config/test-classification-rules.json")
    overrides = classify_tests.load_json(ROOT / "config/test-classification-overrides.json")
    catalog = classify_tests.load_json(ROOT / "config/test-classification.json")
    cases = [
        _case("pytest", "tests/test_mc_core.py", "test_fast", imports=["backend.mc_core"]),
        _case(
            "playwright",
            "frontend/tests/e2e/flow.spec.js",
            "flow [1:1]",
            calls=["page.goto"],
        ),
        _case(
            "pytest",
            "tests/test_test_execution_profiles.py",
            "test_plans_are_deterministic_and_dependencies_are_stable",
            imports=["Scripts.test_execution_profiles"],
        ),
        _case(
            "pytest",
            "tests/test_test_execution_profiles.py",
            "test_github_workflow_has_parallel_jobs_and_publish_waits_for_aggregate",
            imports=["Scripts.test_execution_profiles"],
        ),
    ]

    assert profiles.validate_contract(contract) == []
    assert [
        classify_case(case, rules, overrides, catalog)["executionProfile"] for case in cases
    ] == ["pr", "main", "nightly", "release"]


def test_profile_inclusions_and_change_levels_are_orthogonal() -> None:
    contract = _contract()
    assert [profiles.included_profiles(contract, profile) for profile in profiles.PROFILES] == [
        ("pr",),
        ("pr", "main"),
        ("pr", "main", "nightly"),
        ("pr", "main", "release"),
    ]
    targeted = profiles.build_profile_plan(contract, _inventory(), "main", change_level="targeted")
    massive = profiles.build_profile_plan(contract, _inventory(), "main", change_level="massive")
    assert targeted["changeLevel"] == "targeted"
    assert massive["changeLevel"] == "massive"
    assert targeted["includedProfiles"] == massive["includedProfiles"]
    assert targeted["logicalCases"] == massive["logicalCases"] == 2
    with pytest.raises(ValueError, match="Unknown change level"):
        profiles.build_profile_plan(contract, _inventory(), "main", change_level="pr")
    with pytest.raises(ValueError, match="Unknown execution profile"):
        profiles.included_profiles(contract, "missing")


def test_exact_case_selection_by_profile_and_node() -> None:
    contract = _contract()
    inventory = _inventory()
    expected = {"pr": 1, "main": 2, "nightly": 3, "release": 3}
    for profile, count in expected.items():
        plan = profiles.build_profile_plan(contract, inventory, profile)
        selected = [case for node in plan["nodes"] for case in node["logicalCaseIds"]]
        assert len(selected) == count
        assert len(selected) == len(set(selected))
        by_node = {node["id"]: node for node in plan["nodes"]}
        assert all(
            item.startswith("pytest:") for item in by_node["backend-tests"]["logicalCaseIds"]
        )
        assert all(
            item.startswith("vitest:") for item in by_node["frontend-tests"]["logicalCaseIds"]
        )
        assert all(item.startswith("playwright:") for item in by_node["e2e"]["logicalCaseIds"])
    nightly_ids = {
        case
        for node in profiles.build_profile_plan(contract, inventory, "nightly")["nodes"]
        for case in node["logicalCaseIds"]
    }
    release_ids = {
        case
        for node in profiles.build_profile_plan(contract, inventory, "release")["nodes"]
        for case in node["logicalCaseIds"]
    }
    assert not any("release" in item for item in nightly_ids)
    assert not any("nightly" in item for item in release_ids)

    monkey_contract = _contract()
    original_order = profiles.topological_node_ids
    profiles.topological_node_ids = lambda *_args: (
        *original_order(monkey_contract, "pr"),
        "backend-tests",
    )
    try:
        with pytest.raises(ValueError, match="does not select each logical case once"):
            profiles.build_profile_plan(monkey_contract, inventory, "pr")
    finally:
        profiles.topological_node_ids = original_order


def test_plans_are_deterministic_and_dependencies_are_stable() -> None:
    contract = _contract()
    first = profiles.build_plan_report(contract, _inventory())
    second = profiles.build_plan_report(contract, list(reversed(_inventory())))
    assert first == second
    for plan in first["profiles"]:
        node_ids = [node["id"] for node in plan["nodes"]]
        assert node_ids[0] == "preflight"
        assert node_ids[-1] == "aggregate"
        aggregate = plan["nodes"][-1]
        assert aggregate["aggregator"]
        assert set(aggregate["needs"]) == {
            "backend-static",
            "frontend-static",
            "backend-tests",
            "frontend-tests",
            "e2e",
            "release-or-container-checks",
        }


def test_missing_dependency_cycle_and_inaccessible_node_are_rejected() -> None:
    missing = _contract()
    missing["nodes"][1]["needs"] = ["absent"]
    assert any("missing node absent" in error for error in profiles.validate_contract(missing))

    cycle = _contract()
    cycle["nodes"][0]["needs"] = ["aggregate"]
    assert any("dependency cycle" in error for error in profiles.validate_contract(cycle))
    with pytest.raises(ValueError, match="dependency cycle"):
        profiles.topological_node_ids(cycle, "pr")

    inaccessible = _contract()
    inaccessible["nodes"][-1]["needs"].remove("backend-static")
    assert any(
        "unreachable nodes: backend-static" in error
        for error in profiles.validate_contract(inaccessible)
    )


def test_parallel_write_and_exclusive_resource_conflicts_are_rejected() -> None:
    write_conflict = _contract()
    write_conflict["nodes"][1]["writes"] = list(write_conflict["nodes"][2]["writes"])
    errors = profiles.validate_contract(write_conflict)
    assert any(
        "parallel write conflict backend-static/frontend-static" in error for error in errors
    )

    resource_conflict = _contract()
    resource_conflict["nodes"][1]["resources"] = ["exclusive"]
    resource_conflict["nodes"][2]["resources"] = ["exclusive"]
    errors = profiles.validate_contract(resource_conflict)
    assert any("parallel exclusive-resource conflict" in error for error in errors)


def test_exactly_one_final_aggregator_is_required() -> None:
    none = _contract()
    none["nodes"][-1]["aggregator"] = False
    assert any(
        "exactly one final aggregator" in error for error in profiles.validate_contract(none)
    )

    two = _contract()
    two["nodes"][1]["aggregator"] = True
    errors = profiles.validate_contract(two)
    assert any("exactly one final aggregator" in error for error in errors)

    not_final = _contract()
    not_final["nodes"][0]["aggregator"] = True
    not_final["nodes"][-1]["aggregator"] = False
    assert any(
        "aggregator must be final" in error
        for error in profiles.validate_contract(not_final)
    )


def test_command_mapping_and_batches_preserve_parallel_branches() -> None:
    contract = _contract()
    assert profiles.node_for_command(contract, "main", "Backend lint (Ruff)") == "backend-static"
    batches = dict(
        profiles.execution_batches(
            contract,
            "main",
            [
                "Repository hygiene (README, encoding, secrets and DoD)",
                "Backend lint (Ruff)",
                "Frontend lint (ESLint, zero warning)",
                "Backend tests",
                "Frontend unit tests (Vitest)",
                "End-to-end tests (Playwright)",
                "Release or container checks",
            ],
        )
    )
    assert batches["preflight"]
    assert batches["backend-static"] == ("Backend lint (Ruff)",)
    assert batches["frontend-static"] == ("Frontend lint (ESLint, zero warning)",)
    assert batches["aggregate"] == ()
    with pytest.raises(ValueError, match="maps to 0 DAG nodes"):
        profiles.node_for_command(contract, "main", "unknown")
    duplicate = _contract()
    duplicate["nodes"][2]["commands"].append("Backend lint (Ruff)")
    with pytest.raises(ValueError, match="maps to 2 DAG nodes"):
        profiles.node_for_command(duplicate, "main", "Backend lint (Ruff)")


def test_fast_push_ci_nightly_and_release_resolve_expected_profiles() -> None:
    contexts = [
        quality_gate.build_change_context("fast", []),
        quality_gate.build_change_context("push", []),
        quality_gate.build_change_context("ci", []),
        quality_gate.build_change_context("nightly", []),
        quality_gate.build_change_context("release", []),
    ]
    assert [quality_gate.build_execution_plan(item).execution_profile for item in contexts] == [
        "pr",
        "main",
        "pr",
        "nightly",
        "release",
    ]
    ci_main = quality_gate.build_change_context("ci", [], execution_profile="main")
    assert quality_gate.build_execution_plan(ci_main).execution_profile == "main"
    with pytest.raises(ValueError, match="Unsupported execution profile"):
        quality_gate.build_execution_plan(
            quality_gate.build_change_context("ci", [], execution_profile="invalid")
        )


def test_contract_and_inventory_shape_failures_are_reported() -> None:
    assert profiles.validate_contract([]) == ["execution-profile contract must be a JSON object"]
    assert profiles.validate_contract({"schemaVersion": "bad"})

    malformed = _contract()
    malformed["profiles"][0]["id"] = "main"
    malformed["profiles"][0]["includes"] = []
    malformed["profiles"][0]["description"] = ""
    malformed["nodes"][0]["id"] = ""
    malformed["nodes"][0]["order"] = -1
    malformed["nodes"][0]["needs"] = "wrong"
    malformed["nodes"][0]["commands"] = [""]
    malformed["nodes"][0]["profiles"] = ["pr", "pr"]
    malformed["nodes"][0]["aggregator"] = None
    errors = profiles.validate_contract(malformed)
    assert any("identifiers must be unique" in error for error in errors)
    assert any("invalid inclusion hierarchy" in error for error in errors)
    assert any("requires a description" in error for error in errors)
    assert any("id must be a non-empty" in error for error in errors)
    assert any("order must be" in error for error in errors)
    assert any("needs must contain" in error for error in errors)
    assert any("commands must contain" in error for error in errors)
    assert any("profiles must not contain duplicates" in error for error in errors)
    assert any("aggregator must be boolean" in error for error in errors)

    bad_inventory: object = [
        None,
        {"logicalCaseId": "same", "framework": "unknown", "executionProfile": "unknown"},
        {"logicalCaseId": "same", "framework": "pytest", "executionProfile": "pr"},
        {"logicalCaseId": "", "framework": "pytest", "executionProfile": "pr"},
    ]
    inventory_errors = profiles.validate_inventory(bad_inventory)
    assert any("must be an object" in error for error in inventory_errors)
    assert any("duplicate inventory" in error for error in inventory_errors)
    assert any("invalid executionProfile" in error for error in inventory_errors)
    assert any("unsupported framework" in error for error in inventory_errors)
    assert profiles.validate_inventory({}) == ["classification inventory must be an array"]
    with pytest.raises(ValueError, match="unsupported framework"):
        profiles.build_profile_plan(_contract(), bad_inventory, "pr")  # type: ignore[arg-type]

    assert profile_graph.profile_map({"profiles": None}) == {}
    assert profile_graph.node_map({"nodes": None}) == {}
    invalid_includes = _contract()
    invalid_includes["profiles"][0]["includes"] = None
    with pytest.raises(ValueError, match="Invalid includes"):
        profiles.included_profiles(invalid_includes, "pr")

    inactive = _contract()
    inactive["nodes"][0]["profiles"].remove("pr")
    assert any(
        "needs inactive node preflight" in error
        for error in profiles.validate_contract(inactive)
    )

    malformed_profiles = _contract()
    malformed_profiles["profiles"][0] = None
    assert any(
        "each execution profile must be an object" in error
        for error in profile_validation._profile_errors(malformed_profiles)
    )
    assert profile_validation._one_node_errors(None, "node") == ["node must be an object"]
    duplicate_nodes = _contract()
    duplicate_nodes["nodes"][1]["id"] = duplicate_nodes["nodes"][0]["id"]
    assert any(
        "execution node identifiers must be unique" in error
        for error in profile_validation._node_shape_errors(duplicate_nodes)
    )


def test_strict_json_report_and_cli_paths(tmp_path: Path, capsys, monkeypatch) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"x": 1, "x": 2}', encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate JSON property"):
        profiles.load_json(duplicate)
    with pytest.raises(ValueError, match="Missing execution-profile artifact"):
        profiles.load_json(tmp_path / "missing.json")
    invalid = tmp_path / "invalid.json"
    invalid.write_text("{", encoding="utf-8")
    with pytest.raises(ValueError, match="Invalid execution-profile JSON"):
        profiles.load_json(invalid)

    root = tmp_path / "root"
    (root / "config").mkdir(parents=True)
    (root / "reports").mkdir()
    (root / profiles.DEFAULT_CONTRACT).write_text(
        json.dumps(_contract()), encoding="utf-8"
    )
    (root / profiles.DEFAULT_INVENTORY).write_text(
        json.dumps(_inventory()), encoding="utf-8"
    )
    output = root / profiles.DEFAULT_REPORT
    assert profiles.main(["--root", str(root)]) == 0
    assert output.is_file()
    written = output.read_bytes()
    report = json.loads(written)
    assert profiles.write_report(report, output) == written
    assert profiles.main(["--root", str(root), "--check"]) == 0
    selection = root / "pytest-args.txt"
    assert profiles.main(
        [
            "--root",
            str(root),
            "--select-profile",
            "main",
            "--select-framework",
            "pytest",
            "--selection-output",
            str(selection),
        ]
    ) == 0
    assert selection.read_text(encoding="utf-8") == "tests/pr.py::test_pr\n"
    vitest_selection = root / "vitest-args.txt"
    payload = profiles.write_framework_selection(
        _contract(), _inventory(), "main", "vitest", vitest_selection
    )
    assert payload == b"frontend/src/main.test.ts\n"
    assert profiles.main(["--root", str(root), "--select-profile", "pr"]) == 2
    output_text = capsys.readouterr().out
    assert "selection requires" in output_text
    assert '"main": 2' in output_text
    assert profiles.main(["--root", str(tmp_path / "missing")]) == 1
    assert "ERROR:" in capsys.readouterr().out

    monkeypatch.setattr(
        sys,
        "argv",
        ["test_execution_profiles.py", "--root", str(root), "--check"],
    )
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_path(str(ROOT / "Scripts/test_execution_profiles.py"), run_name="__main__")
    assert exit_info.value.code == 0


def _dag_root(tmp_path: Path) -> Path:
    root = tmp_path / "dag-root"
    (root / "config").mkdir(parents=True)
    (root / "reports").mkdir()
    (root / profiles.DEFAULT_CONTRACT).write_text(json.dumps(_contract()), encoding="utf-8")
    (root / profiles.DEFAULT_INVENTORY).write_text(json.dumps(_inventory()), encoding="utf-8")
    return root


def _dag_plan(*commands: quality_gate.GateCommand, docker: bool = False) -> SimpleNamespace:
    return SimpleNamespace(commands=commands, execution_profile="main", docker_smoke=docker)


def test_dag_node_execution_aggregation_and_error_paths(tmp_path: Path, monkeypatch) -> None:
    root = _dag_root(tmp_path)
    runtime = root / ".tmp"
    command = quality_gate.GateCommand(
        "Backend lint (Ruff)", ("python", "-V"), "fix"
    )
    plan = _dag_plan(command)
    monkeypatch.setattr(quality_gate, "_run_command", lambda *_args, **_kwargs: 0)

    assert quality_gate_dag.execute_gate_plan(
        quality_gate,
        plan,
        validation_root=root,
        runtime_temp_root=runtime,
        isolated_validation=False,
        selected_node="backend-static",
    ) == 0
    assert quality_gate_dag.execute_gate_plan(
        quality_gate,
        plan,
        validation_root=root,
        runtime_temp_root=runtime,
        isolated_validation=False,
        selected_node="missing",
    ) == 2

    merged_artifacts = {
        "backend-tests/coverage.json": "backend coverage",
        "backend-tests/pytest.json": "backend results",
        "frontend-tests/coverage/coverage-final.json": "vitest coverage",
        "frontend-tests/vitest.json": "vitest results",
        "e2e/e2e-coverage-summary.json": "e2e coverage",
        "e2e/playwright.json": "e2e results",
    }
    artifact_root = root / "reports/test-execution-artifacts/main"
    for relative_path, content in merged_artifacts.items():
        artifact = artifact_root / relative_path
        artifact.parent.mkdir(parents=True, exist_ok=True)
        artifact.write_text(content, encoding="utf-8")
    aggregate_plan = _dag_plan()
    assert quality_gate_dag.execute_gate_plan(
        quality_gate,
        aggregate_plan,
        validation_root=root,
        runtime_temp_root=runtime,
        isolated_validation=False,
        selected_node="aggregate",
    ) == 0
    promoted_artifacts = {
        ".coverage.python.json": "backend coverage",
        "reports/test-execution-native/pytest.json": "backend results",
        "frontend/coverage/coverage-final.json": "vitest coverage",
        "reports/test-execution-native/vitest.json": "vitest results",
        "frontend/coverage/e2e-coverage-summary.json": "e2e coverage",
        "reports/test-execution-native/playwright.json": "e2e results",
    }
    for relative_path, content in promoted_artifacts.items():
        assert (root / relative_path).read_text(encoding="utf-8") == content
    assert (root / "reports/test-execution-plan.json").is_file()

    frontend = quality_gate.GateCommand(
        "Frontend lint (ESLint, zero warning)",
        (quality_gate.NPM_COMMAND, "--prefix", "frontend", "run", "lint"),
        "fix",
    )
    monkeypatch.setattr(quality_gate, "_ensure_frontend_dependencies", lambda: 7)
    assert quality_gate_dag.execute_gate_plan(
        quality_gate,
        _dag_plan(frontend),
        validation_root=root,
        runtime_temp_root=runtime,
        isolated_validation=False,
        selected_node="frontend-static",
    ) == 7


def test_dag_parallel_sequential_docker_and_dependency_failures(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    root = _dag_root(tmp_path)
    runtime = root / ".tmp"
    preflight = quality_gate.GateCommand(
        "Repository hygiene (README, encoding, secrets and DoD)", ("python", "-V"), "fix"
    )
    plan = _dag_plan(preflight)
    monkeypatch.setattr(quality_gate, "_run_command", lambda *_args, **_kwargs: 0)
    monkeypatch.setattr(quality_gate, "_execute_commands_sequentially", lambda *_a, **_k: 0)
    assert quality_gate_dag.execute_gate_plan(
        quality_gate,
        plan,
        validation_root=root,
        runtime_temp_root=runtime,
        isolated_validation=False,
        parallel=False,
    ) == 0

    release = quality_gate.GateCommand(
        "Release or container checks", ("python", "-V"), "fix"
    )
    monkeypatch.setattr(quality_gate, "_run_docker_smoke", lambda: 9)
    assert quality_gate_dag.execute_gate_plan(
        quality_gate,
        _dag_plan(release, docker=True),
        validation_root=root,
        runtime_temp_root=runtime,
        isolated_validation=False,
        selected_node="release-or-container-checks",
    ) == 9
    assert quality_gate_dag.execute_gate_plan(
        quality_gate,
        _dag_plan(preflight, release, docker=True),
        validation_root=root,
        runtime_temp_root=runtime,
        isolated_validation=False,
        parallel=True,
    ) == 9

    frontend = quality_gate.GateCommand(
        "Frontend lint (ESLint, zero warning)",
        (quality_gate.NPM_COMMAND, "--prefix", "frontend", "run", "lint"),
        "fix",
    )
    monkeypatch.setattr(quality_gate, "_ensure_frontend_dependencies", lambda: 0)

    class Broken:
        def __enter__(self):
            raise OSError("link")

        def __exit__(self, *_args):
            return False

    monkeypatch.setattr(quality_gate, "exposed_frontend_dependencies", lambda _root: Broken())
    assert quality_gate_dag.execute_gate_plan(
        quality_gate,
        _dag_plan(frontend),
        validation_root=root,
        runtime_temp_root=runtime,
        isolated_validation=True,
        selected_node="frontend-static",
    ) == 1
    assert "unable to expose" in capsys.readouterr().out


def test_dag_impossible_ready_set_and_quality_gate_cli_options(tmp_path: Path, monkeypatch) -> None:
    root = _dag_root(tmp_path)
    contract = _contract()
    contract["nodes"][0]["needs"] = ["backend-static"]
    grouped = {identifier: () for identifier in profile_graph.active_nodes(contract, "main")}
    grouped["preflight"] = (
        quality_gate.GateCommand(
            "Repository hygiene (README, encoding, secrets and DoD)", ("python",), "fix"
        ),
    )
    grouped["backend-static"] = grouped["preflight"]
    code, _durations = quality_gate_dag._execute_parallel(
        quality_gate,
        _dag_plan(*grouped["preflight"]),
        grouped,
        contract,
        validation_root=root,
        runtime_temp_root=root / ".tmp",
        isolated_validation=False,
        command_env={},
    )
    assert code == 2

    monkeypatch.setattr(quality_gate, "run_gate", lambda mode, **options: len(options) + 4)
    assert quality_gate.main(["ci", "--profile", "main", "--node", "aggregate"]) == 6
    assert quality_gate_plan.execution_plan("fast", False, quality_gate)


def test_github_workflow_has_parallel_jobs_and_publish_waits_for_aggregate() -> None:
    workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
    preflight = workflow.split("  preflight:\n", maxsplit=1)[1].split(
        "  backend-static:\n", maxsplit=1
    )[0]
    assert preflight.count("actions/upload-artifact@v7") == 1
    assert "name: preflight-${{ steps.profile.outputs.value }}" in preflight
    assert "path: reports/test-execution-artifacts" in preflight
    branch_blocks: dict[str, str] = {}
    for job in (
        "backend-static",
        "frontend-static",
        "backend-tests",
        "frontend-tests",
        "e2e",
        "release-or-container-checks",
    ):
        assert f"  {job}:" in workflow
        job_tail = workflow.split(f"  {job}:\n", maxsplit=1)[1]
        next_job = re.search(r"(?m)^  [a-z][a-z0-9-]*:\s*$", job_tail)
        block = job_tail[: next_job.start()] if next_job else job_tail
        branch_blocks[job] = block
        assert "needs: preflight" in block

    pytest_jobs = {
        job: block
        for job, block in branch_blocks.items()
        if "--node backend-tests" in block
    }
    assert set(pytest_jobs) == {"backend-tests"}
    for block in pytest_jobs.values():
        assert "actions/setup-node@v6" in block
        assert 'node-version: "22"' in block
        assert "cache: npm" in block
        assert "cache-dependency-path: frontend/package-lock.json" in block
        assert "npm --prefix frontend ci" in block
        assert "playwright install" not in block
        assert block.index("actions/setup-node@v6") < block.index(
            "npm --prefix frontend ci"
        )
        assert block.index("npm --prefix frontend ci") < block.index(
            "python Scripts/quality_gate.py ci"
        )

    producer_jobs = {
        job
        for job, block in branch_blocks.items()
        if "actions/upload-artifact@v7" in block
    }
    assert producer_jobs == {
        "backend-static",
        "frontend-static",
        "backend-tests",
        "frontend-tests",
        "e2e",
        "release-or-container-checks",
    }
    for job in producer_jobs:
        block = branch_blocks[job]
        assert block.count("actions/upload-artifact@v7") == 1
        assert block.count("path: reports/test-execution-artifacts") == 1

    aggregate_tail = workflow.split("  aggregate:\n", maxsplit=1)[1]
    next_job = re.search(r"(?m)^  [a-z][a-z0-9-]*:\s*$", aggregate_tail)
    aggregate = aggregate_tail[: next_job.start()] if next_job else aggregate_tail
    assert aggregate.count("actions/download-artifact@v8") == 1
    assert aggregate.count("path: reports/test-execution-artifacts") == 1
    assert "merge-multiple: true" in aggregate
    assert aggregate.count("actions/upload-artifact@v7") == 1
    assert "reports/test-strategy-report.json" in aggregate
    assert "reports/test-strategy-report.md" in aggregate
    assert "actions/setup-node@v6" in aggregate
    assert 'node-version: "22"' in aggregate
    assert "cache: npm" in aggregate
    assert "cache-dependency-path: frontend/package-lock.json" in aggregate
    assert "npm --prefix frontend ci" in aggregate
    assert aggregate.index("actions/setup-node@v6") < aggregate.index(
        "npm --prefix frontend ci"
    )
    assert aggregate.index("npm --prefix frontend ci") < aggregate.index(
        "python Scripts/quality_gate.py ci"
    )

    assert "schedule:" in workflow
    assert "release:" in workflow
    publish = workflow.split("  publish:", maxsplit=1)[1]
    assert "needs: [aggregate]" in publish
