"""JavaScript and TypeScript import extraction for dependency rules."""

from __future__ import annotations

import posixpath
import re

from Scripts.dependency_authority_imports import (
    SOURCE_SUFFIXES,
    ImportDependency,
    normalize_path,
)

JS_RESOLUTION_SUFFIXES = (*sorted(SOURCE_SUFFIXES - {".py"}), ".json", ".css")
JS_STATIC_FROM = re.compile(
    r"(?ms)^[ \t]*(?P<kind>import|export)\b(?P<body>[^;]*?\bfrom\s*)"
    r"(?P<quote>['\"])(?P<name>[^'\"]+)(?P=quote)"
)
JS_SIDE_EFFECT = re.compile(
    r"(?m)^[ \t]*import\s*(?P<quote>['\"])(?P<name>[^'\"]+)(?P=quote)"
)
JS_DYNAMIC = re.compile(
    r"\b(?P<kind>import|require)\s*\(\s*(?P<quote>['\"])(?P<name>[^'\"]+)"
    r"(?P=quote)\s*\)"
)


def _code_transition(text: str, index: int) -> tuple[int, str, str] | None:
    char = text[index]
    following = text[index + 1] if index + 1 < len(text) else ""
    if char == "/" and following == "/":
        return 2, "line-comment", ""
    if char == "/" and following == "*":
        return 2, "block-comment", ""
    if char in ("'", '"', "`"):
        return 1, "string", char
    return None


def _non_code_transition(
    text: str, index: int, state: str, quote: str
) -> tuple[int, str, str]:
    char = text[index]
    following = text[index + 1] if index + 1 < len(text) else ""
    if state == "line-comment" and char in "\r\n":
        return 1, "code", ""
    if state == "block-comment" and char == "*" and following == "/":
        return 2, "code", ""
    if state == "string" and char == "\\" and following:
        return 2, state, quote
    if state == "string" and char == quote:
        return 1, "code", ""
    return 1, state, quote


def _js_code_positions(text: str) -> list[bool]:
    """Mark code characters so matches inside comments or strings can be ignored."""
    positions = [True] * len(text)
    index = 0
    state = "code"
    quote = ""
    while index < len(text):
        transition = (
            _code_transition(text, index)
            if state == "code"
            else _non_code_transition(text, index, state, quote)
        )
        if transition is None:
            index += 1
            continue
        width, state, quote = transition
        if state != "code" or width == 2:
            for offset in range(width):
                positions[index + offset] = False
        index += width
    return positions


def _npm_target(specifier: str) -> str:
    parts = specifier.split("/")
    package = "/".join(parts[:2]) if specifier.startswith("@") else parts[0]
    return f"external:npm:{package}"


def _resolve_js(source: str, specifier: str, paths: set[str]) -> tuple[str, str]:
    if not specifier.startswith((".", "/")):
        return _npm_target(specifier), "external"
    if specifier.startswith("/") and source.startswith("frontend/"):
        base = normalize_path(posixpath.join("frontend", specifier.lstrip("/")))
    else:
        base = normalize_path(
            posixpath.normpath(posixpath.join(posixpath.dirname(source), specifier))
        )
    candidates = [base, *(base + suffix for suffix in JS_RESOLUTION_SUFFIXES)]
    candidates.extend(f"{base}/index{suffix}" for suffix in JS_RESOLUTION_SUFFIXES)
    target = next((candidate for candidate in candidates if candidate in paths), None)
    return (target, "internal") if target else (f"unresolved:{base}", "unresolved")


def _line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def javascript_dependencies(path: str, text: str, paths: set[str]) -> list[ImportDependency]:
    code_positions = _js_code_positions(text)
    found: dict[tuple[int, str, str], ImportDependency] = {}
    patterns: tuple[tuple[re.Pattern[str], str], ...] = (
        (JS_STATIC_FROM, "js-static"),
        (JS_SIDE_EFFECT, "js-side-effect"),
        (JS_DYNAMIC, "js-dynamic"),
    )
    for pattern, kind in patterns:
        for match in pattern.finditer(text):
            syntax_offset = match.start("kind") if "kind" in match.groupdict() else match.start()
            if syntax_offset >= len(code_positions) or not code_positions[syntax_offset]:
                continue
            specifier = match.group("name")
            target, resolution = _resolve_js(path, specifier, paths)
            body = match.groupdict().get("body") or ""
            phase = "compile" if body.lstrip().startswith("type ") else "runtime"
            dependency = ImportDependency(
                path,
                target,
                _line_number(text, syntax_offset),
                kind,
                phase,
                specifier,
                resolution,
            )
            found[(dependency.line, dependency.kind, dependency.specifier)] = dependency
    return sorted(found.values(), key=lambda item: (item.line, item.kind, item.specifier))
