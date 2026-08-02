"""Canonical JSON and Markdown renderers for consolidated statistical evidence."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from Scripts.statistical_consolidated_io import canonical_bytes, sha256_bytes

FINGERPRINT_METHOD = "sha256-canonical-json-without-content-sha256"


def finalize_report(model: dict[str, Any]) -> dict[str, Any]:
    report = deepcopy(model)
    report["integrity"] = {"method": FINGERPRINT_METHOD}
    report["integrity"]["content_sha256"] = sha256_bytes(canonical_bytes(report))
    return report


def verify_report_fingerprint(report: dict[str, Any]) -> bool:
    candidate = deepcopy(report)
    integrity = candidate.get("integrity")
    if not isinstance(integrity, dict):
        return False
    observed = integrity.pop("content_sha256", None)
    return (
        integrity == {"method": FINGERPRINT_METHOD}
        and isinstance(observed, str)
        and observed == sha256_bytes(canonical_bytes(candidate))
    )


def render_json(report: dict[str, Any]) -> str:
    return json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _counter_text(level: dict[str, Any]) -> str:
    return ", ".join(f"{item['id']}={item['value']}" for item in level["counters"])


def _optional(value: Any) -> str:
    if value is None:
        return "non évalué"
    if isinstance(value, bool):
        return "oui" if value else "non"
    return str(value)


def _source_lines(report: dict[str, Any]) -> list[str]:
    lines = [
        "## Sources vérifiées",
        "",
        "| Source | Version déclarée | Validation | SHA-256 | Empreinte canonique |",
        "| --- | --- | --- | --- | --- |",
    ]
    for source in report["sources"]:
        fingerprint = source["canonical_fingerprint"] or "non fournie"
        lines.append(
            f"| `{source['id']}` | `{source['declared']['version']}` "
            f"| `{source['validation_status']}` | `{source['sha256'] or 'indisponible'}` "
            f"| `{fingerprint}` |"
        )
    return lines


def _proof_lines(report: dict[str, Any]) -> list[str]:
    lines = [
        "## Ce qui est démontré",
        "",
        "| Niveau de preuve | Statut | Source | Périmètre | Compteurs |",
        "| --- | --- | --- | --- | --- |",
    ]
    for level in report["proof_levels"]:
        lines.append(
            f"| `{level['id']}` | `{level['status']}` | `{level['source']}` "
            f"| {level['scope']} | {_counter_text(level)} |"
        )
    return lines


def _compatibility_lines(report: dict[str, Any]) -> list[str]:
    compatibility = report["compatibility"]
    summary = compatibility["summary"]
    return [
        "## Compatibilité statistique",
        "",
        f"- Statut : `{compatibility['status']}`.",
        f"- Autorité : `{compatibility['authority']['id']}` "
        f"version `{compatibility['authority']['version']}`.",
        "- Exécution directe et intégration au profil `main` : bloquantes.",
        f"- Composants conformes : {summary['matching_component_count']}/"
        f"{summary['component_count']}.",
        f"- Preuves conformes : {summary['matching_proof_count']}/{summary['proof_count']}.",
        f"- Diagnostics : {summary['diagnostic_count']}.",
    ]


def _case_lines(report: dict[str, Any]) -> list[str]:
    lines = [
        "## Cas normatifs et rejeu exact",
        "",
        "| Cas | Famille | Corpus / moteurs | Rejeu exact | Batch indépendant |",
        "| --- | --- | --- | --- | --- |",
    ]
    for case in report["scope_summary"]["normative_cases"]:
        lines.append(
            f"| `{case['id']}` | `{case['normative_family']}` "
            f"| `{case['algorithmic_status']}` | `{case['exact_replay_status']}` "
            f"| `{_optional(case['batch_independent'])}` |"
        )
    return lines


def _scenario_lines(report: dict[str, Any]) -> list[str]:
    lines = [
        "## Scénarios distributionnels",
        "",
        "| Scénario | Cas source | Cohorte | Simulations | Vue | Statut | Métriques |",
        "| --- | --- | ---: | ---: | --- | --- | --- |",
    ]
    for scenario in report["scope_summary"]["distribution_scenarios"]:
        metric_summary = (
            f"{scenario['matching_metrics']} match, "
            f"{scenario['divergent_metrics']} divergence, "
            f"{scenario['inconclusive_metrics']} non concluante"
        )
        lines.append(
            f"| `{scenario['id']}` | `{scenario['source_case_id']}` "
            f"| {scenario['cohort_size']} | {scenario['n_sims']} "
            f"| `{scenario['distribution_view']}` | `{scenario['status']}` "
            f"| {scenario['metric_count']} ({metric_summary}) |"
        )
    if not report["scope_summary"]["distribution_scenarios"]:
        lines.append("| _Aucun scénario exploitable_ | — | — | — | — | `non évalué` | — |")
    return lines


def _diagnostic_lines(report: dict[str, Any]) -> list[str]:
    lines = ["## Diagnostics structurés", ""]
    if not report["diagnostics"]:
        return [*lines, "Aucun diagnostic spécialisé ou d’intégrité."]
    lines.extend(
        [
            "| Classification | Source | Localisation | Message | Conséquence |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for diagnostic in report["diagnostics"]:
        location = (
            diagnostic.get("case_id")
            or diagnostic.get("scenario_id")
            or diagnostic.get("fixture_id")
            or diagnostic.get("json_path")
            or "/"
        )
        lines.append(
            f"| `{diagnostic['classification']}` | `{diagnostic['source']}` "
            f"| `{location}` | {diagnostic['message']} "
            f"| `{diagnostic['consequence']}` |"
        )
    return lines


def _limit_lines(report: dict[str, Any]) -> list[str]:
    lines = ["## Limites préservées et hors preuve", ""]
    for limit in report["limits"]:
        for statement in limit["statements"]:
            lines.append(f"- `{limit['proof_level']}` — {statement}")
    for item in report["not_evaluated"]:
        lines.append(f"- `{item['id']}` — {item['statement']}")
    return lines


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# État consolidé des garanties statistiques",
        "",
        f"- Verdict consolidé : `{report['verdict']['status']}`",
        "- Enforcement courant : `blocking_in_main` par la politique versionnée.",
        "- Contrat normatif : `STD-STAT-001` version `1.0`.",
        "- Corpus : `mca-statistical-reference-corpus` version `1.0`.",
        "- Protocole distributionnel : `mca-statistical-distributional-parity` version `1.0`.",
        f"- Empreinte du contenu : `{report['integrity']['content_sha256']}`.",
        f"- Empreinte des sources : `{report['generation']['source_set_sha256']}`.",
        "",
        "Le verdict applique la priorité documentée sans fusionner les niveaux de preuve. "
        "Un rejeu exact conforme n’annule donc ni un résultat distributionnel non concluant, "
        "ni une divergence ou une preuve invalide.",
        "",
        *_proof_lines(report),
        "",
        *_compatibility_lines(report),
        "",
        *_source_lines(report),
        "",
        *_case_lines(report),
        "",
        *_scenario_lines(report),
        "",
        *_diagnostic_lines(report),
        "",
        *_limit_lines(report),
        "",
        "## Interprétation",
        "",
        "Le rejeu exact porte uniquement sur le corpus et les versions déclarées. La preuve "
        "distributionnelle porte uniquement sur ses scénarios, cohorts, métriques, marges et "
        "puissance documentés ; elle ne devient jamais une preuve exacte. L’absence de divergence "
        "ne démontre pas "
        "une équivalence universelle.",
        "",
        "Ces preuves ne constituent pas un backtesting empirique Azure DevOps. Les dérives de "
        "version et décisions de compatibilité sont contrôlées par la preuve spécialisée ; "
        "le profil `main` bloque toute preuve obligatoire absente, invalide ou non conforme.",
    ]
    return "\n".join(lines) + "\n"


def write_reports(report: dict[str, Any], json_path: Path, markdown_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(render_json(report), encoding="utf-8", newline="\n")
    markdown_path.write_text(render_markdown(report), encoding="utf-8", newline="\n")
