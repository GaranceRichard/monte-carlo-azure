# Monte Carlo Azure

Outil de prÃ©vision (forecast) basÃ© sur une simulation de Monte Carlo, alimentÃ© par lâ€™historique de throughput Azure DevOps (Work Items fermÃ©s).  
Le projet expose une API (FastAPI) et une UI (React/Vite). En mode bundle, lâ€™API sert directement le front compilÃ©.

---

## FonctionnalitÃ©s

- Liste des Ã©quipes ADO et lecture dâ€™une configuration par Ã©quipe
- Extraction dâ€™historique (Work Items fermÃ©s) et calcul du throughput hebdomadaire
- Simulation Monte Carlo (N itÃ©rations) pour estimer une distribution de dates/semaines de complÃ©tion
- API REST + UI web
- Tests automatisÃ©s (pytest + mocks)

---

## Architecture

```text
backend/
  api.py            # FastAPI (endpoints + static frontend in bundle)
  ado_client.py     # client ADO
  ado_core.py       # requÃªtes ADO / rÃ©cupÃ©ration des items
  ado_config.py     # config (env + settings)
  mc_core.py        # calcul throughput + Monte Carlo
frontend/           # UI React/Vite
Scripts/            # scripts utilitaires (smoke, list teams, etc.)
tests/              # tests pytest
run_app.py          # lance lâ€™API (dev)
```

---

## PrÃ©requis

- Python 3.10+ (recommandÃ©)
- Node.js 18+ (pour le front)
- AccÃ¨s Azure DevOps + PAT (Personal Access Token) avec droits minimum (Work Items read)

---

## Configuration

### Authentification PAT

Au dÃ©marrage, lâ€™application affiche un Ã©cran de connexion et demande le PAT Azure DevOps.

- Le PAT est utilisÃ© en mÃ©moire pendant la session en cours.
- Le PAT nâ€™est pas sauvegardÃ© sur disque.
- Validation immÃ©diate via `GET /auth/check`.

Variable dâ€™environnement optionnelle :
- `ADO_PAT` (fallback si pas de PAT fourni par header)

Lâ€™organisation et le projet sont dÃ©sormais sÃ©lectionnÃ©s dans lâ€™interface
et transmis Ã  lâ€™API, sans dÃ©pendre de `ADO_ORG` / `ADO_PROJECT`.

---

## Lancer en dÃ©veloppement

### Backend (API)

1) CrÃ©er un environnement virtuel + installer les dÃ©pendances :
```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2) Lancer lâ€™API :
```bash
python run_app.py
```

API dispo (par dÃ©faut) : `http://127.0.0.1:8000`

### Frontend (UI)

Dans `frontend/` :
```bash
npm install
npm run dev
```

UI dispo : `http://localhost:5173`

---

## Endpoints principaux

- `GET /health` : check de santÃ©
- `GET /auth/check` : valide le PAT (header `x-ado-pat`)
- `GET /auth/orgs` : liste les organisations accessibles
- `POST /auth/projects` : projets accessibles dâ€™une organisation
- `POST /auth/teams` : Ã©quipes accessibles dâ€™un projet
- `POST /auth/team-options` : types/Ã©tats disponibles pour une Ã©quipe
- `GET /teams` : liste des Ã©quipes (mode historique)
- `GET /teams/{team}/settings` : settings dâ€™Ã©quipe (si applicable)
- `POST /forecast` : calcul de simulation

Les paramÃ¨tres exacts sont visibles dans Swagger : `/docs`.

---

## Tests

Ã€ la racine :
```bash
pytest
```

### Coverage back (console)

```bash
python -m pytest --cov=backend --cov-report=term-missing -q
```

### Coverage front unit (console + html)

Dans `frontend/` :
```bash
npm install
npm run test:unit:coverage
```

Le resume de couverture est affiche dans le terminal.
Le rapport HTML est genere dans `frontend/coverage/`.

### Coverage E2E (front only, console)

```bash
npm --prefix frontend run test:e2e:coverage:console
```

Note: la task VS Code `Coverage E2E (Playwright)` utilise un script PowerShell dedie
(`.vscode/scripts/run-e2e-coverage.ps1`) pour eviter les problemes de quoting Windows
sur les chemins contenant des espaces.

---

## Packaging (PyInstaller)

Le projet inclut un spec PyInstaller : `MonteCarloADO.spec`.  
Objectif : produire un exÃ©cutable qui embarque lâ€™API et sert le `frontend/dist`.

1) Build du frontend :
```bash
cd frontend
npm install
npm run build
cd ..
```

2) Build PyInstaller :
```bash
pyinstaller MonteCarloADO.spec
```

Lâ€™exÃ©cutable se retrouve dans `dist/`.

---

## SÃ©curitÃ©

- Ne pas commiter de secrets (PAT, clÃ©s privÃ©es).
- Script de vÃ©rification avant commit : `Scripts/check_no_secrets.py`.


