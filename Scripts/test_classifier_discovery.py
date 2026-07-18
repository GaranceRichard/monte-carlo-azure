"""AST-based discovery of logical Pytest, Vitest and Playwright cases."""

from __future__ import annotations

import ast
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class LogicalCase:
    framework: str
    source_path: str
    selector: str
    evidence: dict[str, Any]

    @property
    def logical_case_id(self) -> str:
        return f"{self.framework}:{self.source_path}::{self.selector}"


def _name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = _name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    if isinstance(node, ast.Call):
        return _name(node.func)
    return ""


def _pytest_file(path: Path) -> bool:
    return path.name.startswith("test_") or path.name.endswith("_test.py")


def _is_fixture(function: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    return any(_name(decorator).endswith("fixture") for decorator in function.decorator_list)


def _module_imports(tree: ast.Module) -> list[str]:
    imports: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module)
    return sorted(imports)


def _python_evidence(
    function: ast.FunctionDef | ast.AsyncFunctionDef, imports: list[str], conditional: bool
) -> dict[str, Any]:
    calls = sorted({_name(node.func) for node in ast.walk(function) if isinstance(node, ast.Call)})
    resources = sorted(
        {
            node.value[:160]
            for node in ast.walk(function)
            if isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and any(token in node.value for token in ("/", "\\", ".json", ".yaml", ".yml"))
        }
    )
    fixtures = [argument.arg for argument in function.args.args]
    fixtures.extend(argument.arg for argument in function.args.kwonlyargs)
    decorators = sorted(filter(None, (_name(decorator) for decorator in function.decorator_list)))
    return {
        "imports": imports,
        "calls": calls,
        "fixtures": sorted(fixtures),
        "resources": resources,
        "modifiers": decorators,
        "conditional": conditional,
        "dynamicTitle": False,
    }


def _collect_python_body(
    body: list[ast.stmt],
    source_path: str,
    imports: list[str],
    class_names: tuple[str, ...] = (),
    conditional: bool = False,
) -> list[LogicalCase]:
    cases: list[LogicalCase] = []
    for statement in body:
        if isinstance(statement, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if statement.name.startswith("test") and not _is_fixture(statement):
                selector = "::".join((*class_names, statement.name))
                cases.append(
                    LogicalCase(
                        framework="pytest",
                        source_path=source_path,
                        selector=selector,
                        evidence=_python_evidence(statement, imports, conditional),
                    )
                )
        elif isinstance(statement, ast.ClassDef) and statement.name.startswith("Test"):
            cases.extend(
                _collect_python_body(
                    statement.body,
                    source_path,
                    imports,
                    (*class_names, statement.name),
                    conditional,
                )
            )
        elif isinstance(statement, ast.If):
            cases.extend(
                _collect_python_body(
                    statement.body + statement.orelse,
                    source_path,
                    imports,
                    class_names,
                    True,
                )
            )
    return cases


def discover_pytest(root: Path) -> list[LogicalCase]:
    tests_root = root / "tests"
    cases: list[LogicalCase] = []
    if not tests_root.exists():
        return cases
    for path in sorted(tests_root.rglob("*.py")):
        if not _pytest_file(path):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        source_path = path.relative_to(root).as_posix()
        cases.extend(_collect_python_body(tree.body, source_path, _module_imports(tree)))
    return cases


def _case_from_json(value: dict[str, Any]) -> LogicalCase:
    return LogicalCase(
        framework=value["framework"],
        source_path=value["sourcePath"],
        selector=value["selector"],
        evidence=value["evidence"],
    )


def discover_javascript(root: Path, node_command: str = "node") -> list[LogicalCase]:
    tool_root = Path(__file__).resolve().parents[1]
    collector = tool_root / "Scripts" / "collect_js_tests.mjs"
    typescript = tool_root / "frontend" / "node_modules" / "typescript" / "lib" / "typescript.js"
    result = subprocess.run(
        [node_command, str(collector), "--root", str(root), "--typescript", str(typescript)],
        cwd=root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "unknown collector error"
        raise RuntimeError(f"JavaScript test discovery failed: {detail}")
    payload = json.loads(result.stdout)
    if not isinstance(payload, list):
        raise RuntimeError("JavaScript test discovery returned a non-array payload")
    return [_case_from_json(value) for value in payload]


def discover_all(root: Path, node_command: str = "node") -> list[LogicalCase]:
    cases = discover_pytest(root) + discover_javascript(root, node_command)
    cases.sort(key=lambda case: (case.framework, case.source_path, case.selector))
    identifiers = [case.logical_case_id for case in cases]
    if len(identifiers) != len(set(identifiers)):
        duplicates = sorted(
            {identifier for identifier in identifiers if identifiers.count(identifier) > 1}
        )
        raise ValueError(f"Duplicate logical test cases discovered: {', '.join(duplicates)}")
    return cases
