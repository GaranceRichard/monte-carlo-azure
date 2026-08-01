"""Controlled, deterministic calibration of distributional decision parameters."""

from __future__ import annotations

import hashlib
import json
import math
from copy import deepcopy
from statistics import NormalDist
from typing import Any

import numpy as np

from Scripts.statistical_distribution_statistics import dkw_radius, rate_difference_interval


def _score_p_value(left: int, right: int, size: int) -> float:
    pooled = (left + right) / (2 * size)
    variance = pooled * (1 - pooled) * (2 / size)
    if variance == 0:
        return 1.0 if left == right else 0.0
    z = abs(left / size - right / size) / math.sqrt(variance)
    return 2 * (1 - NormalDist().cdf(z))


def _rate_equivalent(left: int, right: int, size: int, alpha: float, margin: float) -> bool:
    low, high = rate_difference_interval((left, size), (right, size), alpha)
    return max(abs(low), abs(high)) <= margin


def _cdf_equivalent(left: int, right: int, size: int, alpha: float, margin: float) -> bool:
    effect = abs(left / size - right / size)
    return effect + dkw_radius(size, size, alpha) <= margin


def _divergent(
    left: int, right: int, size: int, alpha: float, margin: float,
) -> bool:
    effect = abs(left / size - right / size)
    return effect > margin and _score_p_value(left, right, size) <= alpha


def _binomial_envelope(repetitions: int, probability: float, confidence: float) -> int:
    cumulative = 0.0
    for count in range(repetitions + 1):
        cumulative += (
            math.comb(repetitions, count)
            * probability**count
            * (1 - probability) ** (repetitions - count)
        )
        if cumulative >= confidence:
            return count
    return repetitions


def _fingerprint(report: dict[str, Any]) -> str:
    canonical = json.dumps(report, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _grid_samples(
    rng: np.random.Generator, cohort_size: int, n_sims: int, repetitions: int,
) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    size = cohort_size * n_sims
    return {
        "null": (rng.binomial(size, 0.5, repetitions), rng.binomial(size, 0.5, repetitions)),
        "rate": (rng.binomial(size, 0.10, repetitions), rng.binomial(size, 0.15, repetitions)),
        "cdf": (rng.binomial(size, 0.50, repetitions), rng.binomial(size, 0.60, repetitions)),
        "conditional_null": (
            rng.binomial(cohort_size, 0.50, repetitions),
            rng.binomial(cohort_size, 0.50, repetitions),
        ),
        "conditional_alt": (
            rng.binomial(cohort_size, 0.10, repetitions),
            rng.binomial(cohort_size, 0.90, repetitions),
        ),
    }


def _count_pairwise(
    samples: tuple[np.ndarray, np.ndarray],
    predicate: Any,
) -> int:
    return sum(
        predicate(int(left), int(right))
        for left, right in zip(*samples)
    )


def _grid_counts(
    samples: dict[str, tuple[np.ndarray, np.ndarray]],
    cohort_size: int,
    size: int,
    alpha: float,
    family_size: int,
    margins: dict[str, float],
) -> tuple[int, int, int, int, int, int]:
    adjusted_alpha = alpha / family_size
    rate_matches = _count_pairwise(
        samples["null"],
        lambda left, right: _rate_equivalent(
            left, right, size, adjusted_alpha, margins["pooled_rate"],
        ),
    )
    cdf_matches = _count_pairwise(
        samples["null"],
        lambda left, right: _cdf_equivalent(
            left, right, size, adjusted_alpha, margins["pooled_cdf"],
        ),
    )
    conditional_matches = _count_pairwise(
        samples["conditional_null"],
        lambda left, right: _cdf_equivalent(
            left, right, cohort_size, adjusted_alpha, margins["conditional_cdf"],
        ),
    )
    power = _grid_power_counts(samples, cohort_size, size, adjusted_alpha, margins)
    return rate_matches, cdf_matches, conditional_matches, *power


def _grid_power_counts(
    samples: dict[str, tuple[np.ndarray, np.ndarray]],
    cohort_size: int,
    size: int,
    adjusted_alpha: float,
    margins: dict[str, float],
) -> tuple[int, int, int]:
    rate_power = _count_pairwise(
        samples["rate"],
        lambda left, right: _divergent(
            left, right, size, adjusted_alpha, margins["pooled_rate"],
        ),
    )
    cdf_power = _count_pairwise(
        samples["cdf"],
        lambda left, right: _divergent(
            left, right, size, adjusted_alpha, margins["pooled_cdf"],
        ),
    )
    conditional_power = _count_pairwise(
        samples["conditional_alt"],
        lambda left, right: _divergent(
            left, right, cohort_size, adjusted_alpha, margins["conditional_cdf"],
        ),
    )
    return rate_power, cdf_power, conditional_power


def _grid_entry(
    rng: np.random.Generator,
    *,
    cohort_size: int,
    n_sims: int,
    repetitions: int,
    alpha: float,
    family_size: int,
    margins: dict[str, float],
) -> dict[str, Any]:
    samples = _grid_samples(rng, cohort_size, n_sims, repetitions)
    counts = _grid_counts(
        samples,
        cohort_size,
        cohort_size * n_sims,
        alpha,
        family_size,
        margins,
    )
    (
        rate_matches,
        cdf_matches,
        conditional_matches,
        rate_power,
        cdf_power,
        conditional_power,
    ) = counts
    return {
        "cohort_size": cohort_size,
        "n_sims": n_sims,
        "same_law": {
            "pooled_rate_match": round(rate_matches / repetitions, 4),
            "pooled_cdf_match": round(cdf_matches / repetitions, 4),
            "conditional_cdf_match": round(conditional_matches / repetitions, 4),
        },
        "controlled_power": {
            "censor_rate_plus_0_05": round(rate_power / repetitions, 4),
            "cdf_mass_shift_0_10": round(cdf_power / repetitions, 4),
            "conditional_cdf_shift_0_80": round(conditional_power / repetitions, 4),
        },
    }


def _build_grid(
    protocol: dict[str, Any],
    rng: np.random.Generator,
    family_size: int,
) -> list[dict[str, Any]]:
    configuration = protocol["calibration"]
    inference = protocol["inference"]
    return [
        _grid_entry(
            rng,
            cohort_size=cohort_size,
            n_sims=n_sims,
            repetitions=configuration["repetitions"],
            alpha=inference["familywise_alpha"],
            family_size=family_size,
            margins=inference["equivalence_margins"],
        )
        for cohort_size in configuration["cohort_sizes"]
        for n_sims in configuration["simulation_sizes"]
    ]


def _false_positive_families(
    rng: np.random.Generator,
    *,
    repetitions: int,
    family_size: int,
    size: int,
    alpha: float,
    margin: float,
) -> int:
    observed = 0
    for _ in range(repetitions):
        left = rng.binomial(size, 0.5, family_size)
        right = rng.binomial(size, 0.5, family_size)
        raw = sorted(
            (
                _score_p_value(int(a), int(b), size),
                abs(int(a) / size - int(b) / size),
            )
            for a, b in zip(left, right)
        )
        if any(
            p_value <= alpha / (family_size - rank) and effect > margin
            for rank, (p_value, effect) in enumerate(raw)
        ):
            observed += 1
    return observed


def _presence_power(
    rng: np.random.Generator,
    *,
    repetitions: int,
    cohort_size: int,
    alpha: float,
    family_size: int,
    margin: float,
) -> float:
    left = rng.binomial(cohort_size, 0.30, repetitions)
    right = np.full(repetitions, cohort_size)
    detected = sum(
        _divergent(
            int(a), int(b), cohort_size, alpha / family_size, margin,
        )
        for a, b in zip(left, right)
    )
    return round(detected / repetitions, 4)


def _false_positive_report(
    protocol: dict[str, Any], rng: np.random.Generator, family_size: int,
) -> dict[str, Any]:
    configuration = protocol["calibration"]
    inference = protocol["inference"]
    repetitions = configuration["repetitions"]
    observed_false_positive = _false_positive_families(
        rng,
        repetitions=repetitions,
        family_size=family_size,
        size=64 * 1000,
        alpha=inference["familywise_alpha"],
        margin=inference["equivalence_margins"]["pooled_cdf"],
    )
    envelope = _binomial_envelope(
        repetitions, inference["familywise_alpha"], 0.99,
    )
    return {
        "observed_families": observed_false_positive,
        "observed_rate": round(observed_false_positive / repetitions, 4),
        "binomial_99pct_maximum": envelope,
        "familywise_alpha": inference["familywise_alpha"],
        "passed": observed_false_positive <= envelope,
    }


def _production_sensitivity(
    protocol: dict[str, Any],
    rng: np.random.Generator,
    family_size: int,
    grid: list[dict[str, Any]],
) -> dict[str, Any]:
    configuration = protocol["calibration"]
    inference = protocol["inference"]
    production_grid = next(
        entry for entry in grid if entry["cohort_size"] == 64 and entry["n_sims"] == 1000
    )
    presence_power = _presence_power(
        rng,
        repetitions=configuration["repetitions"],
        cohort_size=64,
        alpha=inference["familywise_alpha"],
        family_size=family_size,
        margin=inference["equivalence_margins"]["cohort_rate"],
    )
    sensitivity = {
        "censor_rate_plus_0_05": production_grid["controlled_power"]["censor_rate_plus_0_05"],
        "presence_rate_0_30_vs_1_00": presence_power,
        "cdf_mass_shift_0_10": production_grid["controlled_power"]["cdf_mass_shift_0_10"],
        "conditional_cdf_shift_0_80": production_grid["controlled_power"][
            "conditional_cdf_shift_0_80"
        ],
        "minimum_required_power": 0.8,
    }
    sensitivity["passed"] = all(
        value >= sensitivity["minimum_required_power"]
        for key, value in sensitivity.items()
        if key not in {"minimum_required_power", "passed"}
    )
    return sensitivity


def _calibration_diagnostics(
    false_positive: dict[str, Any], sensitivity: dict[str, Any],
) -> list[str]:
    diagnostics: list[str] = []
    if not false_positive["passed"]:
        diagnostics.append("Le taux de faux positifs dépasse l'enveloppe binomiale à 99 %.")
    if not sensitivity["passed"]:
        diagnostics.append("La puissance minimale de 80 % n'est pas atteinte.")
    return diagnostics


def build_calibration_report(protocol: dict[str, Any]) -> dict[str, Any]:
    configuration = protocol["calibration"]
    family_size = sum(
        len(scenario["metrics"])
        for scenario in protocol["scenarios"]
        if scenario["distribution_view"] != "structural-censor-state"
    )
    rng = np.random.Generator(np.random.PCG64(218002))
    grid = _build_grid(protocol, rng, family_size)
    false_positive = _false_positive_report(protocol, rng, family_size)
    sensitivity = _production_sensitivity(protocol, rng, family_size, grid)
    diagnostics = _calibration_diagnostics(false_positive, sensitivity)
    report = {
        "calibration_version": "1.0",
        "method": configuration["method_id"],
        "protocol": {"id": protocol["protocol_id"], "version": protocol["version"]},
        "repetitions": configuration["repetitions"],
        "family_size": family_size,
        "grid": grid,
        "false_positive": false_positive,
        "production_sensitivity": sensitivity,
        "stability": {
            "deterministic": True,
            "fingerprint_method": "sha256-canonical-json-without-artifact-fingerprint",
        },
        "status": "calibrated" if not diagnostics else "invalid",
        "diagnostics": diagnostics,
    }
    report["stability"]["artifact_fingerprint"] = _fingerprint(report)
    return report


def verify_calibration_fingerprint(report: dict[str, Any]) -> bool:
    candidate = deepcopy(report)
    observed = candidate.get("stability", {}).pop("artifact_fingerprint", None)
    return isinstance(observed, str) and observed == _fingerprint(candidate)
