"""Shared repository and Python import extraction for dependency rules."""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

SOURCE_SUFFIXES = {".py", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"}
TEST_PATH = re.compile(r"(?:^|/)(?:__tests__|test|tests)(?:/|$)|\.(?:test|spec)\.[^.]+$")


@dataclass(frozen=True)
class ImportDependency:
    source: str
    target: str
    line: int
    kind: str
    phase: str
    specifier: str
    resolution: str


class DomainInspectionError(RuntimeError):
    """Raised when repository sources cannot be inspected deterministically."""


def normalize_path(value: str | Path) -> str:
    raw = str(value).replace("\\", "/")
    return "/".join(part for part in PurePosixPath(raw).parts if part not in ("", ".", "/"))


def repository_paths(root: Path, source_roots: tuple[str, ...]) -> list[str]:
    """List files below the product roots declared by the authority."""
    paths: set[str] = set()
    try:
        for source_root in source_roots:
            product_root = root / source_root
            if not product_root.is_dir():
                continue
            for path in product_root.rglob("*"):
                if path.is_file():
                    paths.add(path.relative_to(root).as_posix())
    except OSError as exc:
        raise DomainInspectionError(f"Impossible d'énumérer les sources produit: {exc}") from exc
    return sorted(paths)


def python_modules(paths: set[str]) -> dict[str, str]:
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
    project_roots = {module.split(".", 1)[0] for module in modules}
    resolution = "unresolved-project" if package in project_roots else "external"
    return f"external:python:{package}", resolution


def _import_dependencies(
    path: str, node: ast.Import, modules: dict[str, str]
) -> list[ImportDependency]:
    dependencies: list[ImportDependency] = []
    for alias in node.names:
        target, resolution = _resolve_python(alias.name, alias.name, modules)
        dependencies.append(
            ImportDependency(
                path,
                target,
                node.lineno,
                "python-import",
                "runtime",
                alias.name,
                resolution,
            )
        )
    return dependencies


def _from_dependencies(
    path: str, node: ast.ImportFrom, modules: dict[str, str]
) -> list[ImportDependency]:
    base = _absolute_python_module(path, node)
    resolved: dict[tuple[str, str], str] = {}
    for alias in node.names:
        imported = f"{base}.{alias.name}" if base else alias.name
        target, resolution = _resolve_python(imported, base, modules)
        specifier = imported if target in modules.values() else base
        resolved[(target, resolution)] = specifier
    return [
        ImportDependency(
            path,
            target,
            node.lineno,
            "python-from",
            "runtime",
            specifier,
            resolution,
        )
        for (target, resolution), specifier in resolved.items()
    ]


def python_dependencies(
    path: str, text: str, modules: dict[str, str]
) -> tuple[list[ImportDependency], SyntaxError | None]:
    try:
        tree = ast.parse(text, filename=path)
    except SyntaxError as exc:
        return [], exc
    dependencies: list[ImportDependency] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            dependencies.extend(_import_dependencies(path, node, modules))
        elif isinstance(node, ast.ImportFrom):
            dependencies.extend(_from_dependencies(path, node, modules))
    return dependencies, None
