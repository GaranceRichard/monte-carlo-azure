# Monte Carlo Azure

Outil de prévision basé sur une simulation Monte Carlo. Il répond au Use Case suivant : l'utilisateur se connecte et peut effectuer facilement une simulation sur un site avec peu d'informations, sans laisser de trace ou compromettre Azure avec son Token.

Architecture V2:
- Le frontend appelle Azure DevOps directement depuis le navigateur.
- Le backend OVH ne reçoit que des données anonymes de throughput (`throughput_samples`) pour calculer la simulation.

---

## Fonctionnalités

- Connexion Azure DevOps avec PAT côté navigateur (non transmis au backend)
- Sélection organisation -> projet -> équipe
- Récupération du throughput hebdomadaire côté client
- Simulation Monte Carlo côté backend (`POST /simulate`)
- Visualisation des percentiles et distributions

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
      useSimulation.ts  # throughput client + simulation serveur

backend/
  api.py                # FastAPI + CORS + route /simulate + /health
  api_routes_simulate.py
  api_models.py         # SimulateRequest / SimulateResponse
  mc_core.py            # coeur Monte Carlo
```

---

## Prérequis

- Python 3.10+
- Node.js 20+
- Accès Azure DevOps + PAT

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

API: `http://127.0.0.1:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: `http://localhost:5173`

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
.venv\Scripts\python.exe -m pytest --cov=backend --cov-report=term-missing -q
```

Frontend:

```bash
npm --prefix frontend run typecheck
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
  - Contrôle SLA identité: `python Scripts/check_identity_boundary.py`
  - Tests backend: `python -m pytest -q`

- Job `frontend-tests`
  - Setup Node.js 22
  - Installation frontend: `npm ci` (dans `frontend`)
  - Tests unitaires: `npm run test:unit` (Vitest)
  - Installation Playwright: `npx playwright install --with-deps chromium`
  - Tests e2e: `npm run test:e2e`

---

## Bonnes pratiques

- Ne pas commiter de secrets (PAT, tokens, clés privées)
- Vérifier avant commit:

```bash
python Scripts/check_no_secrets.py
```

### Pré-commit local (recommandé)

Activer les hooks versionnés du repo:

```bash
git config core.hooksPath .githooks
```

Le hook `pre-commit` exécute:
- validation de mise à jour du `README.md` si des fichiers code/config sont commités
- validation que `README.md` ne contient pas de mojibake (accents cassés)
- `python Scripts/check_no_secrets.py`
