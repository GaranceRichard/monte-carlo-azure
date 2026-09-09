"""Detect technical DTO declarations and public signatures in JavaScript."""

from __future__ import annotations

import re

from Scripts.dependency_authority_dto_contract import (
    DTO_NAME,
    DtoDeclaration,
    DtoExposure,
)
from Scripts.dependency_authority_javascript import _js_code_positions

JS_DTO_DECLARATION = re.compile(
    r"(?m)^[ \t]*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?"
    r"(?:type|interface|class|enum|const|let|var)\s+"
    r"(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)\b"
)
JS_EXPORTED_FUNCTION = re.compile(
    r"(?ms)^[ \t]*export\s+(?:async\s+)?function\s+"
    r"(?P<symbol>[A-Za-z_$][A-Za-z0-9_$]*)"
    r"(?P<header>[^\{;]*)"
)
JS_EXPORTED_VALUE = re.compile(
    r"(?ms)^[ \t]*export\s+(?:declare\s+)?(?:const|let|var)\s+"
    r"(?P<symbol>[A-Za-z_$][A-Za-z0-9_$]*)"
    r"(?P<header>[^;]*)"
)
JS_NAMED_IMPORT = re.compile(
    r"(?ms)^[ \t]*import\s+(?:type\s+)?\{(?P<names>[^}]*)\}\s+from\s+['\"]"
)


def _line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def declarations(path: str, text: str) -> list[DtoDeclaration]:
    code_positions = _js_code_positions(text)
    found: list[DtoDeclaration] = []
    for match in JS_DTO_DECLARATION.finditer(text):
        offset = match.start("name")
        name = match.group("name")
        if code_positions[offset] and DTO_NAME.search(name):
            found.append(DtoDeclaration(path, name, _line_number(text, offset)))
    return found


def _dto_references(text: str, names: set[str]) -> dict[str, str]:
    references = {name: name for name in names}
    positions = _js_code_positions(text)
    for match in JS_NAMED_IMPORT.finditer(text):
        if not positions[match.start()]:
            continue
        for raw_item in match.group("names").split(","):
            item = re.sub(r"^\s*type\s+", "", raw_item.strip())
            parts = re.split(r"\s+as\s+", item, maxsplit=1)
            imported = parts[0]
            if imported in names:
                references[parts[-1]] = imported
    return references


def exposures(
    path: str,
    text: str,
    dto_declarations: list[DtoDeclaration],
    names: set[str],
) -> list[DtoExposure]:
    positions = _js_code_positions(text)
    references = _dto_references(text, names)
    lines = text.splitlines()
    found = [
        DtoExposure(path, declaration.name, (declaration.name,), declaration.line)
        for declaration in dto_declarations
        if declaration.source == path
        and re.match(r"^[ \t]*export\b", lines[declaration.line - 1])
    ]
    for pattern in (JS_EXPORTED_FUNCTION, JS_EXPORTED_VALUE):
        for match in pattern.finditer(text):
            if not positions[match.start()]:
                continue
            header = match.group("header")
            if pattern is JS_EXPORTED_VALUE:
                delimiter = "=>" if "=>" in header else "="
                header = header.split(delimiter, 1)[0]
            referenced = tuple(
                sorted(
                    {
                        dto_name
                        for local_name, dto_name in references.items()
                        if re.search(rf"\b{re.escape(local_name)}\b", header)
                    }
                )
            )
            if referenced:
                found.append(
                    DtoExposure(
                        path,
                        match.group("symbol"),
                        referenced,
                        _line_number(text, match.start("symbol")),
                    )
                )
    return found


def reexported_symbols(text: str, line: int) -> dict[str, str] | None:
    statement = "\n".join(text.splitlines()[line - 1 :]).split(";", 1)[0]
    if not statement.lstrip().startswith("export"):
        return {}
    if re.search(r"\bexport\s*\*", statement):
        return None
    names = re.search(r"\{(?P<names>[^}]*)\}", statement)
    if names is None:
        return {}
    selected: dict[str, str] = {}
    for raw_item in names.group("names").split(","):
        item = re.sub(r"^\s*type\s+", "", raw_item.strip())
        if not item:
            continue
        parts = re.split(r"\s+as\s+", item, maxsplit=1)
        selected[parts[0]] = parts[-1]
    return selected
