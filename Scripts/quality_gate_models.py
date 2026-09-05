"""Immutable inputs and execution plans shared by quality-gate policies."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from Scripts.git_staging import StagedChange


def is_zero_oid(value: str) -> bool:
    return bool(value) and set(value) == {"0"} and len(value) in {40, 64}


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
    requires_frontend_dependencies: bool = False


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
    execution_profile: str | None = None
    staged_changes: tuple[StagedChange, ...] | None = None
    publication_candidate: bool = False


@dataclass(frozen=True)
class GateExecutionPlan:
    """Pure description of the commands and final smoke check to execute."""

    context: ChangeContext
    commands: tuple[GateCommand, ...]
    docker_smoke: bool
    resolution: TestResolution | None = None
    execution_profile: str = "pr"

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
    base_shas: tuple[str, ...] = ()


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
