# Scripts/ado_whoami.py
from __future__ import annotations

import os
from typing import Any, Dict, Optional

from backend.ado_config import get_ado_config
from backend.ado_client import ado_session


API_VERSION = "7.1"


def _env(name: str) -> str:
    return (os.getenv(name) or "").strip()


def resolve_team_name() -> Optional[str]:
    # Convention repo : ADO_TEAM (optionnel)
    v = _env("ADO_TEAM")
    return v or None


def resolve_area_path() -> Optional[str]:
    # Convention repo : ADO_AREA_PATH (optionnel)
    v = _env("ADO_AREA_PATH")
    return v or None


def ado_profile_me() -> Dict[str, Any]:
    """
    WhoAmI côté Azure DevOps :
    Endpoint profil (VSSPS) — marche si le PAT est valide côté org.
    """
    cfg = get_ado_config()
    s = ado_session()

    # IMPORTANT: profil = vssps.dev.azure.com (pas dev.azure.com)
    url = f"https://vssps.dev.azure.com/{cfg.org}/_apis/profile/profiles/me?api-version={API_VERSION}"
    r = s.get(url)
    r.raise_for_status()
    return r.json()


def main() -> int:
    cfg = get_ado_config()

    team = resolve_team_name()
    area = resolve_area_path()

    print("=== CONFIG RESOLUE ===")
    print(f"ORG             : {cfg.org}")
    print(f"PROJECT         : {cfg.project}")
    print(f"TEAM (resolved) : {team or '(non défini)'}")
    print(f"AREA (resolved) : {area or '(non défini)'}")

    # Appel "whoami" (profil)
    try:
        me = ado_profile_me()
        display = me.get("displayName") or "(unknown)"
        email = me.get("emailAddress") or "(no email)"
        core = me.get("coreAttributes") or {}
        alias = core.get("alias", {}).get("value") if isinstance(core, dict) else None

        print("\n=== WHOAMI (ADO PROFILE) ===")
        print(f"displayName : {display}")
        print(f"email       : {email}")
        if alias:
            print(f"alias       : {alias}")

    except Exception as e:
        # On reste pragmatique : le script sert d’abord à vérifier la config.
        print("\n=== WHOAMI (ADO PROFILE) ===")
        print("Impossible de lire le profil (token/permissions/org).")
        print(f"Détail: {e}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
