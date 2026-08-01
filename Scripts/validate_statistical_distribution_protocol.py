#!/usr/bin/env python3
"""Valider indépendamment le protocole de parité distributionnelle."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.statistical_distribution_protocol import (  # noqa: E402
    CORPUS_PATH,
    PROTOCOL_PATH,
    PROTOCOL_SCHEMA_PATH,
    SEEDS_PATH,
    SEEDS_SCHEMA_PATH,
    ProtocolBundleError,
    partitioned_seeds,
    validate_protocol_bundle,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--protocol", type=Path, default=PROTOCOL_PATH)
    parser.add_argument("--protocol-schema", type=Path, default=PROTOCOL_SCHEMA_PATH)
    parser.add_argument("--seeds", type=Path, default=SEEDS_PATH)
    parser.add_argument("--seeds-schema", type=Path, default=SEEDS_SCHEMA_PATH)
    parser.add_argument("--corpus", type=Path, default=CORPUS_PATH)
    args = parser.parse_args(argv)
    try:
        protocol, seeds, _corpus = validate_protocol_bundle(
            protocol_path=args.protocol,
            protocol_schema_path=args.protocol_schema,
            seeds_path=args.seeds,
            seeds_schema_path=args.seeds_schema,
            corpus_path=args.corpus,
        )
    except ProtocolBundleError as exc:
        print(f"Protocole distributionnel invalide ({exc.classification}).")
        for diagnostic in exc.diagnostics:
            print(f"- {diagnostic}")
        return 1
    cohorts = partitioned_seeds(seeds)
    print(
        f"Protocole distributionnel {protocol['version']} valide : "
        f"{len(protocol['scenarios'])} scénarios, "
        f"{sum(map(len, cohorts.values()))} seeds reproductibles."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
