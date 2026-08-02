"""Run-scoped compatibility-proof freshness checks."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from Scripts.statistical_compatibility_extractors import json_document_fingerprint
from Scripts.statistical_main_enforcement_common import load_json


def compatibility_proof_issues(
    root: Path, report: dict[str, Any], requirements: list[Path]
) -> list[str]:
    expected = {
        "deterministic_parity": "deterministic-parity",
        "exact_replay": "exact-replay",
        "distributional_parity": "distribution-evidence",
    }
    proofs = {item["id"]: item for item in report["proof_artifacts"]}
    issues: list[str] = []
    seen: set[str] = set()
    for requirement in requirements:
        value = load_json(requirement if requirement.is_absolute() else root / requirement)
        for control in set(value["control_ids"]) & set(expected):
            proof_id = expected[control]
            path = value["artifacts"][0]["path"]
            actual = json_document_fingerprint(root, path)
            seen.add(proof_id)
            if proofs[proof_id]["actual_semantic_fingerprint"] != actual:
                issues.append(f"compatibility evidence is stale for {proof_id}")
    missing = set(expected.values()) - seen
    if missing:
        issues.append(f"current-run compatibility proofs are missing: {', '.join(sorted(missing))}")
    return issues
