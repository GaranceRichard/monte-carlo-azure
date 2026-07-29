from __future__ import annotations

import math
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal, TypeAlias, overload

from .risk_score import round_positive_ratio_half_up
from .simulation_limits import (
    SIMULATION_BACKLOG_SIZE_MAX,
    SIMULATION_BACKLOG_SIZE_MIN,
    SIMULATION_HORIZON_WEEKS_MAX,
    SIMULATION_N_SIMS_MAX,
    SIMULATION_N_SIMS_MIN,
    SIMULATION_SEED_MAX,
    SIMULATION_SEED_MIN,
    SIMULATION_TARGET_WEEKS_MIN,
    SIMULATION_THROUGHPUT_SAMPLES_MAX,
    SIMULATION_THROUGHPUT_SAMPLES_MIN,
)

SimulationMode: TypeAlias = Literal["backlog_to_weeks", "weeks_to_items"]
PercentileKey: TypeAlias = Literal["P50", "P70", "P90"]
ThroughputReliabilityLabel: TypeAlias = Literal["fiable", "incertain", "fragile", "non fiable"]

_PERCENTILE_KEYS: tuple[PercentileKey, ...] = ("P50", "P70", "P90")
_RELIABILITY_LABELS: frozenset[str] = frozenset({"fiable", "incertain", "fragile", "non fiable"})


class StatisticalValueError(ValueError):
    """Raised when a primitive cannot cross the statistical domain boundary."""


def _strict_integer(value: object, field_name: str) -> int:
    if type(value) is not int:
        raise StatisticalValueError(f"{field_name} doit etre un entier strict.")
    return value


def _bounded_integer(
    value: object,
    field_name: str,
    minimum: int,
    maximum: int,
) -> int:
    resolved = _strict_integer(value, field_name)
    if resolved < minimum or resolved > maximum:
        raise StatisticalValueError(f"{field_name} doit etre compris entre {minimum} et {maximum}.")
    return resolved


def _finite_metric(value: object, field_name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise StatisticalValueError(f"{field_name} doit etre un nombre fini.")
    resolved = float(value)
    if not math.isfinite(resolved):
        raise StatisticalValueError(f"{field_name} doit etre un nombre fini.")
    return resolved


def round_half_up(value: float, decimal_places: int = 4) -> float:
    quantum = Decimal(1).scaleb(-decimal_places)
    return float(Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP))


@dataclass(frozen=True, slots=True)
class SimulationSeed:
    value: int

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "value",
            _bounded_integer(
                self.value,
                "seed",
                SIMULATION_SEED_MIN,
                SIMULATION_SEED_MAX,
            ),
        )


@dataclass(frozen=True, slots=True)
class SimulationCount:
    value: int

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "value",
            _bounded_integer(
                self.value,
                "n_sims",
                SIMULATION_N_SIMS_MIN,
                SIMULATION_N_SIMS_MAX,
            ),
        )


@dataclass(frozen=True, slots=True)
class BacklogSize:
    value: int

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "value",
            _bounded_integer(
                self.value,
                "backlog_size",
                SIMULATION_BACKLOG_SIZE_MIN,
                SIMULATION_BACKLOG_SIZE_MAX,
            ),
        )


@dataclass(frozen=True, slots=True)
class SimulationHorizon:
    value: int

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "value",
            _bounded_integer(
                self.value,
                "target_weeks",
                SIMULATION_TARGET_WEEKS_MIN,
                SIMULATION_HORIZON_WEEKS_MAX,
            ),
        )


@dataclass(frozen=True, slots=True, init=False)
class ThroughputSamples:
    raw_values: tuple[int, ...]
    usable_values: tuple[int, ...]
    include_zero_weeks: bool

    @classmethod
    def create(
        cls,
        values: Iterable[object],
        include_zero_weeks: bool,
    ) -> ThroughputSamples:
        if type(include_zero_weeks) is not bool:
            raise StatisticalValueError("include_zero_weeks doit etre un booleen strict.")
        try:
            raw_values = tuple(values)
        except TypeError as exc:
            raise StatisticalValueError("throughput_samples doit etre une collection.") from exc
        if not (
            SIMULATION_THROUGHPUT_SAMPLES_MIN
            <= len(raw_values)
            <= SIMULATION_THROUGHPUT_SAMPLES_MAX
        ):
            raise StatisticalValueError(
                "throughput_samples doit contenir entre "
                f"{SIMULATION_THROUGHPUT_SAMPLES_MIN} et "
                f"{SIMULATION_THROUGHPUT_SAMPLES_MAX} valeurs."
            )

        validated = tuple(_strict_integer(value, "throughput_samples") for value in raw_values)
        if any(value < 0 for value in validated):
            raise StatisticalValueError(
                "throughput_samples doit contenir uniquement des entiers >= 0."
            )
        usable = (
            validated if include_zero_weeks else tuple(value for value in validated if value > 0)
        )
        if len(usable) < SIMULATION_THROUGHPUT_SAMPLES_MIN:
            detail = (
                "Historique insuffisant (moins de 6 semaines)."
                if include_zero_weeks
                else "Historique insuffisant (moins de 6 semaines non nulles)."
            )
            raise StatisticalValueError(detail)
        instance = object.__new__(cls)
        object.__setattr__(instance, "raw_values", validated)
        object.__setattr__(instance, "usable_values", usable)
        object.__setattr__(instance, "include_zero_weeks", include_zero_weeks)
        return instance


@dataclass(frozen=True, slots=True, init=False)
class SimulationPercentiles(Mapping[PercentileKey, int]):
    mode: SimulationMode
    _items: tuple[tuple[PercentileKey, int], ...]

    @classmethod
    def create(
        cls,
        mode: SimulationMode,
        values: Mapping[str, object],
    ) -> SimulationPercentiles:
        if mode not in ("backlog_to_weeks", "weeks_to_items"):
            raise StatisticalValueError("mode de simulation invalide.")
        unknown_keys = set(values) - set(_PERCENTILE_KEYS)
        if unknown_keys:
            raise StatisticalValueError("result_percentiles accepte uniquement P50, P70 et P90.")
        normalized: dict[PercentileKey, int] = {}
        for key in _PERCENTILE_KEYS:
            if key not in values:
                continue
            value = _strict_integer(values[key], f"result_percentiles.{key}")
            if value < 0:
                raise StatisticalValueError(f"result_percentiles.{key} doit etre >= 0.")
            normalized[key] = value
        cls._validate_order(mode, normalized)
        instance = object.__new__(cls)
        object.__setattr__(instance, "mode", mode)
        object.__setattr__(instance, "_items", tuple(normalized.items()))
        return instance

    @staticmethod
    def _validate_order(
        mode: SimulationMode,
        values: Mapping[PercentileKey, int],
    ) -> None:
        ordered_values = [values[key] for key in _PERCENTILE_KEYS if key in values]
        pairs = zip(ordered_values, ordered_values[1:])
        valid = (
            all(left <= right for left, right in pairs)
            if mode == "backlog_to_weeks"
            else all(left >= right for left, right in pairs)
        )
        if not valid:
            expected = "croissant" if mode == "backlog_to_weeks" else "decroissant"
            raise StatisticalValueError(
                f"result_percentiles doit respecter l'ordre {expected} du mode."
            )

    @overload
    def __getitem__(self, key: PercentileKey) -> int: ...

    @overload
    def __getitem__(self, key: str) -> int: ...

    def __getitem__(self, key: str) -> int:
        return dict(self._items)[key]

    def __iter__(self) -> Iterator[PercentileKey]:
        return (key for key, _value in self._items)

    def __len__(self) -> int:
        return len(self._items)

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Mapping):
            return dict(self._items) == dict(other)
        return False

    def to_dict(self) -> dict[str, int]:
        return dict(self._items)

    @property
    def risk_score(self) -> float | None:
        p50 = self.get("P50")
        p90 = self.get("P90")
        if p50 is None or p90 is None or p50 <= 0:
            return None
        numerator = p50 - p90 if self.mode == "weeks_to_items" else p90 - p50
        return round_positive_ratio_half_up(max(0, numerator), p50)


def _categorize_reliability(
    cv: float,
    iqr_ratio: float,
    slope_norm: float,
    samples_count: int,
    mean: float,
) -> ThroughputReliabilityLabel:
    if samples_count < 6 or mean <= 0 or cv >= 1.5 or slope_norm <= -0.15:
        return "non fiable"
    if cv >= 1 or iqr_ratio >= 1 or abs(slope_norm) >= 0.1:
        return "fragile"
    if cv >= 0.5 or iqr_ratio >= 0.5 or abs(slope_norm) >= 0.05:
        return "incertain"
    return "incertain" if samples_count < 8 else "fiable"


@dataclass(frozen=True, slots=True, init=False)
class ThroughputReliability:
    cv: float
    iqr_ratio: float
    slope_norm: float
    label: ThroughputReliabilityLabel
    samples_count: int

    @classmethod
    def create(
        cls,
        *,
        cv: object,
        iqr_ratio: object,
        slope_norm: object,
        samples_count: object,
        mean: object | None = None,
        label: object | None = None,
    ) -> ThroughputReliability:
        normalized_cv = round_half_up(_finite_metric(cv, "cv"))
        normalized_iqr = round_half_up(_finite_metric(iqr_ratio, "iqr_ratio"))
        normalized_slope = round_half_up(_finite_metric(slope_norm, "slope_norm"))
        if normalized_cv < 0 or normalized_iqr < 0:
            raise StatisticalValueError("cv et iqr_ratio doivent etre >= 0.")
        resolved_count = _strict_integer(samples_count, "samples_count")
        if resolved_count < 0:
            raise StatisticalValueError("samples_count doit etre >= 0.")

        if mean is not None:
            resolved_mean = _finite_metric(mean, "mean")
            resolved_label = _categorize_reliability(
                normalized_cv,
                normalized_iqr,
                normalized_slope,
                resolved_count,
                resolved_mean,
            )
        else:
            if not isinstance(label, str) or label not in _RELIABILITY_LABELS:
                raise StatisticalValueError("label de fiabilite invalide.")
            resolved_label = label

        instance = object.__new__(cls)
        object.__setattr__(instance, "cv", normalized_cv)
        object.__setattr__(instance, "iqr_ratio", normalized_iqr)
        object.__setattr__(instance, "slope_norm", normalized_slope)
        object.__setattr__(instance, "label", resolved_label)
        object.__setattr__(instance, "samples_count", resolved_count)
        return instance


@dataclass(frozen=True, slots=True, init=False)
class HistogramBucket:
    x: int
    count: int

    @classmethod
    def create(cls, x: object, count: object) -> HistogramBucket:
        resolved_x = _strict_integer(x, "histogram.x")
        resolved_count = _strict_integer(count, "histogram.count")
        if resolved_count <= 0:
            raise StatisticalValueError("histogram.count doit etre strictement positif.")
        instance = object.__new__(cls)
        object.__setattr__(instance, "x", resolved_x)
        object.__setattr__(instance, "count", resolved_count)
        return instance


@dataclass(frozen=True, slots=True, init=False)
class Histogram(Sequence[HistogramBucket]):
    buckets: tuple[HistogramBucket, ...]

    @classmethod
    def create(
        cls,
        buckets: Iterable[Mapping[str, object] | HistogramBucket],
        *,
        expected_mass: int,
    ) -> Histogram:
        mass = _strict_integer(expected_mass, "histogram.expected_mass")
        if mass < 0:
            raise StatisticalValueError("histogram.expected_mass doit etre >= 0.")
        resolved = tuple(
            bucket
            if isinstance(bucket, HistogramBucket)
            else HistogramBucket.create(bucket.get("x"), bucket.get("count"))
            for bucket in buckets
        )
        if len(resolved) > 100:
            raise StatisticalValueError("histogram doit contenir au plus 100 buckets.")
        if any(left.x >= right.x for left, right in zip(resolved, resolved[1:])):
            raise StatisticalValueError(
                "histogram.x doit etre strictement croissant et sans doublon."
            )
        if sum(bucket.count for bucket in resolved) != mass:
            raise StatisticalValueError("histogram doit conserver sa masse totale.")
        instance = object.__new__(cls)
        object.__setattr__(instance, "buckets", resolved)
        return instance

    @overload
    def __getitem__(self, index: int) -> HistogramBucket: ...

    @overload
    def __getitem__(self, index: slice) -> tuple[HistogramBucket, ...]: ...

    def __getitem__(self, index: int | slice) -> HistogramBucket | tuple[HistogramBucket, ...]:
        return self.buckets[index]

    def __len__(self) -> int:
        return len(self.buckets)


@dataclass(frozen=True, slots=True, init=False)
class CompletionSummary:
    completed_count: int
    censored_count: int
    censored_rate: float
    horizon_weeks: int

    @classmethod
    def create(
        cls,
        *,
        completed_count: object,
        censored_count: object,
        n_sims: SimulationCount,
        horizon_weeks: object = SIMULATION_HORIZON_WEEKS_MAX,
    ) -> CompletionSummary:
        if not isinstance(n_sims, SimulationCount):
            raise StatisticalValueError("n_sims doit etre un Value Object.")
        completed = _strict_integer(completed_count, "completed_count")
        censored = _strict_integer(censored_count, "censored_count")
        if completed < 0 or censored < 0:
            raise StatisticalValueError("Les comptes de completion doivent etre >= 0.")
        if completed + censored != n_sims.value:
            raise StatisticalValueError("completed_count + censored_count doit etre egal a n_sims.")
        horizon = _strict_integer(horizon_weeks, "horizon_weeks")
        if horizon != SIMULATION_HORIZON_WEEKS_MAX:
            raise StatisticalValueError("horizon_weeks doit etre egal a 521 pour le contrat 1.0.")
        rate = round_half_up(censored / n_sims.value)
        instance = object.__new__(cls)
        object.__setattr__(instance, "completed_count", completed)
        object.__setattr__(instance, "censored_count", censored)
        object.__setattr__(instance, "censored_rate", rate)
        object.__setattr__(instance, "horizon_weeks", horizon)
        return instance
