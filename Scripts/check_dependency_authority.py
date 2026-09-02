#!/usr/bin/env python3
"""Validate the versioned target dependency authority and its evidence."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from Scripts.dependency_authority import (  # noqa: E402
    DEFAULT_AUTHORITY,
    DEFAULT_SCHEMA,
    AuthorityValidationError,
    DependencyAuthority,
    authority_evidence,
    load_dependency_authority,
)
from Scripts.dependency_authority_contract import Diagnostic  # noqa: E402
from Scripts.dependency_authority_cycles import (  # noqa: E402
    ModuleAcyclicityResult,
    ModuleCycleInspectionError,
    inspect_repository_module_cycles,
)
from Scripts.dependency_authority_domain import (  # noqa: E402
    DomainIndependenceResult,
    DomainInspectionError,
    inspect_repository_domain,
)
from Scripts.dependency_authority_public_api import (  # noqa: E402
    PublicApiInspectionError,
    PublicApiResult,
    inspect_repository_public_apis,
)

DEFAULT_EVIDENCE = ROOT / "reports" / "dependency-authority-validation.json"


def _resolved(root: Path, path: Path) -> Path:
    return path if path.is_absolute() else root / path


def _render_evidence(evidence: dict[str, object]) -> str:
    return json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"


def _validated_domain(
    authority: DependencyAuthority, root: Path
) -> DomainIndependenceResult | None:
    try:
        domain_result = inspect_repository_domain(authority, root)
    except DomainInspectionError as exc:
        diagnostic = Diagnostic(
            "DEP-DOMAIN-SCAN",
            "/",
            f"Impossible d'inspecter les dépendances du domaine: {exc}",
            "Rétablir des racines produit et des sources UTF-8 lisibles avant de "
            "relancer le contrôle.",
        )
        print(diagnostic.render(root), file=sys.stderr)
        return None
    if domain_result.diagnostics:
        for diagnostic in domain_result.diagnostics:
            print(diagnostic.render(root), file=sys.stderr)
        return None
    return domain_result


def _validated_public_apis(
    authority: DependencyAuthority, root: Path
) -> PublicApiResult | None:
    try:
        result = inspect_repository_public_apis(authority, root)
    except PublicApiInspectionError as exc:
        diagnostic = Diagnostic(
            "DEP-PUBLIC-API-SCAN",
            "/",
            f"Impossible d'inspecter les API publiques: {exc}",
            "Rétablir des racines gouvernées et des sources UTF-8 lisibles avant de "
            "relancer le contrôle.",
        )
        print(diagnostic.render(root), file=sys.stderr)
        return None
    if result.diagnostics:
        for diagnostic in result.diagnostics:
            print(diagnostic.render(root), file=sys.stderr)
        return None
    return result


def _validated_module_cycles(
    authority: DependencyAuthority, root: Path
) -> ModuleAcyclicityResult | None:
    try:
        result = inspect_repository_module_cycles(authority, root)
    except ModuleCycleInspectionError as exc:
        diagnostic = Diagnostic(
            "DEP-MODULE-CYCLE-SCAN",
            "/",
            f"Impossible d'inspecter le graphe des modules gouvernés: {exc}",
            "Rétablir des racines gouvernées et des sources UTF-8 lisibles avant de "
            "relancer le contrôle.",
        )
        print(diagnostic.render(root), file=sys.stderr)
        return None
    if result.diagnostics:
        for diagnostic in result.diagnostics:
            print(diagnostic.render(root), file=sys.stderr)
        return None
    return result


def _validated_evidence(
    authority: DependencyAuthority,
    domain_result: DomainIndependenceResult,
    public_api_result: PublicApiResult,
    cycle_result: ModuleAcyclicityResult,
) -> str:
    return _render_evidence(
        authority_evidence(
            authority,
            domain_files=domain_result.files,
            domain_dependencies=domain_result.dependencies,
            module_files=public_api_result.files,
            module_dependencies=public_api_result.dependencies,
            governed_modules=public_api_result.modules,
            public_api_entrypoints=public_api_result.public_entrypoints,
            deep_import_exceptions=public_api_result.exceptions,
            module_dependency_edges=len(cycle_result.module_edges),
            module_cycles=len(cycle_result.cycles),
        )
    )


def _success_message(
    authority: DependencyAuthority,
    domain_result: DomainIndependenceResult,
    public_api_result: PublicApiResult,
    cycle_result: ModuleAcyclicityResult,
) -> str:
    return (
        "Dependency authority valid: "
        f"{len(authority.document['layers'])} layers, "
        f"{len(authority.document['directions'])} directions, "
        f"{len(authority.document['runtimes'])} runtimes; "
        f"domain independent across {domain_result.files} files and "
        f"{domain_result.dependencies} dependencies; "
        f"{public_api_result.modules} governed modules expose "
        f"{public_api_result.public_entrypoints} public entrypoints across "
        f"{public_api_result.dependencies} inspected imports; "
        f"their dependency graph is acyclic across "
        f"{len(cycle_result.module_edges)} inter-module edges."
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--authority", type=Path, default=DEFAULT_AUTHORITY)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--evidence", type=Path, default=DEFAULT_EVIDENCE)
    parser.add_argument(
        "--write-evidence",
        action="store_true",
        help="Write the deterministic validation evidence instead of checking it.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = args.root.resolve()
    authority_path = _resolved(root, args.authority)
    schema_path = _resolved(root, args.schema)
    evidence_path = _resolved(root, args.evidence)
    try:
        authority = load_dependency_authority(authority_path, schema_path, root)
    except AuthorityValidationError as exc:
        for diagnostic in exc.diagnostics:
            print(diagnostic.render(exc.source), file=sys.stderr)
        return 1
    domain_result = _validated_domain(authority, root)
    public_api_result = _validated_public_apis(authority, root)
    cycle_result = _validated_module_cycles(authority, root)
    if domain_result is None or public_api_result is None or cycle_result is None:
        return 1
    rendered = _validated_evidence(
        authority, domain_result, public_api_result, cycle_result
    )
    if args.write_evidence:
        evidence_path.parent.mkdir(parents=True, exist_ok=True)
        evidence_path.write_text(rendered, encoding="utf-8", newline="\n")
        print(f"Dependency authority evidence written: {evidence_path}")
        return 0
    try:
        committed = evidence_path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        print(
            f"{evidence_path}:/: [DEP-AUTH-EVIDENCE-READ] Preuve illisible: {exc}. "
            "Correction: régénérer avec --write-evidence.",
            file=sys.stderr,
        )
        return 1
    if committed != rendered:
        print(
            f"{evidence_path}:/: [DEP-AUTH-EVIDENCE-STALE] La preuve ne correspond plus "
            "à l'autorité validée. Correction: revoir les changements puis régénérer avec "
            "--write-evidence.",
            file=sys.stderr,
        )
        return 1
    print(_success_message(authority, domain_result, public_api_result, cycle_result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
