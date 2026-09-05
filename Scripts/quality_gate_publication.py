"""Fail-closed publication policies evaluated before the expensive quality DAG."""

from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path
from typing import Any


def is_github_remote_url(remote_url: str) -> bool:
    """Return whether a remote URL points to the governed GitHub host."""
    return bool(
        re.match(
            r"^(?:https://github\.com/|ssh://git@github\.com/|git@github\.com:)",
            remote_url.strip().casefold(),
        )
    )


def commit_shas(
    output: str,
    local_ref: str,
    *,
    valid_oid: Callable[[str], Any],
) -> tuple[str, ...]:
    commits = tuple(line.strip().lower() for line in output.splitlines() if line.strip())
    for commit_sha in commits:
        if not valid_oid(commit_sha):
            raise ValueError(f"Git returned an invalid commit SHA for {local_ref}: {commit_sha}")
    return commits


def introduced_boundary_shas(
    commit_shas: tuple[str, ...],
    repository_root: Path,
    *,
    git_output: Callable[..., str],
    valid_oid: Callable[[str], bool],
) -> tuple[str, ...]:
    """Return parents outside a newly published branch's introduced history."""
    introduced = set(commit_shas)
    boundaries: list[str] = []
    seen: set[str] = set()
    for commit_sha in commit_shas:
        try:
            lineage = git_output(
                ["rev-list", "--parents", "-n", "1", commit_sha],
                repository_root=repository_root,
            ).split()
        except RuntimeError as exc:
            raise ValueError(
                f"Unable to resolve the publication boundary for {commit_sha}."
            ) from exc
        if not lineage or lineage[0].lower() != commit_sha:
            raise ValueError(f"Git returned an invalid parent list for {commit_sha}.")
        for parent_sha in lineage[1:]:
            normalized = parent_sha.lower()
            if not valid_oid(normalized):
                raise ValueError(f"Git returned an invalid parent SHA for {commit_sha}.")
            if normalized not in introduced and normalized not in seen:
                seen.add(normalized)
                boundaries.append(normalized)
    return tuple(boundaries)


def tree_blob_oid(
    commit_sha: str,
    path: str,
    repository_root: Path,
    *,
    git_output: Callable[..., str],
    valid_oid: Callable[[str], bool],
) -> str | None:
    """Return one exact blob OID from a commit, failing on malformed Git output."""
    try:
        output = git_output(
            ["ls-tree", "-z", commit_sha, "--", path],
            repository_root=repository_root,
        )
    except RuntimeError as exc:
        raise ValueError(f"Unable to inspect {path} in commit {commit_sha}.") from exc
    records = tuple(record for record in output.split("\0") if record)
    if not records:
        return None
    if len(records) != 1 or "\t" not in records[0]:
        raise ValueError(f"Git returned an invalid tree entry for {path} in {commit_sha}.")
    metadata, returned_path = records[0].split("\t", maxsplit=1)
    fields = metadata.split()
    if (
        returned_path != path
        or len(fields) != 3
        or fields[1] != "blob"
        or not valid_oid(fields[2])
    ):
        raise ValueError(f"Git returned an invalid tree entry for {path} in {commit_sha}.")
    return fields[2].lower()


def publication_readme_changed(
    commit_range: Any,
    repository_root: Path,
    *,
    read_blob_oid: Callable[[str, str, Path], str | None],
) -> bool:
    """Check README as a terminal publication outcome, not a checkpoint ritual."""
    if commit_range.terminal_sha is None or not commit_range.commit_shas:
        return True
    if not commit_range.update.is_creation and not commit_range.base_shas:
        raise ValueError(f"Missing publication base for {commit_range.update.local_ref}.")
    terminal_blob = read_blob_oid(commit_range.terminal_sha, "README.md", repository_root)
    if terminal_blob is None:
        return False
    return all(
        read_blob_oid(base_sha, "README.md", repository_root) != terminal_blob
        for base_sha in commit_range.base_shas
    )


def validate_publication_readme(
    validation: Any,
    repository_root: Path,
    *,
    readme_changed: Callable[[Any, Path], bool],
) -> None:
    """Require one meaningful root README outcome for every published commit range."""
    missing = tuple(
        commit_range.update.remote_ref
        for commit_range in validation.ranges
        if not readme_changed(commit_range, repository_root)
    )
    if missing:
        raise ValueError(
            "README.md must differ in the terminal publication state for: "
            + ", ".join(missing)
        )
