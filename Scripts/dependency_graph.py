"""Multi-language static import extraction for the repository graph."""

from __future__ import annotations

import ast
import posixpath
import re
from typing import Any

from dependency_graph_analysis import api_bypasses, deep_imports, elementary_cycles
from dependency_graph_common import (
    SOURCE_ROOTS,
    edge,
    line_number,
    normalize_path,
    repository_paths,
    source_texts,
)

__all__ = [
    "SOURCE_ROOTS",
    "api_bypasses",
    "collect_import_edges",
    "deep_imports",
    "elementary_cycles",
    "line_number",
    "normalize_path",
    "repository_paths",
    "source_texts",
]

JS_SUFFIXES = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".css")
JS_STATEMENT = re.compile(r"(?ms)^[ \t]*(?P<kind>import|export)\b(?P<body>.*?;)")
JS_DYNAMIC = re.compile(r"\bimport\s*\(\s*['\"](?P<name>[^'\"]+)['\"]\s*\)")
JS_RUNTIME_LOAD = re.compile(r"\bssrLoadModule\s*\(\s*['\"](?P<name>[^'\"]+)['\"]\s*\)")


def _python_modules(paths: set[str]) -> dict[str, str]:
    modules: dict[str, str] = {}
    for path in sorted(item for item in paths if item.endswith(".py")):
        module = path.removesuffix(".py").replace("/", ".")
        modules[module.removesuffix(".__init__")] = path
    return modules


def _absolute_python_module(path: str, node: ast.ImportFrom) -> str:
    if not node.level:
        return node.module or ""
    package = path.removesuffix(".py").replace("/", ".").rsplit(".", 1)[0]
    parts = package.split(".") if package else []
    prefix = parts[: max(0, len(parts) - node.level + 1)]
    return ".".join((*prefix, node.module) if node.module else prefix)


def _resolve_python(name: str, fallback: str, modules: dict[str, str]) -> tuple[str, str]:
    for candidate in (name, fallback):
        if candidate in modules:
            return modules[candidate], "internal"
    package = (fallback or name).split(".", 1)[0]
    return f"external:python:{package}", "external"


def _python_edges(path: str, text: str, modules: dict[str, str]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    for node in ast.walk(ast.parse(text, filename=path)):
        if isinstance(node, ast.Import):
            for alias in node.names:
                target, resolution = _resolve_python(alias.name, alias.name, modules)
                edges.append(
                    edge(
                        path,
                        target,
                        node.lineno,
                        "python-import",
                        "runtime",
                        alias.name,
                        resolution,
                    )
                )
        elif isinstance(node, ast.ImportFrom):
            base = _absolute_python_module(path, node)
            resolved: dict[tuple[str, str], str] = {}
            for alias in node.names:
                imported = f"{base}.{alias.name}" if base else alias.name
                target, resolution = _resolve_python(imported, base, modules)
                resolved[(target, resolution)] = imported if target in modules.values() else base
            for (target, resolution), specifier in resolved.items():
                edges.append(
                    edge(
                        path,
                        target,
                        node.lineno,
                        "python-from",
                        "runtime",
                        specifier,
                        resolution,
                    )
                )
    return edges


def _npm_target(specifier: str) -> str:
    parts = specifier.split("/")
    package = "/".join(parts[:2]) if specifier.startswith("@") else parts[0]
    return f"external:npm:{package}"


def _resolve_js(source: str, specifier: str, paths: set[str]) -> tuple[str, str]:
    if not specifier.startswith((".", "/")):
        return _npm_target(specifier), "external"
    if specifier.startswith("/") and source.startswith("frontend/"):
        base = normalize_path(posixpath.join("frontend", specifier.lstrip("/")))
    else:
        base = normalize_path(
            posixpath.normpath(posixpath.join(posixpath.dirname(source), specifier))
        )
    candidates = [base, *(base + suffix for suffix in JS_SUFFIXES)]
    candidates.extend(f"{base}/index{suffix}" for suffix in JS_SUFFIXES)
    target = next((candidate for candidate in candidates if candidate in paths), None)
    return (target, "internal") if target else (f"unresolved:{base}", "unresolved")


def _js_edges(path: str, text: str, paths: set[str]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    for match in JS_STATEMENT.finditer(text):
        body = match.group("body")
        from_match = re.search(r"\bfrom\s*['\"]([^'\"]+)['\"]", body)
        side_effect = re.match(r"\s*['\"]([^'\"]+)['\"]", body)
        specifier = (from_match or side_effect).group(1) if from_match or side_effect else None
        if specifier:
            target, resolution = _resolve_js(path, specifier, paths)
            phase = "compile" if body.lstrip().startswith("type ") else "runtime"
            edges.append(
                edge(
                    path,
                    target,
                    line_number(text, match.start()),
                    f"js-{match.group('kind')}",
                    phase,
                    specifier,
                    resolution,
                )
            )
    for pattern, kind in ((JS_DYNAMIC, "js-dynamic-import"), (JS_RUNTIME_LOAD, "js-runtime-load")):
        for match in pattern.finditer(text):
            target, resolution = _resolve_js(path, match.group("name"), paths)
            edges.append(
                edge(
                    path,
                    target,
                    line_number(text, match.start()),
                    kind,
                    "runtime",
                    match.group("name"),
                    resolution,
                )
            )
    return edges


def collect_import_edges(texts: dict[str, str], all_paths: set[str]) -> list[dict[str, Any]]:
    modules = _python_modules(set(texts))
    edges: list[dict[str, Any]] = []
    for path, text in sorted(texts.items()):
        edges.extend(
            _python_edges(path, text, modules)
            if path.endswith(".py")
            else _js_edges(path, text, all_paths)
        )
    unique = {tuple(item.values()): item for item in edges}
    return sorted(unique.values(), key=lambda item: tuple(item.values()))
