"""Parallel execution of quality-gate commands through the versioned DAG."""

from __future__ import annotations

import json
import shutil
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from pathlib import Path
from typing import Any

from Scripts.test_execution_profiles import (
    active_nodes,
    build_plan_report,
    load_json,
    node_for_command,
    topological_node_ids,
    write_report,
)


def _contract(root: Path) -> dict[str, Any]:
    return load_json(root / "config" / "test-execution-profiles.json")


def _commands_by_node(plan: Any, contract: dict[str, Any]) -> dict[str, tuple[Any, ...]]:
    grouped: dict[str, list[Any]] = {
        identifier: [] for identifier in active_nodes(contract, plan.execution_profile)
    }
    for command in plan.commands:
        grouped[node_for_command(contract, plan.execution_profile, command.step)].append(command)
    return {identifier: tuple(commands) for identifier, commands in grouped.items()}


def _artifact_root(validation_root: Path, profile: str, node: str) -> Path:
    return validation_root / "reports" / "test-execution-artifacts" / profile / node


def _node_environment(validation_root: Path, profile: str, node: str) -> dict[str, str]:
    artifact_root = _artifact_root(validation_root, profile, node)
    environment = {
        "TEST_EXECUTION_PROFILE": profile,
        "TEST_EXECUTION_NODE": node,
        "TEST_EXECUTION_NATIVE_DIR": str(artifact_root),
    }
    if node == "backend-tests":
        environment["COVERAGE_FILE"] = str(artifact_root / ".coverage")
    if node == "frontend-tests":
        environment["VITEST_COVERAGE_DIR"] = str(artifact_root / "coverage")
    if node == "e2e":
        environment["E2E_COVERAGE_ARTIFACT_PATH"] = str(artifact_root / "e2e-coverage-summary.json")
    return environment


def _write_result(
    validation_root: Path,
    profile: str,
    node: str,
    code: int,
    duration: float,
) -> None:
    destination = _artifact_root(validation_root, profile, node) / "result.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "profile": profile,
                "node": node,
                "exitCode": code,
                "durationSeconds": round(duration, 3),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _restore_current_results(
    validation_root: Path,
    profile: str,
    outcomes: dict[str, tuple[int, float]],
) -> None:
    """Restore this execution's node proofs before aggregate consumers run."""
    for node, (code, duration) in outcomes.items():
        _write_result(validation_root, profile, node, code, duration)


def _run_node(
    q: Any,
    plan: Any,
    node: str,
    commands: tuple[Any, ...],
    *,
    validation_root: Path,
    runtime_temp_root: Path,
    isolated_validation: bool,
    command_env: dict[str, str],
) -> tuple[int, float]:
    started = time.perf_counter()
    if node == "aggregate":
        _prepare_aggregate_inputs(validation_root, plan.execution_profile)
    environment = {
        **command_env,
        **_node_environment(validation_root, plan.execution_profile, node),
    }
    code = 0
    for command in commands:
        code = q._run_command(
            command,
            validation_root=validation_root,
            runtime_temp_root=runtime_temp_root,
            isolated_validation=isolated_validation,
            extra_env=environment,
        )
        if code:
            break
    if not code and plan.docker_smoke and node == "release-or-container-checks":
        code = q._run_docker_smoke()
    duration = time.perf_counter() - started
    _write_result(validation_root, plan.execution_profile, node, code, duration)
    return code, duration


def _ready_nodes(
    pending: set[str], completed: set[str], nodes: dict[str, dict[str, Any]]
) -> list[str]:
    return sorted(
        (
            identifier
            for identifier in pending
            if set(nodes[identifier].get("needs", [])) <= completed
        ),
        key=lambda item: (nodes[item].get("order", 0), item),
    )


def _execute_parallel(
    q: Any,
    plan: Any,
    grouped: dict[str, tuple[Any, ...]],
    contract: dict[str, Any],
    **kwargs: Any,
) -> tuple[int, dict[str, float]]:
    nodes = active_nodes(contract, plan.execution_profile)
    pending = set(nodes) - {identifier for identifier, commands in grouped.items() if not commands}
    completed = set(nodes) - pending
    durations: dict[str, float] = {}
    outcomes_by_node: dict[str, tuple[int, float]] = {}
    while pending:
        ready = _ready_nodes(pending, completed, nodes)
        if not ready:
            return 2, durations
        if "aggregate" in ready:
            _restore_current_results(
                kwargs["validation_root"],
                plan.execution_profile,
                outcomes_by_node,
            )
        with ThreadPoolExecutor(max_workers=len(ready)) as executor:
            futures = {
                node: executor.submit(_run_node, q, plan, node, grouped[node], **kwargs)
                for node in ready
            }
            outcomes = {node: futures[node].result() for node in ready}
        for node in ready:
            code, duration = outcomes[node]
            durations[node] = duration
            outcomes_by_node[node] = (code, duration)
            if code:
                return code, durations
            pending.remove(node)
            completed.add(node)
    return 0, durations


def _execute_sequential(
    q: Any,
    plan: Any,
    grouped: dict[str, tuple[Any, ...]],
    contract: dict[str, Any],
    **kwargs: Any,
) -> tuple[int, dict[str, float]]:
    durations: dict[str, float] = {}
    outcomes: dict[str, tuple[int, float]] = {}
    for node in topological_node_ids(contract, plan.execution_profile):
        commands = grouped[node]
        if not commands:
            continue
        if node == "aggregate":
            _restore_current_results(
                kwargs["validation_root"],
                plan.execution_profile,
                outcomes,
            )
        code, duration = _run_node(q, plan, node, commands, **kwargs)
        durations[node] = duration
        outcomes[node] = (code, duration)
        if code:
            return code, durations
    return 0, durations


def _promote_artifacts(validation_root: Path, profile: str) -> None:
    base = validation_root / "reports" / "test-execution-artifacts" / profile
    copies = {
        base / "backend-tests" / "coverage.json": validation_root / ".coverage.python.json",
        base / "backend-tests" / "pytest.json": (
            validation_root / "reports" / "test-execution-native" / "pytest.json"
        ),
        base / "frontend-tests" / "coverage" / "coverage-final.json": (
            validation_root / "frontend" / "coverage" / "coverage-final.json"
        ),
        base / "frontend-tests" / "vitest.json": (
            validation_root / "reports" / "test-execution-native" / "vitest.json"
        ),
        base / "e2e" / "e2e-coverage-summary.json": (
            validation_root / "frontend" / "coverage" / "e2e-coverage-summary.json"
        ),
        base / "e2e" / "playwright.json": (
            validation_root / "reports" / "test-execution-native" / "playwright.json"
        ),
    }
    for source, destination in copies.items():
        if source.is_file():
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)


def _prepare_aggregate_inputs(validation_root: Path, profile: str) -> None:
    _promote_artifacts(validation_root, profile)
    contract = _contract(validation_root)
    inventory = load_json(validation_root / "reports/test-classification-inventory.json")
    write_report(
        build_plan_report(contract, inventory),
        validation_root / "reports/test-execution-plan.json",
    )


def _aggregate(validation_root: Path, plan: Any, durations: dict[str, float]) -> None:
    contract = _contract(validation_root)
    sequential = sum(durations.values())
    nodes = active_nodes(contract, plan.execution_profile)
    longest: dict[str, float] = {}
    for identifier in topological_node_ids(contract, plan.execution_profile):
        dependencies = [longest.get(item, 0.0) for item in nodes[identifier]["needs"]]
        longest[identifier] = durations.get(identifier, 0.0) + max(dependencies, default=0.0)
    wall = max(longest.values(), default=sequential)
    _write_result(validation_root, plan.execution_profile, "aggregate", 0, wall)
    print(
        "DAG timing: "
        f"sequential={sequential:.3f}s parallel-critical-path={wall:.3f}s "
        f"gain={max(0.0, sequential - wall):.3f}s"
    )


def _execute_inside_manager(
    q: Any,
    plan: Any,
    grouped: dict[str, tuple[Any, ...]],
    contract: dict[str, Any],
    selected_node: str | None,
    parallel: bool,
    kwargs: dict[str, Any],
) -> tuple[int, dict[str, float]]:
    if selected_node == "aggregate":
        code, duration = _run_node(
            q,
            plan,
            selected_node,
            grouped[selected_node],
            **kwargs,
        )
        if not code:
            _aggregate(kwargs["validation_root"], plan, {selected_node: duration})
        return code, {selected_node: duration}
    if selected_node is not None:
        code, duration = _run_node(q, plan, selected_node, grouped[selected_node], **kwargs)
        return code, {selected_node: duration}
    if parallel:
        return _execute_parallel(q, plan, grouped, contract, **kwargs)
    return _execute_sequential(q, plan, grouped, contract, **kwargs)


def execute_gate_plan(
    q: Any,
    plan: Any,
    *,
    validation_root: Path,
    runtime_temp_root: Path,
    isolated_validation: bool,
    command_env: dict[str, str] | None = None,
    selected_node: str | None = None,
    parallel: bool = False,
) -> int:
    """Execute one node or the complete graph while preserving command failure codes."""
    contract = _contract(validation_root)
    grouped = _commands_by_node(plan, contract)
    nodes = active_nodes(contract, plan.execution_profile)
    if selected_node is not None and selected_node not in nodes:
        print(f"ERROR: unknown execution node: {selected_node}")
        return 2
    selected_commands = grouped.get(selected_node, ()) if selected_node else plan.commands
    has_frontend = any(command.argv[0] == q.NPM_COMMAND for command in selected_commands)
    if has_frontend:
        code = q._ensure_frontend_dependencies()
        if code:
            return code
    dependency_manager = (
        q.exposed_frontend_dependencies(validation_root)
        if has_frontend and isolated_validation
        else nullcontext()
    )
    kwargs = {
        "validation_root": validation_root,
        "runtime_temp_root": runtime_temp_root,
        "isolated_validation": isolated_validation,
        "command_env": dict(command_env or {}),
    }
    try:
        with dependency_manager:
            code, durations = _execute_inside_manager(
                q, plan, grouped, contract, selected_node, parallel, kwargs
            )
            if code:
                return code
    except OSError as exc:
        print(f"ERROR: unable to expose frontend dependencies: {exc}")
        return 1
    if selected_node is not None:
        return 0
    _aggregate(validation_root, plan, durations)
    return 0
