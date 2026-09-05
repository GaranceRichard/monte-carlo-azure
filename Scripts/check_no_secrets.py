#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_no_secrets.py
Fail fast if a selected Git state contains obvious secrets or non-fake ADO test data.

- Scans the index by default, the tracked workspace with ``--workspace``, or every
  added/modified blob in introduced commits with ``--commits``.
- Ignores binaries and large files.
- Exits 1 if it detects a potential secret.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional, Tuple

# --- Tuning knobs ---
MAX_FILE_BYTES = 1_000_000  # 1 MB max per file (avoid scanning big blobs)
SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".pdf", ".zip", ".7z", ".rar",
    ".exe", ".dll", ".pyd", ".so",
    ".mp4", ".mov", ".avi", ".mp3", ".wav",
}
SKIP_PATH_PARTS = {
    ".git", ".venv", "venv", "node_modules", "dist", "build", "__pycache__"
}
ADO_NON_PROD_PATH_PREFIXES = (
    ".github/workflows/",
    "tests/",
)
ADO_NON_PROD_ENV_NAMES = (
    "ADO_ORG",
    "ADO_PROJECT",
    "ADO_TEAM",
    "ADO_UUID",
)
ADO_ALLOWED_PLACEHOLDER_PREFIXES = (
    "FAKE_",
    "TEST_",
    "DUMMY_",
    "EXAMPLE_",
    "SAMPLE_",
)
ADO_ALLOWED_PLACEHOLDER_VALUES = {
    "",
    "<SET_ME>",
    "SET_ME",
    "CHANGE_ME",
    "CHANGEME",
    "YOUR_VALUE",
    "PASTE_VALUE_HERE",
}


@dataclass(frozen=True)
class Finding:
    path: str
    line_no: int
    rule: str
    excerpt: str


def run_git(args: List[str]) -> Tuple[int, str, str]:
    """Run git command and return (code, stdout, stderr)."""
    p = subprocess.run(
        ["git", *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return p.returncode, p.stdout, p.stderr


def get_staged_files() -> List[str]:
    """
    Return list of staged file paths (Added/Copied/Modified/Renamed).
    Deleted files are ignored.
    """
    code, out, err = run_git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
    if code != 0:
        print("ERROR: Unable to list staged files.", file=sys.stderr)
        print(err, file=sys.stderr)
        sys.exit(2)
    files = [line.strip() for line in out.splitlines() if line.strip()]
    return files


def _nul_separated_paths(output: str) -> List[str]:
    return [item for item in output.split("\0") if item]


def get_workspace_files() -> List[str]:
    """Return tracked files from the exact workspace being validated."""
    code, out, err = run_git(["ls-files", "--cached", "-z"])
    if code != 0:
        print("ERROR: Unable to list tracked workspace files.", file=sys.stderr)
        print(err, file=sys.stderr)
        raise SystemExit(2)
    return _nul_separated_paths(out)


def get_commit_files(commit: str) -> List[str]:
    """Return blobs added or modified by one introduced commit."""
    code, out, err = run_git(
        [
            "diff-tree",
            "--root",
            "-m",
            "--no-commit-id",
            "--name-only",
            "--diff-filter=ACMR",
            "-r",
            "-z",
            commit,
        ]
    )
    if code != 0:
        print(f"ERROR: Unable to inspect introduced commit {commit}.", file=sys.stderr)
        print(err, file=sys.stderr)
        raise SystemExit(2)
    return list(dict.fromkeys(_nul_separated_paths(out)))


def should_skip_file(path: str) -> bool:
    """Skip only from immutable path metadata; blob size is checked after reading."""
    p = Path(path)
    if p.suffix.lower() in SKIP_EXTENSIONS:
        return True
    parts = {part.lower() for part in p.parts}
    return any(part in parts for part in SKIP_PATH_PARTS)


def is_probably_binary(data: bytes) -> bool:
    """Heuristic: presence of NUL bytes indicates binary."""
    return b"\x00" in data


def read_staged_file_bytes(path: str) -> Optional[bytes]:
    """
    Read the staged version (from git index), not the working tree.
    Uses: git show :path
    """
    code, out, err = run_git(["show", f":{path}"])
    if code != 0:
        # Might happen for submodules or weird entries; ignore.
        return None
    # `out` is text; convert back to bytes conservatively.
    # We re-run with -p? Not needed. We'll encode to bytes for binary detection.
    return out.encode("utf-8", errors="replace")


def read_workspace_file_bytes(path: str) -> Optional[bytes]:
    try:
        return Path(path).read_bytes()
    except OSError:
        return None


def read_commit_file_bytes(commit: str, path: str) -> Optional[bytes]:
    code, out, _err = run_git(["show", f"{commit}:{path}"])
    if code != 0:
        return None
    return out.encode("utf-8", errors="replace")


def compile_rules() -> List[Tuple[str, re.Pattern]]:
    """
    Rules:
    - ADO_PAT assignment
    - Generic token patterns
    - Private key blocks
    - Common cloud keys/tokens (lightweight)
    """
    rules: List[Tuple[str, str]] = [
        # Azure DevOps PAT: only if ADO_PAT is set to a non-empty non-placeholder value
        (
            "ADO_PAT set",
            (
                r"(?i)^\s*ADO_PAT\s*=\s*['\"]?(?!\s*$)"
                r"(?!<SET_ME>|SET_ME|CHANGEME|CHANGE_ME|YOUR_TOKEN|PASTE|PASTE_YOUR_TOKEN_HERE)"
                r"[^'\"\s]{8,}"
            ),
        ),

        # Generic token assignment: require a quoted literal or long-looking value
        # Avoid matching normal code like .decode(), token variables, etc.
        (
            "Generic token assignment",
            r"(?i)\b(token|api[_-]?key|secret|password)\s*[:=]\s*['\"][^'\"]{8,}['\"]",
        ),

        # GitHub tokens (classic + fine-grained formats)
        ("GitHub token", r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),

        # AWS access key id (basic)
        ("AWS Access Key ID", r"\bAKIA[0-9A-Z]{16}\b"),

        # Private key blocks
        ("Private key block", r"-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----"),
    ]

    return [(name, re.compile(pattern)) for name, pattern in rules]


def is_allowed_ado_placeholder(value: str) -> bool:
    normalized = value.strip().strip("'\"").upper()
    if normalized in ADO_ALLOWED_PLACEHOLDER_VALUES:
        return True
    return any(normalized.startswith(prefix) for prefix in ADO_ALLOWED_PLACEHOLDER_PREFIXES)


def scan_ado_non_prod_values(path: str, text: str) -> List[Finding]:
    if not any(path.startswith(prefix) for prefix in ADO_NON_PROD_PATH_PREFIXES):
        return []

    findings: List[Finding] = []
    patterns = [
        r'^\s*(?P<name>ADO_(?:ORG|PROJECT|TEAM|UUID))\s*[:=]\s*["\']?(?P<value>[^"\']+?)["\']?\s*$',
        r'^\s*(?P<name>ADO_(?:ORG|PROJECT|TEAM|UUID))\s*:\s*(?P<value>[^#\n]+?)\s*$',
        r'(?P<name>ADO_(?:ORG|PROJECT|TEAM|UUID))["\']?\s*,\s*["\'](?P<value>[^"\']+)["\']',
        r'setenv\(\s*["\'](?P<name>ADO_(?:ORG|PROJECT|TEAM|UUID))["\']\s*,\s*["\'](?P<value>[^"\']+)["\']\s*\)',
    ]

    for i, line in enumerate(text.splitlines(), start=1):
        stripped = line.lstrip()
        if stripped.startswith("#") or stripped.startswith("//"):
            continue

        for pattern in patterns:
            match = re.search(pattern, line)
            if not match:
                continue

            name = match.group("name")
            value = match.group("value").strip().strip("'\"")
            if is_allowed_ado_placeholder(value):
                continue

            findings.append(
                Finding(
                    path=path,
                    line_no=i,
                    rule=f"{name} must use a fake placeholder in CI/tests",
                    excerpt=mask_excerpt(line),
                )
            )
            break

    return findings


def mask_excerpt(line: str) -> str:
    """
    Avoid printing full secrets.
    Keep a short preview with middle masked.
    """
    s = line.rstrip("\n")
    if len(s) <= 24:
        return "***REDACTED***"
    return s[:12] + "..." + s[-8:]


def scan_text(path: str, text: str, rules: List[Tuple[str, re.Pattern]]) -> List[Finding]:
    findings: List[Finding] = []
    lines = text.splitlines()
    for i, line in enumerate(lines, start=1):
        # Skip commented lines (common in .env / yaml / ini)
        stripped = line.lstrip()
        if stripped.startswith("#") or stripped.startswith("//"):
            continue

        for rule_name, rule_re in rules:
            if rule_re.search(line):
                findings.append(
                    Finding(
                        path=path,
                        line_no=i,
                        rule=rule_name,
                        excerpt=mask_excerpt(line),
                    )
                )
                # one finding per line is enough
                break
    return findings


def scan_files(
    paths: List[str],
    read_bytes: Callable[[str], Optional[bytes]],
    rules: List[Tuple[str, re.Pattern]],
) -> List[Finding]:
    """Scan one deterministic file list through an injected blob reader."""
    all_findings: List[Finding] = []
    for path in paths:
        if should_skip_file(path):
            continue
        data = read_bytes(path)
        if data is None or len(data) > MAX_FILE_BYTES or is_probably_binary(data):
            continue
        text = data.decode("utf-8", errors="replace")
        all_findings.extend(scan_text(path, text, rules))
        all_findings.extend(scan_ado_non_prod_values(path, text))
    return all_findings


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--workspace", action="store_true")
    source.add_argument("--commits", nargs="+")
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    # Quick check: must be in a git repo
    code, _, _ = run_git(["rev-parse", "--is-inside-work-tree"])
    if code != 0:
        print("ERROR: Not inside a git repository.", file=sys.stderr)
        return 2

    args = parse_args(argv or [])
    rules = compile_rules()
    if args.workspace:
        all_findings = scan_files(get_workspace_files(), read_workspace_file_bytes, rules)
    elif args.commits:
        all_findings = []
        for commit in args.commits:
            all_findings.extend(
                scan_files(
                    get_commit_files(commit),
                    lambda path, revision=commit: read_commit_file_bytes(revision, path),
                    rules,
                )
            )
    else:
        all_findings = scan_files(get_staged_files(), read_staged_file_bytes, rules)

    if all_findings:
        print(
            "\nPotential secrets or disallowed test data detected in the selected Git state.\n",
            file=sys.stderr,
        )
        for f in all_findings:
            print(f"- {f.path}:{f.line_no} | {f.rule} | {f.excerpt}", file=sys.stderr)

        print(
            "\nActions:\n"
            "  1) Remove/replace the secret or use a fake placeholder value\n"
            "  2) Remove it from all unpublished commits that introduced it\n"
            "  3) Re-try the candidate validation\n",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
