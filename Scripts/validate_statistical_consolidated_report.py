#!/usr/bin/env python3
"""Validate the consolidated JSON and its Markdown projection independently."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.statistical_consolidated_render import (  # noqa: E402
    finalize_report,
    render_markdown,
)
from Scripts.statistical_consolidated_report import build_consolidated_report  # noqa: E402
from Scripts.statistical_consolidated_report_validation import validate_report  # noqa: E402
from Scripts.statistical_consolidated_source_catalog import parse_source_paths  # noqa: E402

DEFAULT_REPORT = ROOT / "reports/statistical-consolidated-report.json"
DEFAULT_MARKDOWN = ROOT / "reports/statistical-consolidated-report.md"
DEFAULT_SCHEMA = ROOT / "contracts/statistical-consolidated-report-v1.0.schema.json"


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def run_control(
    report_path: Path = DEFAULT_REPORT,
    schema_path: Path = DEFAULT_SCHEMA,
    markdown_path: Path = DEFAULT_MARKDOWN,
    *,
    root: Path = ROOT,
    source_paths: dict[str, str] | None = None,
) -> tuple[dict[str, Any] | None, list[str]]:
    try:
        report = _load(report_path)
        schema = _load(schema_path)
        issues = validate_report(report, schema)
        if not issues and markdown_path.read_text(encoding="utf-8") != render_markdown(report):
            issues.append("Markdown projection differs from the consolidated model.")
        expected = finalize_report(build_consolidated_report(root, source_paths))
        if not issues and report != expected:
            issues.append("Consolidated report is stale against the supplied current-run sources.")
        return report if isinstance(report, dict) else None, issues
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        return None, [f"Consolidated report cannot be validated: {exc}"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--markdown", type=Path, default=DEFAULT_MARKDOWN)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--source-path", action="append", default=[])
    args = parser.parse_args(argv)
    try:
        source_paths = parse_source_paths(args.source_path)
        report, issues = run_control(
            args.report,
            args.schema,
            args.markdown,
            root=args.root,
            source_paths=source_paths,
        )
    except ValueError as exc:
        report, issues = None, [str(exc)]
    if report is None or issues:
        print("Rapport statistique consolidé invalide.", file=sys.stderr)
        for issue in issues:
            print(f"- {issue}", file=sys.stderr)
        return 1
    print(
        "Rapport statistique consolidé valide : "
        f"verdict={report['verdict']['status']}, "
        f"sha256={report['integrity']['content_sha256']}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
