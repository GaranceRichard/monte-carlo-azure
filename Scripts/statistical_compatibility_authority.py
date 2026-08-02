"""Closed authority validation and release-decision consistency rules."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from Scripts.statistical_compatibility_common import (
    CLASSIFICATIONS,
    HISTORICAL_DATA_CATEGORIES,
    HISTORICAL_TREATMENTS,
    SURFACES,
    CompatibilityDiagnostic,
)
from Scripts.statistical_compatibility_proof_validation import (
    validate_proof_catalog as _validate_proof_catalog,
)
from Scripts.statistical_compatibility_release_validation import (
    release_diagnostics,
)


def _diagnostic(
    code: str,
    action: str,
    *,
    component: str = "compatibility-authority",
    authority: str = "contracts/statistical-compatibility-authority-v1.0.json",
    classification: str = "compatibility_control_error",
    expected: str | None = None,
    actual: str | None = None,
) -> CompatibilityDiagnostic:
    return CompatibilityDiagnostic(
        component=component,
        previous_version=None,
        current_version=None,
        surface=None,
        authority=authority,
        expected_fingerprint=expected,
        actual_fingerprint=actual,
        classification=classification,
        expected_decision="valid closed compatibility authority",
        declared_decision=None,
        missing_proofs=(),
        affected_data=(),
        corrective_action=action,
        code=code,
    )


def structural_diagnostics(authority: Any, schema: Any) -> list[CompatibilityDiagnostic]:
    try:
        Draft202012Validator.check_schema(schema)
        errors = sorted(
            Draft202012Validator(schema).iter_errors(authority),
            key=lambda error: (list(error.absolute_path), error.message),
        )
    except SchemaError as exc:
        return [
            _diagnostic("authority_schema_invalid", f"Repair the authority schema: {exc.message}")
        ]
    return [
        _diagnostic(
            "authority_schema_violation",
            f"Repair authority path /{'/'.join(str(item) for item in error.absolute_path)}: "
            f"{error.message}",
        )
        for error in errors
    ]


def _catalog_diagnostics(authority: dict[str, Any]) -> list[CompatibilityDiagnostic]:
    diagnostics: list[CompatibilityDiagnostic] = []
    for field, expected in (
        ("classifications", CLASSIFICATIONS),
        ("historical_treatments", HISTORICAL_TREATMENTS),
        ("historical_data_categories", HISTORICAL_DATA_CATEGORIES),
        ("normative_surfaces", SURFACES),
    ):
        if tuple(authority[field]) != expected:
            diagnostics.append(
                _diagnostic(
                    f"{field}_catalog_incomplete",
                    f"Restore the closed ordered {field} catalog.",
                )
            )
    covered = [surface for item in authority["components"] for surface in item["surfaces"]]
    if sorted(covered) != sorted(SURFACES) or len(covered) != len(set(covered)):
        diagnostics.append(
            _diagnostic(
                "surface_coverage_incomplete",
                "Assign every monitored surface to exactly one versioned component.",
            )
        )
    return diagnostics


def _dependency_diagnostics(authority: dict[str, Any]) -> list[CompatibilityDiagnostic]:
    components = {item["id"]: item for item in authority["components"]}
    diagnostics: list[CompatibilityDiagnostic] = []
    for component in components.values():
        for dependency in component["dependencies"]:
            target = components.get(dependency["component"])
            if target is None or target["current_version"] != dependency["version"]:
                diagnostics.append(
                    _diagnostic(
                        "dependency_version_mismatch",
                        "Align the component dependency with the declared current release.",
                        component=component["id"],
                    )
                )
    return diagnostics


def validate_proof_catalog(
    root: Path,
    authority: dict[str, Any],
    path_overrides: dict[str, str] | None = None,
) -> tuple[dict[str, str], list[CompatibilityDiagnostic]]:
    return _validate_proof_catalog(root, authority, _diagnostic, path_overrides)


def semantic_diagnostics(authority: dict[str, Any]) -> list[CompatibilityDiagnostic]:
    diagnostics = _catalog_diagnostics(authority)
    identifiers = [item["id"] for item in authority["components"]]
    proof_ids = [item["id"] for item in authority["proof_artifacts"]]
    if len(identifiers) != len(set(identifiers)) or len(proof_ids) != len(set(proof_ids)):
        diagnostics.append(
            _diagnostic("duplicate_authority_id", "Give every component and proof a unique id.")
        )
    available_proofs = set(proof_ids)
    for component in authority["components"]:
        diagnostics.extend(release_diagnostics(component, _diagnostic))
        if not set(component["required_proofs"]).issubset(available_proofs):
            diagnostics.append(
                _diagnostic(
                    "required_proof_unknown",
                    "Reference only proof artifacts declared by this authority.",
                    component=component["id"],
                )
            )
    diagnostics.extend(_dependency_diagnostics(authority))
    return diagnostics
