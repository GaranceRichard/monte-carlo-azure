#!/usr/bin/env python3
"""Generate the informational consolidated statistical compliance report."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.statistical_consolidated_render import finalize_report, write_reports  # noqa: E402
from Scripts.statistical_consolidated_report import build_consolidated_report  # noqa: E402
from Scripts.statistical_consolidated_report_validation import validate_report  # noqa: E402

SCHEMA_PATH = ROOT / "contracts/statistical-consolidated-report-v1.0.schema.json"
DEFAULT_JSON_PATH = ROOT / "reports/statistical-consolidated-report.json"
DEFAULT_MARKDOWN_PATH = ROOT / "reports/statistical-consolidated-report.md"


def _load_schema(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Consolidated report schema must be an object.")
    return value


def run_control(
    *,
    root: Path = ROOT,
    schema_path: Path = SCHEMA_PATH,
    json_path: Path | None = None,
    markdown_path: Path | None = None,
) -> tuple[dict[str, object] | None, list[str]]:
    try:
        report = finalize_report(build_consolidated_report(root))
        issues = validate_report(report, _load_schema(schema_path))
        if not issues:
            write_reports(
                report,
                json_path or root / "reports/statistical-consolidated-report.json",
                markdown_path or root / "reports/statistical-consolidated-report.md",
            )
        return report, issues
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        return None, [f"Infrastructure failure while generating the report: {exc}"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--schema", type=Path, default=SCHEMA_PATH)
    parser.add_argument("--json-report", type=Path)
    parser.add_argument("--markdown-report", type=Path)
    args = parser.parse_args(argv)
    report, issues = run_control(
        root=args.root,
        schema_path=args.schema,
        json_path=args.json_report,
        markdown_path=args.markdown_report,
    )
    if issues or report is None:
        print("Rapport statistique consolidé invalide ou inexécutable.", file=sys.stderr)
        for issue in issues:
            print(f"- {issue}", file=sys.stderr)
        return 1
    verdict = report["verdict"]["status"]
    print(f"Rapport statistique consolidé : verdict={verdict}, enforcement=informational.")
    failure_classes = set(report["enforcement"]["generator_failure_classifications"])
    return 1 if verdict in failure_classes else 0


if __name__ == "__main__":
    raise SystemExit(main())
