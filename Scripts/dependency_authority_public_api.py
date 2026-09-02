"""Enforce public entrypoints for modules governed by the dependency authority."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from Scripts.dependency_authority import DependencyAuthority
from Scripts.dependency_authority_contract import Diagnostic
from Scripts.dependency_authority_domain import LocatedDiagnostic
from Scripts.dependency_authority_imports import (
    SOURCE_SUFFIXES,
    TEST_PATH,
    ImportDependency,
    normalize_path,
    python_dependencies,
    python_modules,
    repository_source_texts,
)
from Scripts.dependency_authority_javascript import javascript_dependencies


@dataclass(frozen=True)
class GovernedModule:
    boundary: str
    sources: tuple[str, ...]
    public_entrypoints: tuple[str, ...]


@dataclass(frozen=True)
class PublicApiResult:
    files: int
    dependencies: int
    modules: int
    public_entrypoints: int
    exceptions: int
    diagnostics: tuple[LocatedDiagnostic, ...]

    @property
    def violations(self) -> int:
        return len(self.diagnostics)


class PublicApiInspectionError(RuntimeError):
    """Raised when governed imports cannot be inspected deterministically."""


def source_roots(authority: DependencyAuthority) -> tuple[str, ...]:
    """Return every source root governed by the dependency authority."""
    return tuple(sorted(runtime["root"] for runtime in authority.document["runtimes"]))


def production_source(path: str) -> bool:
    """Return whether a source belongs to the product graph rather than its tests."""
    return Path(path).suffix in SOURCE_SUFFIXES and not TEST_PATH.search(path)


def _wildcard_modules(prefix: str, suffix: str, paths: set[str]) -> set[str]:
    modules: set[str] = set()
    for path in paths:
        if not path.startswith(prefix):
            continue
        relative = path[len(prefix) :]
        candidate = relative.split("/", 1)[0]
        if candidate and f"{prefix}{candidate}{suffix}" in f"{path}/":
            modules.add(candidate)
    return modules


def _module_boundaries(authority: DependencyAuthority, paths: set[str]) -> set[str]:
    roots: set[str] = set()
    for runtime in authority.document["runtimes"]:
        for boundary in runtime["boundaries"]:
            prefix, _, suffix = boundary["pathPattern"].partition("{module}")
            modules = boundary["modules"]
            expanded = (
                _wildcard_modules(prefix, suffix, paths) if modules == ["*"] else modules
            )
            roots.update(f"{prefix}{module}{suffix}" for module in expanded)
    return roots


def _entrypoint_names(authority: DependencyAuthority, sources: tuple[str, ...]) -> set[str]:
    policy = authority.document["moduleEncapsulation"]
    suffixes = {Path(path).suffix for path in sources}
    names: set[str] = set()
    if ".py" in suffixes:
        names.update(policy["pythonPublicEntrypoints"])
    if suffixes & (SOURCE_SUFFIXES - {".py"}):
        names.update(policy["javascriptPublicEntrypoints"])
    return names


def governed_modules(
    authority: DependencyAuthority, paths: set[str]
) -> tuple[GovernedModule, ...]:
    """Expand the declared boundaries that contain production sources."""
    modules: list[GovernedModule] = []
    for boundary in sorted(_module_boundaries(authority, paths)):
        sources = tuple(
            sorted(path for path in paths if path.startswith(boundary) and production_source(path))
        )
        if not sources:
            continue
        candidates = {f"{boundary}{name}" for name in _entrypoint_names(authority, sources)}
        public_entrypoints = tuple(sorted(candidates & paths))
        modules.append(GovernedModule(boundary, sources, public_entrypoints))
    return tuple(modules)


def _missing_api_diagnostic(module: GovernedModule) -> LocatedDiagnostic | None:
    if module.public_entrypoints:
        return None
    source = module.sources[0]
    diagnostic = Diagnostic(
        "DEP-PUBLIC-API-MISSING",
        "line 1",
        f"La frontière gouvernée {module.boundary!r} n'expose aucun point d'entrée public.",
        f"Exposer l'API attendue à la racine {module.boundary!r} via index.* ou __init__.py.",
    )
    return LocatedDiagnostic(source, diagnostic)


def _dependency_path(dependency: ImportDependency) -> str | None:
    if dependency.resolution == "internal":
        return dependency.target
    if dependency.target.startswith("unresolved:"):
        return dependency.target.removeprefix("unresolved:")
    if dependency.resolution == "unresolved-project":
        return normalize_path(dependency.specifier.replace(".", "/"))
    return None


def module_for(path: str, modules: tuple[GovernedModule, ...]) -> GovernedModule | None:
    """Locate a path in the most specific governed module boundary."""
    matches = [
        module
        for module in modules
        if path == module.boundary.rstrip("/") or path.startswith(module.boundary)
    ]
    return max(matches, key=lambda module: len(module.boundary), default=None)


def _authorized(
    authority: DependencyAuthority, dependency: ImportDependency, target: str
) -> bool:
    return any(
        normalize_path(exception["source"]) == dependency.source
        and normalize_path(exception["target"]) == target
        for exception in authority.document["moduleEncapsulation"]["deepImportExceptions"]
    )


def _deep_import_diagnostic(
    dependency: ImportDependency, module: GovernedModule
) -> LocatedDiagnostic:
    entrypoints = ", ".join(module.public_entrypoints) or f"{module.boundary}index.* / __init__.py"
    diagnostic = Diagnostic(
        "DEP-PUBLIC-API-DEEP-IMPORT",
        f"line {dependency.line}",
        f"L'import {dependency.specifier!r} contourne l'API publique de la frontière "
        f"{module.boundary!r} et atteint {dependency.target!r}.",
        f"Importer depuis la frontière attendue {module.boundary!r} ({entrypoints}) ou "
        "faire autoriser le couple source/cible exact dans "
        "/moduleEncapsulation/deepImportExceptions.",
    )
    return LocatedDiagnostic(dependency.source, diagnostic)


def _parse_diagnostic(path: str, error: SyntaxError) -> LocatedDiagnostic:
    diagnostic = Diagnostic(
        "DEP-PUBLIC-API-PARSE",
        f"line {error.lineno or 1}",
        f"Les imports du fichier ne peuvent pas être analysés: {error.msg}.",
        "Corriger la syntaxe Python afin de contrôler toutes les frontières publiques.",
    )
    return LocatedDiagnostic(path, diagnostic)


def _dependencies(
    texts: dict[str, str], paths: set[str]
) -> tuple[list[ImportDependency], list[LocatedDiagnostic]]:
    dependencies: list[ImportDependency] = []
    diagnostics: list[LocatedDiagnostic] = []
    modules = python_modules(paths)
    for path in sorted(texts):
        if path.endswith(".py"):
            extracted, error = python_dependencies(path, texts[path], modules)
            dependencies.extend(extracted)
            if error:
                diagnostics.append(_parse_diagnostic(path, error))
        else:
            dependencies.extend(javascript_dependencies(path, texts[path], paths))
    return dependencies, diagnostics


def validate_public_api_encapsulation(
    authority: DependencyAuthority,
    texts: dict[str, str],
    all_paths: set[str],
) -> PublicApiResult:
    """Return missing APIs and cross-boundary deep imports with exact locations."""
    paths = {normalize_path(path) for path in all_paths}
    normalized_texts = {normalize_path(path): text for path, text in texts.items()}
    source_texts = {
        path: text
        for path, text in normalized_texts.items()
        if Path(path).suffix in SOURCE_SUFFIXES
    }
    modules = governed_modules(authority, paths)
    dependencies, diagnostics = _dependencies(source_texts, paths)
    diagnostics.extend(
        diagnostic
        for module in modules
        if (diagnostic := _missing_api_diagnostic(module)) is not None
    )
    for dependency in dependencies:
        target = _dependency_path(dependency)
        target_module = module_for(target, modules) if target else None
        source_module = module_for(dependency.source, modules)
        if (
            target_module is None
            or source_module == target_module
            or target == target_module.boundary.rstrip("/")
            or target in target_module.public_entrypoints
            or _authorized(authority, dependency, target)
        ):
            continue
        diagnostics.append(_deep_import_diagnostic(dependency, target_module))
    ordered = tuple(
        sorted(diagnostics, key=lambda item: (item.source, item.location, item.code))
    )
    return PublicApiResult(
        files=len(source_texts),
        dependencies=len(dependencies),
        modules=len(modules),
        public_entrypoints=sum(len(module.public_entrypoints) for module in modules),
        exceptions=len(authority.document["moduleEncapsulation"]["deepImportExceptions"]),
        diagnostics=ordered,
    )


def inspect_repository_public_apis(
    authority: DependencyAuthority, repository_root: Path | None = None
) -> PublicApiResult:
    root = (repository_root or authority.repository_root).resolve()
    texts, paths = repository_source_texts(
        root, source_roots(authority), PublicApiInspectionError
    )
    return validate_public_api_encapsulation(authority, texts, set(paths))
