from __future__ import annotations

import hashlib
import json
import runpy
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

import pytest

from Scripts import quality_gate
from Scripts import report_test_strategy as reporting

NOW = datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc)


def _write_json(root: Path, relative: str, value: object) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _record(
    logical_id: str,
    framework: str,
    profile: str,
    nature: str,
    *,
    purpose: str = "functional",
) -> dict:
    return {
        "logicalCaseId": logical_id,
        "framework": framework,
        "sourcePath": f"tests/{logical_id}.test",
        "selector": logical_id,
        "status": "classified",
        "executionProfile": profile,
        "nature": nature,
        "purposes": [purpose],
        "domains": ["quality_chain"],
        "criticality": "high",
        "risks": ["RISK-020"],
        "criticalPaths": ["CP-008"],
    }


def _instance(logical_id: str, *, attempts: int = 1, result: str = "passed") -> dict:
    history = ["failed", result] if attempts == 2 else [result]
    return {
        "instanceId": f"instance:{logical_id}",
        "logicalCaseId": logical_id,
        "executed": True,
        "attempts": attempts,
        "attemptResults": history,
        "initialResult": history[0],
        "finalResult": history[-1],
        "result": result,
    }


def _node(identifier: str, command: str, needs: list[str]) -> dict:
    return {
        "id": identifier,
        "order": len(needs) + 1,
        "needs": needs,
        "commands": [command],
        "profiles": ["pr", "main", "nightly", "release"],
        "reads": ["workspace"],
        "writes": [f"reports/test-execution-artifacts/{{profile}}/{identifier}/result.json"],
        "resources": [],
        "aggregator": identifier == "aggregate",
    }


def _repository(tmp_path: Path, profile: str = "pr") -> Path:
    root = tmp_path / "repo"
    inventory = [
        _record("py-pr", "pytest", "pr", "unit"),
        _record("vi-pr", "vitest", "pr", "component", purpose="accessibility"),
        _record("pw-main", "playwright", "main", "e2e"),
        _record("py-nightly", "pytest", "nightly", "integration", purpose="performance"),
        _record("py-release", "pytest", "release", "contract", purpose="migration_recovery"),
    ]
    nodes = [
        _node("preflight", "Repository hygiene", []),
        _node("backend-static", "Backend lint", ["preflight"]),
        _node("frontend-static", "Frontend lint", ["preflight"]),
        _node("backend-tests", "Backend tests", ["preflight"]),
        _node("frontend-tests", "Frontend tests", ["preflight"]),
        _node("e2e", "E2E tests", ["preflight"]),
        _node("release-or-container-checks", "Release checks", ["preflight"]),
        _node(
            "aggregate",
            "Test strategy reporting",
            [
                "backend-static",
                "frontend-static",
                "backend-tests",
                "frontend-tests",
                "e2e",
                "release-or-container-checks",
            ],
        ),
    ]
    contract = {
        "schemaVersion": "1.0.0",
        "schema": "config/test-execution-profiles.schema.json",
        "profiles": [
            {"id": "pr", "includes": ["pr"], "description": "pr"},
            {"id": "main", "includes": ["pr", "main"], "description": "main"},
            {
                "id": "nightly",
                "includes": ["pr", "main", "nightly"],
                "description": "nightly",
            },
            {
                "id": "release",
                "includes": ["pr", "main", "release"],
                "description": "release",
            },
        ],
        "nodes": nodes,
    }
    plans = []
    inclusions = {
        "pr": ["pr"],
        "main": ["pr", "main"],
        "nightly": ["pr", "main", "nightly"],
        "release": ["pr", "main", "release"],
    }
    for current, included in inclusions.items():
        selected = [item for item in inventory if item["executionProfile"] in included]
        plans.append(
            {
                "profile": current,
                "includedProfiles": included,
                "changeLevel": None,
                "logicalCases": len(selected),
                "nodes": [
                    {
                        "id": node["id"],
                        "needs": node["needs"],
                        "commands": node["commands"],
                        "reads": node["reads"],
                        "writes": node["writes"],
                        "resources": [],
                        "aggregator": node["aggregator"],
                        "logicalCaseIds": [
                            item["logicalCaseId"]
                            for item in selected
                            if reporting.FRAMEWORK_NODE.get(item["framework"]) == node["id"]
                        ],
                        "frameworks": {},
                        "natures": {},
                        "criticalities": {},
                    }
                    for node in nodes
                ],
            }
        )
    root.mkdir(parents=True)
    inventory_bytes = (json.dumps(inventory, ensure_ascii=False, indent=2) + "\n").encode()
    (root / "reports").mkdir()
    (root / "reports/test-classification-inventory.json").write_bytes(inventory_bytes)
    counts = {
        "schemaVersion": "1.0.0",
        "classificationInventorySha256": hashlib.sha256(inventory_bytes).hexdigest(),
        "totals": {
            "logicalCases": 5,
            "collectedInstances": 6,
            "executedInstances": 6,
            "skippedInstances": 0,
            "attempts": 6,
            "retries": 0,
            "results": {
                "passed": 6,
                "failed": 0,
                "skipped": 0,
                "todo": 0,
                "infrastructureError": 0,
            },
        },
        "frameworks": {},
        "classificationStatuses": {},
        "natures": {},
        "executionProfiles": {},
        "logicalCases": [],
        "anomalies": [],
    }
    _write_json(root, "reports/test-execution-counts.json", counts)
    _write_json(
        root,
        "reports/test-execution-plan.json",
        {
            "schemaVersion": "1.0.0",
            "contract": "config/test-execution-profiles.json",
            "inventory": "reports/test-classification-inventory.json",
            "profiles": plans,
        },
    )
    _write_json(root, "config/test-execution-profiles.json", contract)
    _write_json(
        root, "config/test-classification.json", {"catalogVersion": "1.0.0", "dimensions": {}}
    )
    _write_json(
        root,
        "config/test-classification-overrides.json",
        {"overridesVersion": "1.0.0", "overrides": []},
    )
    selected_profiles = set(inclusions[profile])
    selected = [item for item in inventory if item["executionProfile"] in selected_profiles]
    _write_json(
        root,
        "reports/test-governance-report.json",
        {
            "schemaVersion": "1.0.0",
            "schema": "config/test-governance-report.schema.json",
            "contractVersion": "1.0.0",
            "profile": profile,
            "runtimeComplete": True,
            "summary": {
                "logicalCases": 5,
                "governedEntries": 0,
                "detectedMechanisms": 0,
                "skippedCases": 0,
                "disabledCases": 0,
                "expectedFailureCases": 0,
                "quarantinedCases": 0,
                "retryCases": 0,
                "expiredEntries": 0,
                "dueWithin30Days": 0,
                "executedInstances": len(selected),
                "attempts": len(selected),
                "retries": 0,
                "unstableInstances": 0,
                "instabilityRatePercent": 0.0,
            },
            "expirations": {"expired": [], "dueWithin30Days": []},
            "entries": [],
            "runtimeDetails": [],
            "violations": [],
        },
    )
    for framework in sorted({item["framework"] for item in selected}):
        _write_json(
            root,
            f"reports/test-execution-native/{framework}.json",
            {
                "schemaVersion": 1,
                "framework": framework,
                "complete": True,
                "anomalies": [],
                "instances": [
                    _instance(item["logicalCaseId"])
                    for item in selected
                    if item["framework"] == framework
                ],
            },
        )
    applicable = {
        "preflight",
        "backend-static",
        "frontend-static",
        "backend-tests",
        "frontend-tests",
    }
    if profile != "pr":
        applicable |= {"e2e", "release-or-container-checks"}
    for node in applicable:
        _write_json(
            root,
            f"reports/test-execution-artifacts/{profile}/{node}/result.json",
            {
                "schemaVersion": 1,
                "profile": profile,
                "node": node,
                "exitCode": 0,
                "durationSeconds": 0.5,
            },
        )
    return root


def _add_main_coverage(root: Path, *, e2e_completed: str = "2026-07-22T11:59:30Z") -> None:
    (root / ".coveragerc").write_text("[report]\nfail_under = 80\n", encoding="utf-8")
    _write_json(
        root,
        ".coverage.python.json",
        {
            "meta": {"format": 3},
            "totals": {
                "num_statements": 100,
                "covered_lines": 100,
                "missing_lines": 0,
                "num_branches": 100,
                "covered_branches": 100,
            },
        },
    )
    vitest_config = "thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 }"
    path = root / "frontend/vitest.config.js"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(vitest_config, encoding="utf-8")
    _write_json(
        root,
        "frontend/coverage/coverage-final.json",
        {"frontend/src/app.ts": {"s": {"0": 1}, "f": {"0": 1}, "b": {"0": [1, 1]}}},
    )
    e2e_config = {
        "schemaVersion": 1,
        "artifactMaxAgeSeconds": 3600,
        "thresholds": {name: 80 for name in ("statements", "branches", "functions", "lines")},
    }
    _write_json(root, "frontend/e2e-coverage.config.json", e2e_config)
    metric = {"total": 100, "covered": 100, "skipped": 0, "pct": 100.0}
    _write_json(
        root,
        "frontend/coverage/e2e-coverage-summary.json",
        {
            "schemaVersion": 1,
            "context": {"completedAt": e2e_completed},
            **{name: metric for name in ("statements", "branches", "functions", "lines")},
        },
    )
    script = root / "Scripts/check_vitals_compliance.py"
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_text("VITALS_THRESHOLD = 95.0\n", encoding="utf-8")
    _write_json(root, "docs/vitals-coverage-map.json", {"vitals": []})
    source_paths = [
        "docs/vitals-coverage-map.json",
        "frontend/coverage/coverage-final.json",
        ".coverage.python.json",
        "frontend/coverage/e2e-coverage-summary.json",
        "frontend/e2e-coverage.config.json",
    ]
    identities = []
    for relative in source_paths:
        source = root / relative
        stat = source.stat()
        identities.append({"path": relative, "size": stat.st_size, "mtimeNs": stat.st_mtime_ns})
    vitals = [
        {
            "title": f"Vital {index}",
            "sources": {
                "backend": {
                    "matched": ["source"],
                    "metrics": {"lines": {"total": 100, "covered": 95}},
                }
            },
        }
        for index in range(1, 6)
    ]
    _write_json(
        root,
        "frontend/coverage/vitals-coverage-report.json",
        {
            "schemaVersion": 1,
            "generatedAt": "contractual-source-value",
            "sourceArtifacts": identities,
            "report": vitals,
        },
    )


def test_nominal_pr_model_is_strict_deterministic_and_honest(tmp_path: Path) -> None:
    from Scripts import quality_gate_dag

    root = _repository(tmp_path)
    quality_gate_dag._write_result(root, "pr", "preflight", 23, 9.0)
    quality_gate_dag._write_result(root, "pr", "preflight", 0, 1.0)
    model = reporting.build_report_model(root, "pr", now=NOW)
    nodes = {item["id"]: item for item in model["profileExecution"]["nodes"]}
    reasons = model["conclusions"]["qualityGateReasons"]
    dimensions = {item["id"]: item["status"] for item in model["strategicCoverage"]}

    assert reporting.validate_report(model) == []
    assert set(model) == set(reporting.REPORT_KEYS)
    assert model["globalReference"]["inventory"]["logicalCases"] == 5
    assert model["profileExecution"]["selectedLogicalCases"] == 2
    assert model["conclusions"]["qualityGateStatus"] == "compliant"
    assert model["conclusions"]["strategyEvidenceStatus"] == "incomplete"
    assert reporting.render_json(model) == reporting.render_json(deepcopy(model))
    assert reporting.render_markdown(model) == reporting.render_markdown(deepcopy(model))
    assert nodes["preflight"]["exitCode"] == 0
    assert nodes["preflight"]["status"] == "valid"
    assert not any(reason["code"] == "node.failed" for reason in reasons)
    assert nodes["e2e"]["status"] == "not_applicable"
    assert nodes["aggregate"]["status"] == "not_applicable"
    assert model["conclusions"]["qualityGateStatus"] == "compliant"
    assert model["conclusions"]["strategyEvidenceStatus"] == "incomplete"
    assert dimensions["trends"] == "not_measured"
    assert dimensions["mutation_testing"] == "not_measured"
    assert dimensions["critical_risk_demonstration"] == "not_measured"


def test_global_reference_and_profile_execution_are_independent(tmp_path: Path) -> None:
    model = reporting.build_report_model(_repository(tmp_path), "pr", now=NOW)
    model["globalReference"]["inventory"]["logicalCases"] = 1094
    model["profileExecution"]["selectedLogicalCases"] = 1091

    assert model["globalReference"]["inventory"]["logicalCases"] == 1094
    assert model["profileExecution"]["selectedLogicalCases"] == 1091


def test_profiles_keep_distinct_cumulative_compositions(tmp_path: Path) -> None:
    profiles = reporting.build_report_model(_repository(tmp_path), "pr", now=NOW)[
        "globalReference"
    ]["profiles"]
    by_id = {item["profile"]: item for item in profiles}

    assert by_id["main"]["includedProfiles"] == ["pr", "main"]
    assert by_id["nightly"]["includedProfiles"] == ["pr", "main", "nightly"]
    assert by_id["release"]["includedProfiles"] == ["pr", "main", "release"]
    assert by_id["nightly"]["logicalCases"] == by_id["release"]["logicalCases"] == 4


def test_classification_axes_and_associations_do_not_claim_risk_control(tmp_path: Path) -> None:
    classification = reporting.build_report_model(_repository(tmp_path), "pr", now=NOW)[
        "globalReference"
    ]["classification"]

    assert set(classification["breakdowns"]) == {
        "status",
        "framework",
        "nature",
        "purpose",
        "primaryProfile",
        "domain",
        "criticality",
    }
    assert classification["riskAssociations"]["RISK-020"] == 5
    assert classification["criticalPathAssociations"]["CP-008"] == 5
    assert classification["associationDisclaimer"]
    assert classification["unresolvedCases"] == []
    assert classification["overrides"] == []


def test_execution_counts_keep_instances_attempts_retries_and_results_distinct(
    tmp_path: Path,
) -> None:
    root = _repository(tmp_path)
    native = root / "reports/test-execution-native/pytest.json"
    payload = json.loads(native.read_text(encoding="utf-8"))
    payload["instances"][0] = _instance("py-pr", attempts=2)
    _write_json(root, "reports/test-execution-native/pytest.json", payload)
    execution = reporting.build_report_model(root, "pr", now=NOW)["profileExecution"]

    assert execution["collectedInstances"] == 2
    assert execution["executedInstances"] == 2
    assert execution["attempts"] == 3
    assert execution["retries"] == 1
    assert execution["initialResults"]["failed"] == 1
    assert execution["finalResults"]["passed"] == 2


@pytest.mark.parametrize(
    ("state", "violation", "expected"),
    [
        ("valid", False, "compliant"),
        ("missing", False, "incomplete_evidence"),
        ("invalid", False, "incomplete_evidence"),
        ("stale", False, "incomplete_evidence"),
        ("inconsistent", False, "incomplete_evidence"),
        ("missing", True, "non_compliant"),
    ],
)
def test_quality_gate_conclusion_priority(state: str, violation: bool, expected: str) -> None:
    manifest = [{"id": "proof", "required": True, "status": state}]
    violations = (
        [reporting.reason("rule.failed", "confirmed violation", ["proof"])] if violation else []
    )

    assert reporting.quality_gate_conclusion(manifest, violations)["status"] == expected


def test_future_dimensions_are_visible_non_blocking_and_strategy_incomplete() -> None:
    dimensions = [
        {"id": "classification", "status": "valid", "reasons": []},
        {
            "id": "trends",
            "status": "not_measured",
            "reasons": [reporting.reason("future", "future PBI")],
        },
    ]

    assert reporting.strategy_evidence_conclusion(dimensions)["status"] == "incomplete"
    assert reporting.quality_gate_conclusion([], [])["status"] == "compliant"


@pytest.mark.parametrize("mutation", ["extra", "negative", "percent"])
def test_report_validator_rejects_unknown_fields_and_invalid_numbers(
    tmp_path: Path, mutation: str
) -> None:
    model = reporting.build_report_model(_repository(tmp_path), "pr", now=NOW)
    if mutation == "extra":
        model["unexpected"] = True
    elif mutation == "negative":
        model["profileExecution"]["attempts"] = -1
    else:
        model["profileExecution"]["governance"]["instabilityRatePercent"] = 101

    assert reporting.validate_report(model)


def test_unknown_source_version_and_inventory_hash_are_incomplete(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    counts_path = root / "reports/test-execution-counts.json"
    counts = json.loads(counts_path.read_text(encoding="utf-8"))
    counts["schemaVersion"] = "9.0.0"
    counts["classificationInventorySha256"] = "0" * 64
    _write_json(root, "reports/test-execution-counts.json", counts)
    model = reporting.build_report_model(root, "pr", now=NOW)

    proof = next(item for item in model["evidenceManifest"] if item["id"] == "execution-counts")
    assert proof["status"] == "invalid"
    assert model["conclusions"]["qualityGateStatus"] == "incomplete_evidence"


def test_missing_node_result_is_not_inferred_from_ci_dependency(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    (root / "reports/test-execution-artifacts/pr/backend-static/result.json").unlink()
    model = reporting.build_report_model(root, "pr", now=NOW)

    node = next(
        item for item in model["profileExecution"]["nodes"] if item["id"] == "backend-static"
    )
    assert node["status"] == "missing"
    assert model["conclusions"]["qualityGateStatus"] == "incomplete_evidence"


def test_pr_has_no_required_e2e_and_aggregate_does_not_require_itself(tmp_path: Path) -> None:
    model = reporting.build_report_model(_repository(tmp_path), "pr", now=NOW)
    nodes = {item["id"]: item for item in model["profileExecution"]["nodes"]}

    assert nodes["e2e"]["status"] == "not_applicable"
    assert nodes["aggregate"]["status"] == "not_applicable"
    assert nodes["aggregate"]["required"] is False


def test_governance_zeroes_are_explicit_and_violation_is_non_compliant(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    model = reporting.build_report_model(root, "pr", now=NOW)
    governance = model["profileExecution"]["governance"]
    assert all(
        governance[name] == 0
        for name in (
            "skips",
            "disabled",
            "expectedFailures",
            "quarantines",
            "retries",
            "exemptions",
            "expirations",
            "violations",
            "instabilities",
        )
    )

    path = root / "reports/test-governance-report.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["violations"] = ["ungoverned skip"]
    _write_json(root, "reports/test-governance-report.json", payload)
    assert (
        reporting.build_report_model(root, "pr", now=NOW)["conclusions"]["qualityGateStatus"]
        == "non_compliant"
    )


def test_coverage_thresholds_and_e2e_freshness() -> None:
    metrics = {"lines": {"total": 100, "covered": 95, "pct": 95.0}}
    assert reporting.coverage_conclusion(metrics, {"lines": 80}) == "valid"
    assert reporting.coverage_conclusion(metrics, {"lines": 96}) == "violation"
    config = {"artifactMaxAgeSeconds": 60}
    artifact = {"context": {"completedAt": "2026-07-22T11:00:00Z"}}
    assert reporting.e2e_freshness(artifact, config, NOW) == "stale"
    artifact["context"]["completedAt"] = "2026-07-22T11:59:30Z"
    assert reporting.e2e_freshness(artifact, config, NOW) == "valid"
    assert reporting.e2e_freshness({}, config, NOW) == "invalid"
    assert reporting.coverage_conclusion({}, {"lines": 80}) == "invalid"


def test_bundle_identity_is_stable_and_is_not_a_run_identity(tmp_path: Path) -> None:
    model = reporting.build_report_model(_repository(tmp_path), "pr", now=NOW)
    first = reporting.evidence_bundle_id("pr", model["evidenceManifest"])
    second = reporting.evidence_bundle_id("pr", list(reversed(model["evidenceManifest"])))

    assert first == second == model["evidenceBundleId"]
    assert "same physical execution" in model["evidenceBundleIdentityDisclaimer"]


def test_renderers_normalize_paths_omit_wall_clock_and_share_one_model(tmp_path: Path) -> None:
    model = reporting.build_report_model(_repository(tmp_path), "pr", now=NOW)
    json_bytes = reporting.render_json(model)
    markdown = reporting.render_markdown(model)

    assert b"C:\\" not in json_bytes
    assert b"generatedAt" not in json_bytes
    assert b"qualityGateStatus: `compliant`" in markdown
    assert str(model["profileExecution"]["selectedLogicalCases"]).encode() in markdown


def test_write_reports_and_cli_do_not_launch_test_runners(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    model = reporting.build_report_model(root, "pr", now=NOW)
    json_path = root / "reports/out.json"
    markdown_path = root / "reports/out.md"

    reporting.write_reports(model, json_path, markdown_path)
    source = Path(reporting.__file__).read_text(encoding="utf-8")
    assert "subprocess" not in source
    assert json.loads(json_path.read_text(encoding="utf-8")) == model
    assert markdown_path.read_bytes() == reporting.render_markdown(model)
    assert (
        reporting.main(
            [
                "--root",
                str(root),
                "--profile",
                "pr",
                "--output-json",
                str(json_path),
                "--output-markdown",
                str(markdown_path),
            ]
        )
        == 0
    )


def test_main_profile_adapts_all_coverage_sources_and_five_vitals(tmp_path: Path) -> None:
    root = _repository(tmp_path, "main")
    _add_main_coverage(root)
    model = reporting.build_report_model(root, "main", now=NOW)

    assert model["conclusions"]["qualityGateStatus"] == "compliant"
    assert [item["status"] for item in model["profileExecution"]["coverage"]] == [
        "valid",
        "valid",
        "valid",
        "valid",
    ]
    assert len(model["profileExecution"]["vitals"]) == 5
    assert all(item["status"] == "valid" for item in model["profileExecution"]["vitals"])


def test_stale_e2e_and_below_threshold_coverage_are_distinguished(tmp_path: Path) -> None:
    stale_root = _repository(tmp_path / "stale", "main")
    _add_main_coverage(stale_root, e2e_completed="2026-07-22T10:00:00Z")
    stale = reporting.build_report_model(stale_root, "main", now=NOW)
    assert (
        next(item for item in stale["evidenceManifest"] if item["id"] == "coverage-e2e")["status"]
        == "stale"
    )
    assert stale["conclusions"]["qualityGateStatus"] == "incomplete_evidence"

    failing_root = _repository(tmp_path / "failing", "main")
    _add_main_coverage(failing_root)
    python_path = failing_root / ".coverage.python.json"
    python = json.loads(python_path.read_text(encoding="utf-8"))
    python["totals"]["missing_lines"] = 1
    _write_json(failing_root, ".coverage.python.json", python)
    failing = reporting.build_report_model(failing_root, "main", now=NOW)
    assert failing["conclusions"]["qualityGateStatus"] == "non_compliant"


def test_invalid_and_missing_source_native_and_node_evidence(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    (root / "config/test-classification.json").unlink()
    (root / "reports/test-execution-counts.json").write_text('{"a":1,"a":2}', encoding="utf-8")
    (root / "reports/test-execution-native/pytest.json").write_text("{", encoding="utf-8")
    (root / "reports/test-execution-native/vitest.json").unlink()
    (root / "reports/test-execution-artifacts/pr/backend-tests/result.json").write_text(
        "{", encoding="utf-8"
    )
    model = reporting.build_report_model(root, "pr", now=NOW)
    statuses = {item["id"]: item["status"] for item in model["evidenceManifest"]}

    assert statuses["classification-catalog"] == "missing"
    assert statuses["execution-counts"] == "invalid"
    assert statuses["runtime-pytest"] == "invalid"
    assert statuses["runtime-vitest"] == "missing"
    assert statuses["node-backend-tests"] == "invalid"


def test_inconsistent_runtime_governance_failed_execution_and_node_are_violations(
    tmp_path: Path,
) -> None:
    root = _repository(tmp_path)
    pytest_path = root / "reports/test-execution-native/pytest.json"
    native = json.loads(pytest_path.read_text(encoding="utf-8"))
    native["instances"] = []
    _write_json(root, "reports/test-execution-native/pytest.json", native)
    governance_path = root / "reports/test-governance-report.json"
    governance = json.loads(governance_path.read_text(encoding="utf-8"))
    governance["profile"] = "main"
    _write_json(root, "reports/test-governance-report.json", governance)
    node_path = root / "reports/test-execution-artifacts/pr/backend-static/result.json"
    node = json.loads(node_path.read_text(encoding="utf-8"))
    node["exitCode"] = 3
    _write_json(root, "reports/test-execution-artifacts/pr/backend-static/result.json", node)
    model = reporting.build_report_model(root, "pr", now=NOW)

    assert (
        next(item for item in model["evidenceManifest"] if item["id"] == "runtime-pytest")["status"]
        == "inconsistent"
    )
    assert (
        next(item for item in model["evidenceManifest"] if item["id"] == "governance")["status"]
        == "inconsistent"
    )
    assert model["conclusions"]["qualityGateStatus"] == "non_compliant"


def test_remaining_inconsistency_and_violation_branches_are_structured(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    counts_path = root / "reports/test-execution-counts.json"
    counts = json.loads(counts_path.read_text(encoding="utf-8"))
    counts["classificationInventorySha256"] = "0" * 64
    _write_json(root, "reports/test-execution-counts.json", counts)
    native_path = root / "reports/test-execution-native/pytest.json"
    native = json.loads(native_path.read_text(encoding="utf-8"))
    native["instances"][0].update(
        result="failed", initialResult="failed", finalResult="failed", attemptResults=["failed"]
    )
    _write_json(root, "reports/test-execution-native/pytest.json", native)
    model = reporting.build_report_model(root, "pr", now=NOW)
    assert (
        next(item for item in model["evidenceManifest"] if item["id"] == "execution-counts")[
            "status"
        ]
        == "inconsistent"
    )
    assert model["conclusions"]["qualityGateStatus"] == "non_compliant"

    entry = reporting._manifest("proof", "proof.json", "test", "profileExecution")
    reporting._mark(entry, "stale", reporting.reason("stale", "stale"))
    assert entry["freshness"] == "stale"
    reporting._mark(entry, "invalid", reporting.reason("invalid", "invalid"))
    assert entry["validity"] == "invalid"
    missing = reporting._manifest("missing", "missing.json", "test", "profileExecution")
    reporting._mark(missing, "missing", reporting.reason("missing", "missing"))
    assert missing["freshness"] == "not_measurable"
    assert missing["presence"] == "missing"
    assert missing["validity"] == "unknown"
    assert missing["consistency"] == "unknown"
    invalid = reporting._manifest(
        "invalid", "invalid.json", "test", "profileExecution", status="invalid"
    )
    assert invalid["presence"] == "present"
    assert invalid["validity"] == "invalid"
    assert invalid["consistency"] == "unknown"
    not_measured = reporting._manifest(
        "future",
        "future.json",
        "test",
        "strategicCoverage",
        required=False,
        status="not_measured",
    )
    assert not_measured["requirement"] == "not_measured"
    assert not_measured["presence"] == "not_measured"
    assert not_measured["validity"] == "not_measured"
    assert not_measured["freshness"] == "not_measured"
    assert not_measured["consistency"] == "not_measured"
    reporting._mark(
        not_measured,
        "not_applicable",
        reporting.reason("not_applicable", "not applicable"),
    )
    assert not_measured["requirement"] == "not_applicable"


def test_invalid_governance_and_low_vital_are_reported(tmp_path: Path) -> None:
    root = _repository(tmp_path, "main")
    _add_main_coverage(root)
    governance_path = root / "reports/test-governance-report.json"
    governance = json.loads(governance_path.read_text(encoding="utf-8"))
    governance["schemaVersion"] = "bad"
    governance["profile"] = "pr"
    _write_json(root, "reports/test-governance-report.json", governance)
    vitals_path = root / "frontend/coverage/vitals-coverage-report.json"
    vitals = json.loads(vitals_path.read_text(encoding="utf-8"))
    vitals["report"][0]["sources"]["backend"]["metrics"]["lines"]["covered"] = 94
    _write_json(root, "frontend/coverage/vitals-coverage-report.json", vitals)
    model = reporting.build_report_model(root, "main", now=NOW)
    assert (
        next(item for item in model["profileExecution"]["vitals"] if item["id"] == "CP-001")[
            "status"
        ]
        == "violation"
    )
    assert (
        next(item for item in model["evidenceManifest"] if item["id"] == "governance")["status"]
        == "invalid"
    )


def test_validator_and_cli_error_paths_are_explicit(tmp_path: Path, monkeypatch) -> None:
    root = _repository(tmp_path)
    model = reporting.build_report_model(root, "pr", now=NOW)
    model["schemaVersion"] = "9"
    model["profile"] = "bad"
    model["evidenceBundleId"] = "bad"
    model["evidenceManifest"][0]["path"] = "C:\\absolute"
    assert len(reporting.validate_report(model)) >= 4
    broken = deepcopy(model)
    broken["profileExecution"] = {}
    assert any("profileExecution" in error for error in reporting.validate_report(broken))
    with pytest.raises(ValueError):
        reporting.write_reports(model, root / "bad.json", root / "bad.md")
    with pytest.raises(ValueError, match="Unsupported"):
        reporting.build_report_model(root, "bad")
    monkeypatch.setattr(
        reporting,
        "build_report_model",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(ValueError("boom")),
    )
    assert reporting.main(["--root", str(root), "--profile", "pr"]) == 2


def test_duplicate_node_json_is_rejected_as_materially_invalid(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    path = root / "reports/test-execution-artifacts/pr/preflight/result.json"
    path.write_text(
        '{"schemaVersion": 1, "schemaVersion": 1, "profile": "pr", '
        '"node": "preflight", "exitCode": 0, "durationSeconds": 1}\n',
        encoding="utf-8",
    )
    model = reporting.build_report_model(root, "pr", now=NOW)
    evidence = next(item for item in model["evidenceManifest"] if item["id"] == "node-preflight")
    assert evidence["status"] == "invalid"


def test_module_entrypoint_and_schema_contract(tmp_path: Path, monkeypatch) -> None:
    root = _repository(tmp_path)
    schema = json.loads(
        (reporting.ROOT / "config/test-strategy-report.schema.json").read_text(encoding="utf-8")
    )
    assert schema["x-schemaVersion"] == reporting.SCHEMA_VERSION
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == set(reporting.REPORT_KEYS)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "report_test_strategy.py",
            "--root",
            str(root),
            "--profile",
            "pr",
            "--output-json",
            str(root / "reports/entry.json"),
            "--output-markdown",
            str(root / "reports/entry.md"),
        ],
    )
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_path(str(reporting.ROOT / "Scripts/report_test_strategy.py"), run_name="__main__")
    assert exit_info.value.code == 0


def test_reporting_is_planned_once_for_every_execution_profile() -> None:
    for profile in reporting.PROFILES:
        plan = quality_gate.build_execution_plan(
            quality_gate.build_change_context("ci", [], execution_profile=profile)
        )
        steps = [command.step for command in plan.commands]
        assert steps.count("Verify global execution count reference") == 1
        assert steps.count("Test strategy reporting") == 1
        assert steps.index("Test governance compliance") < steps.index("Test strategy reporting")
