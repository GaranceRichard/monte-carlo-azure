#!/usr/bin/env python3
"""
Render a vitals coverage report from the local coverage artifacts.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

if __package__:
    from Scripts.check_e2e_coverage import load_validated_artifact
else:
    from check_e2e_coverage import load_validated_artifact

ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "docs" / "vitals-coverage-map.json"
FRONTEND_UNIT = ROOT / "frontend" / "coverage" / "coverage-final.json"
BACKEND_JSON = ROOT / ".coverage.python.json"
E2E_JSON = ROOT / "frontend" / "coverage" / "e2e-coverage-summary.json"
E2E_CONFIG = ROOT / "frontend" / "e2e-coverage.config.json"
VITALS_REPORT_JSON = ROOT / "frontend" / "coverage" / "vitals-coverage-report.json"


def _normalize(path: str) -> str:
    return path.replace("\\", "/").lower()


def _basename(path: str) -> str:
    return _normalize(path).split("/")[-1]


def _empty_metrics(include_functions: bool = True) -> dict[str, dict]:
    metrics = {
        "statements": {"covered": 0, "total": 0},
        "branches": {"covered": 0, "total": 0},
        "lines": {"covered": 0, "total": 0},
    }
    if include_functions:
        metrics["functions"] = {"covered": 0, "total": 0}
    return metrics


def _raw_istanbul_metrics(payload: dict) -> dict[str, dict]:
    metrics = _empty_metrics(include_functions=True)

    statement_map = payload.get("statementMap") or {}
    statement_hits = payload.get("s") or {}
    metrics["statements"]["total"] = len(statement_map)
    metrics["statements"]["covered"] = sum(
        1 for key in statement_map if int(statement_hits.get(str(key), 0)) > 0
    )

    function_map = payload.get("fnMap") or {}
    function_hits = payload.get("f") or {}
    metrics["functions"]["total"] = len(function_map)
    metrics["functions"]["covered"] = sum(
        1 for key in function_map if int(function_hits.get(str(key), 0)) > 0
    )

    branch_hits = payload.get("b") or {}
    for counts in branch_hits.values():
        metrics["branches"]["total"] += len(counts)
        metrics["branches"]["covered"] += sum(1 for count in counts if int(count) > 0)

    line_hits: dict[int, bool] = {}
    for key, span in statement_map.items():
        start = span.get("start") or {}
        line = start.get("line")
        if line is None:
            continue
        line_num = int(line)
        covered = int(statement_hits.get(str(key), 0)) > 0
        line_hits[line_num] = line_hits.get(line_num, False) or covered
    metrics["lines"]["total"] = len(line_hits)
    metrics["lines"]["covered"] = sum(1 for covered in line_hits.values() if covered)

    return metrics


def _summary_istanbul_metrics(payload: dict) -> dict[str, dict]:
    metrics = _empty_metrics(include_functions=True)
    summary = payload.get("summary") or {}
    for metric in metrics:
        block = summary.get(metric) or {}
        metrics[metric]["covered"] = int(block.get("covered", 0))
        metrics[metric]["total"] = int(block.get("total", 0))
    return metrics


def _payload_metrics(payload: dict) -> dict[str, dict]:
    if "summary" in payload:
        return _summary_istanbul_metrics(payload)
    if "statementMap" in payload and "s" in payload:
        return _raw_istanbul_metrics(payload)
    return _empty_metrics(include_functions=True)


def _aggregate_istanbul(files: dict[str, dict], requested_paths: list[str]) -> dict[str, dict]:
    metrics = _empty_metrics(include_functions=True)
    matched: list[str] = []
    normalized_map = {_normalize(path): (path, payload) for path, payload in files.items()}

    for requested in requested_paths:
        requested_norm = _normalize(requested)
        payload = None
        chosen_path = None
        if requested_norm in normalized_map:
            chosen_path, payload = normalized_map[requested_norm]
        else:
            suffix_matches = [
                (path, file_payload)
                for norm_path, (path, file_payload) in normalized_map.items()
                if norm_path.endswith(requested_norm)
            ]
            if len(suffix_matches) == 1:
                chosen_path, payload = suffix_matches[0]
            else:
                basename_matches = [
                    (path, file_payload)
                    for path, file_payload in normalized_map.values()
                    if _basename(path) == _basename(requested)
                ]
                if len(basename_matches) == 1:
                    chosen_path, payload = basename_matches[0]
        if payload is None:
            continue
        matched.append(chosen_path)
        payload_metrics = _payload_metrics(payload)
        for metric in metrics:
            metrics[metric]["covered"] += int(payload_metrics.get(metric, {}).get("covered", 0))
            metrics[metric]["total"] += int(payload_metrics.get(metric, {}).get("total", 0))

    return {"metrics": metrics, "matched": matched}


def _aggregate_backend(files: dict[str, dict], requested_paths: list[str]) -> dict[str, dict]:
    metrics = {
        "statements": {"covered": 0, "total": 0},
        "branches": {"covered": 0, "total": 0},
        "lines": {"covered": 0, "total": 0},
    }
    matched: list[str] = []
    normalized_map = {_normalize(path): (path, payload) for path, payload in files.items()}

    for requested in requested_paths:
        requested_norm = _normalize(requested)
        payload = None
        chosen_path = None
        if requested_norm in normalized_map:
            chosen_path, payload = normalized_map[requested_norm]
        else:
            basename_matches = [
                (path, file_payload)
                for path, file_payload in normalized_map.values()
                if _basename(path) == _basename(requested)
            ]
            if len(basename_matches) == 1:
                chosen_path, payload = basename_matches[0]
        if payload is None:
            continue
        matched.append(chosen_path)
        summary = payload.get("summary") or {}
        num_statements = int(summary.get("num_statements", 0))
        missing_lines = len(payload.get("missing_lines", []))
        covered_lines = max(0, num_statements - missing_lines)
        metrics["statements"]["covered"] += covered_lines
        metrics["statements"]["total"] += num_statements
        metrics["lines"]["covered"] += covered_lines
        metrics["lines"]["total"] += num_statements
        if "num_branches" in summary:
            total_branches = int(summary.get("num_branches", 0))
            covered_branches = int(summary.get("covered_branches", 0))
            metrics["branches"]["covered"] += covered_branches
            metrics["branches"]["total"] += total_branches

    return {"metrics": metrics, "matched": matched}


def _pct(covered: int, total: int) -> str:
    if total == 0 and covered == 0:
        return "100.00%"
    if total <= 0:
        return "n/a"
    return f"{(covered / total) * 100:.2f}%"


def _paths(root: Path) -> dict[str, Path]:
    return {
        "mapping": root / "docs" / "vitals-coverage-map.json",
        "frontend_unit": root / "frontend" / "coverage" / "coverage-final.json",
        "backend": root / ".coverage.python.json",
        "e2e": root / "frontend" / "coverage" / "e2e-coverage-summary.json",
        "e2e_config": root / "frontend" / "e2e-coverage.config.json",
    }


def _artifact_identity(path: Path, root: Path) -> dict[str, int | str]:
    stat = path.stat()
    return {
        "path": path.relative_to(root).as_posix(),
        "size": stat.st_size,
        "mtimeNs": stat.st_mtime_ns,
    }


def load_coverage_artifacts(root: Path = ROOT) -> dict:
    """Read and validate every source artifact exactly once."""
    paths = _paths(root)
    mapping = json.loads(paths["mapping"].read_text(encoding="utf-8"))
    frontend_unit_files = (
        json.loads(paths["frontend_unit"].read_text(encoding="utf-8"))
        if paths["frontend_unit"].exists()
        else {}
    )
    backend_raw = (
        json.loads(paths["backend"].read_text(encoding="utf-8"))
        if paths["backend"].exists()
        else {}
    )
    backend_files = backend_raw.get("files", {})
    e2e_raw = load_validated_artifact(
        paths["e2e"],
        paths["e2e_config"],
    )
    e2e_files = {
        entry["file"]: {
            "summary": {
                metric: entry[metric] for metric in ["statements", "branches", "functions", "lines"]
            }
        }
        for entry in e2e_raw.get("byFile", [])
    }
    return {
        "mapping": mapping,
        "frontend_unit_files": frontend_unit_files,
        "backend_files": backend_files,
        "e2e_files": e2e_files,
    }


def build_vitals_report(
    artifacts: dict | None = None,
    *,
    root: Path = ROOT,
) -> list[dict]:
    artifacts = artifacts or load_coverage_artifacts(root)
    mapping = artifacts["mapping"]
    frontend_unit_files = artifacts["frontend_unit_files"]
    backend_files = artifacts["backend_files"]
    e2e_files = artifacts["e2e_files"]

    report: list[dict] = []
    for vital in mapping.get("vitals", []):
        sources = vital.get("sources", {})
        vital_entry = {"title": vital["title"], "sources": {}}
        if "frontend_unit" in sources:
            vital_entry["sources"]["frontend_unit"] = _aggregate_istanbul(
                frontend_unit_files,
                sources["frontend_unit"],
            )
        if "backend" in sources:
            vital_entry["sources"]["backend"] = _aggregate_backend(
                backend_files,
                sources["backend"],
            )
        if "e2e" in sources:
            vital_entry["sources"]["e2e"] = _aggregate_istanbul(e2e_files, sources["e2e"])
        report.append(vital_entry)
    return report


def build_vitals_report_bundle(root: Path = ROOT) -> dict:
    artifacts = load_coverage_artifacts(root)
    paths = _paths(root)
    source_paths = (
        paths["mapping"],
        paths["frontend_unit"],
        paths["backend"],
        paths["e2e"],
        paths["e2e_config"],
    )
    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sourceArtifacts": [_artifact_identity(path, root) for path in source_paths],
        "report": build_vitals_report(artifacts, root=root),
    }


def load_vitals_report_bundle(path: Path, root: Path = ROOT) -> dict:
    try:
        bundle = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid Vitals coverage report artifact: {exc}") from exc
    if not isinstance(bundle, dict) or bundle.get("schemaVersion") != 1:
        raise ValueError("Invalid Vitals coverage report schema.")
    if not isinstance(bundle.get("report"), list):
        raise ValueError("Invalid Vitals coverage report payload.")
    identities = bundle.get("sourceArtifacts")
    if not isinstance(identities, list) or not identities:
        raise ValueError("Missing Vitals source artifact identities.")
    for identity in identities:
        if not isinstance(identity, dict) or not isinstance(identity.get("path"), str):
            raise ValueError("Invalid Vitals source artifact identity.")
        source_path = root / identity["path"]
        if not source_path.exists():
            raise ValueError(f"Missing Vitals source artifact: {source_path}")
        current = _artifact_identity(source_path, root)
        if current != identity:
            raise ValueError(f"Stale Vitals coverage report; source changed: {identity['path']}")
    return bundle


def write_vitals_report_bundle(path: Path, root: Path = ROOT) -> dict:
    bundle = build_vitals_report_bundle(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return bundle


def render_vitals_report(report: list[dict]) -> None:
    print("Vitals coverage report")
    print("")

    for vital in report:
        print(vital["title"])
        for source_name, result in vital["sources"].items():
            metrics = result["metrics"]
            parts = [
                (
                    "statements="
                    f"{_pct(metrics['statements']['covered'], metrics['statements']['total'])}"
                ),
                f"branches={_pct(metrics['branches']['covered'], metrics['branches']['total'])}",
            ]
            if "functions" in metrics:
                parts.append(
                    "functions="
                    f"{_pct(metrics['functions']['covered'], metrics['functions']['total'])}"
                )
            parts.append(f"lines={_pct(metrics['lines']['covered'], metrics['lines']['total'])}")
            print(f"  {source_name}: {' '.join(parts)}")
        print("")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.output:
            bundle = write_vitals_report_bundle(args.output)
            report = bundle["report"]
        else:
            report = build_vitals_report()
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        print(f"ERROR: Unable to build Vitals coverage report: {exc}")
        return 1
    render_vitals_report(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
