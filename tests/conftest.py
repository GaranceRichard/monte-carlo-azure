import os
import pytest

@pytest.fixture
def fake_env(monkeypatch):
    # On évite de dépendre du .env réel
    monkeypatch.setenv("ADO_PAT", "FAKE_PAT")
    monkeypatch.setenv("ADO_ORG", "messqc")
    monkeypatch.setenv("ADO_PROJECT", "Projet-700")
    return True

