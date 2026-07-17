from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import check_no_secrets  # noqa: E402


def test_allows_fake_ado_values_in_ci_workflow() -> None:
    ado_org = "ADO_" "ORG"
    ado_project = "ADO_" "PROJECT"
    findings = check_no_secrets.scan_ado_non_prod_values(
        ".github/workflows/ci.yml",
        '\n'.join(
            [
                f'{ado_org}: "FAKE_ORG"',
                f'{ado_project}: "FAKE_PROJECT"',
            ]
        ),
    )

    assert findings == []


def test_blocks_real_ado_values_in_ci_workflow() -> None:
    ado_org = "ADO_" "ORG"
    ado_project = "ADO_" "PROJECT"
    org = "mes" "sqc"
    project = "Projet-" "700"
    findings = check_no_secrets.scan_ado_non_prod_values(
        ".github/workflows/ci.yml",
        '\n'.join(
            [
                f'{ado_org}: "{org}"',
                f'{ado_project}: "{project}"',
            ]
        ),
    )

    assert [finding.rule for finding in findings] == [
        "ADO_ORG must use a fake placeholder in CI/tests",
        "ADO_PROJECT must use a fake placeholder in CI/tests",
    ]


def test_blocks_real_ado_values_in_test_fixtures() -> None:
    ado_org = "ADO_" "ORG"
    ado_project = "ADO_" "PROJECT"
    org = "mes" "sqc"
    project = "Projet-" "700"
    findings = check_no_secrets.scan_ado_non_prod_values(
        "tests/conftest.py",
        '\n'.join(
            [
                f'monkeypatch.setenv("{ado_org}", "{org}")',
                f'monkeypatch.setenv("{ado_project}", "{project}")',
            ]
        ),
    )

    assert len(findings) == 2


def test_ignores_real_ado_values_outside_ci_and_tests() -> None:
    ado_org = "ADO_" "ORG"
    ado_project = "ADO_" "PROJECT"
    org = "mes" "sqc"
    project = "Projet-" "700"
    findings = check_no_secrets.scan_ado_non_prod_values(
        "README.md",
        f'{ado_org}: "{org}"\n{ado_project}: "{project}"',
    )

    assert findings == []


def test_git_helpers_and_staged_file_failures(monkeypatch, capsys) -> None:
    class Result:
        returncode = 0
        stdout = "a.py\n"
        stderr = ""

    monkeypatch.setattr(check_no_secrets.subprocess, "run", lambda *_args, **_kwargs: Result())
    assert check_no_secrets.run_git(["status"]) == (0, "a.py\n", "")
    assert check_no_secrets.get_staged_files() == ["a.py"]

    monkeypatch.setattr(check_no_secrets, "run_git", lambda _args: (1, "", "boom"))
    with pytest.raises(SystemExit, match="2"):
        check_no_secrets.get_staged_files()
    assert "Unable to list staged files" in capsys.readouterr().err


def test_skip_binary_staged_reads_and_rules(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    large = tmp_path / "large.txt"
    large.write_bytes(b"x" * (check_no_secrets.MAX_FILE_BYTES + 1))
    assert check_no_secrets.should_skip_file("image.png")
    assert check_no_secrets.should_skip_file("node_modules/source.txt")
    assert check_no_secrets.should_skip_file("large.txt")
    assert not check_no_secrets.should_skip_file("missing.txt")
    assert check_no_secrets.is_probably_binary(b"a\0b")
    assert not check_no_secrets.is_probably_binary(b"text")

    monkeypatch.setattr(check_no_secrets, "run_git", lambda _args: (1, "", "missing"))
    assert check_no_secrets.read_staged_file_bytes("missing.txt") is None
    monkeypatch.setattr(check_no_secrets, "run_git", lambda _args: (0, "hello", ""))
    assert check_no_secrets.read_staged_file_bytes("file.txt") == b"hello"

    rules = check_no_secrets.compile_rules()
    findings = check_no_secrets.scan_text(
        "file.env",
        "# token='ignored-value'\npassword='long-password'\n",
        rules,
    )
    assert [finding.rule for finding in findings] == ["Generic token assignment"]
    assert check_no_secrets.mask_excerpt("short") == "***REDACTED***"
    assert check_no_secrets.mask_excerpt("x" * 40).startswith("x" * 12)


def test_ado_scanner_ignores_comments_and_placeholders() -> None:
    assert check_no_secrets.is_allowed_ado_placeholder("'<SET_ME>'")
    assert check_no_secrets.is_allowed_ado_placeholder("test_value")
    assert not check_no_secrets.is_allowed_ado_placeholder("real-value")
    findings = check_no_secrets.scan_ado_non_prod_values(
        "tests/data.env",
        "# ADO_ORG=real\n// ADO_TEAM=real\nADO_UUID=real-value\n",
    )
    assert len(findings) == 1
    assert findings[0].line_no == 3


def test_main_covers_repository_empty_and_finding_paths(monkeypatch, capsys) -> None:
    monkeypatch.setattr(check_no_secrets, "run_git", lambda _args: (1, "", ""))
    assert check_no_secrets.main() == 2
    assert "Not inside a git repository" in capsys.readouterr().err

    monkeypatch.setattr(check_no_secrets, "run_git", lambda _args: (0, "", ""))
    monkeypatch.setattr(check_no_secrets, "get_staged_files", lambda: [])
    assert check_no_secrets.main() == 0

    monkeypatch.setattr(
        check_no_secrets,
        "get_staged_files",
        lambda: ["skip.png", "missing.txt", "binary.txt", "safe.txt", "secret.txt"],
    )
    monkeypatch.setattr(check_no_secrets, "should_skip_file", lambda path: path == "skip.png")
    payloads = {
        "missing.txt": None,
        "binary.txt": b"bad\0data",
        "safe.txt": b"ordinary text",
        "secret.txt": b"password='long-password'",
    }
    monkeypatch.setattr(check_no_secrets, "read_staged_file_bytes", payloads.get)
    assert check_no_secrets.main() == 1
    assert "Potential secrets" in capsys.readouterr().err

    monkeypatch.setattr(check_no_secrets, "get_staged_files", lambda: ["safe.txt"])
    assert check_no_secrets.main() == 0
