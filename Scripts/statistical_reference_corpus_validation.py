"""Compose every normative validation required before executing either engine."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from Scripts.statistical_reference_corpus_invariants import (
    validate_pbi_210_scope,
    validate_pbi_211_scope,
)
from Scripts.statistical_reference_corpus_models import ValidationIssue
from Scripts.statistical_reference_corpus_pbi_214 import validate_pbi_214_scope
from Scripts.statistical_reference_corpus_pbi_215 import validate_pbi_215_scope

ContractValidator = Callable[[Any, dict[str, Any]], list[ValidationIssue]]


def validate_reference_corpus(
    instance: Any,
    schema: dict[str, Any],
    validate_contract: ContractValidator,
) -> list[ValidationIssue]:
    issues = validate_contract(instance, schema)
    issues.extend(validate_pbi_210_scope(instance))
    issues.extend(validate_pbi_211_scope(instance))
    issues.extend(validate_pbi_214_scope(instance))
    issues.extend(validate_pbi_215_scope(instance))
    return sorted(
        issues,
        key=lambda issue: (
            issue.instance_path,
            issue.keyword,
            issue.message,
            issue.schema_path,
        ),
    )
