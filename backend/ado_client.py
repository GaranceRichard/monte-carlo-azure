import base64
import requests
from .ado_config import get_ado_config

def ado_session() -> requests.Session:
    """
    Crée une session HTTP authentifiée pour Azure DevOps (PAT via .env).
    """
    cfg = get_ado_config()
    token = base64.b64encode(f":{cfg.pat}".encode()).decode()

    s = requests.Session()
    s.headers.update({
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
    })
    return s
