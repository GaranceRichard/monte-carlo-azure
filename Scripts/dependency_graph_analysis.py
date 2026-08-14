"""Cycle and boundary interpretations over observed dependency edges."""

from __future__ import annotations

import posixpath
from pathlib import Path
from typing import Any

from dependency_graph_common import SOURCE_ROOTS, SOURCE_SUFFIXES


def _cycle_edges(nodes: list[str], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for source, target in zip(nodes, [*nodes[1:], nodes[0]]):
        candidates = [
            edge for edge in edges if edge["source"] == source and edge["target"] == target
        ]
        result.append(
            next((edge for edge in candidates if edge["phase"] == "runtime"), candidates[0])
        )
    return result


def elementary_cycles(nodes: set[str], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    adjacency = {node: set() for node in nodes}
    for edge in edges:
        if edge["resolution"] == "internal" and edge["target"] in adjacency:
            adjacency[edge["source"]].add(edge["target"])
    found: set[tuple[str, ...]] = set()
    for start in sorted(nodes):

        def visit(node: str, path: list[str]) -> None:
            for target in sorted(adjacency[node]):
                if target == start:
                    found.add(tuple(path))
                elif target >= start and target not in path:
                    visit(target, [*path, target])

        visit(start, [start])
    cycles = []
    for index, members in enumerate(sorted(found), start=1):
        located = _cycle_edges(list(members), edges)
        cycles.append(
            {
                "id": f"CYC-{index:03d}",
                "phase": "runtime"
                if all(edge["phase"] == "runtime" for edge in located)
                else "compile-involved",
                "nodes": list(members),
                "edges": located,
            }
        )
    return cycles


def _source_root(path: str) -> str | None:
    return next((root.rstrip("/") for root in SOURCE_ROOTS if path.startswith(root)), None)


def deep_imports(edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    imports = []
    for item in edges:
        root = _source_root(item["target"])
        if item["resolution"] != "internal" or not root:
            continue
        relative = item["target"][len(root) + 1 :]
        if "/" not in relative or posixpath.dirname(item["source"]) == posixpath.dirname(
            item["target"]
        ):
            continue
        imports.append({**item, "crossedBoundary": f"{root}/{relative.split('/', 1)[0]}"})
    return imports


def api_bypasses(edges: list[dict[str, Any]], paths: set[str]) -> list[dict[str, Any]]:
    facades = []
    prefixes = {p[: index + 1] for p in paths for index, value in enumerate(p) if value == "/"}
    for path in sorted(paths):
        suffix = Path(path).suffix
        prefix = f"{path.removesuffix(suffix)}/"
        if suffix in SOURCE_SUFFIXES and prefix in prefixes:
            facades.append((path, prefix))
    bypasses = []
    for facade, prefix in facades:
        for item in edges:
            if (
                item["resolution"] == "internal"
                and item["target"].startswith(prefix)
                and item["source"] != facade
                and not item["source"].startswith(prefix)
            ):
                bypasses.append({**item, "facade": facade, "surface": prefix.rstrip("/")})
    return bypasses
