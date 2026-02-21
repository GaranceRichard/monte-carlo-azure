import base64
import os
import requests
from typing import Optional

DEFAULT_ADO_TIMEOUT_SECONDS = 15


class AdoSession(requests.Session):
    """
    Session requests avec timeout par defaut sur toutes les requetes.
    """

    def __init__(self, timeout_seconds: int = DEFAULT_ADO_TIMEOUT_SECONDS):
        super().__init__()
        self._timeout_seconds = timeout_seconds

    def request(self, method, url, **kwargs):
        kwargs.setdefault("timeout", self._timeout_seconds)
        return super().request(method, url, **kwargs)


def ado_session(pat_override: Optional[str] = None) -> requests.Session:
    """
    Crée une session HTTP authentifiée pour Azure DevOps.
    Session éphémère construite avec le PAT reçu (pas de persistance disque).
    """
    pat = (pat_override or "").strip() or os.getenv("ADO_PAT", "").strip()
    if not pat:
        raise RuntimeError(
            "PAT Azure DevOps manquant. Fournissez x-ado-pat (UI) ou ADO_PAT en variable d'environnement."
        )

    token = base64.b64encode(f":{pat}".encode()).decode()

    s = AdoSession()
    s.headers.update(
        {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }
    )
    return s
