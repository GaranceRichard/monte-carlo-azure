"""Parse the machine-readable target dependency authority."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from Scripts.dependency_authority_contract import Diagnostic
from Scripts.dependency_authority_validation import validate_authority_document

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUTHORITY = ROOT / "config" / "dependency-authority-v1.0.json"
DEFAULT_SCHEMA = ROOT / "config" / "dependency-authority-v1.0.schema.json"


@dataclass(frozen=True)
class DependencyAuthority:
    """Validated authority model made available to future rule families."""

    path: Path
    schema_path: Path
    repository_root: Path
    document: dict[str, Any]

    @property
    def schema_version(self) -> str:
        return str(self.document["schemaVersion"])

    def direction_policy(self, source: str, target: str) -> str:
        for direction in self.document["directions"]:
            if direction["from"] == source and direction["to"] == target:
                return str(direction["policy"])
        raise KeyError(f"No dependency direction declared for {source!r} -> {target!r}")


class AuthorityValidationError(ValueError):
    """Raised when the authority cannot be parsed into a trustworthy model."""

    def __init__(self, source: Path, diagnostics: list[Diagnostic]) -> None:
        self.source = source
        self.diagnostics = tuple(diagnostics)
        super().__init__("\n".join(item.render(source) for item in diagnostics))


class _DuplicateKeyError(ValueError):
    pass


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise _DuplicateKeyError(key)
        result[key] = value
    return result


def _read_json(path: Path, *, label: str) -> tuple[Any | None, list[Diagnostic]]:
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return None, [
            Diagnostic(
                "DEP-AUTH-READ",
                "/",
                f"Impossible de lire {label} {path}: {exc}",
                "Rétablir un fichier UTF-8 lisible au chemin déclaré.",
            )
        ]
    try:
        return json.loads(content, object_pairs_hook=_reject_duplicate_keys), []
    except json.JSONDecodeError as exc:
        return None, [
            Diagnostic(
                "DEP-AUTH-JSON",
                f"line {exc.lineno}, column {exc.colno}",
                f"JSON invalide dans {label}: {exc.msg}",
                "Corriger la syntaxe JSON à la ligne et à la colonne indiquées.",
            )
        ]
    except _DuplicateKeyError as exc:
        return None, [
            Diagnostic(
                "DEP-AUTH-DUPLICATE-KEY",
                "/",
                f"La propriété JSON {str(exc)!r} est déclarée plusieurs fois.",
                "Conserver une seule occurrence de cette propriété.",
            )
        ]


def load_dependency_authority(
    authority_path: Path = DEFAULT_AUTHORITY,
    schema_path: Path = DEFAULT_SCHEMA,
    repository_root: Path = ROOT,
) -> DependencyAuthority:
    """Load a validated authority or raise with localized diagnostics."""
    authority_path = authority_path.resolve()
    schema_path = schema_path.resolve()
    document, diagnostics = _read_json(authority_path, label="l'autorité")
    if diagnostics:
        raise AuthorityValidationError(authority_path, diagnostics)
    schema, schema_diagnostics = _read_json(schema_path, label="le schéma")
    if schema_diagnostics:
        raise AuthorityValidationError(authority_path, schema_diagnostics)
    if not isinstance(schema, dict):
        raise AuthorityValidationError(
            authority_path,
            [
                Diagnostic(
                    "DEP-AUTH-SCHEMA",
                    "/",
                    "Le schéma de l'autorité n'est pas un objet JSON.",
                    "Restaurer le schéma Draft 2020-12 versionné.",
                )
            ],
        )
    diagnostics = validate_authority_document(document, schema, repository_root)
    if diagnostics:
        raise AuthorityValidationError(authority_path, diagnostics)
    return DependencyAuthority(
        path=authority_path,
        schema_path=schema_path,
        repository_root=repository_root.resolve(),
        document=document,
    )


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def authority_evidence(
    authority: DependencyAuthority,
    *,
    domain_files: int,
    domain_dependencies: int,
) -> dict[str, Any]:
    """Build the deterministic proof for authority and domain independence."""
    document = authority.document
    return {
        "evidenceVersion": "1.0.0",
        "authority": authority.path.relative_to(authority.repository_root).as_posix(),
        "authoritySha256": _sha256(authority.path),
        "schema": authority.schema_path.relative_to(authority.repository_root).as_posix(),
        "schemaSha256": _sha256(authority.schema_path),
        "schemaVersion": authority.schema_version,
        "normativeSources": document["normativeSources"],
        "checks": {
            "jsonSyntax": "valid",
            "structure": "valid",
            "semantics": "valid",
            "domainIndependence": "valid",
        },
        "counts": {
            "layers": len(document["layers"]),
            "directions": len(document["directions"]),
            "runtimes": len(document["runtimes"]),
            "boundaries": sum(len(runtime["boundaries"]) for runtime in document["runtimes"]),
            "domainFiles": domain_files,
            "domainDependencies": domain_dependencies,
            "domainTechnologyViolations": 0,
        },
        "diagnostics": [],
        "status": "valid",
    }
