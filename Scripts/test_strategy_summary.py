"""Pure classification and profile summaries for strategic test reporting."""

from __future__ import annotations

from collections import Counter
from typing import Any

from Scripts.test_strategy_evidence import reason


def _counter(
    records: list[dict[str, Any]], field: str, *, multiple: bool = False
) -> dict[str, int]:
    values: list[str] = []
    for record in records:
        raw = record.get(field, [] if multiple else "unassigned")
        values.extend(raw if multiple and isinstance(raw, list) else [str(raw or "unassigned")])
    return dict(sorted(Counter(values).items()))


def classification_summary(
    inventory: list[dict[str, Any]], overrides: dict[str, Any]
) -> dict[str, Any]:
    return {
        "breakdowns": {
            "status": _counter(inventory, "status"),
            "framework": _counter(inventory, "framework"),
            "nature": _counter(inventory, "nature"),
            "purpose": _counter(inventory, "purposes", multiple=True),
            "primaryProfile": _counter(inventory, "executionProfile"),
            "domain": _counter(inventory, "domains", multiple=True),
            "criticality": _counter(inventory, "criticality"),
        },
        "riskAssociations": _counter(inventory, "risks", multiple=True),
        "criticalPathAssociations": _counter(inventory, "criticalPaths", multiple=True),
        "associationDisclaimer": (
            "An association identifies relevant evidence; it does not by itself demonstrate "
            "complete control of a risk or critical path."
        ),
        "unresolvedCases": sorted(
            item.get("logicalCaseId", "")
            for item in inventory
            if item.get("status") == "unresolved"
        ),
        "overrides": sorted(
            str(item.get("logicalCaseId") or item.get("selector") or "")
            for item in overrides.get("overrides", [])
            if isinstance(item, dict)
        ),
    }


def profile_summaries(plan: dict[str, Any]) -> list[dict[str, Any]]:
    rendered: list[dict[str, Any]] = []
    for profile in plan.get("profiles", []):
        frameworks: Counter[str] = Counter()
        nodes: dict[str, int] = {}
        for node in profile.get("nodes", []):
            nodes[node.get("id", "unknown")] = len(node.get("logicalCaseIds", []))
            frameworks.update(node.get("frameworks", {}))
        rendered.append(
            {
                "profile": profile.get("profile"),
                "includedProfiles": profile.get("includedProfiles", []),
                "logicalCases": profile.get("logicalCases", 0),
                "frameworks": dict(sorted(frameworks.items())),
                "nodes": dict(sorted(nodes.items())),
            }
        )
    return rendered


def governance_summary(
    payload: dict[str, Any], initial: dict[str, int], final: dict[str, int]
) -> dict[str, Any]:
    summary = payload.get("summary", {})
    return {
        "skips": int(summary.get("skippedCases", 0)),
        "disabled": int(summary.get("disabledCases", 0)),
        "expectedFailures": int(summary.get("expectedFailureCases", 0)),
        "quarantines": int(summary.get("quarantinedCases", 0)),
        "retries": int(summary.get("retries", 0)),
        "exemptions": int(summary.get("governedEntries", 0)),
        "expirations": int(summary.get("expiredEntries", 0)),
        "violations": len(payload.get("violations", [])),
        "instabilities": int(summary.get("unstableInstances", 0)),
        "instabilityRatePercent": float(summary.get("instabilityRatePercent", 0.0)),
        "initialResults": initial,
        "finalResults": final,
    }


def dimension(
    identifier: str,
    status: str,
    issues: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {"id": identifier, "status": status, "reasons": issues or []}


def quality_gate_conclusion(
    manifest: list[dict[str, Any]], violations: list[dict[str, Any]]
) -> dict[str, Any]:
    if violations:
        return {
            "status": "non_compliant",
            "reasons": sorted(violations, key=lambda item: item["code"]),
        }
    incomplete = [
        item
        for item in manifest
        if item.get("required") and item.get("status") not in {"valid", "not_applicable"}
    ]
    if incomplete:
        reasons = [
            reason(
                "evidence.incomplete",
                f"Required evidence {item['id']} is {item['status']}.",
                [item["id"]],
            )
            for item in incomplete
        ]
        return {"status": "incomplete_evidence", "reasons": reasons}
    return {"status": "compliant", "reasons": []}


def strategy_evidence_conclusion(dimensions: list[dict[str, Any]]) -> dict[str, Any]:
    incomplete = [item for item in dimensions if item.get("status") != "valid"]
    reasons = [
        reason(
            "strategy.dimension_incomplete",
            f"Strategic dimension {item['id']} is {item['status']}.",
        )
        for item in incomplete
    ]
    return {"status": "incomplete" if incomplete else "complete", "reasons": reasons}
