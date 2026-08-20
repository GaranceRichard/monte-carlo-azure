"""Markdown projection for the change-cost baseline."""

from __future__ import annotations

from typing import Any

SCENARIO_COLUMNS = (
    "Fichiers",
    "Production",
    "Tests",
    "Lignes",
    "Couches",
    "Arêtes internes",
    "Arêtes de frontière",
    "Hotspots",
)
METRIC_KEYS = (
    "fileCount",
    "productionFileCount",
    "testFileCount",
    "lineCount",
    "layerCount",
    "internalDependencyEdges",
    "boundaryDependencyEdges",
    "confirmedHotspotCount",
)


def _scenario_lines(scenario: dict[str, Any]) -> list[str]:
    metrics = scenario["metrics"]
    return [
        f"### {scenario['title']}",
        "",
        scenario["justification"],
        "",
        "Sources : " + ", ".join(f"`{item}`" for item in scenario["evidence"]) + ".",
        "",
        "| " + " | ".join(SCENARIO_COLUMNS) + " |",
        "| " + " | ".join("---:" for _column in SCENARIO_COLUMNS) + " |",
        "| " + " | ".join(str(metrics[key]) for key in METRIC_KEYS) + " |",
        "",
        "Couches : " + ", ".join(f"`{item}`" for item in scenario["layers"]) + ".",
        "",
        "Fichiers : " + ", ".join(f"`{item}`" for item in scenario["files"]) + ".",
        "",
    ]


def _hotspot_lines(hotspots: list[dict[str, Any]]) -> list[str]:
    if not hotspots:
        return ["Aucun fichier ne satisfait la règle de confirmation."]
    lines = [
        "| Fichier | Scénarios | Degré | Lignes | Signaux |",
        "| --- | ---: | ---: | ---: | --- |",
    ]
    for item in hotspots:
        signals = ", ".join(key for key, enabled in item["signals"].items() if enabled)
        degree = "n/a" if item["dependencyDegree"] is None else item["dependencyDegree"]
        lines.append(
            f"| `{item['path']}` | {item['scenarioCount']} | {degree} | "
            f"{item['lineCount']} | {signals} |"
        )
    return lines


def render_markdown(report: dict[str, Any]) -> str:
    basis = report["basis"]
    lines = [
        "# Baseline du coût de changement et de ses hotspots",
        "",
        "> Générée par `Scripts/report_change_cost_baseline.py` ; ne pas éditer manuellement.",
        "",
        "## Protocole reproductible",
        "",
        "```powershell",
        r".\.venv\Scripts\python.exe Scripts/report_change_cost_baseline.py",
        r".\.venv\Scripts\python.exe Scripts/report_change_cost_baseline.py --check",
        "```",
        "",
        "Le premier appel recalcule la preuve JSON et cette projection depuis les fichiers "
        "courants et le graphe factuel 7.4. Le second exige une égalité octet pour octet. "
        "Pour la comparaison post-migration, conserver l'intention et les règles, ne modifier "
        "que les chemins dont la responsabilité a réellement bougé, documenter cette "
        "correspondance, puis comparer les mêmes métriques au rapport de référence.",
        "",
        "## Règle de mesure",
        "",
        f"La baseline couvre {basis['scenarioCount']} scénarios et "
        f"{basis['uniqueFileCount']} fichiers uniques. "
        "Un hotspot n'est confirmé que par au moins deux signaux : présence dans au moins "
        f"{basis['thresholds']['repeatedTraversalMinimum']} scénarios, degré de dépendance "
        "supérieur ou égal "
        f"au P75 ({basis['thresholds']['dependencyDegreeP75']}) ou taille supérieure ou "
        "égale au P75 des "
        f"fichiers traversés ({basis['thresholds']['traversedFileLinesP75']} lignes).",
        "",
        "Les métriques sont : fichiers et lignes physiques traversés (portée), fichiers de "
        "production et de test (nature du coût), couches distinctes (frontières), arêtes "
        "internes (cohésion statique), arêtes "
        "entrant ou sortant de la surface (couplage externe) et hotspots confirmés.",
        "",
        "## Scénarios représentatifs",
        "",
    ]
    for scenario in report["scenarios"]:
        lines.extend(_scenario_lines(scenario))
    lines.extend(["## Hotspots confirmés par les données", ""])
    lines.extend(_hotspot_lines(report["confirmedHotspots"]))
    lines.extend(["", "## Hypothèses et limites", ""])
    lines.extend(f"- {item}" for item in report["assumptionsAndLimits"])
    return "\n".join(lines) + "\n"
