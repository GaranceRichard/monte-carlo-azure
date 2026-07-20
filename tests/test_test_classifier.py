from __future__ import annotations

import runpy
import sys
from pathlib import Path

import pytest

from Scripts import classify_tests
from Scripts.test_classifier_discovery import (
    LogicalCase,
    discover_all,
    discover_javascript,
    discover_pytest,
)
from Scripts.test_classifier_engine import (
    classify_case,
    classify_inventory,
    rule_matches,
    validate_record,
)

ROOT = Path(__file__).resolve().parents[1]


def _write(root: Path, relative: str, content: str) -> None:
    destination = root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(content, encoding="utf-8")


def _configuration() -> tuple[dict, dict, dict, dict]:
    return (
        classify_tests.load_json(ROOT / "config/test-classification-rules.json"),
        classify_tests.load_json(ROOT / "config/test-classification-overrides.json"),
        classify_tests.load_json(ROOT / "config/test-classification.json"),
        classify_tests.load_json(ROOT / "config/test-classification.schema.json"),
    )


def _case(framework: str, **evidence) -> LogicalCase:
    defaults = {
        "imports": [],
        "calls": [],
        "fixtures": [],
        "resources": [],
        "modifiers": [],
        "conditional": False,
        "dynamicTitle": False,
    }
    defaults.update(evidence)
    extension = "py" if framework == "pytest" else "ts"
    return LogicalCase(framework, f"tests/example.{extension}", "suite::test_behavior", defaults)


def test_pytest_ast_discovers_collectable_logical_cases_once(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "tests/test_sample.py",
        """
import pytest
from backend.mc_core import FinishWeeksSimulation

@pytest.fixture
def test_fixture():
    return 1

def helper():
    return 2

@pytest.mark.parametrize("value", [1, 2, 3])
def test_parameterized(value):
    assert value

class TestOuter:
    def test_method(self):
        FinishWeeksSimulation

    class TestNested:
        async def test_async_method(self):
            assert True

if True:
    def test_conditional():
        assert True

def factory():
    def test_not_collectable():
        assert False
""",
    )
    _write(tmp_path, "tests/helpers.py", "def test_not_in_test_file(): pass\n")

    cases = discover_pytest(tmp_path)

    assert [case.selector for case in cases] == [
        "test_parameterized",
        "TestOuter::test_method",
        "TestOuter::TestNested::test_async_method",
        "test_conditional",
    ]
    assert cases[0].evidence["modifiers"] == ["pytest.mark.parametrize"]
    assert cases[-1].evidence["conditional"] is True
    assert len({case.logical_case_id for case in cases}) == 4


def test_pytest_discovery_handles_missing_tree_and_alternate_filename(tmp_path: Path) -> None:
    assert discover_pytest(tmp_path) == []
    _write(tmp_path, "tests/sample_test.py", "def test_alternate():\n    assert True\n")
    assert discover_pytest(tmp_path)[0].selector == "test_alternate"


def test_typescript_collector_discovers_nested_each_skipped_and_playwright(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "frontend/src/sample.test.ts",
        """
import { describe as suite, it, test, beforeEach } from "vitest";
import { compute } from "./sample";
beforeEach(() => compute(0));
suite("outer", () => {
  suite("inner", () => {
    it.each([1, 2])("handles %s", (value) => compute(value));
    test.skip("ignored but collectable", () => compute(3));
    test.runIf(true)("conditional variant", () => compute(4));
  });
});
function helper() { return test; }
""",
    )
    _write(
        tmp_path,
        "frontend/tests/e2e/flow.spec.js",
        """
import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 100 } });
test.describe("flow", () => {
  test("opens", async ({ page }) => {
    await page.goto("/");
    await expect(page).toBeTruthy();
  });
});
""",
    )

    cases = discover_javascript(tmp_path)

    assert [(case.framework, case.selector.split(" [")[0]) for case in cases] == [
        ("playwright", "flow > opens"),
        ("vitest", "outer > inner > conditional variant"),
        ("vitest", "outer > inner > handles %s"),
        ("vitest", "outer > inner > ignored but collectable"),
    ]
    assert cases[1].evidence["modifiers"] == ["runIf"]
    assert cases[2].evidence["modifiers"] == ["each"]
    assert cases[3].evidence["modifiers"] == ["skip"]


def test_javascript_dynamic_and_conditional_titles_have_stable_selectors(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "frontend/src/conditional.test.ts",
        """
import { it } from "vitest";
import { compute } from "./compute";
const title = "computed";
if (enabled) it(title, () => compute());
""",
    )
    first = discover_javascript(tmp_path)
    second = discover_javascript(tmp_path)
    assert first == second
    assert first[0].selector.startswith("<dynamic@")
    assert first[0].evidence["conditional"] is True


def test_javascript_collector_surfaces_unknown_and_retry_controls(tmp_path: Path) -> None:
    _write(
        tmp_path,
        "frontend/src/controls.test.ts",
        """
import { describe, test } from "vitest";
test.mystery("unknown", () => true);
test("retried", () => true, { retry: 2 });
test("not retried", () => true, { retry: 0 });
describe.skip("suspended suite", () => {
  test("inherited skip", () => true);
});
""",
    )
    _write(
        tmp_path,
        "frontend/tests/e2e/controls.spec.ts",
        """
import { test } from "@playwright/test";
test.describe.fixme("blocked suite", () => {
  test("inherited fixme", async () => true);
});
""",
    )

    cases = discover_javascript(tmp_path)
    by_title = {case.selector.split(" [", 1)[0]: case for case in cases}

    assert by_title["unknown"].evidence["modifiers"] == ["mystery"]
    assert by_title["retried"].evidence["modifiers"] == ["retry"]
    assert by_title["not retried"].evidence["modifiers"] == []
    assert by_title["suspended suite > inherited skip"].evidence["modifiers"] == ["skip"]
    assert by_title["blocked suite > inherited fixme"].evidence["modifiers"] == [
        "fixme"
    ]


def test_javascript_discovery_reports_process_and_payload_errors(
    monkeypatch, tmp_path: Path
) -> None:
    class Result:
        returncode = 1
        stderr = "compiler failed"
        stdout = ""

    monkeypatch.setattr(
        "Scripts.test_classifier_discovery.subprocess.run", lambda *_args, **_kwargs: Result()
    )
    with pytest.raises(RuntimeError, match="compiler failed"):
        discover_javascript(tmp_path)

    Result.returncode = 0
    Result.stderr = ""
    Result.stdout = "{}"
    with pytest.raises(RuntimeError, match="non-array"):
        discover_javascript(tmp_path)


def test_discover_all_is_sorted_and_rejects_duplicate_ids(monkeypatch) -> None:
    first = _case("pytest")
    second = LogicalCase("vitest", "z.test.ts", "test z", first.evidence)
    monkeypatch.setattr("Scripts.test_classifier_discovery.discover_pytest", lambda _root: [first])
    monkeypatch.setattr(
        "Scripts.test_classifier_discovery.discover_javascript", lambda _root, _node: [second]
    )
    assert discover_all(ROOT) == [first, second]
    monkeypatch.setattr(
        "Scripts.test_classifier_discovery.discover_javascript", lambda _root, _node: [first]
    )
    with pytest.raises(ValueError, match="Duplicate logical"):
        discover_all(ROOT)


@pytest.mark.parametrize(
    ("case", "nature"),
    [
        (_case("pytest", imports=["backend.mc_core"]), "unit"),
        (_case("vitest", imports=["./math"]), "unit"),
        (_case("vitest", imports=["@testing-library/react"], calls=["render"]), "component"),
        (_case("pytest", imports=["backend.api"], calls=["client.post"]), "contract"),
        (_case("pytest", fixtures=["tmp_path"], calls=["tmp_path.write_text"]), "integration"),
        (_case("playwright", imports=["@playwright/test"], calls=["page.goto"]), "e2e"),
    ],
)
def test_primary_nature_rules_follow_executed_boundaries(case: LogicalCase, nature: str) -> None:
    rules, overrides, catalog, _schema = _configuration()
    assert classify_case(case, rules, overrides, catalog)["nature"] == nature


def test_multiple_purposes_domains_risks_and_main_browser_profile_are_inferred() -> None:
    rules, overrides, catalog, _schema = _configuration()
    case = LogicalCase(
        "playwright",
        "frontend/tests/e2e/onboarding.spec.js",
        "onboarding cookie PAT keyboard fallback [10:1]",
        {
            "imports": ["@playwright/test"],
            "calls": ["page.goto", "page.getByRole"],
            "fixtures": ["{ page }"],
            "resources": ["https://dev.azure.com"],
            "modifiers": [],
            "conditional": False,
            "dynamicTitle": False,
        },
    )
    record = classify_case(case, rules, overrides, catalog)
    assert record["executionProfile"] == "main"
    assert set(record["purposes"]) >= {"functional", "security", "accessibility", "compatibility"}
    assert set(record["domains"]) >= {"identity", "azure_devops", "user_interface"}
    assert {"RISK-001", "RISK-002"} <= set(record["risks"])
    assert record["criticalPaths"] == ["CP-004"]
    assert record["criticality"] == "critical"


def test_exact_override_is_controlled_and_cannot_hide_justification() -> None:
    rules, _overrides, catalog, _schema = _configuration()
    case = _case("pytest")
    override = {
        "overrides": [
            {
                "target": {
                    "framework": "pytest",
                    "sourcePath": case.source_path,
                    "selector": case.selector,
                },
                "classification": {
                    "status": "classified",
                    "nature": "unit",
                    "purposes": ["functional"],
                    "executionProfile": "main",
                },
                "justification": "The generated fixture hides a pure function call.",
                "evidence": "tests/example.py imports and calls pure_function directly.",
            }
        ]
    }
    record = classify_case(case, rules, override, catalog)
    assert record["status"] == "classified"
    assert record["nature"] == "unit"
    assert "unresolvedReason" not in record

    override["overrides"][0]["justification"] = ""
    with pytest.raises(ValueError, match="justification"):
        classify_case(case, rules, override, catalog)


def test_duplicate_and_non_matching_overrides_are_handled() -> None:
    rules, _overrides, catalog, _schema = _configuration()
    case = _case("pytest", imports=["backend.mc_core"])
    entry = {
        "target": {"sourcePath": case.source_path, "selector": case.selector},
        "classification": {"status": "classified", "nature": "unit"},
        "justification": "Known generated test.",
        "evidence": "Direct pure call.",
    }
    with pytest.raises(ValueError, match="Multiple overrides"):
        classify_case(case, rules, {"overrides": [entry, entry]}, catalog)
    untouched = classify_case(
        case,
        rules,
        {"overrides": [entry | {"target": entry["target"] | {"selector": "other"}}]},
        catalog,
    )
    assert untouched["nature"] == "unit"


def test_ambiguous_and_contradictory_nature_evidence_remains_unresolved() -> None:
    rules, overrides, catalog, _schema = _configuration()
    ambiguous = classify_case(_case("pytest"), rules, overrides, catalog)
    assert ambiguous["status"] == "unresolved"
    assert "sufficient behavioral evidence" in ambiguous["unresolvedReason"]

    conflicting_rules = dict(rules)
    conflicting_rules["natureRules"] = [
        {"id": "a", "priority": 1, "nature": "unit", "match": {"frameworks": ["pytest"]}},
        {"id": "b", "priority": 1, "nature": "contract", "match": {"frameworks": ["pytest"]}},
    ]
    conflict = classify_case(_case("pytest"), conflicting_rules, overrides, catalog)
    assert conflict["status"] == "unresolved"
    assert "contradictory" in conflict["unresolvedReason"]


def test_rule_matching_supports_all_any_none_and_behavior_requirement() -> None:
    case = _case("pytest", imports=["backend.mc_core"], calls=["simulate"])
    assert rule_matches(
        case,
        {
            "requiresBehaviorEvidence": True,
            "match": {
                "frameworks": ["pytest"],
                "all": {"imports": ["backend"]},
                "any": {"calls": ["simulate"], "selector": ["missing"]},
                "none": {"fixtures": ["tmp_path"]},
            },
        },
    )
    assert not rule_matches(
        case,
        {"requiresBehaviorEvidence": True, "match": {"any": {"selector": ["suite"]}}},
    )
    assert rule_matches(
        case,
        {"match": {"all": {"framework": ["pytest"], "conditional": ["false"]}}},
    )


def test_record_validation_rejects_contract_violations() -> None:
    _rules, _overrides, catalog, schema = _configuration()
    invalid = {
        "logicalCaseId": "x",
        "framework": "unknown",
        "sourcePath": "x",
        "selector": "x",
        "status": "classified",
        "purposes": ["functional", "functional"],
        "risks": ["RISK-1"],
        "unexpected": True,
    }
    errors = validate_record(invalid, catalog, schema)
    assert any("invalid values" in error for error in errors)
    assert any("unknown fields" in error for error in errors)
    assert any("require nature" in error for error in errors)
    assert any("invalid identifiers" in error for error in errors)
    assert any("requires criticality" in error for error in errors)
    assert any(
        "missing required fields" in error
        for error in validate_record({"status": "unresolved"}, catalog, schema)
    )

    unresolved = invalid | {"status": "unresolved", "framework": "pytest"}
    assert any(
        "require unresolvedReason" in error
        for error in validate_record(unresolved, catalog, schema)
    )
    classified = invalid | {
        "framework": "pytest",
        "nature": "unit",
        "executionProfile": "main",
        "unresolvedReason": "not allowed",
    }
    assert any("cannot contain" in error for error in validate_record(classified, catalog, schema))

    unresolved_with_exemption = unresolved | {
        "unresolvedReason": "Ambiguous boundary.",
        "exemption": {"justification": "invalid for unresolved"},
    }
    assert any(
        "unresolved records cannot contain exemption" in error
        for error in validate_record(unresolved_with_exemption, catalog, schema)
    )
    exempted_without_governance = invalid | {"status": "exempted", "framework": "pytest"}
    assert any(
        "exempted records require exemption" in error
        for error in validate_record(exempted_without_governance, catalog, schema)
    )
    exempted_with_reason = exempted_without_governance | {
        "unresolvedReason": "incompatible",
        "exemption": {"justification": "Temporary."},
    }
    assert any(
        "exempted records cannot contain unresolvedReason" in error
        for error in validate_record(exempted_with_reason, catalog, schema)
    )


def test_unresolved_override_preserves_its_explicit_reason() -> None:
    rules, _overrides, catalog, _schema = _configuration()
    case = _case("pytest", imports=["backend.mc_core"])
    override = {
        "overrides": [
            {
                "target": {"sourcePath": case.source_path, "selector": case.selector},
                "classification": {
                    "status": "unresolved",
                    "unresolvedReason": "Runtime plugin selection cannot be resolved statically.",
                },
                "justification": "The plugin is selected at runtime.",
                "evidence": "The call target comes from an environment-provided entry point.",
            }
        ]
    }
    record = classify_case(case, rules, override, catalog)
    assert record["status"] == "unresolved"
    assert record["unresolvedReason"].startswith("Runtime plugin")


def test_inventory_is_unique_exhaustive_sorted_and_contract_compliant() -> None:
    rules, overrides, catalog, schema = _configuration()
    cases = discover_all(ROOT)
    inventory = classify_inventory(cases, rules, overrides, catalog, schema)
    assert len(inventory) == len(cases)
    assert len({item["logicalCaseId"] for item in inventory}) == len(cases)
    assert inventory == sorted(inventory, key=lambda item: item["logicalCaseId"])
    assert all(validate_record(item, catalog, schema) == [] for item in inventory)
    assert {item["status"] for item in inventory} <= {"classified", "unresolved"}

    with pytest.raises(ValueError, match="duplicate logicalCaseId"):
        classify_inventory([cases[0], cases[0]], rules, overrides, catalog, schema)


def test_invalid_classified_override_is_rejected_by_inventory_contract() -> None:
    rules, _overrides, catalog, schema = _configuration()
    case = _case("pytest")
    overrides = {
        "overrides": [
            {
                "target": {"sourcePath": case.source_path, "selector": case.selector},
                "classification": {"status": "classified"},
                "justification": "Audited.",
                "evidence": "Observable evidence.",
            }
        ]
    }
    with pytest.raises(ValueError, match="Invalid record"):
        classify_inventory([case], rules, overrides, catalog, schema)


def test_generation_is_byte_identical_and_summary_is_stable(tmp_path: Path) -> None:
    output = tmp_path / "inventory.json"
    first = classify_tests.generate_inventory(ROOT, output_path=output)
    first_bytes = output.read_bytes()
    second = classify_tests.generate_inventory(ROOT, output_path=output)
    assert output.read_bytes() == first_bytes
    assert first == second
    summary = classify_tests.inventory_summary(first, 0)
    assert summary["total"] == len(first)
    assert sum(summary["frameworks"].values()) == len(first)
    assert summary["overrides"] == 0


def test_json_loading_paths_cli_and_main_guard(tmp_path: Path, monkeypatch, capsys) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"x": 1, "x": 2}', encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate JSON"):
        classify_tests.load_json(duplicate)
    array = tmp_path / "array.json"
    array.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="JSON object"):
        classify_tests.load_json(array)

    monkeypatch.setattr(classify_tests, "generate_inventory", lambda **_kwargs: [])
    monkeypatch.setattr(classify_tests, "load_json", lambda _path: {"overrides": []})
    assert classify_tests.main(["--root", str(ROOT)]) == 0
    assert '"total": 0' in capsys.readouterr().out

    monkeypatch.setattr(sys, "argv", ["classify_tests.py", "--help"])
    with pytest.raises(SystemExit) as exc:
        runpy.run_path(str(ROOT / "Scripts/classify_tests.py"), run_name="__main__")
    assert exc.value.code == 0
