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

## Répartition actuelle des 99 PBI non réalisés
stale
"""


def test_repository_backlog_status_and_generated_sections_are_exact() -> None:
    backlog = (ROOT / "docs" / "backlog.md").read_text(encoding="utf-8")
    governance = (ROOT / "docs" / "backlog-governance.md").read_text(encoding="utf-8")
    features = check_backlog_consistency.parse_registry(backlog)

    assert sum(len(feature.pbis) for feature in features) == 141
    assert sum(feature.completed_count for feature in features) == 29
    feature_two = next(feature for feature in features if feature.number == 2)
    assert feature_two.completed_count == 18
    assert [pbi.identifier for pbi in feature_two.pbis if not pbi.completed] == [
        # PBI 2.18 completed on 01/08/2026 after calibrated distributional parity.
        # The remaining sequence starts with PBI 2.19.
        # Only the three later consolidation and compatibility PBIs remain open.
        "2.19",
        "2.20",
        "2.21",
    ]
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
    assert "**Prochain PBI :** `2.2` — Ensuite — non commencé." in backlog_path.read_text(
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
        check_backlog_consistency.expected_documents(_source_backlog(), "# Gouvernance\n")


def test_generation_requires_one_feature_in_progress() -> None:
    completed = _source_backlog().replace(
        "| 2.2 | Ensuite | M | Sol Très élevé | |",
        "| 2.2 | Ensuite | M | Sol Très élevé | 28/07/2026 |",
    ).replace(
        "| 2.3 | Enfin | L | Sol Ultra | |",
        "| 2.3 | Enfin | L | Sol Ultra | 28/07/2026 |",
    )
    features = check_backlog_consistency.parse_registry(completed)

    with pytest.raises(ValueError, match="no Feature in progress"):
        check_backlog_consistency.render_backlog_summary(features)


def test_cli_reports_unreadable_input(tmp_path: Path, capsys) -> None:
    missing = tmp_path / "missing.md"

    assert check_backlog_consistency.main(["--backlog", str(missing)]) == 2
    assert "could not run" in capsys.readouterr().err
