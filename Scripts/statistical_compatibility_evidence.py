"""Canonical compatibility evidence construction and validation helpers."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from jsonschema import Draft202012Validator

from Scripts.statistical_compatibility_common import CompatibilityDiagnostic, sha256


def _fingerprint_payload(evidence: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(evidence)
    payload.get("stability", {}).pop("artifact_fingerprint", None)
    return payload


def evidence_fingerprint(evidence: dict[str, Any]) -> str:
    return sha256(_fingerprint_payload(evidence))


def _status(diagnostics: list[CompatibilityDiagnostic]) -> tuple[str, str]:
    control_error = any(
        item.classification == "compatibility_control_error" for item in diagnostics
    )
    status = "control_error" if control_error else "blocked" if diagnostics else "match"
    classification = (
        "compatibility_control_error"
        if control_error
        else diagnostics[0].classification
        if diagnostics
        else "no_normative_impact"
    )
    return status, classification


def _proof_states(
    authority: dict[str, Any], proof_fingerprints: dict[str, str]
) -> list[dict[str, Any]]:
    return [
        {
            "id": proof["id"],
            "version": proof["version"],
            "expected_semantic_fingerprint": proof["semantic_fingerprint"],
            "actual_semantic_fingerprint": proof_fingerprints.get(proof["id"]),
            "status": (
                "match"
                if proof_fingerprints.get(proof["id"]) == proof["semantic_fingerprint"]
                else "blocked"
            ),
        }
        for proof in authority["proof_artifacts"]
    ]


def _summary(
    authority: dict[str, Any],
    states: list[dict[str, Any]],
    proof_fingerprints: dict[str, str],
    diagnostics: list[CompatibilityDiagnostic],
) -> dict[str, int]:
    return {
        "component_count": len(states),
        "matching_component_count": sum(item["status"] == "match" for item in states),
        "blocked_component_count": sum(item["status"] != "match" for item in states),
        "proof_count": len(authority["proof_artifacts"]),
        "matching_proof_count": sum(
            proof_fingerprints.get(item["id"]) == item["semantic_fingerprint"]
            for item in authority["proof_artifacts"]
        ),
        "diagnostic_count": len(diagnostics),
    }


def build_evidence(
    authority: dict[str, Any],
    states: list[dict[str, Any]],
    proof_fingerprints: dict[str, str],
    diagnostics: list[CompatibilityDiagnostic],
) -> dict[str, Any]:
    serialized_diagnostics = [item.as_json() for item in diagnostics]
    status, classification = _status(diagnostics)
    evidence: dict[str, Any] = {
        "evidence_version": "1.0",
        "proof_kind": "statistical_compatibility",
        "authority": {
            "id": authority["authority_id"],
            "version": authority["authority_version"],
            "schema_version": authority["schema_version"],
            "semantic_fingerprint": sha256(authority),
        },
        "enforcement": {
            "direct_execution": "blocking",
            "main_profile": "not_integrated",
            "main_integration_scope": "PBI 2.21",
        },
        "status": status,
        "classification": classification,
        "components": states,
        "proof_artifacts": _proof_states(authority, proof_fingerprints),
        "summary": _summary(authority, states, proof_fingerprints, diagnostics),
        "diagnostics": serialized_diagnostics,
        "stability": {
            "deterministic": True,
            "method": "sha256-canonical-json-without-artifact-fingerprint",
        },
    }
    evidence["stability"]["artifact_fingerprint"] = evidence_fingerprint(evidence)
    return evidence


def validate_evidence(evidence: Any, schema: dict[str, Any]) -> list[str]:
    errors = sorted(
        Draft202012Validator(schema).iter_errors(evidence),
        key=lambda error: (list(error.absolute_path), error.message),
    )
    issues = [
        f"/{'/'.join(str(item) for item in error.absolute_path)}: {error.message}"
        for error in errors
    ]
    if issues or not isinstance(evidence, dict):
        return issues
    if evidence["stability"]["artifact_fingerprint"] != evidence_fingerprint(evidence):
        issues.append("/stability/artifact_fingerprint: fingerprint is inconsistent")
    summary = evidence["summary"]
    if summary["component_count"] != len(evidence["components"]):
        issues.append("/summary/component_count: counter is inconsistent")
    if summary["proof_count"] != len(evidence["proof_artifacts"]):
        issues.append("/summary/proof_count: counter is inconsistent")
    if summary["diagnostic_count"] != len(evidence["diagnostics"]):
        issues.append("/summary/diagnostic_count: counter is inconsistent")
    expected_status = (
        "control_error"
        if any(
            item["classification"] == "compatibility_control_error"
            for item in evidence["diagnostics"]
        )
        else "blocked"
        if evidence["diagnostics"]
        else "match"
    )
    if evidence["status"] != expected_status:
        issues.append("/status: status is inconsistent with diagnostics")
    return issues
