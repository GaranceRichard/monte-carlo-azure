from __future__ import annotations

import ast
import posixpath
import re
from typing import Any

from maintainability_common import normalize_path

JS_SUFFIXES = (".ts", ".tsx", ".js", ".jsx")


def _resolve_python_name(name: str, modules: dict[str, str]) -> str:
    candidate = name
    while candidate:
        if candidate in modules:
            return modules[candidate]
        candidate = candidate.rsplit(".", 1)[0] if "." in candidate else ""
    return name.replace(".", "/") + ".py"


def _python_imports(path: str, text: str, modules: dict[str, str]) -> set[str]:
    tree = ast.parse(text, filename=path)
    current = path.removesuffix(".py").replace("/", ".")
    if current.endswith(".__init__"):
        current = current.removesuffix(".__init__")
    package = current.rsplit(".", 1)[0] if "." in current else ""
    imports: set[str] = set()
    for node in ast.walk(tree):
        names: list[str] = []
        if isinstance(node, ast.Import):
            names = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ""
            if node.level:
                prefix = package.split(".")
                prefix = prefix[: max(0, len(prefix) - node.level + 1)]
                base = ".".join((*prefix, base) if base else prefix)
            names = [base, *(f"{base}.{alias.name}" for alias in node.names if base)]
        imports.update(_resolve_python_name(name, modules) for name in names if name)
    return imports


def _js_imports(path: str, text: str, source_paths: set[str]) -> set[str]:
    imports: set[str] = set()
    patterns = (
        re.compile(r"\b(?:import|export)\b(?:.|\n)*?\bfrom\s*['\"]([^'\"]+)['\"]"),
        re.compile(r"\bimport\s*\(\s*['\"]([^'\"]+)['\"]\s*\)"),
    )
    for pattern in patterns:
        for match in pattern.finditer(text):
            specifier = match.group(1)
            if not specifier.startswith("."):
                imports.add(normalize_path(specifier))
                continue
            base = normalize_path(
                posixpath.normpath(posixpath.join(posixpath.dirname(path), specifier))
            )
            candidates = [base, *(base + suffix for suffix in JS_SUFFIXES)]
            candidates.extend(f"{base}/index{suffix}" for suffix in JS_SUFFIXES)
            imports.add(next((item for item in candidates if item in source_paths), base))
    return imports


def _module_paths(source_paths: set[str]) -> dict[str, str]:
    modules: dict[str, str] = {}
    for path in source_paths:
        if not path.endswith(".py"):
            continue
        module = path.removesuffix(".py").replace("/", ".")
        modules[module.removesuffix(".__init__")] = path
        modules.setdefault(module.rsplit(".", 1)[-1], path)
    return modules


def collect_dependencies(texts: dict[str, str]) -> set[tuple[str, str]]:
    source_paths = set(texts)
    modules = _module_paths(source_paths)
    dependencies: set[tuple[str, str]] = set()
    for path, content in texts.items():
        targets = (
            _python_imports(path, content, modules)
            if path.endswith(".py")
            else _js_imports(path, content, source_paths)
        )
        dependencies.update((path, normalize_path(target)) for target in targets if target != path)
    return dependencies


def cyclic_components(
    source_paths: set[str], dependencies: set[tuple[str, str]]
) -> list[dict[str, Any]]:
    graph = {path: set() for path in source_paths}
    for source, target in dependencies:
        if target in graph:
            graph[source].add(target)
    return _strongly_connected_components(graph)


def _strongly_connected_components(graph: dict[str, set[str]]) -> list[dict[str, Any]]:
    index = 0
    indices: dict[str, int] = {}
    lowlinks: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    components: list[dict[str, Any]] = []

    def connect(node: str) -> None:
        nonlocal index
        indices[node] = lowlinks[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)
        for target in sorted(graph[node]):
            if target not in indices:
                connect(target)
                lowlinks[node] = min(lowlinks[node], lowlinks[target])
            elif target in on_stack:
                lowlinks[node] = min(lowlinks[node], indices[target])
        if lowlinks[node] != indices[node]:
            return
        members: list[str] = []
        while stack:
            member = stack.pop()
            on_stack.remove(member)
            members.append(member)
            if member == node:
                break
        edges = _component_edges(graph, members)
        if len(members) > 1 or any(source == target for source, target in edges):
            components.append({"nodes": sorted(members), "edges": edges})

    for node in sorted(graph):
        if node not in indices:
            connect(node)
    return sorted(components, key=lambda item: item["nodes"])


def _component_edges(graph: dict[str, set[str]], members: list[str]) -> list[list[str]]:
    member_set = set(members)
    return sorted(
        [source, target]
        for source in members
        for target in graph[source]
        if target in member_set
    )
