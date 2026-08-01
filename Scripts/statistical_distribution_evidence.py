"""Independent structural and semantic validation of distributional evidence."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from Scripts.statistical_distribution_protocol import load_json, schema_issues
from Scripts.statistical_distribution_runner import verify_artifact_fingerprint
from Scripts.statistical_distribution_statistics import aggregate_verdict

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_SCHEMA_PATH = ROOT / "contracts/statistical-distribution-evidence-v1.0.schema.json"


def evidence_semantic_issues(report: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    metrics = [metric for scenario in report["scenarios"] for metric in scenario["metrics"]]
    expected_summary = {
        "scenario_count": len(report["scenarios"]),
        "metric_count": len(metrics),
        "matches": sum(metric["verdict"] == "match" for metric in metrics),
        "divergences": sum(metric["verdict"] == "divergence" for metric in metrics),
        "inconclusive": sum(metric["verdict"] == "inconclusive" for metric in metrics),
    }
    if report["summary"] != expected_summary:
        issues.append("Le résumé de la preuve est incohérent avec les métriques.")
    if report["status"] == "invalid":
        if report["error_classification"] is None or report["scenarios"]:
            issues.append("Une preuve invalide doit porter une classification et aucun scénario.")
    else:
        scenario_verdicts = [scenario["verdict"] for scenario in report["scenarios"]]
        if report["error_classification"] is not None:
            issues.append("Une preuve exécutée ne doit pas porter de classification d'erreur.")
        if report["status"] != aggregate_verdict(scenario_verdicts):
            issues.append("Le verdict global est incohérent avec les scénarios.")
    if not verify_artifact_fingerprint(report):
        issues.append("L'empreinte déterministe de la preuve est incohérente.")
    return issues


def validate_evidence(
    evidence_path: Path, schema_path: Path = EVIDENCE_SCHEMA_PATH,
) -> tuple[dict[str, Any] | None, list[str]]:
    report = load_json(evidence_path)
    schema = load_json(schema_path)
    structural = schema_issues(report, schema, "preuve")
    if structural:
        return None, structural
    semantic = evidence_semantic_issues(report)
    return (report if not semantic else None), semantic
