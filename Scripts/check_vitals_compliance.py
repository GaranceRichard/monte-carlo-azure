#!/usr/bin/env python3
"""
Fail fast if the repository no longer maintains an explicit traceability map for vital paths.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from report_vitals_coverage import build_vitals_report, load_vitals_report_bundle

ROOT = Path(__file__).resolve().parents[1]
CRITICAL_PATHS = ROOT / "docs" / "critical-paths.md"
TRACEABILITY = ROOT / "docs" / "vitals-traceability.md"
TASKS = ROOT / ".vscode" / "tasks.json"
EXECUTION_PROFILES = ROOT / "config" / "test-execution-profiles.json"
MAIN_VALIDATION_TASK = "Validation : profil main"
LEGACY_VALIDATION_TASK = "Coverage:" + " 8 terminaux"
VITALS_THRESHOLD = 95.0


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _extract_critical_vitals(content: str) -> list[str]:
    lines = content.splitlines()
    in_official_list = False
    vitals: list[str] = []
    for line in lines:
        if line.strip() == "## Liste officielle des points vitaux":
            in_official_list = True
            continue
        if not in_official_list:
            continue
        if line.startswith("## "):
            break
        if line.startswith("- "):
            vitals.append(line[2:].strip())
    return vitals


def _extract_traceability_sections(content: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for line in content.splitlines():
        if line.startswith("### "):
            current = line[4:].strip()
            sections[current] = []
            continue
        if current is None:
            continue
        match = re.match(r"- `([^`]+)`", line.strip())
        if match:
            sections[current].append(match.group(1))
    return sections


def _metric_pct(metric: dict[str, int]) -> float | None:
    total = int(metric.get("total", 0))
    covered = int(metric.get("covered", 0))
    if total == 0 and covered == 0:
        return 100.0
    if total <= 0 or covered < 0 or covered > total:
        return None
    return (covered / total) * 100


def _append_vitals_rate_errors(
    errors: list[str],
    report: list[dict] | None = None,
) -> None:
    if report is None:
        try:
            report = build_vitals_report()
        except Exception as exc:  # pragma: no cover - defensive CLI behavior
            errors.append(f"Unable to build vitals coverage report: {exc}")
            return

    for vital in report:
        title = vital["title"]
        sources = vital.get("sources", {})
        if not sources:
            errors.append(f"Vital has no coverage sources: {title}")
            continue
        for source_name, result in sources.items():
            matched = result.get("matched") or []
            if not matched:
                errors.append(
                    "Vital coverage source has no matching files: "
                    f"{title} / {source_name}"
                )
                continue
            metrics = result.get("metrics") or {}
            for metric_name, metric in metrics.items():
                pct = _metric_pct(metric)
                if pct is None:
                    errors.append(
                        "Vital coverage metric has no data: "
                        f"{title} / {source_name} / {metric_name}"
                    )
                    continue
                if pct < VITALS_THRESHOLD:
                    errors.append(
                        "Vital coverage below "
                        f"{VITALS_THRESHOLD:.0f}%: "
                        f"{title} / {source_name} / {metric_name} = {pct:.2f}%"
                    )


def _append_main_validation_errors(errors: list[str]) -> None:
    if TASKS.exists():
        tasks_payload = json.loads(_read(TASKS))
        tasks = tasks_payload.get("tasks", [])
        labels = [task.get("label") for task in tasks]
        if "Coverage Vitals Compliance" not in labels:
            errors.append("Missing VS Code task: Coverage Vitals Compliance")
        if "Coverage Vitals Rates" not in labels:
            errors.append("Missing VS Code task: Coverage Vitals Rates")
        if labels.count(MAIN_VALIDATION_TASK) != 1:
            errors.append("Main-profile validation task must exist exactly once")
        if LEGACY_VALIDATION_TASK in labels:
            errors.append("Legacy coverage validation task must be removed")
        if EXECUTION_PROFILES.exists():
            contract = json.loads(_read(EXECUTION_PROFILES))
            aggregate = next(
                (node for node in contract.get("nodes", []) if node.get("id") == "aggregate"),
                {},
            )
            commands = aggregate.get("commands", [])
            if commands.count("Vitals coverage report") != 1:
                errors.append("Main DAG aggregate must include Vitals coverage report once")
            if commands.count("Vitals compliance") != 1:
                errors.append("Main DAG aggregate must include Vitals compliance once")
        else:
            errors.append("Missing versioned execution-profile contract")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report-json", type=Path)
    args = parser.parse_args(argv)
    errors: list[str] = []

    if not CRITICAL_PATHS.exists():
        errors.append("Missing docs/critical-paths.md")
    if not TRACEABILITY.exists():
        errors.append("Missing docs/vitals-traceability.md")
    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1

    vitals = _extract_critical_vitals(_read(CRITICAL_PATHS))
    traceability = _extract_traceability_sections(_read(TRACEABILITY))

    for vital in vitals:
        title = vital.split(":", 1)[0].strip()
        if title not in traceability:
            errors.append(f"Missing traceability section for vital: {title}")
            continue
        if not traceability[title]:
            errors.append(f"Vital has no referenced tests: {title}")
            continue
        for relpath in traceability[title]:
            if not (ROOT / relpath).exists():
                errors.append(f"Missing referenced test file for vital {title}: {relpath}")

    _append_main_validation_errors(errors)

    report = None
    if args.report_json is not None:
        try:
            report = load_vitals_report_bundle(args.report_json, ROOT)["report"]
        except ValueError as exc:
            errors.append(str(exc))
    if args.report_json is None or report is not None:
        _append_vitals_rate_errors(errors, report)

    if errors:
        print("ERROR: Vitals compliance check failed.", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
