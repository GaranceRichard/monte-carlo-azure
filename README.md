# Monte Carlo Azure

Outil de prÃ©vision (forecast) basÃ© sur une simulation de Monte Carlo, alimentÃ© par lâ€™historique de throughput Azure DevOps (Work Items fermÃ©s).  
Le projet expose une API (FastAPI) et une UI (React/Vite). En mode â€œbundleâ€, lâ€™API sert directement le front compilÃ©.

---

## FonctionnalitÃ©s

- Liste des Ã©quipes ADO et lecture dâ€™une configuration par Ã©quipe
- Extraction dâ€™historique (Work Items fermÃ©s) et calcul du throughput hebdomadaire
- Simulation Monte Carlo (N itÃ©rations) pour estimer une distribution de dates/semaines de complÃ©tion
- API REST + UI web
- Tests automatisÃ©s (pytest + mocks)

---

## Architecture

```
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

Au demarrage, l'application affiche un ecran de connexion et demande le PAT Azure DevOps.

- Le PAT est utilise en memoire pendant la session en cours.
- Le PAT n'est pas sauvegarde sur disque (pas de `.env` pour le token).
- Validation immediate via `GET /auth/check`.

Variables d'environnement encore utilisees (optionnel selon votre environnement) :
- `ADO_ORG` (defaut: `messqc`)
- `ADO_PROJECT` (defaut: `Projet-700`)

---

## Lancer en dÃ©veloppement

### Backend (API)

1) CrÃ©er un environnement virtuel + installer les dÃ©pendances (exemple) :
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
- `GET /auth/orgs` : liste les organisations accessibles avec le PAT
- `GET /teams` : liste des Ã©quipes
- `GET /teams/{team}/settings` : settings dâ€™Ã©quipe (si applicable)
- `POST /forecast` : calcule un forecast (paramÃ¨tres : team, area path, backlog, nb simulations, etc.)

> Les paramÃ¨tres exacts sont visibles via la doc interactive FastAPI (Swagger) : `/docs`.

---

## Tests

Ã€ la racine :
```bash
pytest
```

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

2) Build PyInstaller (exemple) :
```bash
pyinstaller MonteCarloADO.spec
```

Lâ€™exÃ©cutable se retrouve dans `dist/`.

> Bonnes pratiques : `dist/` et `build/` ne doivent pas Ãªtre versionnÃ©s (cf. `.gitignore`).

---

## HypothÃ¨ses et limites

- Le throughput est calculÃ© sur la base de la date de clÃ´ture (ClosedDate) et dâ€™Ã©tats â€œterminÃ©sâ€ (selon le workflow ADO).
- Les semaines Ã  throughput nul peuvent Ãªtre exclues (selon la logique retenue) pour Ã©viter de â€œpolluerâ€ la distribution.
- Les rÃ©sultats Monte Carlo dÃ©pendent fortement :
  - de la qualitÃ© de lâ€™historique (stabilitÃ© du flux, changements de process),
  - du pÃ©rimÃ¨tre retenu (Area Path / Team),
  - de la dÃ©finition de â€œDoneâ€ dans ADO.

---

## SÃ©curitÃ©

- Ne pas commiter de secrets (PAT, clÃ©s privÃ©es).
- Script de vÃ©rification avant commit : `Scripts/check_no_secrets.py`.

---

## Roadmap (suggestion)

- Stabiliser la reproductibilitÃ© (fichier de dÃ©pendances Python + scripts de build)
- Ajouter des percentiles (P50/P80/P90) et conversion en dates estimÃ©es
- Ajouter un Ã©cran â€œdiagnosticâ€ (pÃ©rimÃ¨tre, nombre de semaines, zÃ©ros exclus)
- CI GitHub Actions : tests + build + release

---

## Licence

Ã€ dÃ©finir.
Si le dÃ©pÃ´t est destinÃ© Ã  un usage interne (ADO + contexte organisation), dÃ©pÃ´t privÃ© recommandÃ©.
