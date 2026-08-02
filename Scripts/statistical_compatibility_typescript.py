"""Deterministic TypeScript declaration tokenization without comments."""

from __future__ import annotations

import re

from Scripts.statistical_compatibility_common import ExtractionError

_TS_TOKEN = re.compile(
    r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`|'
    r"0[xX][0-9a-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?|[A-Za-z_$][\w$]*|"
    r"===|!==|>>>|<<=|>>=|=>|\*\*|\?\?|\?\.|&&|\|\||<=|>=|==|!=|\+\+|--|"
    r"\+=|-=|\*=|/=|\.\.\.|[^\s]"
)


def _quoted_fragment(source: str, start: int) -> tuple[str, int]:
    quote = source[start]
    output = [quote]
    index = start + 1
    while index < len(source):
        char = source[index]
        output.append(char)
        if char == "\\" and index + 1 < len(source):
            index += 1
            output.append(source[index])
        elif char == quote:
            return "".join(output), index + 1
        index += 1
    raise ExtractionError("unterminated TypeScript string")


def _strip_typescript_comments(source: str) -> str:
    output: list[str] = []
    index = 0
    while index < len(source):
        char = source[index]
        next_char = source[index + 1] if index + 1 < len(source) else ""
        if char in {'"', "'", "`"}:
            fragment, index = _quoted_fragment(source, index)
            output.append(fragment)
            continue
        if char == "/" and next_char == "/":
            index += 2
            while index < len(source) and source[index] not in "\r\n":
                index += 1
            output.append("\n")
            continue
        if char == "/" and next_char == "*":
            end = source.find("*/", index + 2)
            if end < 0:
                raise ExtractionError("unterminated TypeScript block comment")
            output.append("\n" * source[index : end + 2].count("\n"))
            index = end + 2
            continue
        output.append(char)
        index += 1
    return "".join(output)


def _quote_step(source: str, index: int, quote: str | None) -> tuple[str | None, int, bool]:
    char = source[index]
    if quote is None:
        return (char, index, True) if char in {'"', "'", "`"} else (None, index, False)
    if char == "\\":
        return quote, index + 1, True
    return (None if char == quote else quote), index, True


def _balanced_end(source: str, start: int, terminal: str) -> int:
    pairs = {"{": "}", "(": ")", "[": "]"}
    stack: list[str] = []
    quote: str | None = None
    index = start
    while index < len(source):
        char = source[index]
        quote, index, quoted = _quote_step(source, index, quote)
        if quoted:
            index += 1
            continue
        if char in pairs:
            stack.append(pairs[char])
        elif stack and char == stack[-1]:
            stack.pop()
            if not stack and char == terminal:
                return index + 1
        elif not stack and char == terminal:
            return index + 1
        index += 1
    raise ExtractionError("unterminated TypeScript declaration")


def _declaration_match(source: str, name: str) -> tuple[str, re.Match[str]]:
    escaped = re.escape(name)
    patterns = (
        ("function", re.compile(rf"(?m)^[ \t]*(?:export\s+)?(?:async\s+)?function\s+{escaped}\b")),
        ("variable", re.compile(rf"(?m)^[ \t]*(?:export\s+)?(?:const|let|var)\s+{escaped}\b")),
        ("type", re.compile(rf"(?m)^[ \t]*(?:export\s+)?type\s+{escaped}\b")),
    )
    matches = [(kind, match) for kind, pattern in patterns for match in pattern.finditer(source)]
    if len(matches) != 1:
        raise ExtractionError(f"TypeScript authority {name!r} has {len(matches)} definitions")
    return matches[0]


def _function_end(source: str, name: str, match: re.Match[str]) -> int:
    parameters = source.find("(", match.end())
    if parameters < 0:
        raise ExtractionError(f"TypeScript function {name!r} has no parameter list")
    parameter_end = _balanced_end(source, parameters, ")")
    brace = source.find("{", parameter_end)
    if brace < 0:
        raise ExtractionError(f"TypeScript function {name!r} has no body")
    end = _balanced_end(source, brace, "}")
    after_candidate = end
    while after_candidate < len(source) and source[after_candidate].isspace():
        after_candidate += 1
    if after_candidate < len(source) and source[after_candidate] == "{":
        end = _balanced_end(source, after_candidate, "}")
    return end


def _typescript_symbol(source: str, name: str) -> list[str]:
    kind, match = _declaration_match(source, name)
    end = (
        _function_end(source, name, match)
        if kind == "function"
        else _balanced_end(source, match.end(), ";")
    )
    return _TS_TOKEN.findall(source[match.start() : end])
