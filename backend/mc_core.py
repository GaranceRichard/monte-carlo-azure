from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Literal, Optional, Tuple

import numpy as np

from .sample_index_draw_port import SampleIndexDrawPort
from .simulation_limits import SIMULATION_HORIZON_WEEKS_MAX

SIMULATION_BATCH_SIZE = 2048


@dataclass(frozen=True)
class FinishWeeksSimulation:
    completed_weeks: np.ndarray
    simulation_count: int
    horizon_weeks: int

    def __post_init__(self) -> None:
        values = np.asarray(self.completed_weeks, dtype=int)
        if values.ndim != 1:
            raise ValueError("completed_weeks doit etre un tableau unidimensionnel")
        if type(self.simulation_count) is not int or self.simulation_count < values.size:
            raise ValueError("simulation_count doit couvrir toutes les simulations terminees")
        if values.size and (
            np.any(values < 1) or np.any(values > self.horizon_weeks)
        ):
            raise ValueError("completed_weeks doit rester dans l'horizon de simulation")
        object.__setattr__(self, "completed_weeks", values)

    @property
    def completed_count(self) -> int:
        return int(self.completed_weeks.size)

    @property
    def censored_count(self) -> int:
        return self.simulation_count - self.completed_count

    @property
    def censored_rate(self) -> float:
        if self.simulation_count <= 0:
            return 0.0
        return self.censored_count / self.simulation_count


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
    *,
    draw_port: SampleIndexDrawPort,
    batch_size: int = SIMULATION_BATCH_SIZE,
) -> FinishWeeksSimulation:
    """
    Monte Carlo "Quand finira-t-on un backlog de N items ?"

    - backlog_size: nombre d'items à livrer
    - throughput_samples: array des throughputs (items/semaine) observés historiquement
    - n_sims: nombre de simulations
    - draw_port: source injectee d'indices d'echantillons deterministes

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

    resolved_batch_size = _resolve_batch_size(batch_size)

    # Garde-fou historique: la version boucle stoppait au plus tard a 521 semaines.
    max_weeks = SIMULATION_HORIZON_WEEKS_MAX
    completed_batches: list[np.ndarray] = []

    for start in range(0, n_sims, resolved_batch_size):
        stop = min(start + resolved_batch_size, n_sims)
        current_batch_size = stop - start
        draws = _draw_samples_batch(
            draw_port,
            samples,
            current_batch_size,
            max_weeks,
        )
        cumulative = np.cumsum(draws, axis=1)
        reached = cumulative >= backlog_size

        first_hit_idx = reached.argmax(axis=1)  # 0-based
        has_hit = reached.any(axis=1)

        completed_batches.append(first_hit_idx[has_hit].astype(int) + 1)

    return FinishWeeksSimulation(
        completed_weeks=np.concatenate(completed_batches),
        simulation_count=n_sims,
        horizon_weeks=max_weeks,
    )


def mc_items_done_for_weeks(
    weeks: int,
    throughput_samples: np.ndarray,
    n_sims: int = 20000,
    include_zero_weeks: bool = False,
    *,
    draw_port: SampleIndexDrawPort,
    batch_size: int = SIMULATION_BATCH_SIZE,
) -> np.ndarray:
    """
    Monte Carlo "Combien d'items seront livrés en N semaines ?"

    - weeks: horizon de simulation en semaines
    - throughput_samples: array des throughputs (items/semaine) observés historiquement
    - n_sims: nombre de simulations
    - draw_port: source injectee d'indices d'echantillons deterministes

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

    resolved_batch_size = _resolve_batch_size(batch_size)
    items_done = np.empty(n_sims, dtype=int)

    for start in range(0, n_sims, resolved_batch_size):
        stop = min(start + resolved_batch_size, n_sims)
        current_batch_size = stop - start
        draws = _draw_samples_batch(
            draw_port,
            samples,
            current_batch_size,
            weeks,
        )
        items_done[start:stop] = draws.sum(axis=1, dtype=int)

    return items_done


def _resolve_batch_size(batch_size: int) -> int:
    if batch_size <= 0:
        raise ValueError("batch_size doit etre > 0")
    return int(batch_size)


def _draw_samples_batch(
    draw_port: SampleIndexDrawPort,
    samples: np.ndarray,
    simulation_count: int,
    draw_slots_per_simulation: int,
) -> np.ndarray:
    """Draw a simulation-major matrix whose rows are contiguous logical slots."""

    sample_indexes = draw_port.draw_sample_indices(
        len(samples),
        (simulation_count, draw_slots_per_simulation),
    )
    return samples[sample_indexes]


def percentiles(
    arr: np.ndarray,
    mode: Literal["backlog_to_weeks", "weeks_to_items"],
    ps: Tuple[Literal[50, 70, 90], ...] = (50, 70, 90),
    total_count: Optional[int] = None,
) -> Dict[str, int]:
    """
    Calcule des percentiles metier entiers selon le mode de simulation.

    - backlog_to_weeks: quantile empirique discret conservateur "higher"
      pour lire "X% des simulations finissent en PXX semaines ou moins".
    - weeks_to_items: quantile de survie discret "lower" pour lire
      "X% des simulations livrent au moins PXX items".
    """
    if mode not in ("backlog_to_weeks", "weeks_to_items"):
        raise ValueError("mode de simulation invalide")
    if any(p not in (50, 70, 90) for p in ps):
        raise ValueError("ps accepte uniquement P50, P70 et P90")

    values = np.asarray(arr, dtype=int)
    sorted_values = np.sort(values)
    out: Dict[str, int] = {}
    if mode == "backlog_to_weeks":
        if (
            type(total_count) is not int
            or total_count <= 0
            or total_count < values.size
        ):
            raise ValueError(
                "total_count doit etre un entier couvrant la population totale"
            )
        for p in ps:
            rank = (p * total_count + 99) // 100
            if values.size >= rank:
                out[f"P{p}"] = int(sorted_values[rank - 1])
        return out

    if total_count is not None:
        raise ValueError("total_count est interdit pour weeks_to_items")
    if values.size == 0:
        return out
    for p in ps:
        index = ((100 - p) * (values.size - 1)) // 100
        out[f"P{p}"] = int(sorted_values[index])
    return out


def throughput_reliability_metrics(samples: np.ndarray) -> Dict[str, float | int]:
    """
    Evalue la fiabilite de l'historique de throughput brut avant simulation.

    Retourne uniquement les primitives de calcul. La normalisation et la
    categorisation appartiennent au Value Object du domaine.
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

    return {
        "cv": cv,
        "iqr_ratio": iqr_ratio,
        "slope_norm": slope_norm,
        "samples_count": n,
        "mean": mean,
    }
