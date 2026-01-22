import base64
import requests
from typing import Optional

from .ado_config import get_ado_config

_session: Optional[requests.Session] = None


def ado_session() -> requests.Session:
    """
    Crée (ou retourne) une session HTTP authentifiée pour Azure DevOps.
    Lazy init + cache : évite toute dépendance à l'environnement à l'import.
    """
    global _session
    if _session is not None:
        return _session

    cfg = get_ado_config()
    token = base64.b64encode(f":{cfg.pat}".encode()).decode()

    s = requests.Session()
    s.headers.update(
        {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }
    )
    _session = s
    return s


def reset_session() -> None:
    """
    Utile pour les tests : force la reconstruction de la session.
    """
    global _session
    _session = None
