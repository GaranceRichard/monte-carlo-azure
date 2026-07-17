from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Scripts"))

import check_naming_convention as naming  # noqa: E402


def test_source_iteration_and_identifier_scanners(tmp_path: Path) -> None:
    backend = tmp_path / "backend"
    frontend = tmp_path / "frontend" / "src"
    backend.mkdir(parents=True)
    frontend.mkdir(parents=True)
    python_file = backend / "sample.py"
    js_file = frontend / "sample.ts"
    python_file.write_text(
        'hypothese_value = 1\ntext = "hypothese_string"\n', encoding="utf-8"
    )
    js_file.write_text(
        '// const hypothese_comment = 1\n'
        'const optimisteValue = 1;\n'
        'const text = "conservateurString";\n'
        'const value = { arrimeField: 1 };\n',
        encoding="utf-8",
    )
    files = naming._iter_source_files(tmp_path)
    assert files == [python_file, js_file]
    violations = naming.collect_naming_violations(tmp_path)
    assert {item.identifier for item in violations} == {
        "hypothese_value",
        "optimisteValue",
        "arrimeField",
    }
    assert naming._blocked_fragment("englishName") is None


def test_js_duplicate_pattern_match_is_reported_once(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "sample.ts"
    path.write_text("const value = { hypothese: 1 };\n", encoding="utf-8")
    pattern = naming.JS_IDENTIFIER_PATTERNS[1]
    monkeypatch.setattr(naming, "JS_IDENTIFIER_PATTERNS", (pattern, pattern))
    violations = naming._extract_js_identifiers(path)
    assert [(item.line, item.identifier) for item in violations] == [(1, "hypothese")]


def test_main_success_and_failure(tmp_path: Path, monkeypatch, capsys) -> None:
    monkeypatch.setattr(naming, "ROOT", tmp_path)
    monkeypatch.setattr(naming, "collect_naming_violations", lambda _root: [])
    assert naming.main() == 0
    assert "Naming compliance is ok" in capsys.readouterr().out

    path = tmp_path / "backend" / "bad.py"
    monkeypatch.setattr(
        naming,
        "collect_naming_violations",
        lambda _root: [naming.Violation(path, 3, "hypothese", "hypothese")],
    )
    assert naming.main() == 1
    assert "backend/bad.py:3" in capsys.readouterr().err
