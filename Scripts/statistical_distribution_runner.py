"""Build, execute and compare symmetric multi-seed engine cohorts."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from copy import deepcopy
from pathlib import Path
from typing import Any

from Scripts.statistical_corpus_runner import run_python_corpus
from Scripts.statistical_distribution_metrics import (
    inferential_metric,
    scenario_results,
    structural_metrics,
)
from Scripts.statistical_distribution_protocol import partitioned_seeds
from Scripts.statistical_distribution_statistics import (
    aggregate_verdict,
    holm_adjust,
)

ROOT = Path(__file__).resolve().parents[1]
TYPESCRIPT_BRIDGE = ROOT / "frontend/scripts/run-statistical-distribution.mjs"


class InfrastructureError(RuntimeError):
    """The execution environment cannot launch a required engine."""


class EngineExecutionError(RuntimeError):
    """An engine failed or violated its report protocol."""


def build_execution_plan(
    protocol: dict[str, Any],
    seed_document: dict[str, Any],
    corpus: dict[str, Any],
    engine: str,
) -> dict[str, Any]:
    sources = {case["id"]: case for case in corpus["cases"]}
    cohort_id = protocol["cohort_assignment"][engine]
    cohort = partitioned_seeds(seed_document)[cohort_id]
    cases: list[dict[str, Any]] = []
    for scenario in protocol["scenarios"]:
        normalized_input = deepcopy(sources[scenario["source_case_id"]]["input"])
        normalized_input["n_sims"] = scenario["n_sims"]
        for index, seed in enumerate(cohort[: scenario["cohort_size"]]):
            cases.append(
                {
                    "id": f"{scenario['id']}:{index}",
                    "input": deepcopy(normalized_input),
                    "seed": seed,
                }
            )
    return {
        "proof_kind": "distributional_parity",
        "protocol_version": protocol["version"],
        "cohort_id": cohort_id,
        "corpus_id": corpus["corpus_id"],
        "schema_version": corpus["schema_version"],
        "normative_contract": corpus["normative_contract"],
        "prng_contract": {"id": corpus["prng_contract"]["id"]},
        "cases": cases,
    }


def _augment_python_report(report: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
    return {
        **report,
        "proof_kind": plan["proof_kind"],
        "protocol_version": plan["protocol_version"],
        "cohort_id": plan["cohort_id"],
    }


def run_python_plan(plan: dict[str, Any]) -> dict[str, Any]:
    report = run_python_corpus(plan, batch_size=1000)
    return _augment_python_report(report, plan)


def run_typescript_plan(
    plan: dict[str, Any], *, node_executable: str | None = None,
) -> dict[str, Any]:
    node = node_executable or shutil.which("node")
    if not node:
        raise InfrastructureError("Node.js est introuvable.")
    try:
        completed = subprocess.run(
            [node, str(TYPESCRIPT_BRIDGE)],
            cwd=ROOT,
            input=json.dumps(plan, separators=(",", ":")),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            env=os.environ.copy(),
        )
    except OSError as exc:
        raise InfrastructureError(f"Le pont TypeScript est inexécutable : {exc}.") from exc
    if completed.returncode:
        detail = completed.stderr.strip() or completed.stdout.strip()
        raise InfrastructureError(
            f"Le pont TypeScript a échoué ({completed.returncode}) : {detail}."
        )
    try:
        report = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise InfrastructureError("Le pont TypeScript a produit un JSON invalide.") from exc
    if not isinstance(report, dict):
        raise InfrastructureError("Le pont TypeScript n'a pas produit un objet JSON.")
    return report


def validate_engine_report(report: dict[str, Any], plan: dict[str, Any], engine: str) -> None:
    expected_header = {
        "engine": engine,
        "proof_kind": plan["proof_kind"],
        "protocol_version": plan["protocol_version"],
        "cohort_id": plan["cohort_id"],
        "corpus_id": plan["corpus_id"],
        "schema_version": plan["schema_version"],
        "normative_contract": plan["normative_contract"],
        "prng_contract": plan["prng_contract"]["id"],
    }
    divergent = [key for key, value in expected_header.items() if report.get(key) != value]
    if divergent:
        raise EngineExecutionError(f"Header {engine} divergent : {', '.join(divergent)}.")
    expected_ids = [case["id"] for case in plan["cases"]]
    actual_cases = report.get("cases")
    if not isinstance(actual_cases, list):
        raise EngineExecutionError(f"Le moteur {engine} n'a pas produit une liste de cas.")
    actual_ids = [case.get("id") for case in actual_cases if isinstance(case, dict)]
    if actual_ids != expected_ids:
        raise EngineExecutionError(f"Le moteur {engine} a altéré les cas ou leur ordre.")
    failures = [case for case in actual_cases if case.get("status") != "ok"]
    if report.get("status") != "completed" or failures:
        detail = failures[0].get("error") if failures else report.get("error")
        raise EngineExecutionError(f"Le moteur {engine} a échoué : {detail}.")


def _artifact_fingerprint(report: dict[str, Any]) -> str:
    canonical = json.dumps(report, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _build_scenario_reports(
    protocol: dict[str, Any],
    python_report: dict[str, Any],
    typescript_report: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    inference = protocol["inference"]
    inferential_count = sum(
        len(scenario["metrics"])
        for scenario in protocol["scenarios"]
        if scenario["distribution_view"] != "structural-censor-state"
    )
    alpha = inference["familywise_alpha"] / inferential_count
    scenario_reports: list[dict[str, Any]] = []
    all_metrics: list[dict[str, Any]] = []
    metric_index = 0
    for scenario in protocol["scenarios"]:
        left = scenario_results(python_report, scenario["id"])
        right = scenario_results(typescript_report, scenario["id"])
        if scenario["distribution_view"] == "structural-censor-state":
            metrics = structural_metrics(scenario, left, right)
        else:
            metrics = []
            for metric_id in scenario["metrics"]:
                metrics.append(
                    inferential_metric(
                        metric_id,
                        left,
                        right,
                        inference=inference,
                        alpha=alpha,
                        seed=inference["permutation_seed"] + metric_index,
                    )
                )
                metric_index += 1
        all_metrics.extend(metrics)
        scenario_reports.append(
            {
                "id": scenario["id"],
                "source_case_id": scenario["source_case_id"],
                "mode": scenario["mode"],
                "cohort_size": scenario["cohort_size"],
                "n_sims": scenario["n_sims"],
                "distribution_view": scenario["distribution_view"],
                "metrics": metrics,
            }
        )
    return scenario_reports, all_metrics


def _finalize_scenarios(
    scenario_reports: list[dict[str, Any]],
    all_metrics: list[dict[str, Any]],
    familywise_alpha: float,
) -> str:
    holm_adjust(all_metrics, familywise_alpha)
    for scenario in scenario_reports:
        scenario["verdict"] = aggregate_verdict(
            [metric["verdict"] for metric in scenario["metrics"]]
        )
    return aggregate_verdict([scenario["verdict"] for scenario in scenario_reports])


def _distribution_diagnostics(
    scenario_reports: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    return [
        {
            "classification": (
                "distributional_divergence"
                if metric["verdict"] == "divergence"
                else "statistically_inconclusive"
            ),
            "scenario_id": scenario["id"],
            "metric_id": metric["id"],
            "message": metric.get(
                "diagnostic",
                "La région de confiance ne permet pas le verdict attendu.",
            ),
        }
        for scenario in scenario_reports
        for metric in scenario["metrics"]
        if metric["verdict"] != "match"
    ]


def _summary(
    scenario_reports: list[dict[str, Any]], all_metrics: list[dict[str, Any]],
) -> dict[str, int]:
    return {
        "scenario_count": len(scenario_reports),
        "metric_count": len(all_metrics),
        "matches": sum(metric["verdict"] == "match" for metric in all_metrics),
        "divergences": sum(metric["verdict"] == "divergence" for metric in all_metrics),
        "inconclusive": sum(metric["verdict"] == "inconclusive" for metric in all_metrics),
    }


def build_distribution_evidence(
    protocol: dict[str, Any],
    seed_document: dict[str, Any],
    corpus: dict[str, Any],
    python_report: dict[str, Any],
    typescript_report: dict[str, Any],
) -> dict[str, Any]:
    scenario_reports, all_metrics = _build_scenario_reports(
        protocol, python_report, typescript_report,
    )
    global_verdict = _finalize_scenarios(
        scenario_reports, all_metrics, protocol["inference"]["familywise_alpha"],
    )
    report = {
        "evidence_version": "1.0",
        "proof_kind": "distributional_parity",
        "enforcement": "informational",
        "status": global_verdict,
        "error_classification": None,
        "protocol": {"id": protocol["protocol_id"], "version": protocol["version"]},
        "authorities": protocol["authorities"],
        "seed_population": {
            "id": seed_document["population_id"],
            "version": seed_document["version"],
            "fingerprint": seed_document["population_fingerprint"],
            "assignments": protocol["cohort_assignment"],
        },
        "inference": deepcopy(protocol["inference"]),
        "scenarios": scenario_reports,
        "summary": _summary(scenario_reports, all_metrics),
        "diagnostics": _distribution_diagnostics(scenario_reports),
        "stability": {
            "deterministic": True,
            "fingerprint_method": "sha256-canonical-json-without-artifact-fingerprint",
        },
    }
    report["stability"]["artifact_fingerprint"] = _artifact_fingerprint(report)
    return report


def invalid_evidence(classification: str, diagnostics: list[str]) -> dict[str, Any]:
    report = {
        "evidence_version": "1.0",
        "proof_kind": "distributional_parity",
        "enforcement": "informational",
        "status": "invalid",
        "error_classification": classification,
        "protocol": {"id": "mca-statistical-distributional-parity", "version": "1.0"},
        "authorities": {},
        "seed_population": {},
        "inference": {},
        "scenarios": [],
        "summary": {
            "scenario_count": 0,
            "metric_count": 0,
            "matches": 0,
            "divergences": 0,
            "inconclusive": 0,
        },
        "diagnostics": [
            {
                "classification": classification,
                "scenario_id": None,
                "metric_id": None,
                "message": message,
            }
            for message in diagnostics
        ],
        "stability": {
            "deterministic": True,
            "fingerprint_method": "sha256-canonical-json-without-artifact-fingerprint",
        },
    }
    report["stability"]["artifact_fingerprint"] = _artifact_fingerprint(report)
    return report


def verify_artifact_fingerprint(report: dict[str, Any]) -> bool:
    candidate = deepcopy(report)
    observed = candidate.get("stability", {}).pop("artifact_fingerprint", None)
    return isinstance(observed, str) and observed == _artifact_fingerprint(candidate)


def write_evidence(report: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
