"""Versioned source catalog for consolidated statistical evidence."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceDefinition:
    source_id: str
    kind: str
    path: str
    expected_id: str
    expected_version: str
    id_path: tuple[str, ...] = ()
    version_path: tuple[str, ...] = ()
    schema_path: str | None = None
    stale_version: bool = False


SOURCE_DEFINITIONS = (
    SourceDefinition(
        "normative_standard",
        "normative_contract",
        "docs/standards/STD-STAT-001.md",
        "STD-STAT-001",
        "1.0",
    ),
    SourceDefinition(
        "prng_vectors",
        "prng_contract",
        "contracts/mca-prng-v1-vectors.json",
        "mca-prng-v1",
        "1.0",
        ("contractId",),
        ("version",),
    ),
    SourceDefinition(
        "reference_corpus",
        "normative_corpus",
        "contracts/statistical-reference-corpus-v1.0.json",
        "mca-statistical-reference-corpus",
        "1.0",
        ("corpus_id",),
        ("schema_version",),
        "contracts/statistical-reference-corpus-v1.0.schema.json",
    ),
    SourceDefinition(
        "validation_probes",
        "validation_contract",
        "contracts/statistical-validation-probes-v1.0.json",
        "mca-statistical-validation-probes",
        "1.0",
        version_path=("schema_version",),
        schema_path="contracts/statistical-validation-probes-v1.0.schema.json",
    ),
    SourceDefinition(
        "deterministic_parity",
        "deterministic_evidence",
        "reports/statistical-parity-report.json",
        "mca-statistical-parity-report",
        "1.1",
        version_path=("report_version",),
        schema_path="contracts/statistical-parity-report-v1.1.schema.json",
        stale_version=True,
    ),
    SourceDefinition(
        "exact_replay",
        "exact_evidence",
        "reports/statistical-exact-replay-evidence.json",
        "exact_replay",
        "1.0",
        ("proof_kind",),
        ("report_version",),
        "contracts/statistical-exact-replay-evidence-v1.0.schema.json",
        True,
    ),
    SourceDefinition(
        "distribution_protocol",
        "distributional_protocol",
        "contracts/statistical-distribution-protocol-v1.0.json",
        "mca-statistical-distributional-parity",
        "1.0",
        ("protocol_id",),
        ("version",),
        "contracts/statistical-distribution-protocol-v1.0.schema.json",
    ),
    SourceDefinition(
        "distribution_seed_population",
        "seed_population",
        "contracts/statistical-distribution-seeds-v1.0.json",
        "mca-distributional-seed-population",
        "1.0",
        ("population_id",),
        ("version",),
        "contracts/statistical-distribution-seeds-v1.0.schema.json",
    ),
    SourceDefinition(
        "distribution_calibration",
        "calibration_evidence",
        "reports/statistical-distribution-calibration.json",
        "mca-distributional-calibration",
        "1.0",
        ("method",),
        ("calibration_version",),
        "contracts/statistical-distribution-calibration-v1.0.schema.json",
        True,
    ),
    SourceDefinition(
        "distribution_evidence",
        "distributional_evidence",
        "reports/statistical-distribution-evidence.json",
        "distributional_parity",
        "1.0",
        ("proof_kind",),
        ("evidence_version",),
        "contracts/statistical-distribution-evidence-v1.0.schema.json",
        True,
    ),
    SourceDefinition(
        "compatibility_evidence",
        "compatibility_evidence",
        "reports/statistical-compatibility-evidence.json",
        "statistical_compatibility",
        "1.0",
        ("proof_kind",),
        ("evidence_version",),
        "contracts/statistical-compatibility-evidence-v1.0.schema.json",
        True,
    ),
)
