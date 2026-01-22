from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv

# Charge les variables depuis .env (à la racine du projet)
load_dotenv()

@dataclass(frozen=True)
class AdoConfig:
    org: str
    project: str
    pat: str

def get_ado_config() -> AdoConfig:
    """
    Lit la configuration Azure DevOps depuis l'environnement (.env inclus).

    Attendu dans .env :
      - ADO_PAT (obligatoire)
      - ADO_ORG (optionnel, défaut: 'messqc')
      - ADO_PROJECT (optionnel, défaut: 'Projet-700')
    """
    org = os.getenv("ADO_ORG", "messqc").strip()
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

    return AdoConfig(org=org, project=project, pat=pat)
