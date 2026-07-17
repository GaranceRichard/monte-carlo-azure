#!/usr/bin/env python3
"""Enforce the repository maintainability ratchet without changing existing debt."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from maintainability_common import matches, normalize_path
from maintainability_config import load_inputs, read_json
from maintainability_dependencies import collect_dependencies, cyclic_components
from maintainability_metrics import collect_metric_debt
from maintainability_ratchet import compare_snapshot

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "maintainability.json"
DEFAULT_BASELINE = ROOT / "config" / "maintainability-baseline.json"
DEFAULT_EXCEPTIONS = ROOT / "config" / "maintainability-exceptions.json"
SCHEMA_VERSION = 1
CODE_SUFFIXES = {".py", ".js", ".jsx", ".ts", ".tsx"}
MOJIBAKE_PATTERNS = (
    ("replacement-character", re.compile("\ufffd|\u00ef\u00bf\u00bd")),
    ("utf8-as-latin1-a-tilde", re.compile(r"\u00c3[\x80-\u00ff]")),
    ("utf8-as-latin1-a-circumflex", re.compile(r"\u00c2(?:[\x80-\u00ff]|\s)")),
    ("utf8-as-latin1-punctuation", re.compile(r"\u00e2\u20ac.")),
)


def _tracked_paths(root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=root, check=False, capture_output=True
    )
    if result.returncode:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValueError(f"Unable to list tracked files: {detail}")
    return sorted(normalize_path(item) for item in result.stdout.decode().split("\0") if item)


def _source_texts(root: Path, config: dict[str, Any]) -> dict[str, str]:
    source_paths = {
        normalize_path(path.relative_to(root))
        for path in root.rglob("*")
        if path.is_file()
        and path.suffix in CODE_SUFFIXES
        and matches(normalize_path(path.relative_to(root)), config["sourcePatterns"])
    }
    return {
        path: (root / path).read_text(encoding="utf-8-sig") for path in sorted(source_paths)
    }


def _direction_violations(
    dependencies: set[tuple[str, str]], config: dict[str, Any]
) -> list[dict[str, str]]:
    violations: list[dict[str, str]] = []
    for rule in config.get("dependencyRules", []):
        for source, target in sorted(dependencies):
            if matches(source, rule["sourcePatterns"]) and matches(
                target, rule["forbiddenPatterns"]
            ):
                violations.append({"rule": rule["id"], "source": source, "target": target})
    return violations


def _is_probably_binary(data: bytes) -> bool:
    if b"\0" in data:
        return True
    sample = data[:8192]
    if not sample:
        return False
    control_bytes = sum(byte < 32 and byte not in (9, 10, 13) for byte in sample)
    return control_bytes / len(sample) > 0.05


def _mojibake_debt(root: Path, paths: list[str]) -> list[dict[str, Any]]:
    debt: list[dict[str, Any]] = []
    for path in paths:
        data = (root / path).read_bytes()
        if _is_probably_binary(data):
            continue
        try:
            content = data.decode("utf-8")
        except UnicodeDecodeError:
            debt.append({"path": path, "pattern": "invalid-utf8", "count": 1})
            continue
        for pattern_name, pattern in MOJIBAKE_PATTERNS:
            count = len(pattern.findall(content))
            if count:
                debt.append({"path": path, "pattern": pattern_name, "count": count})
    return sorted(debt, key=lambda item: (item["path"], item["pattern"]))


def build_snapshot(
    root: Path, config: dict[str, Any], tracked_paths: list[str] | None = None
) -> dict[str, Any]:
    paths = sorted(normalize_path(path) for path in (tracked_paths or _tracked_paths(root)))
    texts = _source_texts(root, config)
    dependencies = collect_dependencies(texts)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "limits": config["limits"],
        "metrics": collect_metric_debt(texts, config["limits"]),
        "cycles": cyclic_components(set(texts), dependencies),
        "dependencyViolations": _direction_violations(dependencies, config),
        "mojibake": _mojibake_debt(root, paths),
    }


def _write_baseline(path: Path, snapshot: dict[str, Any]) -> None:
    path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--exceptions", type=Path, default=DEFAULT_EXCEPTIONS)
    parser.add_argument("--write-baseline", action="store_true")
    args = parser.parse_args(argv)
    try:
        config = read_json(args.config, "maintainability config")
        snapshot = build_snapshot(args.root.resolve(), config)
        if args.write_baseline:
            _write_baseline(args.baseline, snapshot)
            print(f"Maintainability baseline written: {args.baseline}")
            return 0
        _, baseline, exceptions = load_inputs(args.config, args.baseline, args.exceptions)
        errors = compare_snapshot(snapshot, baseline, exceptions)
    except (OSError, SyntaxError, ValueError, KeyError, TypeError) as exc:
        print(f"ERROR: maintainability check could not run: {exc}", file=sys.stderr)
        return 2
    if errors:
        print("ERROR: maintainability ratchet detected a new or aggravated debt.", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("Maintainability ratchet passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
