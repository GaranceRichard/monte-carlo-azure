"""Shared record-contract validation for classification generation and compliance."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any

DIMENSION_FIELDS = {
    "nature": "nature",
    "purpose": "purposes",
    "executionProfile": "executionProfile",
    "criticality": "criticality",
    "status": "status",
    "framework": "framework",
    "domain": "domains",
}
EXPECTED_CARDINALITIES = {
    "nature": {"minimum": 1, "maximum": 1, "requiredForStatuses": ["classified"]},
    "purpose": {
        "minimum": 1,
        "maximum": None,
        "requiredForStatuses": ["classified"],
        "unique": True,
    },
    "executionProfile": {
        "minimum": 1,
        "maximum": 1,
        "requiredForStatuses": ["classified"],
    },
    "criticality": {
        "minimum": 0,
        "maximum": 1,
        "requiredWhenAnyFieldPresent": ["risks", "criticalPaths"],
    },
    "status": {"minimum": 1, "maximum": 1, "requiredForAllRecords": True},
    "framework": {"minimum": 1, "maximum": 1, "requiredForAllRecords": True},
    "domain": {"minimum": 0, "maximum": None, "unique": True},
}
RECORD_FIELDS = {
    "logicalCaseId",
    "framework",
    "sourcePath",
    "selector",
    "status",
    "nature",
    "purposes",
    "executionProfile",
    "domains",
    "criticality",
    "risks",
    "criticalPaths",
    "unresolvedReason",
    "exemption",
}
LIST_FIELDS = ("purposes", "domains", "risks", "criticalPaths")
REQUIRED_RECORD_FIELDS = {
    "logicalCaseId",
    "framework",
    "sourcePath",
    "selector",
    "status",
}


@dataclass(frozen=True)
class RecordIssue:
    engine_message: str | None
    compliance_message: str | None


def unknown_properties(mapping: dict[str, Any], allowed: set[str], label: str) -> list[str]:
    unknown = sorted(set(mapping) - allowed)
    return [f"{label}: unknown properties: {', '.join(unknown)}"] if unknown else []


def unique_string_errors(
    value: Any, label: str, *, allow_empty: bool = False
) -> list[str]:
    if not isinstance(value, list) or (not value and not allow_empty):
        qualifier = "possibly empty " if allow_empty else "non-empty "
        return [f"{label}: expected a {qualifier}array"]
    if any(not isinstance(item, str) or not item.strip() for item in value):
        return [f"{label}: values must be non-empty strings"]
    if len(value) != len(set(value)):
        return [f"{label}: duplicate values"]
    return []


def validate_exemption(value: Any, label: str, today: date) -> list[str]:
    if not isinstance(value, dict):
        return [f"{label} must be an object"]
    required = {"justification", "owner", "approver", "expiresOn"}
    errors = unknown_properties(value, required, label)
    missing = required - set(value)
    if missing:
        errors.append(f"{label} missing: {', '.join(sorted(missing))}")
    errors.extend(_approval_field_errors(value, label, required - {"expiresOn"}))
    errors.extend(_expiration_errors(value.get("expiresOn"), label, today))
    return errors


def _approval_field_errors(
    value: dict[str, Any], label: str, fields: set[str]
) -> list[str]:
    return [
        f"{label}.{field} must be a non-empty approval field"
        for field in sorted(fields)
        if not isinstance(value.get(field), str) or not value[field].strip()
    ]


def _expiration_errors(value: Any, label: str, today: date) -> list[str]:
    try:
        expires_on = date.fromisoformat(value)
    except (TypeError, ValueError):
        return [f"{label}.expiresOn must be a canonical ISO date"]
    if expires_on.isoformat() != value:
        return [f"{label}.expiresOn must be a canonical ISO date"]
    if expires_on < today:
        return [f"{label} expired on {expires_on.isoformat()}"]
    return []


def _schema_issues(
    record: dict[str, Any], allowed: set[str], required: set[str]
) -> list[RecordIssue]:
    issues: list[RecordIssue] = []
    missing = required - set(record)
    if missing:
        fields = ", ".join(sorted(missing))
        issues.append(RecordIssue(f"missing required fields: {fields}", None))
    unknown = set(record) - allowed
    if unknown:
        fields = ", ".join(sorted(unknown))
        issues.append(
            RecordIssue(
                f"unknown fields: {fields}",
                f"{{label}}: unknown properties: {fields}",
            )
        )
    return issues


def _required_text_issues(record: dict[str, Any]) -> list[RecordIssue]:
    return [
        RecordIssue(None, f"{{label}}.{field} must be a non-empty string")
        for field in ("logicalCaseId", "framework", "sourcePath", "selector", "status")
        if not isinstance(record.get(field), str) or not record[field].strip()
    ]


def _invalid_multiple_reason(value: Any, allowed: list[str]) -> str | None:
    if not isinstance(value, list) or not value:
        return "expected a non-empty array"
    if any(not isinstance(item, str) or not item.strip() for item in value):
        return "values must be non-empty strings"
    if len(value) != len(set(value)):
        return "duplicate values"
    if any(item not in allowed for item in value):
        return "is outside the catalog vocabulary"
    return None


def _catalog_value_issues(
    record: dict[str, Any], catalog: dict[str, Any]
) -> list[RecordIssue]:
    mappings = {
        "framework": ("framework", False),
        "nature": ("nature", False),
        "purposes": ("purpose", True),
        "executionProfile": ("executionProfile", False),
        "domains": ("domain", True),
        "criticality": ("criticality", False),
        "status": ("status", False),
    }
    issues: list[RecordIssue] = []
    for field, (dimension, multiple) in mappings.items():
        if field not in record:
            continue
        allowed = catalog.get("dimensions", {}).get(dimension, {}).get("values", [])
        reason = (
            _invalid_multiple_reason(record[field], allowed)
            if multiple
            else None
            if record[field] in allowed
            else "is outside the catalog vocabulary"
        )
        if reason:
            issues.append(
                RecordIssue(
                    f"{field} has invalid values",
                    f"{{label}}.{field} {reason}",
                )
            )
    return issues


def _supplemental_list_issues(record: dict[str, Any]) -> list[RecordIssue]:
    issues: list[RecordIssue] = []
    for field in ("risks", "criticalPaths"):
        if field not in record:
            continue
        errors = unique_string_errors(record[field], f"{{label}}.{field}")
        issues.extend(RecordIssue(None, error) for error in errors)
    return issues


def _traceability_issues(record: dict[str, Any]) -> list[RecordIssue]:
    issues: list[RecordIssue] = []
    for field, pattern in (("risks", r"RISK-[0-9]{3}"), ("criticalPaths", r"CP-[0-9]{3}")):
        values = record.get(field)
        invalid = isinstance(values, list) and any(
            not isinstance(value, str) or re.fullmatch(pattern, value) is None
            for value in values
        )
        if invalid:
            issues.append(
                RecordIssue(
                    f"{field} has invalid identifiers",
                    f"{{label}}.{field} contains an invalid identifier",
                )
            )
        if field in record and "criticality" not in record:
            issues.append(
                RecordIssue(
                    f"{field} requires criticality",
                    f"{{label}}.{field} requires criticality",
                )
            )
    return issues


def _status_issues(record: dict[str, Any]) -> list[RecordIssue]:
    status = record.get("status")
    if status == "classified":
        return _classified_status_issues(record)
    if status == "unresolved":
        return _unresolved_status_issues(record)
    if status == "exempted":
        return _exempted_status_issues(record)
    return []


def _classified_status_issues(record: dict[str, Any]) -> list[RecordIssue]:
    issues: list[RecordIssue] = []
    missing = {"nature", "purposes", "executionProfile"} - set(record)
    if missing:
        fields = ", ".join(sorted(missing))
        issues.append(
            RecordIssue(
                "classified records require nature, purposes and executionProfile",
                f"{{label}} classified status missing: {fields}",
            )
        )
    if "unresolvedReason" in record or "exemption" in record:
        issues.append(
            RecordIssue(
                "classified records cannot contain unresolvedReason or exemption",
                "{label} classified status contains incompatible metadata",
            )
        )
    return issues


def _unresolved_status_issues(record: dict[str, Any]) -> list[RecordIssue]:
    issues: list[RecordIssue] = []
    reason = record.get("unresolvedReason")
    if not isinstance(reason, str) or not reason.strip():
        issues.append(
            RecordIssue(
                "unresolved records require unresolvedReason",
                "{label} unresolved status requires a reason",
            )
        )
    if "exemption" in record:
        issues.append(
            RecordIssue(
                "unresolved records cannot contain exemption",
                "{label} unresolved status cannot contain an exemption",
            )
        )
    return issues


def _exempted_status_issues(record: dict[str, Any]) -> list[RecordIssue]:
    issues: list[RecordIssue] = []
    if not record.get("exemption"):
        issues.append(RecordIssue("exempted records require exemption", None))
    if "unresolvedReason" in record:
        issues.append(
            RecordIssue(
                "exempted records cannot contain unresolvedReason",
                "{label} exempted status cannot contain an unresolved reason",
            )
        )
    return issues


def _identity_issues(record: dict[str, Any]) -> list[RecordIssue]:
    fields = ("framework", "sourcePath", "selector")
    if not all(isinstance(record.get(field), str) for field in fields):
        return []
    expected = f"{record['framework']}:{record['sourcePath']}::{record['selector']}"
    if record.get("logicalCaseId") == expected:
        return []
    return [
        RecordIssue(
            None,
            "{label}.logicalCaseId contradicts its framework, path, or selector",
        )
    ]


def _render(issues: list[RecordIssue], attribute: str, label: str = "") -> list[str]:
    messages = [getattr(issue, attribute) for issue in issues]
    return [message.format(label=label) for message in messages if message is not None]


def validate_record_engine(
    record: dict[str, Any], catalog: dict[str, Any], schema: dict[str, Any]
) -> list[str]:
    issues = _catalog_value_issues(record, catalog)
    issues.extend(_status_issues(record))
    issues.extend(
        _schema_issues(record, set(schema["properties"]), set(schema["required"]))
    )
    issues.extend(_traceability_issues(record))
    return _render(issues, "engine_message")


def validate_record_compliance(
    record: Any, catalog: dict[str, Any], label: str, today: date
) -> list[str]:
    if not isinstance(record, dict):
        return [f"{label} must be an object"]
    issues = _schema_issues(record, RECORD_FIELDS, REQUIRED_RECORD_FIELDS)
    issues.extend(_required_text_issues(record))
    issues.extend(_catalog_value_issues(record, catalog))
    issues.extend(_supplemental_list_issues(record))
    issues.extend(_traceability_issues(record))
    issues.extend(_identity_issues(record))
    issues.extend(_status_issues(record))
    errors = _render(issues, "compliance_message", label)
    if record.get("status") == "exempted":
        errors.extend(validate_exemption(record.get("exemption"), f"{label}.exemption", today))
    return errors
