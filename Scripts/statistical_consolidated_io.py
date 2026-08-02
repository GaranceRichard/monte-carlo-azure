"""Deterministic loading and structural validation for statistical evidence."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from Scripts.statistical_compatibility_evidence import (
    evidence_fingerprint as compatibility_fingerprint,
)
from Scripts.statistical_consolidated_source_catalog import (
    SOURCE_DEFINITIONS,
    SourceDefinition,
)
from Scripts.statistical_distribution_calibration import verify_calibration_fingerprint
from Scripts.statistical_distribution_runner import verify_artifact_fingerprint

ROOT = Path(__file__).resolve().parents[1]


@dataclass
class SourceRecord:
    definition: SourceDefinition
    entry: dict[str, Any]
    data: Any = None
    schema: dict[str, Any] | None = None


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _diagnostic(
    source: str,
    classification: str,
    code: str,
    message: str,
    path: str = "/",
) -> dict[str, Any]:
    return {
        "source": source,
        "json_path": path,
        "classification": classification,
        "code": code,
        "message": message,
        "consequence": "generator_failure",
    }


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON property: {key}")
        result[key] = value
    return result


def _json(raw: bytes) -> Any:
    return json.loads(raw.decode("utf-8"), object_pairs_hook=_reject_duplicates)


def _nested(value: Any, path: tuple[str, ...]) -> Any:
    current = value
    for part in path:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _version(value: Any) -> str | None:
    if type(value) is int:
        return f"{value}.0"
    return value if isinstance(value, str) else None


def _pointer(parts: Any) -> str:
    escaped = [str(part).replace("~", "~0").replace("/", "~1") for part in parts]
    return "/" + "/".join(escaped) if escaped else "/"


def _source_entry(definition: SourceDefinition) -> dict[str, Any]:
    schema_id = (
        "STD-STAT-001-document-header"
        if definition.source_id == "normative_standard"
        else "mca-prng-v1-vector-contract"
        if definition.source_id == "prng_vectors"
        else None
    )
    return {
        "id": definition.source_id,
        "kind": definition.kind,
        "path": definition.path,
        "required": True,
        "declared": {"id": None, "version": None},
        "schema": {
            "id": schema_id,
            "version": definition.expected_version,
            "path": definition.schema_path,
            "sha256": None,
        },
        "sha256": None,
        "canonical_fingerprint": None,
        "fingerprint_valid": None,
        "validation_status": "valid",
    }


def _read(
    root: Path,
    definition: SourceDefinition,
    entry: dict[str, Any],
    source_path: str,
) -> tuple[bytes | None, list[dict[str, Any]]]:
    try:
        raw = (root / source_path).read_bytes()
    except FileNotFoundError:
        entry["validation_status"] = "missing"
        return None, [
            _diagnostic(
                definition.source_id,
                "invalid_evidence",
                "source_missing",
                "Required source is missing.",
            )
        ]
    except OSError:
        entry["validation_status"] = "unreadable"
        return None, [
            _diagnostic(
                definition.source_id,
                "infrastructure_error",
                "source_unreadable",
                "Required source cannot be read.",
            )
        ]
    entry["sha256"] = sha256_bytes(raw)
    return raw, []


def _load_schema(root: Path, record: SourceRecord) -> list[dict[str, Any]]:
    schema_path = record.definition.schema_path
    if schema_path is None:
        return []
    try:
        raw = (root / schema_path).read_bytes()
        schema = _json(raw)
        Draft202012Validator.check_schema(schema)
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError, SchemaError):
        record.entry["validation_status"] = "invalid"
        return [
            _diagnostic(
                record.definition.source_id,
                "invalid_evidence",
                "schema_invalid",
                "Source schema is missing, unreadable, or invalid.",
            )
        ]
    record.schema = schema
    record.entry["schema"].update({"id": schema.get("$id"), "sha256": sha256_bytes(raw)})
    return []


def _schema_diagnostics(record: SourceRecord) -> list[dict[str, Any]]:
    if record.schema is None:
        return []
    errors = sorted(
        Draft202012Validator(record.schema).iter_errors(record.data),
        key=lambda error: (list(error.absolute_path), error.message),
    )
    if errors and record.entry["validation_status"] == "valid":
        record.entry["validation_status"] = "invalid"
    return [
        _diagnostic(
            record.definition.source_id,
            "invalid_evidence",
            "schema_violation",
            error.message,
            _pointer(error.absolute_path),
        )
        for error in errors
    ]


def _identity_diagnostics(record: SourceRecord) -> list[dict[str, Any]]:
    definition = record.definition
    declared_id = (
        _nested(record.data, definition.id_path) if definition.id_path else definition.expected_id
    )
    declared_version = _version(_nested(record.data, definition.version_path))
    record.entry["declared"] = {"id": declared_id, "version": declared_version}
    if declared_id != definition.expected_id:
        record.entry["validation_status"] = "incompatible"
        return [
            _diagnostic(
                definition.source_id,
                "version_incompatibility",
                "identity_incompatibility",
                "Source identity is incompatible with the consolidated format.",
            )
        ]
    if declared_version == definition.expected_version:
        return []
    if definition.stale_version:
        record.entry["validation_status"] = "stale"
        return [
            _diagnostic(
                definition.source_id,
                "invalid_evidence",
                "stale_source",
                "Source evidence format is stale.",
            )
        ]
    record.entry["validation_status"] = "incompatible"
    return [
        _diagnostic(
            definition.source_id,
            "version_incompatibility",
            "version_incompatibility",
            "Source version is incompatible with the consolidated format.",
        )
    ]


def _embedded_fingerprint(record: SourceRecord) -> list[dict[str, Any]]:
    data = record.data
    if record.definition.source_id == "distribution_calibration":
        fingerprint = data.get("stability", {}).get("artifact_fingerprint")
        valid = verify_calibration_fingerprint(data)
    elif record.definition.source_id == "distribution_evidence":
        fingerprint = data.get("stability", {}).get("artifact_fingerprint")
        valid = verify_artifact_fingerprint(data)
    elif record.definition.source_id == "distribution_seed_population":
        fingerprint = data.get("population_fingerprint")
        valid = None
    elif record.definition.source_id == "compatibility_evidence":
        fingerprint = data.get("stability", {}).get("artifact_fingerprint")
        valid = fingerprint == compatibility_fingerprint(data)
    else:
        return []
    record.entry["canonical_fingerprint"] = fingerprint
    record.entry["fingerprint_valid"] = valid
    if valid is not False:
        return []
    if record.entry["validation_status"] == "valid":
        record.entry["validation_status"] = "invalid"
    return [
        _diagnostic(
            record.definition.source_id,
            "invalid_evidence",
            "fingerprint_invalid",
            "Embedded canonical fingerprint is invalid.",
            "/stability/artifact_fingerprint",
        )
    ]


def _load_standard(raw: bytes, record: SourceRecord) -> list[dict[str, Any]]:
    text = raw.decode("utf-8")
    reference = re.search(r"^\*\*Référence :\*\*\s*(.+)$", text, re.MULTILINE)
    version = re.search(r"^\*\*Version :\*\*\s*(.+)$", text, re.MULTILINE)
    record.data = text
    record.entry["declared"] = {
        "id": reference.group(1).strip() if reference else None,
        "version": version.group(1).strip() if version else None,
    }
    if record.entry["declared"] == {"id": "STD-STAT-001", "version": "1.0"}:
        return []
    record.entry["validation_status"] = "incompatible"
    return [
        _diagnostic(
            record.definition.source_id,
            "version_incompatibility",
            "standard_header_incompatible",
            "Normative standard header is missing or incompatible.",
        )
    ]


def load_sources(
    root: Path = ROOT,
    source_paths: dict[str, str] | None = None,
) -> tuple[dict[str, SourceRecord], list[dict[str, Any]]]:
    records: dict[str, SourceRecord] = {}
    diagnostics: list[dict[str, Any]] = []
    for definition in SOURCE_DEFINITIONS:
        record = SourceRecord(definition, _source_entry(definition))
        records[definition.source_id] = record
        source_path = (source_paths or {}).get(definition.source_id, definition.path)
        raw, read_diagnostics = _read(root, definition, record.entry, source_path)
        diagnostics.extend(read_diagnostics)
        if raw is None:
            continue
        try:
            if definition.source_id == "normative_standard":
                diagnostics.extend(_load_standard(raw, record))
                continue
            record.data = _json(raw)
        except (UnicodeError, ValueError, json.JSONDecodeError):
            record.entry["validation_status"] = "invalid"
            diagnostics.append(
                _diagnostic(
                    definition.source_id,
                    "invalid_evidence",
                    "source_corrupt",
                    "Source is not valid canonical JSON.",
                )
            )
            continue
        diagnostics.extend(_identity_diagnostics(record))
        diagnostics.extend(_load_schema(root, record))
        diagnostics.extend(_schema_diagnostics(record))
        diagnostics.extend(_embedded_fingerprint(record))
    return records, diagnostics
