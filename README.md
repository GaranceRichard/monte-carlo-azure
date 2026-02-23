# Monte Carlo Azure

Outil de prevision base sur une simulation Monte Carlo. Il répond au Use Case suivant : l'utilisateur se connecte et peut effectuer facilement une simulation sur un site avec peu d'informations, sans laisser de trâce ou compromettre Azure avec son Token.

Architecture V2:
- Le frontend appelle Azure DevOps directement depuis le navigateur.
- Le backend OVH ne recoit que des donnees anonymes de throughput (`throughput_samples`) pour calculer la simulation.

---

## Fonctionnalites

- Connexion Azure DevOps avec PAT cote navigateur (non transmis au backend)
- Selection organisation -> projet -> equipe
- Recuperation du throughput hebdomadaire cote client
- Simulation Monte Carlo cote backend (`POST /simulate`)
- Visualisation des percentiles et distributions

---

## Securite

Le PAT Azure DevOps:
- est utilise uniquement dans le navigateur de l'utilisateur
- ne transite jamais par le backend
- n'est pas sauvegarde par le serveur

Le backend ne recoit que:
- `throughput_samples` (liste d'entiers)
- les parametres de simulation (`mode`, `backlog_size`/`target_weeks`, `n_sims`)

Garde-fous serveur:
- rate limiting sur `POST /simulate` (limite par client/IP sur fenetre glissante)
- niveau de logs applicatifs reduit (`warning`) et logs d'acces HTTP desactives

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

## Prerequis

- Python 3.10+
- Node.js 18+
- Acces Azure DevOps + PAT

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

## API

- `GET /health`
- `POST /simulate`
- CORS autorise: `GET`, `POST`, `OPTIONS`

Swagger: `/docs`

### Requete `POST /simulate`

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

### Reponse `POST /simulate`

```json
{
  "result_kind": "weeks",
  "result_percentiles": { "P50": 10, "P70": 12, "P90": 15 },
  "result_distribution": [{ "x": 10, "count": 123 }],
  "samples_count": 30
}
```

`result_distribution` contient des buckets `{ x, count }`:
- `x`: valeur simulee (semaines ou items selon le mode)
- `count`: frequence observee dans les simulations

### Interpretation metier

- mode `backlog_to_weeks`:
  - question: "en combien de semaines terminer le backlog ?"
  - lecture des probabilites: `P(X <= semaines)`
- mode `weeks_to_items`:
  - question: "combien d'items livrer en N semaines ?"
  - en UI, la courbe de probabilite est affichee en `P(X >= items)` (probabilite d'atteindre au moins X items)

---

## Tests et coverage

Depuis la racine:

```bash
.venv\Scripts\python.exe -m pytest --cov=backend --cov-report=term-missing -q
```

Frontend:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test:unit:coverage
npm --prefix frontend run test:e2e:coverage:console
```

Suite E2E decoupee:
- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/selection.spec.js`
- `frontend/tests/e2e/simulation.spec.js`
- `frontend/tests/e2e/coverage.spec.js` (seuils Istanbul)

---

## Bonnes pratiques

- Ne pas commiter de secrets (PAT, tokens, cles privees)
- Verifier avant commit:

```bash
python Scripts/check_no_secrets.py
```
