"""Trace technical DTOs exposed by an adapter public entrypoint."""

from __future__ import annotations

from Scripts.dependency_authority_contract import Diagnostic
from Scripts.dependency_authority_domain import LocatedDiagnostic
from Scripts.dependency_authority_dto_contract import DtoDeclaration, DtoExposure
from Scripts.dependency_authority_dto_javascript import (
    exposures as javascript_exposures,
)
from Scripts.dependency_authority_dto_javascript import reexported_symbols
from Scripts.dependency_authority_dto_python import exposures as python_exposures
from Scripts.dependency_authority_dto_python import imported_symbols
from Scripts.dependency_authority_imports import ImportDependency
from Scripts.dependency_authority_public_api import GovernedModule


def _owner_exposures(
    owner: GovernedModule,
    declarations: list[DtoDeclaration],
    texts: dict[str, str],
) -> dict[str, set[DtoExposure]]:
    owner_declarations = [
        declaration for declaration in declarations if declaration.source in owner.sources
    ]
    names = {declaration.name for declaration in owner_declarations}
    exposures: dict[str, set[DtoExposure]] = {}
    for source in owner.sources:
        text = texts.get(source, "")
        found = (
            python_exposures(source, text, owner_declarations, names)
            if source.endswith(".py")
            else javascript_exposures(source, text, owner_declarations, names)
        )
        exposures[source] = set(found)
    return exposures


def _selected_exposures(
    dependency: ImportDependency,
    text: str,
    exposures: set[DtoExposure],
) -> tuple[DtoExposure, ...]:
    selected = (
        imported_symbols(dependency.source, text, dependency.line)
        if dependency.source.endswith(".py")
        else reexported_symbols(text, dependency.line)
    )
    if selected is None:
        selected = {exposure.symbol: exposure.symbol for exposure in exposures}
    return tuple(
        DtoExposure(
            dependency.source,
            selected[exposure.symbol],
            exposure.dto_names,
            dependency.line,
        )
        for exposure in exposures
        if exposure.symbol in selected
    )


def _propagated_exposures(
    owner: GovernedModule,
    declarations: list[DtoDeclaration],
    texts: dict[str, str],
    dependencies: list[ImportDependency],
) -> dict[str, set[DtoExposure]]:
    exposures = _owner_exposures(owner, declarations, texts)
    owner_sources = set(owner.sources)
    changed = True
    while changed:
        changed = False
        for dependency in dependencies:
            if (
                dependency.source not in owner_sources
                or dependency.target not in owner_sources
            ):
                continue
            selected = _selected_exposures(
                dependency,
                texts.get(dependency.source, ""),
                exposures.get(dependency.target, set()),
            )
            source_exposures = exposures.setdefault(dependency.source, set())
            previous_size = len(source_exposures)
            source_exposures.update(selected)
            changed = changed or len(source_exposures) != previous_size
    return exposures


def public_diagnostics(
    owner: GovernedModule,
    declarations: list[DtoDeclaration],
    texts: dict[str, str],
    dependencies: list[ImportDependency],
) -> list[LocatedDiagnostic]:
    exposures = _propagated_exposures(owner, declarations, texts, dependencies)
    diagnostics: list[LocatedDiagnostic] = []
    for entrypoint in owner.public_entrypoints:
        unique = {
            (exposure.symbol, exposure.dto_names, exposure.line): exposure
            for exposure in exposures.get(entrypoint, set())
        }
        for exposure in sorted(
            unique.values(), key=lambda item: (item.line, item.symbol, item.dto_names)
        ):
            diagnostics.append(
                LocatedDiagnostic(
                    entrypoint,
                    Diagnostic(
                        "DEP-DTO-PUBLIC",
                        f"line {exposure.line}",
                        f"L'API publique de {owner.boundary!r} expose "
                        f"{exposure.symbol!r} avec les DTO techniques "
                        f"{', '.join(repr(name) for name in exposure.dto_names)}.",
                        "Retirer ce DTO du contrat public et exposer seulement la "
                        "commande, le résultat ou la valeur intérieure obtenue après mappage.",
                    ),
                )
            )
    return diagnostics
