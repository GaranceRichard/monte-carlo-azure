from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import check_python_coverage  # noqa: E402


def _write_policy(root: Path) -> Path:
    path = root / ".coveragerc"
    path.write_text(
        """[run]
branch = True
source =
    backend
    Scripts
    run_app
[report]
fail_under = 80
[montecarlo]
excluded_tracked_prefixes =
    tests/
per_file_fail_under = 80
require_no_missing_lines = True
""",
        encoding="utf-8",
    )
    return path


def _source_tree(root: Path) -> set[str]:
    files = {
        "backend/core.py": "VALUE = 1\n",
        "Scripts/tool.py": "VALUE = 1\n",
        "run_app.py": "VALUE = 1\n",
        "tests/test_core.py": "def test_core(): pass\n",
    }
    for relpath, content in files.items():
        path = root / relpath
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    return set(files)


def _report(paths: set[str], *, percent: float = 100, branch: bool = True) -> dict:
    return {
        "meta": {"branch_coverage": branch},
        "files": {
            path: {
                "summary": {"percent_covered": percent},
                "missing_lines": [],
            }
            for path in paths
        },
        "totals": {"percent_covered": percent},
    }


def test_policy_declares_branch_scope_and_thresholds(tmp_path: Path) -> None:
    policy = check_python_coverage.load_policy(_write_policy(tmp_path))

    assert policy == {
        "branch": True,
        "sources": ["backend", "Scripts", "run_app"],
        "globalThreshold": 80.0,
        "perFileThreshold": 80.0,
        "requireNoMissingLines": True,
        "excludedTrackedPrefixes": ["tests/"],
    }


def test_complete_report_passes_and_tests_are_excluded(tmp_path: Path) -> None:
    tracked = _source_tree(tmp_path)
    policy = check_python_coverage.load_policy(_write_policy(tmp_path))
    covered = tracked - {"tests/test_core.py"}

    assert check_python_coverage.validate_report(
        tmp_path, policy, _report(covered), tracked_files=tracked
    ) == []


def test_new_versioned_python_file_cannot_be_absent_from_coverage(tmp_path: Path) -> None:
    tracked = _source_tree(tmp_path)
    new_source = tmp_path / "Scripts" / "new_tool.py"
    new_source.write_text("VALUE = 2\n", encoding="utf-8")
    tracked.add("Scripts/new_tool.py")
    policy = check_python_coverage.load_policy(_write_policy(tmp_path))
    report = _report({"backend/core.py", "Scripts/tool.py", "run_app.py"})

    errors = check_python_coverage.validate_report(
        tmp_path, policy, report, tracked_files=tracked
    )

    assert errors == [
        "Expected Python source is absent from the coverage report: Scripts/new_tool.py"
    ]


def test_scope_rejects_unassigned_versioned_executable(tmp_path: Path) -> None:
    tracked = _source_tree(tmp_path)
    outside = tmp_path / "standalone.py"
    outside.write_text("VALUE = 3\n", encoding="utf-8")
    tracked.add("standalone.py")
    policy = check_python_coverage.load_policy(_write_policy(tmp_path))

    errors = check_python_coverage.validate_report(
        tmp_path,
        policy,
        _report({"backend/core.py", "Scripts/tool.py", "run_app.py"}),
        tracked_files=tracked,
    )

    assert "Versioned executable Python file is outside the coverage scope: standalone.py" in errors


def test_report_rejects_red_lines_thresholds_and_disabled_branches(tmp_path: Path) -> None:
    tracked = _source_tree(tmp_path)
    policy = check_python_coverage.load_policy(_write_policy(tmp_path))
    covered = tracked - {"tests/test_core.py"}
    report = _report(covered, percent=79, branch=False)
    report["files"]["Scripts/tool.py"]["missing_lines"] = [4, 7]

    errors = check_python_coverage.validate_report(
        tmp_path, policy, report, tracked_files=tracked
    )

    assert "Python branch coverage does not match the declared policy." in errors
    assert "Global Python coverage 79.00% is below 80.00%." in errors
    assert "Scripts/tool.py: coverage 79.00% is below 80.00%." in errors
    assert "Scripts/tool.py: uncovered lines: [4, 7]" in errors


def test_invalid_policy_and_report_are_rejected(tmp_path: Path) -> None:
    missing = tmp_path / "missing"
    try:
        check_python_coverage.load_policy(missing)
    except ValueError as exc:
        assert "Missing Python coverage configuration" in str(exc)
    else:
        raise AssertionError("Missing coverage policy must fail.")

    invalid_policy = tmp_path / "invalid.ini"
    invalid_policy.write_text("[run]\nbranch = invalid\n", encoding="utf-8")
    try:
        check_python_coverage.load_policy(invalid_policy)
    except ValueError as exc:
        assert "Invalid Python coverage configuration" in str(exc)
    else:
        raise AssertionError("Invalid coverage policy must fail.")

    invalid_report = tmp_path / "invalid.json"
    invalid_report.write_text("[]", encoding="utf-8")
    try:
        check_python_coverage._load_report(invalid_report)
    except ValueError as exc:
        assert "Invalid Python coverage report schema" in str(exc)
    else:
        raise AssertionError("Invalid coverage report must fail.")


def test_main_reports_success_validation_failure_and_loading_error(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    tracked = _source_tree(tmp_path)
    policy_path = _write_policy(tmp_path)
    report_path = tmp_path / "report.json"
    covered = tracked - {"tests/test_core.py"}
    report_path.write_text(json.dumps(_report(covered)), encoding="utf-8")
    monkeypatch.setattr(check_python_coverage, "tracked_python_files", lambda _root: tracked)

    args = ["--root", str(tmp_path), "--config", str(policy_path), "--report", str(report_path)]
    assert check_python_coverage.main(args) == 0
    assert "Python coverage scope and report passed." in capsys.readouterr().out

    failing = _report(covered)
    failing["files"]["Scripts/tool.py"]["missing_lines"] = [1]
    report_path.write_text(json.dumps(failing), encoding="utf-8")
    assert check_python_coverage.main(args) == 1
    assert "Python coverage validation failed" in capsys.readouterr().err

    assert check_python_coverage.main(["--config", str(tmp_path / "absent")]) == 2
    assert "could not run" in capsys.readouterr().err


def test_expected_sources_and_tracked_git_listing(tmp_path: Path, monkeypatch) -> None:
    standalone = tmp_path / "standalone.py"
    standalone.write_text("VALUE = 1\n", encoding="utf-8")
    assert check_python_coverage.expected_source_files(
        tmp_path, ["missing", "standalone"]
    ) == {"standalone.py"}

    class Result:
        def __init__(self, code: int) -> None:
            self.returncode = code
            self.stdout = "backend\\a.py\n"
            self.stderr = "boom"

    monkeypatch.setattr(check_python_coverage.subprocess, "run", lambda *_a, **_k: Result(0))
    assert check_python_coverage.tracked_python_files(tmp_path) == {"backend/a.py"}
    monkeypatch.setattr(check_python_coverage.subprocess, "run", lambda *_a, **_k: Result(1))
    try:
        check_python_coverage.tracked_python_files(tmp_path)
    except ValueError as exc:
        assert "Unable to list versioned Python files" in str(exc)
    else:
        raise AssertionError("A failed git listing must fail validation.")


def test_invalid_report_json_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "report.json"
    path.write_text("not json", encoding="utf-8")
    try:
        check_python_coverage._load_report(path)
    except ValueError as exc:
        assert "Invalid Python coverage report" in str(exc)
    else:
        raise AssertionError("Invalid JSON must fail report loading.")
