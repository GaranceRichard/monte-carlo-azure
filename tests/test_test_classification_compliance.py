from __future__ import annotations

import hashlib
import json
import runpy
import sys
from copy import deepcopy
from datetime import date
from pathlib import Path

import pytest

from Scripts import check_test_classification as classification_cli
from Scripts import quality_gate
from Scripts import test_classification_compliance as compliance
from Scripts import test_classification_inventory_validation as inventory_validation
from Scripts.test_classification_catalog_validation import validate_catalog
from Scripts.test_classification_contract import (
    unique_string_errors,
    validate_exemption,
    validate_record_compliance,
)
from Scripts.test_classification_overrides_validation import validate_overrides
from Scripts.test_classification_rules_validation import validate_match, validate_rules
from Scripts.test_classifier_discovery import LogicalCase
from Scripts.test_classifier_engine import classify_inventory

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATHS = (
    compliance.CATALOG_PATH,
    compliance.SCHEMA_PATH,
    compliance.RULES_PATH,
    compliance.OVERRIDES_PATH,
)


def _case(selector: str = "test_behavior", **evidence: object) -> LogicalCase:
    observed = {
        "imports": ["Scripts.check_test_classification"],
        "calls": ["validate_repository"],
        "fixtures": [],
        "resources": [],
        "modifiers": [],
        "conditional": False,
        "dynamicTitle": False,
    }
    observed.update(evidence)
    return LogicalCase("pytest", "tests/test_sample.py", selector, observed)


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _load_configuration() -> tuple[dict, dict, dict, dict]:
    return tuple(deepcopy(compliance.load_json(ROOT / path)) for path in CONFIG_PATHS)  # type: ignore[return-value]


def _build_repository(
    root: Path,
    cases: list[LogicalCase],
    *,
    overrides: dict | None = None,
) -> list[dict]:
    catalog, schema, rules, default_overrides = _load_configuration()
    selected_overrides = overrides if overrides is not None else default_overrides
    for path, value in zip(
        CONFIG_PATHS,
        (catalog, schema, rules, selected_overrides),
        strict=True,
    ):
        _write_json(root / path, value)
    inventory = classify_inventory(cases, rules, selected_overrides, catalog, schema)
    inventory_path = root / compliance.INVENTORY_PATH
    inventory_path.parent.mkdir(parents=True, exist_ok=True)
    inventory_path.write_bytes(compliance.inventory_bytes(inventory))
    fingerprint = hashlib.sha256(inventory_path.read_bytes()).hexdigest()
    _write_json(
        root / compliance.EXECUTION_REPORT_PATH,
        {"classificationInventorySha256": fingerprint},
    )
    return inventory


def _validate(root: Path, cases: list[LogicalCase], *, today: date | None = None) -> list[str]:
    return compliance.validate_repository(
        root,
        today=today or date(2026, 7, 18),
        discoverer=lambda _root, _node: cases,
    )


def test_added_test_without_regeneration_is_blocking(tmp_path: Path) -> None:
    first = _case()
    added = _case("test_added")
    _build_repository(tmp_path, [first])

    errors = _validate(tmp_path, [first, added])

    assert any("discovered cases absent from inventory" in error for error in errors)
    assert any("generated inventory differs" in error for error in errors)


def test_removed_test_still_in_inventory_is_blocking(tmp_path: Path) -> None:
    first = _case()
    removed = _case("test_removed")
    _build_repository(tmp_path, [first, removed])

    errors = _validate(tmp_path, [first])

    assert any("no longer discovered" in error for error in errors)


def test_duplicate_discovery_and_inventory_are_blocking(tmp_path: Path) -> None:
    case = _case()
    inventory = _build_repository(tmp_path, [case])
    _write_json(tmp_path / compliance.INVENTORY_PATH, [*inventory, *inventory])

    errors = _validate(tmp_path, [case, case])

    assert any("duplicate discovered logical cases" in error for error in errors)
    assert any("duplicate inventory logical cases" in error for error in errors)


def test_unresolved_classification_is_blocking(tmp_path: Path) -> None:
    ambiguous = _case(imports=[], calls=[])
    inventory = _build_repository(tmp_path, [ambiguous])
    assert inventory[0]["status"] == "unresolved"

    errors = _validate(tmp_path, [ambiguous])

    assert any("unresolved classifications are blocking" in error for error in errors)


@pytest.mark.parametrize(
    ("mutation", "expected"),
    [
        (lambda record: record.update(nature="invalid"), "outside the catalog vocabulary"),
        (lambda record: record.update(unexpected=True), "unknown properties"),
        (lambda record: record.update(risks=["RISK-99"]), "invalid identifier"),
        (lambda record: record.update(criticalPaths=["CP-1000"]), "invalid identifier"),
        (lambda record: record.update(purposes=["functional", "functional"]), "duplicate values"),
        (lambda record: record.pop("executionProfile"), "classified status missing"),
    ],
)
def test_invalid_record_values_fields_and_cardinalities_are_blocking(
    tmp_path: Path, mutation, expected: str
) -> None:
    case = _case()
    inventory = _build_repository(tmp_path, [case])
    mutation(inventory[0])
    _write_json(tmp_path / compliance.INVENTORY_PATH, inventory)

    assert any(expected in error for error in _validate(tmp_path, [case]))


def test_valid_strict_override_resolves_an_ambiguous_case(tmp_path: Path) -> None:
    case = _case(imports=[], calls=[])
    overrides = {
        "overridesVersion": "1.0.0",
        "overrides": [
            {
                "target": {
                    "framework": case.framework,
                    "sourcePath": case.source_path,
                    "selector": case.selector,
                },
                "classification": {
                    "status": "classified",
                    "nature": "unit",
                    "purposes": ["functional"],
                    "executionProfile": "main",
                },
                "justification": "Static discovery cannot follow the injected pure callable.",
                "evidence": "The test invokes the in-memory callable and no external boundary.",
            }
        ],
    }
    inventory = _build_repository(tmp_path, [case], overrides=overrides)

    assert inventory[0]["status"] == "classified"
    assert _validate(tmp_path, [case]) == []


@pytest.mark.parametrize("defect", ["orphan", "duplicate", "missing_evidence"])
def test_orphan_duplicate_or_unproven_override_is_blocking(
    tmp_path: Path, defect: str
) -> None:
    case = _case()
    entry = {
        "target": {
            "framework": case.framework,
            "sourcePath": case.source_path,
            "selector": case.selector,
        },
        "classification": {
            "status": "classified",
            "nature": "unit",
            "purposes": ["functional"],
            "executionProfile": "main",
        },
        "justification": "Audited exceptional case.",
        "evidence": "Observable direct call in the test body.",
    }
    entries = [entry]
    if defect == "orphan":
        entry["target"]["selector"] = "test_missing"
    elif defect == "duplicate":
        entries.append(deepcopy(entry))
    else:
        entry["evidence"] = ""
    overrides = {"overridesVersion": "1.0.0", "overrides": entries}
    _build_repository(tmp_path, [case])
    _write_json(tmp_path / compliance.OVERRIDES_PATH, overrides)

    errors = _validate(tmp_path, [case])

    expected = {
        "orphan": "orphan logical case",
        "duplicate": "duplicates an override target",
        "missing_evidence": "evidence must be non-empty",
    }[defect]
    assert any(expected in error for error in errors)


def _exemption_override(case: LogicalCase, expires_on: str = "2026-08-31") -> dict:
    return {
        "overridesVersion": "1.0.0",
        "overrides": [
            {
                "target": {
                    "framework": case.framework,
                    "sourcePath": case.source_path,
                    "selector": case.selector,
                },
                "classification": {
                    "status": "exempted",
                    "exemption": {
                        "justification": "Temporary approved migration gap.",
                        "owner": "quality-owner",
                        "approver": "technical-lead",
                        "expiresOn": expires_on,
                    },
                },
                "justification": "Temporary approved migration gap.",
                "evidence": "Approval record QUALITY-42 documents the temporary gap.",
            }
        ],
    }


def test_valid_approved_non_expired_exemption_is_accepted(tmp_path: Path) -> None:
    case = _case(imports=[], calls=[])
    overrides = _exemption_override(case)
    _build_repository(tmp_path, [case], overrides=overrides)

    assert _validate(tmp_path, [case]) == []


@pytest.mark.parametrize(
    ("mutation", "expected"),
    [
        (lambda exemption: exemption.update(expiresOn="2026-01-01"), "expired on"),
        (lambda exemption: exemption.pop("approver"), "missing: approver"),
        (lambda exemption: exemption.update(owner=""), "owner must be a non-empty"),
        (lambda exemption: exemption.update(expiresOn="31-08-2026"), "canonical ISO date"),
    ],
)
def test_expired_or_incomplete_exemption_is_blocking(
    tmp_path: Path, mutation, expected: str
) -> None:
    case = _case(imports=[], calls=[])
    overrides = _exemption_override(case)
    exemption = overrides["overrides"][0]["classification"]["exemption"]
    mutation(exemption)
    _build_repository(tmp_path, [case])
    _write_json(tmp_path / compliance.OVERRIDES_PATH, overrides)

    assert any(expected in error for error in _validate(tmp_path, [case]))


def test_generated_and_versioned_inventory_divergence_is_blocking(tmp_path: Path) -> None:
    case = _case()
    inventory = _build_repository(tmp_path, [case])
    inventory[0]["purposes"].append("observability")
    _write_json(tmp_path / compliance.INVENTORY_PATH, inventory)

    errors = _validate(tmp_path, [case])

    assert any("generated inventory differs" in error for error in errors)
    assert any("execution report fingerprint differs" in error for error in errors)


def test_catalog_schema_and_rule_contract_defects_are_blocking(tmp_path: Path) -> None:
    case = _case()
    _build_repository(tmp_path, [case])
    catalog = compliance.load_json(tmp_path / compliance.CATALOG_PATH)
    schema = compliance.load_json(tmp_path / compliance.SCHEMA_PATH)
    rules = compliance.load_json(tmp_path / compliance.RULES_PATH)
    catalog["unexpected"] = True
    catalog["dimensions"]["nature"]["values"].append("unknown")
    catalog["dimensions"]["purpose"]["cardinality"]["minimum"] = 0
    schema["additionalProperties"] = True
    schema["properties"]["risks"]["items"]["pattern"] = "RISK-.*"
    schema["allOf"] = schema["allOf"][:-1]
    rules["natureRules"].append(deepcopy(rules["natureRules"][0]))
    _write_json(tmp_path / compliance.CATALOG_PATH, catalog)
    _write_json(tmp_path / compliance.SCHEMA_PATH, schema)
    _write_json(tmp_path / compliance.RULES_PATH, rules)

    errors = _validate(tmp_path, [case])

    assert any("catalog: unknown properties" in error for error in errors)
    assert any("vocabulary mismatch" in error for error in errors)
    assert any("purpose has invalid cardinality" in error for error in errors)
    assert any("reject unknown" in error for error in errors)
    assert any("risks format" in error for error in errors)
    assert any("status rules do not cover" in error for error in errors)
    assert any("globally unique" in error for error in errors)
    assert any("duplicates another rule" in error for error in errors)


def test_validation_helpers_reject_malformed_contract_shapes(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"x": 1, "x": 2}', encoding="utf-8")
    with pytest.raises(ValueError, match="duplicate JSON property"):
        compliance.load_json(duplicate)
    with pytest.raises(ValueError, match="invalid JSON artifact"):
        compliance.load_json(tmp_path / "missing.json")

    assert unique_string_errors(None, "values")
    assert unique_string_errors([], "values", allow_empty=True) == []
    assert unique_string_errors([""], "values")
    assert unique_string_errors(["duplicate", "duplicate"], "values")
    assert validate_catalog([], {}) == [
        "catalog and schema must be JSON objects"
    ]
    assert any(
        "must be objects" in error for error in validate_catalog({}, {})
    )

    catalog, schema, rules, _overrides = _load_configuration()
    malformed_catalog = deepcopy(catalog)
    malformed_schema = deepcopy(schema)
    malformed_catalog["catalogVersion"] = "invalid"
    malformed_catalog["dimensions"]["extra"] = {}
    malformed_schema["properties"]["extra"] = {}
    malformed_catalog["dimensions"]["nature"] = None
    malformed_catalog["dimensions"]["purpose"]["recordField"] = "wrong"
    malformed_catalog["identifierFormats"] = {}
    malformed_catalog["resolutionRules"] = "wrong"
    malformed_schema["required"] = []
    malformed_schema["properties"]["executionProfile"] = None
    malformed_schema["properties"]["purposes"]["minItems"] = 0
    malformed_schema["properties"]["exemption"] = None
    malformed_schema["allOf"] = [None]
    catalog_errors = validate_catalog(malformed_catalog, malformed_schema)
    assert any("nature must be an object" in error for error in catalog_errors)
    assert any("versions do not match" in error for error in catalog_errors)
    assert any("dimensions do not match" in error for error in catalog_errors)
    assert any("record properties do not match" in error for error in catalog_errors)
    assert any("purpose targets the wrong field" in error for error in catalog_errors)
    assert any("executionProfile must be an object" in error for error in catalog_errors)
    assert any("purposes has invalid cardinality" in error for error in catalog_errors)
    assert any("identifier formats" in error for error in catalog_errors)
    assert any("exemption governance" in error for error in catalog_errors)
    assert any("resolutionRules must be an array" in error for error in catalog_errors)

    duplicate_resolution = deepcopy(catalog)
    duplicate_resolution["resolutionRules"].append(
        deepcopy(duplicate_resolution["resolutionRules"][0])
    )
    assert any(
        "unique identifiers" in error
        for error in validate_catalog(duplicate_resolution, schema)
    )
    incomplete_status_schema = deepcopy(schema)
    incomplete_status_schema["allOf"][0]["then"]["required"] = []
    assert any(
        "classified status has incomplete" in error
        for error in validate_catalog(catalog, incomplete_status_schema)
    )
    non_array_status_schema = deepcopy(schema)
    non_array_status_schema["allOf"] = {}
    assert any(
        "status rules do not cover" in error
        for error in validate_catalog(catalog, non_array_status_schema)
    )

    assert validate_match(None, "rule") == ["rule.match must be an object"]
    match_errors = validate_match(
        {
            "unexpected": True,
            "frameworks": [],
            "all": [],
            "any": {"calls": ["["]},
            "none": {"calls": "wrong"},
        },
        "rule",
    )
    assert any("unknown properties" in error for error in match_errors)
    assert any("frameworks: expected" in error for error in match_errors)
    assert any("all must be an object" in error for error in match_errors)
    assert any("invalid regex" in error for error in match_errors)
    assert any("none.calls: expected" in error for error in match_errors)
    assert any(
        "values must be non-empty strings" in error
        for error in validate_match({"any": {"calls": [42]}}, "rule")
    )

    assert validate_rules([], catalog) == [
        "classification rules must be a JSON object"
    ]
    malformed_rules = deepcopy(rules)
    malformed_rules["rulesVersion"] = "invalid"
    malformed_rules["unexpected"] = True
    malformed_rules["automation"] = []
    malformed_rules["defaults"] = []
    malformed_rules["natureRules"] = [
        None,
        {
            "id": "",
            "priority": -1,
            "nature": "invalid",
            "requiresBehaviorEvidence": False,
            "match": None,
        },
    ]
    malformed_rules["purposeRules"] = [
        {
            "id": "purpose",
            "priority": 1,
            "values": ["invalid"],
            "match": {},
        }
    ]
    malformed_rules["domainRules"] = "wrong"
    malformed_rules["traceabilityRules"] = [
        {
            "id": "trace",
            "priority": 1,
            "risks": ["RISK-1"],
            "criticalPaths": ["CP-1"],
            "criticality": "invalid",
            "match": {},
        },
        {
            "id": "trace-without-identifiers",
            "priority": 2,
            "criticality": "low",
            "match": {},
        },
    ]
    rule_errors = validate_rules(malformed_rules, catalog)
    for expected in (
        "rules: unknown properties",
        "rules version must be 1.0.0",
        "natureRules[0] must be an object",
        "globally unique",
        "priority must be",
        "nature is outside",
        "must require behavioral evidence",
        "values are outside",
        "domainRules must be an array",
        "risks contains an invalid",
        "criticalPaths contains an invalid",
        "criticality is outside",
        "automation profile is outside",
        "default purpose is outside",
    ):
        assert any(expected in error for error in rule_errors), expected


def test_record_override_and_exemption_shape_failures_are_reported() -> None:
    catalog, _schema, _rules, _overrides = _load_configuration()
    today = date(2026, 7, 18)
    assert validate_exemption(None, "exemption", today)
    basic_date = {
        "justification": "approved",
        "owner": "owner",
        "approver": "approver",
        "expiresOn": "20260831",
        "unexpected": True,
    }
    exemption_errors = validate_exemption(basic_date, "exemption", today)
    assert any("unknown properties" in error for error in exemption_errors)
    assert any("canonical ISO date" in error for error in exemption_errors)

    assert validate_record_compliance(None, catalog, "record", today)
    record = {
        "logicalCaseId": "wrong",
        "framework": "invalid",
        "sourcePath": "tests/test_sample.py",
        "selector": "test_behavior",
        "status": "classified",
        "nature": "unit",
        "purposes": ["invalid"],
        "executionProfile": "main",
        "domains": ["invalid"],
        "risks": ["RISK-999"],
        "criticalPaths": ["CP-999"],
        "unresolvedReason": "incompatible",
    }
    record_errors = validate_record_compliance(record, catalog, "record", today)
    assert any("framework is outside" in error for error in record_errors)
    assert sum("outside the catalog vocabulary" in error for error in record_errors) >= 3
    assert sum("requires criticality" in error for error in record_errors) == 2
    assert any("logicalCaseId contradicts" in error for error in record_errors)
    assert any("incompatible metadata" in error for error in record_errors)

    missing_multiple = deepcopy(record)
    missing_multiple["purposes"] = []
    assert any(
        "expected a non-empty array" in error
        for error in validate_record_compliance(
            missing_multiple, catalog, "record", today
        )
    )
    invalid_multiple = deepcopy(record)
    invalid_multiple["purposes"] = [""]
    assert any(
        "values must be non-empty strings" in error
        for error in validate_record_compliance(
            invalid_multiple, catalog, "record", today
        )
    )
    non_string_identity = deepcopy(record)
    non_string_identity["framework"] = None
    assert validate_record_compliance(non_string_identity, catalog, "record", today)

    unresolved = deepcopy(record)
    unresolved.update(status="unresolved", unresolvedReason="", exemption={})
    unresolved_errors = validate_record_compliance(unresolved, catalog, "record", today)
    assert any("requires a reason" in error for error in unresolved_errors)
    assert any("cannot contain an exemption" in error for error in unresolved_errors)
    exempted = deepcopy(record)
    exempted.update(status="exempted", exemption=None)
    assert any(
        "cannot contain an unresolved reason" in error
        for error in validate_record_compliance(exempted, catalog, "record", today)
    )

    case = _case()
    assert validate_overrides(None, [case], catalog, today)
    assert validate_overrides({"overrides": None}, [case], catalog, today)
    malformed_entries = {
        "overrides": [
            None,
            {"target": None},
            {
                "target": {"framework": "", "sourcePath": "x", "selector": "y"},
                "justification": "proof",
                "evidence": "proof",
                "classification": None,
            },
            {
                "target": {
                    "framework": case.framework,
                    "sourcePath": case.source_path,
                    "selector": case.selector,
                },
                "justification": "proof",
                "evidence": "proof",
                "classification": {},
            },
        ]
    }
    override_errors = validate_overrides(
        malformed_entries, [case], catalog, today
    )
    for expected in (
        "overrides version must be 1.0.0",
        "overrides[0] must be an object",
        "overrides[1].target must be an object",
        "three exact non-empty",
        "classification must be an object",
        "classification must declare status",
    ):
        assert any(expected in error for error in override_errors), expected


def test_repository_operational_failures_are_blocking(
    tmp_path: Path, monkeypatch
) -> None:
    assert inventory_validation.validate_versioned_records(
        [], None, date(2026, 7, 18)
    ) == ([], [])
    errors = compliance.validate_repository(
        tmp_path,
        discoverer=lambda *_args: (_ for _ in ()).throw(RuntimeError("collector failed")),
    )
    assert any("invalid JSON artifact" in error for error in errors)
    assert any("logical test discovery failed" in error for error in errors)
    assert any("inventory must be a JSON array" in error for error in errors)
    assert any("execution report must be a JSON object" in error for error in errors)

    case = _case()
    inventory = _build_repository(tmp_path, [case, _case("test_second")])
    _write_json(tmp_path / compliance.INVENTORY_PATH, list(reversed(inventory)))
    assert any("not sorted" in error for error in _validate(tmp_path, [case]))

    _build_repository(tmp_path, [case])
    monkeypatch.setattr(
        inventory_validation,
        "classify_inventory",
        lambda *_args: (_ for _ in ()).throw(ValueError("bad generation")),
    )
    assert any(
        "in-memory inventory generation failed" in error
        for error in _validate(tmp_path, [case])
    )


def test_repository_detects_nondeterminism_and_read_races(
    tmp_path: Path, monkeypatch
) -> None:
    case = _case()
    inventory = _build_repository(tmp_path, [case])
    original_classifier = inventory_validation.classify_inventory
    calls = iter([inventory, [inventory[0] | {"purposes": ["observability"]}]])
    monkeypatch.setattr(inventory_validation, "classify_inventory", lambda *_args: next(calls))
    assert any("not deterministic" in error for error in _validate(tmp_path, [case]))

    monkeypatch.setattr(inventory_validation, "classify_inventory", original_classifier)
    original_read_bytes = Path.read_bytes

    def fail_inventory_read(path: Path) -> bytes:
        if path == tmp_path / compliance.INVENTORY_PATH:
            raise OSError("read race")
        return original_read_bytes(path)

    monkeypatch.setattr(Path, "read_bytes", fail_inventory_read)
    errors = _validate(tmp_path, [case])
    assert any("versioned classification inventory cannot be read" in error for error in errors)
    assert any("fingerprint cannot be computed" in error for error in errors)


def test_control_is_present_once_with_the_correct_input_in_each_gate_plan() -> None:
    expected_source = {
        "fast": quality_gate.InputSource.GIT_INDEX,
        "push": quality_gate.InputSource.HEAD,
        "ci": quality_gate.InputSource.WORKSPACE,
    }
    for mode, source in expected_source.items():
        commands = quality_gate.execution_plan(mode, False)
        matches = [
            command for command in commands if command.step == "Test classification compliance"
        ]
        assert len(matches) == 1
        assert matches[0].input_sources == (source,)


def test_control_is_in_coverage_eight_terminals_once() -> None:
    tasks = json.loads((ROOT / ".vscode/tasks.json").read_text(encoding="utf-8"))
    by_label = {task["label"]: task for task in tasks["tasks"]}
    aggregate = by_label["Coverage: 8 terminaux"]
    assert aggregate["dependsOn"].count("Coverage (Staged)") == 1
    staged_script = (ROOT / ".vscode/scripts/run-coverage-staged.ps1").read_text(
        encoding="utf-8"
    )
    assert staged_script.count("Scripts/check_test_classification.py") == 1


def test_classification_files_are_massive_changes() -> None:
    paths = [
        "config/test-classification.json",
        "config/test-classification.schema.json",
        "config/test-classification-rules.json",
        "config/test-classification-overrides.json",
        "Scripts/classify_tests.py",
        "Scripts/test_classifier_discovery.py",
        "Scripts/test_classifier_engine.py",
        "Scripts/collect_js_tests.mjs",
        "reports/test-classification-inventory.json",
        "reports/test-execution-counts.json",
    ]
    assert all(
        decision.level == quality_gate.ChangeLevel.MASSIVE
        for decision in quality_gate.classify_changes(paths).path_decisions
    )


def test_cli_reports_failure_success_and_main_guard(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    case = _case()
    _build_repository(tmp_path, [case])
    monkeypatch.setattr(
        classification_cli, "validate_repository", lambda *_args, **_kwargs: ["bad"]
    )
    assert classification_cli.main(["--root", str(tmp_path)]) == 1
    assert "bad" in capsys.readouterr().err
    monkeypatch.setattr(
        classification_cli, "validate_repository", lambda *_args, **_kwargs: []
    )
    assert classification_cli.main(["--root", str(tmp_path)]) == 0
    assert "unresolved=0" in capsys.readouterr().out

    monkeypatch.setattr(sys, "argv", ["check_test_classification.py", "--help"])
    with pytest.raises(SystemExit) as exc:
        runpy.run_path(
            str(ROOT / "Scripts/check_test_classification.py"), run_name="__main__"
        )
    assert exc.value.code == 0


def test_real_repository_is_compliant_with_zero_unresolved() -> None:
    inventory = compliance.load_json(ROOT / compliance.INVENTORY_PATH)
    assert not compliance.validate_repository(ROOT)
    assert all(record["status"] != "unresolved" for record in inventory)
