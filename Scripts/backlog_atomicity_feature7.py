"""Recalculate Feature 7 counters and its concise human audit attestation."""

from __future__ import annotations

import re

from Scripts.backlog_atomicity_model import (
    COMPLIANT,
    TASK_TITLE_RE,
    Diagnostic,
    Feature,
    diagnostic,
)

ATTESTATION_HEADING = "## Attestation synthétique de conformité"
M_JUSTIFICATIONS_HEADING = "### Justifications des PBI `M`"
EXCEPTIONS_HEADING = "### Exceptions"


def _expected_summary(
    feature: Feature,
    cycles: list[tuple[str, ...]],
    invalid_contracts: set[str],
) -> dict[str, int | str]:
    sizes = {
        size: sum(pbi.size == size for pbi in feature.pbis)
        for size in ["XXS", "XS", "S", "M", "L", "XL"]
    }
    return {
        "Statut": COMPLIANT,
        "PBI total": len(feature.pbis),
        **{f"PBI {size}": count for size, count in sizes.items()},
        "PBI sans attendus": len(invalid_contracts),
        "Cycles de précédence": len(cycles),
    }


def _count_range_errors(content: str, count: int) -> list[Diagnostic]:
    if count > 90:
        return [
            diagnostic(
                7,
                "tous",
                "PBI total",
                count,
                "Feature 7 surfragmentée",
                "regrouper les étapes par outcomes pour rester à 90 PBI au maximum",
            )
        ]
    if count < 55 and not re.search(r"^Revue sous seuil : .+", content, re.MULTILINE):
        return [
            diagnostic(
                7,
                "tous",
                "PBI total",
                count,
                "revue de concentration sous le seuil absente",
                "démontrer qu’aucun PBI transversal comparable au 2.21 n’a été recréé",
            )
        ]
    return []


def _summary_errors(
    content: str,
    feature: Feature,
    cycles: list[tuple[str, ...]],
    invalid_contracts: set[str],
) -> list[Diagnostic]:
    errors = []
    for name, expected in _expected_summary(feature, cycles, invalid_contracts).items():
        observed = re.findall(rf"^{re.escape(name)} : (.+)$", content, re.MULTILINE)
        if observed != [str(expected)]:
            errors.append(
                diagnostic(
                    7,
                    "tous",
                    name,
                    observed,
                    "synthèse d’audit incohérente",
                    f"déclarer exactement `{name} : {expected}` après recalcul",
                )
            )
    return [*errors, *_count_range_errors(content, len(feature.pbis))]


def _heading_body(content: str, heading: str) -> str | None:
    marker = re.search(rf"^{re.escape(heading)}\s*$", content, re.MULTILINE)
    if not marker:
        return None
    level = len(heading) - len(heading.lstrip("#"))
    tail = content[marker.end() :]
    boundary = re.search(rf"^#{{1,{level}}} .+$", tail, re.MULTILINE)
    return tail[: boundary.start() if boundary else len(tail)].strip()


def _attestation_counter_errors(
    body: str,
    feature: Feature,
    cycles: list[tuple[str, ...]],
    invalid: set[str],
    future_predecessors: int,
) -> list[Diagnostic]:
    expected = {
        "PBI audités": len(feature.pbis),
        "Titres purement opératoires": sum(
            bool(TASK_TITLE_RE.fullmatch(pbi.title)) for pbi in feature.pbis
        ),
        "PBI `L` ou `XL`": sum(pbi.size in {"L", "XL"} for pbi in feature.pbis),
        "Cycles": len(cycles),
        "Prédécesseurs futurs": future_predecessors,
        "Exceptions": len(invalid),
    }
    errors = []
    for name, value in expected.items():
        observed = re.findall(
            rf"^- \*\*{re.escape(name)} :\*\* (.+)$", body, re.MULTILINE
        )
        if observed != [str(value)]:
            errors.append(
                diagnostic(
                    7,
                    "tous",
                    name,
                    observed,
                    "compteur de l’attestation incohérent",
                    f"déclarer exactement `- **{name} :** {value}` après recalcul",
                )
            )
    return errors


def _global_attestation_errors(body: str, count: int) -> list[Diagnostic]:
    expected = (
        f"Les {count} PBI de la Feature 7 ont été audités et sont conformes "
        "au standard de granularité"
    )
    if expected in " ".join(body.split()):
        return []
    return [
        diagnostic(
            7,
            "tous",
            "Attestation globale",
            "absente ou altérée",
            "conformité humaine globale non attestée",
            f"attester explicitement la conformité des {count} PBI",
        )
    ]


def _justification_rows(body: str) -> tuple[dict[str, tuple[str, str]], list[Diagnostic]]:
    rows: dict[str, tuple[str, str]] = {}
    errors = []
    pattern = re.compile(
        r"^- \*\*(?P<identifier>7\.\d+) — (?P<title>.+?) :\*\* (?P<text>.+)$",
        re.MULTILINE,
    )
    for match in pattern.finditer(body):
        identifier = match.group("identifier")
        if identifier in rows:
            errors.append(
                diagnostic(
                    7,
                    identifier,
                    "Justifications des PBI M",
                    identifier,
                    "justification synthétique dupliquée",
                    "conserver une seule justification synthétique par PBI M",
                )
            )
        else:
            rows[identifier] = (match.group("title"), match.group("text"))
    malformed = [
        line
        for line in body.splitlines()
        if line.startswith("- **") and not pattern.fullmatch(line)
    ]
    errors.extend(
        diagnostic(
            7,
            "inconnu",
            "Justifications des PBI M",
            line,
            "justification synthétique invalide",
            "utiliser `- **7.N — Titre :** Justification`",
        )
        for line in malformed
    )
    return rows, errors


def _expected_m_justification_errors(
    feature: Feature,
    rows: dict[str, tuple[str, str]],
    expected_justifications: dict[str, str],
) -> list[Diagnostic]:
    errors = []
    expected_pbis = {pbi.identifier: pbi for pbi in feature.pbis if pbi.size == "M"}
    for identifier, pbi in expected_pbis.items():
        row = rows.get(identifier)
        expected = expected_justifications.get(identifier, "")
        if row is None:
            errors.append(
                diagnostic(
                    7,
                    identifier,
                    "Justifications des PBI M",
                    "absente",
                    "PBI M absent de l’attestation",
                    "reprendre sa justification détaillée dans la synthèse",
                )
            )
        elif row[0] != pbi.title or row[1].casefold() != expected.casefold():
            errors.append(
                diagnostic(
                    7,
                    identifier,
                    "Justifications des PBI M",
                    row,
                    "justification synthétique incohérente",
                    "reprendre le titre et la justification détaillée du PBI M",
                )
            )
    return errors


def _orphan_m_justification_errors(
    feature: Feature, rows: dict[str, tuple[str, str]]
) -> list[Diagnostic]:
    expected_ids = {pbi.identifier for pbi in feature.pbis if pbi.size == "M"}
    return [
        diagnostic(
            7,
            identifier,
            "Justifications des PBI M",
            identifier,
            "justification synthétique orpheline",
            "supprimer la justification d’un PBI qui n’est pas de taille M",
        )
        for identifier in sorted(set(rows) - expected_ids)
    ]


def _m_justification_errors(
    content: str,
    feature: Feature,
    expected_justifications: dict[str, str],
) -> list[Diagnostic]:
    body = _heading_body(content, M_JUSTIFICATIONS_HEADING)
    if body is None:
        return [
            diagnostic(
                7,
                "tous",
                "Justifications des PBI M",
                "absentes",
                "synthèse des tailles M absente",
                "ajouter une justification synthétique pour chaque PBI M",
            )
        ]
    rows, errors = _justification_rows(body)
    return [
        *errors,
        *_expected_m_justification_errors(feature, rows, expected_justifications),
        *_orphan_m_justification_errors(feature, rows),
    ]


def _exceptions_errors(content: str, invalid: set[str]) -> list[Diagnostic]:
    body = _heading_body(content, EXCEPTIONS_HEADING)
    if body == "Aucune." and not invalid:
        return []
    return [
        diagnostic(
            7,
            "tous",
            "Exceptions",
            body if body is not None else "absente",
            "section d’exceptions incohérente",
            "corriger les écarts structurels puis déclarer exactement `Aucune.`",
        )
    ]


def _attestation_errors(
    content: str,
    feature: Feature,
    cycles: list[tuple[str, ...]],
    invalid: set[str],
    future_predecessors: int,
    m_justifications: dict[str, str],
) -> list[Diagnostic]:
    body = _heading_body(content, ATTESTATION_HEADING)
    if body is None:
        return [
            diagnostic(
                7,
                "tous",
                "Attestation synthétique de conformité",
                "absente",
                "preuve humaine synthétique absente",
                "ajouter l’attestation globale, ses compteurs, les PBI M et les exceptions",
            )
        ]
    return [
        *_global_attestation_errors(body, len(feature.pbis)),
        *_attestation_counter_errors(
            body, feature, cycles, invalid, future_predecessors
        ),
        *_m_justification_errors(content, feature, m_justifications),
        *_exceptions_errors(content, invalid),
    ]


def feature_seven_errors(
    content: str,
    feature: Feature,
    cycles: list[tuple[str, ...]],
    invalid_contracts: set[str],
    future_predecessors: int,
    m_justifications: dict[str, str],
) -> list[Diagnostic]:
    return [
        *_summary_errors(content, feature, cycles, invalid_contracts),
        *_attestation_errors(
            content,
            feature,
            cycles,
            invalid_contracts,
            future_predecessors,
            m_justifications,
        ),
    ]
