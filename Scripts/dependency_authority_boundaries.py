"""Runtime and boundary diagnostics for the dependency authority."""

from __future__ import annotations

from typing import Any

from Scripts.dependency_authority_contract import Diagnostic

EXPECTED_RUNTIMES = {
    "frontend": ("frontend/src/", "layered-product"),
    "backend": ("backend/", "layered-product"),
    "quality": ("Scripts/quality/", "external-proof-system"),
}
EXPECTED_QUALITY_ROLES = {
    "contracts",
    "application",
    "ports",
    "adapters",
    "evidence",
    "composition",
}


def _owner_diagnostics(
    runtime: dict[str, Any],
    boundary: dict[str, Any],
    location: str,
    layer_ids: set[str],
    runtime_layers: set[str],
    runtime_roles: set[str],
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    layer = boundary.get("layer")
    role = boundary.get("role")
    if runtime["kind"] == "layered-product" and (layer not in layer_ids or role is not None):
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-BOUNDARY-OWNER",
                location,
                "Une frontière produit doit référencer une couche et aucun rôle qualité.",
                "Déclarer layer avec un identifiant de /layers et retirer role.",
            )
        )
    elif runtime["kind"] != "layered-product" and (layer is not None or not role):
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-BOUNDARY-OWNER",
                location,
                "Une frontière qualité extérieure doit porter un rôle et aucune couche produit.",
                "Déclarer role et retirer layer.",
            )
        )
    if layer in runtime_layers:
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-BOUNDARY-LAYER",
                f"{location}/layer",
                f"La couche {layer!r} possède plusieurs déclarations dans ce runtime.",
                "Regrouper ses modules sous une seule déclaration de frontière.",
            )
        )
    if layer in layer_ids:
        runtime_layers.add(layer)
    if role:
        runtime_roles.add(role)
    return diagnostics


def _pattern_diagnostics(
    runtime: dict[str, Any],
    boundary: dict[str, Any],
    location: str,
    expanded_paths: dict[str, str],
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    pattern = boundary["pathPattern"]
    path_parts = pattern.replace("{module}", "module").split("/")
    normalized = not ({".", ".."} & set(path_parts)) and "//" not in pattern
    if (
        pattern.count("{module}") != 1
        or not pattern.startswith(runtime["root"])
        or not normalized
    ):
        return [
            Diagnostic(
                "DEP-AUTH-BOUNDARY-PATTERN",
                f"{location}/pathPattern",
                f"Le patron {pattern!r} n'est pas une frontière relative du runtime.",
                "Utiliser une fois {module} sous la racine du runtime déclaré.",
            )
        ]
    if "*" in boundary["modules"] and len(boundary["modules"]) != 1:
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-BOUNDARY-WILDCARD",
                f"{location}/modules",
                "Le joker de module ne peut pas être mélangé à des modules nommés.",
                'Déclarer soit ["*"], soit une liste fermée de modules.',
            )
        )
    for module in boundary["modules"]:
        expanded = pattern.replace("{module}", module)
        if expanded in expanded_paths:
            diagnostics.append(
                Diagnostic(
                    "DEP-AUTH-BOUNDARY-DUPLICATE",
                    f"{location}/modules",
                    f"La frontière développée {expanded!r} est déjà déclarée.",
                    f"Fusionner avec la déclaration {expanded_paths[expanded]} "
                    "ou retirer le doublon.",
                )
            )
        else:
            expanded_paths[expanded] = location
    return diagnostics


def _one_boundary_diagnostics(
    runtime: dict[str, Any],
    boundary: dict[str, Any],
    location: str,
    layer_ids: set[str],
    runtime_layers: set[str],
    runtime_roles: set[str],
    boundary_ids: dict[str, str],
    expanded_paths: dict[str, str],
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    identifier = boundary["id"]
    if identifier in boundary_ids:
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-BOUNDARY-ID",
                f"{location}/id",
                f"L'identifiant de frontière {identifier!r} est déjà déclaré.",
                f"Choisir un identifiant unique ; première déclaration {boundary_ids[identifier]}.",
            )
        )
    else:
        boundary_ids[identifier] = location
    diagnostics.extend(
        _owner_diagnostics(
            runtime, boundary, location, layer_ids, runtime_layers, runtime_roles
        )
    )
    diagnostics.extend(_pattern_diagnostics(runtime, boundary, location, expanded_paths))
    return diagnostics


def _runtime_identity_diagnostics(
    runtime: dict[str, Any], runtime_location: str, observed: set[str]
) -> list[Diagnostic]:
    runtime_id = runtime["id"]
    expected = EXPECTED_RUNTIMES.get(runtime_id)
    if runtime_id not in observed and expected == (runtime["root"], runtime["kind"]):
        observed.add(runtime_id)
        return []
    observed.add(runtime_id)
    return [
        Diagnostic(
            "DEP-AUTH-RUNTIME",
            runtime_location,
            f"Le runtime {runtime_id!r} est inconnu, dupliqué ou mal rattaché.",
            "Aligner id, root et kind sur les frontières acceptées par la décision 7.8.",
        )
    ]


def _runtime_coverage_diagnostics(
    runtime: dict[str, Any],
    runtime_location: str,
    layer_ids: set[str],
    runtime_layers: set[str],
    runtime_roles: set[str],
) -> list[Diagnostic]:
    if runtime["kind"] == "layered-product" and runtime_layers != layer_ids:
        return [
            Diagnostic(
                "DEP-AUTH-BOUNDARY-COVERAGE",
                f"{runtime_location}/boundaries",
                f"Le runtime {runtime['id']!r} ne classe pas exactement les six couches.",
                "Ajouter une déclaration de frontière pour chaque couche de la matrice.",
            )
        ]
    if runtime["kind"] == "external-proof-system" and runtime_roles != EXPECTED_QUALITY_ROLES:
        return [
            Diagnostic(
                "DEP-AUTH-BOUNDARY-COVERAGE",
                f"{runtime_location}/boundaries",
                "Le runtime qualité ne déclare pas exactement ses six rôles acceptés.",
                "Déclarer contracts, application, ports, adapters, evidence et composition.",
            )
        ]
    return []


def runtime_diagnostics(document: dict[str, Any]) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    observed: set[str] = set()
    boundary_ids: dict[str, str] = {}
    expanded_paths: dict[str, str] = {}
    layer_ids = {layer["id"] for layer in document["layers"]}
    for runtime_index, runtime in enumerate(document["runtimes"]):
        runtime_location = f"/runtimes/{runtime_index}"
        diagnostics.extend(_runtime_identity_diagnostics(runtime, runtime_location, observed))
        runtime_layers: set[str] = set()
        runtime_roles: set[str] = set()
        for boundary_index, boundary in enumerate(runtime["boundaries"]):
            location = f"{runtime_location}/boundaries/{boundary_index}"
            diagnostics.extend(
                _one_boundary_diagnostics(
                    runtime,
                    boundary,
                    location,
                    layer_ids,
                    runtime_layers,
                    runtime_roles,
                    boundary_ids,
                    expanded_paths,
                )
            )
        diagnostics.extend(
            _runtime_coverage_diagnostics(
                runtime, runtime_location, layer_ids, runtime_layers, runtime_roles
            )
        )
    if observed != set(EXPECTED_RUNTIMES):
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-RUNTIME-SET",
                "/runtimes",
                "Les runtimes frontend, backend et quality doivent être présents une seule fois.",
                "Restaurer les trois frontières de runtime décidées en 7.8.",
            )
        )
    return diagnostics
