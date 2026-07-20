"""Static Pytest, Vitest and Playwright governance-mechanism detection."""

from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any, Iterable

from Scripts.test_classifier_discovery import LogicalCase, discover_all

PYTEST_NEUTRAL_MARKERS = {
    "parametrize",
    "usefixtures",
    "filterwarnings",
    "asyncio",
}
JS_CONTROL_MODIFIERS = {
    "skip": "skipped",
    "skipIf": "skipped",
    "runIf": "skipped",
    "todo": "disabled",
    "fixme": "disabled",
    "only": "disabled",
    "fail": "expected_failure",
    "fails": "expected_failure",
    "quarantine": "quarantine",
    "retry": "retry",
}
JS_NEUTRAL_MODIFIERS = {"each", "concurrent", "sequential"}


def _name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = _name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    if isinstance(node, ast.Call):
        return _name(node.func)
    return ""


def _detection(
    framework: str,
    source_path: str,
    state: str,
    marker: str,
    line: int,
    logical_case_id: str | None,
) -> dict[str, Any]:
    return {
        "framework": framework,
        "sourcePath": source_path,
        "logicalCaseId": logical_case_id,
        "state": state,
        "marker": marker,
        "line": line,
    }


def _pytest_decorator_controls(
    decorators: Iterable[ast.expr], source_path: str, logical_case_id: str | None
) -> list[dict[str, Any]]:
    controls: list[dict[str, Any]] = []
    state_by_marker = {
        "skip": "skipped",
        "skipif": "skipped",
        "xfail": "expected_failure",
        "quarantine": "quarantine",
        "flaky": "retry",
        "repeat": "retry",
    }
    for decorator in decorators:
        name = _name(decorator)
        state = None
        if name.startswith("pytest.mark."):
            marker = name.removeprefix("pytest.mark.")
            state = state_by_marker.get(marker)
            if state is None and marker not in PYTEST_NEUTRAL_MARKERS:
                state = "unknown"
        elif name in {"unittest.skip", "unittest.skipIf", "unittest.skipUnless"}:
            state = "skipped"
        elif name == "unittest.expectedFailure":
            state = "expected_failure"
        if state:
            controls.append(
                _detection(
                    "pytest", source_path, state, name, decorator.lineno, logical_case_id
                )
            )
    return controls


def _test_function_controls(
    statement: ast.FunctionDef | ast.AsyncFunctionDef,
    source_path: str,
    selector: str,
    inherited: tuple[ast.expr, ...],
    owned_calls: set[int],
) -> list[dict[str, Any]]:
    logical_id = f"pytest:{source_path}::{selector}"
    controls = _pytest_decorator_controls(
        (*inherited, *statement.decorator_list), source_path, logical_id
    )
    call_states = {
        "pytest.skip": "skipped",
        "pytest.importorskip": "skipped",
        "pytest.xfail": "expected_failure",
    }
    for node in ast.walk(statement):
        if not isinstance(node, ast.Call):
            continue
        owned_calls.add(id(node))
        name = _name(node.func)
        if name in call_states:
            controls.append(
                _detection(
                    "pytest", source_path, call_states[name], name, node.lineno, logical_id
                )
            )
    return controls


def _pytest_body_controls(
    body: list[ast.stmt],
    source_path: str,
    owned_calls: set[int],
    class_names: tuple[str, ...] = (),
    inherited: tuple[ast.expr, ...] = (),
) -> list[dict[str, Any]]:
    controls: list[dict[str, Any]] = []
    for statement in body:
        if isinstance(statement, ast.ClassDef) and statement.name.startswith("Test"):
            controls.extend(
                _pytest_body_controls(
                    statement.body,
                    source_path,
                    owned_calls,
                    (*class_names, statement.name),
                    (*inherited, *statement.decorator_list),
                )
            )
        elif isinstance(statement, (ast.FunctionDef, ast.AsyncFunctionDef)) and (
            statement.name.startswith("test")
        ):
            selector = "::".join((*class_names, statement.name))
            controls.extend(
                _test_function_controls(
                    statement, source_path, selector, inherited, owned_calls
                )
            )
    return controls


def _module_controls(tree: ast.Module, source_path: str) -> list[dict[str, Any]]:
    controls: list[dict[str, Any]] = []
    for statement in tree.body:
        if not isinstance(statement, (ast.Assign, ast.AnnAssign)):
            continue
        targets = statement.targets if isinstance(statement, ast.Assign) else [statement.target]
        has_pytestmark = any(
            isinstance(target, ast.Name) and target.id == "pytestmark" for target in targets
        )
        if not has_pytestmark:
            continue
        value = statement.value
        markers = value.elts if isinstance(value, (ast.List, ast.Tuple)) else [value]
        controls.extend(_pytest_decorator_controls(markers, source_path, None))
    return controls


def _pytest_controls(root: Path, cases: Iterable[LogicalCase]) -> list[dict[str, Any]]:
    source_paths = sorted({case.source_path for case in cases if case.framework == "pytest"})
    controls: list[dict[str, Any]] = []
    for source_path in source_paths:
        path = root / source_path
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        owned_calls: set[int] = set()
        controls.extend(_pytest_body_controls(tree.body, source_path, owned_calls))
        controls.extend(_module_controls(tree, source_path))
        call_states = {
            "pytest.skip": "skipped",
            "pytest.importorskip": "skipped",
            "pytest.xfail": "expected_failure",
        }
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or id(node) in owned_calls:
                continue
            name = _name(node.func)
            if name in call_states:
                controls.append(
                    _detection(
                        "pytest",
                        source_path,
                        call_states[name],
                        name,
                        node.lineno,
                        None,
                    )
                )
    return controls


def _case_line(case: LogicalCase) -> int:
    match = re.search(r" \[(\d+):(\d+)\]$", case.selector)
    return int(match.group(1)) if match else 0


def _javascript_modifier_controls(case: LogicalCase, line: int) -> list[dict[str, Any]]:
    controls: list[dict[str, Any]] = []
    for modifier in case.evidence.get("modifiers", []):
        state = JS_CONTROL_MODIFIERS.get(modifier)
        if state is None and modifier not in JS_NEUTRAL_MODIFIERS:
            state = "unknown"
        if state:
            controls.append(
                _detection(
                    case.framework,
                    case.source_path,
                    state,
                    modifier,
                    line,
                    case.logical_case_id,
                )
            )
    return controls


def _javascript_call_controls(case: LogicalCase, line: int) -> list[dict[str, Any]]:
    call_states = {
        "test.skip": "skipped",
        "it.skip": "skipped",
        "test.fixme": "disabled",
        "test.fail": "expected_failure",
        "test.retry": "retry",
    }
    controls: list[dict[str, Any]] = []
    for call in case.evidence.get("calls", []):
        normalized = call.split("(", 1)[0]
        if normalized in call_states:
            controls.append(
                _detection(
                    case.framework,
                    case.source_path,
                    call_states[normalized],
                    normalized,
                    line,
                    case.logical_case_id,
                )
            )
    return controls


def _javascript_controls(cases: Iterable[LogicalCase]) -> list[dict[str, Any]]:
    controls: list[dict[str, Any]] = []
    for case in cases:
        if case.framework not in {"vitest", "playwright"}:
            continue
        line = _case_line(case)
        controls.extend(_javascript_modifier_controls(case, line))
        controls.extend(_javascript_call_controls(case, line))
        if re.search(r"(?:^|\s)@quarantine(?:\s|$)", case.selector, re.IGNORECASE):
            controls.append(
                _detection(
                    case.framework,
                    case.source_path,
                    "quarantine",
                    "@quarantine",
                    line,
                    case.logical_case_id,
                )
            )
    return controls


def _javascript_group_retry_controls(
    root: Path, cases: Iterable[LogicalCase]
) -> list[dict[str, Any]]:
    pattern = re.compile(
        r"\btest\.describe\.configure\s*\(\s*\{.{0,500}?\bretries\s*:\s*[1-9][0-9]*",
        re.DOTALL,
    )
    source_paths = sorted(
        {
            case.source_path
            for case in cases
            if case.framework == "playwright" and (root / case.source_path).is_file()
        }
    )
    controls: list[dict[str, Any]] = []
    for source_path in source_paths:
        path = root / source_path
        text = path.read_text(encoding="utf-8")
        for match in pattern.finditer(text):
            controls.append(
                _detection(
                    "playwright",
                    source_path,
                    "retry",
                    "test.describe.configure retries",
                    _line_number(text, match.start()),
                    None,
                )
            )
    return controls


def _line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _matches(
    path: Path, root: Path, pattern: re.Pattern[str], framework: str
) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    relative = path.relative_to(root).as_posix()
    return [
        _detection(
            framework,
            relative,
            "retry",
            match.group(0),
            _line_number(text, match.start()),
            None,
        )
        for match in pattern.finditer(text)
    ]


def _global_retry_controls(root: Path) -> list[dict[str, Any]]:
    exact = (
        ("requirements.txt", r"\bpytest-rerunfailures\b", "pytest"),
        ("pytest.ini", r"--reruns(?:=|\s+)[1-9][0-9]*", "pytest"),
        ("pyproject.toml", r"--reruns(?:=|\s+)[1-9][0-9]*", "pytest"),
        ("frontend/package.json", r"--retries(?:=|\s+)[1-9][0-9]*", "playwright"),
    )
    globs = (
        ("frontend/vitest.config.*", r"\bretry\s*:\s*[1-9][0-9]*", "vitest"),
        ("frontend/playwright.config.*", r"\bretries\s*:\s*[1-9][0-9]*", "playwright"),
    )
    controls: list[dict[str, Any]] = []
    for relative, expression, framework in exact:
        path = root / relative
        if path.is_file():
            controls.extend(_matches(path, root, re.compile(expression, re.IGNORECASE), framework))
    for glob, expression, framework in globs:
        for path in sorted(root.glob(glob)):
            controls.extend(_matches(path, root, re.compile(expression), framework))
    return controls


def discover_mechanisms(
    root: Path,
    *,
    cases: Iterable[LogicalCase] | None = None,
    node_command: str = "node",
) -> list[dict[str, Any]]:
    discovered = list(cases) if cases is not None else discover_all(root, node_command)
    controls = [
        *_pytest_controls(root, discovered),
        *_javascript_controls(discovered),
        *_javascript_group_retry_controls(root, discovered),
        *_global_retry_controls(root),
    ]
    return sorted(
        controls,
        key=lambda item: (
            item["framework"],
            item["sourcePath"],
            item["line"],
            item["marker"],
        ),
    )
