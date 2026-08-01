#!/usr/bin/env python3
"""Exécuter le protocole informatif de parité distributionnelle."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.statistical_distribution_protocol import (  # noqa: E402
    CORPUS_PATH,
    PROTOCOL_PATH,
    PROTOCOL_SCHEMA_PATH,
    SEEDS_PATH,
    SEEDS_SCHEMA_PATH,
    ProtocolBundleError,
    validate_protocol_bundle,
)
from Scripts.statistical_distribution_runner import (  # noqa: E402
    EngineExecutionError,
    InfrastructureError,
    build_distribution_evidence,
    build_execution_plan,
    invalid_evidence,
    run_python_plan,
    run_typescript_plan,
    validate_engine_report,
    write_evidence,
)

DEFAULT_EVIDENCE_PATH = ROOT / "reports/statistical-distribution-evidence.json"
EngineRunner = Callable[[dict[str, Any]], dict[str, Any]]


def run_control(
    *,
    protocol_path: Path = PROTOCOL_PATH,
    protocol_schema_path: Path = PROTOCOL_SCHEMA_PATH,
    seeds_path: Path = SEEDS_PATH,
    seeds_schema_path: Path = SEEDS_SCHEMA_PATH,
    corpus_path: Path = CORPUS_PATH,
    evidence_path: Path = DEFAULT_EVIDENCE_PATH,
    python_runner: EngineRunner = run_python_plan,
    typescript_runner: EngineRunner = run_typescript_plan,
) -> dict[str, Any]:
    try:
        protocol, seeds, corpus = validate_protocol_bundle(
            protocol_path=protocol_path,
            protocol_schema_path=protocol_schema_path,
            seeds_path=seeds_path,
            seeds_schema_path=seeds_schema_path,
            corpus_path=corpus_path,
        )
        python_plan = build_execution_plan(protocol, seeds, corpus, "python")
        typescript_plan = build_execution_plan(protocol, seeds, corpus, "typescript")
        python_report = python_runner(python_plan)
        typescript_report = typescript_runner(typescript_plan)
        validate_engine_report(python_report, python_plan, "python")
        validate_engine_report(typescript_report, typescript_plan, "typescript")
        report = build_distribution_evidence(
            protocol, seeds, corpus, python_report, typescript_report,
        )
    except ProtocolBundleError as exc:
        report = invalid_evidence(exc.classification, exc.diagnostics)
    except EngineExecutionError as exc:
        report = invalid_evidence("engine_error", [str(exc)])
    except InfrastructureError as exc:
        report = invalid_evidence("infrastructure_error", [str(exc)])
    write_evidence(report, evidence_path)
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--protocol", type=Path, default=PROTOCOL_PATH)
    parser.add_argument("--protocol-schema", type=Path, default=PROTOCOL_SCHEMA_PATH)
    parser.add_argument("--seeds", type=Path, default=SEEDS_PATH)
    parser.add_argument("--seeds-schema", type=Path, default=SEEDS_SCHEMA_PATH)
    parser.add_argument("--corpus", type=Path, default=CORPUS_PATH)
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE_PATH)
    args = parser.parse_args(argv)
    report = run_control(
        protocol_path=args.protocol,
        protocol_schema_path=args.protocol_schema,
        seeds_path=args.seeds,
        seeds_schema_path=args.seeds_schema,
        corpus_path=args.corpus,
        evidence_path=args.evidence,
    )
    summary = report["summary"]
    print(
        f"Parité distributionnelle : statut={report['status']}, contrôle=informatif, "
        f"métriques={summary['metric_count']}, divergences={summary['divergences']}, "
        f"non concluantes={summary['inconclusive']}."
    )
    return 1 if report["status"] == "invalid" else 0


if __name__ == "__main__":
    raise SystemExit(main())
