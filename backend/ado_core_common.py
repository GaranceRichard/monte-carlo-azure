from __future__ import annotations

from .ado_config import get_ado_config
from .ado_client import ado_session

API_VERSION = "7.1"


def _cfg(pat: str | None = None):
    return get_ado_config(pat_override=pat)


def _session(pat: str | None = None):
    return ado_session(pat_override=pat)
