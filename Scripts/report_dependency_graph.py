#!/usr/bin/env python3
"""Publish the repository's observed dependency graph without enforcing a target design."""

from __future__ import annotations

import argparse
import json
import posixpath
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from dependency_graph import (
    SOURCE_ROOTS,
    api_bypasses,
    collect_import_edges,
    deep_imports,
    elementary_cycles,
    line_number,
    normalize_path,
    repository_paths,
    source_texts,
)
from dependency_graph_render import render_markdown

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "reports" / "dependency-graph.json"
DEFAULT_DOCUMENT = ROOT / "docs" / "dependency-graph.md"
PATH_REFERENCE = re.compile(
    r"(?<![\w])(?P<name>(?:\.?[\w-]+[\\/])*[\w.-]+\.(?:tsx|jsx|mjs|py|ps1|ts|js))"
    r"(?![\w.])"
)
PYTHON_MODULE_REFERENCE = re.compile(r"\b(?P<name>(?:backend|Scripts)(?:\.[A-Za-z_]\w*)+):\w+")


def _declaration_paths(paths: list[str]) -> list[str]:
    exact = {
        "Dockerfile",
        "docker-compose.yml",
        "MonteCarloADO.spec",
        "start-dev.ps1",
        "frontend/index.html",
        "frontend/package.json",
        ".vscode/tasks.json",
    }
    return [
        path
        for path in paths
        if path in exact or path.startswith((".github/workflows/", ".githooks/"))
    ]


def _resolve_reference(declaration: str, name: str, paths: set[str]) -> tuple[str, str]:
    candidate = normalize_path(name)
    for marker in ("Scripts/", "backend/", "frontend/", ".vscode/"):
        if marker in candidate:
            candidate = candidate[candidate.index(marker) :]
            break
    if declaration.startswith("frontend/") and candidate.startswith(("src/", "scripts/")):
        candidate = f"frontend/{candidate}"
    elif declaration == ".vscode/tasks.json" and "/" not in candidate:
        local = f".vscode/scripts/{candidate}"
        candidate = local if local in paths else candidate
    elif candidate not in paths and "/" not in candidate:
        local = normalize_path(posixpath.join(posixpath.dirname(declaration), candidate))
        candidate = local if local in paths else candidate
    return (candidate, "internal") if candidate in paths else (f"missing:{candidate}", "missing")


def _main_guard_entries(texts: dict[str, str]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for path, text in texts.items():
        for match in re.finditer(r"(?m)^\s*if\s+__name__\s*==\s*['\"]__main__['\"]\s*:", text):
            entries.append(
                {
                    "declaredIn": path,
                    "line": line_number(text, match.start()),
                    "kind": "python-main-guard",
                    "target": path,
                    "resolution": "internal",
                }
            )
    return entries


def _declared_entries(root: Path, paths: list[str]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    path_set = set(paths)
    for declaration in _declaration_paths(paths):
        text = (root / declaration).read_text(encoding="utf-8-sig")
        matches = () if declaration == "frontend/package.json" else PATH_REFERENCE.finditer(text)
        for match in matches:
            target, resolution = _resolve_reference(declaration, match.group("name"), path_set)
            if (
                resolution == "missing"
                and "/" not in match.group("name")
                and not match.group("name").endswith(".ps1")
            ):
                continue
            entries.append(
                {
                    "declaredIn": declaration,
                    "line": line_number(text, match.start()),
                    "kind": "executable-reference",
                    "target": target,
                    "resolution": resolution,
                }
            )
        for match in PYTHON_MODULE_REFERENCE.finditer(text):
            target = match.group("name").replace(".", "/") + ".py"
            entries.append(
                {
                    "declaredIn": declaration,
                    "line": line_number(text, match.start()),
                    "kind": "python-module-entrypoint",
                    "target": target,
                    "resolution": "internal" if target in path_set else "missing",
                }
            )
    return entries


def _npm_entries(root: Path, paths: set[str]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    package_text = (root / "frontend/package.json").read_text(encoding="utf-8")
    package = json.loads(package_text)
    for name, command in package["scripts"].items():
        match = re.search(rf'(?m)^\s*"{re.escape(name)}"\s*:', package_text)
        path_match = PATH_REFERENCE.search(command)
        if path_match:
            target, resolution = _resolve_reference(
                "frontend/package.json", path_match.group("name"), paths
            )
        else:
            target, resolution = f"external:command:{command.split()[0]}", "external"
        entries.append(
            {
                "declaredIn": "frontend/package.json",
                "line": line_number(package_text, match.start()),
                "kind": "npm-script",
                "target": target,
                "resolution": resolution,
                "name": name,
            }
        )
    return entries


def collect_entrypoints(
    root: Path, paths: list[str], texts: dict[str, str]
) -> list[dict[str, Any]]:
    entries = _main_guard_entries(texts)
    entries += _declared_entries(root, paths)
    entries += _npm_entries(root, set(paths))
    unique = {json.dumps(item, sort_keys=True): item for item in entries}
    return sorted(
        unique.values(),
        key=lambda item: (item["declaredIn"], item["line"], item["kind"], item["target"]),
    )


def _area(path: str) -> str:
    if path.startswith("backend/"):
        return "backend"
    if path.startswith("frontend/src/"):
        return "frontend"
    if path.startswith(("Scripts/", "frontend/scripts/")):
        return "quality"
    return "launcher"


def _nodes(texts: dict[str, str]) -> list[dict[str, str]]:
    return [
        {
            "path": path,
            "area": _area(path),
            "language": "python" if path.endswith(".py") else "javascript",
        }
        for path in sorted(texts)
    ]


def _directions(edges: list[dict[str, Any]], texts: dict[str, str]) -> list[dict[str, Any]]:
    counts = Counter(
        (_area(item["source"]), _area(item["target"]), item["phase"])
        for item in edges
        if item["resolution"] == "internal" and item["target"] in texts
    )
    return [
        {"sourceArea": source, "targetArea": target, "phase": phase, "count": count}
        for (source, target, phase), count in sorted(counts.items())
    ]


def build_report(root: Path = ROOT, paths: list[str] | None = None) -> dict[str, Any]:
    visible_paths = paths or repository_paths(root)
    texts = source_texts(root, visible_paths)
    edges = collect_import_edges(texts, set(visible_paths))
    cycles = elementary_cycles(set(texts), edges)
    deep = deep_imports(edges)
    bypasses = api_bypasses(edges, set(visible_paths))
    entrypoints = collect_entrypoints(root, visible_paths, texts)
    return {
        "schemaVersion": 1,
        "generatedBy": "Scripts/report_dependency_graph.py",
        "scope": {"roots": list(SOURCE_ROOTS), "testsExcluded": True, "gitVisibleFiles": True},
        "summary": {
            "sourceModules": len(texts),
            "importEdges": len(edges),
            "entrypoints": len(entrypoints),
            "missingEntrypoints": sum(item["resolution"] == "missing" for item in entrypoints),
            "cycles": len(cycles),
            "runtimeCycles": sum(cycle["phase"] == "runtime" for cycle in cycles),
            "deepImports": len(deep),
            "apiBypasses": len(bypasses),
        },
        "observed": {
            "nodes": _nodes(texts),
            "edges": edges,
            "entrypoints": entrypoints,
            "cycles": cycles,
            "directions": _directions(edges, texts),
        },
        "interpretation": {
            "deepImports": deep,
            "apiBypasses": bypasses,
            "rule": (
                "A deep import crosses into a nested source directory; a bypass targets a "
                "same-name directory while a sibling facade file exists."
            ),
            "limits": [
                "Static extraction does not prove that every conditional path ran.",
                "Type-only imports are compile dependencies, not JavaScript runtime loads.",
                "These findings do not define the target architecture or authorize a migration.",
            ],
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--document", type=Path, default=DEFAULT_DOCUMENT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    try:
        report = build_report(args.root.resolve())
        rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
        document = render_markdown(report)
        if args.check:
            stale = [
                path
                for path, expected in ((args.report, rendered), (args.document, document))
                if not path.is_file() or path.read_text(encoding="utf-8") != expected
            ]
            if stale:
                print(
                    "ERROR: dependency graph outputs are stale: " + ", ".join(map(str, stale)),
                    file=sys.stderr,
                )
                return 1
            print("Dependency graph outputs are reproducible and current.")
            return 0
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.document.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered, encoding="utf-8")
        args.document.write_text(document, encoding="utf-8")
    except (OSError, SyntaxError, RuntimeError, ValueError, KeyError, TypeError) as exc:
        print(f"ERROR: dependency graph extraction failed: {exc}", file=sys.stderr)
        return 2
    print(f"Dependency graph written: {args.report} and {args.document}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
