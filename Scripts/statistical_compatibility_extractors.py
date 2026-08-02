"""Deterministic semantic extractors for statistical authorities."""

from __future__ import annotations

import ast
import re
from copy import deepcopy
from pathlib import Path
from typing import Any

from Scripts.statistical_compatibility_common import ExtractionError, load_json, sha256
from Scripts.statistical_compatibility_typescript import (
    _strip_typescript_comments,
    _typescript_symbol,
)

_IGNORED_JSON_KEYS = frozenset({"$comment", "description", "examples", "title"})


def _without_docstrings(node: ast.AST) -> ast.AST:
    candidate = deepcopy(node)
    for child in ast.walk(candidate):
        body = getattr(child, "body", None)
        if (
            isinstance(body, list)
            and body
            and isinstance(body[0], ast.Expr)
            and isinstance(body[0].value, ast.Constant)
            and isinstance(body[0].value.value, str)
        ):
            del body[0]
    return candidate


def _assignment_names(node: ast.AST) -> set[str]:
    targets: list[ast.expr] = []
    if isinstance(node, (ast.Assign, ast.AnnAssign)):
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
    return {target.id for target in targets if isinstance(target, ast.Name)}


def _python_symbol(tree: ast.Module, name: str) -> str:
    matches = [
        node
        for node in tree.body
        if getattr(node, "name", None) == name or name in _assignment_names(node)
    ]
    if len(matches) != 1:
        raise ExtractionError(f"Python authority {name!r} has {len(matches)} definitions")
    return ast.dump(_without_docstrings(matches[0]), annotate_fields=True, include_attributes=False)


def _sanitize_json(value: Any, ignored_keys: frozenset[str]) -> Any:
    if isinstance(value, dict):
        return {
            key: _sanitize_json(item, ignored_keys)
            for key, item in value.items()
            if key not in ignored_keys
        }
    if isinstance(value, list):
        return [_sanitize_json(item, ignored_keys) for item in value]
    return value


def _markdown_rules(text: str, selectors: list[str]) -> list[dict[str, str]]:
    headings = list(re.finditer(r"(?m)^###\s+(STAT-PAR-\d{3})\s+[^\r\n]+$", text))
    extracted: list[dict[str, str]] = []
    for selector in selectors:
        matches = [match for match in headings if match.group(1) == selector]
        if len(matches) != 1:
            raise ExtractionError(f"Markdown authority {selector!r} has {len(matches)} sections")
        match = matches[0]
        later = [item.start() for item in headings if item.start() > match.start()]
        section_end = min(later) if later else len(text)
        section = re.sub(r"<!--.*?-->", "", text[match.start() : section_end], flags=re.DOTALL)
        extracted.append({"rule": selector, "text": " ".join(section.split())})
    return extracted


def extract_part(root: Path, part: dict[str, Any]) -> dict[str, Any]:
    path = root / part["path"]
    try:
        raw = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise ExtractionError(f"cannot read authority {part['path']}") from exc
    kind = part["kind"]
    selectors = part["selectors"]
    if kind == "python_ast":
        try:
            tree = ast.parse(raw, filename=part["path"])
        except SyntaxError as exc:
            raise ExtractionError(f"cannot parse Python authority {part['path']}") from exc
        value: Any = [_python_symbol(tree, selector) for selector in selectors]
    elif kind == "typescript_declarations":
        clean = _strip_typescript_comments(raw)
        value = [
            {"symbol": selector, "tokens": _typescript_symbol(clean, selector)}
            for selector in selectors
        ]
    elif kind == "markdown_rules":
        value = _markdown_rules(raw, selectors)
    elif kind == "json_semantic":
        try:
            document = load_json(path)
        except (OSError, UnicodeError, ValueError) as exc:
            raise ExtractionError(f"cannot parse JSON authority {part['path']}") from exc
        ignored = _IGNORED_JSON_KEYS | frozenset(part.get("ignored_keys", []))
        from Scripts.statistical_compatibility_common import json_pointer

        value = [
            {
                "pointer": selector,
                "value": _sanitize_json(json_pointer(document, selector), ignored),
            }
            for selector in selectors
        ]
    else:
        raise ExtractionError(f"unknown extraction kind: {kind}")
    return {"path": part["path"], "kind": kind, "selectors": selectors, "value": value}


def component_fingerprint(root: Path, component: dict[str, Any]) -> str:
    return sha256([extract_part(root, part) for part in component["authorities"]])


def json_document_fingerprint(root: Path, path: str) -> str:
    try:
        document = load_json(root / path)
    except (OSError, UnicodeError, ValueError) as exc:
        raise ExtractionError(f"cannot parse proof artifact {path}") from exc
    return sha256(_sanitize_json(document, _IGNORED_JSON_KEYS))
