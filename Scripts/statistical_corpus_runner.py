"""Execute the shared statistical corpus through the Python and TypeScript engines."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from backend.simulation_models import SimulationCommand, SimulationResult
from backend.simulation_service import run_simulation
from backend.simulation_value_objects import SimulationSeed

ROOT = Path(__file__).resolve().parents[1]
TYPESCRIPT_BRIDGE = ROOT / "frontend/scripts/run-statistical-reference-corpus.mjs"

CanonicalResult = dict[str, Any]
CaseExecutor = Callable[[dict[str, Any]], CanonicalResult]


def canonicalize_python_result(result: SimulationResult) -> CanonicalResult:
    """Rename language-specific fields without rounding, sorting, or filling absent values."""

    canonical: CanonicalResult = {
        "result_kind": result.result_kind,
        "result_percentiles": result.result_percentiles.to_dict(),
    }
    if result.risk_score is not None:
        canonical["risk_score"] = result.risk_score
    canonical["result_distribution"] = [
        {"x": bucket.x, "count": bucket.count} for bucket in result.result_distribution
    ]
    if result.completion_summary is not None:
        summary = result.completion_summary
        canonical["completion_summary"] = {
            "completed_count": summary.completed_count,
            "censored_count": summary.censored_count,
            "censored_rate": summary.censored_rate,
            "horizon_weeks": summary.horizon_weeks,
        }
    canonical["samples_count"] = result.samples_count
    reliability = result.throughput_reliability
    canonical["throughput_reliability"] = {
        "cv": reliability.cv,
        "iqr_ratio": reliability.iqr_ratio,
        "slope_norm": reliability.slope_norm,
        "label": reliability.label,
        "samples_count": reliability.samples_count,
    }
    canonical["seed"] = result.seed.value
    return canonical


def execute_python_case(reference_case: dict[str, Any]) -> CanonicalResult:
    input_value = reference_case["input"]
    command = SimulationCommand.create(
        throughput_samples=input_value["throughput_samples"],
        include_zero_weeks=input_value["include_zero_weeks"],
        mode=input_value["mode"],
        backlog_size=input_value.get("backlog_size"),
        target_weeks=input_value.get("target_weeks"),
        n_sims=input_value["n_sims"],
        seed=SimulationSeed(reference_case["seed"]),
    )
    return canonicalize_python_result(run_simulation(command))


def error_payload(error: object) -> dict[str, str]:
    if isinstance(error, BaseException):
        return {"type": type(error).__name__, "message": str(error)}
    return {"type": type(error).__name__, "message": str(error)}


def _engine_header(engine: str, corpus: dict[str, Any]) -> dict[str, Any]:
    return {
        "engine": engine,
        "corpus_id": corpus["corpus_id"],
        "schema_version": corpus["schema_version"],
        "prng_contract": corpus["prng_contract"]["id"],
    }


def run_python_corpus(
    corpus: dict[str, Any],
    execute_case: CaseExecutor = execute_python_case,
) -> dict[str, Any]:
    case_reports: list[dict[str, Any]] = []
    for reference_case in corpus["cases"]:
        try:
            case_reports.append(
                {
                    "id": reference_case["id"],
                    "status": "ok",
                    "result": execute_case(reference_case),
                }
            )
        except Exception as exc:  # noqa: BLE001 - engine failures are report data
            case_reports.append(
                {
                    "id": reference_case["id"],
                    "status": "engine_error",
                    "error": error_payload(exc),
                }
            )
    status = (
        "engine_error"
        if any(case_report["status"] == "engine_error" for case_report in case_reports)
        else "completed"
    )
    return {**_engine_header("python", corpus), "status": status, "cases": case_reports}


def _resolved_node_executable(node_executable: str | None) -> str:
    resolved = node_executable or shutil.which("node")
    if not resolved:
        raise RuntimeError("Node.js executable was not found.")
    return resolved


def run_typescript_corpus(
    corpus_path: Path,
    *,
    python_executable: str = sys.executable,
    node_executable: str | None = None,
) -> dict[str, Any]:
    completed = subprocess.run(
        [
            _resolved_node_executable(node_executable),
            str(TYPESCRIPT_BRIDGE),
            str(corpus_path.resolve()),
        ],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, "MCA_CORPUS_PYTHON": python_executable},
    )
    if completed.returncode:
        detail = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(
            f"TypeScript corpus bridge failed with exit code {completed.returncode}: {detail}"
        )
    try:
        report = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("TypeScript corpus bridge returned invalid JSON.") from exc
    if not isinstance(report, dict) or report.get("engine") != "typescript":
        raise RuntimeError("TypeScript corpus bridge returned an invalid engine report.")
    return report


def fatal_engine_report(
    engine: str,
    corpus: dict[str, Any],
    error: BaseException,
) -> dict[str, Any]:
    return {
        **_engine_header(engine, corpus),
        "status": "engine_error",
        "error": error_payload(error),
        "cases": [],
    }
