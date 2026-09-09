"""Confine technical DTOs to their owning adapter boundary."""

from __future__ import annotations

from pathlib import Path

from Scripts.dependency_authority import DependencyAuthority
from Scripts.dependency_authority_contract import Diagnostic
from Scripts.dependency_authority_domain import LocatedDiagnostic
from Scripts.dependency_authority_dto_contract import (
    DtoConfinementInspectionError,
    DtoConfinementResult,
    DtoDeclaration,
)
from Scripts.dependency_authority_dto_javascript import (
    declarations as javascript_declarations,
)
from Scripts.dependency_authority_dto_public_api import public_diagnostics
from Scripts.dependency_authority_dto_python import declarations as python_declarations
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

TECHNICAL_OWNER_LAYERS = frozenset({"adapters", "presentation"})


def _matches_declared_boundary(
    module: GovernedModule, boundary: dict[str, object]
) -> bool:
    pattern = str(boundary["pathPattern"])
    prefix, _, suffix = pattern.partition("{module}")
    if not module.boundary.startswith(prefix) or not module.boundary.endswith(suffix):
        return False
    end = len(module.boundary) - len(suffix) if suffix else len(module.boundary)
    name = module.boundary[len(prefix) : end]
    declared = boundary["modules"]
    return isinstance(declared, list) and (declared == ["*"] or name in declared)


def _technical_modules(
    authority: DependencyAuthority, modules: tuple[GovernedModule, ...]
) -> tuple[GovernedModule, ...]:
    boundaries = [
        boundary
        for runtime in authority.document["runtimes"]
        if runtime["kind"] == "layered-product"
        for boundary in runtime["boundaries"]
        if boundary.get("layer") in TECHNICAL_OWNER_LAYERS
    ]
    return tuple(
        module
        for module in modules
        if any(_matches_declared_boundary(module, boundary) for boundary in boundaries)
    )


def _declarations(
    texts: dict[str, str], modules: tuple[GovernedModule, ...]
) -> tuple[list[DtoDeclaration], list[LocatedDiagnostic]]:
    declarations: list[DtoDeclaration] = []
    diagnostics: list[LocatedDiagnostic] = []
    for path in sorted(texts):
        if module_for(path, modules) is None:
            continue
        if path.endswith(".py"):
            found, diagnostic = python_declarations(path, texts[path])
            if diagnostic is not None:
                diagnostics.append(diagnostic)
        else:
            found = javascript_declarations(path, texts[path])
        declarations.extend(found)
    return declarations, diagnostics


def _dependencies(texts: dict[str, str], paths: set[str]) -> list[ImportDependency]:
    dependencies: list[ImportDependency] = []
    python_index = python_modules(paths)
    for path in sorted(texts):
        if path.endswith(".py"):
            found, _error = python_dependencies(path, texts[path], python_index)
        else:
            found = javascript_dependencies(path, texts[path], paths)
        dependencies.extend(found)
    return dependencies


def _owner_diagnostic(
    declaration: DtoDeclaration, module: GovernedModule
) -> LocatedDiagnostic:
    return LocatedDiagnostic(
        declaration.source,
        Diagnostic(
            "DEP-DTO-OWNER",
            f"line {declaration.line}",
            f"Le DTO technique {declaration.name!r} est défini dans la frontière "
            f"non technique {module.boundary!r}.",
            "Déplacer sa définition dans l'adaptateur ou la présentation propriétaire "
            "et convertir ses valeurs vers un contrat intérieur à la frontière.",
        ),
    )


def _leak_diagnostic(
    dependency: ImportDependency,
    owner: GovernedModule,
    names: tuple[str, ...],
) -> LocatedDiagnostic:
    return LocatedDiagnostic(
        dependency.source,
        Diagnostic(
            "DEP-DTO-LEAK",
            f"line {dependency.line}",
            f"La dépendance {dependency.specifier!r} fait sortir les DTO techniques "
            f"{', '.join(repr(name) for name in names)} de leur frontière "
            f"propriétaire {owner.boundary!r}.",
            f"Exposer un contrat intérieur depuis l'API publique {owner.boundary!r} "
            "et conserver le DTO ainsi que son mapper dans cette frontière.",
        ),
    )


def _index_declarations(
    declarations: list[DtoDeclaration],
    modules: tuple[GovernedModule, ...],
    technical_modules: tuple[GovernedModule, ...],
    diagnostics: list[LocatedDiagnostic],
) -> dict[str, list[DtoDeclaration]]:
    declarations_by_source: dict[str, list[DtoDeclaration]] = {}
    for declaration in declarations:
        declarations_by_source.setdefault(declaration.source, []).append(declaration)
        module = module_for(declaration.source, modules)
        if module is not None and module not in technical_modules:
            diagnostics.append(_owner_diagnostic(declaration, module))
    return declarations_by_source


def _boundary_leaks(
    dependencies: list[ImportDependency],
    declarations_by_source: dict[str, list[DtoDeclaration]],
    technical_modules: tuple[GovernedModule, ...],
) -> tuple[int, list[LocatedDiagnostic]]:
    references = 0
    diagnostics: list[LocatedDiagnostic] = []
    for dependency in dependencies:
        declarations = declarations_by_source.get(dependency.target, [])
        owner = module_for(dependency.target, technical_modules)
        if not declarations or owner is None:
            continue
        references += 1
        if module_for(dependency.source, technical_modules) != owner:
            names = tuple(sorted(item.name for item in declarations))
            diagnostics.append(_leak_diagnostic(dependency, owner, names))
    return references, diagnostics


def validate_dto_confinement(
    authority: DependencyAuthority,
    texts: dict[str, str],
    all_paths: set[str],
) -> DtoConfinementResult:
    """Return every DTO declaration or reference escaping its technical owner."""
    paths = {normalize_path(path) for path in all_paths}
    source_texts = {
        normalize_path(path): text
        for path, text in texts.items()
        if production_source(normalize_path(path))
    }
    modules = governed_modules(authority, paths)
    technical_modules = _technical_modules(authority, modules)
    declarations, diagnostics = _declarations(source_texts, modules)
    declarations_by_source = _index_declarations(
        declarations, modules, technical_modules, diagnostics
    )
    dependencies = _dependencies(source_texts, paths)
    boundary_references, leak_diagnostics = _boundary_leaks(
        dependencies, declarations_by_source, technical_modules
    )
    diagnostics.extend(leak_diagnostics)
    for owner in technical_modules:
        owner_declarations = [
            declaration
            for declaration in declarations
            if module_for(declaration.source, technical_modules) == owner
        ]
        diagnostics.extend(
            public_diagnostics(owner, owner_declarations, source_texts, dependencies)
        )
    ordered = tuple(
        sorted(diagnostics, key=lambda item: (item.source, item.location, item.code))
    )
    return DtoConfinementResult(
        files=len(source_texts),
        technical_boundaries=len(technical_modules),
        declarations=len(declarations),
        boundary_references=boundary_references,
        diagnostics=ordered,
    )


def inspect_repository_dto_confinement(
    authority: DependencyAuthority, repository_root: Path | None = None
) -> DtoConfinementResult:
    root = (repository_root or authority.repository_root).resolve()
    texts, paths = repository_source_texts(
        root, source_roots(authority), DtoConfinementInspectionError
    )
    return validate_dto_confinement(authority, texts, set(paths))
