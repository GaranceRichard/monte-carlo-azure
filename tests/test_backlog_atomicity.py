from __future__ import annotations

import runpy
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts import check_backlog_atomicity  # noqa: E402
from Scripts.backlog_atomicity_model import COMPLIANT  # noqa: E402


def _backlog(features: dict[int, list[tuple[str, str, str, str]]]) -> str:
    blocks = ["# Registre du backlog"]
    for number, rows in features.items():
        blocks.extend(
            [
                f"## Feature {number} — Feature {number}",
                "| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |",
                "| ---: | --- | :---: | :---: | :---: |",
                *(
                    f"| {identifier} | {title} | {size} | Sol Medium | {date} |"
                    for identifier, title, size, date in rows
                ),
            ]
        )
    return "\n".join([*blocks, "# Synthèse du backlog", ""])


def _governance(statuses: dict[int, str], priority: int = 3) -> str:
    rows = [f"| {number} | {status} |" for number, status in statuses.items()]
    return "\n".join(
        [
            "# Gouvernance",
            f"Feature prioritaire : {priority}",
            "## Registre de préparation des Features",
            "| Feature | Statut de préparation |",
            "| ---: | --- |",
            *rows,
            "",
        ]
    )


def _contract(
    identifier: str,
    size: str,
    predecessors: str = "aucun",
    overrides: dict[str, str] | None = None,
    *,
    title: str = "Un état cohérent est obtenu",
    justify_m: bool = True,
) -> str:
    fields = {
        "Taille": size,
        "Outcome": "Un résultat autonome est observable",
        "Raison principale de changer": "Une raison locale",
        "Frontière principale": "Une frontière locale",
        "Famille d’invariants": "Une famille cohérente",
        "Preuve principale": "Un test ciblé",
        "Éléments de réalisation inclus": (
            "Contrat local ; migration cohésive ; retrait ancien ; tests ; documentation"
        ),
        "Hors périmètre": "Les autres responsabilités",
        "Surface prévisionnelle": "4 fichiers de production ; 8 fichiers versionnés",
        "Prédécesseurs": predecessors,
        "Critères de clôture": "Preuve verte et état publiable seul",
    }
    fields.update(overrides or {})
    lines = [f"## {identifier} — {title}"]
    lines.extend(f"- **{name} :** {value}" for name, value in fields.items())
    if size == "M" and justify_m:
        lines.append(
            f"- **Justification de la taille M :** Difficulté propre à l’outcome {identifier}"
        )
    return "\n".join(lines)


def _expectation(feature: int, contracts: list[str]) -> str:
    return "\n\n".join([f"# Feature {feature} — Feature {feature}", *contracts, ""])


def _validate(
    features: dict[int, list[tuple[str, str, str, str]]],
    contracts: dict[int, list[str]],
    statuses: dict[int, str] | None = None,
    priority: int = 3,
):
    statuses = statuses or {number: COMPLIANT for number in features}
    documents = {
        f"feature-{number}.md": _expectation(number, contracts[number]) for number in contracts
    }
    return check_backlog_atomicity.validate_atomicity(
        _backlog(features), _governance(statuses, priority), documents
    )


@pytest.mark.parametrize("size", ["XXS", "XS", "S", "M"])
def test_compliant_outcome_accepts_each_engageable_size(size: str) -> None:
    rows = {3: [("3.1", "Un résultat est obtenu", size, "")]}
    assert _validate(rows, {3: [_contract("3.1", size)]}) == ()


def test_m_requires_a_specific_non_copied_justification() -> None:
    rows = {3: [("3.1", "Résultat un", "M", ""), ("3.2", "Résultat deux", "M", "")]}
    missing = _validate(
        rows, {3: [_contract("3.1", "M", justify_m=False), _contract("3.2", "M", "3.1")]}
    )
    assert any(issue.rule == "taille M non justifiée" for issue in missing)

    copied = _contract("3.2", "M", "3.1").replace(
        "Difficulté propre à l’outcome 3.2", "Difficulté propre à l’outcome 3.1"
    )
    issues = _validate(rows, {3: [_contract("3.1", "M"), copied]})
    assert any(issue.rule == "justification copiée" for issue in issues)


@pytest.mark.parametrize("size", ["L", "XL"])
def test_engageable_feature_rejects_l_and_xl(size: str) -> None:
    rows = {3: [("3.1", "Résultat", size, "")]}
    issues = _validate(rows, {3: [_contract("3.1", size)]})
    assert any(issue.field == "Taille" and "non engageable" in issue.rule for issue in issues)


def test_missing_repeated_wrong_level_and_mismatched_fields_are_rejected() -> None:
    contract = _contract("3.1", "S").replace("- **Preuve principale :** Un test ciblé\n", "")
    contract += "\n- **Taille :** XS"
    contract = contract.replace("## 3.1", "### 3.1")
    issues = _validate(
        {3: [("3.1", "Résultat", "S", "")]},
        {3: [contract]},
    )
    assert {issue.field for issue in issues} >= {
        "Preuve principale",
        "Taille",
        "Section d’attendus",
    }


def test_missing_surface_and_single_mismatched_size_are_rejected() -> None:
    contract = _contract("3.1", "S").replace(
        "- **Surface prévisionnelle :** 4 fichiers de production ; 8 fichiers versionnés\n",
        "",
    )
    issues = _validate({3: [("3.1", "Résultat", "XS", "")]}, {3: [contract]})
    assert {issue.field for issue in issues} >= {"Surface prévisionnelle", "Taille"}


@pytest.mark.parametrize(
    "field",
    [
        "Outcome",
        "Raison principale de changer",
        "Frontière principale",
        "Famille d’invariants",
        "Preuve principale",
    ],
)
def test_explicit_multiple_primary_values_are_rejected(field: str) -> None:
    contract = _contract("3.1", "S", overrides={field: "premier ; second"})
    issues = _validate({3: [("3.1", "Résultat", "S", "")]}, {3: [contract]})
    assert any(issue.field == field and "plusieurs valeurs" in issue.rule for issue in issues)


@pytest.mark.parametrize(
    "elements",
    [
        "Contrat local ; migration cohésive ; ancien chemin retiré",
        "Règle ; diagnostic ; tests ; intégration mécanique à la gate",
        "Port ; adaptateur principal ; groupe cohésif de consommateurs migré",
        "Implémentation locale ; tests ; documentation durable",
    ],
)
def test_cohesive_implementation_operations_and_conjunctions_are_accepted(
    elements: str,
) -> None:
    contract = _contract(
        "3.1",
        "S",
        overrides={
            "Outcome": "Le contrat et son consommateur forment une frontière stable",
            "Éléments de réalisation inclus": elements,
        },
    )
    assert _validate({3: [("3.1", "Résultat", "S", "")]}, {3: [contract]}) == ()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("Outcome", "Domaine delivery ; domaine identité"),
        (
            "Raison principale de changer",
            "Cas d’usage d’historique ; cas d’usage de prévision",
        ),
        ("Frontière principale", "Azure DevOps Cloud ; Azure DevOps Server/TFS"),
        ("Outcome", "Comportement UI ; contenu PDF ; export CSV"),
        ("Frontière principale", "Code produit ; hooks Git"),
        ("Famille d’invariants", "Identité de snapshot ; orchestration DAG"),
        ("Preuve principale", "Test ciblé ; rapport indépendant"),
        ("Raison principale de changer", "Hotspot React ; hotspot quality_gate"),
    ],
)
def test_independent_domains_behaviours_proofs_and_hotspots_are_refused(
    field: str, value: str
) -> None:
    contract = _contract("3.1", "S", overrides={field: value})
    issues = _validate({3: [("3.1", "Résultat", "S", "")]}, {3: [contract]})
    assert any(issue.field == field and "plusieurs valeurs" in issue.rule for issue in issues)


@pytest.mark.parametrize(
    ("surface", "rule"),
    [
        ("beaucoup de fichiers", "format de surface invalide"),
        ("9 fichiers de production ; 8 fichiers versionnés", "surface incohérente"),
        ("9 fichiers de production ; 16 fichiers versionnés", "signal de revue"),
    ],
)
def test_surface_format_consistency_and_review_signal_are_checked(surface: str, rule: str) -> None:
    contract = _contract("3.1", "S", overrides={"Surface prévisionnelle": surface})
    issues = _validate({3: [("3.1", "Résultat", "S", "")]}, {3: [contract]})
    assert any(issue.field == "Surface prévisionnelle" and rule in issue.rule for issue in issues)


def test_large_surface_is_accepted_after_explicit_cohesion_review() -> None:
    contract = _contract(
        "3.1",
        "S",
        overrides={
            "Surface prévisionnelle": "9 fichiers de production ; 16 fichiers versionnés",
            "Justification de cohésion": "Un seul outcome sans état transitoire publiable",
        },
    )
    assert _validate({3: [("3.1", "Résultat", "S", "")]}, {3: [contract]}) == ()


@pytest.mark.parametrize(
    "title",
    [
        "Ancienne déclaration retirée",
        "Import inverse bloqué",
        "Consommateur local migré",
        "Documentation durable publiée",
        "Adaptateur Cloud disponible",
        "Mapper delivery disponible",
        "Téléchargement PDF disponible",
    ],
)
def test_purely_operational_titles_require_an_autonomy_review(title: str) -> None:
    rows = {3: [("3.1", title, "S", "")]}
    issues = _validate(rows, {3: [_contract("3.1", "S", title=title)]})
    assert any(issue.field == "Titre" and "tâche" in issue.rule for issue in issues)


def test_operational_title_can_be_accepted_with_an_explicit_autonomy_review() -> None:
    title = "Adaptateur de référence disponible"
    contract = _contract(
        "3.1",
        "S",
        title=title,
        overrides={
            "Justification du titre opératoire": (
                "L’adaptateur constitue une substitution indépendante "
                "prouvée par un kit contractuel"
            )
        },
    )
    assert _validate({3: [("3.1", title, "S", "")]}, {3: [contract]}) == ()


def test_unknown_duplicate_and_future_predecessors_are_actionable() -> None:
    rows = {
        3: [
            ("3.1", "Résultat un", "S", ""),
            ("3.2", "Résultat deux", "S", ""),
        ]
    }
    contracts = [_contract("3.1", "S", "3.2, 9.9, 9.9"), _contract("3.2", "S", "3.1")]
    issues = _validate(rows, {3: contracts})
    assert {
        "prédécesseur dupliqué",
        "prédécesseur inexistant",
        "prédécesseur futur ou réflexif invalide",
    } <= {issue.rule for issue in issues}


@pytest.mark.parametrize(
    ("predecessors", "expected"),
    [({"3.1": "3.1"}, "3.1"), ({"3.1": "3.2", "3.2": "3.3", "3.3": "3.1"}, "3.1 -> 3.2 -> 3.3")],
)
def test_direct_and_indirect_cycles_are_rejected(
    predecessors: dict[str, str], expected: str
) -> None:
    rows = {3: [(identifier, "Résultat", "S", "") for identifier in predecessors]}
    contracts = {
        3: [_contract(identifier, "S", value) for identifier, value in predecessors.items()]
    }
    issues = _validate(rows, contracts)
    assert any(issue.rule == "cycle dans le graphe" and issue.pbi == expected for issue in issues)


def test_missing_orphan_duplicate_and_misfiled_sections_are_rejected() -> None:
    rows = {3: [("3.1", "Résultat", "S", "")]}
    missing = _validate(rows, {3: []})
    assert any(issue.rule == "attendus de granularité absents" for issue in missing)

    documents = {
        "feature-3.md": _expectation(3, [_contract("3.1", "S"), _contract("3.2", "S")]),
        "duplicate.md": _expectation(4, [_contract("3.1", "S")]),
    }
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog(rows), _governance({3: COMPLIANT}), documents
    )
    rules = {issue.rule for issue in issues}
    assert "section dupliquée" in rules
    assert "section orpheline ou rangée sous la mauvaise Feature" in rules


def test_priority_readiness_legacy_features_dates_and_registry_are_checked() -> None:
    rows = {
        1: [("1.1", "Réalisé", "XL", "02/08/2026")],
        3: [("3.1", "Résultat", "S", "")],
        4: [("4.1", "À raffiner", "XL", "")],
    }
    valid = _validate(
        rows,
        {3: [_contract("3.1", "S")]},
        {3: COMPLIANT, 4: "À raffiner avant engagement"},
    )
    assert valid == ()

    invalid = _validate(
        {
            3: [
                ("3.1", "Résultat", "S", "02/08/2026"),
                ("3.2", "Résultat suivant", "S", ""),
            ]
        },
        {3: [_contract("3.1", "S"), _contract("3.2", "S", "3.1")]},
        {3: "À raffiner avant engagement"},
    )
    assert {issue.field for issue in invalid} >= {"Feature prioritaire", "Réalisé le"}

    malformed = _backlog(
        {
            3: [
                ("3.1", "Résultat", "Q", ""),
                ("3.1", "Doublon", "S", ""),
                ("4.1", "Hors rang", "S", ""),
            ]
        }
    )
    issues = check_backlog_atomicity.validate_atomicity(
        malformed,
        _governance({3: COMPLIANT}),
        {"feature-3.md": _expectation(3, [_contract("3.1", "S")])},
    )
    assert {"identifiant dupliqué", "identifiant hors Feature", "complexité non reconnue"} <= {
        issue.rule for issue in issues
    }

    missing_status = _validate(
        {
            3: [("3.1", "Résultat", "S", "")],
            4: [("4.1", "Résultat futur", "S", "")],
        },
        {3: [_contract("3.1", "S")]},
        {3: COMPLIANT},
    )
    assert any(
        issue.feature == "Feature 4" and issue.field == "Statut de préparation"
        for issue in missing_status
    )


def _feature_seven_document(
    count: int = 55, *, review_under: bool = False
) -> tuple[str, list[tuple[str, str, str, str]]]:
    specs = []
    contracts = []
    for number in range(1, count + 1):
        identifier = f"7.{number}"
        size = "M" if number == 1 else "S"
        predecessor = "aucun" if number == 1 else f"7.{number - 1}"
        specs.append((identifier, f"Un outcome {number} est obtenu", size, ""))
        contracts.append(_contract(identifier, size, predecessor))
    sizes = {
        size: sum(row[2] == size for row in specs) for size in ["XXS", "XS", "S", "M", "L", "XL"]
    }
    summary = [
        f"Statut : {COMPLIANT}",
        f"PBI total : {count}",
        *(f"PBI {size} : {sizes[size]}" for size in ["XXS", "XS", "S", "M", "L", "XL"]),
        "PBI sans attendus : 0",
        "Cycles de précédence : 0",
    ]
    if review_under:
        summary.append("Revue sous seuil : Aucun outcome transversal n’agrège les preuves")
    attestation = [
        "## Attestation synthétique de conformité",
        (
            f"Les {count} PBI de la Feature 7 ont été audités et sont conformes "
            "au standard de granularité."
        ),
        f"- **PBI audités :** {count}",
        "- **Titres purement opératoires :** 0",
        "- **PBI `L` ou `XL` :** 0",
        "- **Cycles :** 0",
        "- **Prédécesseurs futurs :** 0",
        "- **Exceptions :** 0",
        "### Justifications des PBI `M`",
        *(
            f"- **{row[0]} — {row[1]} :** Difficulté propre à l’outcome {row[0]}"
            for row in specs
            if row[2] == "M"
        ),
        "### Exceptions",
        "Aucune.",
    ]
    document = "\n\n".join(
        [
            "# Feature 7 — Feature 7",
            "\n".join(summary),
            *contracts,
            "\n".join(attestation),
            "",
        ]
    )
    return document, specs


def test_feature_seven_recalculates_summary_graph_and_human_audit() -> None:
    document, rows = _feature_seven_document()
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}),
        _governance({7: COMPLIANT}, priority=7),
        {"feature-7.md": document},
    )
    assert issues == ()


def test_feature_seven_requires_review_under_55_and_refuses_more_than_90() -> None:
    under, rows = _feature_seven_document(4)
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}), _governance({7: COMPLIANT}, 7), {"feature-7.md": under}
    )
    assert any(issue.rule == "revue de concentration sous le seuil absente" for issue in issues)

    reviewed, rows = _feature_seven_document(4, review_under=True)
    assert (
        check_backlog_atomicity.validate_atomicity(
            _backlog({7: rows}), _governance({7: COMPLIANT}, 7), {"feature-7.md": reviewed}
        )
        == ()
    )

    over, rows = _feature_seven_document(91)
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}), _governance({7: COMPLIANT}, 7), {"feature-7.md": over}
    )
    assert any(issue.rule == "Feature 7 surfragmentée" for issue in issues)


@pytest.mark.parametrize(
    ("old", "new", "field"),
    [
        ("PBI total : 55", "PBI total : 54", "PBI total"),
        ("- **PBI audités :** 55", "- **PBI audités :** 54", "PBI audités"),
        (
            "## Attestation synthétique de conformité",
            "## Autre audit",
            "Attestation synthétique de conformité",
        ),
    ],
)
def test_feature_seven_does_not_trust_written_audit_values(old: str, new: str, field: str) -> None:
    document, rows = _feature_seven_document()
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}),
        _governance({7: COMPLIANT}, 7),
        {"feature-7.md": document.replace(old, new)},
    )
    assert any(issue.field == field for issue in issues)


def test_feature_seven_rejects_duplicate_and_orphan_audit_rows() -> None:
    document, rows = _feature_seven_document()
    row = "- **7.1 — Un outcome 1 est obtenu :** Difficulté propre à l’outcome 7.1"
    duplicated = document.replace(
        row,
        f"{row}\n{row}\n- **7.99 — Outcome orphelin :** Justification orpheline",
    )
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}),
        _governance({7: COMPLIANT}, 7),
        {"feature-7.md": duplicated},
    )
    assert any(issue.rule == "justification synthétique dupliquée" for issue in issues)
    assert any(issue.rule == "justification synthétique orpheline" for issue in issues)

    malformed = document.replace(row, "- **7.1 :** Justification sans titre")
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}),
        _governance({7: COMPLIANT}, 7),
        {"feature-7.md": malformed},
    )
    assert any(issue.rule == "justification synthétique invalide" for issue in issues)
    assert any(issue.rule == "PBI M absent de l’attestation" for issue in issues)

    incoherent = document.replace(row, row.replace("Difficulté propre", "Difficulté autre"))
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}),
        _governance({7: COMPLIANT}, 7),
        {"feature-7.md": incoherent},
    )
    assert any(issue.rule == "justification synthétique incohérente" for issue in issues)

    without_m_section = document.replace(
        "### Justifications des PBI `M`", "### Autres justifications"
    )
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}),
        _governance({7: COMPLIANT}, 7),
        {"feature-7.md": without_m_section},
    )
    assert any(issue.rule == "synthèse des tailles M absente" for issue in issues)

    altered_global = document.replace("sont conformes", "seraient conformes")
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}),
        _governance({7: COMPLIANT}, 7),
        {"feature-7.md": altered_global},
    )
    assert any(issue.rule == "conformité humaine globale non attestée" for issue in issues)

    altered_exceptions = document.replace("Aucune.", "Une exception non détaillée.")
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}),
        _governance({7: COMPLIANT}, 7),
        {"feature-7.md": altered_exceptions},
    )
    assert any(issue.rule == "section d’exceptions incohérente" for issue in issues)

    structurally_invalid = document.replace(
        "- **Preuve principale :** Un test ciblé\n", "", 1
    )
    issues = check_backlog_atomicity.validate_atomicity(
        _backlog({7: rows}),
        _governance({7: COMPLIANT}, 7),
        {"feature-7.md": structurally_invalid},
    )
    assert any(issue.field == "Exceptions" for issue in issues)


def test_repository_feature_seven_is_entirely_compliant() -> None:
    expectations_root = ROOT / "docs" / "backlog-expectations"
    issues = check_backlog_atomicity.validate_atomicity(
        (ROOT / "docs" / "backlog.md").read_text(encoding="utf-8"),
        (ROOT / "docs" / "backlog-governance.md").read_text(encoding="utf-8"),
        {str(path): path.read_text(encoding="utf-8") for path in expectations_root.glob("*.md")},
    )
    assert [issue for issue in issues if issue.feature == "Feature 7"] == []


def test_cli_reports_success_violations_and_unreadable_input(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    backlog = tmp_path / "backlog.md"
    governance = tmp_path / "governance.md"
    expectations = tmp_path / "expectations"
    expectations.mkdir()
    backlog.write_text(_backlog({3: [("3.1", "Résultat", "S", "")]}), encoding="utf-8")
    governance.write_text(_governance({3: COMPLIANT}), encoding="utf-8")
    (expectations / "feature-3.md").write_text(
        _expectation(3, [_contract("3.1", "S")]), encoding="utf-8"
    )
    args = [
        "--backlog",
        str(backlog),
        "--governance",
        str(governance),
        "--expectations",
        str(expectations),
    ]
    assert check_backlog_atomicity.main(args) == 0
    assert "check passed" in capsys.readouterr().out

    old_argv = sys.argv
    cached = sys.modules.pop("Scripts.check_backlog_atomicity")
    sys.argv = ["check_backlog_atomicity.py", *args]
    try:
        with pytest.raises(SystemExit, match="0"):
            runpy.run_module("Scripts.check_backlog_atomicity", run_name="__main__")
    finally:
        sys.argv = old_argv
        sys.modules["Scripts.check_backlog_atomicity"] = cached
    capsys.readouterr()

    (expectations / "feature-3.md").write_text("# Feature 3 — Feature 3", encoding="utf-8")
    assert check_backlog_atomicity.main(args) == 1
    assert "Correction attendue" in capsys.readouterr().err
    assert check_backlog_atomicity.main(["--backlog", str(tmp_path / "missing")]) == 2
    assert "could not run" in capsys.readouterr().err


def test_empty_registry_and_malformed_readiness_authorities_are_diagnosed() -> None:
    governance = """Feature prioritaire : 3
Feature prioritaire : 4
## Registre de préparation des Features
| Wrong | Header |
| --- | --- |
"""
    issues = check_backlog_atomicity.validate_atomicity(
        "# Registre\n# Synthèse du backlog\n", governance, {}
    )
    assert {issue.field for issue in issues} >= {
        "Registre",
        "Feature prioritaire",
        "Registre de préparation",
    }


def test_readiness_and_markdown_parsers_cover_missing_short_and_duplicate_rows() -> None:
    assert check_backlog_atomicity.markdown_table("", "## Missing") is None
    assert check_backlog_atomicity.markdown_table("## Empty\n| only |", "## Empty") == ([], [])
    priority, statuses, missing = check_backlog_atomicity.parse_readiness(
        "Feature prioritaire : 3\n"
    )
    assert priority == 3 and statuses == {}
    assert any(issue.rule == "registre de préparation absent" for issue in missing)

    governance = f"""Feature prioritaire : 3
## Registre de préparation des Features
| Feature | Statut de préparation |
| --- | --- |
| bad | ignored |
| 3 | {COMPLIANT} |
| 3 | À raffiner avant engagement |
"""
    _priority, statuses, issues = check_backlog_atomicity.parse_readiness(governance)
    assert statuses[3] == "À raffiner avant engagement"
    assert any(issue.rule == "statut dupliqué" for issue in issues)
