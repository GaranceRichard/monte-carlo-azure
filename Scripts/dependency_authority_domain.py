"""Enforce technology independence for domain source files."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

from Scripts.dependency_authority import DependencyAuthority
from Scripts.dependency_authority_contract import Diagnostic
from Scripts.dependency_authority_imports import (
    SOURCE_SUFFIXES,
    TEST_PATH,
    DomainInspectionError,
    ImportDependency,
    normalize_path,
    python_dependencies,
    python_modules,
    repository_paths,
)
from Scripts.dependency_authority_javascript import javascript_dependencies

TECHNICAL_RESOURCE_SUFFIXES = {
    ".css",
    ".csv",
    ".html",
    ".json",
    ".pdf",
    ".svg",
    ".xml",
    ".yaml",
    ".yml",
}


@dataclass(frozen=True)
class LocatedDiagnostic:
    source: str
    diagnostic: Diagnostic

    @property
    def code(self) -> str:
        return self.diagnostic.code

    @property
    def location(self) -> str:
        return self.diagnostic.location

    def render(self, repository_root: Path | None = None) -> str:
        source: Path | str = (
            self.source if repository_root is None else repository_root / self.source
        )
        return self.diagnostic.render(source)


@dataclass(frozen=True)
class DomainIndependenceResult:
    files: int
    dependencies: int
    diagnostics: tuple[LocatedDiagnostic, ...]

    @property
    def violations(self) -> int:
        return len(self.diagnostics)


def _boundary_prefixes(authority: DependencyAuthority, layer: str) -> tuple[str, ...]:
    prefixes: set[str] = set()
    for runtime in authority.document["runtimes"]:
        if runtime["kind"] != "layered-product":
            continue
        for boundary in runtime["boundaries"]:
            if boundary.get("layer") == layer:
                prefixes.add(boundary["pathPattern"].partition("{module}")[0])
    return tuple(sorted(prefixes))


def _product_roots(authority: DependencyAuthority) -> tuple[str, ...]:
    return tuple(
        sorted(
            runtime["root"]
            for runtime in authority.document["runtimes"]
            if runtime["kind"] == "layered-product"
        )
    )


def _domain_source(path: str, domain_prefixes: tuple[str, ...]) -> bool:
    return (
        any(path.startswith(prefix) for prefix in domain_prefixes)
        and Path(path).suffix in SOURCE_SUFFIXES
        and not TEST_PATH.search(path)
    )


def _parse_diagnostic(path: str, error: SyntaxError) -> LocatedDiagnostic:
    diagnostic = Diagnostic(
        "DEP-DOMAIN-PARSE",
        f"line {error.lineno or 1}",
        f"Le fichier de domaine ne peut pas être analysé: {error.msg}.",
        "Corriger la syntaxe Python pour que toutes les dépendances puissent être inspectées.",
    )
    return LocatedDiagnostic(path, diagnostic)


def _adapter_specifier(dependency: ImportDependency) -> bool:
    normalized = dependency.specifier.replace("\\", "/").replace(".", "/")
    return "/adapters/" in f"/{normalized.strip('/')}/"


def _adapter_diagnostic(dependency: ImportDependency) -> LocatedDiagnostic:
    diagnostic = Diagnostic(
        "DEP-DOMAIN-ADAPTER",
        f"line {dependency.line}",
        f"Le domaine dépend de l'adaptateur {dependency.target!r} "
        f"via {dependency.specifier!r}.",
        "Définir une abstraction pure vers l'intérieur et injecter l'adaptateur "
        "depuis la composition.",
    )
    return LocatedDiagnostic(dependency.source, diagnostic)


def _technology_diagnostic(
    dependency: ImportDependency, message: str, hint: str
) -> LocatedDiagnostic:
    diagnostic = Diagnostic(
        "DEP-DOMAIN-TECHNOLOGY",
        f"line {dependency.line}",
        message,
        hint,
    )
    return LocatedDiagnostic(dependency.source, diagnostic)


def _dependency_diagnostic(
    dependency: ImportDependency, adapter_prefixes: tuple[str, ...]
) -> LocatedDiagnostic | None:
    target_is_adapter = dependency.resolution == "internal" and any(
        dependency.target.startswith(prefix) for prefix in adapter_prefixes
    )
    if target_is_adapter or _adapter_specifier(dependency):
        return _adapter_diagnostic(dependency)
    if dependency.resolution == "external":
        package = dependency.target.removeprefix("external:python:")
        if dependency.target.startswith("external:python:") and package in sys.stdlib_module_names:
            return None
        return _technology_diagnostic(
            dependency,
            f"Le domaine dépend de la technologie externe {dependency.target!r} "
            f"via {dependency.specifier!r}.",
            "Déplacer cette dépendance dans un adaptateur et conserver au domaine "
            "seulement le langage, la bibliothèque standard et ses abstractions pures.",
        )
    technical_resource = (
        Path(dependency.specifier.split("?", 1)[0]).suffix in TECHNICAL_RESOURCE_SUFFIXES
        or (
            dependency.resolution == "internal"
            and Path(dependency.target).suffix in TECHNICAL_RESOURCE_SUFFIXES
        )
    )
    if technical_resource:
        return _technology_diagnostic(
            dependency,
            f"Le domaine dépend de la ressource technique {dependency.target!r} "
            f"via {dependency.specifier!r}.",
            "Traduire cette ressource dans un adaptateur avant de fournir des valeurs "
            "pures au domaine.",
        )
    return None


def validate_domain_independence(
    authority: DependencyAuthority,
    texts: dict[str, str],
    all_paths: set[str],
) -> DomainIndependenceResult:
    """Return localized technology or adapter dependencies from governed domain roots."""
    normalized_paths = {normalize_path(path) for path in all_paths}
    normalized_texts = {normalize_path(path): text for path, text in texts.items()}
    domain_prefixes = _boundary_prefixes(authority, "domain")
    adapter_prefixes = _boundary_prefixes(authority, "adapters")
    domain_paths = sorted(
        path for path in normalized_texts if _domain_source(path, domain_prefixes)
    )
    modules = python_modules(normalized_paths)
    dependencies: list[ImportDependency] = []
    diagnostics: list[LocatedDiagnostic] = []
    for path in domain_paths:
        text = normalized_texts[path]
        if path.endswith(".py"):
            extracted, parse_error = python_dependencies(path, text, modules)
            dependencies.extend(extracted)
            if parse_error:
                diagnostics.append(_parse_diagnostic(path, parse_error))
        else:
            dependencies.extend(javascript_dependencies(path, text, normalized_paths))
    diagnostics.extend(
        diagnostic
        for dependency in dependencies
        if (diagnostic := _dependency_diagnostic(dependency, adapter_prefixes)) is not None
    )
    ordered = tuple(
        sorted(diagnostics, key=lambda item: (item.source, item.location, item.code))
    )
    return DomainIndependenceResult(len(domain_paths), len(dependencies), ordered)


def inspect_repository_domain(
    authority: DependencyAuthority, repository_root: Path | None = None
) -> DomainIndependenceResult:
    root = (repository_root or authority.repository_root).resolve()
    paths = repository_paths(root, _product_roots(authority))
    texts: dict[str, str] = {}
    for path in paths:
        if Path(path).suffix not in SOURCE_SUFFIXES:
            continue
        source = root / path
        if not source.is_file():
            continue
        try:
            texts[path] = source.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError) as exc:
            raise DomainInspectionError(f"Impossible de lire {path}: {exc}") from exc
    return validate_domain_independence(authority, texts, set(paths))
