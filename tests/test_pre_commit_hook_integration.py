from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README_ERROR = (
    "Commit refusé : README.md doit contenir une évolution pertinente et être inclus "
    "dans les changements stagés."
)
DOD_FIXTURE_PATHS = (
    "README.md",
    "docs/definition-of-done.md",
    "docs/critical-paths.md",
    "docs/vitals-traceability.md",
    "docs/vitals-coverage-map.json",
    "docs/maintainability.md",
    "config/maintainability.json",
    "config/maintainability-baseline.json",
    "config/maintainability-exceptions.json",
    "config/test-execution-profiles.json",
    "frontend/package.json",
    "frontend/vitest.config.js",
    "frontend/e2e-coverage.config.json",
    "frontend/scripts/run-e2e-coverage.mjs",
    "frontend/tests/e2e/coverage.spec.js",
    ".coveragerc",
    ".github/workflows/ci.yml",
    ".github/workflows/pages.yml",
    ".vscode/tasks.json",
    ".githooks/pre-commit",
)


def _git_environment(**updates: str) -> dict[str, str]:
    environment = os.environ.copy()
    for name in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"):
        environment.pop(name, None)
    for name in tuple(environment):
        if name.startswith("COV_CORE_") or name in {
            "COVERAGE_FILE",
            "COVERAGE_PROCESS_START",
        }:
            environment.pop(name)
    environment.update(
        {
            "GIT_AUTHOR_NAME": "Quality Gate Test",
            "GIT_AUTHOR_EMAIL": "quality-gate@example.invalid",
            "GIT_COMMITTER_NAME": "Quality Gate Test",
            "GIT_COMMITTER_EMAIL": "quality-gate@example.invalid",
            "PYTHONIOENCODING": "utf-8",
            **updates,
        }
    )
    return environment


def _git(
    repository: Path,
    *args: str,
    environment: dict[str, str] | None = None,
    input_bytes: bytes | None = None,
) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repository,
        env=environment or _git_environment(),
        input=input_bytes,
        check=True,
        capture_output=True,
    )
    return result.stdout.decode("utf-8", errors="replace").strip()


def _copy_gate_fixture(repository: Path) -> None:
    shutil.copytree(ROOT / "Scripts", repository / "Scripts")
    for relative_path in DOD_FIXTURE_PATHS:
        source = ROOT / relative_path
        destination = repository / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    contract_path = repository / "config/test-execution-profiles.json"
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    preflight = next(node for node in contract["nodes"] if node["id"] == "preflight")
    backend_static = next(
        node for node in contract["nodes"] if node["id"] == "backend-static"
    )
    deferred = [
        command
        for command in preflight["commands"]
        if command != "Repository hygiene (README, encoding, secrets and DoD)"
    ]
    preflight["commands"] = ["Repository hygiene (README, encoding, secrets and DoD)"]
    backend_static["commands"].extend(deferred)
    contract_path.write_text(
        json.dumps(contract, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    backend = repository / "backend"
    backend.mkdir()
    (backend / "example.py").write_text("VALUE = 1\n", encoding="utf-8")


def _put_index_blob(
    repository: Path,
    index_file: str,
    relative_path: str,
    content: bytes,
) -> None:
    environment = _git_environment(GIT_INDEX_FILE=index_file)
    blob = _git(
        repository,
        "hash-object",
        "-w",
        "--stdin",
        environment=environment,
        input_bytes=content,
    )
    _git(
        repository,
        "update-index",
        "--add",
        "--cacheinfo",
        f"100644,{blob},{relative_path}",
        environment=environment,
    )


def _index_fixture(repository: Path, index_file: str) -> None:
    for path in sorted(repository.rglob("*")):
        if not path.is_file() or ".git" in path.relative_to(repository).parts:
            continue
        _put_index_blob(
            repository,
            index_file,
            path.relative_to(repository).as_posix(),
            path.read_bytes(),
        )


def _create_head(repository: Path, index_file: str) -> str:
    environment = _git_environment(GIT_INDEX_FILE=index_file)
    tree = _git(repository, "write-tree", environment=environment)
    commit = _git(
        repository,
        "commit-tree",
        tree,
        "-m",
        "fixture",
        environment=environment,
    )
    _git(repository, "symbolic-ref", "HEAD", "refs/heads/main")
    _git(repository, "update-ref", "refs/heads/main", commit)
    return commit


def _stage_text(
    repository: Path,
    index_file: str,
    relative_path: str,
    content: str,
) -> None:
    _put_index_blob(repository, index_file, relative_path, content.encode("utf-8"))


def _run_fast_preflight(repository: Path, index_file: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            "Scripts/quality_gate.py",
            "fast",
            "--node",
            "preflight",
        ],
        cwd=repository,
        env=_git_environment(GIT_INDEX_FILE=index_file),
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def _real_index_digest() -> str:
    index_path = _git(ROOT, "rev-parse", "--git-path", "index")
    resolved = Path(index_path)
    if not resolved.is_absolute():
        resolved = ROOT / resolved
    return hashlib.sha256(resolved.read_bytes()).hexdigest()


def test_real_fast_path_uses_the_isolated_commit_index_for_the_readme_gate(
    tmp_path: Path,
) -> None:
    real_index_before = _real_index_digest()
    repository = tmp_path / "repository"
    repository.mkdir()
    _git(repository, "init")
    _copy_gate_fixture(repository)

    baseline_index = ".git/index.baseline"
    _index_fixture(repository, baseline_index)
    baseline_commit = _create_head(repository, baseline_index)
    baseline_path = repository / baseline_index
    baseline_readme = (repository / "README.md").read_text(encoding="utf-8")

    scenarios = (
        ("empty", 0, None, None),
        ("code-and-readme", 0, "M", None),
        ("code-without-readme", 1, None, None),
        ("worktree-only-readme", 1, None, "worktree"),
        ("nested-readme", 1, None, "nested"),
        ("deleted-readme", 1, "D", "delete"),
        ("renamed-readme", 1, None, "rename"),
    )

    for name, expected_code, readme_status, special in scenarios:
        index_file = f".git/index.{name}"
        index_path = repository / index_file
        shutil.copy2(baseline_path, index_path)
        environment = _git_environment(GIT_INDEX_FILE=index_file)
        (repository / "README.md").write_text(baseline_readme, encoding="utf-8")
        nested_readme = repository / "frontend/README.md"
        nested_readme.unlink(missing_ok=True)

        if name != "empty":
            _stage_text(repository, index_file, "backend/example.py", "VALUE = 2\n")
        if name == "code-and-readme":
            _stage_text(repository, index_file, "README.md", baseline_readme + "\n")
        elif special == "worktree":
            (repository / "README.md").write_text(
                baseline_readme + "\nWorktree only.\n",
                encoding="utf-8",
            )
        elif special == "nested":
            _stage_text(repository, index_file, "frontend/README.md", "# Nested\n")
        elif special == "delete":
            _git(
                repository,
                "update-index",
                "--force-remove",
                "README.md",
                environment=environment,
            )
        elif special == "rename":
            _git(
                repository,
                "update-index",
                "--force-remove",
                "README.md",
                environment=environment,
            )
            _stage_text(repository, index_file, "docs/README.md", baseline_readme)

        result = _run_fast_preflight(repository, index_file)
        combined = result.stdout + result.stderr
        assert result.returncode == expected_code, combined
        if expected_code:
            assert README_ERROR in combined
        else:
            assert "Quality gate passed." in result.stdout
        if readme_status is not None:
            assert f"Staged changes: {readme_status} README.md" in result.stdout
        if special == "rename":
            assert (
                "R README.md -> docs/README.md" in result.stdout
                or (
                    "D README.md" in result.stdout
                    and "A docs/README.md" in result.stdout
                )
            )

    no_readme_index = ".git/index.no-readme-head"
    shutil.copy2(baseline_path, repository / no_readme_index)
    no_readme_environment = _git_environment(GIT_INDEX_FILE=no_readme_index)
    _git(
        repository,
        "update-index",
        "--force-remove",
        "README.md",
        environment=no_readme_environment,
    )
    no_readme_commit = _create_head(repository, no_readme_index)
    added_index = ".git/index.added-readme"
    shutil.copy2(repository / no_readme_index, repository / added_index)
    _stage_text(repository, added_index, "README.md", baseline_readme)
    added_result = _run_fast_preflight(repository, added_index)
    assert added_result.returncode == 0, added_result.stdout + added_result.stderr
    assert "Staged changes: A README.md" in added_result.stdout

    _git(repository, "update-ref", "refs/heads/main", baseline_commit, no_readme_commit)
    assert _real_index_digest() == real_index_before
