#!/usr/bin/env python3
"""Publish a reproducible, descriptive baseline for representative change surfaces."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from change_cost_baseline_render import render_markdown
from report_dependency_graph import build_report as build_dependency_report

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "reports" / "change-cost-baseline.json"
DEFAULT_DOCUMENT = ROOT / "docs" / "change-cost-baseline.md"
LAYER_PATTERNS = (
    (r"^config/", "quality-contract"),
    (r"^Scripts/statistical_", "quality-statistical-proof"),
    (r"^Scripts/", "quality-orchestration"),
    (r"^backend/(?:api_|simulation_mappers\.py)", "backend-transport"),
    (r"^backend/(?:simulation_models|simulation_value_objects)\.py", "backend-domain"),
    (r"^backend/", "backend-engine"),
    (r"^frontend/src/api/", "frontend-transport"),
    (r"^frontend/src/domain/", "frontend-domain"),
    (r"^frontend/src/application/", "frontend-application"),
    (r"^frontend/src/hooks/", "frontend-application"),
    (r"^frontend/src/ado", "frontend-azure-adapter"),
    (r"^frontend/src/", "frontend-delivery-or-engine"),
)


def _scenario(
    identifier: str, title: str, justification: str, evidence: str, files: str
) -> dict[str, Any]:
    return {
        "id": identifier,
        "title": title,
        "justification": justification,
        "evidence": evidence.split(),
        "files": files.split(),
    }


SCENARIOS = (
    _scenario(
        "statistical-contract-evolution",
        "Faire évoluer le contrat statistique de simulation",
        "Le contrat POST /simulate traverse réellement transport, domaine et moteurs "
        "Python/TypeScript; "
        "sa preuve doit préserver les garanties statistiques interlangages.",
        "docs/frontend-responsibilities-map.md#simulation-déquipe "
        "docs/backend-responsibilities-map.md#flux-complet-de-post-simulate "
        "docs/statistical-compatibility.md",
        """backend/api_models.py backend/simulation_mappers.py backend/simulation_models.py
        backend/simulation_value_objects.py backend/simulation_service.py backend/mc_core.py
        frontend/src/api/simulationDtos.ts frontend/src/api/simulationMappers.ts
        frontend/src/domain/simulation.ts frontend/src/domain/simulationValueObjects.ts
        frontend/src/application/team-forecast/localTeamForecast.ts frontend/src/utils/simulation.ts
        Scripts/statistical_corpus_runner.py tests/test_api_models.py
        tests/test_simulation_mappers.py tests/test_simulation_service.py tests/test_mc_core.py
        tests/test_statistical_compatibility.py
        tests/test_statistical_corpus_runner.py frontend/src/api/simulationMappers.test.ts
        frontend/src/domain/simulationValueObjects.test.ts""",
    ),
    _scenario(
        "delivery-collection-policy",
        "Faire évoluer une règle de collecte et de calendrier delivery",
        "La collecte observée va de la cible Azure DevOps aux semaines et Cycle Time, puis "
        "aux hooks de "
        "simulation; elle représente un changement métier alimenté par un adaptateur externe.",
        "docs/frontend-responsibilities-map.md#collecte-et-transformations-delivery "
        "docs/dependency-graph.md",
        "frontend/src/adoClient.ts frontend/src/adoPlatform.ts frontend/src/date.ts "
        "frontend/src/utils/cycleTime.ts frontend/src/types.ts "
        "frontend/src/application/team-forecast/localTeamForecast.ts "
        "frontend/src/hooks/useSimulation.ts frontend/src/adoClient.test.ts "
        "frontend/src/adoPlatform.test.ts frontend/src/date.test.ts "
        "frontend/src/utils/cycleTime.test.ts",
    ),
    _scenario(
        "main-validation-profile",
        "Faire évoluer le profil de validation main sans réduire ses garanties",
        "La carte qualité montre que profil, planification, exécution et preuves sont séparés "
        "mais coordonnés "
        "par le même DAG; ce scénario mesure ce coût sans rationaliser la gate.",
        "docs/quality-infrastructure-responsibilities-map.md#quality-gates-modes-et-profils "
        "config/test-execution-profiles.json",
        """Scripts/quality_gate.py Scripts/quality_gate_plan.py Scripts/quality_gate_dag.py
        Scripts/test_execution_profiles.py Scripts/test_execution_profiles_validation.py
        Scripts/test_execution_profiles_graph.py config/test-execution-profiles.json
        tests/test_quality_gate.py tests/test_test_execution_profiles.py""",
    ),
)


def _is_test(path: str) -> bool:
    return path.startswith("tests/") or ".test." in path or ".spec." in path


def _layer(path: str) -> str:
    if _is_test(path):
        return "proof-tests"
    for pattern, layer in LAYER_PATTERNS:
        if re.match(pattern, path):
            return layer
    raise ValueError(f"No layer attribution for {path}")


def _line_count(root: Path, path: str) -> int:
    return len((root / path).read_text(encoding="utf-8-sig").splitlines())


def _percentile(values: list[int], fraction: float) -> int:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * fraction) - 1)]


def _dependency_facts(
    dependency_report: dict[str, Any],
) -> tuple[set[str], list[dict[str, Any]], Counter]:
    nodes = {item["path"] for item in dependency_report["observed"]["nodes"]}
    edges = [
        item
        for item in dependency_report["observed"]["edges"]
        if item["resolution"] == "internal" and item["target"] in nodes
    ]
    degrees = Counter()
    for edge in edges:
        degrees.update((edge["source"], edge["target"]))
    return nodes, edges, degrees


def _confirmed_hotspots(
    traversals: Counter, lines: dict[str, int], nodes: set[str], degrees: Counter
) -> tuple[list[dict[str, Any]], int, int]:
    degree_threshold = _percentile([degrees[path] for path in nodes], 0.75)
    line_threshold = _percentile(list(lines.values()), 0.75)
    hotspots = []
    for path in sorted(traversals):
        signals = {
            "repeatedTraversal": traversals[path] >= 2,
            "highCoupling": path in nodes and degrees[path] >= degree_threshold,
            "largeFile": lines[path] >= line_threshold,
        }
        if sum(signals.values()) >= 2:
            hotspots.append(
                {
                    "path": path,
                    "scenarioCount": traversals[path],
                    "dependencyDegree": degrees[path] if path in nodes else None,
                    "lineCount": lines[path],
                    "signals": signals,
                }
            )
    hotspots.sort(
        key=lambda item: (
            -item["scenarioCount"],
            -(item["dependencyDegree"] or 0),
            -item["lineCount"],
            item["path"],
        )
    )
    return hotspots, degree_threshold, line_threshold


def _measure_scenario(
    scenario: dict[str, Any],
    lines: dict[str, int],
    edges: list[dict[str, Any]],
    hotspots: list[dict[str, Any]],
) -> dict[str, Any]:
    surface = set(scenario["files"])
    internal = [e for e in edges if e["source"] in surface and e["target"] in surface]
    crossing = [e for e in edges if (e["source"] in surface) != (e["target"] in surface)]
    scenario_hotspots = [item["path"] for item in hotspots if item["path"] in surface]
    layers = sorted({_layer(path) for path in surface})
    metrics = {
        "fileCount": len(surface),
        "productionFileCount": sum(
            path.startswith(("backend/", "frontend/src/", "Scripts/")) and not _is_test(path)
            for path in surface
        ),
        "testFileCount": sum(_is_test(path) for path in surface),
        "lineCount": sum(lines[path] for path in surface),
        "layerCount": len(layers),
        "internalDependencyEdges": len(internal),
        "boundaryDependencyEdges": len(crossing),
        "confirmedHotspotCount": len(scenario_hotspots),
    }
    return {
        **scenario,
        "files": sorted(scenario["files"]),
        "metrics": metrics,
        "layers": layers,
        "confirmedHotspots": scenario_hotspots,
    }


def calculate_baseline(
    root: Path, dependency_report: dict[str, Any], scenarios: tuple[dict[str, Any], ...] = SCENARIOS
) -> dict[str, Any]:
    files = [path for scenario in scenarios for path in scenario["files"]]
    missing = sorted(path for path in set(files) if not (root / path).is_file())
    if missing:
        raise ValueError("Scenario files are missing: " + ", ".join(missing))
    nodes, edges, degrees = _dependency_facts(dependency_report)
    traversals = Counter(files)
    traversed = sorted(traversals)
    lines = {path: _line_count(root, path) for path in traversed}
    hotspots, degree_threshold, line_threshold = _confirmed_hotspots(
        traversals, lines, nodes, degrees
    )
    measured_scenarios = [_measure_scenario(item, lines, edges, hotspots) for item in scenarios]
    return {
        "schemaVersion": 1,
        "generatedBy": "Scripts/report_change_cost_baseline.py",
        "basis": {
            "dependencyGraphSchemaVersion": dependency_report["schemaVersion"],
            "scenarioCount": len(scenarios),
            "uniqueFileCount": len(traversed),
            "hotspotRule": "At least two of repeatedTraversal, highCoupling, largeFile.",
            "thresholds": {
                "repeatedTraversalMinimum": 2,
                "dependencyDegreeP75": degree_threshold,
                "traversedFileLinesP75": line_threshold,
            },
        },
        "scenarios": measured_scenarios,
        "confirmedHotspots": hotspots,
        "assumptionsAndLimits": [
            "Les surfaces sont des hypothèses de changement revues à partir des cartes "
            "7.1-7.4, pas des estimations issues de l'historique Git.",
            "Les lignes physiques et fichiers sont des proxys de portée; ils n'estiment ni "
            "le temps écoulé ni la difficulté cognitive.",
            "Les dépendances viennent du graphe statique, qui exclut les tests; les liens "
            "dynamiques ou portés uniquement par les données peuvent manquer.",
            "Un hotspot est relatif à ce dépôt et à ce protocole; il ne constitue pas à lui "
            "seul un défaut architectural.",
            "Après migration, conserver intention et règles; ne changer un chemin que si sa "
            "responsabilité bouge et expliciter la correspondance.",
        ],
    }


def build_report(root: Path = ROOT) -> dict[str, Any]:
    return calculate_baseline(root, build_dependency_report(root))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--document", type=Path, default=DEFAULT_DOCUMENT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    try:
        report = build_report(args.root.resolve())
        rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
        document = render_markdown(report)
        if args.check:
            stale = [
                path
                for path, expected in ((args.report, rendered), (args.document, document))
                if not path.is_file() or path.read_text(encoding="utf-8") != expected
            ]
            if stale:
                print(
                    "ERROR: change-cost baseline outputs are stale: " + ", ".join(map(str, stale)),
                    file=sys.stderr,
                )
                return 1
            print("Change-cost baseline outputs are reproducible and current.")
            return 0
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.document.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered, encoding="utf-8")
        args.document.write_text(document, encoding="utf-8")
    except (OSError, RuntimeError, ValueError, KeyError, TypeError) as exc:
        print(f"ERROR: change-cost baseline extraction failed: {exc}", file=sys.stderr)
        return 2
    print(f"Change-cost baseline written: {args.report} and {args.document}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
