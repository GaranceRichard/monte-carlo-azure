from __future__ import annotations

import sys
from pathlib import Path

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
