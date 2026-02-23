import os
import sys
from pathlib import Path
import pytest

# Ensure the project root is importable in CI and local runs.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

@pytest.fixture
def fake_env(monkeypatch):
    # On évite de dépendre du .env réel
    monkeypatch.setenv("ADO_PAT", "FAKE_PAT")
    monkeypatch.setenv("ADO_ORG", "FAKE_ORG")
    monkeypatch.setenv("ADO_PROJECT", "FAKE_PROJECT")
    return True
