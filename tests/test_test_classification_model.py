from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "config" / "test-classification.json"
SCHEMA_PATH = ROOT / "config" / "test-classification.schema.json"
DOC_PATH = ROOT / "docs" / "test-classification.md"


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON property: {key}")
        result[key] = value
    return result


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicate_keys)


@pytest.fixture(scope="module")
def catalog() -> dict[str, Any]:
    return _load_json(CATALOG_PATH)


@pytest.fixture(scope="module")
def schema() -> dict[str, Any]:
    return _load_json(SCHEMA_PATH)


def _dimension_values(catalog: dict[str, Any], name: str) -> list[str]:
    return catalog["dimensions"][name]["values"]


def _base_record(status: str) -> dict[str, Any]:
    return {
        "logicalCaseId": "pytest:tests/test_example.py::test_behavior",
        "framework": "pytest",
        "sourcePath": "tests/test_example.py",
        "selector": "test_behavior",
        "status": status,
    }


def _validate_schema_subset(value: Any, rule: dict[str, Any], path: str = "$") -> list[str]:
    errors: list[str] = []
    expected_type = rule.get("type")
    type_matches = {
        "object": isinstance(value, dict),
        "array": isinstance(value, list),
        "string": isinstance(value, str),
    }
    if expected_type in type_matches and not type_matches[expected_type]:
        return [f"{path}: expected {expected_type}"]
    if "const" in rule and value != rule["const"]:
        errors.append(f"{path}: expected const {rule['const']!r}")
    if "enum" in rule and value not in rule["enum"]:
        errors.append(f"{path}: value is outside enum")
    if isinstance(value, str):
        if len(value) < rule.get("minLength", 0):
            errors.append(f"{path}: string is too short")
        if "pattern" in rule and re.fullmatch(rule["pattern"], value) is None:
            errors.append(f"{path}: string does not match pattern")
        if rule.get("format") == "date":
            try:
                parsed = date.fromisoformat(value)
            except ValueError:
                errors.append(f"{path}: invalid date")
            else:
                if parsed.isoformat() != value:
                    errors.append(f"{path}: date is not canonical")
    if isinstance(value, list):
        if len(value) < rule.get("minItems", 0):
            errors.append(f"{path}: array is too short")
        serialized_items = {json.dumps(item, sort_keys=True) for item in value}
        if rule.get("uniqueItems") and len(serialized_items) != len(value):
            errors.append(f"{path}: duplicate array item")
        for index, item in enumerate(value):
            errors.extend(_validate_schema_subset(item, rule.get("items", {}), f"{path}[{index}]"))
    if isinstance(value, dict):
        required = rule.get("required", [])
        for name in required:
            if name not in value:
                errors.append(f"{path}: missing {name}")
        properties = rule.get("properties", {})
        if rule.get("additionalProperties") is False:
            for name in value.keys() - properties.keys():
                errors.append(f"{path}: unknown property {name}")
        for name, item in value.items():
            if name in properties:
                errors.extend(_validate_schema_subset(item, properties[name], f"{path}.{name}"))
        for trigger, dependents in rule.get("dependentRequired", {}).items():
            if trigger in value:
                for dependent in dependents:
                    if dependent not in value:
                        errors.append(f"{path}: {trigger} requires {dependent}")
    for child in rule.get("allOf", []):
        errors.extend(_validate_schema_subset(value, child, path))
    if "if" in rule and not _validate_schema_subset(value, rule["if"], path):
        errors.extend(_validate_schema_subset(value, rule.get("then", {}), path))
    any_of_errors = [_validate_schema_subset(value, child, path) for child in rule.get("anyOf", [])]
    if any_of_errors and all(any_of_errors):
        errors.append(f"{path}: no anyOf branch matched")
    if "not" in rule and not _validate_schema_subset(value, rule["not"], path):
        errors.append(f"{path}: forbidden schema matched")
    return errors


def test_catalog_and_schema_are_valid_duplicate_free_json(
    catalog: dict[str, Any], schema: dict[str, Any]
) -> None:
    assert catalog["catalogVersion"] == "1.0.0"
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["x-schemaVersion"] == catalog["recordSchema"]["version"]
    assert catalog["standard"] == {
        "reference": "STD-TEST-001",
        "version": "1.0",
        "path": "docs/standards/STD-TEST-001.md",
    }


def test_catalog_vocabulary_matches_schema(catalog: dict[str, Any], schema: dict[str, Any]) -> None:
    properties = schema["properties"]
    for dimension in ("nature", "executionProfile", "criticality", "status", "framework"):
        field = catalog["dimensions"][dimension]["recordField"]
        assert properties[field]["enum"] == _dimension_values(catalog, dimension)
    for dimension in ("purpose", "domain"):
        field = catalog["dimensions"][dimension]["recordField"]
        assert properties[field]["items"]["enum"] == _dimension_values(catalog, dimension)


def test_vocabularies_and_cardinalities(catalog: dict[str, Any], schema: dict[str, Any]) -> None:
    assert _dimension_values(catalog, "nature") == [
        "unit",
        "component",
        "integration",
        "contract",
        "e2e",
    ]
    assert _dimension_values(catalog, "purpose") == [
        "functional",
        "security",
        "performance",
        "resilience",
        "accessibility",
        "compatibility",
        "migration_recovery",
        "observability",
        "data_quality",
    ]
    assert _dimension_values(catalog, "executionProfile") == ["pr", "main", "nightly", "release"]
    assert _dimension_values(catalog, "criticality") == ["low", "medium", "high", "critical"]
    assert _dimension_values(catalog, "status") == ["classified", "unresolved", "exempted"]
    assert _dimension_values(catalog, "framework") == ["pytest", "vitest", "playwright"]

    classified = _base_record("classified") | {
        "nature": "unit",
        "purposes": ["functional", "security"],
        "executionProfile": "pr",
        "domains": ["statistical_engine", "quality_chain"],
    }
    assert _validate_schema_subset(classified, schema) == []
    assert any("duplicate array item" in error for error in _validate_schema_subset(
        classified | {"purposes": ["functional", "functional"]}, schema
    ))
    assert any("unknown property" in error for error in _validate_schema_subset(
        classified | {"gateLevel": "targeted"}, schema
    ))


def test_domains_cover_stable_product_architecture(catalog: dict[str, Any]) -> None:
    assert set(_dimension_values(catalog, "domain")) >= {
        "identity",
        "azure_devops",
        "data",
        "statistical_engine",
        "api",
        "history",
        "persistence",
        "portfolio",
        "reporting",
        "user_interface",
        "deployment",
        "quality_chain",
    }


def test_classified_status_requires_nature_purpose_and_profile(schema: dict[str, Any]) -> None:
    record = _base_record("classified") | {
        "nature": "component",
        "purposes": ["functional"],
        "executionProfile": "main",
    }
    assert _validate_schema_subset(record, schema) == []
    for required in ("nature", "purposes", "executionProfile"):
        invalid = record.copy()
        invalid.pop(required)
        errors = _validate_schema_subset(invalid, schema)
        assert any(f"missing {required}" in error for error in errors)


def test_unresolved_status_requires_reason(schema: dict[str, Any]) -> None:
    record = _base_record("unresolved") | {
        "unresolvedReason": "The actual external boundary cannot yet be established."
    }
    assert _validate_schema_subset(record, schema) == []
    assert any("missing unresolvedReason" in error for error in _validate_schema_subset(
        _base_record("unresolved"), schema
    ))


def test_exempted_status_requires_governance_and_expiration(schema: dict[str, Any]) -> None:
    record = _base_record("exempted") | {
        "exemption": {
            "justification": "Temporary migration exception.",
            "owner": "quality-owner",
            "approver": "technical-lead",
            "expiresOn": "2026-08-31",
        }
    }
    assert _validate_schema_subset(record, schema) == []
    for required in ("justification", "owner", "approver", "expiresOn"):
        invalid = json.loads(json.dumps(record))
        invalid["exemption"].pop(required)
        errors = _validate_schema_subset(invalid, schema)
        assert any(f"missing {required}" in error for error in errors)


@pytest.mark.parametrize(
    ("field", "valid", "invalid"),
    [
        ("risks", "RISK-999", "RISK-99"),
        ("criticalPaths", "CP-999", "CP-1000"),
    ],
)
def test_risk_and_critical_path_formats_require_criticality(
    schema: dict[str, Any], field: str, valid: str, invalid: str
) -> None:
    record = _base_record("classified") | {
        "nature": "contract",
        "purposes": ["functional"],
        "executionProfile": "pr",
        "criticality": "critical",
        field: [valid],
    }
    assert _validate_schema_subset(record, schema) == []
    assert any("does not match pattern" in error for error in _validate_schema_subset(
        record | {field: [invalid]}, schema
    ))
    without_criticality = record.copy()
    without_criticality.pop("criticality")
    assert any("requires criticality" in error for error in _validate_schema_subset(
        without_criticality, schema
    ))


def test_execution_profiles_do_not_mix_with_quality_gate_levels(
    catalog: dict[str, Any], schema: dict[str, Any]
) -> None:
    profiles = set(_dimension_values(catalog, "executionProfile"))
    gate_levels = set(catalog["nonClassificationConcepts"]["qualityGateLevels"])
    assert gate_levels == {"targeted", "impacted", "massive"}
    assert profiles.isdisjoint(gate_levels)
    assert gate_levels.isdisjoint(schema["properties"]["executionProfile"]["enum"])
    assert "gateLevel" not in schema["properties"]


def test_documentation_states_essential_rules() -> None:
    documentation = " ".join(DOC_PATH.read_text(encoding="utf-8").split())
    required_phrases = [
        "Une seule nature",
        "périmètre maximal réellement exécuté",
        "Le comportement observé prime",
        "métadonnée qui contredit",
        "Toute nouvelle ambiguïté fait échouer la gate",
        "Les fixtures, helpers et données de test ne sont pas des cas logiques autonomes",
        "plusieurs instances exécutées, pas plusieurs cas logiques",
        "`targeted`, `impacted` et `massive`",
        "strictement en lecture seule",
        "compare sa sérialisation exacte",
        "`unresolved = 0`",
        "run-coverage-staged.ps1",
    ]
    for phrase in required_phrases:
        assert phrase in documentation, f"Missing classification rule in documentation: {phrase}"
