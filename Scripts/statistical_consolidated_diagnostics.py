"""Normalize specialized diagnostics without changing their proof meaning."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_consolidated_io import SourceRecord

VERDICT_PRIORITY = (
    "infrastructure_error",
    "protocol_error",
    "invalid_evidence",
    "version_incompatibility",
    "engine_error",
    "normative_divergence",
    "interlanguage_divergence",
    "distributional_divergence",
    "statistically_inconclusive",
    "match",
)
PRIORITY_INDEX = {value: index for index, value in enumerate(VERDICT_PRIORITY)}


def _base(
    source: str,
    proof_level: str,
    classification: str,
    code: str,
    message: str,
) -> dict[str, Any]:
    return {
        "source": source,
        "proof_level": proof_level,
        "classification": classification,
        "code": code,
        "message": message,
        "consequence": "contributes_to_consolidated_verdict",
    }


def _difference_diagnostic(
    source: str,
    proof_level: str,
    classification: str,
    case_id: str,
    engine: str,
    difference: dict[str, Any],
) -> dict[str, Any]:
    diagnostic = _base(
        source,
        proof_level,
        classification,
        difference.get("kind", classification),
        "Specialized exact comparison reported a difference.",
    )
    diagnostic.update(
        {
            "case_id": case_id,
            "engine": engine,
            "json_path": difference.get("path", "/"),
        }
    )
    for key in ("expected", "actual"):
        if key in difference:
            diagnostic[key] = difference[key]
    return diagnostic


def _parity_engine_diagnostics(case: dict[str, Any], engine: str) -> list[dict[str, Any]]:
    comparison = case[engine]
    if comparison["status"] == "engine_error":
        diagnostic = _base(
            "deterministic_parity",
            "algorithmic_normative_compliance",
            "engine_error",
            "engine_error",
            "Engine execution failed in deterministic parity evidence.",
        )
        diagnostic.update(
            {
                "case_id": case["id"],
                "engine": engine,
                "json_path": "/",
                "expected": case["expected"],
                "actual": {"error": comparison.get("error")},
            }
        )
        return [diagnostic]
    if comparison["status"] != "normative_divergence":
        return []
    return [
        _difference_diagnostic(
            "deterministic_parity",
            "algorithmic_normative_compliance",
            "normative_divergence",
            case["id"],
            engine,
            difference,
        )
        for difference in comparison.get("differences", [])
    ]


def _probe_diagnostics(validation: dict[str, Any]) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    for case in validation["cases"]:
        if case["status"] == "match":
            continue
        diagnostic = _base(
            "deterministic_parity",
            "contract_and_probe_validation",
            "normative_divergence",
            "validation_probe_divergence",
            "Validation probe differs from the shared contract expectation.",
        )
        diagnostic.update(
            {
                "fixture_id": case["id"],
                "json_path": "/accepted",
                "expected": case["expected_accepted"],
                "actual": {
                    "python": case.get("python_accepted"),
                    "typescript": case.get("typescript_accepted"),
                },
            }
        )
        diagnostics.append(diagnostic)
    for engine, result in validation["engines"].items():
        if result["status"] != "engine_error":
            continue
        diagnostic = _base(
            "deterministic_parity",
            "contract_and_probe_validation",
            "engine_error",
            "validation_engine_error",
            "Validation-probe engine failed.",
        )
        diagnostic.update({"engine": engine, "actual": {"error": result.get("error")}})
        diagnostics.append(diagnostic)
    return diagnostics


def parity_diagnostics(record: SourceRecord) -> list[dict[str, Any]]:
    if record.entry["validation_status"] != "valid" or not isinstance(record.data, dict):
        return []
    diagnostics: list[dict[str, Any]] = []
    for case in record.data["cases"]:
        diagnostics.extend(_parity_engine_diagnostics(case, "python"))
        diagnostics.extend(_parity_engine_diagnostics(case, "typescript"))
        for difference in case["inter_engine"].get("differences", []):
            diagnostics.append(
                _difference_diagnostic(
                    "deterministic_parity",
                    "algorithmic_normative_compliance",
                    "interlanguage_divergence",
                    case["id"],
                    "python_vs_typescript",
                    difference,
                )
            )
    diagnostics.extend(_probe_diagnostics(record.data["validation_alignment"]))
    return diagnostics


def exact_diagnostics(record: SourceRecord) -> list[dict[str, Any]]:
    if record.entry["validation_status"] != "valid" or not isinstance(record.data, dict):
        return []
    diagnostics: list[dict[str, Any]] = []
    for source in record.data["diagnostics"]:
        proof_level = (
            "exact_interlanguage_replay"
            if source["classification"] == "interlanguage_divergence"
            else "batching_independence"
            if source.get("batch_size") is not None
            else "exact_interlanguage_replay"
        )
        diagnostic = _base(
            "exact_replay",
            proof_level,
            source["classification"],
            source["kind"],
            "Exact replay evidence reported a specialized diagnostic.",
        )
        diagnostic.update(
            {
                "case_id": source["case_id"],
                "engine": source["engine"],
                "batch": source["batch_size"],
                "json_path": source["path"],
                "expected": source["expected"],
                "actual": source["actual"],
            }
        )
        diagnostics.append(diagnostic)
    return diagnostics


def _metric_by_id(
    record: SourceRecord, scenario_id: str | None, metric_id: str | None
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    scenario = next((item for item in record.data["scenarios"] if item["id"] == scenario_id), None)
    if scenario is None:
        return None, None
    metric = next((item for item in scenario["metrics"] if item["id"] == metric_id), None)
    return scenario, metric


def distribution_diagnostics(record: SourceRecord) -> list[dict[str, Any]]:
    if record.entry["validation_status"] != "valid" or not isinstance(record.data, dict):
        return []
    diagnostics: list[dict[str, Any]] = []
    for source in record.data["diagnostics"]:
        classification = source["classification"]
        scenario, metric = _metric_by_id(record, source.get("scenario_id"), source.get("metric_id"))
        diagnostic = _base(
            "distribution_evidence",
            "distributional_parity",
            classification,
            "distributional_diagnostic",
            source["message"],
        )
        diagnostic["scenario_id"] = source.get("scenario_id")
        diagnostic["metric"] = source.get("metric_id")
        if scenario is not None:
            diagnostic["cohort"] = {
                "size": scenario["cohort_size"],
                "python": "cohort-a",
                "typescript": "cohort-b",
            }
        if metric is not None:
            diagnostic.update(
                {
                    "actual": metric["observed"],
                    "threshold": metric["equivalence_margin"],
                    "margin": metric["equivalence_margin"],
                }
            )
            if "confidence_interval" in metric:
                diagnostic["interval"] = metric["confidence_interval"]
        diagnostics.append(diagnostic)
    return diagnostics


def diagnostic_sort_key(diagnostic: dict[str, Any]) -> tuple[Any, ...]:
    return (
        PRIORITY_INDEX[diagnostic["classification"]],
        diagnostic.get("source", ""),
        diagnostic.get("proof_level", ""),
        diagnostic.get("case_id", ""),
        diagnostic.get("scenario_id") or "",
        diagnostic.get("fixture_id", ""),
        diagnostic.get("metric") or "",
        diagnostic.get("engine", ""),
        -1 if diagnostic.get("batch") is None else diagnostic["batch"],
        diagnostic.get("json_path", ""),
        diagnostic.get("code", ""),
    )


def consolidated_verdict(classifications: list[str]) -> str:
    observed = set(classifications)
    return next(value for value in VERDICT_PRIORITY if value in observed)
