"""Orchestrate read-only repository compliance for test classification."""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from datetime import date
from pathlib import Path
from typing import Any

from Scripts.test_classification_catalog_validation import validate_catalog
from Scripts.test_classification_inventory_validation import (
    execution_fingerprint_errors,
    generated_inventory_errors,
    inventory_bytes,
    inventory_identity_errors,
    load_json,
    validate_versioned_records,
)
from Scripts.test_classification_overrides_validation import validate_overrides
from Scripts.test_classification_rules_validation import validate_match, validate_rules
from Scripts.test_classifier_discovery import LogicalCase, discover_all
from Scripts.test_execution_profiles import build_plan_report
from Scripts.test_execution_profiles_validation import validate_contract, validate_inventory

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = Path("config/test-classification.json")
SCHEMA_PATH = Path("config/test-classification.schema.json")
RULES_PATH = Path("config/test-classification-rules.json")
OVERRIDES_PATH = Path("config/test-classification-overrides.json")
INVENTORY_PATH = Path("reports/test-classification-inventory.json")
EXECUTION_REPORT_PATH = Path("reports/test-execution-counts.json")
EXECUTION_PROFILES_PATH = Path("config/test-execution-profiles.json")
EXECUTION_PROFILES_SCHEMA_PATH = Path("config/test-execution-profiles.schema.json")
ARTIFACT_PATHS = (
    CATALOG_PATH,
    SCHEMA_PATH,
    RULES_PATH,
    OVERRIDES_PATH,
    INVENTORY_PATH,
    EXECUTION_REPORT_PATH,
    EXECUTION_PROFILES_PATH,
    EXECUTION_PROFILES_SCHEMA_PATH,
)


def validate_repository(
    root: Path = ROOT,
    *,
    node_command: str = "node",
    today: date | None = None,
    discoverer: Callable[[Path, str], list[LogicalCase]] = discover_all,
) -> list[str]:
    root = root.resolve()
    artifacts, errors = _load_artifacts(root)
    cases, discovery_errors = _discover_cases(root, node_command, discoverer)
    errors.extend(discovery_errors)
    errors.extend(_contract_errors(artifacts, cases, today or date.today()))
    records, record_errors = validate_versioned_records(
        artifacts[INVENTORY_PATH], artifacts[CATALOG_PATH], today or date.today()
    )
    errors.extend(record_errors)
    errors.extend(_execution_profile_errors(artifacts))
    errors.extend(inventory_identity_errors(cases, records))
    errors.extend(_generation_errors(root, artifacts, cases))
    errors.extend(
        execution_fingerprint_errors(
            root, INVENTORY_PATH, artifacts[EXECUTION_REPORT_PATH]
        )
    )
    return errors


def _execution_profile_errors(artifacts: dict[Path, Any]) -> list[str]:
    contract = artifacts[EXECUTION_PROFILES_PATH]
    schema = artifacts[EXECUTION_PROFILES_SCHEMA_PATH]
    inventory = artifacts[INVENTORY_PATH]
    errors = validate_contract(contract) + validate_inventory(inventory)
    if not isinstance(contract, dict) or not isinstance(schema, dict):
        return errors
    if schema.get("x-schemaVersion") != contract.get("schemaVersion"):
        errors.append("execution-profile contract and schema versions differ")
    if errors or not isinstance(inventory, list):
        return errors
    first = build_plan_report(contract, inventory)
    if first != build_plan_report(contract, inventory):
        errors.append("execution-profile plans are not deterministic")
    return errors


def _load_artifacts(root: Path) -> tuple[dict[Path, Any], list[str]]:
    artifacts: dict[Path, Any] = {}
    errors: list[str] = []
    for relative in ARTIFACT_PATHS:
        try:
            artifacts[relative] = load_json(root / relative)
        except ValueError as exc:
            errors.append(str(exc))
            artifacts[relative] = None
    return artifacts, errors


def _discover_cases(
    root: Path,
    node_command: str,
    discoverer: Callable[[Path, str], list[LogicalCase]],
) -> tuple[list[LogicalCase], list[str]]:
    try:
        return discoverer(root, node_command), []
    except (OSError, RuntimeError, SyntaxError, ValueError) as exc:
        return [], [f"logical test discovery failed: {exc}"]


def _contract_errors(
    artifacts: dict[Path, Any], cases: list[LogicalCase], current_date: date
) -> list[str]:
    catalog = artifacts[CATALOG_PATH]
    errors = validate_catalog(catalog, artifacts[SCHEMA_PATH])
    if not isinstance(catalog, dict):
        return errors
    errors.extend(validate_rules(artifacts[RULES_PATH], catalog))
    errors.extend(validate_overrides(artifacts[OVERRIDES_PATH], cases, catalog, current_date))
    return errors


def _generation_errors(
    root: Path, artifacts: dict[Path, Any], cases: list[LogicalCase]
) -> list[str]:
    return generated_inventory_errors(
        root,
        INVENTORY_PATH,
        cases,
        artifacts[CATALOG_PATH],
        artifacts[SCHEMA_PATH],
        artifacts[RULES_PATH],
        artifacts[OVERRIDES_PATH],
    )


def compliance_summary(root: Path) -> str:
    root = root.resolve()
    inventory = load_json(root / INVENTORY_PATH)
    frameworks = Counter(record["framework"] for record in inventory)
    overrides = load_json(root / OVERRIDES_PATH)
    exemptions = sum(record["status"] == "exempted" for record in inventory)
    return (
        "Test classification compliance passed: "
        f"cases={len(inventory)}, frameworks={dict(sorted(frameworks.items()))}, "
        f"unresolved=0, overrides={len(overrides['overrides'])}, exemptions={exemptions}."
    )


__all__ = [
    "CATALOG_PATH",
    "SCHEMA_PATH",
    "RULES_PATH",
    "OVERRIDES_PATH",
    "INVENTORY_PATH",
    "EXECUTION_REPORT_PATH",
    "EXECUTION_PROFILES_PATH",
    "EXECUTION_PROFILES_SCHEMA_PATH",
    "compliance_summary",
    "inventory_bytes",
    "load_json",
    "validate_match",
    "validate_repository",
]
