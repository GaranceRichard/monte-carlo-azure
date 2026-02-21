from fastapi.testclient import TestClient
from unittest.mock import patch

from backend.api import app

TEST_PAT = "fake-pat-token-1234567890"


def test_auth_check_ok():
    client = TestClient(app)
    with patch("backend.api.validate_pat", return_value=None):
        with patch("backend.api.get_current_user", return_value={"displayName": "Alice"}):
            r = client.get("/auth/check", headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["user_name"] == "Alice"


def test_auth_check_missing_pat():
    client = TestClient(app)
    r = client.get("/auth/check")
    assert r.status_code == 400


def test_auth_check_invalid_pat():
    client = TestClient(app)
    r = client.get("/auth/check", headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 200


def test_auth_orgs_ok():
    client = TestClient(app)

    fake_orgs = [{"id": "1", "name": "org-a", "account_uri": "https://dev.azure.com/org-a"}]
    with patch("backend.api.validate_pat", return_value=None):
        with patch("backend.api.list_accessible_orgs", return_value=fake_orgs):
            r = client.get("/auth/orgs", headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 200
    assert r.json()["orgs"] == fake_orgs


def test_auth_orgs_missing_pat():
    client = TestClient(app)
    r = client.get("/auth/orgs")
    assert r.status_code == 400


def test_auth_check_short_pat_invalid():
    client = TestClient(app)
    r = client.get("/auth/check", headers={"x-ado-pat": "aaa"})
    assert r.status_code == 401
    assert "PAT invalide" in r.json().get("detail", "")


def test_auth_check_ok_without_org_project_env():
    client = TestClient(app)
    with patch("backend.api.validate_pat", return_value=None):
        r = client.get("/auth/check", headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_auth_check_ok_when_profile_scope_missing_but_projects_ok():
    client = TestClient(app)
    with patch("backend.api.validate_pat", return_value=None):
        r = client.get("/auth/check", headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_auth_orgs_fallback_when_discovery_fails():
    client = TestClient(app)

    with patch("backend.api.validate_pat", return_value=None):
        with patch("backend.api.list_accessible_orgs", side_effect=Exception("boom")):
            r = client.get("/auth/orgs", headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 502


def test_auth_orgs_empty_returns_ok_with_manual_hint():
    client = TestClient(app)
    with patch("backend.api.list_accessible_orgs", return_value=[]):
        r = client.get("/auth/orgs", headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 200
    assert r.json().get("orgs") == []


def test_auth_projects_ok():
    client = TestClient(app)
    fake_projects = [{"id": "p1", "name": "Projet A"}, {"id": "p2", "name": "Projet B"}]

    with patch("backend.api.validate_pat", return_value=None):
        with patch("backend.api.list_projects_for_org", return_value=fake_projects):
            r = client.post("/auth/projects", json={"org": "org-a"}, headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 200
    assert r.json()["org"] == "org-a"
    assert len(r.json()["projects"]) == 2


def test_auth_projects_missing_org():
    client = TestClient(app)
    r = client.post("/auth/projects", json={"org": ""}, headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 400


def test_auth_teams_ok():
    client = TestClient(app)
    fake_teams = [{"id": "t1", "name": "Equipe A"}, {"id": "t2", "name": "Equipe B"}]

    with patch("backend.api.validate_pat", return_value=None):
        with patch("backend.api.list_teams_for_org_project", return_value=fake_teams):
            r = client.post("/auth/teams", json={"org": "org-a", "project": "ProjetA"}, headers={"x-ado-pat": TEST_PAT})

    assert r.status_code == 200
    assert r.json()["org"] == "org-a"
    assert r.json()["project"] == "ProjetA"
    assert len(r.json()["teams"]) == 2


def test_auth_teams_missing_params():
    client = TestClient(app)
    r_org = client.post("/auth/teams", json={"org": "", "project": "ProjetA"}, headers={"x-ado-pat": TEST_PAT})
    r_project = client.post("/auth/teams", json={"org": "org-a", "project": ""}, headers={"x-ado-pat": TEST_PAT})
    assert r_org.status_code == 400
    assert r_project.status_code == 400


def test_auth_team_options_ok():
    client = TestClient(app)
    fake_options = {
        "states": ["Done", "Closed", "Resolved"],
        "types": ["User Story", "Bug"],
        "states_by_type": {
            "User Story": ["Done", "Closed"],
            "Bug": ["Resolved", "Done"],
        },
    }

    with patch("backend.api.validate_pat", return_value=None):
        with patch("backend.api.list_team_work_item_options", return_value=fake_options):
            r = client.post(
                "/auth/team-options",
                json={"org": "org-a", "project": "ProjetA", "team": "EquipeA"},
                headers={"x-ado-pat": TEST_PAT},
            )

    assert r.status_code == 200
    assert r.json()["done_states"] == fake_options["states"]
    assert r.json()["work_item_types"] == fake_options["types"]
    assert r.json()["states_by_type"] == fake_options["states_by_type"]


def test_auth_team_options_missing_params():
    client = TestClient(app)
    r_org = client.post(
        "/auth/team-options",
        json={"org": "", "project": "ProjetA", "team": "EquipeA"},
        headers={"x-ado-pat": TEST_PAT},
    )
    r_project = client.post(
        "/auth/team-options",
        json={"org": "org-a", "project": "", "team": "EquipeA"},
        headers={"x-ado-pat": TEST_PAT},
    )
    r_team = client.post(
        "/auth/team-options",
        json={"org": "org-a", "project": "ProjetA", "team": ""},
        headers={"x-ado-pat": TEST_PAT},
    )
    assert r_org.status_code == 400
    assert r_project.status_code == 400
    assert r_team.status_code == 400
