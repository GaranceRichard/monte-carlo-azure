from unittest.mock import patch
import Scripts.ado_smoke as smoke


class FakeCfg:
    org = "org-demo"
    project = "Project-Alpha"
    pat = "FAKE_PAT"


class FakeResp:
    status_code = 200
    text = '{"count":1,"value":[{"name":"Project-Alpha"}]}'

    def raise_for_status(self):
        return None

    def json(self):
        return {"count": 1, "value": [{"name": "Project-Alpha"}]}


class FakeSession:
    def get(self, url):
        return FakeResp()


def test_script_ado_smoke_runs(capsys):
    with patch("Scripts.ado_smoke.get_ado_config", return_value=FakeCfg()):
        with patch("Scripts.ado_smoke.ado_session", return_value=FakeSession()):
            smoke.smoke_projects()
            out = capsys.readouterr().out
            assert "HTTP 200" in out
            assert "Projects found" in out
