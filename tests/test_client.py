from backend.ado_client import ado_session

def test_ado_session_has_auth_header(fake_env):
    s = ado_session()
    assert "Authorization" in s.headers
    assert s.headers["Authorization"].startswith("Basic ")


def test_ado_session_with_pat_override_without_org_project(monkeypatch):
    monkeypatch.delenv("ADO_ORG", raising=False)
    monkeypatch.delenv("ADO_PROJECT", raising=False)
    monkeypatch.delenv("ADO_PAT", raising=False)

    s = ado_session(pat_override="fake-pat-token-1234567890")
    assert "Authorization" in s.headers
    assert s.headers["Authorization"].startswith("Basic ")
