from __future__ import annotations

import copy
import json
from collections.abc import Callable
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any

import pytest

from Scripts import check_dependency_authority as authority_cli
from Scripts import dependency_authority_domain as domain_control
from Scripts import dependency_authority_imports as imports_control
from Scripts.check_dependency_authority import main as check_authority
from Scripts.dependency_authority import (
    DEFAULT_AUTHORITY,
    DEFAULT_SCHEMA,
    AuthorityValidationError,
    authority_evidence,
    load_dependency_authority,
)
from Scripts.dependency_authority_contract import Diagnostic
from Scripts.dependency_authority_domain import (
    DomainIndependenceResult,
    DomainInspectionError,
    LocatedDiagnostic,
    inspect_repository_domain,
    validate_domain_independence,
)
from Scripts.dependency_authority_public_api import inspect_repository_public_apis
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


def _format_located_diagnostic(diagnostic: LocatedDiagnostic, root: Any) -> str:
    return diagnostic.render(root)


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
    domain_result = inspect_repository_domain(authority)
    public_api_result = inspect_repository_public_apis(authority)
    committed = _json(ROOT / "reports" / "dependency-authority-validation.json")

    assert not domain_result.diagnostics
    assert not public_api_result.diagnostics
    assert committed == authority_evidence(
        authority,
        domain_files=domain_result.files,
        domain_dependencies=domain_result.dependencies,
        module_files=public_api_result.files,
        module_dependencies=public_api_result.dependencies,
        governed_modules=public_api_result.modules,
        public_api_entrypoints=public_api_result.public_entrypoints,
        deep_import_exceptions=public_api_result.exceptions,
    )
    assert check_authority([]) == 0
    assert "36 directions" in capsys.readouterr().out


def test_domain_accepts_internal_code_and_python_standard_library() -> None:
    authority = load_dependency_authority()
    texts = {
        "frontend/src/domain/simulation/value.ts": (
            'import type { Risk } from "./risk";\n'
            'import type { AbsoluteRisk } from "/src/domain/simulation/risk";\n'
            'export { compute } from "./compute";\n'
        ),
        "frontend/src/domain/simulation/risk.ts": "export type Risk = number;\n",
        "frontend/src/domain/simulation/compute.ts": "export const compute = () => 1;\n",
        "backend/domain/history/entry.py": (
            "from dataclasses import dataclass\n"
            "from .identity import HistoryIdentity\n"
        ),
        "backend/domain/history/identity.py": "HistoryIdentity = str\n",
    }

    result = validate_domain_independence(authority, texts, set(texts))

    assert result.files == 5
    assert result.dependencies == 5
    assert result.diagnostics == ()


def test_domain_rejects_static_type_and_dynamic_adapter_imports_with_paths() -> None:
    authority = load_dependency_authority()
    texts = {
        "frontend/src/domain/simulation/forecast.ts": (
            "export type Forecast = number;\n"
            'import type { HttpDto } from "../../adapters/simulation/http/client";\n'
            'const load = () => import("../../adapters/simulation/local/engine");\n'
        ),
        "frontend/src/adapters/simulation/http/client.ts": "export type HttpDto = {};\n",
        "frontend/src/adapters/simulation/local/engine.ts": "export const run = () => 1;\n",
    }

    result = validate_domain_independence(authority, texts, set(texts))

    assert result.violations == 2
    assert [item.code for item in result.diagnostics] == [
        "DEP-DOMAIN-ADAPTER",
        "DEP-DOMAIN-ADAPTER",
    ]
    assert [item.location for item in result.diagnostics] == ["line 2", "line 3"]
    rendered = "\n".join(item.render() for item in result.diagnostics)
    assert "frontend/src/domain/simulation/forecast.ts:line 2" in rendered
    assert "frontend/src/adapters/simulation/http/client.ts" in rendered


def test_python_domain_rejects_an_adapter_even_for_an_imported_type() -> None:
    authority = load_dependency_authority()
    texts = {
        "backend/domain/history/entry.py": (
            "from typing import TYPE_CHECKING\n"
            "if TYPE_CHECKING:\n"
            "    from backend.adapters.persistence.mongodb.document import MongoDocument\n"
        ),
        "backend/adapters/persistence/mongodb/document.py": "MongoDocument = dict[str, object]\n",
    }

    result = validate_domain_independence(authority, texts, set(texts))

    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "DEP-DOMAIN-ADAPTER"
    assert result.diagnostics[0].location == "line 3"


@pytest.mark.parametrize(
    ("path", "source", "technology"),
    [
        (
            "frontend/src/domain/delivery/event.ts",
            'import type { ComponentType } from "react";\n',
            "external:npm:react",
        ),
        (
            "frontend/src/domain/simulation/random.ts",
            'const crypto = require("node:crypto");\n',
            "external:npm:node:crypto",
        ),
        (
            "backend/domain/simulation/value.py",
            "import numpy as np\n",
            "external:python:numpy",
        ),
        (
            "backend/domain/history/value.py",
            "from pydantic import BaseModel\n",
            "external:python:pydantic",
        ),
    ],
)
def test_domain_rejects_external_technologies(
    path: str, source: str, technology: str
) -> None:
    authority = load_dependency_authority()

    result = validate_domain_independence(authority, {path: source}, {path})

    assert len(result.diagnostics) == 1
    diagnostic = result.diagnostics[0]
    assert diagnostic.code == "DEP-DOMAIN-TECHNOLOGY"
    assert diagnostic.location == "line 1"
    assert technology in diagnostic.render()


def test_domain_rejects_imported_technical_resources() -> None:
    authority = load_dependency_authority()
    texts = {
        "frontend/src/domain/delivery/calendar.ts": 'import labels from "./labels.json";\n',
        "frontend/src/domain/delivery/labels.json": '{"week": "Week"}\n',
    }

    result = validate_domain_independence(authority, texts, set(texts))

    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "DEP-DOMAIN-TECHNOLOGY"
    assert "labels.json" in result.diagnostics[0].render()


def test_comments_strings_tests_and_unresolved_internal_paths_do_not_create_violations() -> None:
    authority = load_dependency_authority()
    texts = {
        "frontend/src/domain/delivery/event.ts": (
            '// import "react";\n'
            'const documentation = \'import("pydantic")\';\n'
            'const escaped = "import(\\\"react\\\")";\n'
            '/*\n import "vitest";\n*/\n'
            'import type { LegacyValue } from "../../legacy/value";\n'
        ),
        "frontend/src/domain/delivery/event.test.ts": 'import { it } from "vitest";\n',
    }

    result = validate_domain_independence(authority, texts, set(texts))

    assert result.files == 1
    assert result.dependencies == 1
    assert result.diagnostics == ()


def test_invalid_python_domain_source_fails_closed_at_its_line() -> None:
    authority = load_dependency_authority()
    path = "backend/domain/history/entry.py"

    result = validate_domain_independence(authority, {path: "from typing import\n"}, {path})

    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "DEP-DOMAIN-PARSE"
    assert result.diagnostics[0].location == "line 1"


def test_repository_inspection_uses_authority_roots_without_git(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    authority = load_dependency_authority()
    domain = tmp_path / "frontend" / "src" / "domain" / "simulation"
    adapter = tmp_path / "frontend" / "src" / "adapters" / "simulation" / "http"
    domain.mkdir(parents=True)
    adapter.mkdir(parents=True)
    (domain / "forecast.ts").write_text(
        'import { run } from "../../adapters/simulation/http/client";\n',
        encoding="utf-8",
    )
    (adapter / "client.ts").write_text("export const run = () => 1;\n", encoding="utf-8")

    result = inspect_repository_domain(authority, tmp_path)

    assert result.files == 1
    assert result.dependencies == 1
    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].code == "DEP-DOMAIN-ADAPTER"

    def fail_scan(*_args: object) -> DomainIndependenceResult:
        raise DomainInspectionError("scan unavailable")

    monkeypatch.setattr(authority_cli, "inspect_repository_domain", fail_scan)
    assert check_authority([]) == 1
    assert "DEP-DOMAIN-SCAN" in capsys.readouterr().err

    violation = LocatedDiagnostic(
        "frontend/src/domain/delivery/event.ts",
        Diagnostic("DEP-DOMAIN-TECHNOLOGY", "line 3", "interdit", "corriger"),
    )
    monkeypatch.setattr(
        authority_cli,
        "inspect_repository_domain",
        lambda *_args: DomainIndependenceResult(1, 1, (violation,)),
    )
    assert check_authority([]) == 1
    rendered = capsys.readouterr().err
    expected_path = ROOT.joinpath("frontend", "src", "domain", "delivery", "event.ts")
    assert f"{expected_path}:line 3: [DEP-DOMAIN-TECHNOLOGY]" in rendered

    for repository_root in (
        PurePosixPath("/repository"),
        PureWindowsPath("C:/repository"),
    ):
        expected_path = repository_root.joinpath(
            "frontend", "src", "domain", "delivery", "event.ts"
        )
        portable_rendered = _format_located_diagnostic(violation, repository_root)
        assert portable_rendered == (
            f"{expected_path}:line 3: [DEP-DOMAIN-TECHNOLOGY] interdit "
            "Correction: corriger"
        )

    monkeypatch.setattr(
        domain_control,
        "repository_paths",
        lambda *_args: ["backend/domain/history/disappeared.py"],
    )
    result = inspect_repository_domain(authority, tmp_path)
    assert result.files == 0

    unreadable = tmp_path / "backend" / "domain" / "history" / "unreadable.py"
    unreadable.parent.mkdir(parents=True)
    unreadable.write_bytes(b"\xff")
    monkeypatch.setattr(
        domain_control,
        "repository_paths",
        lambda *_args: ["backend/domain/history/unreadable.py"],
    )
    with pytest.raises(DomainInspectionError, match="unreadable.py"):
        inspect_repository_domain(authority, tmp_path)

    product_root = tmp_path / "frontend" / "src"
    product_root.mkdir(parents=True, exist_ok=True)

    def fail_enumeration(_path: Path, _pattern: str) -> object:
        raise OSError("enumeration unavailable")

    monkeypatch.setattr(Path, "rglob", fail_enumeration)
    with pytest.raises(DomainInspectionError, match="sources produit"):
        imports_control.repository_paths(tmp_path, ("frontend/src",))


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


def test_deep_import_exception_requires_explicit_authorization() -> None:
    def mutate(document: dict[str, Any]) -> None:
        document["moduleEncapsulation"]["deepImportExceptions"].append(
            {
                "source": "frontend/src/application/client.ts",
                "target": "frontend/src/domain/delivery/event.ts",
                "reason": "Transition temporaire.",
            }
        )

    diagnostics = _diagnostics(mutate)

    _assert_actionable(
        diagnostics,
        "DEP-AUTH-STRUCTURE",
        "/moduleEncapsulation/deepImportExceptions/0/authorization",
    )


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
