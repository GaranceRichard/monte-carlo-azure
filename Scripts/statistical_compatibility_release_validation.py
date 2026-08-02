"""Compatibility release-lineage and historical-treatment rules."""

from __future__ import annotations

from typing import Any, Callable

from Scripts.statistical_compatibility_common import CompatibilityDiagnostic
from Scripts.statistical_compatibility_evolution import release_decision_diagnostics

DiagnosticFactory = Callable[..., CompatibilityDiagnostic]


def _version_tuple(value: str) -> tuple[int, ...]:
    try:
        return tuple(int(part) for part in value.split("."))
    except ValueError as exc:
        raise ValueError(f"invalid numeric version: {value}") from exc


def _lineage_diagnostics(
    release: dict[str, Any],
    previous: dict[str, Any] | None,
    diagnostic: DiagnosticFactory,
    base: dict[str, str],
) -> list[CompatibilityDiagnostic]:
    decision = release["decision"]
    diagnostics: list[CompatibilityDiagnostic] = []
    if (
        decision["to_version"] != release["version"]
        or decision["to_fingerprint"] != release["semantic_fingerprint"]
    ):
        diagnostics.append(
            diagnostic(
                "decision_target_mismatch",
                "Bind the decision target to the declared release version and fingerprint.",
                **base,
            )
        )
    expected_version = previous["version"] if previous else None
    expected_fingerprint = previous["semantic_fingerprint"] if previous else None
    if (
        decision["from_version"] != expected_version
        or decision["from_fingerprint"] != expected_fingerprint
    ):
        diagnostics.append(
            diagnostic(
                "release_lineage_broken",
                "Restore the append-only release lineage and its previous fingerprint.",
                **base,
            )
        )
    if previous and _version_tuple(release["version"]) <= _version_tuple(expected_version or "0"):
        diagnostics.append(
            diagnostic(
                "version_not_incremented",
                "Increment the component version for a new semantic release.",
                classification="version_not_incremented",
                **base,
            )
        )
    return diagnostics


def _surface_diagnostics(
    component: dict[str, Any],
    release: dict[str, Any],
    previous: dict[str, Any] | None,
    diagnostic: DiagnosticFactory,
    base: dict[str, str],
) -> list[CompatibilityDiagnostic]:
    decision = release["decision"]
    changed = decision["changed_surfaces"]
    diagnostics: list[CompatibilityDiagnostic] = []
    if any(surface not in component["surfaces"] for surface in changed):
        diagnostics.append(
            diagnostic(
                "decision_surface_outside_component",
                "Declare only surfaces owned by this component.",
                **base,
            )
        )
    if previous is None and (
        changed or decision["classification"] != "compatible_without_historical_result_change"
    ):
        diagnostics.append(
            diagnostic(
                "baseline_decision_incoherent",
                "Keep the initial adoption decision non-changing and explicitly compatible.",
                **base,
            )
        )
    if (
        previous
        and release["semantic_fingerprint"] != previous["semantic_fingerprint"]
        and not changed
    ):
        diagnostics.append(
            diagnostic(
                "decision_missing_surfaces",
                "List every changed normative surface in the compatibility decision.",
                classification="decision_missing",
                **base,
            )
        )
    return diagnostics


def _treatment_diagnostics(
    component: dict[str, Any],
    release: dict[str, Any],
    diagnostic: DiagnosticFactory,
    base: dict[str, str],
) -> list[CompatibilityDiagnostic]:
    decision = release["decision"]
    treatments = {item["category"]: item["treatment"] for item in decision["data_treatments"]}
    diagnostics: list[CompatibilityDiagnostic] = []
    if set(treatments) != set(component["affected_data"]):
        diagnostics.append(
            diagnostic(
                "historical_treatment_missing",
                "Declare one treatment for every affected historical-data category.",
                classification="migration_required",
                **base,
            )
        )
    classification = decision["classification"]
    if (
        classification == "migration_required"
        and "deterministic_migration" not in treatments.values()
    ):
        diagnostics.append(
            diagnostic(
                "migration_plan_missing",
                "Attach a deterministic migration treatment and evidence.",
                classification="migration_required",
                **base,
            )
        )
    invalidating = {"invalidation", "purge", "explicit_rejection"}
    if classification == "invalidation_required" and not invalidating.intersection(
        treatments.values()
    ):
        diagnostics.append(
            diagnostic(
                "invalidation_plan_missing",
                "Attach an invalidation, purge, or explicit-rejection treatment.",
                classification="invalidation_required",
                **base,
            )
        )
    return diagnostics


def release_diagnostics(
    component: dict[str, Any], diagnostic: DiagnosticFactory
) -> list[CompatibilityDiagnostic]:
    releases = component["releases"]
    base = {
        "component": component["id"],
        "authority": "contracts/statistical-compatibility-authority-v1.0.json",
    }
    diagnostics: list[CompatibilityDiagnostic] = []
    if releases[-1]["version"] != component["current_version"]:
        diagnostics.append(
            diagnostic(
                "current_release_mismatch",
                "Make current_version identify the last immutable release entry.",
                **base,
            )
        )
    for index, release in enumerate(releases):
        previous = releases[index - 1] if index else None
        diagnostics.extend(release_decision_diagnostics(component, index))
        diagnostics.extend(_lineage_diagnostics(release, previous, diagnostic, base))
        diagnostics.extend(_surface_diagnostics(component, release, previous, diagnostic, base))
        diagnostics.extend(_treatment_diagnostics(component, release, diagnostic, base))
        if (
            previous
            and release["decision"]["classification"] == "pseudo_random_stream_change"
            and release["identity"] == previous["identity"]
        ):
            diagnostics.append(
                diagnostic(
                    "prng_identity_not_changed",
                    "Assign a new PRNG identity to a pseudo-random stream change.",
                    classification="pseudo_random_stream_change",
                    **base,
                )
            )
    return diagnostics
