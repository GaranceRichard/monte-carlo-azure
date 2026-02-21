from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from backend import ado_core_projects as projects
from backend import ado_core_throughput as throughput
from backend import ado_core_work_items as work_items


class FakeResponse:
    def __init__(self, data: dict[str, Any] | None = None, status_code: int = 200, ok: bool = True):
        self._data = data or {}
        self.status_code = status_code
        self.ok = ok

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"http {self.status_code}")


@dataclass
class FakeSession:
    get_map: dict[str, FakeResponse]
    post_map: dict[str, list[FakeResponse]] | None = None

    def __post_init__(self):
        self.post_map = self.post_map or {}
        self.posts: list[tuple[str, dict[str, Any]]] = []

    def get(self, url: str):
        return self.get_map[url]

    def post(self, url: str, json: dict[str, Any]):
        self.posts.append((url, json))
        queue = self.post_map.get(url, [])
        if not queue:
            raise RuntimeError(f"no mocked response for {url}")
        return queue.pop(0)


def test_list_projects_and_projects_for_org(monkeypatch, fake_env):
    projects_url = "https://dev.azure.com/FAKE_ORG/_apis/projects?api-version=7.1"
    org_url = "https://dev.azure.com/org-a/_apis/projects?api-version=7.1"
    fake = FakeSession(
        get_map={
            projects_url: FakeResponse({"value": [{"id": "1", "name": "A"}]}),
            org_url: FakeResponse({"value": [{"id": "2", "name": "B"}]}),
        }
    )
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake)

    assert projects.list_projects() == [{"id": "1", "name": "A"}]
    assert projects.list_projects_for_org(" org-a ", "pat") == [{"id": "2", "name": "B"}]
    assert projects.list_projects_for_org("", "pat") == []


def test_list_teams_for_org_project_branches(monkeypatch):
    teams_url = "https://dev.azure.com/org-a/_apis/projects/p1/teams?api-version=7.1"
    fake = FakeSession(get_map={teams_url: FakeResponse({"value": [{"id": "t1", "name": "Team A"}]})})
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake)
    monkeypatch.setattr(projects, "list_projects_for_org", lambda org, pat: [{"id": "p1", "name": "Proj"}])

    assert projects.list_teams_for_org_project("org-a", "Proj", "pat") == [{"id": "t1", "name": "Team A"}]
    assert projects.list_teams_for_org_project("", "Proj", "pat") == []
    assert projects.list_teams_for_org_project("org-a", "", "pat") == []
    assert projects.list_teams_for_org_project("org-a", "Unknown", "pat") == []


def test_list_team_work_item_options(monkeypatch):
    base = "https://dev.azure.com/org-a/proj-a"
    fake = FakeSession(
        get_map={
            f"{base}/team-a/_apis/work/teamsettings/teamfieldvalues?api-version=7.1": FakeResponse({}),
            f"{base}/_apis/wit/workitemtypes?api-version=7.1": FakeResponse(
                {"value": [{"name": "Bug"}, {"name": "User Story"}, {"name": None}]}
            ),
            f"{base}/_apis/wit/workitemtypes/Bug/states?api-version=7.1": FakeResponse(
                {"value": [{"name": "Done"}, {"name": "Closed"}]}
            ),
            f"{base}/_apis/wit/workitemtypes/User%20Story/states?api-version=7.1": FakeResponse(
                {"value": [{"name": "Done"}, {"name": "Resolved"}]}
            ),
        }
    )
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake)

    result = projects.list_team_work_item_options("org-a", "proj-a", "team-a", "pat")
    assert result["types"] == ["Bug", "User Story"]
    assert result["states"] == ["Closed", "Done", "Resolved"]
    assert result["states_by_type"]["Bug"] == ["Closed", "Done"]
    assert result["states_by_type"]["User Story"] == ["Done", "Resolved"]
    assert projects.list_team_work_item_options("", "p", "t", "pat") == {"types": [], "states": []}


def test_get_project_id_and_list_teams(monkeypatch, fake_env):
    monkeypatch.setattr(projects, "list_projects", lambda pat=None: [{"id": "p1", "name": "P1"}])
    assert projects.get_project_id("P1") == "p1"
    with pytest.raises(RuntimeError):
        projects.get_project_id("P2")

    teams_url = "https://dev.azure.com/FAKE_ORG/_apis/projects/p1/teams?api-version=7.1"
    fake = FakeSession(get_map={teams_url: FakeResponse({"value": [{"id": "t1"}]})})
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake)
    monkeypatch.setattr(projects, "get_project_id", lambda name, pat=None: "p1")
    assert projects.list_teams() == [{"id": "t1"}]


def test_team_settings_areas_and_iterations(monkeypatch, fake_env):
    areas_url = (
        "https://dev.azure.com/org-a/proj-a/team-a/"
        "_apis/work/teamsettings/teamfieldvalues?api-version=7.1"
    )
    iter_url = (
        "https://dev.azure.com/FAKE_ORG/FAKE_PROJECT/team-a/"
        "_apis/work/teamsettings/iterations?api-version=7.1"
    )
    fake = FakeSession(
        get_map={
            areas_url: FakeResponse({"defaultValue": "Area A"}),
            iter_url: FakeResponse({"value": []}),
        }
    )
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake)
    assert projects.team_settings_areas("team-a", org="org-a", project="proj-a")["defaultValue"] == "Area A"
    assert projects.team_settings_iterations("team-a") == {"value": []}
    monkeypatch.delenv("ADO_ORG", raising=False)
    monkeypatch.delenv("ADO_PROJECT", raising=False)
    with pytest.raises(RuntimeError):
        projects.team_settings_areas("team-a")


def test_wiql_fetch_batch_and_done_ids(monkeypatch):
    wiql_url = "https://dev.azure.com/org-a/proj-a/_apis/wit/wiql?api-version=7.1"
    batch_url = "https://dev.azure.com/org-a/_apis/wit/workitemsbatch?api-version=7.1"
    fake = FakeSession(
        get_map={},
        post_map={
            wiql_url: [FakeResponse({"workItems": [{"id": 1}, {"id": 2}]})],
            batch_url: [
                FakeResponse({"value": [{"id": i} for i in range(200)]}),
                FakeResponse({"value": [{"id": 201}]}),
            ],
        },
    )
    monkeypatch.setattr(work_items, "_session", lambda pat=None: fake)

    ids = work_items.wiql_query_ids("SELECT ...", org="org-a", project="proj-a")
    assert ids == [1, 2]

    batch = work_items.fetch_work_items_batch(range(1, 202), ["System.Id"], org="org-a")
    assert len(batch) == 201
    assert work_items.fetch_work_items_batch([], ["System.Id"], org="org-a") == []

    captured = {}

    def _fake_wiql(query, org, project, pat=None):
        captured["query"] = query
        return [9]

    monkeypatch.setattr(work_items, "wiql_query_ids", _fake_wiql)
    out = work_items.done_ids_by_area_and_closed_date(
        org="org-a",
        project="proj-a",
        area_path="proj-a\\team",
        start_date="2026-01-01",
        end_date="2026-02-01",
        done_states={"Done"},
        work_item_types={"Bug"},
    )
    assert out == [9]
    assert "[System.AreaPath] = 'proj-a\\team'" in captured["query"]


def test_weekly_throughput_branches(monkeypatch):
    monkeypatch.setattr(throughput, "done_ids_by_area_and_closed_date", lambda **kwargs: [])
    empty = throughput.weekly_throughput(
        org="org-a",
        project="proj-a",
        area_path="a",
        start_date="2026-01-01",
        end_date="2026-02-01",
        done_states={"Done"},
        work_item_types={"Bug"},
    )
    assert list(empty.columns) == ["week", "throughput"]

    monkeypatch.setattr(throughput, "done_ids_by_area_and_closed_date", lambda **kwargs: [1, 2, 3])
    monkeypatch.setattr(
        throughput,
        "fetch_work_items_batch",
        lambda ids, fields, org, pat=None: [
            {"id": 1, "fields": {"Microsoft.VSTS.Common.ClosedDate": "2026-01-01T12:00:00Z"}},
            {"id": 2, "fields": {"Microsoft.VSTS.Common.ClosedDate": "invalid-date"}},
            {"id": 3, "fields": {"Microsoft.VSTS.Common.ClosedDate": "2026-01-08T12:00:00Z"}},
        ],
    )
    weekly = throughput.weekly_throughput(
        org="org-a",
        project="proj-a",
        area_path="a",
        start_date="2026-01-01",
        end_date="2026-02-01",
        done_states={"Done"},
        work_item_types={"Bug"},
    )
    assert "throughput" in weekly.columns
    assert int(weekly["throughput"].sum()) == 2

    monkeypatch.setattr(throughput, "fetch_work_items_batch", lambda ids, fields, org, pat=None: [])
    weekly_empty = throughput.weekly_throughput(
        org="org-a",
        project="proj-a",
        area_path="a",
        start_date="2026-01-01",
        end_date="2026-02-01",
        done_states={"Done"},
        work_item_types={"Bug"},
    )
    assert list(weekly_empty.columns) == ["week", "throughput"]


def test_list_accessible_orgs_paths(monkeypatch):
    profile_url = "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1-preview.3"
    conn_url = "https://dev.azure.com/_apis/connectionData?connectOptions=none&lastChangeId=-1&lastChangeId64=-1"
    accounts_global = "https://app.vssps.visualstudio.com/_apis/accounts?api-version=7.1-preview.1"
    accounts_member = (
        "https://app.vssps.visualstudio.com/_apis/accounts"
        "?memberId=member-1&api-version=7.1-preview.1"
    )

    fake1 = FakeSession(
        get_map={
            profile_url: FakeResponse({"id": "member-1"}),
            conn_url: FakeResponse({"authenticatedUser": {"id": "member-1"}}),
            accounts_global: FakeResponse(
                {"value": [{"accountId": "1", "accountName": "org-a", "accountUri": "uri-a"}]}
            ),
        }
    )
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake1)
    out1 = projects.list_accessible_orgs("pat")
    assert out1 == [{"id": "1", "name": "org-a", "account_uri": "uri-a"}]

    class _RaisingResponse(FakeResponse):
        def raise_for_status(self):
            raise RuntimeError("boom")

    fake2 = FakeSession(
        get_map={
            profile_url: FakeResponse({"id": "member-1"}),
            conn_url: _RaisingResponse({}, status_code=500, ok=False),
            accounts_global: _RaisingResponse({}, status_code=500, ok=False),
            accounts_member: FakeResponse(
                {"value": [{"accountId": "2", "accountName": "org-b", "accountUri": "uri-b"}]}
            ),
        }
    )
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake2)
    out2 = projects.list_accessible_orgs("pat")
    assert out2 == [{"id": "2", "name": "org-b", "account_uri": "uri-b"}]


def test_get_current_user_paths(monkeypatch, fake_env):
    first_url = "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1-preview.3"
    second_url = "https://vssps.dev.azure.com/FAKE_ORG/_apis/profile/profiles/me?api-version=7.1"

    fake1 = FakeSession(get_map={first_url: FakeResponse({"displayName": "Alice"})})
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake1)
    assert projects.get_current_user("pat") == {"displayName": "Alice"}

    class _RaisingResponse(FakeResponse):
        def raise_for_status(self):
            raise RuntimeError("boom")

    fake2 = FakeSession(
        get_map={
            first_url: _RaisingResponse({}, status_code=500, ok=False),
            second_url: FakeResponse({"displayName": "Bob"}),
        }
    )
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake2)
    assert projects.get_current_user("pat") == {"displayName": "Bob"}

    fake3 = FakeSession(
        get_map={
            first_url: _RaisingResponse({}, status_code=500, ok=False),
            second_url: _RaisingResponse({}, status_code=500, ok=False),
        }
    )
    monkeypatch.setattr(projects, "_session", lambda pat=None: fake3)
    with pytest.raises(RuntimeError):
        projects.get_current_user("pat")
