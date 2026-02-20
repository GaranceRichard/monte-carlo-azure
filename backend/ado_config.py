from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class AdoConfig:
    org: str
    project: str
    pat: str

    # Optionnel : defaults (pour scripts / UI)
    default_team: Optional[str] = None
    default_area_path: Optional[str] = None

def _clean(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    return v or None

def get_ado_config(pat_override: Optional[str] = None) -> AdoConfig:
    """
    Lit la configuration Azure DevOps depuis l'environnement.

    Obligatoire :
      - PAT fourni par le front (x-ado-pat) ou ADO_PAT en fallback

    Defaults (optionnel) :
      - ADO_DEFAULT_TEAM
      - ADO_DEFAULT_AREA_PATH

    Valeurs actives (optionnel, priorité sur defaults) :
      - ADO_TEAM
      - ADO_AREA_PATH
    """
    org = os.getenv("ADO_ORG", "messqc").strip()
    project = os.getenv("ADO_PROJECT", "Projet-700").strip()
    pat = _clean(pat_override) or os.getenv("ADO_PAT", "").strip()

    if not pat:
        raise RuntimeError(
            "PAT Azure DevOps manquant. Fournissez x-ado-pat (UI) ou ADO_PAT en variable d'environnement."
        )
    if not org:
        raise RuntimeError("ADO_ORG est vide (variable d'environnement).")
    if not project:
        raise RuntimeError("ADO_PROJECT est vide (variable d'environnement).")

    # Valeurs actives (ADO_TEAM/ADO_AREA_PATH) priment
    default_team = _clean(os.getenv("ADO_TEAM")) or _clean(os.getenv("ADO_DEFAULT_TEAM"))
    default_area_path = _clean(os.getenv("ADO_AREA_PATH")) or _clean(os.getenv("ADO_DEFAULT_AREA_PATH"))

    return AdoConfig(
        org=org,
        project=project,
        pat=pat,
        default_team=default_team,
        default_area_path=default_area_path,
    )
