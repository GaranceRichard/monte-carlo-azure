#!/usr/bin/env python3
"""
Fail CI when Azure DevOps identity data crosses the browser/backend boundary.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN_BACKEND_FIELDS = (
    "client_context",
    "selected_org",
    "selected_project",
    "selected_team",
    "organization_name",
    "project_name",
    "team_name",
    "pat",
    "ado_pat",
    "personal_access_token",
    "server_url",
    "azure_devops_url",
    "ado_server_url",
)

TARGET_FILES = (
    "frontend/src/types.ts",
    "frontend/src/api.ts",
    "frontend/src/api/simulationDtos.ts",
    "frontend/src/api/simulationMappers.ts",
    "frontend/src/hooks/simulationForecastCore.ts",
    "frontend/src/hooks/simulationForecastService.ts",
    "backend/api_models.py",
    "backend/api_routes_simulate.py",
    "backend/simulation_store.py",
    "frontend/vite.config.js",
    "Dockerfile",
    "docker-compose.yml",
)

RULE_DETAILS = {
    "IDENTITY-001": (
        "Forbidden Azure DevOps proxy or relay route.",
        "Remove local /ado or /vssps proxying and call Azure DevOps directly from the browser.",
    ),
    "IDENTITY-002": (
        "Forbidden local or backend endpoint receiving an Azure DevOps PAT.",
        "Delete the PAT relay/resolver endpoint and keep PAT handling in browser-only code.",
    ),
    "IDENTITY-003": (
        "Browser Azure DevOps calls must use official cloud URLs or a locally entered on-prem URL.",
        "Restore direct browser usage of official Azure DevOps endpoints in adoClient.ts.",
    ),
    "IDENTITY-004": (
        "Forbidden Azure DevOps context field in simulation request contract.",
        "Remove the Azure DevOps field from SimulateRequestDto or SimulateRequest.",
    ),
    "IDENTITY-005": (
        "Forbidden Azure DevOps context field in POST /simulate payload construction.",
        "Keep postSimulate payloads limited to throughput samples and simulation parameters.",
    ),
    "IDENTITY-006": (
        "Forbidden Azure DevOps context field in backend persistence.",
        "Do not persist Azure DevOps identity or PAT data in SimulationStore.",
    ),
    "IDENTITY-007": (
        "Forbidden Azure DevOps context field in backend history response.",
        "Keep SimulationHistoryItem and GET /simulations/history limited to anonymous statistics.",
    ),
    "IDENTITY-008": (
        "Forbidden backend Azure DevOps network access or client-provided server relay.",
        "Remove backend Azure DevOps calls and keep Azure DevOps traffic in the browser only.",
    ),
}

ADO_OFFICIAL_URLS = (
    'const ADO = "https://dev.azure.com";',
    'const VSSPS = "https://app.vssps.visualstudio.com";',
)

PROXY_TOKENS = ("/ado", "/vssps")
PAT_ROUTE_TOKENS = ("/__dev/resolve-pat", "resolve-pat")
INFRA_EXTRA_GLOBS = ("**/nginx*.conf", "**/*proxy*.conf")
BACKEND_NETWORK_TOKENS = ("dev.azure.com", "visualstudio.com")
TS_COMMENT_PREFIXES = ("//", "/*", "*", "*/")


@dataclass(frozen=True)
class Violation:
    path: Path
    rule: str
    token: str
    line: int | None


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _iter_lines(path: Path) -> list[tuple[int, str]]:
    return list(enumerate(_read_text(path).splitlines(), start=1))


def _is_comment_only(path: Path, line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if path.suffix == ".py":
        return stripped.startswith("#")
    if path.suffix in {".ts", ".tsx", ".js", ".jsx"}:
        return stripped.startswith(TS_COMMENT_PREFIXES)
    return False


def _token_pattern(token: str) -> re.Pattern[str]:
    return re.compile(rf"\b{re.escape(token)}\b")


def _line_has_token(line: str, token: str) -> bool:
    return bool(_token_pattern(token).search(line))


def _find_active_token_line(path: Path, token: str) -> int | None:
    for line_no, line in _iter_lines(path):
        if _is_comment_only(path, line):
            continue
        if _line_has_token(line, token):
            return line_no
    return None


def _find_active_substring_line(path: Path, token: str) -> int | None:
    for line_no, line in _iter_lines(path):
        if _is_comment_only(path, line):
            continue
        if token in line:
            return line_no
    return None


def _extract_python_block(path: Path, block_kind: str, name: str) -> list[tuple[int, str]]:
    lines = _iter_lines(path)
    start_index: int | None = None
    base_indent = 0
    header_complete = False
    pattern = re.compile(rf"^(?P<indent>\s*){block_kind}\s+{re.escape(name)}\b")
    for index, (_, line) in enumerate(lines):
        match = pattern.match(line)
        if match:
            start_index = index
            base_indent = len(match.group("indent"))
            header_complete = line.rstrip().endswith(":")
            break
    if start_index is None:
        return []

    block: list[tuple[int, str]] = []
    for line_no, line in lines[start_index + 1 :]:
        stripped = line.strip()
        if not header_complete:
            block.append((line_no, line))
            if line.rstrip().endswith(":"):
                header_complete = True
            continue
        if stripped and len(line) - len(line.lstrip()) <= base_indent:
            break
        block.append((line_no, line))
    return block


def _extract_ts_brace_block(path: Path, marker_pattern: str) -> list[tuple[int, str]]:
    text = _read_text(path)
    marker = re.search(marker_pattern, text, re.MULTILINE)
    if not marker:
        return []

    brace_start = text.find("{", marker.end() - 1)
    if brace_start == -1:
        return []

    depth = 0
    end_index: int | None = None
    for index in range(brace_start, len(text)):
        char = text[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end_index = index
                break
    if end_index is None:
        return []

    start_line = text[:brace_start].count("\n") + 1
    block_text = text[brace_start : end_index + 1]
    return list(enumerate(block_text.splitlines(), start=start_line))


def _collect_tokens_in_block(
    path: Path,
    rule: str,
    block_lines: list[tuple[int, str]],
    tokens: tuple[str, ...],
) -> list[Violation]:
    violations: list[Violation] = []
    seen: set[tuple[str, int]] = set()
    for line_no, line in block_lines:
        if _is_comment_only(path, line):
            continue
        for token in tokens:
            if not _line_has_token(line, token):
                continue
            key = (token, line_no)
            if key in seen:
                continue
            seen.add(key)
            violations.append(Violation(path=path, rule=rule, token=token, line=line_no))
    return violations


def _append_if_missing(
    violations: list[Violation],
    seen: set[tuple[Path, str, str, int | None]],
    violation: Violation,
) -> None:
    key = (violation.path, violation.rule, violation.token, violation.line)
    if key in seen:
        return
    seen.add(key)
    violations.append(violation)


def _collect_identity_001(root: Path) -> list[Violation]:
    candidate_paths = [root / "frontend/vite.config.js"]
    for pattern in INFRA_EXTRA_GLOBS:
        candidate_paths.extend(sorted(root.glob(pattern)))

    violations: list[Violation] = []
    seen: set[tuple[Path, str, str, int | None]] = set()
    for path in candidate_paths:
        if not path.exists():
            continue
        for token in PROXY_TOKENS:
            line = _find_active_substring_line(path, token)
            if line is not None:
                _append_if_missing(
                    violations,
                    seen,
                    Violation(path=path, rule="IDENTITY-001", token=token, line=line),
                )
    return violations


def _collect_identity_002(root: Path) -> list[Violation]:
    candidate_paths = [
        root / "frontend/vite.config.js",
        root / "frontend/src/adoClient.ts",
        *sorted((root / "backend").glob("*.py")),
    ]
    route_pattern = re.compile(r"""@[\w.]+\((?P<quote>["']).*?(pat|token).*?(?P=quote)""")

    violations: list[Violation] = []
    seen: set[tuple[Path, str, str, int | None]] = set()
    for path in candidate_paths:
        if not path.exists():
            continue
        for token in PAT_ROUTE_TOKENS:
            line = _find_active_substring_line(path, token)
            if line is not None:
                _append_if_missing(
                    violations,
                    seen,
                    Violation(path=path, rule="IDENTITY-002", token=token, line=line),
                )
        if path.suffix != ".py":
            continue
        for line_no, line in _iter_lines(path):
            if _is_comment_only(path, line):
                continue
            if route_pattern.search(line):
                _append_if_missing(
                    violations,
                    seen,
                    Violation(path=path, rule="IDENTITY-002", token="pat", line=line_no),
                )
    return violations


def _collect_identity_003(root: Path) -> list[Violation]:
    path = root / "frontend/src/adoClient.ts"
    if not path.exists():
        return []

    violations: list[Violation] = []
    for expected in ADO_OFFICIAL_URLS:
        if expected in _read_text(path):
            continue
        violation_token = (
            "dev.azure.com"
            if "dev.azure.com" in expected
            else "app.vssps.visualstudio.com"
        )
        violations.append(
            Violation(
                path=path,
                rule="IDENTITY-003",
                token=violation_token,
                line=None,
            )
        )
    return violations


def _collect_identity_004(root: Path) -> list[Violation]:
    violations: list[Violation] = []
    backend_path = root / "backend/api_models.py"
    for frontend_path, type_name in (
        (root / "frontend/src/api/simulationDtos.ts", "SimulateRequestDto"),
        (root / "frontend/src/types.ts", "ForecastRequestPayload"),
    ):
        if not frontend_path.exists():
            continue
        violations.extend(
            _collect_tokens_in_block(
                frontend_path,
                "IDENTITY-004",
                _extract_ts_brace_block(
                    frontend_path,
                    rf"export\s+type\s+{type_name}\s*=",
                ),
                FORBIDDEN_BACKEND_FIELDS,
            )
        )
    violations.extend(
        _collect_tokens_in_block(
            backend_path,
            "IDENTITY-004",
            _extract_python_block(backend_path, "class", "SimulateRequest"),
            FORBIDDEN_BACKEND_FIELDS,
        )
    )
    return violations


def _payload_candidate_files(root: Path) -> list[Path]:
    files = {
        root / "frontend/src/api.ts",
        root / "frontend/src/api/simulationDtos.ts",
        root / "frontend/src/api/simulationMappers.ts",
        root / "frontend/src/hooks/simulationForecastCore.ts",
        root / "frontend/src/hooks/simulationForecastService.ts",
    }
    src_root = root / "frontend/src"
    if not src_root.exists():
        return sorted(files)
    for path in sorted(src_root.rglob("*.*")):
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        text = _read_text(path)
        if (
            "postSimulate(" in text
            or "ForecastRequestPayload" in text
            or "SimulateRequestDto" in text
        ):
            files.add(path)
    return sorted(files)


def _collect_identity_005(root: Path) -> list[Violation]:
    violations: list[Violation] = []
    seen: set[tuple[Path, str, str, int | None]] = set()
    for path in _payload_candidate_files(root):
        if not path.exists():
            continue
        blocks = [
            _extract_ts_brace_block(path, r"export\s+async\s+function\s+postSimulate\s*\("),
            _extract_ts_brace_block(path, r":\s*ForecastRequestPayload\s*=\s*"),
            _extract_ts_brace_block(path, r":\s*SimulateRequestDto\s*=\s*"),
            _extract_ts_brace_block(path, r"postSimulate\s*\(\s*\{"),
        ]
        for block in blocks:
            block_violations = _collect_tokens_in_block(
                path,
                "IDENTITY-005",
                block,
                FORBIDDEN_BACKEND_FIELDS,
            )
            for violation in block_violations:
                _append_if_missing(violations, seen, violation)
    return violations


def _collect_identity_006(root: Path) -> list[Violation]:
    path = root / "backend/simulation_store.py"
    if not path.exists():
        return []

    block = _extract_python_block(path, "def", "save_simulation")
    return _collect_tokens_in_block(path, "IDENTITY-006", block, FORBIDDEN_BACKEND_FIELDS)


def _collect_identity_007(root: Path) -> list[Violation]:
    violations: list[Violation] = []
    model_path = root / "backend/api_models.py"
    route_path = root / "backend/api_routes_simulate.py"
    violations.extend(
        _collect_tokens_in_block(
            model_path,
            "IDENTITY-007",
            _extract_python_block(model_path, "class", "SimulationHistoryItem"),
            FORBIDDEN_BACKEND_FIELDS,
        )
    )
    violations.extend(
        _collect_tokens_in_block(
            route_path,
            "IDENTITY-007",
            _extract_python_block(route_path, "def", "simulation_history"),
            FORBIDDEN_BACKEND_FIELDS,
        )
    )
    return violations


def _collect_identity_008(root: Path) -> list[Violation]:
    violations: list[Violation] = []
    seen: set[tuple[Path, str, str, int | None]] = set()
    backend_root = root / "backend"
    if not backend_root.exists():
        return []

    for path in sorted(backend_root.rglob("*.py")):
        text = _read_text(path)
        for token in BACKEND_NETWORK_TOKENS:
            line = _find_active_token_line(path, token)
            if line is not None:
                _append_if_missing(
                    violations,
                    seen,
                    Violation(path=path, rule="IDENTITY-008", token=token, line=line),
                )

        if path == root / "backend/simulation_store.py":
            continue

        for token in ("server_url", "azure_devops_url", "ado_server_url"):
            if token not in text:
                continue
            line = _find_active_token_line(path, token)
            if line is None:
                continue
            _append_if_missing(
                violations,
                seen,
                Violation(path=path, rule="IDENTITY-008", token=token, line=line),
            )
    return violations


def collect_identity_boundary_violations(root: Path) -> list[Violation]:
    violations = [
        *_collect_identity_001(root),
        *_collect_identity_002(root),
        *_collect_identity_003(root),
        *_collect_identity_004(root),
        *_collect_identity_005(root),
        *_collect_identity_006(root),
        *_collect_identity_007(root),
        *_collect_identity_008(root),
    ]
    return sorted(
        violations,
        key=lambda item: (item.path.as_posix(), item.line or 0, item.rule, item.token),
    )


def _format_violation(root: Path, violation: Violation) -> str:
    explanation, action = RULE_DETAILS[violation.rule]
    relative_path = violation.path.relative_to(root).as_posix()
    line = violation.line if violation.line is not None else "?"
    return (
        f'SLA breach [{violation.rule}]\n'
        f"{relative_path}:{line}\n"
        f'{explanation} Token "{violation.token}".\n'
        f"Expected action: {action}"
    )


def main() -> int:
    violations = collect_identity_boundary_violations(ROOT)
    if not violations:
        print("Identity boundary SLA check passed.")
        return 0

    for violation in violations:
        print(_format_violation(ROOT, violation), file=sys.stderr)
        print(file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
