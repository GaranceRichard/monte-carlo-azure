from __future__ import annotations

import json
import runpy
import sys
from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable

import pytest
from jsonschema.exceptions import SchemaError

from Scripts import statistical_reference_corpus_validation as corpus_scopes
from Scripts import validate_statistical_reference_corpus as corpus_validation
from Scripts.statistical_reference_corpus_histogram import normative_histogram
from Scripts.statistical_reference_corpus_normative import (
    expected_reliability,
    reliability_statistics,
)
from Scripts.statistical_reference_corpus_pbi_215 import PBI_215_CASE_IDS


def _contract() -> tuple[dict[str, object], dict[str, object]]:
    schema = corpus_validation.load_json(corpus_validation.SCHEMA_PATH)
    instance = corpus_validation.load_json(corpus_validation.VALID_EXAMPLE_PATH)
    assert isinstance(schema, dict)
    assert isinstance(instance, dict)
    return schema, instance


def _reference_corpus() -> tuple[dict[str, Any], dict[str, Any]]:
    schema = corpus_validation.load_json(corpus_validation.SCHEMA_PATH)
    corpus = corpus_validation.load_json(corpus_validation.CORPUS_PATH)
    assert isinstance(schema, dict)
    assert isinstance(corpus, dict)
    return schema, corpus


def _issues_for(
    update: Callable[[dict[str, Any]], None],
) -> list[corpus_validation.ValidationIssue]:
    schema, instance = _contract()
    invalid = deepcopy(instance)
    update(invalid)
    return corpus_validation.validate_instance(invalid, schema)


def test_bundled_control_accepts_minimal_contract_and_rejects_negative_example(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert corpus_validation.main([]) == 0
    output = capsys.readouterr()
    assert "corpus 1.0 and its schema are valid" in output.out
    assert (
        "PBI 2.10, PBI 2.11, PBI 2.14, PBI 2.15 and PBI 2.16 scopes are complete"
        in output.out
    )
    assert "input rejection probes pass" in output.out
    assert output.err == ""

    schema, instance = _contract()
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["x-schemaVersion"] == instance["schema_version"] == "1.0"
    assert instance["prng_contract"]["id"] == "mca-prng-v1"
    assert len(instance["cases"]) == 1


def test_script_entrypoint_runs_the_autonomous_control(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(sys, "argv", [str(corpus_validation.SCHEMA_PATH)])
    with pytest.raises(SystemExit) as stopped:
        runpy.run_path(
            str(corpus_validation.ROOT / "Scripts/validate_statistical_reference_corpus.py"),
            run_name="__main__",
        )
    assert stopped.value.code == 0
    assert "positive example is accepted" in capsys.readouterr().out


def test_pbi_210_reference_cases_are_exact_readable_and_scope_complete() -> None:
    schema, corpus = _reference_corpus()
    assert corpus_validation.validate_contract(corpus, schema) == []
    assert corpus_scopes.validate_pbi_210_scope(corpus) == []
    assert corpus_validation.validate_input_rejection_probes(corpus, schema) == []
    assert corpus["schema_version"] == "1.0"
    assert corpus["prng_contract"] == {
        "id": "mca-prng-v1",
        "vectors": "contracts/mca-prng-v1-vectors.json",
    }

    cases = {case["id"]: case for case in corpus["cases"]}
    assert set(cases) == (
        corpus_validation.PBI_210_CASE_IDS | corpus_validation.PBI_211_CASE_IDS | PBI_215_CASE_IDS
    )
    assert len(cases) == len(corpus["cases"]) == 16
    assert all(case["description"] for case in cases.values())

    items = cases["items-zero-weeks-excluded"]
    assert items["proof_level"] == "replay"
    assert items["input"] == {
        "throughput_samples": [0, 1, 2, 3, 4, 5, 6],
        "include_zero_weeks": False,
        "mode": "weeks_to_items",
        "target_weeks": 1,
        "n_sims": 1000,
    }
    assert "backlog_size" not in items["input"]
    assert items["expected_result"]["samples_count"] == 6
    assert items["expected_result"]["result_percentiles"] == {
        "P50": 3,
        "P70": 2,
        "P90": 1,
    }
    assert items["expected_result"]["result_distribution"] == [
        {"x": 1, "count": 157},
        {"x": 2, "count": 168},
        {"x": 3, "count": 186},
        {"x": 4, "count": 164},
        {"x": 5, "count": 160},
        {"x": 6, "count": 165},
    ]
    assert "completion_summary" not in items["expected_result"]

    no_censor = cases["weeks-zero-weeks-included-no-censorship"]
    assert no_censor["input"]["include_zero_weeks"] is True
    assert no_censor["input"]["throughput_samples"] == [0, 1, 2, 3, 4, 5]
    assert "target_weeks" not in no_censor["input"]
    assert no_censor["expected_result"]["result_percentiles"] == {
        "P50": 2,
        "P70": 3,
        "P90": 4,
    }
    assert no_censor["expected_result"]["completion_summary"] == {
        "completed_count": 1000,
        "censored_count": 0,
        "censored_rate": 0,
        "horizon_weeks": 521,
    }

    exact_horizon = cases["weeks-exact-horizon-completion"]
    assert exact_horizon["proof_level"] == "deterministic"
    assert exact_horizon["seed"] == 4294967295
    assert exact_horizon["input"]["backlog_size"] == 521
    assert exact_horizon["expected_result"]["result_distribution"] == [{"x": 521, "count": 1000}]
    assert exact_horizon["expected_result"]["completion_summary"]["censored_count"] == 0

    partial = cases["weeks-partial-censorship"]
    assert partial["expected_result"]["completion_summary"] == {
        "completed_count": 748,
        "censored_count": 252,
        "censored_rate": 0.252,
        "horizon_weeks": 521,
    }
    assert partial["expected_result"]["result_percentiles"] == {
        "P50": 518,
        "P70": 521,
    }
    assert "P90" not in partial["expected_result"]["result_percentiles"]
    assert (
        sum(bucket["count"] for bucket in partial["expected_result"]["result_distribution"]) == 748
    )

    total = cases["weeks-total-censorship"]
    assert total["proof_level"] == "deterministic"
    assert total["input"]["backlog_size"] == 522
    assert total["expected_result"]["result_percentiles"] == {}
    assert total["expected_result"]["result_distribution"] == []
    assert total["expected_result"]["completion_summary"] == {
        "completed_count": 0,
        "censored_count": 1000,
        "censored_rate": 1,
        "horizon_weeks": 521,
    }


def test_pbi_211_reference_cases_protect_scores_thresholds_and_histograms() -> None:
    schema, corpus = _reference_corpus()
    assert corpus_validation.validate_contract(corpus, schema) == []
    assert corpus_scopes.validate_pbi_211_scope(corpus) == []
    cases = {case["id"]: case for case in corpus["cases"]}
    assert len(corpus_validation.PBI_211_CASE_IDS) == 10
    assert corpus_validation.PBI_210_CASE_IDS.isdisjoint(corpus_validation.PBI_211_CASE_IDS)

    risk_present = cases["items-zero-weeks-excluded"]["expected_result"]
    assert risk_present["risk_score"] == 0.6667
    assert sum(bucket["count"] for bucket in risk_present["result_distribution"]) == 1000

    censored_risk = cases["weeks-partial-censorship"]["expected_result"]
    assert "P90" not in censored_risk["result_percentiles"]
    assert "risk_score" not in censored_risk

    zero_risk = cases["risk-p50-zero-absent"]
    assert zero_risk["proof_level"] == "deterministic"
    assert zero_risk["expected_result"]["result_percentiles"] == {
        "P50": 0,
        "P70": 0,
        "P90": 0,
    }
    assert "risk_score" not in zero_risk["expected_result"]
    assert zero_risk["expected_result"]["throughput_reliability"]["label"] == "non fiable"

    reliability_expectations = {
        "reliability-slope-005-rounded": (0.1291, 0.2, 0.05, "incertain"),
        "reliability-slope-010-rounded": (0.2582, 0.4, 0.1, "fragile"),
        "reliability-slope-minus-015-rounded": (0.3873, 0.6, -0.15, "non fiable"),
        "reliability-cv-050-rounded": (0.5, 0, 0, "incertain"),
        "reliability-cv-100-rounded": (1, 0, 0, "fragile"),
        "reliability-cv-150-rounded": (1.5, 0, 0, "non fiable"),
        "reliability-iqr-050-rounded": (0.2041, 0.5, 0.0083, "incertain"),
        "histogram-aggregated-contiguous-101": (0.5831, 1, 0.02, "fragile"),
    }
    for case_id, (cv, iqr, slope, label) in reliability_expectations.items():
        reliability = cases[case_id]["expected_result"]["throughput_reliability"]
        assert (
            reliability["cv"],
            reliability["iqr_ratio"],
            reliability["slope_norm"],
            reliability["label"],
        ) == (cv, iqr, slope, label)

    exact = risk_present["result_distribution"]
    assert exact == [
        {"x": 1, "count": 157},
        {"x": 2, "count": 168},
        {"x": 3, "count": 186},
        {"x": 4, "count": 164},
        {"x": 5, "count": 160},
        {"x": 6, "count": 165},
    ]

    contiguous = cases["histogram-aggregated-contiguous-101"]["expected_result"][
        "result_distribution"
    ]
    assert [bucket["x"] for bucket in contiguous] == list(range(0, 101, 2))
    assert [bucket["count"] for bucket in contiguous] == [
        19,
        20,
        14,
        17,
        26,
        14,
        18,
        19,
        23,
        22,
        18,
        24,
        20,
        15,
        19,
        19,
        22,
        23,
        19,
        17,
        22,
        21,
        21,
        24,
        29,
        14,
        27,
        22,
        19,
        21,
        16,
        17,
        25,
        17,
        13,
        19,
        19,
        16,
        13,
        32,
        15,
        23,
        17,
        24,
        26,
        17,
        18,
        24,
        20,
        15,
        6,
    ]
    assert len(contiguous) == 51
    assert sum(bucket["count"] for bucket in contiguous) == 1000

    discontinuous = cases["histogram-aggregated-discontinuous"]["expected_result"][
        "result_distribution"
    ]
    assert discontinuous == [{"x": 50, "count": 994}, {"x": 9999, "count": 6}]
    assert sum(bucket["count"] for bucket in discontinuous) == 1000


def test_independent_histogram_derivation_covers_exact_continuous_and_asymmetric_ranges() -> None:
    assert normative_histogram([]) == []
    assert normative_histogram([4, 1, 4, 2, 1, 4]) == [
        {"x": 1, "count": 2},
        {"x": 2, "count": 1},
        {"x": 4, "count": 3},
    ]
    assert normative_histogram(list(range(101))) == [
        {"x": representative, "count": 1 if representative == 100 else 2}
        for representative in range(0, 101, 2)
    ]
    assert normative_histogram([*range(100), 10_000]) == [
        {"x": 50, "count": 100},
        {"x": 9_999, "count": 1},
    ]
    assert normative_histogram([*range(100), 1_000_000]) == [
        {"x": 5_000, "count": 100},
        {"x": 995_049, "count": 1},
    ]


def test_pbi_214_reference_cases_protect_censorship_percentiles_and_risk_score() -> None:
    schema, corpus = _reference_corpus()
    assert corpus_validation.validate_contract(corpus, schema) == []
    assert corpus_scopes.validate_pbi_214_scope(corpus) == []
    assert corpus_validation.PBI_214_CASE_IDS == {
        "items-zero-weeks-excluded",
        "weeks-zero-weeks-included-no-censorship",
        "weeks-exact-horizon-completion",
        "weeks-partial-censorship",
        "weeks-total-censorship",
        "risk-p50-zero-absent",
    }

    cases = {case["id"]: case for case in corpus["cases"]}
    assert cases["weeks-partial-censorship"]["expected_result"]["result_percentiles"] == {
        "P50": 518,
        "P70": 521,
    }
    assert "risk_score" not in cases["weeks-partial-censorship"]["expected_result"]
    assert cases["items-zero-weeks-excluded"]["expected_result"]["risk_score"] == 0.6667
    assert "risk_score" not in cases["risk-p50-zero-absent"]["expected_result"]


def test_pbi_215_reference_cases_protect_reliability_metrics_and_labels() -> None:
    schema, corpus = _reference_corpus()
    assert corpus_validation.validate_contract(corpus, schema) == []
    assert corpus_scopes.validate_pbi_215_scope(corpus) == []

    cases = {case["id"]: case for case in corpus["cases"]}
    six_observations = cases["weeks-exact-horizon-completion"]["expected_result"][
        "throughput_reliability"
    ]
    seven_observations = cases["reliability-seven-observations-degraded"]
    assert six_observations == {
        "cv": 0,
        "iqr_ratio": 0,
        "slope_norm": 0,
        "label": "incertain",
        "samples_count": 6,
    }
    assert seven_observations["input"]["throughput_samples"] == [
        9,
        9,
        10,
        10,
        10,
        11,
        11,
    ]
    assert seven_observations["expected_result"]["throughput_reliability"] == {
        "cv": 0.0756,
        "iqr_ratio": 0.1,
        "slope_norm": 0.0357,
        "label": "incertain",
        "samples_count": 7,
    }
    assert seven_observations["expected_result"]["result_distribution"] == [
        {"x": 9, "count": 275},
        {"x": 10, "count": 441},
        {"x": 11, "count": 284},
    ]
    labels = {
        cases[case_id]["expected_result"]["throughput_reliability"]["label"]
        for case_id in PBI_215_CASE_IDS
    }
    assert labels == {"fiable", "incertain", "fragile", "non fiable"}


def test_independent_reliability_derivation_proves_six_and_seven_observations() -> None:
    six = reliability_statistics([1, 2, 3, 4, 5, 6])
    assert six.mean == Decimal("3.5")
    assert six.population_variance.quantize(Decimal("0.0000001")) == Decimal("2.9166667")
    assert (six.q25, six.median, six.q75) == (
        Decimal("2.25"),
        Decimal("3.5"),
        Decimal("4.75"),
    )
    assert six.slope == Decimal(1)
    assert expected_reliability([1, 2, 3, 4, 5, 6]) == {
        "cv": Decimal("0.4880"),
        "iqr_ratio": Decimal("0.7143"),
        "slope_norm": Decimal("0.2857"),
        "label": "fragile",
        "samples_count": 6,
    }

    seven = reliability_statistics([9, 9, 10, 10, 10, 11, 11])
    assert seven.mean == Decimal(10)
    assert seven.population_variance.quantize(Decimal("0.0000001")) == Decimal("0.5714286")
    assert (seven.q25, seven.median, seven.q75) == (
        Decimal("9.5"),
        Decimal(10),
        Decimal("10.5"),
    )
    assert seven.slope.quantize(Decimal("0.0000001")) == Decimal("0.3571429")
    assert expected_reliability([9, 9, 10, 10, 10, 11, 11]) == {
        "cv": Decimal("0.0756"),
        "iqr_ratio": Decimal("0.1000"),
        "slope_norm": Decimal("0.0357"),
        "label": "incertain",
        "samples_count": 7,
    }


def test_input_contract_probes_cover_invalid_bounds_types_zeros_and_modes() -> None:
    schema, corpus = _reference_corpus()
    probes = corpus_validation.INPUT_REJECTION_PROBES
    probe_ids = {probe.probe_id for probe in probes}
    assert len(probe_ids) == len(probes) == 24
    assert {
        "throughput-below-minimum-length",
        "throughput-above-maximum-length",
        "throughput-string-item",
        "throughput-decimal-item",
        "throughput-negative-item",
        "too-few-usable-samples-after-zero-exclusion",
        "include-zero-weeks-wrong-type",
        "mode-outside-contract",
        "simulation-count-below-minimum",
        "simulation-count-above-maximum",
        "simulation-count-wrong-type",
        "target-weeks-below-minimum",
        "target-weeks-above-maximum",
        "target-weeks-wrong-type",
        "target-weeks-missing",
        "inactive-backlog-present",
        "backlog-below-minimum",
        "backlog-above-maximum",
        "backlog-wrong-type",
        "backlog-missing",
        "inactive-target-present",
        "seed-below-minimum",
        "seed-above-maximum",
        "seed-wrong-type",
    } == probe_ids
    assert corpus_validation.validate_input_rejection_probes(corpus, schema) == []

    extrema = deepcopy(corpus)
    extrema_case = extrema["cases"][0]
    extrema_case["input"] = {
        "throughput_samples": [0] * 521,
        "include_zero_weeks": True,
        "mode": "weeks_to_items",
        "target_weeks": 521,
        "n_sims": 200000,
    }
    extrema_case["seed"] = 4294967295
    extrema_case["expected_result"]["seed"] = 4294967295
    extrema["cases"] = [extrema_case]
    assert corpus_validation.validate_instance(extrema, schema) == []

    backlog_maximum = deepcopy(corpus)
    backlog_case = backlog_maximum["cases"][1]
    backlog_case["input"]["backlog_size"] = 1000000
    backlog_case["input"]["n_sims"] = 200000
    backlog_maximum["cases"] = [backlog_case]
    assert corpus_validation.validate_instance(backlog_maximum, schema) == []


@pytest.mark.parametrize(
    ("update", "path", "keyword"),
    [
        (
            lambda case: case["expected_result"].__setitem__("seed", 7),
            "/cases/0/expected_result/seed",
            "caseSeedEquality",
        ),
        (
            lambda case: case["expected_result"].__setitem__("samples_count", 7),
            "/cases/0/expected_result/samples_count",
            "usableSamplesCount",
        ),
        (
            lambda case: case["expected_result"]["throughput_reliability"].__setitem__(
                "samples_count", 7
            ),
            "/cases/0/expected_result/throughput_reliability/samples_count",
            "resultSamplesCountEquality",
        ),
        (
            lambda case: case["expected_result"].__setitem__(
                "result_percentiles", {"P50": 1, "P70": 2, "P90": 3}
            ),
            "/cases/0/expected_result/result_percentiles",
            "percentileOrder",
        ),
        (
            lambda case: case["expected_result"].__setitem__(
                "result_distribution",
                [{"x": 2, "count": 500}, {"x": 1, "count": 500}],
            ),
            "/cases/0/expected_result/result_distribution",
            "histogramOrder",
        ),
        (
            lambda case: case["expected_result"].__setitem__(
                "result_distribution", [{"x": 1, "count": 999}]
            ),
            "/cases/0/expected_result/result_distribution",
            "histogramMass",
        ),
        (
            lambda case: case["expected_result"]["completion_summary"].__setitem__(
                "completed_count", 999
            ),
            "/cases/0/expected_result/completion_summary",
            "completionMass",
        ),
        (
            lambda case: case["expected_result"]["completion_summary"].__setitem__(
                "censored_rate", 0.0001
            ),
            "/cases/0/expected_result/completion_summary/censored_rate",
            "censoredRate",
        ),
    ],
)
def test_cross_field_invariants_reject_structural_result_regressions(
    update: Callable[[dict[str, Any]], None],
    path: str,
    keyword: str,
) -> None:
    schema, corpus = _reference_corpus()
    candidate = deepcopy(corpus)
    case = (
        candidate["cases"][1]
        if keyword in {"completionMass", "censoredRate"}
        else candidate["cases"][0]
    )
    candidate["cases"] = [case]
    update(case)
    issues = corpus_validation.validate_contract(candidate, schema)
    assert any(issue.instance_path == path and issue.keyword == keyword for issue in issues)


@pytest.mark.parametrize(
    ("case_id", "update", "path", "keyword"),
    [
        (
            "items-zero-weeks-excluded",
            lambda result: result.__setitem__("risk_score", 0.6666),
            "/cases/0/expected_result/risk_score",
            "riskScoreFormula",
        ),
        (
            "items-zero-weeks-excluded",
            lambda result: result.pop("risk_score"),
            "/cases/0/expected_result/risk_score",
            "riskScorePresence",
        ),
        (
            "risk-p50-zero-absent",
            lambda result: result.__setitem__("risk_score", 0),
            "/cases/0/expected_result/risk_score",
            "riskScorePresence",
        ),
        (
            "reliability-slope-005-rounded",
            lambda result: result["throughput_reliability"].__setitem__("slope_norm", 0.0499),
            "/cases/0/expected_result/throughput_reliability/slope_norm",
            "reliabilityMetric",
        ),
        (
            "reliability-slope-010-rounded",
            lambda result: result["throughput_reliability"].__setitem__("label", "incertain"),
            "/cases/0/expected_result/throughput_reliability/label",
            "reliabilityLabel",
        ),
        (
            "histogram-aggregated-contiguous-101",
            lambda result: result["result_distribution"][0].__setitem__("x", 1),
            "/cases/0/expected_result/result_distribution",
            "histogramRepresentative",
        ),
        (
            "histogram-aggregated-discontinuous",
            lambda result: (
                result["result_distribution"][0].__setitem__("count", 993),
                result["result_distribution"][1].__setitem__("count", 7),
            ),
            "/cases/0/expected_result/result_distribution",
            "histogramCount",
        ),
    ],
)
def test_normative_result_invariants_reject_score_reliability_and_bucket_drift(
    case_id: str,
    update: Callable[[dict[str, Any]], None],
    path: str,
    keyword: str,
) -> None:
    schema, corpus = _reference_corpus()
    case = deepcopy(next(case for case in corpus["cases"] if case["id"] == case_id))
    update(case["expected_result"])
    candidate = deepcopy(corpus)
    candidate["cases"] = [case]
    issues = corpus_validation.validate_contract(candidate, schema)
    assert any(issue.instance_path == path and issue.keyword == keyword for issue in issues)


def test_scope_and_probe_controls_report_actionable_regressions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    schema, corpus = _reference_corpus()
    assert corpus_scopes.validate_pbi_210_scope([])[0].instance_path == "/"
    assert corpus_scopes.validate_pbi_211_scope([])[0].instance_path == "/"
    assert corpus_scopes.validate_pbi_214_scope([])[0].instance_path == "/"
    assert corpus_scopes.validate_pbi_215_scope([])[0].instance_path == "/"

    missing = deepcopy(corpus)
    missing["cases"] = missing["cases"][1:]
    missing_issues = corpus_scopes.validate_pbi_210_scope(missing)
    assert "items-zero-weeks-excluded" in missing_issues[0].message
    assert (
        "items-zero-weeks-excluded" in corpus_scopes.validate_pbi_214_scope(missing)[0].message
    )
    assert (
        "items-zero-weeks-excluded" in corpus_scopes.validate_pbi_215_scope(missing)[0].message
    )

    malformed_pbi_214 = deepcopy(corpus)
    zero_case = next(
        case for case in malformed_pbi_214["cases"] if case["id"] == "risk-p50-zero-absent"
    )
    zero_case["expected_result"] = None
    assert len(corpus_scopes.validate_pbi_214_scope(malformed_pbi_214)) == 2

    malformed_pbi_215 = deepcopy(corpus)
    seven_case = next(
        case
        for case in malformed_pbi_215["cases"]
        if case["id"] == "reliability-seven-observations-degraded"
    )
    seven_case["expected_result"]["throughput_reliability"]["cv"] = 0.0816
    seven_case["expected_result"]["result_distribution"][0]["count"] = 274
    assert len(corpus_scopes.validate_pbi_215_scope(malformed_pbi_215)) == 2

    malformed_seven_observations = deepcopy(corpus)
    seven_observations = next(
        case
        for case in malformed_seven_observations["cases"]
        if case["id"] == "reliability-seven-observations-degraded"
    )
    seven_observations["expected_result"] = None
    messages = [
        issue.message
        for issue in corpus_scopes.validate_pbi_215_scope(malformed_seven_observations)
    ]
    assert messages == [
        (
            "reliability-seven-observations-degraded must preserve its exact normative "
            "reliability metrics and label"
        ),
        "the seven-observation case must preserve its independently derived replay",
    ]

    malformed_labels = deepcopy(corpus)
    reliable_case = next(
        case
        for case in malformed_labels["cases"]
        if case["id"] == "weeks-partial-censorship"
    )
    reliable_case["expected_result"]["throughput_reliability"]["label"] = "incertain"
    messages = [
        issue.message for issue in corpus_scopes.validate_pbi_215_scope(malformed_labels)
    ]
    assert messages == [
        (
            "weeks-partial-censorship must preserve its exact normative reliability "
            "metrics and label"
        ),
        "the PBI 2.15 proof must retain all four normative labels",
    ]

    regressions = [
        ("items-zero-weeks-excluded", ("expected_result", "samples_count"), 7),
        (
            "weeks-zero-weeks-included-no-censorship",
            ("expected_result", "result_percentiles"),
            {},
        ),
        (
            "weeks-exact-horizon-completion",
            ("expected_result", "result_distribution"),
            [],
        ),
        (
            "weeks-partial-censorship",
            ("expected_result", "result_percentiles"),
            {},
        ),
        (
            "weeks-total-censorship",
            ("expected_result", "result_percentiles"),
            {"P50": 521},
        ),
    ]
    for case_id, path, value in regressions:
        candidate = deepcopy(corpus)
        case = next(case for case in candidate["cases"] if case["id"] == case_id)
        case[path[0]][path[1]] = value
        assert any(
            issue.keyword == "pbi210Scope"
            for issue in corpus_scopes.validate_pbi_210_scope(candidate)
        )

    missing_211 = deepcopy(corpus)
    missing_211["cases"] = [
        case for case in missing_211["cases"] if case["id"] != "risk-p50-zero-absent"
    ]
    assert (
        "risk-p50-zero-absent" in corpus_scopes.validate_pbi_211_scope(missing_211)[0].message
    )

    reconstructed_percentile = deepcopy(corpus)
    partial_case = next(
        case
        for case in reconstructed_percentile["cases"]
        if case["id"] == "weeks-partial-censorship"
    )
    partial_case["expected_result"]["result_percentiles"]["P90"] = 521
    partial_case["expected_result"]["risk_score"] = 0.0058
    assert any(
        issue.keyword == "pbi214Scope"
        for issue in corpus_scopes.validate_pbi_214_scope(reconstructed_percentile)
    )

    pbi_211_regressions = [
        (
            "reliability-cv-050-rounded",
            ("expected_result", "result_percentiles"),
            {},
        ),
        (
            "histogram-aggregated-contiguous-101",
            ("expected_result", "result_distribution"),
            [],
        ),
        (
            "histogram-aggregated-discontinuous",
            ("input", "throughput_samples"),
            list(range(101)),
        ),
    ]
    for case_id, path, value in pbi_211_regressions:
        candidate = deepcopy(corpus)
        case = next(case for case in candidate["cases"] if case["id"] == case_id)
        case[path[0]][path[1]] = value
        assert any(
            issue.keyword == "pbi211Scope"
            for issue in corpus_scopes.validate_pbi_211_scope(candidate)
        )

    exact_regression = deepcopy(corpus)
    exact_case = next(
        case for case in exact_regression["cases"] if case["id"] == "items-zero-weeks-excluded"
    )
    exact_case["expected_result"]["risk_score"] = 0.6666
    assert any(
        issue.keyword == "pbi211Scope"
        for issue in corpus_scopes.validate_pbi_211_scope(exact_regression)
    )

    absent_regression = deepcopy(corpus)
    absent_case = next(
        case for case in absent_regression["cases"] if case["id"] == "weeks-partial-censorship"
    )
    absent_case["expected_result"]["risk_score"] = 0
    assert any(
        issue.keyword == "pbi211Scope"
        for issue in corpus_scopes.validate_pbi_211_scope(absent_regression)
    )

    bad_probe = corpus_validation.InputRejectionProbe(
        "diagnostic-regression",
        "items-zero-weeks-excluded",
        "replace",
        ("seed",),
        -1,
        "/seed",
        "maximum",
    )
    monkeypatch.setattr(corpus_validation, "INPUT_REJECTION_PROBES", (bad_probe,))
    errors = corpus_validation.validate_input_rejection_probes(corpus, schema)
    assert len(errors) == 1
    assert "diagnostic-regression" in errors[0]
    assert "expected [maximum] at /cases/0/seed" in errors[0]

    assert corpus_validation._validate_case_semantics({}, 0) == []
    guarded_case = {
        "input": {
            "throughput_samples": "invalid",
            "include_zero_weeks": False,
            "mode": "invalid",
            "n_sims": "invalid",
        },
        "expected_result": {
            "result_percentiles": [],
            "result_distribution": {},
            "throughput_reliability": [],
        },
    }
    assert corpus_validation._validate_case_semantics(guarded_case, 0) == []

    invalid_reliability_shape = deepcopy(corpus["cases"][0])
    invalid_reliability_shape["expected_result"]["throughput_reliability"] = []
    assert not any(
        issue.keyword in {"reliabilityMetric", "reliabilityLabel"}
        for issue in corpus_validation._validate_case_semantics(
            invalid_reliability_shape,
            0,
        )
    )

    invalid_zero_policy = deepcopy(corpus["cases"][0])
    invalid_zero_policy["input"]["include_zero_weeks"] = "false"
    assert not any(
        issue.keyword in {"histogramRepresentative", "histogramCount"}
        for issue in corpus_validation._validate_case_semantics(invalid_zero_policy, 0)
    )

    invalid_result_shape = deepcopy(corpus)
    pbi_211_case = next(
        case for case in invalid_result_shape["cases"] if case["id"] == "risk-p50-zero-absent"
    )
    pbi_211_case["expected_result"] = []
    assert any(
        issue.keyword == "pbi211Scope"
        for issue in corpus_scopes.validate_pbi_211_scope(invalid_result_shape)
    )

    invalid_completion_types = deepcopy(corpus["cases"][1])
    invalid_completion_types["expected_result"]["completion_summary"]["completed_count"] = "1000"
    assert not any(
        issue.keyword in {"completionMass", "censoredRate"}
        for issue in corpus_validation._validate_case_semantics(invalid_completion_types, 0)
    )

    backlog_without_completion = deepcopy(corpus["cases"][1])
    del backlog_without_completion["expected_result"]["completion_summary"]
    assert corpus_validation._validate_case_semantics(backlog_without_completion, 0) == []


def test_documentation_traces_pbi_210_and_pbi_211_derivations_and_reserved_scope() -> None:
    root = corpus_validation.ROOT
    corpus_doc = (root / "docs/statistical-reference-corpus.md").read_text(encoding="utf-8")
    for case_id in corpus_validation.PBI_210_CASE_IDS:
        assert f"`{case_id}`" in corpus_doc
    for case_id in corpus_validation.PBI_211_CASE_IDS:
        assert f"`{case_id}`" in corpus_doc
    for case_id in PBI_215_CASE_IDS:
        assert f"`{case_id}`" in corpus_doc
    assert "sans appeler\nle moteur Python ni le moteur TypeScript" in corpus_doc
    assert "floor(0,5 × 999) = 499" in corpus_doc
    assert "Le rang 500 se trouve en semaine 518" in corpus_doc
    assert "24 mutations négatives minimales" in corpus_doc
    assert "`slope_norm = 0.0500`" in corpus_doc
    assert "la référence normative choisit explicitement `50/9999`" in corpus_doc
    assert "aucun moteur" in corpus_doc
    assert "Scripts/run_statistical_reference_corpus.py" in corpus_doc

    documentation_expectations = {
        "README.md": [
            "docs/standards/STD-STAT-001.md",
            "docs/statistical-reference-corpus.md",
            "les seize cas du corpus statistique courant concordent exactement",
            "parité reste toutefois informatif",
        ],
        "ARCHITECTURE.md": [
            "statistical-reference-corpus-v1.0.json",
            "24 probes négatives",
            "la complétude des familles de preuve",
            "`backend/histogram.py`",
            "ne sont plus des références conformes",
        ],
        "CHANGELOG.md": [
            "Construction normative des histogrammes — PBI 2.16",
            "Risk Score, fiabilité et histogrammes de référence — PBI 2.11",
            "aucun runner du PBI 2.12",
            "Cas d’entrées, modes, censures et percentiles — PBI 2.10",
        ],
        "docs/backlog-expectations/feature-02-statistical-core.md": [
            "Implémentation retenue",
            "P50 = 518 et P70 = 521",
            "les représentants `50` et `9999`",
            "aucun runner Python ou TypeScript du PBI 2.12",
            "`backend/histogram.py` et `frontend/src/domain/histogram.ts`",
        ],
        "docs/statistical-parity-audit.md": [
            "Suivi du PBI 2.16",
            "explicitement invalidées comme références",
            "16 cas conformes",
        ],
        "docs/standards/STD-STAT-001.md": [
            "Cette frontière est instanciée",
            "Le corpus contient aussi dix cas discriminants",
            "Le runner partagé exécute les références",
            "Le validateur",
        ],
        "docs/risk-control-matrix.md": [
            "Les 80 comparaisons normatives et 64 comparaisons interlangages concordent exactement",
            "refus du corpus avant toute exécution moteur",
        ],
    }
    for relative_path, expected_fragments in documentation_expectations.items():
        content = (root / relative_path).read_text(encoding="utf-8")
        assert all(fragment in content for fragment in expected_fragments)

    for relative_path in [
        "README.md",
        "ARCHITECTURE.md",
        "docs/standards/STD-STAT-001.md",
        "docs/statistical-reference-corpus.md",
        "docs/test-classification.md",
    ]:
        assert "PBI " not in (root / relative_path).read_text(encoding="utf-8")

    backlog = (root / "docs/backlog.md").read_text(encoding="utf-8")
    pbi_line = next(line for line in backlog.splitlines() if line.startswith("| 2.10 |"))
    assert pbi_line.endswith("| 28/07/2026 |")
    pbi_211_line = next(line for line in backlog.splitlines() if line.startswith("| 2.11 |"))
    assert pbi_211_line.endswith("| 28/07/2026 |")


def test_documentation_traces_pbi_217_exact_replay_evidence() -> None:
    root = corpus_validation.ROOT
    expectations = {
        "CHANGELOG.md": [
            "Rejeu exact interlangage sur le corpus versionné — PBI 2.17",
            "Scripts/run_statistical_exact_replay.py",
            "reports/statistical-exact-replay-evidence.json",
            "80 comparaisons normatives conformes",
            "64 comparaisons interlangages conformes",
            "aucun diagnostic",
        ],
        "docs/backlog-expectations/feature-02-statistical-core.md": [
            "Scripts/run_statistical_exact_replay.py",
            "`8 × 125`, `7 × 128 + 104`",
            "80 comparaisons normatives exactes",
            "64 comparaisons interlangages exactes",
            "distributional_equivalence = not_evaluated",
        ],
        "docs/statistical-reference-corpus.md": [
            "Preuve spécialisée de rejeu exact",
            "Scripts/run_statistical_exact_replay.py",
            "reports/statistical-exact-replay-evidence.json",
            "`80/80` comparaisons normatives exactes",
            "`64/64` comparaisons interlangages",
            "`0` diagnostic",
            "tests/test_statistical_exact_replay.py",
        ],
        "ARCHITECTURE.md": [
            "Scripts/run_statistical_exact_replay.py",
            "reports/statistical-exact-replay-evidence.json",
            "64 exécutions Python et 16 TypeScript",
            "distributional_equivalence = not_evaluated",
        ],
        "docs/standards/STD-STAT-001.md": [
            "Scripts/run_statistical_exact_replay.py",
            "reports/statistical-exact-replay-evidence.json",
            "Le corpus reste l’autorité de résultat",
        ],
        "docs/statistical-parity-audit.md": [
            "Suivi du PBI 2.17",
            "80 comparaisons normatives conformes",
            "64 comparaisons interlangages",
            "16 cas indépendants du batching",
        ],
        "docs/risk-control-matrix.md": [
            "reports/statistical-exact-replay-evidence.json",
            "tests/test_statistical_exact_replay.py",
            "batches `125`, `128`, `1000` et `2048`",
            "sans diagnostic",
        ],
        "docs/critical-paths.md": [
            "reports/statistical-exact-replay-evidence.json",
            "tests/test_statistical_exact_replay.py",
            "80 comparaisons normatives, 64 interlangages",
            "16 cas",
        ],
        "docs/README.md": [
            "reports/statistical-exact-replay-evidence.json",
            "Preuve JSON régénérable du rejeu exact",
        ],
    }
    for relative_path, expected_fragments in expectations.items():
        content = (root / relative_path).read_text(encoding="utf-8")
        assert all(fragment in content for fragment in expected_fragments)


@pytest.mark.parametrize(
    ("update", "path", "keyword"),
    [
        (
            lambda value: value.__setitem__("schema_version", "2.0"),
            "/schema_version",
            "const",
        ),
        (
            lambda value: value["cases"][0]["input"].__setitem__("n_sims", 999),
            "/cases/0/input/n_sims",
            "minimum",
        ),
        (
            lambda value: value["cases"][0].__setitem__("seed", 4294967296),
            "/cases/0/seed",
            "maximum",
        ),
        (
            lambda value: value["cases"][0]["input"].__setitem__(
                "throughput_samples", [0, 0, 0, 0, 0, 1]
            ),
            "/cases/0/input/throughput_samples",
            "minContains",
        ),
        (
            lambda value: value["cases"][0]["input"].__setitem__("backlog_size", 1),
            "/cases/0/input",
            "not",
        ),
        (
            lambda value: value["cases"][0]["expected_result"].__setitem__(
                "completion_summary",
                {
                    "completed_count": 1000,
                    "censored_count": 0,
                    "censored_rate": 0,
                    "horizon_weeks": 521,
                },
            ),
            "/cases/0/expected_result",
            "not",
        ),
        (
            lambda value: value["cases"][0]["expected_result"].__setitem__("unexpected", True),
            "/cases/0/expected_result",
            "additionalProperties",
        ),
    ],
)
def test_schema_rejects_contract_drift_with_localized_actionable_diagnostics(
    update: Callable[[dict[str, Any]], None],
    path: str,
    keyword: str,
) -> None:
    issues = _issues_for(update)
    assert any(issue.instance_path == path and issue.keyword == keyword for issue in issues)
    rendered = "\n".join(issue.render(Path("candidate.json")) for issue in issues)
    assert f"candidate.json:{path}" in rendered
    assert f"[{keyword}]" in rendered
    assert "(schema /" in rendered


def test_backlog_mode_requires_only_backlog_input_and_completion_result() -> None:
    schema, instance = _contract()
    case = instance["cases"][0]
    case["input"] = {
        "throughput_samples": [1, 1, 1, 1, 1, 1],
        "include_zero_weeks": False,
        "mode": "backlog_to_weeks",
        "backlog_size": 1,
        "n_sims": 1000,
    }
    case["expected_result"] = {
        "result_kind": "weeks",
        "result_percentiles": {"P50": 1, "P70": 1, "P90": 1},
        "risk_score": 0,
        "result_distribution": [{"x": 1, "count": 1000}],
        "completion_summary": {
            "completed_count": 1000,
            "censored_count": 0,
            "censored_rate": 0,
            "horizon_weeks": 521,
        },
        "samples_count": 6,
        "throughput_reliability": {
            "cv": 0,
            "iqr_ratio": 0,
            "slope_norm": 0,
            "label": "incertain",
            "samples_count": 6,
        },
        "seed": 0,
    }
    assert corpus_validation.validate_instance(instance, schema) == []


def test_contract_control_rejects_duplicate_case_identifiers() -> None:
    schema, instance = _contract()
    duplicate = deepcopy(instance["cases"][0])
    duplicate["description"] = "Different content must not make a duplicate identifier valid."
    instance["cases"].append(duplicate)
    issues = corpus_validation.validate_contract(instance, schema)
    assert any(
        issue.instance_path == "/cases/1/id"
        and issue.keyword == "uniqueCaseId"
        and "/cases/0/id" in issue.message
        for issue in issues
    )
    assert corpus_validation.validate_contract([], schema)
    assert corpus_validation.validate_contract({"cases": [None]}, schema)


def test_contract_control_rejects_duplicate_normalized_scenarios() -> None:
    schema, instance = _contract()
    duplicate = deepcopy(instance["cases"][0])
    duplicate["id"] = "different-id-same-scenario"
    duplicate["description"] = "A renamed case must not duplicate an existing input and seed."
    instance["cases"].append(duplicate)
    issues = corpus_validation.validate_contract(instance, schema)
    assert any(
        issue.instance_path == "/cases/1"
        and issue.keyword == "uniqueScenario"
        and "/cases/0" in issue.message
        for issue in issues
    )


def test_cli_reports_invalid_custom_instance_and_parse_failures(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    invalid_path = tmp_path / "invalid.json"
    invalid_path.write_text('{"schema_version":"2.0"}', encoding="utf-8")
    assert corpus_validation.main([str(invalid_path)]) == 1
    first = capsys.readouterr()
    assert f"{invalid_path.as_posix()}:/schema_version: [const]" in first.err
    assert "validation failed" in first.err

    duplicate_path = tmp_path / "duplicate.json"
    duplicate_path.write_text('{"schema_version":"1.0","schema_version":"1.0"}', encoding="utf-8")
    assert corpus_validation.main([str(duplicate_path)]) == 1
    assert "duplicate JSON property: schema_version" in capsys.readouterr().err

    malformed_path = tmp_path / "malformed.json"
    malformed_path.write_text('{"schema_version":', encoding="utf-8")
    with pytest.raises(ValueError, match=r"malformed\.json:1:19: invalid JSON"):
        corpus_validation.load_json(malformed_path)


def test_control_reports_invalid_schema_and_negative_probe_regressions(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    original_schema_path = corpus_validation.SCHEMA_PATH
    _schema, instance = _contract()
    invalid_schema = tmp_path / "schema.json"
    invalid_schema.write_text(
        json.dumps({"$schema": "https://json-schema.org/draft/2020-12/schema", "type": 7}),
        encoding="utf-8",
    )
    monkeypatch.setattr(corpus_validation, "SCHEMA_PATH", invalid_schema)
    assert corpus_validation.main([]) == 1
    assert "7 is not valid under any of the given schemas" in capsys.readouterr().err

    non_object_schema = tmp_path / "non-object-schema.json"
    non_object_schema.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(corpus_validation, "SCHEMA_PATH", non_object_schema)
    assert corpus_validation.run_control() == [
        f"{non_object_schema.as_posix()}:/: schema must be a JSON object"
    ]

    non_object_corpus = tmp_path / "non-object-corpus.json"
    non_object_corpus.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(corpus_validation, "SCHEMA_PATH", original_schema_path)
    monkeypatch.setattr(corpus_validation, "CORPUS_PATH", non_object_corpus)
    assert corpus_validation.run_control() == [
        f"{non_object_corpus.as_posix()}:/: corpus must be a JSON object"
    ]

    valid_negative = tmp_path / "valid-negative.json"
    valid_negative.write_text(json.dumps(instance), encoding="utf-8")
    monkeypatch.setattr(
        corpus_validation,
        "CORPUS_PATH",
        corpus_validation.ROOT / "contracts/statistical-reference-corpus-v1.0.json",
    )
    monkeypatch.setattr(corpus_validation, "INVALID_EXAMPLE_PATH", valid_negative)
    assert any(
        "negative example was unexpectedly accepted" in error
        for error in corpus_validation.run_control()
    )

    wrong_negative = deepcopy(instance)
    wrong_negative["schema_version"] = "2.0"
    wrong_negative_path = tmp_path / "wrong-negative.json"
    wrong_negative_path.write_text(json.dumps(wrong_negative), encoding="utf-8")
    monkeypatch.setattr(corpus_validation, "INVALID_EXAMPLE_PATH", wrong_negative_path)
    assert any(
        "did not produce the expected actionable diagnostic" in error
        for error in corpus_validation.run_control()
    )

    with pytest.raises(SchemaError):
        corpus_validation.Draft202012Validator.check_schema({"type": 7})
