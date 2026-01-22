#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_no_secrets.py
Fail fast if staged files contain obvious secrets (ADO PAT, tokens, private keys, etc.)

- Scans only staged files (git index), not the whole repo.
- Ignores binaries and large files.
- Exits 1 if it detects a potential secret.

Recommended integration: .git/hooks/pre-commit
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Tuple


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


def should_skip_file(path: str) -> bool:
    p = Path(path)
    if p.suffix.lower() in SKIP_EXTENSIONS:
        return True
    parts = {part.lower() for part in p.parts}
    if any(part in parts for part in SKIP_PATH_PARTS):
        return True
    try:
        st = p.stat()
        if st.st_size > MAX_FILE_BYTES:
            return True
    except FileNotFoundError:
        # In unusual cases (renames), file might not exist on disk; still try reading from git blob.
        pass
    return False


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
        ("ADO_PAT set", r"(?i)^\s*ADO_PAT\s*=\s*['\"]?(?!\s*$)(?!<SET_ME>|SET_ME|CHANGEME|CHANGE_ME|YOUR_TOKEN|PASTE|PASTE_YOUR_TOKEN_HERE)[^'\"\s]{8,}"),

        # Generic token assignment: require a quoted literal or long-looking value
        # Avoid matching normal code like .decode(), token variables, etc.
        ("Generic token assignment", r"(?i)\b(token|api[_-]?key|secret|password)\s*[:=]\s*['\"][^'\"]{8,}['\"]"),

        # GitHub tokens (classic + fine-grained formats)
        ("GitHub token", r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),

        # AWS access key id (basic)
        ("AWS Access Key ID", r"\bAKIA[0-9A-Z]{16}\b"),

        # Private key blocks
        ("Private key block", r"-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----"),
    ]

    return [(name, re.compile(pattern)) for name, pattern in rules]


def mask_excerpt(line: str) -> str:
    """
    Avoid printing full secrets.
    Keep a short preview with middle masked.
    """
    s = line.rstrip("\n")
    if len(s) <= 24:
        return "***REDACTED***"
    return s[:12] + "…" + s[-8:]


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


def main() -> int:
    # Quick check: must be in a git repo
    code, _, _ = run_git(["rev-parse", "--is-inside-work-tree"])
    if code != 0:
        print("ERROR: Not inside a git repository.", file=sys.stderr)
        return 2

    staged_files = get_staged_files()
    if not staged_files:
        return 0

    rules = compile_rules()
    all_findings: List[Finding] = []

    for path in staged_files:
        if should_skip_file(path):
            continue

        data = read_staged_file_bytes(path)
        if data is None:
            continue
        if is_probably_binary(data):
            continue

        try:
            text = data.decode("utf-8", errors="replace")
        except Exception:
            continue

        all_findings.extend(scan_text(path, text, rules))

    if all_findings:
        print("\n❌ Potential secrets detected in staged files. Commit blocked.\n", file=sys.stderr)
        for f in all_findings:
            print(f"- {f.path}:{f.line_no} | {f.rule} | {f.excerpt}", file=sys.stderr)

        print(
            "\nActions:\n"
            "  1) Remove/replace the secret (use .env.example, env vars, or keyring)\n"
            "  2) Re-stage files: git add -A\n"
            "  3) Re-try commit\n",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
