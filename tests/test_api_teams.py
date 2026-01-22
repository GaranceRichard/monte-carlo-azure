from fastapi.testclient import TestClient
from unittest.mock import patch
from backend.api import app

def test_teams():
    client = TestClient(app)

    fake = [
        {"id": "T1", "name": "CEA Team"},
        {"id": "T2", "name": "BI Team"},
    ]

    with patch("backend.api.list_teams", return_value=fake):
        r = client.get("/teams")
        assert r.status_code == 200
        assert r.json() == [
            {"id": "T1", "name": "CEA Team"},
            {"id": "T2", "name": "BI Team"},
        ]
