"""Validation of proof artifacts referenced by compatibility decisions."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from Scripts.statistical_compatibility_common import (
    CompatibilityDiagnostic,
    json_pointer,
    load_json,
)
from Scripts.statistical_compatibility_extractors import ExtractionError, json_document_fingerprint

DiagnosticFactory = Callable[..., CompatibilityDiagnostic]


def _schema_diagnostics(
    proof: dict[str, Any],
    document: Any,
    schema: dict[str, Any],
    diagnostic: DiagnosticFactory,
) -> list[CompatibilityDiagnostic]:
    errors = sorted(
        Draft202012Validator(schema).iter_errors(document),
        key=lambda error: (list(error.absolute_path), error.message),
    )
    return [
        diagnostic(
            "proof_schema_violation",
            f"Regenerate {proof['id']} against its declared schema: {error.message}",
            authority=proof["path"],
            classification="corpus_or_proof_not_updated",
        )
        for error in errors
    ]


def _binding_diagnostics(
    proof: dict[str, Any], document: Any, diagnostic: DiagnosticFactory
) -> list[CompatibilityDiagnostic]:
    diagnostics: list[CompatibilityDiagnostic] = []
    for binding in proof["version_bindings"]:
        try:
            bound_value = json_pointer(document, binding["pointer"])
        except ValueError:
            bound_value = None
        if bound_value != binding["expected"]:
            diagnostics.append(
                diagnostic(
                    "proof_version_mismatch",
                    f"Regenerate {proof['id']} from one coherent set of declared versions.",
                    authority=proof["path"],
                    classification="corpus_or_proof_not_updated",
                )
            )
    return diagnostics


def _proof_diagnostics(
    proof: dict[str, Any],
    document: Any,
    schema: dict[str, Any],
    actual: str,
    diagnostic: DiagnosticFactory,
) -> list[CompatibilityDiagnostic]:
    diagnostics = _schema_diagnostics(proof, document, schema, diagnostic)
    if actual != proof["semantic_fingerprint"]:
        diagnostics.append(
            diagnostic(
                "proof_fingerprint_drift",
                f"Regenerate proof {proof['id']} and record it through a release decision.",
                authority=proof["path"],
                classification="corpus_or_proof_not_updated",
                expected=proof["semantic_fingerprint"],
                actual=actual,
            )
        )
    diagnostics.extend(_binding_diagnostics(proof, document, diagnostic))
    return diagnostics


def validate_proof_catalog(
    root: Path,
    authority: dict[str, Any],
    diagnostic: DiagnosticFactory,
    path_overrides: dict[str, str] | None = None,
) -> tuple[dict[str, str], list[CompatibilityDiagnostic]]:
    fingerprints: dict[str, str] = {}
    diagnostics: list[CompatibilityDiagnostic] = []
    for proof in authority["proof_artifacts"]:
        proof_path = (path_overrides or {}).get(proof["id"], proof["path"])
        try:
            document = load_json(root / proof_path)
            schema = load_json(root / proof["schema_path"])
            Draft202012Validator.check_schema(schema)
            actual = json_document_fingerprint(root, proof_path)
        except (OSError, UnicodeError, ValueError, ExtractionError, SchemaError) as exc:
            diagnostics.append(
                diagnostic(
                    "proof_unavailable",
                    f"Restore and regenerate proof {proof['id']}: {exc}",
                    authority=proof_path,
                    classification="corpus_or_proof_not_updated",
                )
            )
            continue
        fingerprints[proof["id"]] = actual
        diagnostics.extend(_proof_diagnostics(proof, document, schema, actual, diagnostic))
    return fingerprints, diagnostics
