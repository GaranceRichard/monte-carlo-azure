"""Semantic and cross-source validation for consolidated statistical evidence."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_consolidated_compatibility_validation import (
    validate_compatibility as _validate_compatibility,
)
from Scripts.statistical_consolidated_distribution_validation import (
    validate_calibration as _validate_calibration,
)
from Scripts.statistical_consolidated_distribution_validation import (
    validate_distribution as _validate_distribution,
)
from Scripts.statistical_consolidated_distribution_validation import (
    validate_protocol as _validate_protocol,
)
from Scripts.statistical_consolidated_exact_validation import (
    validate_exact as _validate_exact,
)
from Scripts.statistical_consolidated_io import SourceRecord
from Scripts.statistical_consolidated_parity_validation import (
    validate_parity as _validate_parity,
)
from Scripts.statistical_consolidated_validation_common import (
    available as _available,
)
from Scripts.statistical_consolidated_validation_common import (
    diagnostic as _diagnostic,
)
from Scripts.statistical_reference_corpus_validation import validate_reference_corpus
from Scripts.validate_statistical_reference_corpus import validate_contract


def _validate_corpus(record: SourceRecord) -> list[dict[str, Any]]:
    if not _available(record) or record.schema is None:
        return []
    issues = validate_reference_corpus(record.data, record.schema, validate_contract)
    return [
        _diagnostic(
            record,
            "invalid_evidence",
            "corpus_semantic_invalid",
            issue.message,
            issue.instance_path,
        )
        for issue in issues
    ]


def _validate_probes(record: SourceRecord) -> list[dict[str, Any]]:
    if not _available(record):
        return []
    identifiers = [case["id"] for case in record.data["cases"]]
    issues: list[tuple[str, str]] = []
    if len(identifiers) != 22:
        issues.append(("/cases", "Probe contract 1.0 must contain exactly 22 probes."))
    if len(set(identifiers)) != len(identifiers):
        issues.append(("/cases", "Probe identifiers must be unique."))
    return [
        _diagnostic(record, "invalid_evidence", "probe_contract_incomplete", message, path)
        for path, message in issues
    ]


def validate_sources(records: dict[str, SourceRecord]) -> list[dict[str, Any]]:
    diagnostics = _validate_corpus(records["reference_corpus"])
    diagnostics += _validate_probes(records["validation_probes"])
    diagnostics += _validate_parity(
        records["deterministic_parity"],
        records["reference_corpus"],
        records["validation_probes"],
    )
    diagnostics += _validate_exact(records["exact_replay"], records["reference_corpus"])
    diagnostics += _validate_protocol(
        records["distribution_protocol"],
        records["distribution_seed_population"],
        records["reference_corpus"],
    )
    diagnostics += _validate_calibration(
        records["distribution_calibration"], records["distribution_protocol"]
    )
    diagnostics += _validate_distribution(
        records["distribution_evidence"],
        records["distribution_protocol"],
        records["distribution_seed_population"],
    )
    diagnostics += _validate_compatibility(records["compatibility_evidence"])
    return diagnostics
