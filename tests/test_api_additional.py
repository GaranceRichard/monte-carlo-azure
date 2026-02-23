from __future__ import annotations

import pandas as pd
import pytest
import requests
import time
from fastapi import HTTPException
from fastapi.testclient import TestClient
from unittest.mock import patch
import numpy as np

import backend.api as api

TEST_PAT = "fake-pat-token-1234567890"


def _http_error(status: int) -> requests.HTTPError:
    resp = requests.Response()
    resp.status_code = status
    return requests.HTTPError(response=resp)


class _RespOK:
    def raise_for_status(self):
        return None


class _RespErr:
    def __init__(self, status: int):
        self._status = status

    def raise_for_status(self):
        raise _http_error(self._status)


def test_validate_pat_success_on_second_endpoint():
    class _Session:
        def __init__(self):
            self.n = 0

        def get(self, _url):
            self.n += 1
            if self.n == 1:
                return _RespErr(500)
            return _RespOK()

    with patch("backend.api_helpers.ado_session", return_value=_Session()):
        api.validate_pat(TEST_PAT)


def test_validate_pat_auth_error_raises_401():
    class _Session:
        def get(self, _url):
            return _RespErr(401)

    with patch("backend.api_helpers.ado_session", return_value=_Session()):
        with pytest.raises(HTTPException) as exc:
            api.validate_pat(TEST_PAT)
    assert exc.value.status_code == 401


def test_validate_pat_infra_error_raises_502():
    class _Session:
        def get(self, _url):
            return _RespErr(500)

    with patch("backend.api_helpers.ado_session", return_value=_Session()):
        with pytest.raises(HTTPException) as exc:
            api.validate_pat(TEST_PAT)
    assert exc.value.status_code == 502


def test_pick_profile_name_fallbacks():
    assert api._pick_profile_name({"displayName": "Alice"}) == "Alice"
    assert (
        api._pick_profile_name({"coreAttributes": {"FullName": {"value": "Bob"}}})
        == "Bob"
    )
    assert api._pick_profile_name({}) == "Utilisateur"


def test_auth_check_profile_error_fallback_user():
    client = TestClient(api.app)
    with patch("backend.api.get_current_user", side_effect=Exception("boom")):
        r = client.get("/auth/check", headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 200
    assert r.json()["user_name"] == "Utilisateur"


def test_auth_orgs_http_error_paths():
    client = TestClient(api.app)
    with patch("backend.api.list_accessible_orgs", side_effect=_http_error(401)):
        r = client.get("/auth/orgs", headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 401

    with patch("backend.api.list_accessible_orgs", side_effect=_http_error(500)):
        r2 = client.get("/auth/orgs", headers={"x-ado-pat": TEST_PAT})
    assert r2.status_code == 502


def test_auth_projects_teams_options_http_500_to_502():
    client = TestClient(api.app)

    with patch("backend.api.list_projects_for_org", side_effect=_http_error(500)):
        rp = client.post("/auth/projects", json={"org": "org-a"}, headers={"x-ado-pat": TEST_PAT})
    assert rp.status_code == 502

    with patch("backend.api.list_teams_for_org_project", side_effect=_http_error(500)):
        rt = client.post(
            "/auth/teams",
            json={"org": "org-a", "project": "proj-a"},
            headers={"x-ado-pat": TEST_PAT},
        )
    assert rt.status_code == 502

    with patch("backend.api.list_team_work_item_options", side_effect=_http_error(500)):
        ro = client.post(
            "/auth/team-options",
            json={"org": "org-a", "project": "proj-a", "team": "Team A"},
            headers={"x-ado-pat": TEST_PAT},
        )
    assert ro.status_code == 502


def test_team_settings_endpoint_mapping():
    client = TestClient(api.app)
    with patch(
        "backend.api.team_settings_areas",
        return_value={
            "defaultValue": "Area A",
            "values": [{"value": "Area A", "includeChildren": True}],
        },
    ):
        r = client.get("/teams/Team%20A/settings", headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 200
    body = r.json()
    assert body["default_area_path"] == "Area A"
    assert body["area_paths"][0]["includeChildren"] is True


def test_forecast_error_branches():
    client = TestClient(api.app)
    base = {
        "org": "org-a",
        "project": "proj-a",
        "team_name": "Team A",
        "start_date": "2026-01-01",
        "end_date": "2026-02-28",
        "done_states": ["Done"],
        "work_item_types": ["Bug"],
        "n_sims": 2000,
    }

    req_no_org = dict(base)
    req_no_org["org"] = ""
    r = client.post("/forecast", json=req_no_org, headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 400

    req_no_project = dict(base)
    req_no_project["project"] = ""
    r = client.post("/forecast", json=req_no_project, headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 400

    with patch("backend.api.team_settings_areas", return_value={"defaultValue": None}):
        r = client.post("/forecast", json={**base, "backlog_size": 20}, headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 400

    with patch("backend.api.team_settings_areas", return_value={"defaultValue": "Area A"}):
        with patch("backend.api.weekly_throughput", return_value=pd.DataFrame(columns=["week", "throughput"])):
            r = client.post("/forecast", json={**base, "backlog_size": 20}, headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 404

    tiny = pd.DataFrame(
        {
            "week": ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"],
            "throughput": [1, 1, 1, 1, 1],
        }
    )
    with patch("backend.api.team_settings_areas", return_value={"defaultValue": "Area A"}):
        with patch("backend.api.weekly_throughput", return_value=tiny):
            r = client.post("/forecast", json={**base, "backlog_size": 20}, headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 422

    ok_weekly = pd.DataFrame(
        {
            "week": ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29", "2026-02-05"],
            "throughput": [1, 2, 3, 2, 1, 2],
        }
    )
    with patch("backend.api.team_settings_areas", return_value={"defaultValue": "Area A"}):
        with patch("backend.api.weekly_throughput", return_value=ok_weekly):
            r = client.post(
                "/forecast",
                json={**base, "mode": "weeks_to_items", "target_weeks": None},
                headers={"x-ado-pat": TEST_PAT},
            )
    assert r.status_code == 400

    with patch("backend.api.team_settings_areas", return_value={"defaultValue": "Area A"}):
        with patch("backend.api.weekly_throughput", return_value=ok_weekly):
            r = client.post("/forecast", json=base, headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 400


def test_forecast_date_validation_errors():
    client = TestClient(api.app)
    base = {
        "org": "org-a",
        "project": "proj-a",
        "team_name": "Team A",
        "start_date": "2026-02-01",
        "end_date": "2026-01-01",
        "backlog_size": 20,
        "done_states": ["Done"],
        "work_item_types": ["Bug"],
        "n_sims": 2000,
    }
    r = client.post("/forecast", json=base, headers={"x-ado-pat": TEST_PAT})
    assert r.status_code == 422

    bad_format = dict(base)
    bad_format["start_date"] = "01-02-2026"
    bad_format["end_date"] = "2026-03-01"
    r2 = client.post("/forecast", json=bad_format, headers={"x-ado-pat": TEST_PAT})
    assert r2.status_code == 422


def test_forecast_timeout_returns_504():
    client = TestClient(api.app)
    base = {
        "org": "org-a",
        "project": "proj-a",
        "team_name": "Team A",
        "start_date": "2026-01-01",
        "end_date": "2026-02-28",
        "backlog_size": 20,
        "done_states": ["Done"],
        "work_item_types": ["Bug"],
        "n_sims": 2000,
    }

    weekly = pd.DataFrame(
        {
            "week": ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29", "2026-02-05"],
            "throughput": [1, 2, 3, 2, 1, 2],
        }
    )

    original_timeout = api.API_CONFIG.forecast_timeout_seconds
    api.API_CONFIG = api.API_CONFIG.__class__(
        cors_origins=api.API_CONFIG.cors_origins,
        cors_allow_credentials=api.API_CONFIG.cors_allow_credentials,
        forecast_timeout_seconds=0.001,
    )
    try:
        def _slow_finish_weeks(**_kwargs):
            time.sleep(0.05)
            return np.array([10], dtype=int)

        with patch("backend.api.team_settings_areas", return_value={"defaultValue": "Area A"}):
            with patch("backend.api.weekly_throughput", return_value=weekly):
                with patch("backend.api.mc_finish_weeks", side_effect=_slow_finish_weeks):
                    r = client.post("/forecast", json=base, headers={"x-ado-pat": TEST_PAT})
        assert r.status_code == 504
    finally:
        api.API_CONFIG = api.API_CONFIG.__class__(
            cors_origins=api.API_CONFIG.cors_origins,
            cors_allow_credentials=api.API_CONFIG.cors_allow_credentials,
            forecast_timeout_seconds=original_timeout,
        )


def test_root_index_if_available():
    # Covered only when frontend dist exists and route is mounted.
    if hasattr(api, "index"):
        response = api.index()
        assert response is not None
