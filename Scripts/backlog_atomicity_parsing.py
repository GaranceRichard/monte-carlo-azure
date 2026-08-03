"""Parse the backlog registry, readiness authority and atomic contracts."""

from __future__ import annotations

import re

from Scripts.backlog_atomicity_model import (
    FEATURE_RE,
    FIELD_RE,
    KNOWN_SIZES,
    PBI_HEADING_RE,
    Diagnostic,
    Feature,
    Pbi,
    Section,
    diagnostic,
)


def _registry_pbis(
    body: str, number: int, known: dict[str, Pbi]
) -> tuple[list[Pbi], list[Diagnostic]]:
    pbis: list[Pbi] = []
    errors: list[Diagnostic] = []
    for line in body.splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 5 or not re.fullmatch(r"\d+\.\d+", cells[0]):
            continue
        identifier, title, size, _model, completed = cells
        pbi = Pbi(identifier, title, size, completed, number)
        if identifier in known:
            errors.append(
                diagnostic(
                    number,
                    identifier,
                    "Identifiant",
                    identifier,
                    "identifiant dupliqué",
                    "utiliser un identifiant unique",
                )
            )
        elif not identifier.startswith(f"{number}."):
            errors.append(
                diagnostic(
                    number,
                    identifier,
                    "Identifiant",
                    identifier,
                    "identifiant hors Feature",
                    f"utiliser un identifiant {number}.N",
                )
            )
        else:
            known[identifier] = pbi
        if size not in KNOWN_SIZES:
            errors.append(
                diagnostic(
                    number,
                    identifier,
                    "Complexité",
                    size,
                    "complexité non reconnue",
                    "utiliser XXS, XS, S, M, L ou XL",
                )
            )
        pbis.append(pbi)
    return pbis, errors


def parse_registry(content: str) -> tuple[dict[int, Feature], dict[str, Pbi], list[Diagnostic]]:
    prefix = content.split("# Synthèse du backlog", maxsplit=1)[0]
    headings = list(FEATURE_RE.finditer(prefix))
    features: dict[int, Feature] = {}
    by_id: dict[str, Pbi] = {}
    errors: list[Diagnostic] = []
    for index, heading in enumerate(headings):
        number = int(heading.group("number"))
        end = headings[index + 1].start() if index + 1 < len(headings) else len(prefix)
        pbis, current = _registry_pbis(prefix[heading.end() : end], number, by_id)
        features[number] = Feature(number, heading.group("title"), tuple(pbis))
        errors.extend(current)
    if not headings:
        errors.append(
            diagnostic(
                "Dépôt",
                "aucun",
                "Registre",
                "absent",
                "registre sans Feature",
                "ajouter au moins une Feature et ses PBI",
            )
        )
    return features, by_id, errors


def _section_body(content: str, heading: re.Match[str]) -> str:
    level = len(heading.group("marks"))
    tail = content[heading.end() :]
    candidates = re.finditer(r"^(?P<marks>#{1,6}) .+$", tail, re.MULTILINE)
    boundary = next(
        (candidate.start() for candidate in candidates if len(candidate.group("marks")) <= level),
        len(tail),
    )
    return tail[:boundary]


def _document_sections(source: str, content: str) -> tuple[list[Section], list[Diagnostic]]:
    feature_match = re.search(r"^# Feature (\d+) —", content, re.MULTILINE)
    declared_feature = int(feature_match.group(1)) if feature_match else None
    sections = []
    for heading in PBI_HEADING_RE.finditer(content):
        values: dict[str, list[str]] = {}
        for field in FIELD_RE.finditer(_section_body(content, heading)):
            values.setdefault(field.group("name"), []).append(field.group("value").strip())
        sections.append(
            Section(
                heading.group("identifier"),
                declared_feature,
                len(heading.group("marks")),
                {name: tuple(items) for name, items in values.items()},
                source,
            )
        )
    return sections, []


def parse_expectations(documents: dict[str, str]) -> tuple[dict[str, Section], list[Diagnostic]]:
    sections: dict[str, Section] = {}
    errors: list[Diagnostic] = []
    for source, content in sorted(documents.items()):
        parsed, _ = _document_sections(source, content)
        for section in parsed:
            if section.identifier in sections:
                errors.append(
                    diagnostic(
                        section.identifier.split(".")[0],
                        section.identifier,
                        "Section d’attendus",
                        source,
                        "section dupliquée",
                        "conserver une seule section d’attendus",
                    )
                )
            else:
                sections[section.identifier] = section
    return sections, errors


def markdown_table(content: str, heading: str) -> tuple[list[str], list[list[str]]] | None:
    marker = re.search(rf"^{re.escape(heading)}\s*$", content, re.MULTILINE)
    if not marker:
        return None
    table_lines = []
    for line in content[marker.end() :].splitlines():
        if line.strip().startswith("|"):
            table_lines.append(line)
        elif table_lines and line.strip():
            break
    if len(table_lines) < 2:
        return [], []

    def split(line: str) -> list[str]:
        return [cell.strip() for cell in line.strip().strip("|").split("|")]

    return split(table_lines[0]), [split(line) for line in table_lines[2:]]


def _priority(governance: str) -> tuple[int | None, list[Diagnostic]]:
    values = re.findall(r"^Feature prioritaire : (\d+)\s*$", governance, re.MULTILINE)
    priority = int(values[0]) if len(values) == 1 else None
    errors = (
        []
        if priority
        else [
            diagnostic(
                "Dépôt",
                "aucun",
                "Feature prioritaire",
                values,
                "autorité prioritaire absente ou dupliquée",
                "déclarer exactement une ligne `Feature prioritaire : N`",
            )
        ]
    )
    return priority, errors


def parse_readiness(governance: str) -> tuple[int | None, dict[int, str], list[Diagnostic]]:
    priority, errors = _priority(governance)
    table = markdown_table(governance, "## Registre de préparation des Features")
    if table is None:
        return (
            priority,
            {},
            errors
            + [
                diagnostic(
                    "Dépôt",
                    "aucun",
                    "Registre de préparation",
                    "absent",
                    "registre de préparation absent",
                    "ajouter la table des statuts de préparation",
                )
            ],
        )
    headers, rows = table
    if headers != ["Feature", "Statut de préparation"]:
        errors.append(
            diagnostic(
                "Dépôt",
                "aucun",
                "Registre de préparation",
                headers,
                "en-tête invalide",
                "utiliser `Feature | Statut de préparation`",
            )
        )
        return priority, {}, errors
    statuses: dict[int, str] = {}
    for row in rows:
        if len(row) != 2 or not row[0].isdigit():
            continue
        number = int(row[0])
        if number in statuses:
            errors.append(
                diagnostic(
                    number,
                    "aucun",
                    "Statut de préparation",
                    row[1],
                    "statut dupliqué",
                    "conserver un seul statut",
                )
            )
        statuses[number] = row[1]
    return priority, statuses, errors
