import base64
import requests
from typing import Optional

from .ado_config import get_ado_config

def ado_session(pat_override: Optional[str] = None) -> requests.Session:
    """
    Crée une session HTTP authentifiée pour Azure DevOps.
    Session éphémère construite avec le PAT reçu (pas de persistance disque).
    """
    cfg = get_ado_config(pat_override=pat_override)
    token = base64.b64encode(f":{cfg.pat}".encode()).decode()

    s = requests.Session()
    s.headers.update(
        {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }
    )
    return s
