# Architecture

## Vue d'ensemble

Monte Carlo Azure suit une architecture a frontiere d'identite stricte:

- le frontend appelle Azure DevOps directement depuis le navigateur
- le backend FastAPI ne recoit que des donnees anonymisees de throughput pour calculer les simulations
- le PAT Azure DevOps n'est jamais transmis au backend

## Invariants de securite

Le SLA identite est non negociable:

- 0 donnee d'identification Azure DevOps (`PAT`, `UUID`, `ORG`, `Team`) ne doit transiter par un serveur applicatif
- le cookie `IDMontecarlo` ne doit jamais etre envoye vers `https://dev.azure.com` ni `https://app.vssps.visualstudio.com`
- les appels Azure DevOps partent directement du navigateur vers:
  - `https://dev.azure.com`
  - `https://app.vssps.visualstudio.com`

Controles associes:

- CI execute `python Scripts/check_identity_boundary.py`
- toute proxyfication serveur (`/ado`, `/vssps`) ou resolution locale de PAT fait echouer la CI

Le backend ne recoit que:

- `throughput_samples`
- les parametres de simulation (`mode`, `backlog_size` / `target_weeks`, `n_sims`)

Garde-fous serveur:

- rate limiting distribue sur `POST /simulate` via Redis + slowapi
- niveau de logs applicatifs reduit (`warning`)
- logs d'acces HTTP desactives

## Structure du code

```text
frontend/
  src/
    adoClient.ts        # appels directs Azure DevOps
    api.ts              # appel backend /simulate uniquement
    hooks/
      useOnboarding.ts  # PAT en state local
      useSimulation.ts             # orchestrateur simulation
      useSimulationPrefs.ts        # persistance localStorage des preferences
      useSimulationHistory.ts      # historique local (10 dernieres simulations)
      useSimulationChartData.ts    # mapping/useMemo des donnees graphiques
      useSimulationAutoRun.ts      # auto-run avec debounce (entree via objet params)
      useSimulationQuickFilters.ts # persistance des quick filters simulation
      useTeamOptions.ts            # chargement options equipe (types + etats)
      usePortfolio.ts              # logique mode portefeuille
      usePortfolioReport.ts        # generation rapport portefeuille
    components/steps/
      SimulationChartTabs.tsx      # tabs + rendu des charts Recharts
      simulationPrintReport.tsx    # rapport imprimable
      simulationChartsSvg.ts       # rendu SVG des graphiques exportes
      simulationPdfDownload.ts     # telechargement PDF

backend/
  api.py                 # FastAPI + CORS + /simulate + /health
  api_routes_simulate.py # endpoint /simulate
  api_models.py          # SimulateRequest / SimulateResponse
  mc_core.py             # coeur Monte Carlo
```

## API

Routes exposees:

- `GET /health`
- `POST /simulate`
- `GET /simulations/history`
- CORS autorise: `GET`, `POST`, `OPTIONS`

Swagger:

- `/docs`

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
  "risk_score": 0.5,
  "result_distribution": [{ "x": 10, "count": 123 }],
  "samples_count": 30
}
```

Le backend persiste aussi la simulation dans MongoDB (collection `simulations`) quand le cookie `IDMontecarlo` est present.

### Historique client `GET /simulations/history`

- le cookie `IDMontecarlo` est lu cote backend
- reponse: jusqu'a 10 simulations recentes du client

`result_distribution` contient des buckets `{ x, count }`:

- `x`: valeur simulee (semaines ou items selon le mode)
- `count`: frequence observee dans les simulations

### Interpretation metier

- mode `backlog_to_weeks`
  - question: "en combien de semaines terminer le backlog ?"
  - lecture: `P(X <= semaines)`
  - formule `risk_score`: `(P90 - P50) / P50`
- mode `weeks_to_items`
  - question: "combien d'items livrer en N semaines ?"
  - en UI, la courbe est affichee en `P(X >= items)`
  - formule `risk_score`: `(P50 - P90) / P50`

## Qualite technique

CI GitHub Actions:

- job `backend-tests`
  - MongoDB reel (`mongo:7`)
  - `python -m ruff check .`
  - `python Scripts/check_dod_compliance.py`
  - `python Scripts/check_identity_boundary.py`
  - `python -m pytest --cov=backend --cov-fail-under=80 -q`
- job `frontend-tests`
  - `npm ci`
  - `npm run lint -- --max-warnings 0`
  - `npm run test:unit:coverage`
  - `npm run test:e2e`
  - `npm run build`
- job `docker-smoke`
  - build image
  - smoke tests `/health` et `/health/mongo`
  - verification de persistance via `/simulate` puis `/simulations/history`

## Notes d'implementation recentes

Frontend:

- ecran simulation charge en lazy (`React.lazy`)
- erreurs Azure DevOps unifiees via `src/adoErrors.ts`
- quick filters persistants par scope `org::project::team`
- mode portefeuille avec rapport PDF multi-scenarios
- generation de rapport parallelisee avec tolerance aux echecs partiels

Backend/tests:

- backend FastAPI aligne Ruff/isort
- tests et conformite repo durcis autour de `pytest`
