"""Shared construction of one policy-enforcement quality-gate command."""

from __future__ import annotations

import sys
from typing import Any


def enforcement_command(
    q: Any,
    inputs: tuple[Any, ...],
    *,
    step: str,
    kind: str,
    artifact: str,
    schema: str,
    output: str,
    requirements: tuple[str, ...],
    controls: tuple[str, ...],
    reproduce: str,
) -> Any:
    argv = [
        sys.executable,
        "Scripts/statistical_main_enforcement.py",
        "enforce",
        "--kind",
        kind,
        "--artifact",
        artifact,
        "--schema",
        schema,
        "--output",
        output,
    ]
    for requirement in requirements:
        argv.extend(("--requires", requirement))
    for control in controls:
        argv.extend(("--control", control))
    argv.extend(("--reproduce", reproduce))
    return q.GateCommand(
        step,
        tuple(argv),
        f"Inspect the specialized diagnostics, then rerun `{reproduce}`.",
        input_sources=inputs,
    )
