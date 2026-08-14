"""Markdown projection for the observed dependency graph."""

from __future__ import annotations

from typing import Any


def _table(headers: list[str], rows: list[list[Any]]) -> list[str]:
    return [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
        *("| " + " | ".join(str(cell) for cell in row) + " |" for row in rows),
    ]


def _summary_section(report: dict[str, Any]) -> list[str]:
    summary = report["summary"]
    lines = [
        "# Graphe factuel des dépendances",
        "",
        "> Généré par `Scripts/report_dependency_graph.py` ; ne pas éditer manuellement.",
        "",
        "## Portée et reproduction",
        "",
        (
            "Le graphe part des fichiers visibles par Git, exclut les tests et sépare les "
            "imports runtime des imports TypeScript de type. Il observe le code produit "
            "(`backend`, `frontend/src`, `run_app.py`) et l’infrastructure exécutable "
            "(`Scripts`, `frontend/scripts`)."
        ),
        "",
        "```powershell",
        r".\.venv\Scripts\python.exe Scripts/report_dependency_graph.py",
        r".\.venv\Scripts\python.exe Scripts/report_dependency_graph.py --check",
        "```",
        "",
        "## Observations",
        "",
    ]
    keys = (
        "sourceModules",
        "importEdges",
        "entrypoints",
        "missingEntrypoints",
        "cycles",
        "runtimeCycles",
        "deepImports",
        "apiBypasses",
    )
    return lines + _table(
        [
            "Modules",
            "Arêtes",
            "Points d’entrée",
            "Entrées non résolues",
            "Cycles",
            "Cycles runtime",
            "Imports profonds",
            "Contournements conventionnels",
        ],
        [[summary[key] for key in keys]],
    )


def _observed_details(report: dict[str, Any]) -> list[str]:
    lines = ["", "### Directions observées", ""] + _table(
        ["Source", "Cible", "Phase", "Arêtes"],
        [
            [item["sourceArea"], item["targetArea"], item["phase"], item["count"]]
            for item in report["observed"]["directions"]
        ],
    )
    lines += ["", "### Cycles localisés", ""]
    for cycle in report["observed"]["cycles"]:
        lines += [
            f"#### {cycle['id']} — {cycle['phase']}",
            "",
            " → ".join([*cycle["nodes"], cycle["nodes"][0]]),
            "",
        ]
        lines += _table(
            ["Source", "Cible", "Ligne", "Phase"],
            [
                [edge["source"], edge["target"], edge["line"], edge["phase"]]
                for edge in cycle["edges"]
            ],
        ) + [""]
    return (
        lines
        + ["### Points d’entrée", ""]
        + _table(
            ["Déclaré dans", "Ligne", "Nature", "Cible", "Résolution"],
            [
                [item["declaredIn"], item["line"], item["kind"], item["target"], item["resolution"]]
                for item in report["observed"]["entrypoints"]
            ],
        )
    )


def _interpretation_section(report: dict[str, Any]) -> list[str]:
    lines = [
        "",
        "## Interprétation architecturale (non normative)",
        "",
        report["interpretation"]["rule"],
        "",
        (
            "Ces listes signalent des surfaces à examiner ; elles ne déclarent ni dépendance "
            "autorisée/interdite ni correction à réaliser."
        ),
        "",
        "### Contournements conventionnels",
        "",
    ]
    bypasses = report["interpretation"]["apiBypasses"]
    lines += (
        _table(
            ["Source", "Cible", "Ligne", "Phase", "Façade contournée"],
            [
                [item["source"], item["target"], item["line"], item["phase"], item["facade"]]
                for item in bypasses
            ],
        )
        if bypasses
        else ["Aucun selon la convention reproductible retenue."]
    )
    lines += ["", "### Imports profonds", ""] + _table(
        ["Source", "Cible", "Ligne", "Phase", "Frontière traversée"],
        [
            [
                item["source"],
                item["target"],
                item["line"],
                item["phase"],
                item["crossedBoundary"],
            ]
            for item in report["interpretation"]["deepImports"]
        ],
    )
    return (
        lines
        + ["", "### Limites", ""]
        + [f"- {limit}" for limit in report["interpretation"]["limits"]]
    )


def render_markdown(report: dict[str, Any]) -> str:
    lines = _summary_section(report)
    lines += _observed_details(report)
    lines += _interpretation_section(report)
    return "\n".join(lines) + "\n"
