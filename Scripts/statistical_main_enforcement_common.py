"""Policy, snapshot and attestation primitives for statistical main enforcement."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from Scripts.statistical_main_policy import (
    ATTESTATION_SCHEMA_PATH,
    CONTROL_IDS,
    canonical_sha,
    file_sha,
    load_json,
    load_policy,
    schema_issues,
)

SNAPSHOT_ROOTS = (
    ".github",
    ".githooks",
    ".vscode",
    "backend",
    "config",
    "contracts",
    "docs",
    "frontend/scripts",
    "frontend/src",
    "Scripts",
)
SNAPSHOT_FILES = (
    ".coveragerc",
    "AGENTS.md",
    "ARCHITECTURE.md",
    "CHANGELOG.md",
    "README.md",
    "frontend/package-lock.json",
    "frontend/package.json",
    "frontend/vitest.config.js",
    "pyproject.toml",
    "pytest.ini",
    "requirements.txt",
)


def _snapshot_files(root: Path) -> tuple[Path, ...]:
    paths = {root / relative for relative in SNAPSHOT_FILES if (root / relative).is_file()}
    for relative in SNAPSHOT_ROOTS:
        base = root / relative
        if not base.is_dir():
            continue
        paths.update(
            path
            for path in base.rglob("*")
            if path.is_file()
            and "__pycache__" not in path.parts
            and "node_modules" not in path.parts
        )
    return tuple(sorted(paths, key=lambda path: path.relative_to(root).as_posix()))


def snapshot_identity(root: Path) -> dict[str, Any]:
    digest = hashlib.sha256()
    files = _snapshot_files(root)
    for path in files:
        relative = path.relative_to(root).as_posix().encode("utf-8")
        content = path.read_bytes()
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return {
        "method": "sha256-controlled-snapshot-v1",
        "sha256": digest.hexdigest(),
        "file_count": len(files),
    }


def _inside_root(root: Path, path: Path) -> tuple[Path, Path]:
    resolved = (path if path.is_absolute() else root / path).resolve()
    try:
        relative = resolved.relative_to(root.resolve())
    except ValueError as exc:
        raise ValueError(f"path escapes the controlled snapshot: {path}") from exc
    return resolved, relative


def _artifact_entries(root: Path, paths: list[Path]) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for path in paths:
        resolved, relative = _inside_root(root, path)
        if not resolved.is_file():
            raise ValueError(f"attested artifact is missing: {relative.as_posix()}")
        entries.append({"path": relative.as_posix(), "sha256": file_sha(resolved)})
    return entries


def write_attestation(
    root: Path, output: Path, controls: list[str], artifacts: list[Path]
) -> None:
    policy, issues = load_policy(root)
    if issues:
        raise ValueError("; ".join(issues))
    valid_controls = set(CONTROL_IDS) | {"authority_preflight"}
    if not controls or set(controls) - valid_controls:
        raise ValueError("attestation controls are absent from the closed catalog")
    value = {
        "schema_version": "1.0",
        "control_ids": controls,
        "snapshot": snapshot_identity(root),
        "policy": {
            "id": policy["policy_id"],
            "version": policy["version"],
            "sha256": canonical_sha(policy),
        },
        "artifacts": _artifact_entries(root, artifacts),
    }
    issues = schema_issues(value, load_json(root / ATTESTATION_SCHEMA_PATH))
    if issues:
        raise ValueError("; ".join(issues))
    destination, _relative = _inside_root(root, output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _snapshot_label(value: dict[str, Any]) -> str:
    return (
        f"{value.get('method')}:{value.get('sha256')}"
        f":files={value.get('file_count')}"
    )


def verify_attestation(
    root: Path,
    path: Path,
    *,
    consumer_controls: set[str] | None = None,
) -> list[str]:
    resolved = path if path.is_absolute() else root / path
    try:
        value = load_json(resolved)
        policy, policy_issues = load_policy(root)
        issues = schema_issues(value, load_json(root / ATTESTATION_SCHEMA_PATH))
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        return [f"attestation unavailable: {resolved}: {exc}"]
    issues.extend(policy_issues)
    if issues or not isinstance(value, dict):
        return issues
    expected_snapshot = snapshot_identity(root)
    if value["snapshot"] != expected_snapshot:
        consumer = ",".join(sorted(consumer_controls or set())) or "unspecified"
        issues.append(
            "artifact comes from another snapshot: "
            f"attestation={resolved}; consumer_controls={consumer}; "
            f"workspace_root={root.resolve()}; "
            f"expected_recalculated={_snapshot_label(expected_snapshot)}; "
            f"observed_declared={_snapshot_label(value['snapshot'])}"
        )
    if value["policy"]["sha256"] != canonical_sha(policy):
        issues.append(f"attestation uses another enforcement policy: {resolved}")
    for artifact in value["artifacts"]:
        try:
            artifact_path, _relative = _inside_root(root, Path(artifact["path"]))
        except ValueError as exc:
            issues.append(str(exc))
            continue
        if not artifact_path.is_file():
            issues.append(f"attested artifact is missing: {artifact['path']}")
        elif file_sha(artifact_path) != artifact["sha256"]:
            issues.append(f"attested artifact fingerprint is invalid: {artifact['path']}")
    return issues


def verify_requirements(
    root: Path,
    paths: list[Path],
    expected_controls: set[str],
    *,
    consumer_controls: set[str] | None = None,
) -> list[str]:
    issues: list[str] = []
    observed: set[str] = set()
    for path in paths:
        current = verify_attestation(
            root,
            path,
            consumer_controls=consumer_controls,
        )
        issues.extend(current)
        resolved = path if path.is_absolute() else root / path
        try:
            value = load_json(resolved)
        except (OSError, UnicodeError, ValueError, json.JSONDecodeError):
            continue
        controls = value.get("control_ids") if isinstance(value, dict) else None
        if isinstance(controls, list) and all(isinstance(item, str) for item in controls):
            observed.update(controls)
    missing = expected_controls - observed
    unexpected = observed - expected_controls
    if missing:
        issues.append(f"required attestations are missing controls: {', '.join(sorted(missing))}")
    if unexpected:
        issues.append(
            f"requirement chain contains incoherent controls: {', '.join(sorted(unexpected))}"
        )
    return issues
