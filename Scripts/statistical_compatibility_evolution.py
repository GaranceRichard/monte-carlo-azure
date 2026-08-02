"""Append-only evolution checks for the compatibility authority."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from Scripts.statistical_compatibility_common import CompatibilityDiagnostic

_RELEASE_CLASSIFICATIONS = frozenset(
    {
        "compatible_without_historical_result_change",
        "compatible_contract_extension",
        "normative_result_change",
        "replay_incompatibility",
        "pseudo_random_stream_change",
        "serialized_shape_change",
        "migration_required",
        "invalidation_required",
    }
)


def _diagnostic(
    code: str,
    action: str,
    *,
    component: str = "compatibility-authority",
    classification: str = "compatibility_control_error",
    authority: str = "contracts/statistical-compatibility-authority-v1.0.json",
    missing_proofs: tuple[str, ...] = (),
) -> CompatibilityDiagnostic:
    return CompatibilityDiagnostic(
        component=component,
        previous_version=None,
        current_version=None,
        surface=None,
        authority=authority,
        expected_fingerprint=None,
        actual_fingerprint=None,
        classification=classification,
        expected_decision="append-only release and regenerated proof lineage",
        declared_decision=None,
        missing_proofs=missing_proofs,
        affected_data=(),
        corrective_action=action,
        code=code,
    )


def load_committed_authority(root: Path, relative_path: str) -> dict[str, Any] | None:
    """Read the accepted authority from Git without changing the worktree."""

    try:
        completed = subprocess.run(
            ["git", "-C", str(root), "show", f"HEAD:{relative_path}"],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    try:
        value = json.loads(completed.stdout)
    except (TypeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _release_change_diagnostics(
    component: dict[str, Any], release: dict[str, Any], previous: dict[str, Any]
) -> list[CompatibilityDiagnostic]:
    diagnostics: list[CompatibilityDiagnostic] = []
    base = {"component": component["id"]}
    decision = release["decision"]
    if release["semantic_fingerprint"] == previous["semantic_fingerprint"]:
        diagnostics.append(
            _diagnostic(
                "release_without_semantic_change",
                "Remove the version-only release; semantic versions require an "
                "observed authority change.",
                classification="no_normative_impact",
                **base,
            )
        )
    if decision["classification"] not in _RELEASE_CLASSIFICATIONS:
        diagnostics.append(
            _diagnostic(
                "invalid_release_classification",
                "Declare a compatibility outcome, not a control-error classification.",
                classification="decision_missing",
                **base,
            )
        )
    return diagnostics


def _release_proof_diagnostics(
    component: dict[str, Any], decision: dict[str, Any]
) -> list[CompatibilityDiagnostic]:
    diagnostics: list[CompatibilityDiagnostic] = []
    base = {"component": component["id"]}
    declared_proofs = set(decision["proof_artifacts"])
    required_proofs = set(component["required_proofs"])
    if declared_proofs != required_proofs:
        diagnostics.append(
            _diagnostic(
                "release_proof_set_incomplete",
                "Bind the decision to exactly the independent proofs required by the component.",
                classification="corpus_or_proof_not_updated",
                missing_proofs=tuple(sorted(required_proofs - declared_proofs)),
                **base,
            )
        )
    return diagnostics


def _classification_diagnostics(
    component: dict[str, Any], decision: dict[str, Any]
) -> list[CompatibilityDiagnostic]:
    diagnostics: list[CompatibilityDiagnostic] = []
    base = {"component": component["id"]}
    classification = decision["classification"]
    compatible_extensions = {
        "input-contract",
        "canonical-response",
        "serialization-and-history",
        "reference-corpus-contract",
        "exact-replay-proof",
        "distributional-proof",
    }
    if (
        classification == "compatible_contract_extension"
        and component["id"] not in compatible_extensions
    ):
        diagnostics.append(
            _diagnostic(
                "decision_incompatible_with_component",
                "Use contract-extension only for a monitored contract or proof surface.",
                classification="compatibility_control_error",
                **base,
            )
        )
    expected_components = {
        "pseudo_random_stream_change": {"prng"},
        "serialized_shape_change": {"canonical-response", "serialization-and-history"},
    }
    allowed_components = expected_components.get(classification)
    if allowed_components is not None and component["id"] not in allowed_components:
        diagnostics.append(
            _diagnostic(
                "decision_incompatible_with_component",
                f"Classification {classification} does not describe this component.",
                **base,
            )
        )
    return diagnostics


def _historical_decision_diagnostics(
    component: dict[str, Any], decision: dict[str, Any]
) -> list[CompatibilityDiagnostic]:
    classification = decision["classification"]
    base = {"component": component["id"]}
    disruptive = {
        "normative_result_change",
        "replay_incompatibility",
        "pseudo_random_stream_change",
        "serialized_shape_change",
        "migration_required",
        "invalidation_required",
    }
    treatments = {item["treatment"] for item in decision["data_treatments"]}
    if classification not in disruptive or treatments != {"compatible_without_action"}:
        return []
    return [
        _diagnostic(
            "historical_treatment_incoherent",
            "Choose a legacy, migration, archival, invalidation, purge, or rejection treatment.",
            classification="migration_required",
            **base,
        )
    ]


def release_decision_diagnostics(
    component: dict[str, Any], index: int
) -> list[CompatibilityDiagnostic]:
    """Validate that a release decision matches its component and required evidence."""

    if index == 0:
        return []
    release = component["releases"][index]
    previous = component["releases"][index - 1]
    decision = release["decision"]
    diagnostics = _release_change_diagnostics(component, release, previous)
    diagnostics.extend(_release_proof_diagnostics(component, decision))
    diagnostics.extend(_classification_diagnostics(component, decision))
    diagnostics.extend(_historical_decision_diagnostics(component, decision))
    return diagnostics


def _proof_changes(
    current: dict[str, Any], previous: dict[str, Any]
) -> tuple[set[str], list[CompatibilityDiagnostic]]:
    diagnostics: list[CompatibilityDiagnostic] = []
    current_proofs = {item["id"]: item for item in current["proof_artifacts"]}
    previous_proofs = {item["id"]: item for item in previous["proof_artifacts"]}
    removed = set(previous_proofs) - set(current_proofs)
    for proof_id in sorted(removed):
        diagnostics.append(
            _diagnostic(
                "accepted_proof_removed",
                f"Restore accepted proof {proof_id}; proof history is append-only.",
                authority=previous_proofs[proof_id]["path"],
            )
        )
    changed = {
        proof_id
        for proof_id in set(previous_proofs) & set(current_proofs)
        if current_proofs[proof_id] != previous_proofs[proof_id]
    }
    for proof_id in sorted(changed):
        old = previous_proofs[proof_id]
        new = current_proofs[proof_id]
        if new["version"] == old["version"]:
            diagnostics.append(
                _diagnostic(
                    "proof_version_not_incremented",
                    f"Increment proof {proof_id} when changing its accepted manifest entry.",
                    classification="version_not_incremented",
                    authority=new["path"],
                )
            )
    return changed, diagnostics


_MANIFEST_FIELDS = (
    "current_version",
    "surfaces",
    "consumers",
    "dependencies",
    "authorities",
    "required_proofs",
    "affected_data",
    "default_drift_classification",
)


def _component_evolution_diagnostics(
    component_id: str,
    new: dict[str, Any],
    old: dict[str, Any],
    changed_proofs: set[str],
) -> tuple[bool, list[CompatibilityDiagnostic]]:
    diagnostics: list[CompatibilityDiagnostic] = []
    old_releases = old["releases"]
    if new["releases"][: len(old_releases)] != old_releases:
        return False, [
            _diagnostic(
                "accepted_release_modified",
                "Restore immutable accepted releases and append a traced decision instead.",
                component=component_id,
            )
        ]
    appended = new["releases"][len(old_releases) :]
    manifest_changed = any(new[field] != old[field] for field in _MANIFEST_FIELDS)
    if manifest_changed and not appended:
        diagnostics.append(
            _diagnostic(
                "component_manifest_changed_without_release",
                "Append a release decision for every semantic authority-manifest change.",
                component=component_id,
                classification="decision_missing",
            )
        )
    if appended:
        unchanged = tuple(sorted(set(new["required_proofs"]) - changed_proofs))
        if unchanged:
            diagnostics.append(
                _diagnostic(
                    "release_proofs_not_regenerated",
                    "Regenerate and version every proof required by the new semantic release.",
                    component=component_id,
                    classification="corpus_or_proof_not_updated",
                    missing_proofs=unchanged,
                )
            )
    return bool(appended), diagnostics


def evolution_diagnostics(
    current: dict[str, Any], previous: dict[str, Any] | None
) -> list[CompatibilityDiagnostic]:
    """Reject edits to accepted releases and proof updates without a new release."""

    if previous is None:
        return []
    changed_proofs, diagnostics = _proof_changes(current, previous)
    current_components = {item["id"]: item for item in current["components"]}
    previous_components = {item["id"]: item for item in previous["components"]}
    removed = sorted(set(previous_components) - set(current_components))
    diagnostics.extend(
        _diagnostic(
            "accepted_component_removed",
            f"Restore accepted component {component_id}; component history is append-only.",
            component=component_id,
        )
        for component_id in removed
    )
    any_release = False
    shared = sorted(set(previous_components) & set(current_components))
    for component_id in shared:
        appended, component_diagnostics = _component_evolution_diagnostics(
            component_id,
            current_components[component_id],
            previous_components[component_id],
            changed_proofs,
        )
        any_release = any_release or appended
        diagnostics.extend(component_diagnostics)
    if changed_proofs and not any_release:
        diagnostics.append(
            _diagnostic(
                "proof_manifest_changed_without_release",
                "Trace every proof-manifest change to at least one appended component release.",
                classification="decision_missing",
                missing_proofs=tuple(sorted(changed_proofs)),
            )
        )
    return diagnostics
