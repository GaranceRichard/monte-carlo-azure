from __future__ import annotations

from typing import Dict, Optional, Tuple

import numpy as np


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
) -> np.ndarray:
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
    return weeks_needed


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


def percentiles(arr: np.ndarray, ps: Tuple[int, ...] = (50, 80, 90)) -> Dict[str, int]:
    """
    Calcule des percentiles (P50/P80/P90...) sur un array.
    """
    a = np.asarray(arr)
    return {f"P{p}": int(np.percentile(a, p)) for p in ps}


def risk_score(p50: int, p90: int) -> float:
    """
    Mesure la dispersion pessimiste vs mediane.
    """
    if p50 <= 0:
        return 0.0
    return max(0.0, float(p90 - p50) / float(p50))
