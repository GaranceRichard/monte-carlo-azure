"""Build case, probe and scenario scope projections from specialized evidence."""

from __future__ import annotations

from typing import Any

from Scripts.statistical_consolidated_io import SourceRecord


def _case_status(outcomes: list[str], interlanguage_name: str) -> str:
    mapping = (
        ("engine_error", "engine_error"),
        ("normative_divergence", "normative_divergence"),
        (interlanguage_name, "interlanguage_divergence"),
        ("match", "match"),
    )
    return next(result for source, result in mapping if source in outcomes)


def case_summaries(records: dict[str, SourceRecord]) -> list[dict[str, Any]]:
    corpus = records["reference_corpus"]
    if corpus.entry["validation_status"] != "valid":
        return []
    parity = records["deterministic_parity"]
    exact = records["exact_replay"]
    parity_cases = (
        {case["id"]: case for case in parity.data.get("cases", [])}
        if parity.entry["validation_status"] == "valid"
        else {}
    )
    exact_cases = (
        {case["id"]: case for case in exact.data.get("cases", [])}
        if exact.entry["validation_status"] == "valid"
        else {}
    )
    summaries = []
    for case in corpus.data["cases"]:
        parity_case = parity_cases.get(case["id"])
        exact_case = exact_cases.get(case["id"])
        summaries.append(
            {
                "id": case["id"],
                "normative_family": case["proof_level"],
                "algorithmic_status": _case_status(parity_case["outcomes"], "engine_divergence")
                if parity_case
                else "not_evaluated",
                "exact_replay_status": _case_status(
                    exact_case["outcomes"], "interlanguage_divergence"
                )
                if exact_case
                else "not_evaluated",
                "batch_independent": exact_case["batch_independent"] if exact_case else None,
            }
        )
    return summaries


def probe_summaries(records: dict[str, SourceRecord]) -> list[dict[str, Any]]:
    probes = records["validation_probes"]
    parity = records["deterministic_parity"]
    if probes.entry["validation_status"] != "valid":
        return []
    observed = (
        {case["id"]: case for case in parity.data.get("validation_alignment", {}).get("cases", [])}
        if parity.entry["validation_status"] == "valid"
        else {}
    )
    return [
        {
            "id": probe["id"],
            "expected_accepted": probe["accepted"],
            "status": observed.get(probe["id"], {}).get("status", "not_evaluated"),
        }
        for probe in probes.data["cases"]
    ]


def scenario_summaries(records: dict[str, SourceRecord]) -> list[dict[str, Any]]:
    record = records["distribution_evidence"]
    if record.entry["validation_status"] != "valid" or record.data["status"] == "invalid":
        return []
    status_map = {
        "match": "match",
        "divergence": "distributional_divergence",
        "inconclusive": "statistically_inconclusive",
    }
    return [
        {
            "id": scenario["id"],
            "source_case_id": scenario["source_case_id"],
            "mode": scenario["mode"],
            "cohort_size": scenario["cohort_size"],
            "n_sims": scenario["n_sims"],
            "distribution_view": scenario["distribution_view"],
            "status": status_map[scenario["verdict"]],
            "metric_count": len(scenario["metrics"]),
            "matching_metrics": sum(metric["verdict"] == "match" for metric in scenario["metrics"]),
            "divergent_metrics": sum(
                metric["verdict"] == "divergence" for metric in scenario["metrics"]
            ),
            "inconclusive_metrics": sum(
                metric["verdict"] == "inconclusive" for metric in scenario["metrics"]
            ),
        }
        for scenario in record.data["scenarios"]
    ]
