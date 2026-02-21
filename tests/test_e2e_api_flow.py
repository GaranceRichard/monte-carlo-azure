from unittest.mock import patch

import pandas as pd
from fastapi.testclient import TestClient

from backend.api import app


TEST_PAT = "fake-pat-token-1234567890"


def test_e2e_auth_to_forecast_flow():
    client = TestClient(app)
    headers = {"x-ado-pat": TEST_PAT}

    weekly = pd.DataFrame(
        {
            "week": [
                "2026-01-05",
                "2026-01-12",
                "2026-01-19",
                "2026-01-26",
                "2026-02-02",
                "2026-02-09",
            ],
            "throughput": [3, 2, 4, 3, 5, 2],
        }
    )

    with patch("backend.api.validate_pat", return_value=None):
        with patch("backend.api.get_current_user", return_value={"displayName": "Garance Richard"}):
            with patch(
                "backend.api.list_accessible_orgs",
                return_value=[
                    {
                        "id": "o1",
                        "name": "org-demo",
                        "account_uri": "https://dev.azure.com/org-demo",
                    }
                ],
            ):
                with patch(
                    "backend.api.list_projects_for_org",
                    return_value=[{"id": "p1", "name": "Projet A"}],
                ):
                    with patch(
                        "backend.api.list_teams_for_org_project",
                        return_value=[{"id": "t1", "name": "Equipe Alpha"}],
                    ):
                        with patch(
                            "backend.api.list_team_work_item_options",
                            return_value={
                                "states": ["Done", "Closed"],
                                "types": ["Bug", "User Story"],
                                "states_by_type": {
                                    "Bug": ["Done"],
                                    "User Story": ["Done", "Closed"],
                                },
                            },
                        ):
                            with patch(
                                "backend.api.team_settings_areas",
                                return_value={"defaultValue": "Projet A\\Equipe Alpha"},
                            ):
                                with patch(
                                    "backend.api.weekly_throughput",
                                    return_value=weekly,
                                ):
                                    r_check = client.get("/auth/check", headers=headers)
                                    assert r_check.status_code == 200

                                    r_orgs = client.get("/auth/orgs", headers=headers)
                                    assert r_orgs.status_code == 200
                                    assert r_orgs.json()["orgs"][0]["name"] == "org-demo"

                                    r_projects = client.post(
                                        "/auth/projects",
                                        json={"org": "org-demo"},
                                        headers=headers,
                                    )
                                    assert r_projects.status_code == 200
                                    assert r_projects.json()["projects"][0]["name"] == "Projet A"

                                    r_teams = client.post(
                                        "/auth/teams",
                                        json={"org": "org-demo", "project": "Projet A"},
                                        headers=headers,
                                    )
                                    assert r_teams.status_code == 200
                                    assert r_teams.json()["teams"][0]["name"] == "Equipe Alpha"

                                    r_options = client.post(
                                        "/auth/team-options",
                                        json={
                                            "org": "org-demo",
                                            "project": "Projet A",
                                            "team": "Equipe Alpha",
                                        },
                                        headers=headers,
                                    )
                                    assert r_options.status_code == 200
                                    assert "Done" in r_options.json()["done_states"]

                                    r_forecast = client.post(
                                        "/forecast",
                                        json={
                                            "org": "org-demo",
                                            "project": "Projet A",
                                            "team_name": "Equipe Alpha",
                                            "start_date": "2025-10-01",
                                            "end_date": "2026-01-19",
                                            "mode": "backlog_to_weeks",
                                            "backlog_size": 20,
                                            "done_states": ["Done"],
                                            "work_item_types": ["User Story"],
                                            "n_sims": 2000,
                                        },
                                        headers=headers,
                                    )
                                    assert r_forecast.status_code == 200
                                    body = r_forecast.json()
                                    assert body["result_kind"] == "weeks"
                                    assert "P50" in body["result_percentiles"]
