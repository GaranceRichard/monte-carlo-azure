import responses
from backend.ado_core import list_teams

@responses.activate
def test_list_teams(fake_env):
    # 1) /_apis/projects retourne l'ID du projet
    responses.add(
        responses.GET,
        "https://dev.azure.com/messqc/_apis/projects?api-version=7.1",
        json={
            "count": 1,
            "value": [{"id": "P1", "name": "Projet-700"}]
        },
        status=200,
    )

    # 2) /_apis/projects/{id}/teams retourne la liste des équipes
    responses.add(
        responses.GET,
        "https://dev.azure.com/messqc/_apis/projects/P1/teams?api-version=7.1",
        json={
            "count": 2,
            "value": [
                {"id": "T1", "name": "CEA Team"},
                {"id": "T2", "name": "BI Team"},
            ],
        },
        status=200,
    )

    teams = list_teams()
    assert len(teams) == 2
    assert {t["id"] for t in teams} == {"T1", "T2"}
