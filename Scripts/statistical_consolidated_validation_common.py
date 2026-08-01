"""Shared primitives for consolidated source validation."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_consolidated_io import SourceRecord


def diagnostic(
    record: SourceRecord,
    classification: str,
    code: str,
    message: str,
    path: str = "/",
) -> dict[str, Any]:
    status = {
        "version_incompatibility": "incompatible",
        "infrastructure_error": "unreadable",
    }.get(classification, "invalid")
    if record.entry["validation_status"] == "valid":
        record.entry["validation_status"] = status
    return {
        "source": record.definition.source_id,
        "json_path": path,
        "classification": classification,
        "code": code,
        "message": message,
        "consequence": "generator_failure",
    }


def available(record: SourceRecord) -> bool:
    return record.entry["validation_status"] == "valid" and isinstance(record.data, dict)


def same_identity(
    record: SourceRecord,
    actual: Any,
    expected: Any,
    path: str,
    label: str,
) -> list[dict[str, Any]]:
    if actual == expected:
        return []
    return [
        diagnostic(
            record,
            "version_incompatibility",
            "authority_incompatibility",
            f"{label} is incompatible with the referenced authority.",
            path,
        )
    ]
