#!/usr/bin/env python3
"""Valider la preuve de calibration distributionnelle et sa reproductibilité."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.statistical_distribution_calibration import (  # noqa: E402
    build_calibration_report,
    verify_calibration_fingerprint,
)
from Scripts.statistical_distribution_protocol import (  # noqa: E402
    PROTOCOL_PATH,
    PROTOCOL_SCHEMA_PATH,
    SEEDS_PATH,
    SEEDS_SCHEMA_PATH,
    ProtocolBundleError,
    load_json,
    schema_issues,
    validate_protocol_bundle,
)

SCHEMA_PATH = ROOT / "contracts/statistical-distribution-calibration-v1.0.schema.json"
REPORT_PATH = ROOT / "reports/statistical-distribution-calibration.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--protocol", type=Path, default=PROTOCOL_PATH)
    parser.add_argument("--protocol-schema", type=Path, default=PROTOCOL_SCHEMA_PATH)
    parser.add_argument("--seeds", type=Path, default=SEEDS_PATH)
    parser.add_argument("--seeds-schema", type=Path, default=SEEDS_SCHEMA_PATH)
    parser.add_argument("--schema", type=Path, default=SCHEMA_PATH)
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    args = parser.parse_args(argv)
    try:
        protocol, _seeds, _corpus = validate_protocol_bundle(
            protocol_path=args.protocol,
            protocol_schema_path=args.protocol_schema,
            seeds_path=args.seeds,
            seeds_schema_path=args.seeds_schema,
        )
        report = load_json(args.report)
        issues = schema_issues(report, load_json(args.schema), "calibration")
    except ProtocolBundleError as exc:
        issues = exc.diagnostics
        report = None
        protocol = None
    if report is not None and protocol is not None:
        if not verify_calibration_fingerprint(report):
            issues.append("L'empreinte de calibration est incohérente.")
        if report != build_calibration_report(protocol):
            issues.append("La calibration ne se reproduit pas exactement.")
    if issues:
        print("Calibration distributionnelle invalide.")
        for issue in issues:
            print(f"- {issue}")
        return 1
    print(
        f"Calibration distributionnelle valide : "
        f"faux positifs={report['false_positive']['observed_rate']}, "
        f"statut={report['status']}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
