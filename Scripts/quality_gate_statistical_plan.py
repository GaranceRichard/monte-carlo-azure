"""Commands for the blocking statistical sub-DAG inherited from the main profile."""

from __future__ import annotations

import sys
from typing import Any

from Scripts.quality_gate_statistical_command import enforcement_command
from Scripts.quality_gate_statistical_report_plan import consolidated_commands


def _paths(profile: str) -> dict[str, str]:
    root = f"reports/test-execution-artifacts/{profile}"
    return {
        "authority": f"{root}/statistical-authorities/authority-attestation.json",
        "corpus": f"{root}/statistical-authorities/corpus-attestation.json",
        "protocol": f"{root}/statistical-authorities/protocol-attestation.json",
        "parity_json": f"{root}/statistical-deterministic-parity/parity.json",
        "parity_md": f"{root}/statistical-deterministic-parity/parity.md",
        "parity_attestation": f"{root}/statistical-deterministic-parity/attestation.json",
        "exact_json": f"{root}/statistical-exact-replay/evidence.json",
        "exact_attestation": f"{root}/statistical-exact-replay/exact-attestation.json",
        "batch_attestation": f"{root}/statistical-exact-replay/batching-attestation.json",
        "distribution_json": f"{root}/statistical-distributional-parity/evidence.json",
        "distribution_attestation": f"{root}/statistical-distributional-parity/attestation.json",
        "compatibility_json": f"{root}/statistical-compatibility/evidence.json",
        "compatibility_attestation": f"{root}/statistical-compatibility/attestation.json",
        "consolidated_json": f"{root}/statistical-consolidated-report/report.json",
        "consolidated_md": f"{root}/statistical-consolidated-report/report.md",
        "consolidated_attestation": f"{root}/statistical-consolidated-report/attestation.json",
    }


def _authority_commands(q: Any, inputs: tuple[Any, ...], paths: dict[str, str]) -> list[Any]:
    script = "Scripts/statistical_main_enforcement.py"
    return [
        q.GateCommand(
            "Statistical authority and enforcement policy validation",
            (sys.executable, script, "validate-authorities", "--output", paths["authority"]),
            "Restore the closed schemas, authority identities, versions, and enforcement policy.",
            input_sources=inputs,
        ),
        q.GateCommand(
            "Statistical corpus and probes validation",
            (
                sys.executable,
                script,
                "validate-corpus",
                "--requires",
                paths["authority"],
                "--output",
                paths["corpus"],
            ),
            "Correct the corpus or validation probes without weakening their contracts.",
            input_sources=inputs,
        ),
        q.GateCommand(
            "Statistical distribution protocol validation",
            (
                sys.executable,
                script,
                "validate-protocol",
                "--requires",
                paths["authority"],
                "--requires",
                paths["corpus"],
                "--output",
                paths["protocol"],
            ),
            "Correct the distribution protocol, seed population, or version bindings.",
            input_sources=inputs,
        ),
    ]


def _parity_commands(q: Any, inputs: tuple[Any, ...], paths: dict[str, str]) -> list[Any]:
    return [
        q.GateCommand(
            "Generate deterministic statistical parity evidence",
            (
                sys.executable,
                "Scripts/run_statistical_reference_corpus.py",
                "--json-report",
                paths["parity_json"],
                "--markdown-report",
                paths["parity_md"],
            ),
            "Correct the failing corpus engine or validation-probe execution.",
            input_sources=inputs,
            requires_frontend_dependencies=True,
        ),
        enforcement_command(
            q,
            inputs,
            step="Blocking deterministic statistical parity",
            kind="parity",
            artifact=paths["parity_json"],
            schema="contracts/statistical-parity-report-v1.1.schema.json",
            output=paths["parity_attestation"],
            requirements=(paths["authority"], paths["corpus"]),
            controls=("deterministic_parity",),
            reproduce="python Scripts/run_statistical_reference_corpus.py",
        ),
    ]


def _exact_commands(q: Any, inputs: tuple[Any, ...], paths: dict[str, str]) -> list[Any]:
    requirements = (paths["authority"], paths["corpus"])
    return [
        q.GateCommand(
            "Generate exact replay and batching evidence",
            (
                sys.executable,
                "Scripts/run_statistical_exact_replay.py",
                "--evidence",
                paths["exact_json"],
            ),
            "Correct the exact Python-TypeScript replay or batching execution.",
            input_sources=inputs,
            requires_frontend_dependencies=True,
        ),
        enforcement_command(
            q,
            inputs,
            step="Blocking exact interlanguage replay",
            kind="exact",
            artifact=paths["exact_json"],
            schema="contracts/statistical-exact-replay-evidence-v1.0.schema.json",
            output=paths["exact_attestation"],
            requirements=requirements,
            controls=("exact_replay",),
            reproduce="python Scripts/run_statistical_exact_replay.py",
        ),
        enforcement_command(
            q,
            inputs,
            step="Blocking statistical batching independence",
            kind="batching",
            artifact=paths["exact_json"],
            schema="contracts/statistical-exact-replay-evidence-v1.0.schema.json",
            output=paths["batch_attestation"],
            requirements=(*requirements, paths["exact_attestation"]),
            controls=("batching_independence",),
            reproduce="python Scripts/run_statistical_exact_replay.py",
        ),
    ]


def _distribution_commands(
    q: Any, inputs: tuple[Any, ...], paths: dict[str, str]
) -> list[Any]:
    return [
        q.GateCommand(
            "Generate distributional statistical parity evidence",
            (
                sys.executable,
                "Scripts/run_statistical_distribution.py",
                "--evidence",
                paths["distribution_json"],
            ),
            "Correct the distribution engine, protocol, infrastructure, or observed divergence.",
            input_sources=inputs,
            requires_frontend_dependencies=True,
        ),
        enforcement_command(
            q,
            inputs,
            step="Blocking distributional statistical parity",
            kind="distribution",
            artifact=paths["distribution_json"],
            schema="contracts/statistical-distribution-evidence-v1.0.schema.json",
            output=paths["distribution_attestation"],
            requirements=(paths["authority"], paths["corpus"], paths["protocol"]),
            controls=("distributional_parity",),
            reproduce="python Scripts/run_statistical_distribution.py",
        ),
    ]


def _proof_paths(paths: dict[str, str]) -> tuple[str, ...]:
    return (
        f"deterministic-parity={paths['parity_json']}",
        f"exact-replay={paths['exact_json']}",
        f"distribution-evidence={paths['distribution_json']}",
    )


def _compatibility_commands(
    q: Any, inputs: tuple[Any, ...], paths: dict[str, str]
) -> list[Any]:
    argv = [
        sys.executable,
        "Scripts/run_statistical_compatibility.py",
        "--output",
        paths["compatibility_json"],
    ]
    for value in _proof_paths(paths):
        argv.extend(("--proof-path", value))
    requirements = (
        paths["authority"],
        paths["corpus"],
        paths["protocol"],
        paths["parity_attestation"],
        paths["exact_attestation"],
        paths["batch_attestation"],
        paths["distribution_attestation"],
    )
    return [
        q.GateCommand(
            "Generate blocking statistical compatibility evidence",
            tuple(argv),
            "Declare the missing compatibility decision, version, proof, or migration.",
            input_sources=inputs,
        ),
        enforcement_command(
            q,
            inputs,
            step="Blocking statistical version compatibility",
            kind="compatibility",
            artifact=paths["compatibility_json"],
            schema="contracts/statistical-compatibility-evidence-v1.0.schema.json",
            output=paths["compatibility_attestation"],
            requirements=requirements,
            controls=("statistical_compatibility",),
            reproduce="python Scripts/run_statistical_compatibility.py",
        ),
    ]


def statistical_commands(q: Any, profile: str, inputs: tuple[Any, ...]) -> tuple[Any, ...]:
    """Return every current-run command once, in topological node order."""
    if profile == "pr":
        return ()
    paths = _paths(profile)
    return tuple(
        [
            *_authority_commands(q, inputs, paths),
            *_parity_commands(q, inputs, paths),
            *_exact_commands(q, inputs, paths),
            *_distribution_commands(q, inputs, paths),
            *_compatibility_commands(q, inputs, paths),
            *consolidated_commands(q, inputs, paths),
        ]
    )
