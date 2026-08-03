#!/usr/bin/env python3
"""Generate and check backlog summaries from the authoritative PBI register."""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BACKLOG = ROOT / "docs" / "backlog.md"
DEFAULT_GOVERNANCE = ROOT / "docs" / "backlog-governance.md"
BACKLOG_SUMMARY_MARKER = "# Synthèse du backlog"
GOVERNANCE_DISTRIBUTION_MARKER = "## Répartition actuelle des"
FEATURE_RE = re.compile(r"^## Feature (?P<number>\d+) — (?P<title>.+)$")
FEATURE_PRIORITY_RE = re.compile(r"^Feature prioritaire : (?P<number>\d+)$", re.MULTILINE)
PBI_RE = re.compile(
    r"^\| (?P<identifier>\d+\.\d+) \| (?P<title>.+?) \| "
    r"(?P<complexity>[SMLX]+) \| (?P<model>.+?) \|(?P<completed>.*?)\|$"
)
MODEL_ORDER = ("Sol Medium", "Sol Élevé", "Sol Très élevé", "Sol Ultra")


@dataclass(frozen=True)
class Pbi:
    identifier: str
    title: str
    model: str
    completed_on: str

    @property
    def completed(self) -> bool:
        return bool(self.completed_on)


@dataclass(frozen=True)
class Feature:
    number: int
    title: str
    pbis: tuple[Pbi, ...]

    @property
    def completed_count(self) -> int:
        return sum(pbi.completed for pbi in self.pbis)


def _registry_prefix(content: str) -> str:
    if BACKLOG_SUMMARY_MARKER not in content:
        raise ValueError(f"Missing backlog marker: {BACKLOG_SUMMARY_MARKER}")
    return content.split(BACKLOG_SUMMARY_MARKER, maxsplit=1)[0].rstrip()


def parse_registry(content: str) -> tuple[Feature, ...]:
    features: list[Feature] = []
    feature_number: int | None = None
    feature_title = ""
    pbis: list[Pbi] = []
    identifiers: set[str] = set()

    def append_feature() -> None:
        if feature_number is not None:
            if not pbis:
                raise ValueError(f"Feature {feature_number} has no PBI.")
            features.append(Feature(feature_number, feature_title, tuple(pbis)))

    for line in _registry_prefix(content).splitlines():
        feature_match = FEATURE_RE.match(line)
        if feature_match:
            append_feature()
            feature_number = int(feature_match.group("number"))
            feature_title = feature_match.group("title")
            pbis = []
            continue
        pbi_match = PBI_RE.match(line)
        if not pbi_match:
            continue
        if feature_number is None:
            raise ValueError("A PBI row appears before its Feature heading.")
        identifier = pbi_match.group("identifier")
        if identifier in identifiers or not identifier.startswith(f"{feature_number}."):
            raise ValueError(f"Invalid or duplicate PBI identifier: {identifier}")
        completed_on = pbi_match.group("completed").strip()
        if completed_on:
            try:
                datetime.strptime(completed_on, "%d/%m/%Y")
            except ValueError as exc:
                raise ValueError(f"Invalid completion date for PBI {identifier}.") from exc
        identifiers.add(identifier)
        pbis.append(
            Pbi(
                identifier,
                pbi_match.group("title"),
                pbi_match.group("model"),
                completed_on,
            )
        )
    append_feature()
    if not features:
        raise ValueError("The backlog register contains no Feature.")
    return tuple(features)


def _percentage(completed: int, total: int) -> str:
    value = f"{completed * 100 / total:.2f}".rstrip("0").rstrip(".")
    return value.replace(".", ",")


def _current_feature(
    features: tuple[Feature, ...], priority_number: int | None = None
) -> Feature | None:
    partial = next(
        (feature for feature in features if 0 < feature.completed_count < len(feature.pbis)),
        None,
    )
    if partial is not None:
        return partial
    if priority_number is None:
        return None
    return next(
        (
            feature
            for feature in features
            if feature.number == priority_number and feature.completed_count < len(feature.pbis)
        ),
        None,
    )


def feature_priority(governance: str, features: tuple[Feature, ...]) -> int:
    matches = tuple(FEATURE_PRIORITY_RE.finditer(governance))
    if len(matches) != 1:
        raise ValueError("Governance must declare exactly one 'Feature prioritaire : N' authority.")
    number = int(matches[0].group("number"))
    if all(feature.number != number for feature in features):
        raise ValueError(f"Priority references an unknown Feature: {number}")
    return number


def _status_rows(
    features: tuple[Feature, ...], priority_number: int | None = None
) -> list[str]:
    current = _current_feature(features, priority_number)
    completed = [
        feature for feature in features if feature.completed_count == len(feature.pbis)
    ]
    latest = max(completed, key=lambda feature: feature.number)
    latest_row = (
        f"**Dernière Feature terminée :** Feature {latest.number} — {latest.title} — "
        f"{len(latest.pbis)}/{len(latest.pbis)} PBI réalisés (100 %)."
    )
    if current is None:
        return [
            "**Feature en cours :** aucune Feature partiellement réalisée.",
            "**Prochain PBI :** à prioriser selon la gouvernance du backlog.",
            latest_row,
        ]
    open_current = tuple(pbi for pbi in current.pbis if not pbi.completed)
    next_pbi = open_current[0]
    rows = [
        (
            f"**Feature en cours :** Feature {current.number} — {current.title} — "
            f"{current.completed_count}/{len(current.pbis)} PBI réalisés "
            f"({_percentage(current.completed_count, len(current.pbis))} %)."
        ),
        f"**Prochain PBI :** {next_pbi.identifier} — {next_pbi.title} — non commencé.",
        latest_row,
    ]
    if current.completed_count:
        rows.append(
            f"**Reliquats de la Feature {current.number} :** "
            + ", ".join(f"`{pbi.identifier}`" for pbi in open_current)
            + "."
        )
    return rows


def render_backlog_summary(
    features: tuple[Feature, ...], priority_number: int | None = None
) -> str:
    total = sum(len(feature.pbis) for feature in features)
    completed = sum(feature.completed_count for feature in features)
    rows = [
        BACKLOG_SUMMARY_MARKER,
        "",
        *_status_rows(features, priority_number),
        (
            f"**Progression globale :** {completed}/{total} PBI réalisés "
            f"({_percentage(completed, total)} %) ; {total - completed} restants."
        ),
        "",
        "| Feature | Nombre de PBI | Réalisés | Restants |",
        "| ---: | ---: | :---: | :---: |",
    ]
    rows.extend(
        f"| {feature.number} — {feature.title} | {len(feature.pbis)} | "
        f"{feature.completed_count} | {len(feature.pbis) - feature.completed_count} |"
        for feature in features
    )
    rows.extend(
        [
            f"| **Total** | **{total}** | **{completed}** | **{total - completed}** |",
            "",
            "Aucun PBI n’est classé XL.",
            "",
            "Les sujets conditionnels non numérotés ne sont pas inclus dans le total.",
        ]
    )
    return "\n".join(rows)


def render_governance_distribution(features: tuple[Feature, ...]) -> str:
    open_pbis = [pbi for feature in features for pbi in feature.pbis if not pbi.completed]
    counts = Counter(pbi.model for pbi in open_pbis)
    rows = [
        f"## Répartition actuelle des {len(open_pbis)} PBI non réalisés",
        "",
        "| Modèle Codex | Nombre de PBI |",
        "| --- | ---: |",
    ]
    rows.extend(f"| {model} | {counts[model]} |" for model in MODEL_ORDER)
    rows.append(f"| **Total** | **{len(open_pbis)}** |")
    return "\n".join(rows)


def _replace_suffix(content: str, marker: str, generated: str) -> str:
    if marker not in content:
        raise ValueError(f"Missing generated-section marker: {marker}")
    return content.split(marker, maxsplit=1)[0].rstrip() + "\n\n" + generated + "\n"


def expected_documents(backlog: str, governance: str) -> tuple[str, str]:
    features = parse_registry(backlog)
    priority_number = feature_priority(governance, features)
    return (
        _replace_suffix(
            backlog,
            BACKLOG_SUMMARY_MARKER,
            render_backlog_summary(features, priority_number),
        ),
        _replace_suffix(
            governance,
            GOVERNANCE_DISTRIBUTION_MARKER,
            render_governance_distribution(features),
        ),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backlog", type=Path, default=DEFAULT_BACKLOG)
    parser.add_argument("--governance", type=Path, default=DEFAULT_GOVERNANCE)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args(argv)
    try:
        backlog = args.backlog.read_text(encoding="utf-8")
        governance = args.governance.read_text(encoding="utf-8")
        expected_backlog, expected_governance = expected_documents(backlog, governance)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"ERROR: backlog consistency check could not run: {exc}", file=sys.stderr)
        return 2
    if args.write:
        args.backlog.write_text(expected_backlog, encoding="utf-8")
        args.governance.write_text(expected_governance, encoding="utf-8")
        print("Backlog summaries regenerated.")
        return 0
    drifted = []
    if backlog != expected_backlog:
        drifted.append(args.backlog)
    if governance != expected_governance:
        drifted.append(args.governance)
    if drifted:
        print(
            "ERROR: generated backlog documentation is stale: "
            + ", ".join(str(path) for path in drifted),
            file=sys.stderr,
        )
        return 1
    print("Backlog consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
