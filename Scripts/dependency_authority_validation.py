"""Structural and semantic diagnostics for the dependency authority."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from Scripts.dependency_authority_boundaries import runtime_diagnostics
from Scripts.dependency_authority_contract import Diagnostic

SUPPORTED_VERSION = "1.0.0"
EXPECTED_LAYERS = {
    "domain",
    "application",
    "ports",
    "adapters",
    "presentation",
    "composition",
}
EXPECTED_SOURCES = {
    "7.7": ("docs/target-dependency-directions.md", "dependency-directions"),
    "7.8": ("docs/target-architecture.md", "target-boundaries"),
}


def _json_pointer(parts: list[Any]) -> str:
    if not parts:
        return "/"
    escaped = (str(part).replace("~", "~0").replace("/", "~1") for part in parts)
    return "/" + "/".join(escaped)


def _structural_diagnostics(document: Any, schema: dict[str, Any]) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(document), key=lambda error: list(error.absolute_path))
    for error in errors:
        parts = list(error.absolute_path)
        if error.validator == "required":
            missing = re.search(r"'([^']+)' is a required property", error.message)
            if missing:
                parts.append(missing.group(1))
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-STRUCTURE",
                _json_pointer(parts),
                error.message,
                "Aligner la valeur sur config/dependency-authority-v1.0.schema.json.",
            )
        )
    return diagnostics


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _one_source_diagnostics(
    source: dict[str, Any], index: int, observed: set[str], root: Path
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    location = f"/normativeSources/{index}"
    pbi = source["pbi"]
    expected = EXPECTED_SOURCES.get(pbi)
    if pbi in observed or expected is None:
        return [
            Diagnostic(
                "DEP-AUTH-SOURCE",
                f"{location}/pbi",
                f"La source normative {pbi!r} est absente, inconnue ou dupliquée.",
                "Déclarer exactement une fois les décisions 7.7 et 7.8.",
            )
        ]
    observed.add(pbi)
    if (source["path"], source["role"]) != expected:
        return [
            Diagnostic(
                "DEP-AUTH-SOURCE",
                location,
                f"La décision {pbi} n'est pas reliée à son chemin et à son rôle normatifs.",
                f"Utiliser path={expected[0]!r} et role={expected[1]!r}.",
            )
        ]
    source_path = root / source["path"]
    if not source_path.is_file():
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-SOURCE-MISSING",
                f"{location}/path",
                f"Le document normatif {source['path']!r} est introuvable.",
                "Restaurer la décision normative avant de valider sa projection machine.",
            )
        )
    elif _sha256(source_path) != source["sha256"]:
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-SOURCE-HASH",
                f"{location}/sha256",
                f"L'empreinte de {source['path']!r} ne correspond plus à la décision liée.",
                "Revoir la décision modifiée puis mettre à jour sa projection "
                "et son empreinte ensemble.",
            )
        )
    return diagnostics


def _source_diagnostics(document: dict[str, Any], root: Path) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    observed: set[str] = set()
    for index, source in enumerate(document["normativeSources"]):
        diagnostics.extend(_one_source_diagnostics(source, index, observed, root))
    if observed != set(EXPECTED_SOURCES):
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-SOURCE-SET",
                "/normativeSources",
                "Le jeu de sources normatives doit contenir exactement les décisions 7.7 et 7.8.",
                "Ajouter la source manquante ou retirer toute source concurrente.",
            )
        )
    return diagnostics


def _layer_diagnostics(document: dict[str, Any]) -> list[Diagnostic]:
    identifiers = [layer["id"] for layer in document["layers"]]
    if len(identifiers) == len(set(identifiers)) and set(identifiers) == EXPECTED_LAYERS:
        return []
    return [
        Diagnostic(
            "DEP-AUTH-LAYERS",
            "/layers",
            "Les six couches de la décision 7.7 doivent être présentes une seule fois.",
            "Déclarer domain, application, ports, adapters, presentation et composition.",
        )
    ]


def _one_direction_diagnostics(
    direction: dict[str, Any],
    index: int,
    layers: set[str],
    pairs: dict[tuple[str, str], int],
) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    pair = (direction["from"], direction["to"])
    location = f"/directions/{index}"
    if pair[0] not in layers or pair[1] not in layers:
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-DIRECTION-REFERENCE",
                location,
                f"La direction {pair[0]!r} -> {pair[1]!r} référence une couche inconnue.",
                "Utiliser uniquement un identifiant déclaré dans /layers.",
            )
        )
    if pair in pairs:
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-DIRECTION-DUPLICATE",
                location,
                f"La direction {pair[0]!r} -> {pair[1]!r} est déjà déclarée.",
                f"Retirer ce doublon ; la première déclaration est /directions/{pairs[pair]}.",
            )
        )
    else:
        pairs[pair] = index
    same_layer = pair[0] == pair[1]
    if (same_layer and direction["policy"] != "internal-only") or (
        not same_layer and direction["policy"] == "internal-only"
    ):
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-DIRECTION-POLICY",
                f"{location}/policy",
                "internal-only est réservé à la diagonale d'une même couche.",
                "Utiliser internal-only pour une couche vers elle-même, sinon "
                "allowed ou forbidden.",
            )
        )
    return diagnostics


def _direction_diagnostics(document: dict[str, Any]) -> list[Diagnostic]:
    diagnostics: list[Diagnostic] = []
    layers = {layer["id"] for layer in document["layers"]}
    pairs: dict[tuple[str, str], int] = {}
    for index, direction in enumerate(document["directions"]):
        diagnostics.extend(_one_direction_diagnostics(direction, index, layers, pairs))
    missing = sorted({(source, target) for source in layers for target in layers} - set(pairs))
    if missing:
        rendered = ", ".join(f"{source}->{target}" for source, target in missing)
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-DIRECTION-MISSING",
                "/directions",
                f"La matrice de dépendance est incomplète : {rendered}.",
                "Déclarer exactement une politique pour chaque couple ordonné de couches.",
            )
        )
    return diagnostics


def validate_authority_document(
    document: Any, schema: dict[str, Any], repository_root: Path
) -> list[Diagnostic]:
    """Return every safe-to-compute defect in deterministic order."""
    structural = _structural_diagnostics(document, schema)
    if structural or not isinstance(document, dict):
        return structural
    diagnostics: list[Diagnostic] = []
    if document["schemaVersion"] != SUPPORTED_VERSION:
        diagnostics.append(
            Diagnostic(
                "DEP-AUTH-VERSION",
                "/schemaVersion",
                f"La version {document['schemaVersion']!r} n'est pas supportée.",
                f"Utiliser {SUPPORTED_VERSION} ou ajouter explicitement un parseur de migration.",
            )
        )
    diagnostics.extend(_source_diagnostics(document, repository_root.resolve()))
    diagnostics.extend(_layer_diagnostics(document))
    diagnostics.extend(_direction_diagnostics(document))
    diagnostics.extend(runtime_diagnostics(document))
    return diagnostics
