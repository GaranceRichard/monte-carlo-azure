"""Validate test-classification rule structure, uniqueness, and vocabulary."""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from typing import Any

from Scripts.test_classification_contract import unique_string_errors, unknown_properties

EVIDENCE_FIELDS = {
    "framework",
    "sourcePath",
    "selector",
    "imports",
    "calls",
    "fixtures",
    "resources",
    "modifiers",
    "conditional",
    "dynamicTitle",
}
RULE_GROUPS = {
    "natureRules": (
        {"id", "priority", "nature", "requiresBehaviorEvidence", "match"},
        "nature",
    ),
    "purposeRules": ({"id", "priority", "values", "match"}, "purpose"),
    "domainRules": ({"id", "priority", "values", "match"}, "domain"),
    "traceabilityRules": (
        {"id", "priority", "risks", "criticalPaths", "criticality", "match"},
        "traceability",
    ),
}


def validate_match(match: Any, label: str) -> list[str]:
    if not isinstance(match, dict):
        return [f"{label}.match must be an object"]
    errors = unknown_properties(
        match, {"frameworks", "all", "any", "none"}, f"{label}.match"
    )
    if "frameworks" in match:
        errors.extend(unique_string_errors(match["frameworks"], f"{label}.match.frameworks"))
    for group_name in ("all", "any", "none"):
        errors.extend(_match_group_errors(match.get(group_name), label, group_name))
    return errors


def _match_group_errors(group: Any, label: str, group_name: str) -> list[str]:
    if group is None:
        return []
    if not isinstance(group, dict):
        return [f"{label}.match.{group_name} must be an object"]
    errors = unknown_properties(group, EVIDENCE_FIELDS, f"{label}.match.{group_name}")
    for field, patterns in group.items():
        field_label = f"{label}.match.{group_name}.{field}"
        errors.extend(unique_string_errors(patterns, field_label))
        errors.extend(_regex_errors(patterns, label))
    return errors


def _regex_errors(patterns: Any, label: str) -> list[str]:
    if not isinstance(patterns, list):
        return []
    errors: list[str] = []
    for pattern in patterns:
        if not isinstance(pattern, str):
            continue
        try:
            re.compile(pattern)
        except re.error as exc:
            errors.append(f"{label}: invalid regex {pattern!r}: {exc}")
    return errors


def validate_rules(rules: Any, catalog: dict[str, Any]) -> list[str]:
    if not isinstance(rules, dict):
        return ["classification rules must be a JSON object"]
    errors = _rules_top_level_errors(rules, catalog)
    seen_ids: set[str] = set()
    for group_name, (allowed, kind) in RULE_GROUPS.items():
        errors.extend(
            _rule_group_errors(
                rules.get(group_name),
                group_name,
                allowed,
                kind,
                catalog,
                seen_ids,
            )
        )
    return errors


def _rules_top_level_errors(
    rules: dict[str, Any], catalog: dict[str, Any]
) -> list[str]:
    errors = unknown_properties(
        rules,
        {
            "rulesVersion",
            "priorityPolicy",
            "automation",
            "defaults",
            *RULE_GROUPS,
        },
        "rules",
    )
    if rules.get("rulesVersion") != "1.0.0":
        errors.append("classification rules version must be 1.0.0")
    dimensions = catalog.get("dimensions", {})
    automation = rules.get("automation")
    profile = automation.get("currentExecutionProfile") if isinstance(automation, dict) else None
    if profile not in dimensions.get("executionProfile", {}).get("values", []):
        errors.append("rules automation profile is outside the catalog")
    defaults = rules.get("defaults")
    purpose = defaults.get("purpose") if isinstance(defaults, dict) else None
    if purpose not in dimensions.get("purpose", {}).get("values", []):
        errors.append("rules default purpose is outside the catalog")
    return errors


def _rule_group_errors(
    group: Any,
    group_name: str,
    allowed: set[str],
    kind: str,
    catalog: dict[str, Any],
    seen_ids: set[str],
) -> list[str]:
    if not isinstance(group, list):
        return [f"{group_name} must be an array"]
    errors: list[str] = []
    signatures: set[str] = set()
    for index, rule in enumerate(group):
        errors.extend(
            _one_rule_errors(
                rule,
                f"{group_name}[{index}]",
                allowed,
                kind,
                catalog,
                seen_ids,
                signatures,
            )
        )
    return errors


def _one_rule_errors(
    rule: Any,
    label: str,
    allowed: set[str],
    kind: str,
    catalog: dict[str, Any],
    seen_ids: set[str],
    signatures: set[str],
) -> list[str]:
    if not isinstance(rule, dict):
        return [f"{label} must be an object"]
    errors = unknown_properties(rule, allowed, label)
    errors.extend(_rule_identity_errors(rule, label, seen_ids))
    errors.extend(validate_match(rule.get("match"), label))
    errors.extend(_kind_validator(kind)(rule, label, catalog))
    signature = json.dumps(
        {key: value for key, value in rule.items() if key != "id"}, sort_keys=True
    )
    if signature in signatures:
        errors.append(f"{label} duplicates another rule")
    signatures.add(signature)
    return errors


def _rule_identity_errors(
    rule: dict[str, Any], label: str, seen_ids: set[str]
) -> list[str]:
    errors: list[str] = []
    identifier = rule.get("id")
    if not isinstance(identifier, str) or not identifier.strip() or identifier in seen_ids:
        errors.append(f"{label} must have a globally unique non-empty id")
    else:
        seen_ids.add(identifier)
    priority = rule.get("priority")
    if type(priority) is not int or priority < 0:
        errors.append(f"{label}.priority must be a non-negative integer")
    return errors


def _kind_validator(
    kind: str,
) -> Callable[[dict[str, Any], str, dict[str, Any]], list[str]]:
    return {
        "nature": _nature_rule_errors,
        "purpose": _dimension_rule_errors("purpose"),
        "domain": _dimension_rule_errors("domain"),
        "traceability": _traceability_rule_errors,
    }[kind]


def _nature_rule_errors(
    rule: dict[str, Any], label: str, catalog: dict[str, Any]
) -> list[str]:
    errors: list[str] = []
    allowed = catalog.get("dimensions", {}).get("nature", {}).get("values", [])
    if rule.get("nature") not in allowed:
        errors.append(f"{label}.nature is outside the catalog")
    if rule.get("requiresBehaviorEvidence") is not True:
        errors.append(f"{label} must require behavioral evidence")
    return errors


def _dimension_rule_errors(
    dimension: str,
) -> Callable[[dict[str, Any], str, dict[str, Any]], list[str]]:
    def validate(
        rule: dict[str, Any], label: str, catalog: dict[str, Any]
    ) -> list[str]:
        values = rule.get("values")
        errors = unique_string_errors(values, f"{label}.values")
        allowed = catalog.get("dimensions", {}).get(dimension, {}).get("values", [])
        if isinstance(values, list) and any(value not in allowed for value in values):
            errors.append(f"{label}.values are outside the catalog")
        return errors

    return validate


def _traceability_rule_errors(
    rule: dict[str, Any], label: str, catalog: dict[str, Any]
) -> list[str]:
    errors: list[str] = []
    for field, pattern in (("risks", r"RISK-[0-9]{3}"), ("criticalPaths", r"CP-[0-9]{3}")):
        if field not in rule:
            continue
        values = rule[field]
        errors.extend(unique_string_errors(values, f"{label}.{field}"))
        if isinstance(values, list) and any(
            re.fullmatch(pattern, item) is None for item in values if isinstance(item, str)
        ):
            errors.append(f"{label}.{field} contains an invalid identifier")
    allowed = catalog.get("dimensions", {}).get("criticality", {}).get("values", [])
    if rule.get("criticality") not in allowed:
        errors.append(f"{label}.criticality is outside the catalog")
    return errors
