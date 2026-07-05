from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Literal, Optional, Tuple

import numpy as np


@dataclass(frozen=True)
class FinishWeeksSimulation:
    weeks_needed: np.ndarray
    completed_mask: np.ndarray
    horizon_weeks: int

    @property
    def completed_weeks(self) -> np.ndarray:
        return self.weeks_needed[self.completed_mask]

    @property
    def completed_count(self) -> int:
        return int(np.count_nonzero(self.completed_mask))

    @property
    def censored_count(self) -> int:
        return int(self.weeks_needed.size - self.completed_count)

    @property
    def censored_rate(self) -> float:
        total = int(self.weeks_needed.size)
        if total <= 0:
            return 0.0
        return self.censored_count / total


def histogram_buckets(arr: np.ndarray, max_buckets: int = 100) -> list[Dict[str, int]]:
    """
    Agrège une distribution discrète en buckets {x, count}.

    - Si le nombre de valeurs distinctes est <= max_buckets: histogramme exact.
    - Sinon: agrégation en max_buckets bins.
    """
    values = np.asarray(arr, dtype=int)
    if values.size == 0:
        return []

    uniq, counts = np.unique(values, return_counts=True)
    if uniq.size <= max_buckets:
        return [{"x": int(x), "count": int(c)} for x, c in zip(uniq, counts)]

    min_v = int(values.min())
    max_v = int(values.max())
    hist, edges = np.histogram(values, bins=max_buckets, range=(min_v, max_v + 1))

    buckets: list[Dict[str, int]] = []
    for i, count in enumerate(hist):
        if count <= 0:
            continue
        left = edges[i]
        right = edges[i + 1]
        center = int(round((left + right) / 2))
        buckets.append({"x": center, "count": int(count)})
    return buckets


def mc_finish_weeks(
    backlog_size: int,
    throughput_samples: np.ndarray,
    n_sims: int = 20000,
    include_zero_weeks: bool = False,
    seed: Optional[int] = None,
) -> FinishWeeksSimulation:
    """
    Monte Carlo "Quand finira-t-on un backlog de N items ?"

    - backlog_size: nombre d'items à livrer
    - throughput_samples: array des throughputs (items/semaine) observés historiquement
    - n_sims: nombre de simulations
    - seed: graine RNG pour reproductibilité

    Retour: array des semaines nécessaires (taille = n_sims)
    """
    if backlog_size <= 0:
        raise ValueError("backlog_size doit être > 0")
    if throughput_samples is None or len(throughput_samples) == 0:
        raise ValueError("throughput_samples est vide")

    samples = np.asarray(throughput_samples, dtype=int)
    if include_zero_weeks:
        samples = samples[samples >= 0]
        if len(samples) == 0:
            raise ValueError("throughput_samples ne contient aucune valeur >= 0")
    else:
        samples = samples[samples > 0]
        if len(samples) == 0:
            raise ValueError("throughput_samples ne contient aucune valeur > 0")

    rng = np.random.default_rng(seed)

    # Garde-fou historique: la version boucle stoppait au plus tard a 521 semaines.
    max_weeks = 521

    # Vectorisation: tirages hebdomadaires en matrice, puis cumul pour trouver
    # la premiere semaine ou le backlog est atteint.
    draws = rng.choice(samples, size=(n_sims, max_weeks), replace=True)
    cumulative = np.cumsum(draws, axis=1)
    reached = cumulative >= backlog_size

    first_hit_idx = reached.argmax(axis=1)  # 0-based
    has_hit = reached.any(axis=1)

    weeks_needed = np.full(n_sims, max_weeks, dtype=int)
    weeks_needed[has_hit] = first_hit_idx[has_hit] + 1  # 1-based
    return FinishWeeksSimulation(
        weeks_needed=weeks_needed,
        completed_mask=has_hit,
        horizon_weeks=max_weeks,
    )


def mc_items_done_for_weeks(
    weeks: int,
    throughput_samples: np.ndarray,
    n_sims: int = 20000,
    include_zero_weeks: bool = False,
    seed: Optional[int] = None,
) -> np.ndarray:
    """
    Monte Carlo "Combien d'items seront livrés en N semaines ?"

    - weeks: horizon de simulation en semaines
    - throughput_samples: array des throughputs (items/semaine) observés historiquement
    - n_sims: nombre de simulations
    - seed: graine RNG pour reproductibilité

    Retour: array du nombre d'items terminés sur N semaines (taille = n_sims)
    """
    if weeks <= 0:
        raise ValueError("weeks doit être > 0")
    if throughput_samples is None or len(throughput_samples) == 0:
        raise ValueError("throughput_samples est vide")

    samples = np.asarray(throughput_samples, dtype=int)
    if include_zero_weeks:
        samples = samples[samples >= 0]
        if len(samples) == 0:
            raise ValueError("throughput_samples ne contient aucune valeur >= 0")
    else:
        samples = samples[samples > 0]
        if len(samples) == 0:
            raise ValueError("throughput_samples ne contient aucune valeur > 0")

    rng = np.random.default_rng(seed)
    draws = rng.choice(samples, size=(n_sims, weeks), replace=True)
    return draws.sum(axis=1).astype(int)


def _discrete_quantile(
    arr: np.ndarray,
    q: float,
    method: Literal["higher", "lower"],
) -> int:
    values = np.asarray(arr, dtype=int)
    if values.size == 0:
        raise ValueError("arr est vide")
    return int(np.quantile(values, q, method=method))


def percentiles(
    arr: np.ndarray,
    mode: Literal["backlog_to_weeks", "weeks_to_items"],
    ps: Tuple[int, ...] = (50, 80, 90),
) -> Dict[str, int]:
    """
    Calcule des percentiles metier entiers selon le mode de simulation.

    - backlog_to_weeks: quantile empirique discret conservateur "higher"
      pour lire "X% des simulations finissent en PXX semaines ou moins".
    - weeks_to_items: quantile de survie discret "lower" pour lire
      "X% des simulations livrent au moins PXX items".
    """
    values = np.asarray(arr, dtype=int)
    if values.size == 0:
        return {}

    out: Dict[str, int] = {}
    for p in ps:
        if mode == "weeks_to_items":
            q = max(0.0, min(1.0, (100 - p) / 100))
            out[f"P{p}"] = _discrete_quantile(values, q, method="lower")
        else:
            q = max(0.0, min(1.0, p / 100))
            out[f"P{p}"] = _discrete_quantile(values, q, method="higher")
    return out


def risk_score(
    mode: Literal["backlog_to_weeks", "weeks_to_items"],
    p50: Optional[int],
    p90: Optional[int],
) -> Optional[float]:
    """
    Mesure la dispersion normalisee selon le mode.

    - backlog_to_weeks: (P90 - P50) / P50
    - weeks_to_items: (P50 - P90) / P50
    """
    if p50 is None or p90 is None or p50 <= 0:
        return None
    if mode == "weeks_to_items":
        return max(0.0, float(p50 - p90) / float(p50))
    return max(0.0, float(p90 - p50) / float(p50))


def throughput_reliability(samples: np.ndarray) -> Dict[str, float | int | str]:
    """
    Evalue la fiabilite de l'historique de throughput brut avant simulation.

    Retourne les signaux bruts et un label composite:
    - fiable
    - incertain
    - fragile
    - non fiable
    """
    values = np.asarray(samples, dtype=float)
    if values.size == 0:
        raise ValueError("throughput_samples est vide")

    n = int(values.size)
    mean = float(np.mean(values))
    std = float(np.std(values))
    q25, q50, q75 = np.percentile(values, [25, 50, 75])
    slope = float(np.polyfit(np.arange(n, dtype=float), values, deg=1)[0]) if n >= 2 else 0.0

    cv = 0.0 if mean <= 0 else std / mean
    iqr = float(q75 - q25)
    iqr_ratio = 0.0 if q50 <= 0 else iqr / float(q50)
    slope_norm = 0.0 if mean <= 0 else slope / mean

    if n < 6 or cv >= 1.5 or slope_norm <= -0.15 or mean <= 0:
        label = "non fiable"
    else:
        cv_state = "stable" if cv < 0.5 else "moderate" if cv < 1.0 else "volatile"
        iqr_state = (
            "stable" if iqr_ratio < 0.5 else "moderate" if iqr_ratio < 1.0 else "volatile"
        )
        slope_state = (
            "stable"
            if abs(slope_norm) < 0.05
            else "moderate"
            if abs(slope_norm) < 0.10
            else "strong"
        )

        if "volatile" in (cv_state, iqr_state) or slope_state == "strong":
            label = "fragile"
        elif "moderate" in (cv_state, iqr_state, slope_state):
            label = "incertain"
        else:
            label = "fiable"

        if n < 8 and label == "fiable":
            label = "incertain"

    return {
        "cv": round(cv, 4),
        "iqr_ratio": round(iqr_ratio, 4),
        "slope_norm": round(slope_norm, 4),
        "label": label,
        "samples_count": n,
    }
