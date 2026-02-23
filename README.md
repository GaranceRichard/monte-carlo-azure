# Monte Carlo Azure

Outil de prévision basé sur une simulation de Monte Carlo, alimenté par l'historique de throughput Azure DevOps (Work Items fermés).  
Le projet expose une API (FastAPI) et une UI (React/Vite).

---

## Fonctionnalités

- Authentification Azure DevOps par PAT (header `x-ado-pat`)
- Sélection organisation -> projet -> équipe depuis l'UI
- Extraction de throughput hebdomadaire
- Simulation Monte Carlo
- Résultats de simulation unifiés :
  - `result_kind` (`weeks` ou `items`)
  - `result_percentiles`
  - `result_distribution`

---

## Architecture

```text
backend/
  api.py
  api_dependencies.py
  api_routes_auth.py
  api_routes_teams.py
  api_routes_forecast.py
  ...
frontend/
  src/
    App.jsx
    hooks/
      useOnboarding.js
      useSimulation.js
tests/
run_app.py
```

---

## Prérequis

- Python 3.10+
- Node.js 18+
- Accès Azure DevOps + PAT (minimum Work Items read)

---

## Configuration PAT

Au démarrage, l'application demande le PAT Azure DevOps.

- Le PAT est utilisé en mémoire pendant la session.
- Le PAT n'est pas sauvegardé sur disque.
- Validation immédiate via `GET /auth/check`.
- Fallback possible côté serveur via variable d'environnement `ADO_PAT`.

---

## Lancer en développement

### Backend

```bash
python -m venv .venv
# PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run_app.py
```

API : `http://127.0.0.1:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI : `http://localhost:5173`

---

## Endpoints principaux

- `GET /health`
- `GET /auth/check`
- `GET /auth/orgs`
- `POST /auth/projects`
- `POST /auth/teams`
- `POST /auth/team-options`
- `GET /teams`
- `GET /teams/{team}/settings`
- `POST /forecast`

Swagger : `/docs`

---

## Tests et coverage

Depuis la racine :

```bash
pytest
```

Coverage backend :

```bash
python -m pytest --cov=backend --cov-report=term-missing -q
```

Coverage frontend unit :

```bash
npm --prefix frontend run test:unit:coverage
```

Coverage frontend E2E :

```bash
npm --prefix frontend run test:e2e:coverage:console
```

Notes :
- La task VS Code principale est `Coverage: 5 terminaux`.
- Elle lance en parallèle :
  - unit coverage front
  - coverage back
  - coverage E2E
  - lint front
  - build front

---

## Build frontend

```bash
npm --prefix frontend run build
```

Le bundling Vite utilise un split manuel (`vendor-react`, `vendor-recharts`) pour limiter la taille du chunk principal.

---

## Sécurité

- Ne pas commiter de secrets (PAT, clés privées, tokens).
- Utiliser le script de vérification avant commit :

```bash
python Scripts/check_no_secrets.py
```
