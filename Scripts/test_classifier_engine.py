"""Rule-driven classification for discovered logical test cases."""

from __future__ import annotations

import re
from copy import deepcopy
from typing import Any

from Scripts.test_classification_contract import validate_record_engine
from Scripts.test_classifier_discovery import LogicalCase

EVIDENCE_FIELDS = ("imports", "calls", "fixtures", "resources", "modifiers")


def _values(case: LogicalCase, field: str) -> list[str]:
    if field == "framework":
        return [case.framework]
    if field == "sourcePath":
        return [case.source_path]
    if field == "selector":
        return [case.selector]
    value = case.evidence.get(field, [])
    if isinstance(value, bool):
        return [str(value).lower()]
    return [str(item) for item in value]


def _pattern_matches(values: list[str], pattern: str) -> bool:
    return any(re.search(pattern, value, re.IGNORECASE) is not None for value in values)


def _group_matches(case: LogicalCase, group: dict[str, list[str]], require_all: bool) -> bool:
    outcomes = [
        _pattern_matches(_values(case, field), pattern)
        for field, patterns in group.items()
        for pattern in patterns
    ]
    if not outcomes:
        return True
    return all(outcomes) if require_all else any(outcomes)


def rule_matches(case: LogicalCase, rule: dict[str, Any]) -> bool:
    match = rule.get("match", {})
    frameworks = match.get("frameworks", [])
    if frameworks and case.framework not in frameworks:
        return False
    if not _group_matches(case, match.get("all", {}), True):
        return False
    if match.get("any") and not _group_matches(case, match["any"], False):
        return False
    if match.get("none") and _group_matches(case, match["none"], False):
        return False
    if rule.get("requiresBehaviorEvidence"):
        behavior_group = {field: match.get("any", {}).get(field, []) for field in EVIDENCE_FIELDS}
        behavior_group = {field: patterns for field, patterns in behavior_group.items() if patterns}
        if not behavior_group or not _group_matches(case, behavior_group, False):
            return False
    return True


def _matching_rules(case: LogicalCase, rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        (rule for rule in rules if rule_matches(case, rule)),
        key=lambda rule: (rule["priority"], rule["id"]),
    )


def _nature(case: LogicalCase, rules: dict[str, Any]) -> tuple[str | None, str | None]:
    matches = _matching_rules(case, rules["natureRules"])
    if not matches:
        return None, "No nature rule has sufficient behavioral evidence."
    best_priority = matches[0]["priority"]
    best_values = {rule["nature"] for rule in matches if rule["priority"] == best_priority}
    if len(best_values) != 1:
        return None, "Nature rules with equal priority provide contradictory evidence."
    return best_values.pop(), None


def _ordered(values: set[str], vocabulary: list[str]) -> list[str]:
    return [value for value in vocabulary if value in values]


def _add_dimensions(
    record: dict[str, Any], case: LogicalCase, rules: dict[str, Any], catalog: dict[str, Any]
) -> None:
    purpose_values = {rules["defaults"]["purpose"]}
    for rule in _matching_rules(case, rules["purposeRules"]):
        purpose_values.update(rule["values"])
    record["purposes"] = _ordered(purpose_values, catalog["dimensions"]["purpose"]["values"])

    domain_values: set[str] = set()
    for rule in _matching_rules(case, rules["domainRules"]):
        domain_values.update(rule["values"])
    ordered_domains = _ordered(domain_values, catalog["dimensions"]["domain"]["values"])
    if ordered_domains:
        record["domains"] = ordered_domains


def _add_traceability(record: dict[str, Any], case: LogicalCase, rules: dict[str, Any]) -> None:
    risks: set[str] = set()
    critical_paths: set[str] = set()
    criticalities: list[str] = []
    for rule in _matching_rules(case, rules["traceabilityRules"]):
        risks.update(rule.get("risks", []))
        critical_paths.update(rule.get("criticalPaths", []))
        criticalities.append(rule["criticality"])
    if risks:
        record["risks"] = sorted(risks)
    if critical_paths:
        record["criticalPaths"] = sorted(critical_paths)
    if risks or critical_paths:
        rank = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        record["criticality"] = max(criticalities, key=rank.get)


def _execution_profile(case: LogicalCase, rules: dict[str, Any]) -> str:
    matches = _matching_rules(case, rules["executionProfileRules"])
    if not matches:
        return rules["defaults"]["executionProfile"]
    best_priority = matches[0]["priority"]
    profiles = {rule["profile"] for rule in matches if rule["priority"] == best_priority}
    if len(profiles) != 1:
        raise ValueError(
            f"Execution-profile rules with equal priority contradict {case.logical_case_id}"
        )
    return profiles.pop()


def _override_for(case: LogicalCase, overrides: dict[str, Any]) -> dict[str, Any] | None:
    matches = []
    for override in overrides.get("overrides", []):
        target = override["target"]
        same_framework = target.get("framework", case.framework) == case.framework
        if (
            same_framework
            and target["sourcePath"] == case.source_path
            and target["selector"] == case.selector
        ):
            matches.append(override)
    if len(matches) > 1:
        raise ValueError(f"Multiple overrides target {case.logical_case_id}")
    return matches[0] if matches else None


def _apply_override(record: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    if not override.get("justification") or not override.get("evidence"):
        raise ValueError(
            "Every classification override requires justification and observable evidence"
        )
    result = deepcopy(record)
    result.update(override["classification"])
    if result["status"] in {"classified", "exempted"}:
        result.pop("unresolvedReason", None)
    return result


def classify_case(
    case: LogicalCase,
    rules: dict[str, Any],
    overrides: dict[str, Any],
    catalog: dict[str, Any],
) -> dict[str, Any]:
    nature, unresolved_reason = _nature(case, rules)
    record: dict[str, Any] = {
        "logicalCaseId": case.logical_case_id,
        "framework": case.framework,
        "sourcePath": case.source_path,
        "selector": case.selector,
        "status": "classified" if nature else "unresolved",
        "executionProfile": _execution_profile(case, rules),
    }
    if nature:
        record["nature"] = nature
    else:
        record["unresolvedReason"] = unresolved_reason
    _add_dimensions(record, case, rules, catalog)
    _add_traceability(record, case, rules)
    override = _override_for(case, overrides)
    return _apply_override(record, override) if override else record


def validate_record(
    record: dict[str, Any], catalog: dict[str, Any], schema: dict[str, Any]
) -> list[str]:
    return validate_record_engine(record, catalog, schema)


def classify_inventory(
    cases: list[LogicalCase],
    rules: dict[str, Any],
    overrides: dict[str, Any],
    catalog: dict[str, Any],
    schema: dict[str, Any],
) -> list[dict[str, Any]]:
    records = [classify_case(case, rules, overrides, catalog) for case in cases]
    records.sort(key=lambda record: record["logicalCaseId"])
    identifiers = [record["logicalCaseId"] for record in records]
    if len(identifiers) != len(set(identifiers)):
        raise ValueError("The classification inventory contains duplicate logicalCaseId values")
    for record in records:
        errors = validate_record(record, catalog, schema)
        if errors:
            raise ValueError(f"Invalid record {record['logicalCaseId']}: {'; '.join(errors)}")
    return records
