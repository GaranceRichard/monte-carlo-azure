#!/usr/bin/env python3
"""Validate the complete versioned Python coverage scope and its JSON report."""

from __future__ import annotations

import argparse
import configparser
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from maintainability_common import normalize_path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / ".coveragerc"
DEFAULT_REPORT = ROOT / ".coverage.python.json"


def _config_lines(config: configparser.ConfigParser, section: str, option: str) -> list[str]:
    return [line.strip() for line in config.get(section, option).splitlines() if line.strip()]


def load_policy(path: Path) -> dict[str, Any]:
    config = configparser.ConfigParser()
    if not config.read(path, encoding="utf-8"):
        raise ValueError(f"Missing Python coverage configuration: {path}")
    try:
        return {
            "branch": config.getboolean("run", "branch"),
            "sources": _config_lines(config, "run", "source"),
            "globalThreshold": config.getfloat("report", "fail_under"),
            "perFileThreshold": config.getfloat("montecarlo", "per_file_fail_under"),
            "requireNoMissingLines": config.getboolean(
                "montecarlo", "require_no_missing_lines"
            ),
            "excludedTrackedPrefixes": _config_lines(
                config, "montecarlo", "excluded_tracked_prefixes"
            ),
        }
    except (configparser.Error, ValueError) as exc:
        raise ValueError(f"Invalid Python coverage configuration: {path}: {exc}") from exc


def expected_source_files(root: Path, sources: list[str]) -> set[str]:
    expected: set[str] = set()
    for source in sources:
        candidate = root / source
        if candidate.is_dir():
            expected.update(
                normalize_path(path.relative_to(root)) for path in candidate.rglob("*.py")
            )
            continue
        module_path = candidate if candidate.suffix == ".py" else candidate.with_suffix(".py")
        if module_path.is_file():
            expected.add(normalize_path(module_path.relative_to(root)))
    return expected


def tracked_python_files(root: Path) -> set[str]:
    result = subprocess.run(
        ["git", "ls-files", "*.py"],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        raise ValueError(f"Unable to list versioned Python files: {result.stderr.strip()}")
    return {normalize_path(line) for line in result.stdout.splitlines() if line.strip()}


def _load_report(path: Path) -> dict[str, Any]:
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid Python coverage report: {path}: {exc}") from exc
    if not isinstance(report, dict) or not isinstance(report.get("files"), dict):
        raise ValueError(f"Invalid Python coverage report schema: {path}")
    return report


def _scope_errors(
    root: Path,
    policy: dict[str, Any],
    report_files: dict[str, Any],
    tracked_files: set[str] | None,
) -> tuple[set[str], list[str]]:
    expected = expected_source_files(root, policy["sources"])
    tracked = tracked_files if tracked_files is not None else tracked_python_files(root)
    excluded = tuple(policy["excludedTrackedPrefixes"])
    errors = [
        f"Versioned executable Python file is outside the coverage scope: {path}"
        for path in sorted(path for path in tracked if not path.startswith(excluded))
        if path not in expected
    ]
    errors.extend(
        f"Expected Python source is absent from the coverage report: {path}"
        for path in sorted(expected - set(report_files))
    )
    return expected, errors


def _summary_errors(policy: dict[str, Any], report: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    meta = report.get("meta") or {}
    if bool(meta.get("branch_coverage")) is not bool(policy["branch"]):
        errors.append("Python branch coverage does not match the declared policy.")
    total_percent = float((report.get("totals") or {}).get("percent_covered", 0))
    if total_percent < float(policy["globalThreshold"]):
        errors.append(
            f"Global Python coverage {total_percent:.2f}% is below "
            f"{float(policy['globalThreshold']):.2f}%."
        )
    return errors


def _file_errors(path: str, policy: dict[str, Any], file_report: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    percent = float((file_report.get("summary") or {}).get("percent_covered", 0))
    if percent < float(policy["perFileThreshold"]):
        errors.append(
            f"{path}: coverage {percent:.2f}% is below "
            f"{float(policy['perFileThreshold']):.2f}%."
        )
    missing_lines = list(file_report.get("missing_lines") or [])
    if policy["requireNoMissingLines"] and missing_lines:
        errors.append(f"{path}: uncovered lines: {missing_lines}")
    return errors


def validate_report(
    root: Path,
    policy: dict[str, Any],
    report: dict[str, Any],
    *,
    tracked_files: set[str] | None = None,
) -> list[str]:
    report_files = {normalize_path(path): value for path, value in report["files"].items()}
    expected, errors = _scope_errors(root, policy, report_files, tracked_files)
    errors.extend(_summary_errors(policy, report))
    for path in sorted(expected & set(report_files)):
        errors.extend(_file_errors(path, policy, report_files[path]))
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args(argv)
    try:
        policy = load_policy(args.config)
        report = _load_report(args.report)
        errors = validate_report(args.root.resolve(), policy, report)
    except (OSError, TypeError, ValueError) as exc:
        print(f"ERROR: Python coverage validation could not run: {exc}", file=sys.stderr)
        return 2
    if errors:
        print("ERROR: Python coverage validation failed.", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("Python coverage scope and report passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
