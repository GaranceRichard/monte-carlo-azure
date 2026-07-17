#!/usr/bin/env python3
"""Run the repository quality gates shared by hooks and GitHub Actions."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Iterator
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCUMENTATION_PATHS = {"README.md", "LICENSE", "NOTICE"}
NPM_COMMAND = "npm.cmd" if os.name == "nt" else "npm"
BACKEND_TEST_ENV = {
    "ADO_PAT": "FAKE_PAT",
    "ADO_ORG": "FAKE_ORG",
    "ADO_PROJECT": "FAKE_PROJECT",
    "APP_MONGO_URL": "mongodb://localhost:27017",
    "APP_MONGO_DB": "montecarlo_test",
}


class InputSource(str, Enum):
    """Repository state read by a gate control."""

    GIT_INDEX = "git-index"
    WORKSPACE = "workspace"
    HEAD = "HEAD"


class ChangeLevel(str, Enum):
    """Conservative change scope used by future adaptive validation."""

    TARGETED = "targeted"
    IMPACTED = "impacted"
    MASSIVE = "massive"


class ChangeDomain(str, Enum):
    """Application domain affected by a resolvable change."""

    DOCUMENTATION = "documentation"
    BACKEND = "backend"
    FRONTEND = "frontend"


@dataclass(frozen=True)
class PathClassification:
    """Classification evidence for one changed repository path."""

    path: str
    level: ChangeLevel
    justification: str


@dataclass(frozen=True)
class ChangeClassification:
    """Overall classification plus the paths that determined its level."""

    level: ChangeLevel
    trigger_paths: tuple[str, ...]
    justification: str
    path_decisions: tuple[PathClassification, ...]


@dataclass(frozen=True)
class TestResolution:
    """Pure test/domain resolution performed before commands are built."""

    level: ChangeLevel
    domains: tuple[ChangeDomain, ...]
    impacted_domains: tuple[ChangeDomain, ...]
    backend_tests: tuple[str, ...]
    frontend_tests: tuple[str, ...]
    unresolved_paths: tuple[str, ...]
    justification: str


@dataclass(frozen=True)
class GateCommand:
    step: str
    argv: tuple[str, ...]
    correction: str
    backend_test: bool = False
    input_sources: tuple[InputSource, ...] = (InputSource.WORKSPACE,)
    coverage_artifacts: tuple[str, ...] = ()


@dataclass(frozen=True)
class ChangeContext:
    """Inputs used to select the current gate plan."""

    mode: str
    changed_paths: tuple[str, ...]
    changed_paths_source: InputSource | None
    documentation_only: bool
    terminal_sha: str | None = None
    introduced_commit_shas: tuple[str, ...] = ()
    revision_ranges: tuple[tuple[str, ...], ...] = ()
    classification: ChangeClassification | None = None


@dataclass(frozen=True)
class GateExecutionPlan:
    """Pure description of the commands and final smoke check to execute."""

    context: ChangeContext
    commands: tuple[GateCommand, ...]
    docker_smoke: bool
    resolution: TestResolution | None = None

    @property
    def coverage_artifacts(self) -> tuple[str, ...]:
        """Return reusable coverage outputs in deterministic production order."""
        return tuple(
            dict.fromkeys(
                artifact
                for command in self.commands
                for artifact in command.coverage_artifacts
            )
        )


@dataclass(frozen=True)
class PrePushRefUpdate:
    """One reference update received by the Git pre-push hook."""

    local_ref: str
    local_sha: str
    remote_ref: str
    remote_sha: str

    @property
    def is_creation(self) -> bool:
        return is_zero_oid(self.remote_sha) and not is_zero_oid(self.local_sha)

    @property
    def is_deletion(self) -> bool:
        return is_zero_oid(self.local_sha)


@dataclass(frozen=True)
class PushCommitRange:
    """Revision range and commits introduced by one pushed reference."""

    update: PrePushRefUpdate
    terminal_sha: str | None
    revision_args: tuple[str, ...]
    commit_shas: tuple[str, ...]
    changed_paths: tuple[str, ...]


@dataclass(frozen=True)
class PushValidationTarget:
    """One terminal commit to validate with its aggregated change context."""

    terminal_sha: str
    ranges: tuple[PushCommitRange, ...]
    changed_paths: tuple[str, ...]


@dataclass(frozen=True)
class PushValidationPlan:
    """Pure pre-push interpretation before worktrees are created."""

    updates: tuple[PrePushRefUpdate, ...]
    ranges: tuple[PushCommitRange, ...]
    targets: tuple[PushValidationTarget, ...]


OID_PATTERN = re.compile(r"^[0-9a-fA-F]{40}(?:[0-9a-fA-F]{24})?$")
CHANGE_LEVEL_PRIORITY = {
    ChangeLevel.TARGETED: 1,
    ChangeLevel.IMPACTED: 2,
    ChangeLevel.MASSIVE: 3,
}
MASSIVE_EXACT_PATHS = {
    "requirements.txt",
    "pyproject.toml",
    "frontend/package.json",
    "frontend/package-lock.json",
    "frontend/vitest.config.js",
    "frontend/playwright.config.js",
    "config/maintainability.json", "config/maintainability-baseline.json",
    "config/maintainability-exceptions.json", ".coveragerc",
    "backend/mc_core.py",
    "backend/api_models.py",
    "backend/api_routes_simulate.py",
    "backend/simulation_limits.py",
    "frontend/src/api.ts",
    "frontend/src/types.ts",
    "frontend/src/simulationLimits.ts",
    "frontend/src/hooks/simulationForecastCore.ts",
    "frontend/src/hooks/simulationForecastService.ts",
    "frontend/src/hooks/simulationTypes.ts",
    "frontend/src/utils/simulation.ts",
    "Dockerfile",
    "docker-compose.yml",
}
MASSIVE_PREFIXES = (
    ".github/",
    ".githooks/",
    ".vscode/",
)
MASSIVE_SCRIPT_NAMES = {
    "check_dod_compliance.py",
    "check_identity_boundary.py",
    "check_maintainability.py",
    "check_python_coverage.py",
    "check_naming_convention.py",
    "check_no_secrets.py",
    "check_vitals_compliance.py",
    "pre_commit_guard.py",
    "quality_gate.py",
    "maintainability_common.py", "maintainability_config.py",
    "maintainability_dependencies.py", "maintainability_metrics.py",
    "maintainability_ratchet.py",
    "report_vitals_coverage.py",
    "setup_git_hooks.py",
}
MASSIVE_TEST_PATHS = {
    "tests/test_identity_boundary.py",
    "tests/test_maintainability.py",
    "tests/test_python_coverage.py",
    "tests/test_pre_commit_guard.py",
    "tests/test_quality_gate.py",
    "tests/test_repo_compliance.py",
    "tests/test_vitals_compliance.py",
    "frontend/tests/e2e/coverage.spec.js",
    "frontend/tests/e2e/helpers/coverage.js",
}
IMPACTED_EXACT_PATHS = {
    "backend/api.py",
    "backend/simulation_store.py",
    "frontend/src/adoClient.ts",
    "frontend/src/storage.ts",
    "frontend/src/hooks/SimulationContext.tsx",
}
IMPACTED_PREFIXES = (
    "frontend/src/utils/",
    "frontend/src/hooks/",
    "frontend/src/components/ui/",
)
CENTRAL_DOCUMENTATION_PATHS = {
    "docs/definition-of-done.md",
    "docs/critical-paths.md",
    "docs/vitals-traceability.md",
    "docs/vitals-coverage-map.json",
}
BACKEND_DIRECT_TESTS = {
    "backend/api_config.py": ("tests/test_api_config.py",),
    "backend/api_static.py": ("tests/test_api_static.py",),
}
BACKEND_NEARBY_TESTS = {
    "backend/api.py": (
        "tests/test_api_health.py",
        "tests/test_api_static.py",
    ),
    "backend/simulation_store.py": (
        "tests/test_simulation_store.py",
        "tests/test_api_history.py",
    ),
}
FRONTEND_DIRECT_TESTS = {
    "frontend/src/components/AppHeader.tsx": (
        "frontend/src/components/AppHeader.test.jsx",
    ),
}
FRONTEND_NEARBY_TESTS = {
    "frontend/src/utils/math.ts": (
        "frontend/src/utils/math.test.ts",
        "frontend/src/utils/simulation.test.ts",
        "frontend/src/utils/forecastDiagnostics.test.ts",
    ),
    "frontend/src/utils/cycleTime.ts": (
        "frontend/src/utils/cycleTime.test.ts",
        "frontend/src/adoClient.test.ts",
    ),
    "frontend/src/utils/forecastDiagnostics.ts": (
        "frontend/src/utils/forecastDiagnostics.test.ts",
        "frontend/src/hooks/useSimulation.test.tsx",
    ),
    "frontend/src/adoClient.ts": (
        "frontend/src/adoClient.test.ts",
        "frontend/src/hooks/useOnboarding.test.tsx",
    ),
    "frontend/src/storage.ts": (
        "frontend/src/storage.test.ts",
        "frontend/src/hooks/useSimulationHistory.test.tsx",
    ),
    "frontend/src/hooks/SimulationContext.tsx": (
        "frontend/src/hooks/SimulationContext.test.tsx",
        "frontend/src/hooks/useSimulation.test.tsx",
    ),
}


def is_zero_oid(value: str) -> bool:
    return bool(value) and set(value) == {"0"} and len(value) in {40, 64}


def parse_pre_push_updates(stdin_text: str) -> tuple[PrePushRefUpdate, ...]:
    """Parse the four-column records supplied to a Git pre-push hook."""
    updates: list[PrePushRefUpdate] = []
    for line_number, raw_line in enumerate(stdin_text.splitlines(), start=1):
        if not raw_line.strip():
            continue
        fields = raw_line.split()
        if len(fields) != 4:
            raise ValueError(
                f"Invalid pre-push input on line {line_number}: expected 4 fields."
            )
        local_ref, local_sha, remote_ref, remote_sha = fields
        for label, value in (("local SHA", local_sha), ("remote SHA", remote_sha)):
            if not OID_PATTERN.fullmatch(value):
                raise ValueError(
                    f"Invalid pre-push input on line {line_number}: {label} is not a full OID."
                )
        updates.append(
            PrePushRefUpdate(
                local_ref=local_ref,
                local_sha=local_sha.lower(),
                remote_ref=remote_ref,
                remote_sha=remote_sha.lower(),
            )
        )
    if not updates:
        raise ValueError("Invalid pre-push input: no reference updates were provided.")
    return tuple(updates)


def _git_output(
    args: list[str],
    *,
    repository_root: Path = ROOT,
) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repository_root,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(detail or f"git {' '.join(args)} failed")
    return result.stdout


def resolve_commit_sha(sha: str, repository_root: Path = ROOT) -> str:
    """Resolve an object to the canonical commit SHA required by a detached worktree."""
    try:
        resolved = _git_output(
            ["rev-parse", "--verify", f"{sha}^{{commit}}"],
            repository_root=repository_root,
        ).strip()
    except RuntimeError as exc:
        raise ValueError(f"Unable to resolve pushed SHA as a commit: {sha}") from exc
    if not OID_PATTERN.fullmatch(resolved):
        raise ValueError(f"Git returned an invalid commit SHA for {sha}: {resolved}")
    return resolved.lower()


def _revision_args_for_update(
    update: PrePushRefUpdate,
    remote_name: str,
    repository_root: Path,
) -> tuple[str, tuple[str, ...]]:
    terminal_sha = resolve_commit_sha(update.local_sha, repository_root)
    if update.is_creation:
        return (
            terminal_sha,
            (
                "--reverse",
                "--topo-order",
                terminal_sha,
                "--not",
                f"--remotes={remote_name}",
            ),
        )
    remote_commit = resolve_commit_sha(update.remote_sha, repository_root)
    return (
        terminal_sha,
        ("--reverse", "--topo-order", f"{remote_commit}..{terminal_sha}"),
    )


def _changed_paths_for_commits(
    commit_shas: tuple[str, ...],
    repository_root: Path,
) -> tuple[str, ...]:
    changed_paths: list[str] = []
    seen: set[str] = set()
    for commit_sha in commit_shas:
        try:
            output = _git_output(
                [
                    "diff-tree",
                    "--root",
                    "-m",
                    "--no-commit-id",
                    "--name-only",
                    "-r",
                    "--diff-filter=ACMRD",
                    commit_sha,
                ],
                repository_root=repository_root,
            )
        except RuntimeError as exc:
            raise ValueError(
                f"Unable to determine changed files for pushed commit {commit_sha}."
            ) from exc
        for path in output.splitlines():
            normalized = path.strip()
            if normalized and normalized not in seen:
                seen.add(normalized)
                changed_paths.append(normalized)
    return tuple(changed_paths)


def build_push_validation_plan(
    updates: tuple[PrePushRefUpdate, ...],
    remote_name: str,
    repository_root: Path = ROOT,
) -> PushValidationPlan:
    """Resolve reference diffs and deduplicate terminal commits for validation."""
    if not remote_name.strip():
        raise ValueError("The pre-push remote name is required.")

    ranges: list[PushCommitRange] = []
    for update in updates:
        if update.is_deletion:
            ranges.append(
                PushCommitRange(
                    update=update,
                    terminal_sha=None,
                    revision_args=(),
                    commit_shas=(),
                    changed_paths=(),
                )
            )
            continue

        terminal_sha, revision_args = _revision_args_for_update(
            update,
            remote_name,
            repository_root,
        )
        try:
            output = _git_output(
                ["rev-list", *revision_args],
                repository_root=repository_root,
            )
        except RuntimeError as exc:
            raise ValueError(
                f"Unable to resolve pushed commit range for {update.local_ref}."
            ) from exc
        commits = tuple(line.strip().lower() for line in output.splitlines() if line.strip())
        if not commits and update.is_creation:
            commits = (terminal_sha,)
        for commit_sha in commits:
            if not OID_PATTERN.fullmatch(commit_sha):
                raise ValueError(
                    f"Git returned an invalid commit SHA for {update.local_ref}: {commit_sha}"
                )
        changed_paths = _changed_paths_for_commits(commits, repository_root)
        ranges.append(
            PushCommitRange(
                update=update,
                terminal_sha=terminal_sha,
                revision_args=revision_args,
                commit_shas=commits,
                changed_paths=changed_paths,
            )
        )

    targets_by_sha: dict[str, list[PushCommitRange]] = {}
    target_order: list[str] = []
    for commit_range in ranges:
        if commit_range.terminal_sha is None:
            continue
        if commit_range.terminal_sha not in targets_by_sha:
            targets_by_sha[commit_range.terminal_sha] = []
            target_order.append(commit_range.terminal_sha)
        targets_by_sha[commit_range.terminal_sha].append(commit_range)

    targets: list[PushValidationTarget] = []
    for terminal_sha in target_order:
        target_ranges = tuple(targets_by_sha[terminal_sha])
        changed_paths: list[str] = []
        seen_paths: set[str] = set()
        for commit_range in target_ranges:
            for path in commit_range.changed_paths:
                if path not in seen_paths:
                    seen_paths.add(path)
                    changed_paths.append(path)
        targets.append(
            PushValidationTarget(
                terminal_sha=terminal_sha,
                ranges=target_ranges,
                changed_paths=tuple(changed_paths),
            )
        )
    return PushValidationPlan(
        updates=updates,
        ranges=tuple(ranges),
        targets=tuple(targets),
    )


def staged_files() -> list[str]:
    """Return the files currently staged for the pre-commit hook."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        print("ERROR: unable to list staged files.", file=sys.stderr)
        if result.stderr:
            print(result.stderr, file=sys.stderr, end="")
        raise RuntimeError("git diff --cached failed")
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def is_documentation_only(paths: list[str]) -> bool:
    """Whether a staged change only touches user-facing repository documentation."""
    if not paths:
        return False
    return all(path in DOCUMENTATION_PATHS or path.startswith("docs/") for path in paths)


def _classify_changed_path(path: str) -> PathClassification:
    normalized = path.replace("\\", "/").strip("/")
    lowered = normalized.casefold()
    parts = tuple(part for part in lowered.split("/") if part)

    if (
        not normalized
        or normalized.startswith("../")
        or "/../" in normalized
        or re.match(r"^[a-zA-Z]:/", normalized)
    ):
        return PathClassification(
            path=path,
            level=ChangeLevel.MASSIVE,
            justification="Chemin vide, absolu ou hors dépôt : portée ambiguë.",
        )

    if (
        normalized in MASSIVE_EXACT_PATHS
        or normalized in MASSIVE_TEST_PATHS
        or any(normalized.startswith(prefix) for prefix in MASSIVE_PREFIXES)
        or (
            normalized.startswith("Scripts/")
            and Path(normalized).name in MASSIVE_SCRIPT_NAMES
        )
        or "coverage" in parts
        or "coverage" in Path(lowered).name
        or Path(lowered).name.startswith("requirements")
        or Path(lowered).name in {"package.json", "package-lock.json", "npm-shrinkwrap.json"}
    ):
        return PathClassification(
            path=normalized,
            level=ChangeLevel.MASSIVE,
            justification=(
                "Chemin transverse ou central : moteur, contrat, dépendance, CI, couverture, "
                "hook, gate ou configuration de validation."
            ),
        )

    if normalized in CENTRAL_DOCUMENTATION_PATHS:
        return PathClassification(
            path=normalized,
            level=ChangeLevel.MASSIVE,
            justification="Documentation normative liée à la DoD ou à la couverture.",
        )

    if normalized in DOCUMENTATION_PATHS or normalized.startswith("docs/"):
        return PathClassification(
            path=normalized,
            level=ChangeLevel.TARGETED,
            justification=(
                "Documentation isolée, contrôlée directement par les gardes "
                "documentaires."
            ),
        )

    if normalized in IMPACTED_EXACT_PATHS or any(
        normalized.startswith(prefix) for prefix in IMPACTED_PREFIXES
    ):
        return PathClassification(
            path=normalized,
            level=ChangeLevel.IMPACTED,
            justification=(
                "Module partagé ou dépendance proche avec plusieurs consommateurs "
                "possibles."
            ),
        )

    if normalized.startswith("tests/test_") and normalized.endswith(".py"):
        return PathClassification(
            path=normalized,
            level=ChangeLevel.TARGETED,
            justification=(
                "Test backend isolé dont la suite directe est explicitement "
                "identifiable."
            ),
        )

    if normalized.startswith("backend/") and normalized.endswith(".py"):
        if Path(normalized).name == "__init__.py":
            return PathClassification(
                path=normalized,
                level=ChangeLevel.IMPACTED,
                justification=(
                    "Initialisation de package backend pouvant affecter plusieurs "
                    "modules."
                ),
            )
        return PathClassification(
            path=normalized,
            level=ChangeLevel.TARGETED,
            justification="Module backend local avec tests backend directs identifiables.",
        )

    if (
        normalized.startswith("frontend/src/")
        and re.search(r"\.(?:test|spec)\.[jt]sx?$", normalized)
    ):
        return PathClassification(
            path=normalized,
            level=ChangeLevel.TARGETED,
            justification="Test frontend colocalisé dont la suite directe est identifiable.",
        )

    if normalized.startswith("frontend/src/components/") and re.search(
        r"\.[jt]sx?$", normalized
    ):
        return PathClassification(
            path=normalized,
            level=ChangeLevel.TARGETED,
            justification="Composant frontend local avec test colocalisé identifiable.",
        )

    return PathClassification(
        path=normalized,
        level=ChangeLevel.MASSIVE,
        justification="Chemin inconnu ou portée insuffisamment certaine ; classement conservateur.",
    )


def classify_changes(paths: list[str] | tuple[str, ...]) -> ChangeClassification:
    """Classify changed paths without selecting or modifying command execution."""
    decisions = tuple(_classify_changed_path(path) for path in paths)
    if not decisions:
        return ChangeClassification(
            level=ChangeLevel.MASSIVE,
            trigger_paths=(),
            justification="Aucun chemin exploitable : portée inconnue, classement conservateur.",
            path_decisions=(),
        )

    level = max(
        (decision.level for decision in decisions),
        key=lambda candidate: CHANGE_LEVEL_PRIORITY[candidate],
    )
    triggers = tuple(
        decision.path for decision in decisions if decision.level == level
    )
    reasons = tuple(
        dict.fromkeys(
            decision.justification
            for decision in decisions
            if decision.level == level
        )
    )
    return ChangeClassification(
        level=level,
        trigger_paths=triggers,
        justification=" ".join(reasons),
        path_decisions=decisions,
    )


def _ordered_unique(values: Iterator[str]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(values))


def _resolve_path_tests(
    decision: PathClassification,
) -> tuple[ChangeDomain, tuple[str, ...], bool] | None:
    path = decision.path
    if path in DOCUMENTATION_PATHS or path.startswith("docs/"):
        return ChangeDomain.DOCUMENTATION, (), False

    if path.startswith("tests/test_") and path.endswith(".py"):
        return ChangeDomain.BACKEND, (path,), False

    if path.startswith("backend/") and path.endswith(".py"):
        if decision.level == ChangeLevel.TARGETED:
            tests = BACKEND_DIRECT_TESTS.get(path)
        else:
            tests = BACKEND_NEARBY_TESTS.get(path)
        if tests:
            return ChangeDomain.BACKEND, tests, decision.level == ChangeLevel.IMPACTED
        return None

    if path.startswith("frontend/src/") and re.search(
        r"\.(?:test|spec)\.[jt]sx?$", path
    ):
        return ChangeDomain.FRONTEND, (path,), False

    if path.startswith("frontend/src/"):
        if decision.level == ChangeLevel.TARGETED:
            tests = FRONTEND_DIRECT_TESTS.get(path)
        else:
            tests = FRONTEND_NEARBY_TESTS.get(path)
        if tests:
            return ChangeDomain.FRONTEND, tests, decision.level == ChangeLevel.IMPACTED
        return None

    return None


def resolve_tests(context: ChangeContext) -> TestResolution:
    """Resolve domains and direct/nearby tests without creating commands."""
    classification = context.classification or classify_changes(context.changed_paths)
    if context.mode == "ci" or classification.level == ChangeLevel.MASSIVE:
        return TestResolution(
            level=ChangeLevel.MASSIVE,
            domains=(),
            impacted_domains=(),
            backend_tests=(),
            frontend_tests=(),
            unresolved_paths=(),
            justification=(
                "Le mode CI conserve le plan complet."
                if context.mode == "ci"
                else "Classification massive : le plan complet reste obligatoire."
            ),
        )

    domains: list[ChangeDomain] = []
    impacted_domains: list[ChangeDomain] = []
    backend_tests: list[str] = []
    frontend_tests: list[str] = []
    unresolved: list[str] = []
    for decision in classification.path_decisions:
        resolved = _resolve_path_tests(decision)
        if resolved is None:
            unresolved.append(decision.path)
            continue
        domain, tests, impacted = resolved
        domains.append(domain)
        if impacted:
            impacted_domains.append(domain)
        if domain == ChangeDomain.BACKEND:
            backend_tests.extend(tests)
        elif domain == ChangeDomain.FRONTEND:
            frontend_tests.extend(tests)

    if unresolved:
        unresolved_paths = _ordered_unique(iter(unresolved))
        return TestResolution(
            level=ChangeLevel.MASSIVE,
            domains=_ordered_unique(iter(domains)),
            impacted_domains=_ordered_unique(iter(impacted_domains)),
            backend_tests=_ordered_unique(iter(backend_tests)),
            frontend_tests=_ordered_unique(iter(frontend_tests)),
            unresolved_paths=unresolved_paths,
            justification=(
                "Résolution directe ou proche impossible pour : "
                + ", ".join(unresolved_paths)
                + ". Repli conservateur sur le plan massif."
            ),
        )

    return TestResolution(
        level=classification.level,
        domains=_ordered_unique(iter(domains)),
        impacted_domains=_ordered_unique(iter(impacted_domains)),
        backend_tests=_ordered_unique(iter(backend_tests)),
        frontend_tests=_ordered_unique(iter(frontend_tests)),
        unresolved_paths=(),
        justification=(
            "Tests directs résolus."
            if classification.level == ChangeLevel.TARGETED
            else "Tests directs et dépendances proches résolus avec contrôles de domaine."
        ),
    )


def command_text(argv: tuple[str, ...]) -> str:
    return subprocess.list2cmdline(list(argv))


def _is_direct_pytest_command(command: GateCommand) -> bool:
    return command.argv[:3] == (sys.executable, "-m", "pytest")


def _pytest_basetemp_prefix(command: GateCommand) -> str:
    command_prefix = re.sub(r"[^a-z0-9]+", "-", command.step.lower()).strip("-")
    return f"{command_prefix}-{os.getpid()}-"


def _is_descendant(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
    except ValueError:
        return False
    return True


def _validate_runtime_temp_root(
    validation_root: Path,
    runtime_temp_root: Path,
    *,
    isolated_validation: bool,
) -> None:
    if not _is_descendant(runtime_temp_root, validation_root):
        return
    expected_workspace_root = validation_root / ".tmp" / "pytest"
    if isolated_validation or not _is_descendant(
        runtime_temp_root,
        expected_workspace_root,
    ):
        raise ValueError(
            "Pytest runtime temporary directory must be outside the isolated validation root."
        )


def _runtime_temp_root(validation_root: Path, *, isolated_validation: bool) -> Path:
    temp_workspace = validation_root.parent if isolated_validation else validation_root
    return temp_workspace / ".tmp" / "pytest"


def _retry_windows_readonly_removal(
    function: Callable[[str], object],
    path: str,
    exception: BaseException,
) -> None:
    if os.name != "nt" or not isinstance(exception, PermissionError):
        raise exception
    os.chmod(path, stat.S_IREAD | stat.S_IWRITE)
    function(path)


def _remove_pytest_basetemp(
    basetemp: Path,
    runtime_temp_root: Path,
    *,
    expected_prefix: str,
) -> None:
    resolved_runtime_root = runtime_temp_root.resolve()
    resolved_basetemp = basetemp.resolve()
    if (
        resolved_basetemp == resolved_runtime_root
        or resolved_basetemp.parent != resolved_runtime_root
        or not basetemp.name.startswith(expected_prefix)
    ):
        raise ValueError("Refusing to remove an unexpected Pytest basetemp path.")
    if not basetemp.exists():
        return
    shutil.rmtree(basetemp, onexc=_retry_windows_readonly_removal)
    if basetemp.exists():
        raise OSError(f"Pytest basetemp still exists after cleanup: {basetemp}")


@contextmanager
def _command_argv(
    command: GateCommand,
    validation_root: Path,
    runtime_temp_root: Path,
    *,
    isolated_validation: bool,
) -> Iterator[tuple[str, ...]]:
    if not _is_direct_pytest_command(command):
        yield command.argv
        return

    _validate_runtime_temp_root(
        validation_root,
        runtime_temp_root,
        isolated_validation=isolated_validation,
    )
    runtime_temp_root.mkdir(parents=True, exist_ok=True)
    basetemp_prefix = _pytest_basetemp_prefix(command)
    basetemp = Path(
        tempfile.mkdtemp(
            prefix=basetemp_prefix,
            dir=runtime_temp_root,
        )
    )
    try:
        _validate_runtime_temp_root(
            validation_root,
            basetemp,
            isolated_validation=isolated_validation,
        )
        yield (
            *command.argv[:3],
            "--basetemp",
            str(basetemp),
            *command.argv[3:],
        )
    finally:
        _remove_pytest_basetemp(
            basetemp,
            runtime_temp_root,
            expected_prefix=basetemp_prefix,
        )


def build_change_context(mode: str, paths: list[str] | tuple[str, ...]) -> ChangeContext:
    """Build a pure change context from already-resolved paths."""
    if mode not in {"fast", "push", "ci"}:
        raise ValueError(f"Unsupported mode: {mode}")
    changed_paths = tuple(paths)
    if mode == "fast":
        changed_paths_source = InputSource.GIT_INDEX
    elif mode == "push":
        changed_paths_source = InputSource.HEAD
    else:
        changed_paths_source = None
    return ChangeContext(
        mode=mode,
        changed_paths=changed_paths,
        changed_paths_source=changed_paths_source,
        documentation_only=mode == "fast" and is_documentation_only(list(changed_paths)),
        classification=classify_changes(changed_paths),
    )


def build_push_change_context(target: PushValidationTarget) -> ChangeContext:
    """Build the future adaptive-selection context for one terminal commit."""
    introduced_commits: list[str] = []
    seen: set[str] = set()
    for commit_range in target.ranges:
        for commit_sha in commit_range.commit_shas:
            if commit_sha not in seen:
                seen.add(commit_sha)
                introduced_commits.append(commit_sha)
    return ChangeContext(
        mode="push",
        changed_paths=target.changed_paths,
        changed_paths_source=InputSource.HEAD,
        documentation_only=False,
        terminal_sha=target.terminal_sha,
        introduced_commit_shas=tuple(introduced_commits),
        revision_ranges=tuple(
            commit_range.revision_args for commit_range in target.ranges
        ),
        classification=classify_changes(target.changed_paths),
    )


def resolve_change_context(mode: str, paths: list[str] | None = None) -> ChangeContext:
    """Resolve the current change paths without changing gate selection semantics."""
    resolved_paths = staged_files() if paths is None and mode == "fast" else (paths or [])
    return build_change_context(mode, resolved_paths)


def _python_coverage_commands(command_input: tuple[InputSource, ...]) -> tuple[GateCommand, ...]:
    return (
        GateCommand(
            "Versioned Python coverage",
            (sys.executable, "-m", "pytest", "--cov", "--cov-config=.coveragerc",
             "--cov-report=json:.coverage.python.json", "--cov-report=term-missing", "-q"),
            "Add tests until every declared Python source has no uncovered line.",
            backend_test=True, input_sources=command_input,
            coverage_artifacts=(".coverage", ".coverage.python.json"),
        ),
        GateCommand(
            "Python coverage scope and per-file compliance",
            (sys.executable, "Scripts/check_python_coverage.py"),
            "Restore the declared Python scope, branch coverage, and per-file compliance.",
            input_sources=command_input,
        ),
    )


def build_execution_plan(context: ChangeContext) -> GateExecutionPlan:
    """Build the immutable ordered command plan for a resolved context."""
    if context.mode not in {"fast", "push", "ci"}:
        raise ValueError(f"Unsupported mode: {context.mode}")
    if context.mode == "fast":
        command_input = (InputSource.GIT_INDEX,)
    elif context.mode == "push":
        command_input = (InputSource.HEAD,)
    else:
        command_input = (InputSource.WORKSPACE,)
    commands = [
        GateCommand(
            "Repository hygiene (README, encoding, secrets and DoD)",
            (sys.executable, "Scripts/pre_commit_guard.py"),
            "Correct the reported README, encoding, secret, or DoD issue and stage the fix.",
            input_sources=command_input,
        ),
        GateCommand(
            "Identity boundary",
            (sys.executable, "Scripts/check_identity_boundary.py"),
            "Remove Azure DevOps identity data from the browser/backend boundary.",
            input_sources=command_input,
        ),
        GateCommand(
            "Naming convention",
            (sys.executable, "Scripts/check_naming_convention.py"),
            "Rename the reported code identifier in English.",
            input_sources=command_input,
        ),
        GateCommand(
            "Maintainability ratchet",
            (sys.executable, "Scripts/check_maintainability.py"),
            "Remove the new maintainability drift or explicitly review the versioned baseline.",
            input_sources=command_input,
        ),
    ]
    resolution = resolve_tests(context)
    if (
        context.documentation_only
        and context.mode == "fast"
        and resolution.level != ChangeLevel.MASSIVE
    ):
        return GateExecutionPlan(
            context=context,
            commands=tuple(commands),
            docker_smoke=False,
            resolution=resolution,
        )

    if resolution.level != ChangeLevel.MASSIVE:
        selected: list[GateCommand] = list(commands)
        seen_argv = {command.argv for command in selected}

        def append_unique(command: GateCommand) -> None:
            if command.argv not in seen_argv:
                seen_argv.add(command.argv)
                selected.append(command)

        if ChangeDomain.BACKEND in resolution.impacted_domains:
            append_unique(
                GateCommand(
                    "Backend lint (Ruff)",
                    (sys.executable, "-m", "ruff", "check", "."),
                    "Run `python -m ruff check .` and correct the reported lint issue.",
                    input_sources=command_input,
                )
            )

        if ChangeDomain.FRONTEND in resolution.impacted_domains:
            append_unique(
                GateCommand(
                    "Frontend lint (ESLint, zero warning)",
                    (
                        NPM_COMMAND,
                        "--prefix",
                        "frontend",
                        "run",
                        "lint",
                        "--",
                        "--max-warnings",
                        "0",
                    ),
                    "Run the displayed ESLint command and correct all errors and warnings.",
                    input_sources=command_input,
                )
            )
            append_unique(
                GateCommand(
                    "Frontend typecheck (TypeScript)",
                    (NPM_COMMAND, "--prefix", "frontend", "run", "typecheck"),
                    "Run `npm --prefix frontend run typecheck` and correct the type errors.",
                    input_sources=command_input,
                )
            )
        if resolution.backend_tests:
            append_unique(
                GateCommand(
                    "Selected backend tests",
                    (sys.executable, "-m", "pytest", "-q", *resolution.backend_tests),
                    "Correct the backend tests directly related to the changed files.",
                    backend_test=True,
                    input_sources=command_input,
                )
            )
        if resolution.frontend_tests:
            frontend_test_paths = tuple(
                path.removeprefix("frontend/") for path in resolution.frontend_tests
            )
            append_unique(
                GateCommand(
                    "Selected frontend unit tests (Vitest)",
                    (
                        NPM_COMMAND,
                        "--prefix",
                        "frontend",
                        "run",
                        "test:unit",
                        "--",
                        *frontend_test_paths,
                    ),
                    "Correct the frontend tests directly related to the changed files.",
                    input_sources=command_input,
                )
            )

        return GateExecutionPlan(
            context=context,
            commands=tuple(selected),
            docker_smoke=False,
            resolution=resolution,
        )

    commands.extend(
        [
            GateCommand(
                "Backend lint (Ruff)",
                (sys.executable, "-m", "ruff", "check", "."),
                "Run `python -m ruff check .` and correct the reported lint issue.",
                input_sources=command_input,
            ),
            GateCommand(
                "Frontend lint (ESLint, zero warning)",
                (NPM_COMMAND, "--prefix", "frontend", "run", "lint", "--", "--max-warnings", "0"),
                "Run the displayed ESLint command and correct all errors and warnings.",
                input_sources=command_input,
            ),
            GateCommand(
                "Frontend typecheck (TypeScript)",
                (NPM_COMMAND, "--prefix", "frontend", "run", "typecheck"),
                "Run `npm --prefix frontend run typecheck` and correct the type errors.",
                input_sources=command_input,
            ),
        ]
    )
    if context.mode in {"push", "ci"}:
        commands.extend(
            [
                *_python_coverage_commands(command_input),
                GateCommand(
                    "Frontend unit coverage",
                    (NPM_COMMAND, "--prefix", "frontend", "run", "test:unit:coverage"),
                    "Add frontend unit tests until all configured coverage thresholds pass.",
                    input_sources=command_input,
                    coverage_artifacts=(
                        "frontend/coverage/coverage-final.json",
                        "frontend/coverage/index.html",
                    ),
                ),
                GateCommand(
                    "Frontend build",
                    (NPM_COMMAND, "--prefix", "frontend", "run", "build"),
                    "Run `npm --prefix frontend run build` and correct the build error.",
                    input_sources=command_input,
                ),
                GateCommand(
                    "End-to-end tests (Playwright)",
                    (NPM_COMMAND, "--prefix", "frontend", "run", "test:e2e"),
                    "Install Playwright browsers explicitly if missing, then correct the failing "
                    "E2E test.",
                    input_sources=command_input,
                    coverage_artifacts=("frontend/coverage/e2e-coverage-summary.json",),
                ),
            ]
        )
    else:
        commands.extend(
            [
                GateCommand(
                    "Backend tests",
                    (sys.executable, "-m", "pytest", "-q"),
                    "Run `python -m pytest -q` and correct the failing backend test.",
                    backend_test=True,
                    input_sources=command_input,
                ),
                GateCommand(
                    "Frontend unit tests (Vitest)",
                    (NPM_COMMAND, "--prefix", "frontend", "run", "test:unit"),
                    "Run `npm --prefix frontend run test:unit` and correct the failing test.",
                    input_sources=command_input,
                ),
            ]
        )
    return GateExecutionPlan(
        context=context,
        commands=tuple(commands),
        docker_smoke=context.mode == "ci",
        resolution=resolution,
    )


def execution_plan(mode: str, documentation_only: bool) -> list[GateCommand]:
    """Return the historical list interface used by callers and tests."""
    context = build_change_context(
        mode,
        ["README.md"] if documentation_only else [],
    )
    return list(build_execution_plan(context).commands)


def _frontend_dependencies_available() -> bool:
    return (ROOT / "frontend" / "node_modules").is_dir()


def _run_command(
    command: GateCommand,
    *,
    validation_root: Path = ROOT,
    runtime_temp_root: Path | None = None,
    isolated_validation: bool = False,
    extra_env: dict[str, str] | None = None,
) -> int:
    print(f"\n==> {command.step}")
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    if command.backend_test:
        env.update(BACKEND_TEST_ENV)
    if _is_direct_pytest_command(command):
        env.pop("GIT_DIR", None)
        env.pop("GIT_WORK_TREE", None)
    resolved_runtime_temp_root = runtime_temp_root or _runtime_temp_root(
        validation_root,
        isolated_validation=isolated_validation,
    )
    with _command_argv(
        command,
        validation_root,
        resolved_runtime_temp_root,
        isolated_validation=isolated_validation,
    ) as argv:
        print(f"$ {command_text(argv)}")
        try:
            result = subprocess.run(argv, cwd=validation_root, check=False, env=env)
        except OSError as exc:
            print(f"ERROR: command could not start: {exc}", file=sys.stderr)
            print(f"Expected correction: {command.correction}", file=sys.stderr)
            return 127
    if result.returncode:
        print(f"ERROR: step failed: {command.step}", file=sys.stderr)
        print(f"Failed command: {command_text(argv)}", file=sys.stderr)
        print(f"Expected correction: {command.correction}", file=sys.stderr)
    return result.returncode


def _checkout_index(snapshot_root: Path, repository_root: Path = ROOT) -> None:
    prefix = f"{snapshot_root.resolve().as_posix()}/"
    result = subprocess.run(
        ["git", "checkout-index", "--all", "--force", f"--prefix={prefix}"],
        cwd=repository_root,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        print("ERROR: unable to materialize the staged Git index.", file=sys.stderr)
        if result.stderr:
            print(result.stderr, file=sys.stderr, end="")
        raise RuntimeError("git checkout-index failed")


def _link_directory(source: Path, destination: Path) -> None:
    is_junction = getattr(os.path, "isjunction", lambda _path: False)
    if destination.exists() or destination.is_symlink() or is_junction(destination):
        raise FileExistsError(f"Frontend dependency destination already exists: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        destination.symlink_to(source, target_is_directory=True)
        return
    except OSError:
        if os.name != "nt":
            raise
    creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    result = subprocess.run(
        ["cmd.exe", "/c", "mklink", "/J", str(destination), str(source)],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=creation_flags,
    )
    if result.returncode:
        raise OSError(result.stderr or result.stdout or "Unable to link frontend dependencies.")


def _frontend_dependency_paths(validation_root: Path) -> tuple[Path, Path]:
    source = ROOT / "frontend" / "node_modules"
    destination = validation_root / "frontend" / "node_modules"
    return source, destination


def _remove_frontend_dependency_link(destination: Path, expected_source: Path) -> None:
    is_junction = getattr(os.path, "isjunction", lambda _path: False)
    if not (destination.is_symlink() or is_junction(destination)):
        raise OSError(f"Refusing to remove a non-link dependency path: {destination}")
    if destination.resolve() != expected_source.resolve():
        raise OSError(
            "Refusing to remove a frontend dependency link with an unexpected target: "
            f"{destination}"
        )
    if destination.is_symlink():
        destination.unlink()
    else:
        os.rmdir(destination)


@contextmanager
def exposed_frontend_dependencies(validation_root: Path) -> Iterator[Path]:
    """Expose only installed frontend dependencies to one isolated repository."""
    source, destination = _frontend_dependency_paths(validation_root)
    if not source.is_dir():
        raise FileNotFoundError(f"Host frontend dependencies are missing: {source}")

    created = False
    try:
        _link_directory(source, destination)
        created = True
        if destination.resolve() != source.resolve():
            raise OSError(
                "Frontend dependency exposure points to an unexpected target: "
                f"{destination}"
            )
        yield destination
    finally:
        if created:
            _remove_frontend_dependency_link(destination, source)


@contextmanager
def staged_index_snapshot(repository_root: Path = ROOT) -> Iterator[Path]:
    """Materialize exactly the current Git index in a temporary directory."""
    with tempfile.TemporaryDirectory(prefix="montecarlo-staged-") as temp_dir:
        snapshot_root = Path(temp_dir) / "repository"
        snapshot_root.mkdir()
        _checkout_index(snapshot_root, repository_root)
        yield snapshot_root


def _run_worktree_command(
    args: list[str],
    *,
    repository_root: Path = ROOT,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "worktree", *args],
        cwd=repository_root,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def _cleanup_detached_worktree(
    worktree_root: Path,
    repository_root: Path = ROOT,
) -> None:
    remove_result = _run_worktree_command(
        ["remove", "--force", str(worktree_root)],
        repository_root=repository_root,
    )
    prune_result = _run_worktree_command(["prune"], repository_root=repository_root)
    errors = [
        output.strip()
        for result in (remove_result, prune_result)
        if result.returncode
        for output in (result.stderr or result.stdout,)
        if output.strip()
    ]
    if errors:
        raise RuntimeError("Unable to clean detached worktree: " + " | ".join(errors))


@contextmanager
def detached_commit_worktree(
    commit_sha: str,
    repository_root: Path = ROOT,
) -> Iterator[Path]:
    """Create and always remove a detached temporary worktree for one commit."""
    with tempfile.TemporaryDirectory(prefix="montecarlo-push-") as temp_dir:
        worktree_root = Path(temp_dir) / "repository"
        add_attempted = False
        active_exception = False
        try:
            add_attempted = True
            result = _run_worktree_command(
                ["add", "--detach", "--force", str(worktree_root), commit_sha],
                repository_root=repository_root,
            )
            if result.returncode:
                detail = result.stderr.strip() or result.stdout.strip()
                raise RuntimeError(
                    f"Unable to create detached worktree for {commit_sha}: {detail}"
                )
            yield worktree_root
        except BaseException:
            active_exception = True
            raise
        finally:
            if add_attempted:
                try:
                    _cleanup_detached_worktree(worktree_root, repository_root)
                except RuntimeError as exc:
                    if active_exception:
                        print(f"ERROR: {exc}", file=sys.stderr)
                    else:
                        raise


def _index_git_environment(repository_root: Path = ROOT) -> dict[str, str]:
    return {
        "GIT_DIR": str((repository_root / ".git").resolve()),
        "GIT_WORK_TREE": str(repository_root.resolve()),
    }


def _ensure_frontend_dependencies() -> int:
    if _frontend_dependencies_available():
        return 0
    dependency_root = ROOT / "frontend" / "node_modules"
    print(f"ERROR: frontend dependencies are missing: {dependency_root}", file=sys.stderr)
    print(
        "Expected correction: run `npm --prefix frontend ci` explicitly, then retry.",
        file=sys.stderr,
    )
    return 1


def _request(
    url: str, payload: bytes | None = None, headers: dict[str, str] | None = None
) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        data=payload,
        headers=headers or {},
        method="POST" if payload else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def _docker_logs() -> None:
    subprocess.run(
        ["docker", "compose", "logs", "backend", "mongo", "redis"], cwd=ROOT, check=False
    )


def _validate_docker_smoke_configuration(repository_root: Path | None = None) -> bool:
    root = repository_root or ROOT
    if not (root / ".env").exists():
        print("ERROR: .env is required for Docker smoke testing.", file=sys.stderr)
        print(
            "Expected correction: copy .env.example to .env and set local values explicitly.",
            file=sys.stderr,
        )
        return False
    return True


def _run_docker_http_smoke() -> None:
    print("\n==> Docker smoke test")
    print("$ HTTP health, Mongo persistence, and shared rate-limit checks")
    for _ in range(30):
        try:
            status, _ = _request("http://127.0.0.1:8000/health")
        except (urllib.error.URLError, OSError):
            status = 0
        if status == 200:
            break
        time.sleep(2)
    else:
        raise RuntimeError("The health endpoint did not become ready within 60 seconds.")

    mongo_status, mongo_body = _request("http://127.0.0.1:8000/health/mongo")
    if mongo_status != 200 or '"status":"ok"' not in mongo_body:
        raise RuntimeError("Mongo health endpoint is not OK.")

    payload = (
        b'{"throughput_samples":[1,2,3,4,5,6],"mode":"backlog_to_weeks",'
        b'"backlog_size":20,"n_sims":2000}'
    )
    headers = {
        "Content-Type": "application/json",
        "Cookie": "IDMontecarlo=ci-smoke-idmontecarlo",
    }
    simulate_status, _ = _request("http://127.0.0.1:8000/simulate", payload, headers)
    if simulate_status != 200:
        raise RuntimeError(f"POST /simulate returned HTTP {simulate_status}.")
    history_status, history_body = _request(
        "http://127.0.0.1:8000/simulations/history", headers={"Cookie": headers["Cookie"]}
    )
    if history_status != 200 or '"mode":"backlog_to_weeks"' not in history_body:
        raise RuntimeError("Simulation history did not return the persisted simulation.")

    rate_payload = (
        b'{"throughput_samples":[1,2,3,4,5,6],"mode":"backlog_to_weeks",'
        b'"backlog_size":10,"n_sims":2000}'
    )
    rate_headers = {
        "Content-Type": "application/json",
        "X-Forwarded-For": "ci-rate-limit-shared",
    }
    last_status = 0
    for attempt in range(1, 22):
        last_status, _ = _request(
            "http://127.0.0.1:8000/simulate", rate_payload, rate_headers
        )
        if attempt <= 20 and last_status != 200:
            raise RuntimeError(
                f"Rate limit rejected request {attempt} too early: HTTP {last_status}."
            )
    if last_status != 429:
        raise RuntimeError(
            f"Expected HTTP 429 after the rate limit, received HTTP {last_status}."
        )


def _run_docker_smoke() -> int:
    if not _validate_docker_smoke_configuration():
        return 1

    started = False
    try:
        for command in (
            GateCommand(
                "Docker build",
                ("docker", "compose", "build"),
                "Install and start Docker Desktop, then ensure `docker compose version` succeeds.",
            ),
            GateCommand(
                "Docker start",
                ("docker", "compose", "up", "-d"),
                "Install and start Docker Desktop, then correct the Docker startup error.",
            ),
        ):
            code = _run_command(command)
            if code:
                return code
            started = True

        _run_docker_http_smoke()
    except (RuntimeError, urllib.error.URLError, OSError) as exc:
        print("ERROR: step failed: Docker smoke test", file=sys.stderr)
        print("Failed command: HTTP Docker smoke checks", file=sys.stderr)
        print(f"Detail: {exc}", file=sys.stderr)
        print(
            "Expected correction: inspect Docker logs and correct the health, persistence, or "
            "rate-limit failure.",
            file=sys.stderr,
        )
        _docker_logs()
        return 1
    finally:
        if started:
            _run_command(
                GateCommand(
                    "Docker cleanup",
                    ("docker", "compose", "down", "-v"),
                    "Stop the Docker services manually after resolving the failure.",
                )
            )
    return 0


def _execute_gate_plan(
    plan: GateExecutionPlan,
    *,
    validation_root: Path,
    runtime_temp_root: Path,
    isolated_validation: bool,
    command_env: dict[str, str] | None = None,
) -> int:
    execution_env = dict(command_env or {})
    if isolated_validation:
        execution_env["MONTECARLO_E2E_PYTHON"] = sys.executable
    has_frontend_commands = any(command.argv[0] == NPM_COMMAND for command in plan.commands)
    if has_frontend_commands:
        code = _ensure_frontend_dependencies()
        if code:
            return code
    dependency_manager = (
        exposed_frontend_dependencies(validation_root)
        if has_frontend_commands and isolated_validation
        else nullcontext()
    )
    try:
        with dependency_manager:
            for command in plan.commands:
                code = _run_command(
                    command,
                    validation_root=validation_root,
                    runtime_temp_root=runtime_temp_root,
                    isolated_validation=isolated_validation,
                    extra_env=execution_env or None,
                )
                if code:
                    return code
    except OSError as exc:
        print(
            "ERROR: unable to expose frontend dependencies to isolated checkout: "
            f"{exc}",
            file=sys.stderr,
        )
        return 1
    return 0


def _print_plan_selection(plan: GateExecutionPlan) -> None:
    classification = plan.context.classification
    resolution = plan.resolution
    level = (
        resolution.level
        if resolution is not None
        else classification.level
        if classification is not None
        else ChangeLevel.MASSIVE
    )
    triggers = classification.trigger_paths if classification is not None else ()
    print(f"Change validation level: {level.value}")
    print(f"Trigger paths: {', '.join(triggers) if triggers else '(none)'}")
    if resolution is not None:
        print(f"Selection reason: {resolution.justification}")
    print("Selected commands:")
    for command in plan.commands:
        print(f"  - {command.step}: {command_text(command.argv)}")


def run_gate(mode: str, paths: list[str] | None = None) -> int:
    """Run a gate and propagate the first failing command exit code."""
    context = resolve_change_context(mode, paths)
    plan = build_execution_plan(context)
    print(f"Quality gate mode: {mode}")
    if context.documentation_only:
        print("Documentation-only change detected: expensive code checks are skipped.")
    _print_plan_selection(plan)

    snapshot_manager = staged_index_snapshot() if mode == "fast" else nullcontext(ROOT)
    with snapshot_manager as validation_root:
        isolated_validation = mode == "fast"
        runtime_temp_root = _runtime_temp_root(
            validation_root,
            isolated_validation=isolated_validation,
        )
        command_env = _index_git_environment() if mode == "fast" else None
        code = _execute_gate_plan(
            plan,
            validation_root=validation_root,
            runtime_temp_root=runtime_temp_root,
            isolated_validation=isolated_validation,
            command_env=command_env,
        )
        if code:
            return code
    if plan.docker_smoke:
        return _run_docker_smoke()
    print("\nQuality gate passed.")
    return 0


def run_pre_push_gate(
    stdin_text: str,
    *,
    remote_name: str,
    remote_url: str = "",
    repository_root: Path = ROOT,
) -> int:
    """Validate each distinct terminal commit while preserving introduced diffs."""
    try:
        updates = parse_pre_push_updates(stdin_text)
        validation = build_push_validation_plan(updates, remote_name, repository_root)
    except (RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    print(f"Pre-push remote: {remote_name} {remote_url}".rstrip())
    for commit_range in validation.ranges:
        update = commit_range.update
        if update.is_deletion:
            print(f"Reference deletion: {update.remote_ref}")
        else:
            revision = " ".join(commit_range.revision_args)
            print(
                f"Reference update: {update.local_ref} -> {update.remote_ref} "
                f"({revision}; commits={len(commit_range.commit_shas)}; "
                f"files={len(commit_range.changed_paths)})"
            )

    for target in validation.targets:
        print(f"\nValidating pushed terminal commit: {target.terminal_sha}")
        context = build_push_change_context(target)
        plan = build_execution_plan(context)
        _print_plan_selection(plan)
        try:
            with detached_commit_worktree(
                target.terminal_sha,
                repository_root,
            ) as worktree_root:
                code = _execute_gate_plan(
                    plan,
                    validation_root=worktree_root,
                    runtime_temp_root=_runtime_temp_root(
                        worktree_root,
                        isolated_validation=True,
                    ),
                    isolated_validation=True,
                )
        except (KeyboardInterrupt, RuntimeError) as exc:
            print(f"ERROR: pre-push validation interrupted: {exc}", file=sys.stderr)
            return 1
        if code:
            return code

    print("\nQuality gate passed.")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mode",
        choices=("fast", "push", "ci"),
        help="fast for pre-commit, push for pre-push, ci for GitHub Actions",
    )
    parser.add_argument("--remote-name", default="")
    parser.add_argument("--remote-url", default="")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.mode == "push":
        return run_pre_push_gate(
            sys.stdin.read(),
            remote_name=args.remote_name,
            remote_url=args.remote_url,
        )
    return run_gate(args.mode)


if __name__ == "__main__":
    raise SystemExit(main())
