"""Blocking comparison of current statistical semantics with accepted releases."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from Scripts.statistical_compatibility_authority import (
    semantic_diagnostics,
    structural_diagnostics,
    validate_proof_catalog,
)
from Scripts.statistical_compatibility_common import CompatibilityDiagnostic
from Scripts.statistical_compatibility_evolution import evolution_diagnostics
from Scripts.statistical_compatibility_extractors import ExtractionError, component_fingerprint


def _component_diagnostic(
    component: dict[str, Any],
    actual: str | None,
    *,
    classification: str,
    code: str,
    action: str,
    missing_proofs: tuple[str, ...] = (),
    authority_path: str | None = None,
) -> CompatibilityDiagnostic:
    current = component["releases"][-1]
    return CompatibilityDiagnostic(
        component=component["id"],
        previous_version=current["decision"]["from_version"],
        current_version=component["current_version"],
        surface=component["surfaces"][0],
        authority=authority_path or component["authorities"][0]["path"],
        expected_fingerprint=current["semantic_fingerprint"],
        actual_fingerprint=actual,
        classification=classification,
        expected_decision=(
            "new append-only release, coherent compatibility decision, version increment, proofs, "
            "and historical-data treatment"
        ),
        declared_decision=current["decision"]["id"],
        missing_proofs=missing_proofs,
        affected_data=tuple(component["affected_data"]),
        corrective_action=action,
        code=code,
    )


def _drift_classification(component: dict[str, Any]) -> str:
    mapping = {
        "prng": "pseudo_random_stream_change",
        "draw-index": "pseudo_random_stream_change",
        "draw-order-and-batching": "replay_incompatibility",
        "canonical-response": "serialized_shape_change",
        "serialization-and-history": "serialized_shape_change",
    }
    return mapping.get(component["id"], component["default_drift_classification"])


def _component_state(component: dict[str, Any], actual: str | None) -> dict[str, Any]:
    current = component["releases"][-1]
    expected = current["semantic_fingerprint"]
    return {
        "id": component["id"],
        "identity": current["identity"],
        "current_version": component["current_version"],
        "surfaces": component["surfaces"],
        "expected_semantic_fingerprint": expected,
        "actual_semantic_fingerprint": actual,
        "classification": (
            "no_normative_impact" if actual == expected else _drift_classification(component)
        ),
        "decision_id": current["decision"]["id"],
        "required_proofs": component["required_proofs"],
        "affected_data": component["affected_data"],
        "data_treatments": current["decision"]["data_treatments"],
        "status": "match" if actual == expected else "blocked",
    }


def _drift_diagnostics(
    component: dict[str, Any],
    actual: str,
    proof_fingerprints: dict[str, str],
    proof_catalog: dict[str, dict[str, Any]],
) -> list[CompatibilityDiagnostic]:
    unchanged_proofs = tuple(
        proof_id
        for proof_id in component["required_proofs"]
        if proof_fingerprints.get(proof_id) == proof_catalog[proof_id]["semantic_fingerprint"]
    )
    return [
        _component_diagnostic(
            component,
            actual,
            classification=_drift_classification(component),
            code="semantic_drift_without_release",
            action=(
                "Append a versioned release decision; update every required independent proof "
                "and declare migration or invalidation where needed."
            ),
            missing_proofs=unchanged_proofs,
        ),
        _component_diagnostic(
            component,
            actual,
            classification="version_not_incremented",
            code="semantic_drift_version_unchanged",
            action="Increment the component and governing contract versions coherently.",
        ),
    ]


def evaluate_components(
    root: Path,
    authority: dict[str, Any],
    proof_fingerprints: dict[str, str],
) -> tuple[list[dict[str, Any]], list[CompatibilityDiagnostic]]:
    states: list[dict[str, Any]] = []
    diagnostics: list[CompatibilityDiagnostic] = []
    proof_catalog = {item["id"]: item for item in authority["proof_artifacts"]}
    for component in authority["components"]:
        try:
            actual = component_fingerprint(root, component)
        except ExtractionError as exc:
            actual = None
            diagnostics.append(
                _component_diagnostic(
                    component,
                    actual,
                    classification="compatibility_control_error",
                    code="authority_extraction_failed",
                    action=f"Restore an unambiguous parseable authority: {exc}",
                )
            )
        expected = component["releases"][-1]["semantic_fingerprint"]
        if actual is not None and actual != expected:
            diagnostics.extend(
                _drift_diagnostics(component, actual, proof_fingerprints, proof_catalog)
            )
        states.append(_component_state(component, actual))
    return states, diagnostics


def validate_authority_and_evaluate(
    root: Path,
    authority: Any,
    schema: Any,
    previous_authority: dict[str, Any] | None = None,
    proof_path_overrides: dict[str, str] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, str], list[CompatibilityDiagnostic]]:
    diagnostics = structural_diagnostics(authority, schema)
    if diagnostics or not isinstance(authority, dict):
        return [], {}, diagnostics
    diagnostics.extend(semantic_diagnostics(authority))
    diagnostics.extend(evolution_diagnostics(authority, previous_authority))
    proof_fingerprints, proof_diagnostics = validate_proof_catalog(
        root, authority, proof_path_overrides
    )
    diagnostics.extend(proof_diagnostics)
    states, component_diagnostics = evaluate_components(root, authority, proof_fingerprints)
    diagnostics.extend(component_diagnostics)
    return states, proof_fingerprints, diagnostics
