"""Reject dependency cycles between modules governed by the architecture authority."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

from Scripts.dependency_authority import DependencyAuthority
from Scripts.dependency_authority_contract import Diagnostic
from Scripts.dependency_authority_domain import LocatedDiagnostic
from Scripts.dependency_authority_imports import (
    ImportDependency,
    normalize_path,
    python_dependencies,
    python_modules,
    repository_source_texts,
)
from Scripts.dependency_authority_javascript import javascript_dependencies
from Scripts.dependency_authority_public_api import (
    GovernedModule,
    governed_modules,
    module_for,
    production_source,
    source_roots,
)


@dataclass(frozen=True)
class ModuleDependency:
    source: str
    target: str
    dependency: ImportDependency


@dataclass(frozen=True)
class DependencyCycle:
    path: tuple[str, ...]
    edges: tuple[ModuleDependency, ...]


@dataclass(frozen=True)
class ModuleAcyclicityResult:
    files: int
    dependencies: int
    modules: int
    module_edges: tuple[ModuleDependency, ...]
    cycles: tuple[DependencyCycle, ...]
    diagnostics: tuple[LocatedDiagnostic, ...]

    @property
    def violations(self) -> int:
        return len(self.diagnostics)


class ModuleCycleInspectionError(RuntimeError):
    """Raised when the governed module graph cannot be inspected completely."""


def _parse_diagnostic(path: str, error: SyntaxError) -> LocatedDiagnostic:
    return LocatedDiagnostic(
        path,
        Diagnostic(
            "DEP-MODULE-CYCLE-PARSE",
            f"line {error.lineno or 1}",
            f"Les dépendances du module ne peuvent pas être analysées: {error.msg}.",
            "Corriger la syntaxe Python afin de vérifier l'acyclicité du graphe complet.",
        ),
    )


def _dependencies(
    texts: dict[str, str], paths: set[str]
) -> tuple[list[ImportDependency], list[LocatedDiagnostic]]:
    dependencies: list[ImportDependency] = []
    diagnostics: list[LocatedDiagnostic] = []
    python_index = python_modules(paths)
    for path in sorted(texts):
        if path.endswith(".py"):
            extracted, error = python_dependencies(path, texts[path], python_index)
            dependencies.extend(extracted)
            if error:
                diagnostics.append(_parse_diagnostic(path, error))
        else:
            dependencies.extend(javascript_dependencies(path, texts[path], paths))
    return dependencies, diagnostics


def _dependency_key(dependency: ImportDependency) -> tuple[object, ...]:
    return (
        dependency.source,
        dependency.line,
        dependency.phase != "runtime",
        dependency.specifier,
        dependency.target,
    )


def _module_dependencies(
    dependencies: list[ImportDependency], modules: tuple[GovernedModule, ...]
) -> tuple[ModuleDependency, ...]:
    representatives: dict[tuple[str, str], ImportDependency] = {}
    for dependency in dependencies:
        if dependency.resolution != "internal":
            continue
        source = module_for(dependency.source, modules)
        target = module_for(dependency.target, modules)
        if source is None or target is None or source == target:
            continue
        pair = (source.boundary, target.boundary)
        current = representatives.get(pair)
        if current is None or _dependency_key(dependency) < _dependency_key(current):
            representatives[pair] = dependency
    return tuple(
        ModuleDependency(source, target, representatives[(source, target)])
        for source, target in sorted(representatives)
    )


def _shortest_path(
    adjacency: dict[str, tuple[str, ...]], start: str, goal: str
) -> tuple[str, ...] | None:
    pending = deque([(start, (start,))])
    visited = {start}
    while pending:
        node, path = pending.popleft()
        for target in adjacency.get(node, ()):
            if target == goal:
                return (*path, target)
            if target in visited:
                continue
            visited.add(target)
            pending.append((target, (*path, target)))
    return None


def _canonical_cycle(path: tuple[str, ...]) -> tuple[str, ...]:
    nodes = path[:-1]
    canonical = min(nodes[index:] + nodes[:index] for index in range(len(nodes)))
    return (*canonical, canonical[0])


def _cycles(edges: tuple[ModuleDependency, ...]) -> tuple[DependencyCycle, ...]:
    edge_by_pair = {(edge.source, edge.target): edge for edge in edges}
    adjacency = {
        source: tuple(sorted(edge.target for edge in edges if edge.source == source))
        for source in sorted({edge.source for edge in edges})
    }
    paths: set[tuple[str, ...]] = set()
    for source, target in sorted(edge_by_pair):
        return_path = _shortest_path(adjacency, target, source)
        if return_path is not None:
            paths.add(_canonical_cycle((source, *return_path)))
    return tuple(
        DependencyCycle(
            path,
            tuple(edge_by_pair[pair] for pair in zip(path, path[1:])),
        )
        for path in sorted(paths)
    )


def _cycle_diagnostic(cycle: DependencyCycle) -> LocatedDiagnostic:
    first = cycle.edges[0].dependency
    path = " -> ".join(cycle.path)
    details = "; ".join(
        f"{edge.dependency.source}:line {edge.dependency.line} "
        f"-- {edge.dependency.specifier!r} [{edge.dependency.phase}] --> {edge.target}"
        for edge in cycle.edges
    )
    return LocatedDiagnostic(
        first.source,
        Diagnostic(
            "DEP-MODULE-CYCLE",
            f"line {first.line}",
            f"Le graphe des modules gouvernés contient le cycle {path}. "
            f"Dépendances: {details}.",
            "Rompre une dépendance du chemin en déplaçant le contrat vers son propriétaire "
            "intérieur; un import de type participe aussi au cycle.",
        ),
    )


def validate_module_acyclicity(
    authority: DependencyAuthority,
    texts: dict[str, str],
    all_paths: set[str],
) -> ModuleAcyclicityResult:
    """Build the governed module graph and return every deterministic cycle proof."""
    paths = {normalize_path(path) for path in all_paths}
    normalized_texts = {normalize_path(path): text for path, text in texts.items()}
    source_texts = {
        path: text for path, text in normalized_texts.items() if production_source(path)
    }
    modules = governed_modules(authority, paths)
    dependencies, parse_diagnostics = _dependencies(source_texts, paths)
    edges = _module_dependencies(dependencies, modules)
    cycles = _cycles(edges)
    diagnostics = (*parse_diagnostics, *(_cycle_diagnostic(cycle) for cycle in cycles))
    return ModuleAcyclicityResult(
        files=len(source_texts),
        dependencies=len(dependencies),
        modules=len(modules),
        module_edges=edges,
        cycles=cycles,
        diagnostics=diagnostics,
    )


def inspect_repository_module_cycles(
    authority: DependencyAuthority, repository_root: Path | None = None
) -> ModuleAcyclicityResult:
    root = (repository_root or authority.repository_root).resolve()
    texts, paths = repository_source_texts(
        root, source_roots(authority), ModuleCycleInspectionError
    )
    return validate_module_acyclicity(authority, texts, set(paths))
