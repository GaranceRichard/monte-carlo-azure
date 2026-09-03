from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import check_backlog_consistency  # noqa: E402


def _source_backlog() -> str:
    return """# Registre du backlog

## Feature 1 — Première
| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| 1.1 | Fini | M | Sol Medium | 28/07/2026 |

## Feature 2 — Courante
| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| 2.1 | Fini aussi | M | Sol Élevé | 28/07/2026 |
| 2.2 | Ensuite | M | Sol Très élevé | |
| 2.3 | Enfin | L | Sol Ultra | |

# Synthèse du backlog
stale
"""


def _source_governance() -> str:
    return """# Gouvernance

Feature prioritaire : 2

## Répartition actuelle des 99 PBI non réalisés
stale
"""


def test_repository_backlog_status_and_generated_sections_are_exact() -> None:
    backlog = (ROOT / "docs" / "backlog.md").read_text(encoding="utf-8")
    governance = (ROOT / "docs" / "backlog-governance.md").read_text(encoding="utf-8")
    features = check_backlog_consistency.parse_registry(backlog)

    assert sum(len(feature.pbis) for feature in features) == 204
    assert sum(feature.completed_count for feature in features) == 51
    feature_two = next(feature for feature in features if feature.number == 2)
    assert feature_two.completed_count == 21
    assert [pbi.identifier for pbi in feature_two.pbis if not pbi.completed] == []
    feature_seven = next(feature for feature in features if feature.number == 7)
    assert len(feature_seven.pbis) == 75
    assert feature_seven.completed_count == 19
    assert [
        (pbi.identifier, pbi.completed_on)
        for pbi in feature_seven.pbis
        if pbi.completed
    ] == [
        ("7.1", "13/08/2026"),
        ("7.2", "13/08/2026"),
        ("7.3", "13/08/2026"),
        ("7.4", "13/08/2026"),
        ("7.5", "20/08/2026"),
        ("7.6", "20/08/2026"),
        ("7.7", "20/08/2026"),
        ("7.8", "20/08/2026"),
        ("7.9", "22/08/2026"),
        ("7.10", "22/08/2026"),
        ("7.11", "23/08/2026"),
        ("7.12", "26/08/2026"),
        ("7.13", "27/08/2026"),
        ("7.19", "02/09/2026"),
        ("7.21", "23/08/2026"),
        ("7.22", "26/08/2026"),
        ("7.23", "03/09/2026"),
        ("7.31", "27/08/2026"),
        ("7.32", "23/08/2026"),
    ]
    assert check_backlog_consistency.feature_priority(governance, features) == 7
    assert "Feature en cours :** Feature 7" in backlog
    assert "19/75 PBI réalisés (25,33 %)" in backlog
    assert (
        "Prochain PBI :** 7.14 — "
        "Les adaptateurs restent indépendants entre eux"
        in backlog
    )
    assert "Progression globale :** 51/204 PBI réalisés (25 %) ; 153 restants" in backlog
    assert "Répartition actuelle des 153 PBI non réalisés" in governance
    assert (
        "Dernière Feature terminée :** Feature 2 — "
        "Garantir la fiabilité du cœur statistique"
    ) in backlog
    assert check_backlog_consistency.expected_documents(backlog, governance) == (
        backlog,
        governance,
    )


def test_cli_detects_drift_regenerates_both_sections_and_then_passes(
    tmp_path: Path, capsys
) -> None:
    backlog_path = tmp_path / "backlog.md"
    governance_path = tmp_path / "governance.md"
    backlog_path.write_text(_source_backlog(), encoding="utf-8")
    governance_path.write_text(_source_governance(), encoding="utf-8")
    args = ["--backlog", str(backlog_path), "--governance", str(governance_path)]

    assert check_backlog_consistency.main(args) == 1
    assert "documentation is stale" in capsys.readouterr().err
    assert check_backlog_consistency.main([*args, "--write"]) == 0
    assert "summaries regenerated" in capsys.readouterr().out
    assert check_backlog_consistency.main(args) == 0
    assert "check passed" in capsys.readouterr().out
    assert "**Prochain PBI :** 2.2 — Ensuite — non commencé." in backlog_path.read_text(
        encoding="utf-8"
    )
    governance = governance_path.read_text(encoding="utf-8")
    assert "Répartition actuelle des 2 PBI non réalisés" in governance
    assert "| Sol Très élevé | 1 |" in governance
    assert "| Sol Ultra | 1 |" in governance


@pytest.mark.parametrize(
    ("backlog", "message"),
    [
        ("# Registre\n", "Missing backlog marker"),
        (
            "# Registre\n| 1.1 | Orphelin | M | Sol Medium | |\n# Synthèse du backlog\n",
            "before its Feature",
        ),
        (
            "# Registre\n## Feature 1 — Vide\n# Synthèse du backlog\n",
            "has no PBI",
        ),
        (
            "# Registre\n## Feature 1 — Test\n"
            "| 2.1 | Mauvais identifiant | M | Sol Medium | |\n"
            "# Synthèse du backlog\n",
            "Invalid or duplicate",
        ),
        (
            "# Registre\n## Feature 1 — Test\n"
            "| 1.1 | Mauvaise date | M | Sol Medium | 2026-07-28 |\n"
            "# Synthèse du backlog\n",
            "Invalid completion date",
        ),
        ("# Registre\n# Synthèse du backlog\n", "contains no Feature"),
    ],
)
def test_registry_rejects_invalid_sources(backlog: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        check_backlog_consistency.parse_registry(backlog)


def test_generation_rejects_missing_governance_marker() -> None:
    with pytest.raises(ValueError, match="generated-section marker"):
        check_backlog_consistency.expected_documents(
            _source_backlog(), "# Gouvernance\n\nFeature prioritaire : 2\n"
        )


def test_generation_accepts_a_transition_without_feature_in_progress() -> None:
    completed = (
        _source_backlog()
        .replace(
            "| 2.2 | Ensuite | M | Sol Très élevé | |",
            "| 2.2 | Ensuite | M | Sol Très élevé | 28/07/2026 |",
        )
        .replace(
            "| 2.3 | Enfin | L | Sol Ultra | |",
            "| 2.3 | Enfin | L | Sol Ultra | 28/07/2026 |",
        )
    )
    features = check_backlog_consistency.parse_registry(completed)

    summary = check_backlog_consistency.render_backlog_summary(features, priority_number=2)
    assert "Feature en cours :** aucune Feature partiellement réalisée" in summary
    assert "Dernière Feature terminée :** Feature 2 — Courante" in summary
    assert "Feature en cours :** aucune Feature partiellement réalisée" in (
        check_backlog_consistency.render_backlog_summary(features)
    )


def test_generation_displays_an_official_priority_before_its_first_pbi() -> None:
    features = check_backlog_consistency.parse_registry(_source_backlog())

    summary = check_backlog_consistency.render_backlog_summary(features, priority_number=2)

    assert "Feature en cours :** Feature 2 — Courante — 1/3" in summary
    assert "Prochain PBI :** 2.2 — Ensuite" in summary
    assert "Dernière Feature terminée :** Feature 1 — Première" in summary


def test_generation_displays_a_zero_progress_official_priority() -> None:
    backlog = _source_backlog().replace(
        "| 2.1 | Fini aussi | M | Sol Élevé | 28/07/2026 |",
        "| 2.1 | Fini aussi | M | Sol Élevé | |",
    )
    features = check_backlog_consistency.parse_registry(backlog)

    summary = check_backlog_consistency.render_backlog_summary(features, priority_number=2)

    assert "Feature en cours :** Feature 2 — Courante — 0/3 PBI réalisés (0 %)" in summary
    assert "Prochain PBI :** 2.1 — Fini aussi" in summary
    assert "Dernière Feature terminée :** Feature 1 — Première" in summary
    assert "Reliquats" not in summary


@pytest.mark.parametrize(
    ("governance", "message"),
    [
        ("# Gouvernance\n", "exactly one"),
        (
            "Feature prioritaire : 1\nFeature prioritaire : 2\n",
            "exactly one",
        ),
        ("Feature prioritaire : 99\n", "unknown Feature"),
    ],
)
def test_priority_authority_is_unique_and_references_the_registry(
    governance: str, message: str
) -> None:
    features = check_backlog_consistency.parse_registry(_source_backlog())

    with pytest.raises(ValueError, match=message):
        check_backlog_consistency.feature_priority(governance, features)


def test_cli_reports_unreadable_input(tmp_path: Path, capsys) -> None:
    missing = tmp_path / "missing.md"

    assert check_backlog_consistency.main(["--backlog", str(missing)]) == 2
    assert "could not run" in capsys.readouterr().err
