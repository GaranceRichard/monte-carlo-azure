from __future__ import annotations

import copy
from pathlib import Path

import pytest

from Scripts import check_dependency_authority as authority_cli
from Scripts import dependency_authority_imports as authority_imports
from Scripts.dependency_authority import DependencyAuthority, load_dependency_authority
from Scripts.dependency_authority_imports import DomainInspectionError
from Scripts.dependency_authority_public_api import (
    PublicApiInspectionError,
    inspect_repository_public_apis,
    validate_public_api_encapsulation,
)


def _authority_with_exceptions(
    exceptions: list[dict[str, str]],
) -> DependencyAuthority:
    authority = load_dependency_authority()
    document = copy.deepcopy(authority.document)
    document["moduleEncapsulation"]["deepImportExceptions"] = exceptions
    return DependencyAuthority(
        authority.path,
        authority.schema_path,
        authority.repository_root,
        document,
    )


def test_public_root_imports_and_module_internals_are_allowed() -> None:
    authority = load_dependency_authority()
    texts = {
        "frontend/src/domain/delivery/index.ts": 'export { event } from "./event";\n',
        "frontend/src/domain/delivery/event.ts": "export const event = 1;\n",
        "frontend/src/domain/delivery/event.test.ts": 'import { event } from "./event";\n',
        "frontend/src/application/client.ts": (
            'import { event } from "../domain/delivery";\n'
            'export { event as deliveryEvent } from "../domain/delivery/index";\n'
        ),
        "backend/domain/history/__init__.py": "from .entry import HistoryEntry\n",
        "backend/domain/history/entry.py": "HistoryEntry = str\n",
        "backend/application/client.py": (
            "from backend.domain.history import HistoryEntry\n"
            "import backend.domain.history\n"
        ),
    }

    result = validate_public_api_encapsulation(authority, texts, set(texts))

    assert result.modules == 2
    assert result.public_entrypoints == 2
    assert result.violations == 0
    assert result.diagnostics == ()


def test_javascript_deep_imports_are_localized_for_every_import_form() -> None:
    authority = load_dependency_authority()
    texts = {
        "frontend/src/domain/delivery/index.ts": 'export type { Event } from "./event";\n',
        "frontend/src/domain/delivery/event.ts": "export type Event = string;\n",
        "frontend/src/application/client.ts": (
            'import type { Event } from "../domain/delivery/event";\n'
            'export { value } from "../domain/delivery/internal/value";\n'
            'const lazy = import("../domain/delivery/event");\n'
            'const required = require("../domain/delivery/event");\n'
        ),
        "frontend/src/domain/delivery/internal/value.ts": "export const value = 1;\n",
    }

    result = validate_public_api_encapsulation(authority, texts, set(texts))

    assert [item.code for item in result.diagnostics] == [
        "DEP-PUBLIC-API-DEEP-IMPORT",
        "DEP-PUBLIC-API-DEEP-IMPORT",
        "DEP-PUBLIC-API-DEEP-IMPORT",
        "DEP-PUBLIC-API-DEEP-IMPORT",
    ]
    assert [item.location for item in result.diagnostics] == [
        "line 1",
        "line 2",
        "line 3",
        "line 4",
    ]
    rendered = "\n".join(item.render() for item in result.diagnostics)
    assert "frontend/src/application/client.ts:line 1" in rendered
    assert "frontière attendue 'frontend/src/domain/delivery/'" in rendered


def test_python_deep_import_is_rejected_even_under_type_checking() -> None:
    authority = load_dependency_authority()
    texts = {
        "backend/domain/history/__init__.py": "from .entry import HistoryEntry\n",
        "backend/domain/history/entry.py": "HistoryEntry = str\n",
        "backend/application/client.py": (
            "from typing import TYPE_CHECKING\n"
            "if TYPE_CHECKING:\n"
            "    from backend.domain.history.entry import HistoryEntry\n"
            "from backend.domain.history.private import Hidden\n"
        ),
    }

    result = validate_public_api_encapsulation(authority, texts, set(texts))

    assert [item.code for item in result.diagnostics] == [
        "DEP-PUBLIC-API-DEEP-IMPORT",
        "DEP-PUBLIC-API-DEEP-IMPORT",
    ]
    assert [item.location for item in result.diagnostics] == ["line 3", "line 4"]


def test_exact_authorized_exception_does_not_cover_neighbors() -> None:
    exception = {
        "source": "frontend/src/application/authorized.ts",
        "target": "frontend/src/domain/delivery/event.ts",
        "authorization": "ADR-EXAMPLE",
        "reason": "Transition bornée couverte par une décision revue.",
    }
    authority = _authority_with_exceptions([exception])
    texts = {
        "frontend/src/domain/delivery/index.ts": "export {};\n",
        "frontend/src/domain/delivery/event.ts": "export const event = 1;\n",
        "frontend/src/domain/delivery/other.ts": "export const other = 1;\n",
        "frontend/src/application/authorized.ts": (
            'import { event } from "../domain/delivery/event";\n'
            'import { other } from "../domain/delivery/other";\n'
        ),
        "frontend/src/application/not-authorized.ts": (
            'import { event } from "../domain/delivery/event";\n'
        ),
    }

    result = validate_public_api_encapsulation(authority, texts, set(texts))

    assert result.exceptions == 1
    assert [(item.source, item.location) for item in result.diagnostics] == [
        ("frontend/src/application/authorized.ts", "line 2"),
        ("frontend/src/application/not-authorized.ts", "line 1"),
    ]


def test_missing_api_and_unresolved_deep_path_fail_closed() -> None:
    authority = load_dependency_authority()
    texts = {
        "frontend/src/domain/delivery/event.ts": "export const event = 1;\n",
        "frontend/src/application/client.ts": (
            'import { missing } from "../domain/delivery/private";\n'
        ),
    }

    result = validate_public_api_encapsulation(authority, texts, set(texts))

    assert [(item.code, item.location) for item in result.diagnostics] == [
        ("DEP-PUBLIC-API-DEEP-IMPORT", "line 1"),
        ("DEP-PUBLIC-API-MISSING", "line 1"),
    ]
    assert result.diagnostics[1].source == "frontend/src/domain/delivery/event.ts"

    malformed = {
        "backend/domain/history/__init__.py": "from .entry import HistoryEntry\n",
        "backend/domain/history/entry.py": "HistoryEntry = str\n",
        "backend/application/broken.py": "from backend.domain.history import (\n",
    }
    parse_result = validate_public_api_encapsulation(authority, malformed, set(malformed))

    assert [(item.code, item.location) for item in parse_result.diagnostics] == [
        ("DEP-PUBLIC-API-PARSE", "line 1")
    ]


def test_comments_strings_and_unrelated_imports_are_ignored() -> None:
    authority = load_dependency_authority()
    texts = {
        "frontend/src/domain/delivery/index.ts": "export {};\n",
        "frontend/src/domain/delivery/event.ts": "export const event = 1;\n",
        "frontend/src/application/client.ts": (
            '// import "../domain/delivery/event";\n'
            'const text = \'import("../domain/delivery/event")\';\n'
            'import { helper } from "../legacy/helper";\n'
        ),
        "frontend/src/legacy/helper.ts": "export const helper = 1;\n",
    }

    result = validate_public_api_encapsulation(authority, texts, set(texts))

    assert result.diagnostics == ()


def test_repository_rule_is_integrated_and_scan_failures_are_actionable(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    authority = load_dependency_authority()
    module = tmp_path / "frontend" / "src" / "domain" / "delivery"
    consumer = tmp_path / "frontend" / "src" / "application"
    module.mkdir(parents=True)
    consumer.mkdir(parents=True)
    (module / "index.ts").write_text("export {};\n", encoding="utf-8")
    (module / "event.ts").write_text("export const event = 1;\n", encoding="utf-8")
    (consumer / "client.ts").write_text(
        'import { event } from "../domain/delivery/event";\n', encoding="utf-8"
    )

    result = inspect_repository_public_apis(authority, tmp_path)

    assert len(result.diagnostics) == 1
    assert result.diagnostics[0].source == "frontend/src/application/client.ts"

    monkeypatch.setattr(authority_cli, "inspect_repository_public_apis", lambda *_args: result)
    assert authority_cli.main([]) == 1
    assert "DEP-PUBLIC-API-DEEP-IMPORT" in capsys.readouterr().err

    unreadable = tmp_path / "unreadable" / "frontend" / "src" / "application" / "bad.ts"
    unreadable.parent.mkdir(parents=True)
    unreadable.write_bytes(b"\xff")
    with pytest.raises(PublicApiInspectionError, match="Impossible de lire"):
        inspect_repository_public_apis(authority, tmp_path / "unreadable")

    monkeypatch.setattr(
        authority_imports,
        "repository_paths",
        lambda *_args: (_ for _ in ()).throw(DomainInspectionError("listing unavailable")),
    )
    with pytest.raises(PublicApiInspectionError, match="listing unavailable"):
        inspect_repository_public_apis(authority, tmp_path)

    monkeypatch.setattr(
        authority_cli,
        "inspect_repository_public_apis",
        lambda *_args: (_ for _ in ()).throw(PublicApiInspectionError("scan unavailable")),
    )
    assert authority_cli.main([]) == 1
    assert "DEP-PUBLIC-API-SCAN" in capsys.readouterr().err
