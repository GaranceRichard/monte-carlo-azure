from backend.ado_config import get_ado_config

if __name__ == "__main__":
    cfg = get_ado_config()
    pat_preview = (cfg.pat[:6] + "…") if cfg.pat else "(vide)"

    print("OK - configuration chargée")
    print("ORG     :", cfg.org)
    print("PROJECT :", cfg.project)
    print("PAT     :", pat_preview)
