from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import check_e2e_coverage  # noqa: E402


def _config() -> dict:
    return {
        "schemaVersion": 1,
        "artifactMaxAgeSeconds": 3600,
        "scope": {
            "id": "frontend-src-e2e-v1",
            "urlPathPrefix": "/src/",
            "excludedPathSuffixes": ["/src/main.tsx"],
        },
        "thresholds": {
            "statements": 80,
            "branches": 80,
            "functions": 80,
            "lines": 80,
        },
    }


def _artifact(
    config: dict,
    *,
    run_id: str = "run-current",
    completed_at: datetime | None = None,
) -> dict:
    completed_at = completed_at or datetime.now(timezone.utc)
    started_at = completed_at - timedelta(minutes=1)
    metric = {"total": 100, "covered": 80, "skipped": 0, "pct": 80}
    return {
        "schemaVersion": 1,
        "producer": "playwright-v8-istanbul",
        "context": {
            "runId": run_id,
            "scopeId": config["scope"]["id"],
            "scopeFingerprint": check_e2e_coverage.coverage_scope_fingerprint(
                config["scope"]
            ),
            "startedAt": started_at.isoformat(),
            "completedAt": completed_at.isoformat(),
        },
        "files": 1,
        "statements": dict(metric),
        "branches": dict(metric),
        "functions": dict(metric),
        "lines": dict(metric),
        "byFile": [
            {
                "file": "frontend/App.tsx",
                "statements": dict(metric),
                "branches": dict(metric),
                "functions": dict(metric),
                "lines": dict(metric),
            }
        ],
    }


def _write_inputs(tmp_path: Path, artifact: dict, config: dict) -> tuple[Path, Path]:
    artifact_path = tmp_path / "e2e-coverage-summary.json"
    config_path = tmp_path / "e2e-coverage.config.json"
    artifact_path.write_text(json.dumps(artifact), encoding="utf-8")
    config_path.write_text(json.dumps(config), encoding="utf-8")
    return artifact_path, config_path


def test_all_four_e2e_thresholds_are_enforced_and_pass_at_threshold(
    tmp_path: Path,
) -> None:
    config = _config()
    artifact = _artifact(config)
    artifact_path, config_path = _write_inputs(tmp_path, artifact, config)

    loaded = check_e2e_coverage.load_validated_artifact(
        artifact_path,
        config_path,
        expected_run_id="run-current",
        expected_started_at=artifact["context"]["startedAt"],
    )

    assert loaded is artifact or loaded == artifact


@pytest.mark.parametrize(
    "metric",
    ["statements", "branches", "functions", "lines"],
)
def test_each_e2e_metric_below_threshold_fails(metric: str) -> None:
    config = _config()
    artifact = _artifact(config)
    artifact[metric] = {"total": 100, "covered": 79, "skipped": 0, "pct": 79}

    errors = check_e2e_coverage.validate_artifact_payload(artifact, config)

    assert any(f"{metric} = 79.00%" in error for error in errors)


def test_commented_threshold_assertions_have_no_effect_on_validation(
    tmp_path: Path,
) -> None:
    (tmp_path / "coverage.spec.js").write_text(
        "/* expect(summary.branches.pct).toBeGreaterThanOrEqual(80); */\n",
        encoding="utf-8",
    )
    config = _config()
    artifact = _artifact(config)
    artifact["branches"] = {"total": 100, "covered": 1, "skipped": 0, "pct": 1}

    errors = check_e2e_coverage.validate_artifact_payload(artifact, config)

    assert any("branches = 1.00%" in error for error in errors)


def test_missing_e2e_artifact_fails(tmp_path: Path) -> None:
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps(_config()), encoding="utf-8")

    with pytest.raises(ValueError, match="Missing E2E coverage artifact"):
        check_e2e_coverage.load_validated_artifact(
            tmp_path / "missing.json",
            config_path,
        )


def test_invalid_e2e_json_fails(tmp_path: Path) -> None:
    artifact_path = tmp_path / "artifact.json"
    config_path = tmp_path / "config.json"
    artifact_path.write_text("{invalid", encoding="utf-8")
    config_path.write_text(json.dumps(_config()), encoding="utf-8")

    with pytest.raises(ValueError, match="Invalid E2E coverage artifact JSON"):
        check_e2e_coverage.load_validated_artifact(artifact_path, config_path)


def test_missing_e2e_metric_fails() -> None:
    config = _config()
    artifact = _artifact(config)
    del artifact["functions"]

    errors = check_e2e_coverage.validate_artifact_payload(artifact, config)

    assert "Missing E2E coverage metric: functions." in errors


@pytest.mark.parametrize("metric", ["functions", "branches"])
def test_empty_per_file_istanbul_metric_is_valid_and_normalized(
    metric: str,
) -> None:
    config = _config()
    artifact = _artifact(config)
    observed_istanbul_block = {
        "total": 0,
        "covered": 0,
        "skipped": 0,
        "pct": 100,
    }
    artifact["byFile"][0][metric] = dict(observed_istanbul_block)

    errors = check_e2e_coverage.validate_artifact_payload(artifact, config)

    assert errors == []
    assert artifact["byFile"][0][metric] == observed_istanbul_block


def test_empty_metric_percentage_is_normalized_deterministically() -> None:
    errors: list[str] = []

    normalized = check_e2e_coverage.normalize_coverage_metric(
        "functions",
        {"total": 0, "covered": 0, "skipped": 0, "pct": 100.0},
        errors,
        allow_empty=True,
    )

    assert errors == []
    assert normalized == {"total": 0, "covered": 0, "skipped": 0, "pct": 100}


@pytest.mark.parametrize("pct", ["Unknown", None, math.nan, math.inf])
def test_special_percentage_is_rejected_when_total_is_positive(pct: object) -> None:
    errors: list[str] = []

    normalized = check_e2e_coverage.normalize_coverage_metric(
        "functions",
        {"total": 1, "covered": 1, "skipped": 0, "pct": pct},
        errors,
        allow_empty=True,
    )

    assert normalized is None
    assert errors == ["Invalid E2E coverage metric values: functions."]


@pytest.mark.parametrize(
    "block",
    [
        {"total": 0, "covered": 1, "skipped": 0, "pct": 100},
        {"total": 1, "covered": 2, "skipped": 0, "pct": 200},
        {"total": -1, "covered": 0, "skipped": 0, "pct": 100},
        {"total": 10, "covered": 8, "skipped": 0, "pct": 90},
    ],
)
def test_metric_total_covered_and_percentage_inconsistencies_are_rejected(
    block: dict,
) -> None:
    errors: list[str] = []

    normalized = check_e2e_coverage.normalize_coverage_metric(
        "branches",
        block,
        errors,
        allow_empty=True,
    )

    assert normalized is None
    assert errors


def test_e2e_artifact_from_another_execution_or_scope_fails() -> None:
    config = _config()
    artifact = _artifact(config, run_id="old-run")
    artifact["context"]["scopeId"] = "other-scope"

    errors = check_e2e_coverage.validate_artifact_payload(
        artifact,
        config,
        expected_run_id="current-run",
    )

    assert "E2E coverage artifact belongs to another execution." in errors
    assert "E2E coverage artifact belongs to another scope." in errors


def test_stale_e2e_artifact_fails() -> None:
    config = _config()
    now = datetime.now(timezone.utc)
    artifact = _artifact(config, completed_at=now - timedelta(hours=2))

    errors = check_e2e_coverage.validate_artifact_payload(
        artifact,
        config,
        now=now,
    )

    assert "E2E coverage artifact is stale." in errors


def test_e2e_validator_exit_code_reflects_artifact_validity(
    tmp_path: Path,
) -> None:
    config = _config()
    artifact = _artifact(config)
    artifact_path, config_path = _write_inputs(tmp_path, artifact, config)

    assert check_e2e_coverage.main(
        ["--artifact", str(artifact_path), "--config", str(config_path)]
    ) == 0

    artifact["lines"] = {"total": 100, "covered": 79, "skipped": 0, "pct": 79}
    artifact_path.write_text(json.dumps(artifact), encoding="utf-8")

    assert check_e2e_coverage.main(
        ["--artifact", str(artifact_path), "--config", str(config_path)]
    ) == 1


def test_current_complete_e2e_artifact_is_accepted_after_normalization() -> None:
    artifact_path = ROOT / "frontend" / "coverage" / "e2e-coverage-summary.json"
    if not artifact_path.exists():
        pytest.skip("The generated E2E coverage artifact is not present.")
    raw = json.loads(artifact_path.read_text(encoding="utf-8"))
    completed_at = datetime.fromisoformat(
        raw["context"]["completedAt"].replace("Z", "+00:00")
    )

    artifact = check_e2e_coverage.load_validated_artifact(
        artifact_path,
        now=completed_at + timedelta(minutes=1),
    )

    empty_metrics = [
        entry[metric]
        for entry in artifact["byFile"]
        for metric in ("branches", "functions")
        if entry[metric]["total"] == 0
    ]
    assert empty_metrics
    assert all(
        metric == {"total": 0, "covered": 0, "skipped": 0, "pct": 100}
        for metric in empty_metrics
    )


def test_json_loader_rejects_non_object_and_config_validation_covers_each_field(
    tmp_path: Path,
) -> None:
    path = tmp_path / "array.json"
    path.write_text("[]", encoding="utf-8")
    payload, errors = check_e2e_coverage._load_json(path, "fixture")
    assert payload is None
    assert "top-level value must be an object" in errors[0]

    invalid = {
        "schemaVersion": 2,
        "artifactMaxAgeSeconds": True,
        "scope": {
            "id": "",
            "urlPathPrefix": "src",
            "excludedPathSuffixes": ["main.tsx"],
        },
        "thresholds": {"statements": 79},
    }
    errors = check_e2e_coverage.validate_config(invalid)
    assert any("schemaVersion" in error for error in errors)
    assert any("artifactMaxAgeSeconds" in error for error in errors)
    assert any("scope id" in error for error in errors)
    assert any("urlPathPrefix" in error for error in errors)
    assert any("excludedPathSuffixes" in error for error in errors)
    assert any("exactly" in error for error in errors)
    assert any("statements threshold" in error for error in errors)

    invalid["scope"] = None
    invalid["thresholds"] = None
    errors = check_e2e_coverage.validate_config(invalid)
    assert "Invalid E2E coverage scope." in errors
    assert "Invalid E2E coverage thresholds." in errors


def test_config_loading_and_timestamp_validation(tmp_path: Path) -> None:
    invalid = tmp_path / "invalid.json"
    invalid.write_text('{"schemaVersion": 2}', encoding="utf-8")
    with pytest.raises(ValueError, match="schemaVersion"):
        check_e2e_coverage.load_validated_config(invalid)

    errors: list[str] = []
    assert check_e2e_coverage._parse_timestamp(1, "time", errors) is None
    assert check_e2e_coverage._parse_timestamp("bad", "time", errors) is None
    assert check_e2e_coverage._parse_timestamp("2026-01-01T00:00:00", "time", errors) is None
    assert len(errors) == 3


def test_incomplete_and_invalid_empty_metric_percentages_fail() -> None:
    errors: list[str] = []
    assert check_e2e_coverage.normalize_coverage_metric("lines", {}, errors) is None
    assert "Incomplete E2E coverage metric: lines." in errors
    errors = []
    assert (
        check_e2e_coverage.normalize_coverage_metric(
            "functions",
            {"total": 0, "covered": 0, "skipped": 0, "pct": 99},
            errors,
            allow_empty=True,
        )
        is None
    )
    assert "Inconsistent" in errors[0]
    errors = []
    assert (
        check_e2e_coverage.normalize_coverage_metric(
            "functions",
            {"total": 0, "covered": 0, "skipped": 0, "pct": 100},
            errors,
            allow_empty=False,
        )
        is None
    )


def test_artifact_validation_covers_context_time_and_file_shape_errors() -> None:
    config = _config()
    now = datetime.now(timezone.utc)
    artifact = _artifact(config, completed_at=now + timedelta(minutes=1))
    artifact["schemaVersion"] = 2
    artifact["producer"] = "other"
    artifact["context"]["runId"] = ""
    artifact["context"]["scopeFingerprint"] = "wrong"
    artifact["context"]["startedAt"] = (now + timedelta(minutes=2)).isoformat()
    artifact["files"] = True
    artifact["byFile"] = [None]
    errors = check_e2e_coverage.validate_artifact_payload(
        artifact,
        config,
        expected_started_at="invalid",
        now=now,
    )
    assert any("artifact schemaVersion" in error for error in errors)
    assert any("producer" in error for error in errors)
    assert any("runId" in error for error in errors)
    assert any("fingerprint" in error for error in errors)
    assert any("completed before" in error for error in errors)
    assert any("future" in error for error in errors)
    assert any("file count" in error for error in errors)
    assert any("entry at index 0" in error for error in errors)

    artifact = _artifact(config)
    artifact["context"] = None
    artifact["byFile"] = []
    errors = check_e2e_coverage.validate_artifact_payload(artifact, config)
    assert "Missing E2E coverage execution context." in errors
    assert "Missing E2E per-file coverage data." in errors

    artifact = _artifact(config)
    artifact["files"] = 2
    errors = check_e2e_coverage.validate_artifact_payload(artifact, config)
    assert "E2E per-file coverage count does not match files." in errors


def test_artifact_expected_start_and_file_freshness_are_enforced(tmp_path: Path) -> None:
    config = _config()
    artifact = _artifact(config)
    artifact_path, config_path = _write_inputs(tmp_path, artifact, config)
    expected = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    with pytest.raises(ValueError) as exc:
        check_e2e_coverage.load_validated_artifact(
            artifact_path,
            config_path,
            expected_started_at=expected,
            now=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    assert "startedAt does not match" in str(exc.value)
    assert "file predates" in str(exc.value)
