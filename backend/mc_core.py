from __future__ import annotations

import numpy as np
from typing import Iterable, Dict, Tuple

def mc_finish_weeks(
    backlog_size: int,
    throughput_samples: np.ndarray,
    n_sims: int = 20000,
    seed: int = 42,
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

    # On élimine les semaines à 0 (sinon risque de boucle infinie / résultat absurde)
    samples = np.asarray(throughput_samples, dtype=int)
    samples = samples[samples > 0]
    if len(samples) == 0:
        raise ValueError("throughput_samples ne contient aucune valeur > 0")

    rng = np.random.default_rng(seed)
    weeks_needed = np.zeros(n_sims, dtype=int)

    for i in range(n_sims):
        remaining = backlog_size
        w = 0
        while remaining > 0:
            t = int(rng.choice(samples))
            remaining -= t
            w += 1
            if w > 520:  # garde-fou (10 ans)
                break
        weeks_needed[i] = w

    return weeks_needed


def mc_items_done_for_weeks(
    weeks: int,
    throughput_samples: np.ndarray,
    n_sims: int = 20000,
    seed: int = 42,
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
