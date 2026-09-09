from __future__ import annotations

from pathlib import Path

import pytest

from Scripts import check_dependency_authority as authority_cli
from Scripts.dependency_authority import load_dependency_authority
from Scripts.dependency_authority_dto import (
    DtoConfinementInspectionError,
    inspect_repository_dto_confinement,
    validate_dto_confinement,
)
from Scripts.dependency_authority_dto_javascript import reexported_symbols
from Scripts.dependency_authority_dto_python import imported_symbols


def _validate(texts: dict[str, str]):
    return validate_dto_confinement(load_dependency_authority(), texts, set(texts))


def test_private_dtos_mapped_to_internal_contracts_are_allowed() -> None:
    result = _validate(
        {
            "frontend/src/adapters/simulation/http/index.ts": (
                'export { runSimulation } from "./adapter";\n'
            ),
            "frontend/src/adapters/simulation/http/wireDtos.ts": (
                "export type SimulationResponseDto = { result_value: number };\n"
            ),
            "frontend/src/adapters/simulation/http/mapper.ts": (
                'import type { SimulationResult } from "../../../domain/simulation";\n'
                'import type { SimulationResponseDto } from "./wireDtos";\n'
                "export function mapResponse(dto: SimulationResponseDto): SimulationResult {\n"
                "  return { value: dto.result_value };\n"
                "}\n"
            ),
            "frontend/src/adapters/simulation/http/adapter.ts": (
                'import type { SimulationCommand, SimulationResult } '
                'from "../../../domain/simulation";\n'
                'import { mapResponse } from "./mapper";\n'
                "const syntaxExamples = `\n"
                'import type { SimulationResponseDto as Hidden } from "./wireDtos";\n'
                "export function hidden(dto: SimulationResponseDto): number {\n"
                "`;\n"
                "void syntaxExamples;\n"
                "export async function runSimulation(\n"
                "  _command: SimulationCommand,\n"
                "): Promise<SimulationResult> {\n"
                "  return mapResponse({ result_value: 1 });\n"
                "}\n"
            ),
            "frontend/src/domain/simulation/index.ts": (
                "export type SimulationResult = Readonly<{ value: number }>;\n"
            ),
            "frontend/src/application/team-forecast/index.ts": (
                'import { runSimulation } from "../../adapters/simulation/http";\n'
                "export const run = runSimulation;\n"
            ),
            "backend/adapters/persistence/mongodb/__init__.py": (
                "from .repository import MongoHistoryRepository\n"
            ),
            "backend/adapters/persistence/mongodb/document.py": (
                "import pydantic\n"
                "from typing import TypedDict\n"
                "class MongoDocumentDto(TypedDict):\n"
                "    value: int\n"
                "class MongoResponse(pydantic.BaseModel):\n"
                "    value: int\n"
                "class Ignored(list[int]):\n"
                "    pass\n"
            ),
            "backend/adapters/persistence/mongodb/mapper.py": (
                "from backend.domain.history import HistoryRecord\n"
                "from .document import MongoDocumentDto\n"
                "def map_document(dto: MongoDocumentDto) -> HistoryRecord:\n"
                "    return HistoryRecord(dto['value'])\n"
                "def helper(value):\n"
                "    return value\n"
                "def map_many(*dtos: MongoDocumentDto, "
                "**named: 'MongoDocumentDto') -> HistoryRecord:\n"
                "    return HistoryRecord(len(dtos) + len(named))\n"
            ),
            "backend/adapters/persistence/mongodb/repository.py": (
                "from backend.domain.history import HistoryRecord\n"
                "from .mapper import map_document\n"
                "class MongoHistoryRepository:\n"
                "    def load(self) -> HistoryRecord:\n"
                "        return map_document({'value': 1})\n"
            ),
            "backend/domain/history/__init__.py": (
                "from typing import NamedTuple\n"
                "class HistoryRecord(NamedTuple):\n"
                "    value: int\n"
            ),
        }
    )

    assert result.technical_boundaries == 2
    assert result.declarations == 3
    assert result.boundary_references == 2
    assert result.diagnostics == ()


def test_dto_declarations_in_application_and_ports_are_rejected() -> None:
    result = _validate(
        {
            "frontend/src/application/team-forecast/index.ts": (
                "export interface ForecastRequestDto { value: number }\n"
            ),
            "backend/ports/simulation/__init__.py": (
                "from pydantic import BaseModel\n"
                "class SimulationRequest(BaseModel):\n"
                "    value: int\n"
            ),
        }
    )

    assert [(item.code, item.location) for item in result.diagnostics] == [
        ("DEP-DTO-OWNER", "line 2"),
        ("DEP-DTO-OWNER", "line 1"),
    ]
    rendered = "\n".join(item.render() for item in result.diagnostics)
    assert "backend/ports/simulation/__init__.py:line 2" in rendered
    assert "frontend/src/application/team-forecast/index.ts:line 1" in rendered
    assert "contrat intérieur" in rendered


def test_direct_dto_imports_escape_their_owner_even_for_type_checking() -> None:
    result = _validate(
        {
            "frontend/src/adapters/simulation/http/index.ts": "export {};\n",
            "frontend/src/adapters/simulation/http/wireDtos.ts": (
                "export type SimulationResponseDto = { value: number };\n"
            ),
            "frontend/src/application/team-forecast/index.ts": (
                'import type { SimulationResponseDto } from '
                '"../../adapters/simulation/http/wireDtos";\n'
            ),
            "backend/adapters/persistence/mongodb/__init__.py": "__all__ = []\n",
            "backend/adapters/persistence/mongodb/document.py": (
                "from typing import TypedDict\n"
                "class MongoDocumentDto(TypedDict):\n"
                "    value: int\n"
            ),
            "backend/application/history/client.py": (
                "from typing import TYPE_CHECKING\n"
                "if TYPE_CHECKING:\n"
                "    from backend.adapters.persistence.mongodb.document import MongoDocumentDto\n"
            ),
        }
    )

    assert [(item.code, item.location) for item in result.diagnostics] == [
        ("DEP-DTO-LEAK", "line 3"),
        ("DEP-DTO-LEAK", "line 1"),
    ]
    assert all("frontière propriétaire" in item.render() for item in result.diagnostics)


def test_public_adapter_entrypoints_cannot_reference_private_dtos() -> None:
    result = _validate(
        {
            "frontend/src/adapters/simulation/http/index.ts": (
                'export * from "./barrel";\n'
            ),
            "frontend/src/adapters/simulation/http/barrel.ts": (
                'export { mapResponse } from "./mapper";\n'
            ),
            "frontend/src/adapters/simulation/http/wireDtos.ts": (
                "export type SimulationResponseDto = { value: number };\n"
            ),
            "frontend/src/adapters/simulation/http/mapper.ts": (
                'import type { SimulationResponseDto as WireResponse } '
                'from "./wireDtos";\n'
                "export function mapResponse(dto: WireResponse): number {\n"
                "  return dto.value;\n"
                "}\n"
                "export const mapValue: (dto: WireResponse) => number = "
                "(dto) => dto.value;\n"
            ),
            "backend/adapters/persistence/mongodb/__init__.py": (
                "from .exports import PublicDocument\n"
            ),
            "backend/adapters/persistence/mongodb/exports.py": (
                "from .document import MongoDocumentDto as PublicDocument\n"
            ),
            "backend/adapters/persistence/mongodb/document.py": (
                "from typing import TypedDict\n"
                "MongoDocumentDto = TypedDict('MongoDocumentDto', {'value': int})\n"
            ),
        }
    )

    assert [(item.code, item.location) for item in result.diagnostics] == [
        ("DEP-DTO-PUBLIC", "line 1"),
        ("DEP-DTO-PUBLIC", "line 1"),
    ]
    assert "commande, le résultat ou la valeur intérieure" in result.diagnostics[0].render()


def test_comments_strings_tests_and_unclassified_legacy_are_ignored() -> None:
    result = _validate(
        {
            "frontend/src/domain/simulation/index.ts": (
                "// export type CommentDto = {};\n"
                "const example = 'interface StringDto {}';\n"
            ),
            "frontend/src/application/team-forecast/contract.test.ts": (
                "export type TestFixtureDto = {};\n"
            ),
            "frontend/src/legacy/wireDtos.ts": (
                "export type LegacyDto = { value: number };\n"
            ),
        }
    )

    assert result.declarations == 0
    assert result.diagnostics == ()
    assert reexported_symbols('export type Alias = import("./dto").WireDto;\n', 1) == {}
    assert reexported_symbols('export { , Mapper } from "./mapper";\n', 1) == {
        "Mapper": "Mapper"
    }
    assert imported_symbols("broken syntax (", "broken syntax (", 1) == {}
    assert imported_symbols("adapter.py", "from .dto import WireDto\n", 2) == {}


def test_repository_rule_is_integrated_and_scan_failures_are_actionable(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    adapter = tmp_path / "frontend" / "src" / "adapters" / "simulation" / "http"
    application = tmp_path / "frontend" / "src" / "application" / "team-forecast"
    adapter.mkdir(parents=True)
    application.mkdir(parents=True)
    (adapter / "index.ts").write_text("export {};\n", encoding="utf-8")
    (adapter / "wireDtos.ts").write_text(
        "export type SimulationResponseDto = { value: number };\n", encoding="utf-8"
    )
    (application / "index.ts").write_text(
        'import type { SimulationResponseDto } from '
        '"../../adapters/simulation/http/wireDtos";\n',
        encoding="utf-8",
    )

    result = inspect_repository_dto_confinement(load_dependency_authority(), tmp_path)

    assert result.violations == 1
    assert result.diagnostics[0].source == (
        "frontend/src/application/team-forecast/index.ts"
    )

    monkeypatch.setattr(
        authority_cli, "inspect_repository_dto_confinement", lambda *_args: result
    )
    assert authority_cli.main([]) == 1
    assert "DEP-DTO-LEAK" in capsys.readouterr().err

    monkeypatch.setattr(
        authority_cli,
        "inspect_repository_dto_confinement",
        lambda *_args: (_ for _ in ()).throw(
            DtoConfinementInspectionError("scan unavailable")
        ),
    )
    assert authority_cli.main([]) == 1
    assert "DEP-DTO-SCAN" in capsys.readouterr().err

    unreadable = tmp_path / "unreadable" / "frontend" / "src" / "domain" / "bad.ts"
    unreadable.parent.mkdir(parents=True)
    unreadable.write_bytes(b"\xff")
    with pytest.raises(DtoConfinementInspectionError, match="Impossible de lire"):
        inspect_repository_dto_confinement(
            load_dependency_authority(), tmp_path / "unreadable"
        )

    parse_result = _validate(
        {
            "backend/adapters/persistence/mongodb/__init__.py": "__all__ = []\n",
            "backend/adapters/persistence/mongodb/broken.py": "class BrokenDto(\n",
        }
    )
    assert [item.code for item in parse_result.diagnostics] == ["DEP-DTO-PARSE"]
