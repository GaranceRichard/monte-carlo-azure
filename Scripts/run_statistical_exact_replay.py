#!/usr/bin/env python3
"""Rejouer exactement le corpus statistique dans les deux moteurs."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.run_statistical_reference_corpus import validate_for_execution  # noqa: E402
from Scripts.statistical_corpus_runner import (  # noqa: E402
    fatal_engine_report,
    run_python_corpus,
    run_typescript_corpus,
)
from Scripts.statistical_exact_replay import build_exact_replay_report  # noqa: E402
from Scripts.statistical_exact_replay_support import (  # noqa: E402
    build_proof_coverage,
    proof_coverage_issues,
)
from Scripts.validate_statistical_reference_corpus import (  # noqa: E402
    CORPUS_PATH,
    SCHEMA_PATH,
)

DEFAULT_BATCH_SIZES = (125, 128, 1000, 2048)
DEFAULT_EVIDENCE_PATH = ROOT / "reports/statistical-exact-replay-evidence.json"

PythonBatchRunner = Callable[[dict[str, Any], int], dict[str, Any]]
TypeScriptRunner = Callable[[Path], dict[str, Any]]


class EngineReportError(RuntimeError):
    """Signal an invalid engine-report protocol."""


def _invalid_evidence(
    status: str,
    invalidity: str,
    diagnostics: list[str],
) -> dict[str, Any]:
    return {
        "report_version": "1.0",
        "proof_kind": "exact_replay",
        "enforcement": "informational",
        "distributional_equivalence": "not_evaluated",
        "status": status,
        "invalidity": invalidity,
        "diagnostics": diagnostics,
    }


def validate_batch_plan(
    corpus: dict[str, Any],
    batch_sizes: tuple[int, ...],
) -> list[str]:
    """Require divisible, remainder, exact-single and oversized geometries."""

    if not batch_sizes:
        return ["Au moins une taille de batch backend est requise."]
    if any(type(size) is not int or size <= 0 for size in batch_sizes):
        return ["Chaque taille de batch backend doit être un entier strictement positif."]
    if len(set(batch_sizes)) != len(batch_sizes):
        return ["Les tailles de batch backend doivent être uniques."]

    simulation_counts = tuple(dict.fromkeys(case["input"]["n_sims"] for case in corpus["cases"]))
    geometries = (
        (
            "un découpage divisible en plusieurs lots",
            lambda size, count: size < count and count % size == 0,
        ),
        (
            "un dernier lot non divisible",
            lambda size, count: size < count and count % size != 0,
        ),
        (
            "un lot unique exactement égal à la population",
            lambda size, count: size == count,
        ),
        (
            "un lot supérieur à la population",
            lambda size, count: size > count,
        ),
    )
    return [
        f"Le plan de batch doit couvrir {description}."
        for description, predicate in geometries
        if not any(
            all(predicate(batch_size, count) for count in simulation_counts)
            for batch_size in batch_sizes
        )
    ]


def _expected_header(
    engine: str,
    corpus: dict[str, Any],
    batch_size: int | None,
) -> dict[str, Any]:
    header = {
        "engine": engine,
        "corpus_id": corpus["corpus_id"],
        "schema_version": corpus["schema_version"],
        "normative_contract": corpus["normative_contract"],
        "prng_contract": corpus["prng_contract"]["id"],
    }
    if batch_size is not None:
        header["batch_size"] = batch_size
    return header


def _valid_case_report(case: object) -> bool:
    if not isinstance(case, dict):
        return False
    if case.get("status") == "ok":
        return isinstance(case.get("result"), dict)
    if case.get("status") == "engine_error":
        return isinstance(case.get("error"), dict)
    return False


def validate_engine_report(
    report: object,
    *,
    engine: str,
    corpus: dict[str, Any],
    batch_size: int | None,
) -> list[str]:
    """Validate identity, version and complete ordered case coverage."""

    if not isinstance(report, dict):
        return ["Le runner n'a pas produit un objet de rapport."]
    issues = [
        f"Header moteur divergent pour {key}."
        for key, expected in _expected_header(engine, corpus, batch_size).items()
        if report.get(key) != expected
    ]
    cases = report.get("cases")
    if not isinstance(cases, list):
        return [*issues, "Le rapport moteur doit contenir une liste de cas."]
    expected_ids = [case["id"] for case in corpus["cases"]]
    actual_ids = [case.get("id") if isinstance(case, dict) else None for case in cases]
    if actual_ids != expected_ids:
        issues.append(
            "Le rapport moteur doit conserver exactement les cas du corpus dans leur ordre."
        )
    if report.get("status") not in {"completed", "engine_error"}:
        issues.append("Le statut du rapport moteur est invalide.")
    if any(not _valid_case_report(case) for case in cases):
        issues.append("Chaque rapport de cas moteur doit porter un résultat ou une erreur valide.")
    return issues


def _fatal_report(
    engine: str,
    corpus: dict[str, Any],
    batch_size: int | None,
    error: BaseException,
) -> dict[str, Any]:
    report = fatal_engine_report(engine, corpus, error)
    if batch_size is not None:
        report["batch_size"] = batch_size
    return report


def _safe_engine_run(
    *,
    engine: str,
    corpus: dict[str, Any],
    batch_size: int | None,
    runner: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    try:
        report = runner()
        issues = validate_engine_report(
            report,
            engine=engine,
            corpus=corpus,
            batch_size=batch_size,
        )
        if issues:
            raise EngineReportError(" ".join(issues))
        return report
    except Exception as exc:  # noqa: BLE001 - engine failures are evidence data
        return _fatal_report(engine, corpus, batch_size, exc)


def _default_python_runner(
    corpus: dict[str, Any],
    batch_size: int,
) -> dict[str, Any]:
    return run_python_corpus(corpus, batch_size=batch_size)


def write_evidence(report: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _run_validated_control(
    corpus: dict[str, Any],
    corpus_path: Path,
    batch_sizes: tuple[int, ...],
    python_runner: PythonBatchRunner,
    typescript_runner: TypeScriptRunner,
) -> dict[str, Any]:
    coverage_issues = proof_coverage_issues(build_proof_coverage(corpus))
    batch_issues = validate_batch_plan(corpus, batch_sizes)
    if coverage_issues:
        return _invalid_evidence(
            "invalid_corpus",
            "proof_coverage_invalid",
            coverage_issues,
        )
    if batch_issues:
        return _invalid_evidence(
            "invalid_configuration",
            "batch_plan_invalid",
            batch_issues,
        )
    typescript_report = _safe_engine_run(
        engine="typescript",
        corpus=corpus,
        batch_size=None,
        runner=lambda: typescript_runner(corpus_path),
    )
    python_reports = [
        _safe_engine_run(
            engine="python",
            corpus=corpus,
            batch_size=batch_size,
            runner=lambda size=batch_size: python_runner(corpus, size),
        )
        for batch_size in batch_sizes
    ]
    return build_exact_replay_report(
        corpus,
        batch_sizes,
        python_reports,
        typescript_report,
    )


def run_control(
    *,
    schema_path: Path = SCHEMA_PATH,
    corpus_path: Path = CORPUS_PATH,
    evidence_path: Path = DEFAULT_EVIDENCE_PATH,
    batch_sizes: tuple[int, ...] = DEFAULT_BATCH_SIZES,
    python_runner: PythonBatchRunner = _default_python_runner,
    typescript_runner: TypeScriptRunner = run_typescript_corpus,
) -> dict[str, Any]:
    corpus, invalidity, diagnostics = validate_for_execution(schema_path, corpus_path)
    if corpus is None:
        report = _invalid_evidence(
            "invalid_corpus",
            invalidity or "corpus_invalid",
            diagnostics,
        )
    else:
        report = _run_validated_control(
            corpus,
            corpus_path,
            batch_sizes,
            python_runner,
            typescript_runner,
        )
    write_evidence(report, evidence_path)
    return report


def _print_summary(report: dict[str, Any]) -> None:
    print(f"Rejeu statistique exact : statut={report['status']}, contrôle=informatif.")
    if report["status"] in {"invalid_corpus", "invalid_configuration"}:
        print(
            f"Preuve inexécutable ({report['invalidity']}) : "
            f"{len(report['diagnostics'])} diagnostic(s)."
        )
        return
    summary = report["summary"]
    print(
        f"Cas={summary['case_count']}; "
        f"comparaisons normatives={summary['normative_matches']}/"
        f"{summary['normative_comparisons']}; "
        f"comparaisons interlangages={summary['interlanguage_matches']}/"
        f"{summary['interlanguage_comparisons']}; "
        f"batching indépendant={summary['batch_independent_cases']}/"
        f"{summary['case_count']}; diagnostics={summary['diagnostic_count']}."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", type=Path, default=SCHEMA_PATH)
    parser.add_argument("--corpus", type=Path, default=CORPUS_PATH)
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE_PATH)
    parser.add_argument("--batch-size", type=int, action="append", dest="batch_sizes")
    args = parser.parse_args(argv)
    batch_sizes = tuple(args.batch_sizes) if args.batch_sizes is not None else DEFAULT_BATCH_SIZES
    report = run_control(
        schema_path=args.schema,
        corpus_path=args.corpus,
        evidence_path=args.evidence,
        batch_sizes=batch_sizes,
    )
    _print_summary(report)
    return (
        1
        if report["status"]
        in {
            "invalid_corpus",
            "invalid_configuration",
            "engine_error",
        }
        else 0
    )


if __name__ == "__main__":
    raise SystemExit(main())
