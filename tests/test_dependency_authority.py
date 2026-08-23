from __future__ import annotations

import copy
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from Scripts.check_dependency_authority import main as check_authority
from Scripts.dependency_authority import (
    DEFAULT_AUTHORITY,
    DEFAULT_SCHEMA,
    AuthorityValidationError,
    authority_evidence,
    load_dependency_authority,
)
from Scripts.dependency_authority_validation import validate_authority_document

ROOT = Path(__file__).resolve().parents[1]


def _json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def _diagnostics(
    mutator: Callable[[dict[str, Any]], None], repository_root: Path = ROOT
) -> list[Any]:
    document = copy.deepcopy(_json(DEFAULT_AUTHORITY))
    mutator(document)
    return validate_authority_document(document, _json(DEFAULT_SCHEMA), repository_root)


def _assert_actionable(diagnostics: list[Any], code: str, location: str) -> None:
    matches = [item for item in diagnostics if item.code == code and item.location == location]
    assert matches, [item.render(DEFAULT_AUTHORITY) for item in diagnostics]
    assert all(item.message and item.hint for item in matches)


def test_committed_authority_parses_and_exposes_the_normative_matrix() -> None:
    authority = load_dependency_authority()

    assert authority.schema_version == "1.0.0"
    assert authority.direction_policy("application", "domain") == "allowed"
    assert authority.direction_policy("domain", "adapters") == "forbidden"
    assert authority.direction_policy("ports", "ports") == "internal-only"
    with pytest.raises(KeyError, match="unknown"):
        authority.direction_policy("unknown", "domain")


def test_committed_evidence_is_a_fresh_deterministic_projection(capsys) -> None:
    authority = load_dependency_authority()
    committed = _json(ROOT / "reports" / "dependency-authority-validation.json")

    assert committed == authority_evidence(authority)
    assert check_authority([]) == 0
    assert "36 directions" in capsys.readouterr().out


def test_invalid_json_reports_line_column_and_correction(tmp_path: Path) -> None:
    authority_path = tmp_path / "authority.json"
    authority_path.write_text('{"schemaVersion": "1.0.0",', encoding="utf-8")

    with pytest.raises(AuthorityValidationError) as raised:
        load_dependency_authority(authority_path, DEFAULT_SCHEMA, ROOT)

    diagnostic = raised.value.diagnostics[0]
    assert diagnostic.code == "DEP-AUTH-JSON"
    assert diagnostic.location.startswith("line 1, column ")
    assert "syntaxe JSON" in diagnostic.hint


def test_duplicate_json_key_is_rejected_before_validation(tmp_path: Path) -> None:
    authority_path = tmp_path / "authority.json"
    authority_path.write_text('{"schemaVersion":"1.0.0","schemaVersion":"1.0.0"}', encoding="utf-8")

    with pytest.raises(AuthorityValidationError) as raised:
        load_dependency_authority(authority_path, DEFAULT_SCHEMA, ROOT)

    diagnostic = raised.value.diagnostics[0]
    assert diagnostic.code == "DEP-AUTH-DUPLICATE-KEY"
    assert diagnostic.location == "/"
    assert diagnostic.hint


def test_loader_localizes_read_schema_and_semantic_failures(tmp_path: Path) -> None:
    with pytest.raises(AuthorityValidationError) as missing_authority:
        load_dependency_authority(tmp_path / "missing.json", DEFAULT_SCHEMA, ROOT)
    assert missing_authority.value.diagnostics[0].code == "DEP-AUTH-READ"

    with pytest.raises(AuthorityValidationError) as missing_schema:
        load_dependency_authority(DEFAULT_AUTHORITY, tmp_path / "missing-schema.json", ROOT)
    assert missing_schema.value.diagnostics[0].code == "DEP-AUTH-READ"

    schema_path = tmp_path / "schema.json"
    schema_path.write_text("[]", encoding="utf-8")
    with pytest.raises(AuthorityValidationError) as invalid_schema:
        load_dependency_authority(DEFAULT_AUTHORITY, schema_path, ROOT)
    assert invalid_schema.value.diagnostics[0].code == "DEP-AUTH-SCHEMA"

    document = _json(DEFAULT_AUTHORITY)
    document["schemaVersion"] = "2.0.0"
    authority_path = tmp_path / "unsupported.json"
    authority_path.write_text(json.dumps(document), encoding="utf-8")
    with pytest.raises(AuthorityValidationError) as semantic_error:
        load_dependency_authority(authority_path, DEFAULT_SCHEMA, ROOT)
    assert semantic_error.value.diagnostics[0].code == "DEP-AUTH-VERSION"


def test_cli_reports_invalid_missing_and_stale_evidence(tmp_path: Path, capsys) -> None:
    missing_authority = tmp_path / "missing-authority.json"
    evidence = tmp_path / "evidence.json"
    assert check_authority(["--authority", str(missing_authority)]) == 1
    assert "DEP-AUTH-READ" in capsys.readouterr().err

    assert check_authority(["--evidence", str(evidence), "--write-evidence"]) == 0
    assert evidence.is_file()
    assert "evidence written" in capsys.readouterr().out

    evidence.unlink()
    assert check_authority(["--evidence", str(evidence)]) == 1
    assert "DEP-AUTH-EVIDENCE-READ" in capsys.readouterr().err

    evidence.write_text("stale\n", encoding="utf-8")
    assert check_authority(["--evidence", str(evidence)]) == 1
    assert "DEP-AUTH-EVIDENCE-STALE" in capsys.readouterr().err


def test_missing_required_property_has_a_json_pointer() -> None:
    diagnostics = _diagnostics(lambda document: document.pop("layers"))

    _assert_actionable(diagnostics, "DEP-AUTH-STRUCTURE", "/layers")


def test_unsupported_format_version_requires_an_explicit_migration() -> None:
    diagnostics = _diagnostics(lambda document: document.update(schemaVersion="2.0.0"))

    _assert_actionable(diagnostics, "DEP-AUTH-VERSION", "/schemaVersion")


def test_changed_normative_decision_hash_is_localized() -> None:
    def mutate(document: dict[str, Any]) -> None:
        document["normativeSources"][0]["sha256"] = "0" * 64

    diagnostics = _diagnostics(mutate)

    _assert_actionable(diagnostics, "DEP-AUTH-SOURCE-HASH", "/normativeSources/0/sha256")


def test_duplicate_direction_also_reports_the_missing_matrix_cell() -> None:
    def mutate(document: dict[str, Any]) -> None:
        document["directions"][-1] = copy.deepcopy(document["directions"][0])

    diagnostics = _diagnostics(mutate)

    _assert_actionable(diagnostics, "DEP-AUTH-DIRECTION-DUPLICATE", "/directions/35")
    _assert_actionable(diagnostics, "DEP-AUTH-DIRECTION-MISSING", "/directions")


def test_internal_only_is_rejected_outside_the_matrix_diagonal() -> None:
    def mutate(document: dict[str, Any]) -> None:
        document["directions"][1]["policy"] = "internal-only"

    diagnostics = _diagnostics(mutate)

    _assert_actionable(diagnostics, "DEP-AUTH-DIRECTION-POLICY", "/directions/1/policy")


def test_product_boundary_must_stay_under_its_runtime_root() -> None:
    def mutate(document: dict[str, Any]) -> None:
        document["runtimes"][0]["boundaries"][0]["pathPattern"] = (
            "frontend/src/../backend/{module}/"
        )

    diagnostics = _diagnostics(mutate)

    _assert_actionable(
        diagnostics,
        "DEP-AUTH-BOUNDARY-PATTERN",
        "/runtimes/0/boundaries/0/pathPattern",
    )


def test_quality_boundary_cannot_claim_a_product_layer() -> None:
    def mutate(document: dict[str, Any]) -> None:
        boundary = document["runtimes"][2]["boundaries"][0]
        boundary["layer"] = "ports"

    diagnostics = _diagnostics(mutate)

    _assert_actionable(
        diagnostics,
        "DEP-AUTH-BOUNDARY-OWNER",
        "/runtimes/2/boundaries/0",
    )


@pytest.mark.parametrize(
    ("defect", "code"),
    [
        ("root-shape", "DEP-AUTH-STRUCTURE"),
        ("source-duplicate", "DEP-AUTH-SOURCE-SET"),
        ("source-binding", "DEP-AUTH-SOURCE"),
        ("source-missing", "DEP-AUTH-SOURCE-MISSING"),
        ("layer-duplicate", "DEP-AUTH-LAYERS"),
        ("direction-unknown", "DEP-AUTH-DIRECTION-REFERENCE"),
        ("product-owner", "DEP-AUTH-BOUNDARY-OWNER"),
        ("boundary-layer", "DEP-AUTH-BOUNDARY-LAYER"),
        ("boundary-wildcard", "DEP-AUTH-BOUNDARY-WILDCARD"),
        ("boundary-id", "DEP-AUTH-BOUNDARY-ID"),
        ("boundary-path", "DEP-AUTH-BOUNDARY-DUPLICATE"),
        ("runtime-set", "DEP-AUTH-RUNTIME-SET"),
        ("product-coverage", "DEP-AUTH-BOUNDARY-COVERAGE"),
        ("quality-coverage", "DEP-AUTH-BOUNDARY-COVERAGE"),
    ],
)
def test_semantic_relationship_defects_are_diagnosed(
    defect: str, code: str, tmp_path: Path
) -> None:
    document = copy.deepcopy(_json(DEFAULT_AUTHORITY))
    repository_root = ROOT
    if defect == "root-shape":
        diagnostics = validate_authority_document([], _json(DEFAULT_SCHEMA), ROOT)
    else:
        _inject_relationship_defect(document, defect)
        if defect == "source-missing":
            repository_root = tmp_path
        diagnostics = validate_authority_document(
            document, _json(DEFAULT_SCHEMA), repository_root
        )

    assert any(item.code == code and item.hint for item in diagnostics)


def _inject_relationship_defect(document: dict[str, Any], defect: str) -> None:
    if defect == "source-duplicate":
        document["normativeSources"][1]["pbi"] = "7.7"
    elif defect == "source-binding":
        document["normativeSources"][0]["role"] = "target-boundaries"
    elif defect == "source-missing":
        return
    elif defect == "layer-duplicate":
        document["layers"][-1]["id"] = "domain"
    elif defect == "direction-unknown":
        document["directions"][0]["from"] = "unknown"
    elif defect == "product-owner":
        boundary = document["runtimes"][0]["boundaries"][0]
        boundary.pop("layer")
        boundary["role"] = "contracts"
    elif defect == "boundary-layer":
        boundary = copy.deepcopy(document["runtimes"][0]["boundaries"][0])
        boundary.update(id="frontend-domain-other", modules=["other"])
        document["runtimes"][0]["boundaries"].append(boundary)
    elif defect == "boundary-wildcard":
        document["runtimes"][0]["boundaries"][2]["modules"] = ["*", "extra"]
    elif defect == "boundary-id":
        document["runtimes"][0]["boundaries"][1]["id"] = "frontend-domain"
    elif defect == "boundary-path":
        boundary = document["runtimes"][0]["boundaries"][1]
        boundary.update(pathPattern="frontend/src/domain/{module}/", modules=["delivery"])
    elif defect == "runtime-set":
        document["runtimes"][2]["id"] = "frontend"
    elif defect == "product-coverage":
        document["runtimes"][0]["boundaries"].pop()
    elif defect == "quality-coverage":
        document["runtimes"][2]["boundaries"].pop()
    else:  # pragma: no cover - the parametrized catalog is closed above
        raise AssertionError(f"Unknown defect: {defect}")
