"""Coverage-evidence adapters for the consolidated test-strategy report."""

from __future__ import annotations

import configparser
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


def coverage_conclusion(metrics: dict[str, dict[str, Any]], thresholds: dict[str, float]) -> str:
    for name, threshold in thresholds.items():
        metric = metrics.get(name)
        if not isinstance(metric, dict) or not isinstance(metric.get("pct"), (int, float)):
            return "invalid"
        if float(metric["pct"]) < float(threshold):
            return "violation"
    return "valid"


def e2e_freshness(artifact: dict[str, Any], config: dict[str, Any], now: datetime) -> str:
    try:
        completed = datetime.fromisoformat(
            str(artifact["context"]["completedAt"]).replace("Z", "+00:00")
        )
        maximum = float(config["artifactMaxAgeSeconds"])
    except (KeyError, TypeError, ValueError):
        return "invalid"
    age = (now.astimezone(timezone.utc) - completed.astimezone(timezone.utc)).total_seconds()
    return "stale" if age > maximum else ("invalid" if age < 0 else "valid")


def _metric(total: int, covered: int) -> dict[str, int | float]:
    return {
        "total": total,
        "covered": covered,
        "pct": 100.0 if total == 0 else round(100 * covered / total, 2),
    }


def _entry(
    identifier: str,
    status: str,
    metrics: dict[str, Any],
    thresholds: dict[str, Any],
    reasons: list[dict[str, Any]],
    *,
    source: str = "not applicable to pr",
    threshold_source: str = "profile contract",
) -> dict[str, Any]:
    return {
        "id": identifier,
        "scope": "current profile",
        "status": status,
        "source": source,
        "thresholdSource": threshold_source,
        "metrics": metrics,
        "thresholds": thresholds,
        "reasons": reasons,
    }


def _python(root: Path, _now: datetime) -> tuple[dict[str, Any], dict[str, float], dict[str, Any]]:
    payload = json.loads((root / ".coverage.python.json").read_text(encoding="utf-8"))
    totals = payload["totals"]
    parser = configparser.ConfigParser()
    parser.read(root / ".coveragerc", encoding="utf-8")
    threshold = parser.getfloat("report", "fail_under")
    metrics = {
        "lines": _metric(int(totals["num_statements"]), int(totals["covered_lines"])),
        "branches": _metric(int(totals["num_branches"]), int(totals["covered_branches"])),
    }
    state = (
        "violation"
        if int(totals.get("missing_lines", 0))
        else coverage_conclusion(metrics, {"lines": threshold, "branches": threshold})
    )
    return (
        metrics,
        {"lines": threshold, "branches": threshold},
        {"schemaVersion": payload.get("meta", {}).get("format"), "state": state},
    )


def _vitest(root: Path, _now: datetime) -> tuple[dict[str, Any], dict[str, float], dict[str, Any]]:
    payload = json.loads(
        (root / "frontend/coverage/coverage-final.json").read_text(encoding="utf-8")
    )
    totals = {name: [0, 0] for name in ("statements", "branches", "functions", "lines")}
    for item in payload.values():
        statements = list(item.get("s", {}).values())
        functions = list(item.get("f", {}).values())
        branches = [count for values in item.get("b", {}).values() for count in values]
        for name, values in (
            ("statements", statements),
            ("lines", statements),
            ("functions", functions),
            ("branches", branches),
        ):
            totals[name][0] += len(values)
            totals[name][1] += sum(int(value) > 0 for value in values)
    config = (root / "frontend/vitest.config.js").read_text(encoding="utf-8")
    thresholds = {
        name: float(re.search(rf"{name}:\s*(\d+(?:\.\d+)?)", config).group(1)) for name in totals
    }
    return (
        {name: _metric(*values) for name, values in totals.items()},
        thresholds,
        {"schemaVersion": 1},
    )


def _e2e(root: Path, now: datetime) -> tuple[dict[str, Any], dict[str, float], dict[str, Any]]:
    artifact = json.loads(
        (root / "frontend/coverage/e2e-coverage-summary.json").read_text(encoding="utf-8")
    )
    config = json.loads((root / "frontend/e2e-coverage.config.json").read_text(encoding="utf-8"))
    metrics = {
        name: {
            "total": int(artifact[name]["total"]),
            "covered": int(artifact[name]["covered"]),
            "pct": float(artifact[name]["pct"]),
        }
        for name in ("statements", "branches", "functions", "lines")
    }
    state = e2e_freshness(artifact, config, now)
    if state == "valid":
        state = coverage_conclusion(metrics, config["thresholds"])
    return (
        metrics,
        {key: float(value) for key, value in config["thresholds"].items()},
        {"schemaVersion": artifact.get("schemaVersion"), "state": state},
    )


def _vitals(root: Path, _now: datetime) -> tuple[dict[str, Any], dict[str, float], dict[str, Any]]:
    from Scripts.report_vitals_coverage import load_vitals_report_bundle

    bundle = load_vitals_report_bundle(root / "frontend/coverage/vitals-coverage-report.json", root)
    script = (root / "Scripts/check_vitals_compliance.py").read_text(encoding="utf-8")
    match = re.search(r"VITALS_THRESHOLD\s*=\s*(\d+(?:\.\d+)?)", script)
    threshold = float(match.group(1)) if match else 95.0
    vitals: list[dict[str, Any]] = []
    all_metrics: dict[str, dict[str, Any]] = {}
    state = "valid"
    for index, item in enumerate(bundle["report"], start=1):
        sources = []
        vital_state = "valid"
        for source, detail in sorted(item.get("sources", {}).items()):
            metrics = {
                name: _metric(int(metric["total"]), int(metric["covered"]))
                for name, metric in detail.get("metrics", {}).items()
            }
            if coverage_conclusion(metrics, {name: threshold for name in metrics}) != "valid":
                vital_state = state = "violation"
            sources.append({"id": source, "metrics": metrics})
            all_metrics.update(
                {f"CP-{index:03d}:{source}:{name}": metric for name, metric in metrics.items()}
            )
        issues = (
            []
            if vital_state == "valid"
            else [
                {
                    "code": "vital.below_threshold",
                    "message": "At least one Vital metric is below threshold.",
                    "evidenceIds": [],
                }
            ]
        )
        vitals.append(
            {
                "id": f"CP-{index:03d}",
                "title": item.get("title", f"Vital {index}"),
                "status": vital_state,
                "threshold": threshold,
                "sources": sources,
                "reasons": issues,
            }
        )
    return (
        all_metrics,
        {name: threshold for name in all_metrics},
        {"schemaVersion": bundle.get("schemaVersion"), "state": state, "vitals": vitals},
    )


def _specs() -> tuple[
    tuple[
        str, str, str, str, Callable[..., tuple[dict[str, Any], dict[str, float], dict[str, Any]]]
    ],
    ...,
]:
    return (
        ("python", ".coverage.python.json", "pytest-cov", ".coveragerc", _python),
        (
            "vitest",
            "frontend/coverage/coverage-final.json",
            "Vitest V8 coverage",
            "frontend/vitest.config.js",
            _vitest,
        ),
        (
            "e2e",
            "frontend/coverage/e2e-coverage-summary.json",
            "playwright-v8-istanbul",
            "frontend/e2e-coverage.config.json",
            _e2e,
        ),
        (
            "vitals",
            "frontend/coverage/vitals-coverage-report.json",
            "Scripts/report_vitals_coverage.py",
            "Scripts/check_vitals_compliance.py:VITALS_THRESHOLD",
            _vitals,
        ),
    )


def _coverage_failure(
    root: Path,
    identifier: str,
    relative: str,
    source: str,
    threshold_source: str,
    exc: Exception,
    manifest_factory: Callable[..., dict[str, Any]],
    reason_factory: Callable[..., dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    evidence_id = f"coverage-{identifier}"
    issue = reason_factory(
        "coverage.missing_or_invalid",
        f"Unable to read {identifier} coverage evidence: {exc}",
        [evidence_id],
    )
    status = "missing" if not (root / relative).is_file() else "invalid"
    manifest = manifest_factory(
        evidence_id,
        relative,
        source,
        "profileExecution",
        status=status,
        reasons=[issue],
    )
    entry = _entry(
        identifier,
        status,
        {},
        {},
        [issue],
        source=relative,
        threshold_source=threshold_source,
    )
    return entry, manifest, [], []


def _collect_one(
    root: Path,
    now: datetime,
    spec: tuple[
        str, str, str, str, Callable[..., tuple[dict[str, Any], dict[str, float], dict[str, Any]]]
    ],
    manifest_factory: Callable[..., dict[str, Any]],
    reason_factory: Callable[..., dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    identifier, relative, source, threshold_source, loader = spec
    evidence_id = f"coverage-{identifier}"
    try:
        metrics, thresholds, details = loader(root, now)
        state = details.pop("state", coverage_conclusion(metrics, thresholds))
        status = (
            "valid"
            if state in {"valid", "violation"}
            else ("stale" if state == "stale" else "invalid")
        )
        violations = (
            [
                reason_factory(
                    "coverage.below_threshold",
                    f"{identifier} coverage is below its applicable threshold.",
                    [evidence_id],
                )
            ]
            if state == "violation"
            else []
        )
        issues = (
            []
            if state == "valid"
            else [
                reason_factory(
                    f"coverage.{state}",
                    f"{identifier} coverage evidence is {state}.",
                    [evidence_id],
                )
            ]
        )
        raw = (root / relative).read_bytes()
        manifest = manifest_factory(
            evidence_id,
            relative,
            source,
            "profileExecution",
            status=status,
            fingerprint=hashlib.sha256(raw).hexdigest(),
            schema_version=details.get("schemaVersion"),
            reasons=issues,
        )
        entry = _entry(
            identifier,
            status,
            metrics,
            thresholds,
            issues,
            source=relative,
            threshold_source=threshold_source,
        )
        return entry, manifest, details.get("vitals", []), violations
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        return _coverage_failure(
            root,
            identifier,
            relative,
            source,
            threshold_source,
            exc,
            manifest_factory,
            reason_factory,
        )


def collect_coverage(
    root: Path,
    profile: str,
    now: datetime,
    manifest_factory: Callable[..., dict[str, Any]],
    reason_factory: Callable[..., dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    if profile == "pr":
        return (
            [
                _entry(item, "not_applicable", {}, {}, [])
                for item in ("python", "vitest", "e2e", "vitals")
            ],
            [],
            [],
            [],
        )
    entries: list[dict[str, Any]] = []
    manifest: list[dict[str, Any]] = []
    violations: list[dict[str, Any]] = []
    vitals: list[dict[str, Any]] = []
    for spec in _specs():
        entry, evidence, collected_vitals, collected_violations = _collect_one(
            root,
            now,
            spec,
            manifest_factory,
            reason_factory,
        )
        entries.append(entry)
        manifest.append(evidence)
        violations.extend(collected_violations)
        if collected_vitals:
            vitals = collected_vitals
    return entries, vitals, manifest, violations
