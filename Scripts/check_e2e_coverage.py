#!/usr/bin/env python3
"""Validate the current E2E coverage artifact and enforce all configured thresholds."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "frontend" / "e2e-coverage.config.json"
DEFAULT_ARTIFACT = ROOT / "frontend" / "coverage" / "e2e-coverage-summary.json"
METRICS = ("statements", "branches", "functions", "lines")


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def coverage_scope_fingerprint(scope: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical_json(scope).encode("utf-8")).hexdigest()


def _load_json(path: Path, label: str) -> tuple[dict[str, Any] | None, list[str]]:
    if not path.exists():
        return None, [f"Missing {label}: {path}"]
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return None, [f"Invalid {label} JSON: {path}: {exc}"]
    if not isinstance(payload, dict):
        return None, [f"Invalid {label} schema: top-level value must be an object."]
    return payload, []


def validate_config(config: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if config.get("schemaVersion") != 1:
        errors.append("Invalid E2E coverage config schemaVersion; expected 1.")

    max_age = config.get("artifactMaxAgeSeconds")
    if not isinstance(max_age, int) or isinstance(max_age, bool) or max_age <= 0:
        errors.append("Invalid E2E coverage artifactMaxAgeSeconds.")

    scope = config.get("scope")
    if not isinstance(scope, dict):
        errors.append("Invalid E2E coverage scope.")
    else:
        if not isinstance(scope.get("id"), str) or not scope["id"].strip():
            errors.append("Invalid E2E coverage scope id.")
        if (
            not isinstance(scope.get("urlPathPrefix"), str)
            or not scope["urlPathPrefix"].startswith("/")
        ):
            errors.append("Invalid E2E coverage scope urlPathPrefix.")
        excludes = scope.get("excludedPathSuffixes")
        if not isinstance(excludes, list) or not all(
            isinstance(item, str) and item.startswith("/") for item in excludes
        ):
            errors.append("Invalid E2E coverage excludedPathSuffixes.")

    thresholds = config.get("thresholds")
    if not isinstance(thresholds, dict):
        errors.append("Invalid E2E coverage thresholds.")
    else:
        if set(thresholds) != set(METRICS):
            errors.append(
                "E2E coverage thresholds must contain exactly statements, branches, "
                "functions and lines."
            )
        for metric in METRICS:
            threshold = thresholds.get(metric)
            if (
                not isinstance(threshold, (int, float))
                or isinstance(threshold, bool)
                or not math.isfinite(float(threshold))
                or float(threshold) < 80
                or float(threshold) > 100
            ):
                errors.append(f"Invalid E2E {metric} threshold; expected 80..100.")
    return errors


def load_validated_config(path: Path = DEFAULT_CONFIG) -> dict[str, Any]:
    config, errors = _load_json(path, "E2E coverage config")
    if config is not None:
        errors.extend(validate_config(config))
    if errors:
        raise ValueError("\n".join(errors))
    assert config is not None
    return config


def _parse_timestamp(value: Any, label: str, errors: list[str]) -> datetime | None:
    if not isinstance(value, str):
        errors.append(f"Invalid E2E artifact {label}; expected an ISO-8601 timestamp.")
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        errors.append(f"Invalid E2E artifact {label}; expected an ISO-8601 timestamp.")
        return None
    if parsed.tzinfo is None:
        errors.append(f"Invalid E2E artifact {label}; timezone is required.")
        return None
    return parsed.astimezone(timezone.utc)


def normalize_coverage_metric(
    metric_name: str,
    block: Any,
    errors: list[str],
    *,
    prefix: str = "E2E coverage",
    allow_empty: bool = False,
) -> dict[str, int | float] | None:
    if not isinstance(block, dict):
        errors.append(f"Missing {prefix} metric: {metric_name}.")
        return None
    required = ("total", "covered", "skipped", "pct")
    if any(key not in block for key in required):
        errors.append(f"Incomplete {prefix} metric: {metric_name}.")
        return None
    total = block["total"]
    covered = block["covered"]
    skipped = block["skipped"]
    pct = block["pct"]
    if (
        not isinstance(total, int)
        or isinstance(total, bool)
        or not isinstance(covered, int)
        or isinstance(covered, bool)
        or not isinstance(skipped, int)
        or isinstance(skipped, bool)
        or total < 0
        or covered < 0
        or skipped < 0
        or covered > total
        or skipped > total
    ):
        errors.append(f"Invalid {prefix} metric values: {metric_name}.")
        return None
    if total == 0:
        if not allow_empty or covered != 0 or skipped != 0:
            errors.append(f"Invalid {prefix} metric values: {metric_name}.")
            return None
        if (
            not isinstance(pct, (int, float))
            or isinstance(pct, bool)
            or not math.isfinite(float(pct))
            or abs(float(pct) - 100.0) > 0.02
        ):
            errors.append(
                f"Inconsistent {prefix} percentage for {metric_name}: "
                f"{pct} != 100.00."
            )
            return None
        return {
            "total": 0,
            "covered": 0,
            "skipped": 0,
            "pct": 100,
        }
    if (
        not isinstance(pct, (int, float))
        or isinstance(pct, bool)
        or not math.isfinite(float(pct))
    ):
        errors.append(f"Invalid {prefix} metric values: {metric_name}.")
        return None
    expected_pct = (covered / total) * 100
    if abs(float(pct) - expected_pct) > 0.02:
        errors.append(
            f"Inconsistent {prefix} percentage for {metric_name}: "
            f"{pct} != {expected_pct:.2f}."
        )
        return None
    return {
        "total": total,
        "covered": covered,
        "skipped": skipped,
        "pct": round(float(pct), 2),
    }


def _validate_metric(
    metric_name: str,
    block: Any,
    threshold: float | None,
    errors: list[str],
    *,
    prefix: str = "E2E coverage",
) -> dict[str, int | float] | None:
    normalized = normalize_coverage_metric(
        metric_name,
        block,
        errors,
        prefix=prefix,
        allow_empty=threshold is None,
    )
    if (
        normalized is not None
        and threshold is not None
        and float(normalized["pct"]) < threshold
    ):
        errors.append(
            f"E2E coverage below {threshold:g}%: "
            f"{metric_name} = {float(normalized['pct']):.2f}%."
        )
    return normalized


def validate_artifact_payload(
    artifact: dict[str, Any],
    config: dict[str, Any],
    *,
    expected_run_id: str | None = None,
    expected_started_at: str | None = None,
    now: datetime | None = None,
) -> list[str]:
    errors: list[str] = []
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    if artifact.get("schemaVersion") != 1:
        errors.append("Invalid E2E coverage artifact schemaVersion; expected 1.")
    if artifact.get("producer") != "playwright-v8-istanbul":
        errors.append("Invalid E2E coverage artifact producer.")

    context = artifact.get("context")
    if not isinstance(context, dict):
        errors.append("Missing E2E coverage execution context.")
        context = {}
    run_id = context.get("runId")
    if not isinstance(run_id, str) or not run_id.strip():
        errors.append("Missing E2E coverage runId.")
    elif expected_run_id is not None and run_id != expected_run_id:
        errors.append("E2E coverage artifact belongs to another execution.")

    scope = config["scope"]
    if context.get("scopeId") != scope["id"]:
        errors.append("E2E coverage artifact belongs to another scope.")
    if context.get("scopeFingerprint") != coverage_scope_fingerprint(scope):
        errors.append("E2E coverage artifact scope fingerprint does not match configuration.")

    started_at = _parse_timestamp(context.get("startedAt"), "startedAt", errors)
    completed_at = _parse_timestamp(context.get("completedAt"), "completedAt", errors)
    expected_start = None
    if expected_started_at is not None:
        expected_start = _parse_timestamp(
            expected_started_at,
            "expected startedAt",
            errors,
        )
        if started_at is not None and expected_start is not None and started_at != expected_start:
            errors.append("E2E coverage artifact startedAt does not match this execution.")
    if started_at is not None and completed_at is not None:
        if completed_at < started_at:
            errors.append("E2E coverage artifact completed before it started.")
        if completed_at > now:
            errors.append("E2E coverage artifact completion time is in the future.")
        age_seconds = (now - completed_at).total_seconds()
        if age_seconds > config["artifactMaxAgeSeconds"]:
            errors.append("E2E coverage artifact is stale.")

    files = artifact.get("files")
    by_file = artifact.get("byFile")
    if not isinstance(files, int) or isinstance(files, bool) or files <= 0:
        errors.append("Invalid E2E coverage file count.")
    if not isinstance(by_file, list) or not by_file:
        errors.append("Missing E2E per-file coverage data.")
    elif isinstance(files, int) and len(by_file) != files:
        errors.append("E2E per-file coverage count does not match files.")
    if isinstance(by_file, list):
        for index, file_entry in enumerate(by_file):
            if (
                not isinstance(file_entry, dict)
                or not isinstance(file_entry.get("file"), str)
                or not file_entry["file"].strip()
            ):
                errors.append(f"Invalid E2E per-file entry at index {index}.")
                continue
            for metric in METRICS:
                normalized = _validate_metric(
                    metric,
                    file_entry.get(metric),
                    None,
                    errors,
                    prefix=f"E2E per-file coverage entry {index}",
                )
                if normalized is not None:
                    file_entry[metric] = normalized

    thresholds = config["thresholds"]
    for metric in METRICS:
        normalized = _validate_metric(
            metric,
            artifact.get(metric),
            float(thresholds[metric]),
            errors,
        )
        if normalized is not None:
            artifact[metric] = normalized
    return errors


def load_validated_artifact(
    artifact_path: Path = DEFAULT_ARTIFACT,
    config_path: Path = DEFAULT_CONFIG,
    *,
    expected_run_id: str | None = None,
    expected_started_at: str | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    config = load_validated_config(config_path)
    artifact, errors = _load_json(artifact_path, "E2E coverage artifact")
    if artifact is not None:
        errors.extend(
            validate_artifact_payload(
                artifact,
                config,
                expected_run_id=expected_run_id,
                expected_started_at=expected_started_at,
                now=now,
            )
        )
        if expected_started_at is not None:
            expected = datetime.fromisoformat(
                expected_started_at.replace("Z", "+00:00")
            ).timestamp()
            if artifact_path.stat().st_mtime + 1 < expected:
                errors.append("E2E coverage artifact file predates this execution.")
    if errors:
        raise ValueError("\n".join(errors))
    assert artifact is not None
    return artifact


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", type=Path, default=DEFAULT_ARTIFACT)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--run-id")
    parser.add_argument("--started-at")
    args = parser.parse_args(argv)
    try:
        load_validated_artifact(
            args.artifact,
            args.config,
            expected_run_id=args.run_id,
            expected_started_at=args.started_at,
        )
    except ValueError as exc:
        print("ERROR: E2E coverage validation failed.", file=sys.stderr)
        for error in str(exc).splitlines():
            print(f"  - {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
