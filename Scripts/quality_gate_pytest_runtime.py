"""Pytest runtime isolation shared by local and CI quality-gate execution."""

from __future__ import annotations

BACKEND_TEST_ENV = {
    "ADO_PAT": "FAKE_PAT",
    "ADO_ORG": "FAKE_ORG",
    "ADO_PROJECT": "FAKE_PROJECT",
    "APP_MONGO_URL": "mongodb://localhost:27017",
    "APP_MONGO_DB": "montecarlo_test",
    "PYTHONDONTWRITEBYTECODE": "1",
}
