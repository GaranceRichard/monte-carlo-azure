"""Independent authority validation used before statistical proof execution."""

from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from Scripts.statistical_compatibility_authority import (
    semantic_diagnostics,
    structural_diagnostics,
)
from Scripts.statistical_distribution_protocol import (
    ProtocolBundleError,
    validate_protocol_bundle,
)
from Scripts.statistical_main_enforcement_common import (
    load_json,
    load_policy,
    schema_issues,
)
from Scripts.statistical_reference_corpus_validation import validate_reference_corpus
from Scripts.validate_statistical_reference_corpus import (
    validate_contract,
    validate_input_rejection_probes,
)

SCHEMA_PATHS = (
    "contracts/statistical-reference-corpus-v1.0.schema.json",
    "contracts/statistical-validation-probes-v1.0.schema.json",
    "contracts/statistical-parity-report-v1.1.schema.json",
    "contracts/statistical-exact-replay-evidence-v1.0.schema.json",
    "contracts/statistical-distribution-protocol-v1.0.schema.json",
    "contracts/statistical-distribution-seeds-v1.0.schema.json",
    "contracts/statistical-distribution-evidence-v1.0.schema.json",
    "contracts/statistical-compatibility-authority-v1.0.schema.json",
    "contracts/statistical-compatibility-evidence-v1.0.schema.json",
    "contracts/statistical-consolidated-report-v1.0.schema.json",
)


def _validate_schema_file(root: Path, relative: str) -> list[str]:
    try:
        schema = load_json(root / relative)
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        return [f"{relative}: {exc}"]
    if not isinstance(schema, dict):
        return [f"{relative}: schema must be a JSON object"]
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        return [f"{relative}: schema is invalid: {exc.message}"]
    return []


def validate_authorities(root: Path) -> list[str]:
    _policy, issues = load_policy(root)
    for relative in SCHEMA_PATHS:
        issues.extend(_validate_schema_file(root, relative))
    try:
        authority = load_json(root / "contracts/statistical-compatibility-authority-v1.0.json")
        schema = load_json(root / "contracts/statistical-compatibility-authority-v1.0.schema.json")
        issues.extend(item.corrective_action for item in structural_diagnostics(authority, schema))
        if isinstance(authority, dict):
            issues.extend(item.corrective_action for item in semantic_diagnostics(authority))
        vectors = load_json(root / "contracts/mca-prng-v1-vectors.json")
        if vectors.get("contractId") != "mca-prng-v1" or vectors.get("version") != 1:
            issues.append("PRNG vectors have an incompatible identity or version")
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        issues.append(f"authority cannot be loaded: {exc}")
    return issues


def validate_corpus(root: Path) -> list[str]:
    try:
        schema = load_json(root / "contracts/statistical-reference-corpus-v1.0.schema.json")
        corpus = load_json(root / "contracts/statistical-reference-corpus-v1.0.json")
        probe_schema = load_json(root / "contracts/statistical-validation-probes-v1.0.schema.json")
        probes = load_json(root / "contracts/statistical-validation-probes-v1.0.json")
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        return [str(exc)]
    corpus_path = Path("contracts/statistical-reference-corpus-v1.0.json")
    issues = [
        item.render(corpus_path)
        for item in validate_reference_corpus(corpus, schema, validate_contract)
    ]
    issues.extend(validate_input_rejection_probes(corpus, schema))
    issues.extend(schema_issues(probes, probe_schema))
    incompatible = (
        probes.get("schema_version") != "1.0"
        or probes.get("normative_contract") != "STD-STAT-001"
    )
    if incompatible:
        issues.append("validation probes have an incompatible authority or version")
    return issues


def validate_protocol(root: Path) -> list[str]:
    try:
        validate_protocol_bundle(
            protocol_path=root / "contracts/statistical-distribution-protocol-v1.0.json",
            protocol_schema_path=(
                root / "contracts/statistical-distribution-protocol-v1.0.schema.json"
            ),
            seeds_path=root / "contracts/statistical-distribution-seeds-v1.0.json",
            seeds_schema_path=root / "contracts/statistical-distribution-seeds-v1.0.schema.json",
            corpus_path=root / "contracts/statistical-reference-corpus-v1.0.json",
        )
    except ProtocolBundleError as exc:
        return [f"{exc.classification}: {item}" for item in exc.diagnostics]
    return []
