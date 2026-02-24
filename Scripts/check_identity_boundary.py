#!/usr/bin/env python3
"""
Fail CI if identity data (PAT/UUID/ORG/Team) can transit through any local/server layer.

This guard enforces a strict boundary:
- Azure DevOps calls must go directly from browser to official Azure endpoints.
- No Vite proxy for /ado or /vssps.
- No local/server endpoint that accepts PAT for identity discovery.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8", errors="replace")


def fail(msg: str) -> None:
    print(f"SLA breach: {msg}", file=sys.stderr)


def main() -> int:
    ok = True

    vite_config = read("frontend/vite.config.js")
    ado_client = read("frontend/src/adoClient.ts")

    # 1) No proxy routes for Azure endpoints.
    if re.search(r'["\']/ado["\']\s*:', vite_config):
        fail("Vite proxy '/ado' is forbidden.")
        ok = False
    if re.search(r'["\']/vssps["\']\s*:', vite_config):
        fail("Vite proxy '/vssps' is forbidden.")
        ok = False

    # 2) No local PAT resolution server endpoint.
    if "/__dev/resolve-pat" in vite_config:
        fail("Local PAT resolver endpoint is forbidden.")
        ok = False
    if "/__dev/resolve-pat" in ado_client:
        fail("Frontend calling local PAT resolver endpoint is forbidden.")
        ok = False

    # 3) Azure endpoints must be absolute official URLs in adoClient.
    if 'const ADO = "https://dev.azure.com";' not in ado_client:
        fail("ADO base URL must be direct official endpoint.")
        ok = False
    if 'const VSSPS = "https://app.vssps.visualstudio.com";' not in ado_client:
        fail("VSSPS base URL must be direct official endpoint.")
        ok = False

    if not ok:
        print(
            "\nPolicy: PAT/UUID/ORG/Team must never transit through local/backend servers.\n"
            "Any transgression is a major fault.",
            file=sys.stderr,
        )
        return 1

    print("Identity boundary SLA check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
