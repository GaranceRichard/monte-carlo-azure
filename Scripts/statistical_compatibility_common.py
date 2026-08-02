"""Shared closed vocabulary and canonical helpers for statistical compatibility."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

CLASSIFICATIONS = (
    "no_normative_impact",
    "compatible_without_historical_result_change",
    "compatible_contract_extension",
    "normative_result_change",
    "replay_incompatibility",
    "pseudo_random_stream_change",
    "serialized_shape_change",
    "migration_required",
    "invalidation_required",
    "decision_missing",
    "version_not_incremented",
    "corpus_or_proof_not_updated",
    "compatibility_control_error",
)

HISTORICAL_TREATMENTS = (
    "compatible_without_action",
    "deterministic_migration",
    "legacy_read_only_without_replay",
    "invalidation",
    "purge",
    "archival_with_previous_version",
    "explicit_rejection",
)

HISTORICAL_DATA_CATEGORIES = (
    "backend_history",
    "local_history",
    "runtime_caches",
    "reports_and_exports",
    "generated_proofs",
    "seeded_results",
    "replay_artifacts",
)

SURFACES = (
    "input_validation_and_normalization",
    "resolved_defaults",
    "seed_domain_and_resolution",
    "prng_algorithm",
    "draw_to_index_conversion",
    "logical_draw_order",
    "batching_behavior",
    "simulation_modes_and_stop_conditions",
    "censorship",
    "percentiles_p50_p70_p90",
    "risk_score",
    "reliability_metrics_and_labels",
    "histograms",
    "canonical_response_shape",
    "field_presence_and_absence",
    "result_serialization",
    "corpus_schema",
    "corpus_expected_results",
    "validation_probes",
    "exact_replay_protocol",
    "distributional_parity_protocol",
    "persisted_results_and_history",
    "caches_exports_and_replay_artifacts",
)


class ExtractionError(ValueError):
    """An expected semantic authority cannot be extracted unambiguously."""


def canonical_bytes(value: Any) -> bytes:
    """Encode JSON data with the one compatibility canonicalization."""

    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )


def sha256(value: Any) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def load_json(path: Path) -> Any:
    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON property: {key}")
            result[key] = value
        return result

    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates)


def json_pointer(document: Any, pointer: str) -> Any:
    if pointer == "":
        return document
    if not pointer.startswith("/"):
        raise ValueError(f"invalid JSON Pointer: {pointer}")
    current = document
    for raw_part in pointer[1:].split("/"):
        part = raw_part.replace("~1", "/").replace("~0", "~")
        if isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError) as exc:
                raise ValueError(f"missing JSON Pointer: {pointer}") from exc
        elif isinstance(current, dict) and part in current:
            current = current[part]
        else:
            raise ValueError(f"missing JSON Pointer: {pointer}")
    return current


@dataclass(frozen=True)
class CompatibilityDiagnostic:
    component: str
    previous_version: str | None
    current_version: str | None
    surface: str | None
    authority: str
    expected_fingerprint: str | None
    actual_fingerprint: str | None
    classification: str
    expected_decision: str
    declared_decision: str | None
    missing_proofs: tuple[str, ...]
    affected_data: tuple[str, ...]
    corrective_action: str
    code: str

    def as_json(self) -> dict[str, Any]:
        value = asdict(self)
        value["missing_proofs"] = list(self.missing_proofs)
        value["affected_data"] = list(self.affected_data)
        return value
