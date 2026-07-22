#!/usr/bin/env python3
"""Build deterministic JSON and Markdown evidence for the repository test strategy."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

if not __package__:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from Scripts.test_strategy_coverage import (
    collect_coverage,
)
from Scripts.test_strategy_coverage import (
    coverage_conclusion as coverage_conclusion,
)
from Scripts.test_strategy_coverage import (
    e2e_freshness as e2e_freshness,
)
from Scripts.test_strategy_evidence import (
    FRAMEWORK_NODE as FRAMEWORK_NODE,
)
from Scripts.test_strategy_evidence import (
    FRAMEWORKS,
    SOURCE_SPECS,
    empty_counts,
    load_source,
    manifest_entry,
    mark_status,
    native_counts,
    reason,
    sum_counts,
)
from Scripts.test_strategy_nodes import node_evidence
from Scripts.test_strategy_rendering import (
    PROFILES as PROFILES,
)
from Scripts.test_strategy_rendering import (
    REPORT_KEYS as REPORT_KEYS,
)
from Scripts.test_strategy_rendering import (
    SCHEMA_VERSION as SCHEMA_VERSION,
)
from Scripts.test_strategy_rendering import (
    render_json as render_json,
)
from Scripts.test_strategy_rendering import (
    render_markdown as render_markdown,
)
from Scripts.test_strategy_rendering import (
    validate_report as validate_report,
)
from Scripts.test_strategy_rendering import (
    write_reports as write_reports,
)
from Scripts.test_strategy_summary import (
    classification_summary,
    dimension,
    governance_summary,
    profile_summaries,
    quality_gate_conclusion,
    strategy_evidence_conclusion,
)

ROOT = Path(__file__).resolve().parents[1]
# Stable compatibility names used by focused contract tests.
_manifest = manifest_entry
_mark = mark_status
_empty_counts = empty_counts


def evidence_bundle_id(
    profile: str,
    manifest: list[dict[str, Any]],
    commit: str | None = None,
) -> str:
    identity = {
        "schemaVersion": SCHEMA_VERSION,
        "profile": profile,
        "commit": commit,
        "evidence": [
            {key: item.get(key) for key in ("id", "path", "fingerprint", "schemaVersion", "status")}
            for item in sorted(manifest, key=lambda value: value["id"])
        ],
    }
    canonical = json.dumps(
        identity,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _source_payloads(root: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    payloads: dict[str, Any] = {}
    manifest: list[dict[str, Any]] = []
    for spec in SOURCE_SPECS:
        payload, entry = load_source(root, spec)
        payloads[spec[0]] = payload
        manifest.append(entry)
    return payloads, manifest


def _source_views(payloads: dict[str, Any]) -> tuple[Any, ...]:
    inventory = payloads["classification-inventory"]
    plan = payloads["execution-plan"]
    contract = payloads["execution-profiles"]
    counts = payloads["execution-counts"]
    governance = payloads["governance"]
    return (
        inventory if isinstance(inventory, list) else [],
        plan if isinstance(plan, dict) else {},
        contract if isinstance(contract, dict) else {},
        counts if isinstance(counts, dict) else {},
        governance if isinstance(governance, dict) else {},
    )


def _status_for_sources(
    statuses: dict[str, str],
    identifiers: tuple[str, ...],
) -> str:
    return next(
        (
            statuses.get(identifier, "missing")
            for identifier in identifiers
            if statuses.get(identifier) not in {"valid", "not_applicable"}
        ),
        "valid",
    )


def _strategic_dimensions(
    profile: str,
    manifest: list[dict[str, Any]],
    coverage: list[dict[str, Any]],
    nodes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    statuses = {item["id"]: item["status"] for item in manifest}
    coverage_status = (
        "not_applicable"
        if profile == "pr"
        else next(
            (item["status"] for item in coverage if item["status"] != "valid"),
            "valid",
        )
    )
    runtime_ids = tuple(f"runtime-{item}" for item in FRAMEWORKS)
    profiles_status = _status_for_sources(
        statuses,
        ("execution-plan", "execution-profiles"),
    )
    durations_status = (
        "valid"
        if all(not item["required"] or item["durationSeconds"] is not None for item in nodes)
        else "missing"
    )
    return [
        dimension("classification", statuses.get("classification-inventory", "missing")),
        dimension("execution", _status_for_sources(statuses, runtime_ids)),
        dimension("profiles", profiles_status),
        dimension("governance", statuses.get("governance", "missing")),
        dimension("coverage", coverage_status),
        dimension(
            "vitals",
            "not_applicable"
            if profile == "pr"
            else next(
                (item["status"] for item in coverage if item["id"] == "vitals"),
                "missing",
            ),
        ),
        dimension("durations", durations_status),
        dimension(
            "trends",
            "not_measured",
            [
                reason(
                    "strategy.future_pbi",
                    "Multi-run trends are not measured by the current contracts.",
                )
            ],
        ),
        dimension(
            "mutation_testing",
            "not_measured",
            [
                reason(
                    "strategy.future_pbi",
                    "Mutation testing is not measured by the current contracts.",
                )
            ],
        ),
        dimension(
            "critical_risk_demonstration",
            "not_measured",
            [
                reason(
                    "strategy.association_only",
                    "Risk and critical-path associations do not demonstrate complete control.",
                )
            ],
        ),
    ]


def _global_reference(
    inventory: list[dict[str, Any]],
    plan: dict[str, Any],
    counts: dict[str, Any],
    overrides: dict[str, Any],
    inventory_fingerprint: str | None,
) -> dict[str, Any]:
    return {
        "inventory": {
            "path": "reports/test-classification-inventory.json",
            "sha256": inventory_fingerprint or "0" * 64,
            "logicalCases": len(inventory),
        },
        "classification": classification_summary(inventory, overrides),
        "executionCounts": {
            "path": "reports/test-execution-counts.json",
            "schemaVersion": str(counts.get("schemaVersion", "unknown")),
            "inventorySha256": str(counts.get("classificationInventorySha256", "0" * 64)),
            "totals": (
                counts.get("totals")
                if isinstance(counts.get("totals"), dict)
                else empty_counts(len(inventory))
            ),
        },
        "profiles": profile_summaries(plan),
    }


def _profile_execution(
    profile: str,
    included: list[str],
    selected: list[dict[str, Any]],
    by_framework: dict[str, dict[str, Any]],
    nodes: list[dict[str, Any]],
    initial: dict[str, int],
    final: dict[str, int],
    governance: dict[str, Any],
    coverage: list[dict[str, Any]],
    vitals: list[dict[str, Any]],
) -> dict[str, Any]:
    total = sum_counts(list(by_framework.values()))
    return {
        "profile": profile,
        "includedProfiles": included,
        "selectedLogicalCases": len(selected),
        "logicalCaseIds": [item.get("logicalCaseId", "") for item in selected],
        "byFramework": by_framework,
        "nodes": nodes,
        "collectedInstances": total["collectedInstances"],
        "executedInstances": total["executedInstances"],
        "skippedInstances": total["skippedInstances"],
        "attempts": total["attempts"],
        "retries": total["retries"],
        "initialResults": initial,
        "finalResults": final,
        "governance": governance_summary(governance, initial, final),
        "coverage": coverage,
        "vitals": vitals,
    }


def _check_source_consistency(
    profile: str,
    counts: dict[str, Any],
    governance: dict[str, Any],
    manifest: list[dict[str, Any]],
) -> None:
    inventory_entry = next(item for item in manifest if item["id"] == "classification-inventory")
    counts_entry = next(item for item in manifest if item["id"] == "execution-counts")
    if (
        counts.get("classificationInventorySha256") != inventory_entry.get("fingerprint")
        and counts_entry["status"] == "valid"
    ):
        mark_status(
            counts_entry,
            "inconsistent",
            reason(
                "counts.inventory_mismatch",
                "Execution-count reference does not identify the current classification inventory.",
                ["classification-inventory", "execution-counts"],
            ),
        )
    governance_entry = next(item for item in manifest if item["id"] == "governance")
    if governance.get("profile") != profile and governance_entry["status"] == "valid":
        mark_status(
            governance_entry,
            "inconsistent",
            reason(
                "governance.profile_mismatch",
                "Governance evidence belongs to another profile.",
                ["governance"],
            ),
        )


def _select_profile(
    inventory: list[dict[str, Any]],
    plan: dict[str, Any],
    profile: str,
) -> tuple[list[str], list[dict[str, Any]]]:
    profile_plan = next(
        (item for item in plan.get("profiles", []) if item.get("profile") == profile),
        {},
    )
    included = profile_plan.get("includedProfiles", [profile])
    selected = sorted(
        (item for item in inventory if item.get("executionProfile") in included),
        key=lambda item: item.get("logicalCaseId", ""),
    )
    return included, selected


def _execution_violations(
    governance: dict[str, Any],
    by_framework: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    violations = [
        reason("governance.violation", message, ["governance"])
        for message in governance.get("violations", [])
    ]
    total = sum_counts(list(by_framework.values()))
    if total["results"]["failed"] or total["results"]["infrastructureError"]:
        violations.append(
            reason(
                "execution.failed",
                "The profile execution contains failed or infrastructure-error results.",
                [f"runtime-{item}" for item in FRAMEWORKS],
            )
        )
    return violations


def _assemble_model(
    profile: str,
    commit: str | None,
    payloads: dict[str, Any],
    context: tuple[Any, ...],
) -> dict[str, Any]:
    (
        inventory,
        plan,
        counts,
        included,
        selected,
        by_framework,
        initial,
        final,
        governance,
        coverage,
        vitals,
        nodes,
        manifest,
        dimensions,
        gate,
        strategy,
    ) = context
    inventory_entry = next(item for item in manifest if item["id"] == "classification-inventory")
    return {
        "schemaVersion": SCHEMA_VERSION,
        "schema": "config/test-strategy-report.schema.json",
        "profile": profile,
        "evidenceBundleId": evidence_bundle_id(profile, manifest, commit),
        "evidenceBundleIdentityDisclaimer": (
            "This identifier names the exact evidence bundle; it does not prove that "
            "every source came from the same physical execution."
        ),
        "globalReference": _global_reference(
            inventory,
            plan,
            counts,
            payloads.get("classification-overrides") or {},
            inventory_entry.get("fingerprint"),
        ),
        "profileExecution": _profile_execution(
            profile,
            included,
            selected,
            by_framework,
            nodes,
            initial,
            final,
            governance,
            coverage,
            vitals,
        ),
        "strategicCoverage": dimensions,
        "evidenceManifest": manifest,
        "conclusions": {
            "qualityGateStatus": gate["status"],
            "qualityGateReasons": gate["reasons"],
            "strategyEvidenceStatus": strategy["status"],
            "strategyEvidenceReasons": strategy["reasons"],
        },
    }


def build_report_model(
    root: Path = ROOT,
    profile: str = "main",
    *,
    now: datetime | None = None,
    commit: str | None = None,
) -> dict[str, Any]:
    if profile not in PROFILES:
        raise ValueError(f"Unsupported execution profile: {profile}")
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    payloads, manifest = _source_payloads(root)
    inventory, plan, contract, counts, governance = _source_views(payloads)
    _check_source_consistency(profile, counts, governance, manifest)
    included, selected = _select_profile(inventory, plan, profile)
    by_framework, initial, final, native_manifest = native_counts(
        root,
        profile,
        selected,
    )
    manifest.extend(native_manifest)
    nodes, node_manifest, violations = node_evidence(root, profile, contract, selected)
    manifest.extend(node_manifest)
    coverage, vitals, coverage_manifest, coverage_violations = collect_coverage(
        root,
        profile,
        current,
        manifest_entry,
        reason,
    )
    manifest.extend(coverage_manifest)
    violations.extend(coverage_violations)
    violations.extend(_execution_violations(governance, by_framework))
    manifest = sorted(manifest, key=lambda item: item["id"])
    dimensions = _strategic_dimensions(profile, manifest, coverage, nodes)
    gate = quality_gate_conclusion(manifest, violations)
    strategy = strategy_evidence_conclusion(dimensions)
    context = (
        inventory,
        plan,
        counts,
        included,
        selected,
        by_framework,
        initial,
        final,
        governance,
        coverage,
        vitals,
        nodes,
        manifest,
        dimensions,
        gate,
        strategy,
    )
    return _assemble_model(profile, commit, payloads, context)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--profile", choices=PROFILES, default="main")
    parser.add_argument("--commit")
    parser.add_argument(
        "--output-json",
        type=Path,
        default=Path("reports/test-strategy-report.json"),
    )
    parser.add_argument(
        "--output-markdown",
        type=Path,
        default=Path("reports/test-strategy-report.md"),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = args.root.resolve()
    try:
        model = build_report_model(root, args.profile, commit=args.commit)
        json_path = args.output_json if args.output_json.is_absolute() else root / args.output_json
        markdown_path = (
            args.output_markdown
            if args.output_markdown.is_absolute()
            else root / args.output_markdown
        )
        write_reports(model, json_path, markdown_path)
    except (OSError, TypeError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: test-strategy reporting failed: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(model["conclusions"], ensure_ascii=False, sort_keys=True))
    return 0 if model["conclusions"]["qualityGateStatus"] == "compliant" else 1


if __name__ == "__main__":
    raise SystemExit(main())
