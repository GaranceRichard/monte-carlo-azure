from backend.ado_config import get_ado_config

def test_get_ado_config(fake_env):
    cfg = get_ado_config()
    assert cfg.org == "messqc"
    assert cfg.project == "Projet-700"
    assert cfg.pat == "FAKE_PAT"
