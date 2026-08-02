"""Compatibility and consolidation tail of the statistical quality-gate DAG."""

from __future__ import annotations

import sys
from typing import Any


def _source_paths(paths: dict[str, str]) -> tuple[str, ...]:
    return (
        f"deterministic_parity={paths['parity_json']}",
        f"exact_replay={paths['exact_json']}",
        f"distribution_evidence={paths['distribution_json']}",
        f"compatibility_evidence={paths['compatibility_json']}",
    )


def _generator_argv(paths: dict[str, str]) -> tuple[str, ...]:
    argv = [
        sys.executable,
        "Scripts/generate_statistical_consolidated_report.py",
        "--json-report",
        paths["consolidated_json"],
        "--markdown-report",
        paths["consolidated_md"],
    ]
    for value in _source_paths(paths):
        argv.extend(("--source-path", value))
    return tuple(argv)


def _validator_argv(
    paths: dict[str, str], requirements: tuple[str, ...]
) -> tuple[str, ...]:
    argv = [
        sys.executable,
        "Scripts/statistical_main_enforcement.py",
        "validate-consolidated",
        "--report",
        paths["consolidated_json"],
        "--schema",
        "contracts/statistical-consolidated-report-v1.0.schema.json",
        "--markdown",
        paths["consolidated_md"],
        "--output",
        paths["consolidated_attestation"],
    ]
    for value in _source_paths(paths):
        argv.extend(("--source-path", value))
    for requirement in requirements:
        argv.extend(("--requires", requirement))
    return tuple(argv)


def consolidated_commands(
    q: Any, inputs: tuple[Any, ...], paths: dict[str, str]
) -> list[Any]:
    requirements = (
        paths["parity_attestation"],
        paths["exact_attestation"],
        paths["batch_attestation"],
        paths["distribution_attestation"],
        paths["compatibility_attestation"],
    )
    return [
        q.GateCommand(
            "Generate current-run consolidated statistical report",
            _generator_argv(paths),
            "Restore every specialized proof before regenerating the consolidated report.",
            input_sources=inputs,
        ),
        q.GateCommand(
            "Independently validate current-run consolidated statistical report",
            _validator_argv(paths, requirements),
            "Correct the report schema, fingerprint, Markdown projection, or source freshness.",
            input_sources=inputs,
        ),
    ]
