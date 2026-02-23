# Monte Carlo Azure

Outil de prevision base sur une simulation de Monte Carlo, alimente par l'historique de throughput Azure DevOps (Work Items fermes).
Le projet expose une API (FastAPI) et une UI (React/Vite).

---

## Fonctionnalites

- Authentification Azure DevOps par PAT (header `x-ado-pat`)
- Selection organisation -> projet -> equipe depuis l'UI
- Extraction de throughput hebdomadaire
- Simulation Monte Carlo
- Resultats de simulation unifies:
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

## Prerequis

- Python 3.10+
- Node.js 18+
- Acces Azure DevOps + PAT (minimum Work Items read)

---

## Configuration PAT

Au demarrage, l'application demande le PAT Azure DevOps.

- Le PAT est utilise en memoire pendant la session.
- Le PAT n'est pas sauvegarde sur disque.
- Validation immediate via `GET /auth/check`.
- Fallback possible cote serveur via variable d'environnement `ADO_PAT`.

---

## Lancer en developpement

### Backend

```bash
python -m venv .venv
# PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run_app.py
```

API: `http://127.0.0.1:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: `http://localhost:5173`

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

Swagger: `/docs`

---

## Tests et coverage

Depuis la racine:

```bash
pytest
```

Coverage backend:

```bash
python -m pytest --cov=backend --cov-report=term-missing -q
```

Coverage frontend unit:

```bash
npm --prefix frontend run test:unit:coverage
```

Coverage frontend E2E:

```bash
npm --prefix frontend run test:e2e:coverage:console
```

Notes:
- La task VS Code principale est `Coverage: 5 terminaux`.
- Elle lance en parallele:
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

## Securite

- Ne pas commiter de secrets (PAT, cles privees, tokens).
- Utiliser le script de verification avant commit:

```bash
python Scripts/check_no_secrets.py
```
