"""Build exact, deterministic comparisons for shared statistical corpus runs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_MISSING = object()


def _pointer(path: str, part: str | int) -> str:
    escaped = str(part).replace("~", "~0").replace("/", "~1")
    return f"{path}/{escaped}" if path else f"/{escaped}"


def _missing_difference(path: str, expected: Any, actual: Any) -> dict[str, Any]:
    if actual is _MISSING:
        return {"path": path or "/", "kind": "missing_actual", "expected": expected}
    return {"path": path or "/", "kind": "unexpected_actual", "actual": actual}


def _compare_objects(
    expected: dict[str, Any],
    actual: dict[str, Any],
    path: str,
) -> list[dict[str, Any]]:
    differences: list[dict[str, Any]] = []
    for key in sorted(set(expected) | set(actual)):
        differences.extend(
            compare_canonical(
                expected.get(key, _MISSING),
                actual.get(key, _MISSING),
                _pointer(path, key),
            )
        )
    return differences


def _compare_arrays(
    expected: list[Any],
    actual: list[Any],
    path: str,
) -> list[dict[str, Any]]:
    differences: list[dict[str, Any]] = []
    if len(expected) != len(actual):
        differences.append(
            {
                "path": path or "/",
                "kind": "array_length",
                "expected": len(expected),
                "actual": len(actual),
            }
        )
    for index in range(max(len(expected), len(actual))):
        differences.extend(
            compare_canonical(
                expected[index] if index < len(expected) else _MISSING,
                actual[index] if index < len(actual) else _MISSING,
                _pointer(path, index),
            )
        )
    return differences


def compare_canonical(expected: Any, actual: Any, path: str = "") -> list[dict[str, Any]]:
    """Compare JSON values exactly, preserving field absence and array ordering."""

    if expected is _MISSING or actual is _MISSING:
        return [_missing_difference(path, expected, actual)]
    if isinstance(expected, dict) and isinstance(actual, dict):
        return _compare_objects(expected, actual, path)
    if isinstance(expected, list) and isinstance(actual, list):
        return _compare_arrays(expected, actual, path)
    if isinstance(expected, (dict, list)) or isinstance(actual, (dict, list)):
        return [
            {
                "path": path or "/",
                "kind": "type_mismatch",
                "expected": expected,
                "actual": actual,
            }
        ]
    if expected != actual:
        return [
            {
                "path": path or "/",
                "kind": "value_mismatch",
                "expected": expected,
                "actual": actual,
            }
        ]
    return []


def _case_map(engine_report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {case_report["id"]: case_report for case_report in engine_report["cases"]}


def _normative_comparison(
    expected: dict[str, Any],
    case_report: dict[str, Any] | None,
) -> tuple[dict[str, Any], str | None]:
    if not case_report or case_report.get("status") != "ok":
        return (
            {
                "status": "engine_error",
                "error": (case_report or {}).get(
                    "error",
                    {"type": "MissingCaseReport", "message": "engine produced no case report"},
                ),
            },
            "engine_error",
        )
    differences = compare_canonical(expected, case_report["result"])
    return (
        {
            "status": "match" if not differences else "normative_divergence",
            "result": case_report["result"],
            "differences": differences,
        },
        "normative_divergence" if differences else None,
    )


def _inter_engine_comparison(
    python_case: dict[str, Any] | None,
    typescript_case: dict[str, Any] | None,
) -> tuple[dict[str, Any], str | None]:
    comparable = (
        python_case
        and typescript_case
        and python_case.get("status") == "ok"
        and typescript_case.get("status") == "ok"
    )
    if not comparable:
        return {"status": "not_compared", "differences": []}, None
    differences = compare_canonical(python_case["result"], typescript_case["result"])
    return (
        {
            "status": "match" if not differences else "engine_divergence",
            "differences": differences,
        },
        "engine_divergence" if differences else None,
    )


def _case_comparison(
    reference_case: dict[str, Any],
    python_case: dict[str, Any] | None,
    typescript_case: dict[str, Any] | None,
) -> dict[str, Any]:
    expected = reference_case["expected_result"]
    python, python_outcome = _normative_comparison(expected, python_case)
    typescript, typescript_outcome = _normative_comparison(expected, typescript_case)
    inter_engine, inter_engine_outcome = _inter_engine_comparison(
        python_case,
        typescript_case,
    )
    observed = [python_outcome, typescript_outcome, inter_engine_outcome]
    outcomes = [
        outcome
        for outcome in ("engine_error", "normative_divergence", "engine_divergence")
        if outcome in observed
    ]
    return {
        "id": reference_case["id"],
        "outcomes": outcomes or ["match"],
        "expected": expected,
        "python": python,
        "typescript": typescript,
        "inter_engine": inter_engine,
    }


def _summary(
    case_reports: list[dict[str, Any]],
    engine_reports: list[dict[str, Any]],
) -> dict[str, int]:
    return {
        "case_count": len(case_reports),
        "matching_cases": sum(case["outcomes"] == ["match"] for case in case_reports),
        "normative_divergence_cases": sum(
            "normative_divergence" in case["outcomes"] for case in case_reports
        ),
        "engine_divergence_cases": sum(
            "engine_divergence" in case["outcomes"] for case in case_reports
        ),
        "engine_error_cases": sum("engine_error" in case["outcomes"] for case in case_reports),
        "fatal_engine_errors": sum(report["status"] == "engine_error" for report in engine_reports),
    }


def _validation_probe_map(report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {case["id"]: case for case in report.get("cases", [])}


def build_validation_alignment(
    probes: dict[str, Any],
    python_report: dict[str, Any],
    typescript_report: dict[str, Any],
) -> dict[str, Any]:
    python_cases = _validation_probe_map(python_report)
    typescript_cases = _validation_probe_map(typescript_report)
    cases: list[dict[str, Any]] = []
    for probe in probes["cases"]:
        expected = probe["accepted"]
        python_case = python_cases.get(probe["id"])
        typescript_case = typescript_cases.get(probe["id"])
        python_accepted = (python_case or {}).get("accepted", _MISSING)
        typescript_accepted = (typescript_case or {}).get("accepted", _MISSING)
        matches = (python_accepted, typescript_accepted) == (expected, expected)
        case = {
            "id": probe["id"],
            "expected_accepted": expected,
            "status": "match" if matches else "divergence",
        }
        if python_accepted is not _MISSING:
            case["python_accepted"] = python_accepted
        if typescript_accepted is not _MISSING:
            case["typescript_accepted"] = typescript_accepted
        cases.append(case)
    engine_errors = sum(
        report.get("status") == "engine_error"
        for report in (python_report, typescript_report)
    )
    matching_probes = sum(case["status"] == "match" for case in cases)
    return {
        "pbi": "2.13",
        "fixture": "contracts/statistical-validation-probes-v1.0.json",
        "status": (
            "engine_error"
            if engine_errors
            else "match"
            if matching_probes == len(cases)
            else "divergence"
        ),
        "summary": {
            "probe_count": len(cases),
            "matching_probes": matching_probes,
            "divergent_probes": len(cases) - matching_probes,
            "engine_errors": engine_errors,
        },
        "engines": {
            "python": {
                key: value for key, value in python_report.items() if key != "cases"
            },
            "typescript": {
                key: value
                for key, value in typescript_report.items()
                if key != "cases"
            },
        },
        "cases": cases,
    }


def _optional_validation_alignment(
    validation_probes: dict[str, Any] | None,
    python_report: dict[str, Any] | None,
    typescript_report: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if any(
        report is None
        for report in (validation_probes, python_report, typescript_report)
    ):
        return None
    return build_validation_alignment(
        validation_probes,
        python_report,
        typescript_report,
    )


def _parity_status(
    summary: dict[str, int],
    validation_alignment: dict[str, Any] | None,
) -> str:
    validation_status = (validation_alignment or {}).get("status")
    engine_error = bool(
        summary["fatal_engine_errors"]
        + summary["engine_error_cases"]
        + int(validation_status == "engine_error")
    )
    divergence = bool(
        summary["normative_divergence_cases"]
        + summary["engine_divergence_cases"]
        + int(validation_status == "divergence")
    )
    return ("match", "divergence", "engine_error")[
        max(int(divergence), 2 * int(engine_error))
    ]


def build_parity_report(
    corpus: dict[str, Any],
    python_report: dict[str, Any],
    typescript_report: dict[str, Any],
    *,
    validation_probes: dict[str, Any] | None = None,
    python_validation_report: dict[str, Any] | None = None,
    typescript_validation_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    python_cases = _case_map(python_report)
    typescript_cases = _case_map(typescript_report)
    case_reports = [
        _case_comparison(
            reference_case,
            python_cases.get(reference_case["id"]),
            typescript_cases.get(reference_case["id"]),
        )
        for reference_case in corpus["cases"]
    ]
    summary = _summary(case_reports, [python_report, typescript_report])
    validation_alignment = _optional_validation_alignment(
        validation_probes,
        python_validation_report,
        typescript_validation_report,
    )
    report = {
        "report_version": "1.1",
        "enforcement": "informational",
        "status": _parity_status(summary, validation_alignment),
        "corpus": {
            "id": corpus["corpus_id"],
            "schema_version": corpus["schema_version"],
            "prng_contract": corpus["prng_contract"]["id"],
        },
        "summary": summary,
        "engines": {
            "python": {
                key: value for key, value in python_report.items() if key != "cases"
            },
            "typescript": {
                key: value for key, value in typescript_report.items() if key != "cases"
            },
        },
        "cases": case_reports,
    }
    if validation_alignment is not None:
        report["validation_alignment"] = validation_alignment
    return report


def invalid_corpus_report(kind: str, diagnostics: list[str]) -> dict[str, Any]:
    return {
        "report_version": "1.1",
        "enforcement": "informational",
        "status": "invalid_corpus",
        "invalidity": kind,
        "diagnostics": diagnostics,
    }


def render_json(report: dict[str, Any]) -> str:
    return json.dumps(report, ensure_ascii=False, indent=2) + "\n"


def _difference_count(case: dict[str, Any], section: str) -> int:
    return len(case[section].get("differences", []))


def render_markdown(report: dict[str, Any]) -> str:
    lines = ["# Rapport de parité statistique", "", "- Contrôle : informatif, non bloquant"]
    if report["status"] == "invalid_corpus":
        lines.extend(
            [
                f"- Statut : `invalid_corpus` (`{report['invalidity']}`)",
                "",
                "## Diagnostics",
                "",
                *[f"- {diagnostic}" for diagnostic in report["diagnostics"]],
            ]
        )
        return "\n".join(lines) + "\n"
    summary = report["summary"]
    lines.extend(
        [
            f"- Statut : `{report['status']}`",
            f"- Corpus : `{report['corpus']['id']}` `1.0` / `mca-prng-v1`",
            f"- Cas : {summary['case_count']}",
        ]
    )
    validation_alignment = report.get("validation_alignment")
    if validation_alignment is not None:
        validation_summary = validation_alignment["summary"]
        lines.append(
            "- Validation PBI 2.13 : "
            f"`{validation_alignment['status']}` "
            f"({validation_summary['matching_probes']}/{validation_summary['probe_count']} "
            "probes concordantes)"
        )
    lines.extend(
        [
            "",
            "| Cas | Python / norme | TypeScript / norme | Python / TypeScript |",
            "| --- | --- | --- | --- |",
        ]
    )
    for case in report["cases"]:
        python = case["python"]["status"]
        typescript = case["typescript"]["status"]
        inter_engine = case["inter_engine"]["status"]
        lines.append(
            f"| `{case['id']}` | `{python}` ({_difference_count(case, 'python')}) "
            f"| `{typescript}` ({_difference_count(case, 'typescript')}) "
            f"| `{inter_engine}` ({_difference_count(case, 'inter_engine')}) |"
        )
    lines.extend(
        [
            "",
            "Les nombres entre parenthèses comptent les différences exactes. "
            "Le rapport JSON conserve chaque chemin et chaque valeur, sans tolérance numérique, "
            "réordonnancement d’histogramme ni valeur absente reconstruite.",
        ]
    )
    if validation_alignment is not None:
        lines.extend(
            [
                "",
                "## Alignement de validation PBI 2.13",
                "",
                "| Probe | Attendu | Python | TypeScript | Statut |",
                "| --- | --- | --- | --- | --- |",
            ]
        )
        for probe in validation_alignment["cases"]:
            lines.append(
                f"| `{probe['id']}` | `{probe['expected_accepted']}` "
                f"| `{probe.get('python_accepted', 'omis')}` | "
                f"`{probe.get('typescript_accepted', 'omis')}` | `{probe['status']}` |"
            )
        lines.extend(
            [
                "",
                "Ces probes couvrent la forme fermée, les valeurs par défaut résolues, "
                "le paramètre de mode exclusif, les entiers stricts, les zéros, "
                "les bornes et la seed uint32. Ils ne modifient aucune formule statistique ; "
                "le corpus démontre le PBI 2.14. Les PBI 2.15 et 2.16 restent inchangés.",
            ]
        )
    return "\n".join(lines) + "\n"


def write_reports(
    report: dict[str, Any],
    json_path: Path,
    markdown_path: Path,
) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(render_json(report), encoding="utf-8")
    markdown_path.write_text(render_markdown(report), encoding="utf-8")
