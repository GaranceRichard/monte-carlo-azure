from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

# Charge les variables depuis .env (à la racine du projet)
load_dotenv()

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

def get_ado_config() -> AdoConfig:
    """
    Lit la configuration Azure DevOps depuis l'environnement (.env inclus).

    Obligatoire :
      - ADO_PAT

    Optionnel :
      - ADO_ORG 
      - ADO_PROJECT 

    Defaults (optionnel) :
      - ADO_DEFAULT_TEAM
      - ADO_DEFAULT_AREA_PATH

    Valeurs actives (optionnel, priorité sur defaults) :
      - ADO_TEAM
      - ADO_AREA_PATH
    """
    org = os.getenv("ADO_ORG", "").strip()
    project = os.getenv("ADO_PROJECT", "Projet-700").strip()
    pat = os.getenv("ADO_PAT", "").strip()

    if not pat:
        raise RuntimeError(
            "ADO_PAT manquant. Ajoutez dans .env :\n"
            "ADO_PAT=...\nADO_ORG=messqc\nADO_PROJECT=Projet-700"
        )
    if not org:
        raise RuntimeError("ADO_ORG est vide (vérifiez .env).")
    if not project:
        raise RuntimeError("ADO_PROJECT est vide (vérifiez .env).")

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
