"""Validate the versioned test-classification catalog and record schema."""

from __future__ import annotations

from typing import Any

from Scripts.test_classification_contract import (
    DIMENSION_FIELDS,
    EXPECTED_CARDINALITIES,
    RECORD_FIELDS,
    unique_string_errors,
    unknown_properties,
)

SCHEMA_PATH = "config/test-classification.schema.json"
SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema"
EXEMPTION_FIELDS = {"justification", "owner", "approver", "expiresOn"}


def validate_catalog(catalog: Any, schema: Any) -> list[str]:
    if not isinstance(catalog, dict) or not isinstance(schema, dict):
        return ["catalog and schema must be JSON objects"]
    errors = _catalog_top_level_errors(catalog, schema)
    dimensions = catalog.get("dimensions")
    properties = schema.get("properties")
    if not isinstance(dimensions, dict) or not isinstance(properties, dict):
        return errors + ["catalog dimensions and schema properties must be objects"]
    errors.extend(_dimension_set_errors(dimensions, properties, schema))
    errors.extend(_dimension_errors(dimensions, properties))
    errors.extend(_identifier_errors(catalog, properties))
    errors.extend(_exemption_schema_errors(properties))
    errors.extend(_status_schema_errors(schema))
    errors.extend(_resolution_rule_errors(catalog.get("resolutionRules")))
    return errors


def _catalog_top_level_errors(
    catalog: dict[str, Any], schema: dict[str, Any]
) -> list[str]:
    allowed = {
        "catalogVersion",
        "recordSchema",
        "standard",
        "dimensions",
        "identifierFormats",
        "resolutionRules",
        "nonClassificationConcepts",
    }
    errors = unknown_properties(catalog, allowed, "catalog")
    record_schema = catalog.get("recordSchema")
    valid_version = (
        catalog.get("catalogVersion") == "1.0.0"
        and isinstance(record_schema, dict)
        and record_schema.get("version") == "1.0.0"
        and record_schema.get("path") == SCHEMA_PATH
        and record_schema.get("draft") == SCHEMA_DRAFT
        and schema.get("$schema") == SCHEMA_DRAFT
        and schema.get("x-schemaVersion") == record_schema.get("version")
    )
    if not valid_version:
        errors.append("catalog and schema versions do not match the 1.0.0 contract")
    return errors


def _dimension_set_errors(
    dimensions: dict[str, Any], properties: dict[str, Any], schema: dict[str, Any]
) -> list[str]:
    errors: list[str] = []
    if set(dimensions) != set(DIMENSION_FIELDS):
        errors.append("catalog dimensions do not match the classification contract")
    if set(properties) != RECORD_FIELDS:
        errors.append("schema record properties do not match the classification contract")
    if schema.get("additionalProperties") is not False:
        errors.append("schema must reject unknown record properties")
    expected_required = {"logicalCaseId", "framework", "sourcePath", "selector", "status"}
    if set(schema.get("required", [])) != expected_required:
        errors.append("schema required identity fields do not match the contract")
    return errors


def _dimension_errors(
    dimensions: dict[str, Any], properties: dict[str, Any]
) -> list[str]:
    errors: list[str] = []
    for dimension, field in DIMENSION_FIELDS.items():
        errors.extend(
            _one_dimension_errors(
                dimension,
                field,
                dimensions.get(dimension),
                properties.get(field),
            )
        )
    return errors


def _one_dimension_errors(
    dimension: str, field: str, definition: Any, property_rule: Any
) -> list[str]:
    if not isinstance(definition, dict):
        return [f"catalog dimension {dimension} must be an object"]
    errors = unknown_properties(
        definition, {"recordField", "cardinality", "values"}, dimension
    )
    if definition.get("recordField") != field:
        errors.append(f"catalog dimension {dimension} targets the wrong field")
    if definition.get("cardinality") != EXPECTED_CARDINALITIES[dimension]:
        errors.append(f"catalog dimension {dimension} has invalid cardinality")
    errors.extend(unique_string_errors(definition.get("values"), f"{dimension}.values"))
    if not isinstance(property_rule, dict):
        return errors + [f"schema property {field} must be an object"]
    schema_values = _schema_values(property_rule, field)
    if schema_values != definition.get("values"):
        errors.append(f"catalog/schema vocabulary mismatch for {dimension}")
    if field in {"purposes", "domains"} and not _valid_array_cardinality(property_rule):
        errors.append(f"schema {field} has invalid cardinality")
    return errors


def _schema_values(property_rule: dict[str, Any], field: str) -> Any:
    if field in {"purposes", "domains"}:
        return property_rule.get("items", {}).get("enum")
    return property_rule.get("enum")


def _valid_array_cardinality(property_rule: dict[str, Any]) -> bool:
    return (
        property_rule.get("type") == "array"
        and property_rule.get("minItems") == 1
        and property_rule.get("uniqueItems") is True
    )


def _identifier_errors(
    catalog: dict[str, Any], properties: dict[str, Any]
) -> list[str]:
    errors: list[str] = []
    expected_formats = {"risk": "^RISK-[0-9]{3}$", "criticalPath": "^CP-[0-9]{3}$"}
    if catalog.get("identifierFormats") != expected_formats:
        errors.append("catalog identifier formats do not match RISK-999 and CP-999")
    patterns = {"risks": "^RISK-[0-9]{3}$", "criticalPaths": "^CP-[0-9]{3}$"}
    for field, expected in patterns.items():
        actual = properties.get(field, {}).get("items", {}).get("pattern")
        if actual != expected:
            errors.append(f"schema {field} format does not match the contract")
    return errors


def _exemption_schema_errors(properties: dict[str, Any]) -> list[str]:
    exemption = properties.get("exemption")
    valid = (
        isinstance(exemption, dict)
        and exemption.get("additionalProperties") is False
        and set(exemption.get("required", [])) == EXEMPTION_FIELDS
        and set(exemption.get("properties", {})) == EXEMPTION_FIELDS
        and exemption.get("properties", {}).get("expiresOn", {}).get("format") == "date"
    )
    return [] if valid else ["schema exemption governance does not match the contract"]


def _status_schema_errors(schema: dict[str, Any]) -> list[str]:
    blocks = _status_blocks(schema.get("allOf", []))
    expected = {
        "classified": {"nature", "purposes", "executionProfile"},
        "unresolved": {"unresolvedReason"},
        "exempted": {"exemption"},
    }
    if set(blocks) != set(expected):
        return ["schema status rules do not cover classified, unresolved, and exempted"]
    return [
        f"schema {status} status has incomplete required fields"
        for status, required in expected.items()
        if not required <= set(blocks[status].get("required", []))
    ]


def _status_blocks(values: Any) -> dict[str, dict[str, Any]]:
    blocks: dict[str, dict[str, Any]] = {}
    if not isinstance(values, list):
        return blocks
    for block in values:
        if not isinstance(block, dict):
            continue
        status = block.get("if", {}).get("properties", {}).get("status", {}).get("const")
        if isinstance(status, str) and isinstance(block.get("then"), dict):
            blocks[status] = block["then"]
    return blocks


def _resolution_rule_errors(value: Any) -> list[str]:
    if not isinstance(value, list):
        return ["catalog resolutionRules must be an array"]
    identifiers = [item.get("id") for item in value if isinstance(item, dict)]
    if len(identifiers) != len(value) or len(identifiers) != len(set(identifiers)):
        return ["catalog resolution rules must have unique identifiers"]
    return []
