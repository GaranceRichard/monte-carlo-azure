# Monte Carlo Azure

[![CI](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml/badge.svg)](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml)

Outil de prévision basé sur une simulation Monte Carlo. Il répond au Use Case suivant : l'utilisateur se connecte et peut effectuer facilement une simulation sur un site avec peu d'informations, sans laisser de trace ou compromettre Azure avec son Token.

Architecture V2:
- Le frontend appelle Azure DevOps directement depuis le navigateur.
- Le backend OVH ne reçoit que des données anonymes de throughput (`throughput_samples`) pour calculer la simulation.

Refactors récents (frontend):
- utilitaires centralisés `src/date.ts`, `src/storage.ts`, `src/utils/math.ts`, `src/utils/simulation.ts`
- introduction d'un contexte React `src/components/steps/SimulationContext.tsx` pour éviter le prop-drilling de `SimulationViewModel`
- centralisation des accès `localStorage` via `storage.ts`

---

## Fonctionnalités

- Connexion Azure DevOps avec PAT côté navigateur (non transmis au backend)
- Sélection organisation -> projet -> équipe
- Récupération du throughput hebdomadaire côté client
- Simulation Monte Carlo côté backend (`POST /simulate`)
- Visualisation des percentiles et distributions
- Export CSV du throughput hebdomadaire
- Historique local des dernières simulations (localStorage, sans compte)
- Paramètre de capacité réduite (ex: équipe à 70% pendant N semaines)

---

## Sécurité

Le PAT Azure DevOps:
- est utilisé uniquement dans le navigateur de l'utilisateur
- ne transite jamais par le backend
- n'est pas sauvegardé par le serveur

### SLA Identité (Non Négociable)

Règle fondamentale:
- 0 donnée d'identification (PAT, UUID, ORG, Team) ne doit transiter par un serveur applicatif (local ou distant).
- Les appels Azure DevOps doivent partir directement du navigateur vers:
  - `https://dev.azure.com`
  - `https://app.vssps.visualstudio.com`

Toute transgression de cette règle est considérée comme une faute majeure.

Contrôle automatique:
- CI exécute `python Scripts/check_identity_boundary.py`
- Si une proxyfication serveur (`/ado`, `/vssps`) ou un endpoint local de résolution PAT est détecté, la CI échoue.

Le backend ne reçoit que:
- `throughput_samples` (liste d'entiers)
- les paramètres de simulation (`mode`, `backlog_size`/`target_weeks`, `n_sims`)

Garde-fous serveur:
- rate limiting sur `POST /simulate` (limite par client/IP sur fenêtre glissante)
- niveau de logs applicatifs réduit (`warning`) et logs d'accès HTTP désactivés

---

## Architecture

```text
frontend/
  src/
    adoClient.ts        # appels directs Azure DevOps
    api.ts              # appel backend /simulate uniquement
    hooks/
      useOnboarding.ts  # PAT en state local
      useSimulation.ts             # orchestrateur simulation
      useSimulationPrefs.ts        # persistance localStorage des préférences
      useSimulationHistory.ts      # historique local (10 dernières simulations)
      useSimulationChartData.ts    # mapping/useMemo des données graphiques
      useSimulationAutoRun.ts      # auto-run avec debounce
    components/steps/
      SimulationChartTabs.tsx      # tabs + rendu des charts Recharts
      simulationPdfExport.tsx      # export PDF via rendu statique Recharts

backend/
  api.py                # FastAPI + CORS + route /simulate + /health
  api_routes_simulate.py # endpoint /simulate
  rate_limiter.py       # rate limiter glissant + clé client
  api_models.py         # SimulateRequest / SimulateResponse
  mc_core.py            # coeur Monte Carlo
```

---

## Prérequis

- Python 3.10+
- Node.js 20+
- Accès Azure DevOps + PAT
- Docker (optionnel, recommandé pour un déploiement rapide)

---

## Quick Start (Docker)

En 3 commandes:

```bash
cp .env.example .env
docker compose up -d --build
curl -sS http://127.0.0.1:8000/health
```

L'application (frontend servi par FastAPI) est ensuite disponible sur:
- `http://127.0.0.1:8000`

---

## Lancer en développement

Option rapide (Windows PowerShell, 3 terminaux: backend + frontend + health):

```powershell
.\start-dev.ps1 -ThreeTerminals
```

Le terminal health verifie `http://127.0.0.1:8000/health` en boucle (intervalle par defaut: 5s).
Dans VS Code, `Ctrl+Shift+B` lance aussi la tache par defaut `Dev: 3 terminaux`.

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

### Mode manuel en 3 terminaux

Terminal 1 (backend):

```powershell
python run_app.py --no-browser
```

Terminal 2 (frontend):

```powershell
npm --prefix frontend run dev
```

Terminal 3 (check recurrent health):

```powershell
while ($true) { try { Invoke-RestMethod http://127.0.0.1:8000/health -TimeoutSec 2 | ConvertTo-Json -Compress } catch { Write-Host $_.Exception.Message }; Start-Sleep -Seconds 5 }
```

---

## API

- `GET /health`
- `POST /simulate`
- CORS autorisé: `GET`, `POST`, `OPTIONS`

Swagger: `/docs`

### Requête `POST /simulate`

```json
{
  "throughput_samples": [3, 5, 2, 4, 6, 3],
  "mode": "backlog_to_weeks",
  "backlog_size": 120,
  "n_sims": 20000
}
```

ou

```json
{
  "throughput_samples": [3, 5, 2, 4, 6, 3],
  "mode": "weeks_to_items",
  "target_weeks": 12,
  "n_sims": 20000
}
```

### Réponse `POST /simulate`

```json
{
  "result_kind": "weeks",
  "result_percentiles": { "P50": 10, "P70": 12, "P90": 15 },
  "result_distribution": [{ "x": 10, "count": 123 }],
  "samples_count": 30
}
```

`result_distribution` contient des buckets `{ x, count }`:
- `x`: valeur simulée (semaines ou items selon le mode)
- `count`: fréquence observée dans les simulations

### Interprétation métier

- mode `backlog_to_weeks`:
  - question: "en combien de semaines terminer le backlog ?"
  - lecture des probabilités: `P(X <= semaines)`
- mode `weeks_to_items`:
  - question: "combien d'items livrer en N semaines ?"
  - en UI, la courbe de probabilité est affichée en `P(X >= items)` (probabilité d'atteindre au moins X items)

---

## Tests et coverage

Depuis la racine:

```bash
.venv\Scripts\python.exe -m ruff check .
.venv\Scripts\python.exe -m ruff format --check .
.venv\Scripts\python.exe -m pytest --cov=backend --cov-report=term-missing -q
```

Frontend:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run lint -- --max-warnings 0
npm --prefix frontend run test:unit
npm --prefix frontend run test:unit:coverage
npm --prefix frontend run test:e2e
npm --prefix frontend run test:e2e:coverage:console
```

Suite E2E découpée:
- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/selection.spec.js`
- `frontend/tests/e2e/simulation.spec.js`
- `frontend/tests/e2e/coverage.spec.js` (seuils Istanbul agrégés, incluant branches >= 80%)

---

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

- Job `backend-tests`
  - Setup Python 3.12
  - Installation des dépendances backend
  - Lint backend: `python -m ruff check .`
  - Contrôle SLA identité: `python Scripts/check_identity_boundary.py`
  - Tests backend: `python -m pytest -q`

- Job `frontend-tests`
  - Setup Node.js 22
  - Installation frontend: `npm ci` (dans `frontend`)
  - Lint frontend: `npm run lint -- --max-warnings 0`
  - Tests unitaires: `npm run test:unit` (Vitest)
  - Installation Playwright: `npx playwright install --with-deps chromium`
  - Tests e2e: `npm run test:e2e`

- Job `docker-smoke`
  - Build de l'image Docker à chaque push/PR
  - Démarrage via `docker compose up -d --build`
  - Smoke test santé: `GET /health`

---

## Déploiement production

Guide complet:
- [`docs/deployment.md`](docs/deployment.md)

Le guide couvre:
- option Docker Compose (recommandée)
- option Nginx + systemd
- checks post-déploiement et points sécurité

---

## Bonnes pratiques

- Ne pas commiter de secrets (PAT, tokens, clés privées)
- Vérifier avant commit:

```bash
python Scripts/check_no_secrets.py
```

### Pré-commit local (activé automatiquement)

Le hook versionné est activé automatiquement après installation frontend via:
- `npm --prefix frontend install` (script `prepare` -> `git -C .. config --local core.hooksPath .githooks`)

Vérification manuelle (si nécessaire):

```bash
git config core.hooksPath .githooks
```

Le hook `pre-commit` exécute:
- validation de mise à jour du `README.md` si des fichiers code/config sont commités
- validation que `README.md` ne contient pas de mojibake (accents cassés)
- `python Scripts/check_no_secrets.py`
