"""Detect technical DTO declarations and public signatures in Python."""

from __future__ import annotations

import ast

from Scripts.dependency_authority_contract import Diagnostic
from Scripts.dependency_authority_domain import LocatedDiagnostic
from Scripts.dependency_authority_dto_contract import (
    DTO_NAME,
    DtoDeclaration,
    DtoExposure,
    dto_names_in_text,
)


def _base_name(base: ast.expr) -> str:
    if isinstance(base, ast.Name):
        return base.id
    if isinstance(base, ast.Attribute):
        return base.attr
    return ""


def declaration_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.ClassDef):
        technical_base = any(
            _base_name(base) in {"BaseModel", "TypedDict"} for base in node.bases
        )
        return node.name if technical_base or DTO_NAME.search(node.name) else None
    if isinstance(node, (ast.Assign, ast.AnnAssign)):
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        name = next(
            (target.id for target in targets if isinstance(target, ast.Name)), None
        )
        return name if name and DTO_NAME.search(name) else None
    return None


def declarations(
    path: str, text: str
) -> tuple[list[DtoDeclaration], LocatedDiagnostic | None]:
    try:
        tree = ast.parse(text, filename=path)
    except SyntaxError as exc:
        return [], LocatedDiagnostic(
            path,
            Diagnostic(
                "DEP-DTO-PARSE",
                f"line {exc.lineno or 1}",
                f"Les DTO techniques ne peuvent pas être inspectés: {exc.msg}.",
                "Corriger la syntaxe Python afin de vérifier toutes les déclarations de DTO.",
            ),
        )
    found = [
        DtoDeclaration(path, name, node.lineno)
        for node in ast.walk(tree)
        if (name := declaration_name(node)) is not None
    ]
    return found, None


def _annotation_names(
    node: ast.AST | None, references: dict[str, str]
) -> tuple[str, ...]:
    if node is None:
        return ()
    annotation_names = dto_names_in_text(ast.unparse(node), set(references))
    return tuple(
        sorted({references[annotation_name] for annotation_name in annotation_names})
    )


def _dto_references(tree: ast.Module, names: set[str]) -> dict[str, str]:
    references = {name: name for name in names}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name in names:
                    references[alias.asname or alias.name] = alias.name
    return references


def _function_annotations(
    node: ast.FunctionDef | ast.AsyncFunctionDef,
) -> list[ast.expr | None]:
    annotations = [node.returns]
    annotations.extend(argument.annotation for argument in node.args.posonlyargs)
    annotations.extend(argument.annotation for argument in node.args.args)
    annotations.extend(argument.annotation for argument in node.args.kwonlyargs)
    if node.args.vararg is not None:
        annotations.append(node.args.vararg.annotation)
    if node.args.kwarg is not None:
        annotations.append(node.args.kwarg.annotation)
    return annotations


def exposures(
    path: str,
    text: str,
    dto_declarations: list[DtoDeclaration],
    names: set[str],
) -> list[DtoExposure]:
    try:
        tree = ast.parse(text, filename=path)
    except SyntaxError:
        return []
    references = _dto_references(tree, names)
    declared_here = {
        declaration.name
        for declaration in dto_declarations
        if declaration.source == path
    }
    found = [
        DtoExposure(path, name, (name,), node.lineno)
        for node in tree.body
        if (name := declaration_name(node)) in declared_here and not name.startswith("_")
    ]
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            referenced = tuple(
                sorted(
                    {
                        dto_name
                        for annotation in _function_annotations(node)
                        for dto_name in _annotation_names(annotation, references)
                    }
                )
            )
            if referenced:
                found.append(DtoExposure(path, node.name, referenced, node.lineno))
    return found


def imported_symbols(path: str, text: str, line: int) -> dict[str, str]:
    try:
        tree = ast.parse(text, filename=path)
    except SyntaxError:
        return {}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.lineno == line:
            return {alias.name: alias.asname or alias.name for alias in node.names}
    return {}
