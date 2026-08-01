#!/usr/bin/env python3
"""Valider indépendamment une preuve de parité distributionnelle."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.statistical_distribution_evidence import (  # noqa: E402
    EVIDENCE_SCHEMA_PATH,
    validate_evidence,
)
from Scripts.statistical_distribution_protocol import ProtocolBundleError  # noqa: E402

DEFAULT_EVIDENCE_PATH = ROOT / "reports/statistical-distribution-evidence.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence", nargs="?", type=Path, default=DEFAULT_EVIDENCE_PATH)
    parser.add_argument("--schema", type=Path, default=EVIDENCE_SCHEMA_PATH)
    args = parser.parse_args(argv)
    try:
        report, issues = validate_evidence(args.evidence, args.schema)
    except ProtocolBundleError as exc:
        issues = exc.diagnostics
        report = None
    if report is None:
        print("Preuve distributionnelle invalide.")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print(
        f"Preuve distributionnelle valide : statut={report['status']}, "
        f"scénarios={report['summary']['scenario_count']}, "
        f"métriques={report['summary']['metric_count']}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
