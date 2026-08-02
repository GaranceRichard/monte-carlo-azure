"""Cross-check specialized statistical compatibility evidence."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_compatibility_evidence import validate_evidence
from Scripts.statistical_consolidated_io import SourceRecord
from Scripts.statistical_consolidated_validation_common import available, diagnostic


def validate_compatibility(record: SourceRecord) -> list[dict[str, Any]]:
    if not available(record) or record.schema is None:
        return []
    issues = validate_evidence(record.data, record.schema)
    diagnostics = [
        diagnostic(
            record,
            "invalid_evidence",
            "compatibility_evidence_invalid",
            issue,
            "/",
        )
        for issue in issues
    ]
    if issues:
        return diagnostics
    if record.data["status"] == "blocked":
        diagnostics.append(
            diagnostic(
                record,
                "version_incompatibility",
                "compatibility_blocked",
                "The blocking compatibility control reports an undecided statistical drift.",
                "/status",
            )
        )
    elif record.data["status"] == "control_error":
        diagnostics.append(
            diagnostic(
                record,
                "invalid_evidence",
                "compatibility_control_error",
                "The compatibility control could not evaluate all required authorities.",
                "/status",
            )
        )
    return diagnostics
