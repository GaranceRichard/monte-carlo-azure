#!/usr/bin/env python3
"""Run the shared statistical corpus and emit an informational parity report."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.statistical_corpus_runner import (  # noqa: E402
    fatal_engine_report,
    run_python_corpus,
    run_typescript_corpus,
)
from Scripts.statistical_parity_report import (  # noqa: E402
    build_parity_report,
    invalid_corpus_report,
    write_reports,
)
from Scripts.validate_statistical_reference_corpus import (  # noqa: E402
    CORPUS_PATH,
    SCHEMA_PATH,
    load_json,
    validate_contract,
    validate_pbi_210_scope,
    validate_pbi_211_scope,
)

DEFAULT_JSON_REPORT = ROOT / "reports/statistical-parity-report.json"
DEFAULT_MARKDOWN_REPORT = ROOT / "reports/statistical-parity-report.md"
PythonRunner = Callable[[dict[str, Any]], dict[str, Any]]
TypeScriptRunner = Callable[[Path], dict[str, Any]]


def validate_for_execution(
    schema_path: Path,
    corpus_path: Path,
) -> tuple[dict[str, Any] | None, str | None, list[str]]:
    try:
        schema = load_json(schema_path)
    except (OSError, UnicodeError, ValueError) as exc:
        return None, "schema_invalid", [str(exc)]
    if not isinstance(schema, dict):
        return None, "schema_invalid", [f"{schema_path.as_posix()}:/: schema must be a JSON object"]
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        return None, "schema_invalid", [f"{schema_path.as_posix()}:/: {exc.message}"]

    try:
        corpus = load_json(corpus_path)
    except (OSError, UnicodeError, ValueError) as exc:
        return None, "corpus_invalid", [str(exc)]
    if not isinstance(corpus, dict):
        return None, "corpus_invalid", [f"{corpus_path.as_posix()}:/: corpus must be a JSON object"]

    issues = validate_contract(corpus, schema)
    issues.extend(validate_pbi_210_scope(corpus))
    issues.extend(validate_pbi_211_scope(corpus))
    diagnostics = [issue.render(corpus_path) for issue in issues]
    if diagnostics:
        return None, "corpus_invalid", sorted(set(diagnostics))
    return corpus, None, []


def _safe_engine_run(
    engine: str,
    corpus: dict[str, Any],
    runner: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    try:
        return runner()
    except Exception as exc:  # noqa: BLE001 - fatal engine failures are report data
        return fatal_engine_report(engine, corpus, exc)


def run_control(
    *,
    schema_path: Path = SCHEMA_PATH,
    corpus_path: Path = CORPUS_PATH,
    json_report_path: Path = DEFAULT_JSON_REPORT,
    markdown_report_path: Path = DEFAULT_MARKDOWN_REPORT,
    python_runner: PythonRunner = run_python_corpus,
    typescript_runner: TypeScriptRunner = run_typescript_corpus,
) -> dict[str, Any]:
    corpus, invalidity, diagnostics = validate_for_execution(schema_path, corpus_path)
    if corpus is None:
        report = invalid_corpus_report(invalidity or "corpus_invalid", diagnostics)
    else:
        python_report = _safe_engine_run(
            "python",
            corpus,
            lambda: python_runner(corpus),
        )
        typescript_report = _safe_engine_run(
            "typescript",
            corpus,
            lambda: typescript_runner(corpus_path),
        )
        report = build_parity_report(corpus, python_report, typescript_report)
    write_reports(report, json_report_path, markdown_report_path)
    return report


def _print_summary(report: dict[str, Any]) -> None:
    print(
        f"Statistical parity report: status={report['status']}, "
        "enforcement=informational."
    )
    if report["status"] == "invalid_corpus":
        print(
            f"Validation failed ({report['invalidity']}): "
            f"{len(report['diagnostics'])} diagnostic(s)."
        )
        return
    summary = report["summary"]
    print(
        f"Cases={summary['case_count']}; matches={summary['matching_cases']}; "
        f"normative divergences={summary['normative_divergence_cases']}; "
        f"engine divergences={summary['engine_divergence_cases']}; "
        f"engine error cases={summary['engine_error_cases']}; "
        f"fatal engine errors={summary['fatal_engine_errors']}."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", type=Path, default=SCHEMA_PATH)
    parser.add_argument("--corpus", type=Path, default=CORPUS_PATH)
    parser.add_argument("--json-report", type=Path, default=DEFAULT_JSON_REPORT)
    parser.add_argument("--markdown-report", type=Path, default=DEFAULT_MARKDOWN_REPORT)
    args = parser.parse_args(argv)
    report = run_control(
        schema_path=args.schema,
        corpus_path=args.corpus,
        json_report_path=args.json_report,
        markdown_report_path=args.markdown_report,
    )
    _print_summary(report)
    return 1 if report["status"] in {"invalid_corpus", "engine_error"} else 0


if __name__ == "__main__":
    raise SystemExit(main())
