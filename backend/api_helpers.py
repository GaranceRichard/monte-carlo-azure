from __future__ import annotations

from typing import Dict, Any

from fastapi import HTTPException
import requests

from .ado_client import ado_session


def require_pat(x_ado_pat: str | None) -> str:
    pat = (x_ado_pat or "").strip()
    if not pat:
        raise HTTPException(
            status_code=400,
            detail="PAT Azure DevOps requis via header x-ado-pat. Il est utilise en memoire uniquement et n'est pas sauvegarde.",
        )
    if len(pat) < 20 or any(ch.isspace() for ch in pat):
        raise HTTPException(
            status_code=401,
            detail="PAT invalide ou non autorise sur Azure DevOps.",
        )
    return pat


def validate_pat(pat: str) -> None:
    auth_error: Exception | None = None
    infra_error: Exception | None = None

    s = ado_session(pat_override=pat)
    for url in (
        "https://dev.azure.com/_apis/projects?api-version=7.1",
        "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1-preview.3",
    ):
        try:
            r = s.get(url)
            r.raise_for_status()
            return
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (400, 401, 403):
                auth_error = exc
            else:
                infra_error = exc
        except Exception as exc:
            infra_error = exc

    if auth_error is not None:
        raise HTTPException(
            status_code=401,
            detail="PAT invalide ou non autorise sur Azure DevOps.",
        ) from auth_error

    raise HTTPException(
        status_code=502,
        detail="Impossible de verifier le PAT pour le moment (reseau/proxy Azure DevOps indisponible).",
    ) from infra_error


def pick_profile_name(profile: Dict[str, Any]) -> str:
    direct_candidates = [
        profile.get("fullName"),
        profile.get("displayName"),
        profile.get("publicAlias"),
        profile.get("emailAddress"),
    ]
    for value in direct_candidates:
        if isinstance(value, str) and value.strip():
            return value.strip()

    core = profile.get("coreAttributes")
    if isinstance(core, dict):
        for key in ("DisplayName", "displayName", "FullName", "fullName", "PublicAlias", "publicAlias"):
            node = core.get(key)
            if isinstance(node, dict):
                value = node.get("value")
                if isinstance(value, str) and value.strip():
                    return value.strip()

    return "Utilisateur"
