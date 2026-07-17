from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FunctionMetric:
    symbol: str
    lines: int
    complexity: int


def _line_count(text: str) -> int:
    return sum(1 for line in text.splitlines() if line.strip())


def _python_complexity(node: ast.AST, *, skip_nested: bool = False) -> int:
    score = 1
    stack = list(ast.iter_child_nodes(node))
    while stack:
        child = stack.pop()
        if skip_nested and isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            continue
        if isinstance(
            child,
            (
                ast.If,
                ast.For,
                ast.AsyncFor,
                ast.While,
                ast.ExceptHandler,
                ast.IfExp,
                ast.match_case,
            ),
        ):
            score += 1
        elif isinstance(child, ast.BoolOp):
            score += max(0, len(child.values) - 1)
        elif isinstance(child, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            score += sum(1 + len(generator.ifs) for generator in child.generators)
        stack.extend(ast.iter_child_nodes(child))
    return score


def _python_functions(tree: ast.AST) -> list[FunctionMetric]:
    found: list[FunctionMetric] = []

    def visit(node: ast.AST, parents: tuple[str, ...]) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                symbol = ".".join((*parents, child.name))
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    end = child.end_lineno or child.lineno
                    found.append(
                        FunctionMetric(
                            symbol=symbol,
                            lines=end - child.lineno + 1,
                            complexity=_python_complexity(child, skip_nested=True),
                        )
                    )
                visit(child, (*parents, child.name))
            else:
                visit(child, parents)

    visit(tree, ())
    return sorted(found, key=lambda item: item.symbol)


def _strip_js_comments_and_strings(text: str) -> str:
    pattern = re.compile(
        r"//[^\n]*|/\*.*?\*/|(?<!/)\"(?:\\.|[^\"\\])*\"|"
        r"(?<!/)'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`",
        re.DOTALL,
    )
    return pattern.sub(lambda match: re.sub(r"[^\n]", " ", match.group()), text)


def _js_complexity(text: str) -> int:
    decisions = len(re.findall(r"\b(?:if|for|while|case|catch)\b", text))
    decisions += text.count("&&") + text.count("||")
    decisions += len(re.findall(r"\?(?![.?:])", text))
    return 1 + decisions


def _matching_brace(text: str, start: int) -> int | None:
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return index
    return None


def _js_function_candidates(text: str) -> list[tuple[int, str]]:
    patterns = (
        re.compile(r"(?:async\s+)?function\s+(?P<name>[A-Za-z_$][\w$]*)[^\{]*\{"),
        re.compile(
            r"\b(?:const|let|var)\s+(?P<name>[A-Za-z_$][\w$]*)[^=]*="
            r"\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?:\:[^=]+)?=>\s*\{"
        ),
        re.compile(
            r"(?m)^\s*(?:async\s+)?(?P<name>[A-Za-z_$][\w$]*)\s*\([^)]*\)"
            r"\s*(?:\:[^\{]+)?\{"
        ),
    )
    return sorted(
        (match.end() - 1, match.group("name"))
        for pattern in patterns
        for match in pattern.finditer(text)
    )


def _js_functions(text: str) -> list[FunctionMetric]:
    stripped = _strip_js_comments_and_strings(text)
    excluded = {"if", "for", "while", "switch", "catch", "function"}
    seen: set[tuple[int, str]] = set()
    occurrences: dict[str, int] = {}
    functions: list[FunctionMetric] = []
    for brace, name in _js_function_candidates(stripped):
        if name in excluded or (brace, name) in seen:
            continue
        seen.add((brace, name))
        end = _matching_brace(stripped, brace)
        if end is None:
            continue
        occurrences[name] = occurrences.get(name, 0) + 1
        symbol = name if occurrences[name] == 1 else f"{name}#{occurrences[name]}"
        block = stripped[brace : end + 1]
        functions.append(
            FunctionMetric(
                symbol=symbol,
                lines=block.count("\n") + 1,
                complexity=_js_complexity(block),
            )
        )
    return functions


def source_metrics(path: str, text: str) -> tuple[int, int, list[FunctionMetric]]:
    if path.endswith(".py"):
        tree = ast.parse(text, filename=path)
        return _line_count(text), _python_complexity(tree), _python_functions(tree)
    stripped = _strip_js_comments_and_strings(text)
    return _line_count(text), _js_complexity(stripped), _js_functions(text)


def collect_metric_debt(texts: dict[str, str], limits: dict[str, int]) -> list[dict[str, Any]]:
    metrics: list[dict[str, Any]] = []
    for path, content in texts.items():
        file_lines, file_complexity, functions = source_metrics(path, content)
        values = (("file.lines", file_lines, None), ("file.complexity", file_complexity, None))
        values += tuple(
            value
            for function in functions
            for value in (
                ("function.lines", function.lines, function.symbol),
                ("function.complexity", function.complexity, function.symbol),
            )
        )
        for metric, value, symbol in values:
            if value <= int(limits[metric]):
                continue
            item = {"path": path, "metric": metric, "limit": int(limits[metric]), "value": value}
            if symbol is not None:
                item["symbol"] = symbol
            metrics.append(item)
    return sorted(
        metrics,
        key=lambda item: (item["path"], item["metric"], item.get("symbol", "")),
    )
