from unittest.mock import patch
import Scripts.ado_smoke as smoke

class FakeResp:
    status_code = 200
    text = '{"count":1,"value":[{"name":"Projet-700"}]}'
    def raise_for_status(self): 
        return None
    def json(self):
        return {"count": 1, "value": [{"name": "Projet-700"}]}

class FakeSession:
    def get(self, url):
        return FakeResp()

def test_script_ado_smoke_runs(fake_env, capsys):
    # on remplace la session HTTP par un faux objet
    with patch("Scripts.ado_smoke.ado_session", return_value=FakeSession()):
        # et on remplace la config par une config “fake”
        with patch("Scripts.ado_smoke.get_ado_config") as p:
            p.return_value.org = "messqc"
            p.return_value.project = "Projet-700"
            p.return_value.pat = "FAKE_PAT"

            smoke.smoke_projects()
            out = capsys.readouterr().out
            assert "HTTP 200" in out
            assert "Projects found" in out
