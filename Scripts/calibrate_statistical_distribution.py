#!/usr/bin/env python3
"""Calibrer et écrire la preuve contrôlée du protocole distributionnel."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.statistical_distribution_calibration import (  # noqa: E402
    build_calibration_report,
)
from Scripts.statistical_distribution_protocol import (  # noqa: E402
    PROTOCOL_PATH,
    PROTOCOL_SCHEMA_PATH,
    SEEDS_PATH,
    SEEDS_SCHEMA_PATH,
    ProtocolBundleError,
    validate_protocol_bundle,
)

DEFAULT_OUTPUT = ROOT / "reports/statistical-distribution-calibration.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--protocol", type=Path, default=PROTOCOL_PATH)
    parser.add_argument("--protocol-schema", type=Path, default=PROTOCOL_SCHEMA_PATH)
    parser.add_argument("--seeds", type=Path, default=SEEDS_PATH)
    parser.add_argument("--seeds-schema", type=Path, default=SEEDS_SCHEMA_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)
    try:
        protocol, _seeds, _corpus = validate_protocol_bundle(
            protocol_path=args.protocol,
            protocol_schema_path=args.protocol_schema,
            seeds_path=args.seeds,
            seeds_schema_path=args.seeds_schema,
        )
    except ProtocolBundleError as exc:
        print(f"Calibration impossible ({exc.classification}).")
        return 1
    report = build_calibration_report(protocol)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    sensitivity_values = [
        value
        for key, value in report["production_sensitivity"].items()
        if key not in {"minimum_required_power", "passed"}
    ]
    print(
        f"Calibration distributionnelle : statut={report['status']}, "
        f"faux positifs={report['false_positive']['observed_rate']}, "
        f"puissance minimale={min(sensitivity_values)}."
    )
    return 0 if report["status"] == "calibrated" else 1


if __name__ == "__main__":
    raise SystemExit(main())
