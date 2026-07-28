"""Shared diagnostics for the engine-independent statistical corpus validator."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    instance_path: str
    keyword: str
    message: str
    schema_path: str

    def render(self, source: Path) -> str:
        return (
            f"{source.as_posix()}:{self.instance_path}: [{self.keyword}] {self.message} "
            f"(schema {self.schema_path})"
        )


@dataclass(frozen=True, slots=True)
class InputRejectionProbe:
    probe_id: str
    source_case_id: str
    operation: str
    path: tuple[str | int, ...]
    value: Any
    expected_instance_path: str
    expected_keyword: str


def semantic_issue(instance_path: str, keyword: str, message: str) -> ValidationIssue:
    return ValidationIssue(
        instance_path=instance_path,
        keyword=keyword,
        message=message,
        schema_path="/$defs/expectedResult/$comment",
    )
