from backend.ado_client import ado_session

def test_ado_session_has_auth_header(fake_env):
    s = ado_session()
    assert "Authorization" in s.headers
    assert s.headers["Authorization"].startswith("Basic ")
