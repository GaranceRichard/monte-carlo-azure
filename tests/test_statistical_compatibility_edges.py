from __future__ import annotations

import ast
from copy import deepcopy
from pathlib import Path

import pytest

from Scripts.statistical_compatibility_authority import (
    semantic_diagnostics,
    structural_diagnostics,
    validate_proof_catalog,
)
from Scripts.statistical_compatibility_common import (
    CompatibilityDiagnostic,
    json_pointer,
    load_json,
)
from Scripts.statistical_compatibility_control import validate_authority_and_evaluate
from Scripts.statistical_compatibility_evidence import (
    build_evidence,
    evidence_fingerprint,
    validate_evidence,
)
from Scripts.statistical_compatibility_extractors import (
    ExtractionError,
    _markdown_rules,
    _strip_typescript_comments,
    _typescript_symbol,
    extract_part,
    json_document_fingerprint,
)
from Scripts.statistical_compatibility_release_validation import _version_tuple
from Scripts.statistical_compatibility_typescript import _balanced_end
from Scripts.statistical_consolidated_compatibility_validation import validate_compatibility
from Scripts.statistical_consolidated_io import SourceRecord
from Scripts.statistical_consolidated_source_catalog import SOURCE_DEFINITIONS
from tests.test_statistical_compatibility import (
    AUTHORITY_SCHEMA_PATH,
    EVIDENCE_SCHEMA_PATH,
    ROOT,
    _append_release,
    _authority,
    _mutate_json,
    _workspace,
)


def _codes(authority: dict[str, object]) -> set[str]:
    return {item.code for item in semantic_diagnostics(authority)}


def _diagnostic(classification: str) -> CompatibilityDiagnostic:
    return CompatibilityDiagnostic(
        component="test-component",
        previous_version="1.0",
        current_version="1.1",
        surface="risk_score",
        authority="test-authority",
        expected_fingerprint="a" * 64,
        actual_fingerprint="b" * 64,
        classification=classification,
        expected_decision="a decision",
        declared_decision=None,
        missing_proofs=("proof",),
        affected_data=("seeded_results",),
        corrective_action="correct it",
        code="test-diagnostic",
    )


def test_common_json_helpers_reject_duplicates_and_invalid_pointers(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"key": 1, "key": 2}', encoding="utf-8")
    with pytest.raises(ValueError, match="duplicate JSON property"):
        load_json(duplicate)

    assert json_pointer({"a/b": {"~key": [4]}}, "/a~1b/~0key/0") == 4
    assert json_pointer({"value": 1}, "") == {"value": 1}
    for document, pointer in (({}, "invalid"), ({"items": []}, "/items/x"), ({}, "/missing")):
        with pytest.raises(ValueError):
            json_pointer(document, pointer)


def test_structural_and_catalog_failures_are_explicit() -> None:
    schema = load_json(ROOT / AUTHORITY_SCHEMA_PATH)
    assert structural_diagnostics({}, schema)
    assert structural_diagnostics({}, {"type": "unknown-json-schema-type"})[0].code == (
        "authority_schema_invalid"
    )
    states, proofs, diagnostics = validate_authority_and_evaluate(ROOT, {}, schema)
    assert states == [] and proofs == {} and diagnostics
    with pytest.raises(ValueError, match="invalid numeric version"):
        _version_tuple("one.0")

    catalogs = _authority()
    catalogs["classifications"].reverse()
    catalogs["components"][0]["surfaces"].append(catalogs["components"][1]["surfaces"][0])
    assert {"classifications_catalog_incomplete", "surface_coverage_incomplete"}.issubset(
        _codes(catalogs)
    )


def test_authority_semantics_reject_duplicate_unknown_and_mismatched_references() -> None:
    authority = _authority()
    authority["components"][1]["id"] = authority["components"][0]["id"]
    authority["components"][0]["required_proofs"].append("unknown-proof")
    authority["components"][1]["dependencies"].append(
        {"component": "missing-component", "version": "1.0"}
    )
    codes = _codes(authority)
    assert {
        "duplicate_authority_id",
        "required_proof_unknown",
        "dependency_version_mismatch",
    }.issubset(codes)


def test_release_target_surface_baseline_and_current_version_are_validated() -> None:
    authority = _authority()
    baseline = authority["components"][0]
    baseline["current_version"] = "9.0"
    decision = baseline["releases"][0]["decision"]
    decision["to_version"] = "9.0"
    decision["changed_surfaces"] = ["resolved_defaults"]
    decision["classification"] = "normative_result_change"
    codes = _codes(authority)
    assert {
        "current_release_mismatch",
        "decision_target_mismatch",
        "decision_surface_outside_component",
        "baseline_decision_incoherent",
    }.issubset(codes)

    extension = _authority()
    _append_release(extension, "risk-score", "compatible_contract_extension")
    assert "decision_incompatible_with_component" in _codes(extension)


def test_proof_catalog_rejects_unavailable_invalid_and_unbound_proofs(tmp_path: Path) -> None:
    unavailable = _workspace(tmp_path / "unavailable")
    authority = _authority(unavailable)
    (unavailable / authority["proof_artifacts"][0]["schema_path"]).unlink()
    _fingerprints, diagnostics = validate_proof_catalog(unavailable, authority)
    assert any(item.code == "proof_unavailable" for item in diagnostics)

    invalid = _workspace(tmp_path / "invalid")
    authority = _authority(invalid)

    def remove_cases(value: dict[str, object]) -> None:
        value.pop("cases")

    _mutate_json(invalid, authority["proof_artifacts"][0]["path"], remove_cases)
    _fingerprints, diagnostics = validate_proof_catalog(invalid, authority)
    assert any(item.code == "proof_schema_violation" for item in diagnostics)

    unbound = _workspace(tmp_path / "unbound")
    authority = _authority(unbound)
    authority["proof_artifacts"][0]["version_bindings"][0]["pointer"] = "/missing"
    _fingerprints, diagnostics = validate_proof_catalog(unbound, authority)
    assert any(item.code == "proof_version_mismatch" for item in diagnostics)


def test_typescript_extractor_handles_comments_strings_and_malformed_declarations() -> None:
    assert _strip_typescript_comments("const a = 'x\\'y'; /* note\nline */ const b = 2;")
    assert _balanced_end('{"escaped \\" quote"}', 0, "}") > 0
    with pytest.raises(ExtractionError, match="unterminated TypeScript block comment"):
        _strip_typescript_comments("const a = 1; /*")
    with pytest.raises(ExtractionError, match="unterminated TypeScript string"):
        _strip_typescript_comments("const a = 'open")
    with pytest.raises(ExtractionError, match="unterminated TypeScript declaration"):
        _balanced_end("{", 0, "}")
    with pytest.raises(ExtractionError, match="0 definitions"):
        _typescript_symbol("const other = 1;", "missing")
    with pytest.raises(ExtractionError, match="no parameter list"):
        _typescript_symbol("function selected {}", "selected")
    with pytest.raises(ExtractionError, match="no body"):
        _typescript_symbol("function selected();", "selected")


def test_markdown_python_json_and_unknown_extractors_fail_closed(tmp_path: Path) -> None:
    with pytest.raises(ExtractionError, match="0 sections"):
        _markdown_rules("# descriptive", ["STAT-PAR-001"])

    python_path = tmp_path / "invalid.py"
    python_path.write_text("def broken(:\n", encoding="utf-8")
    with pytest.raises(ExtractionError, match="cannot parse Python"):
        extract_part(
            tmp_path,
            {"path": "invalid.py", "kind": "python_ast", "selectors": ["broken"]},
        )

    json_path = tmp_path / "invalid.json"
    json_path.write_text("{", encoding="utf-8")
    with pytest.raises(ExtractionError, match="cannot parse JSON"):
        extract_part(
            tmp_path,
            {"path": "invalid.json", "kind": "json_semantic", "selectors": [""]},
        )
    with pytest.raises(ExtractionError, match="cannot parse proof artifact"):
        json_document_fingerprint(tmp_path, "invalid.json")

    text_path = tmp_path / "text.txt"
    text_path.write_text("value", encoding="utf-8")
    with pytest.raises(ExtractionError, match="unknown extraction kind"):
        extract_part(
            tmp_path,
            {"path": "text.txt", "kind": "unknown", "selectors": ["value"]},
        )
    assert ast.parse("value = 1")


def test_evidence_validation_covers_control_errors_counters_and_status() -> None:
    authority = _authority()
    schema = load_json(ROOT / EVIDENCE_SCHEMA_PATH)
    evidence = load_json(ROOT / "reports/statistical-compatibility-evidence.json")
    assert validate_evidence(None, schema)

    inconsistent = deepcopy(evidence)
    inconsistent["summary"]["component_count"] += 1
    inconsistent["summary"]["proof_count"] += 1
    inconsistent["status"] = "blocked"
    inconsistent["stability"]["artifact_fingerprint"] = evidence_fingerprint(inconsistent)
    issues = validate_evidence(inconsistent, schema)
    assert any("component_count" in item for item in issues)
    assert any("proof_count" in item for item in issues)
    assert any("status" in item for item in issues)

    control_error = build_evidence(authority, [], {}, [_diagnostic("compatibility_control_error")])
    assert control_error["status"] == "control_error"
    blocked = build_evidence(authority, [], {}, [_diagnostic("normative_result_change")])
    assert blocked["status"] == "blocked"


def _record(evidence: dict[str, object], schema: dict[str, object]) -> SourceRecord:
    definition = next(
        item for item in SOURCE_DEFINITIONS if item.source_id == "compatibility_evidence"
    )
    return SourceRecord(
        definition,
        {"validation_status": "valid"},
        data=evidence,
        schema=schema,
    )


def test_consolidated_compatibility_maps_blocked_control_error_and_invalid_states() -> None:
    schema = load_json(ROOT / EVIDENCE_SCHEMA_PATH)
    current = load_json(ROOT / "reports/statistical-compatibility-evidence.json")

    unavailable = _record(current, schema)
    unavailable.entry["validation_status"] = "missing"
    assert validate_compatibility(unavailable) == []

    invalid = _record({}, schema)
    assert any(
        item["code"] == "compatibility_evidence_invalid" for item in validate_compatibility(invalid)
    )

    blocked = deepcopy(current)
    blocked["status"] = "blocked"
    blocked["diagnostics"] = [_diagnostic("normative_result_change").as_json()]
    blocked["summary"]["diagnostic_count"] = 1
    blocked["stability"]["artifact_fingerprint"] = evidence_fingerprint(blocked)
    assert any(
        item["code"] == "compatibility_blocked"
        for item in validate_compatibility(_record(blocked, schema))
    )

    control_error = deepcopy(blocked)
    control_error["status"] = "control_error"
    control_error["classification"] = "compatibility_control_error"
    control_error["diagnostics"][0]["classification"] = "compatibility_control_error"
    control_error["stability"]["artifact_fingerprint"] = evidence_fingerprint(control_error)
    assert any(
        item["code"] == "compatibility_control_error"
        for item in validate_compatibility(_record(control_error, schema))
    )
