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
- CI execute `python Scripts/check_naming_convention.py`
- toute proxyfication serveur (`/ado`, `/vssps`) ou resolution locale de PAT fait echouer la CI

Le backend ne recoit que:

- `throughput_samples`
- `include_zero_weeks`
- les parametres de simulation (`mode`, `backlog_size` / `target_weeks`, `n_sims`)
- un cookie anonyme `IDMontecarlo` pour relier un historique statistique non contextualise

Invariants de preparation du throughput cote frontend:

- l'historique Azure DevOps est regroupe par semaines ISO du lundi au dimanche
- seules les semaines completes, entierement incluses dans la plage demandee, sont conservees
- la semaine courante est exclue tant qu'elle n'est pas entierement ecoulee
- les chaines `YYYY-MM-DD` sont traitees comme dates locales (`src/date.ts`) pour eviter toute derive UTC d'un jour

Garde-fous serveur:

- rate limiting sur `POST /simulate` via `slowapi`
- stockage `memory://` en developpement local mono-processus
- stockage Redis en production multi-workers pour partager le compteur entre processus
- mode permissif si Redis devient indisponible, avec log applicatif au niveau `warning`
- niveau de logs applicatifs reduit (`warning`)
- logs d'acces HTTP desactives

## Structure du code

```text
frontend/
  src/
    adoClient.ts        # appels directs Azure DevOps
    api.ts              # appel backend /simulate uniquement
    apiHelpers.ts       # normalisation/fallbacks API hors wrapper vital
    AppFlowContent.tsx  # rendu des etapes onboarding/simulation
    appNavigation.ts    # navigation/backspace et helpers de retour
    appShellSections.tsx # sections shell, mode public et stepper
    appTheme.ts         # resolution/persistance du theme
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
      simulationForecastService.ts # facade forecast exposee au reste du front
      simulationForecastCore.ts    # logique forecast extraite et testee
    utils/
      cycleTime.ts        # calcul et tendances du cycle time cote frontend
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

## Convention de nommage

Regle repo:

- tous les identifiants de code sont en anglais: variables, fonctions, types, props, cles d'objet et constantes
- toutes les chaines affichees a l'utilisateur restent en francais: libelles UI, messages, textes de rapport, erreurs metier

Objectif:

- eviter les identifiants mixtes francais/anglais dans une meme zone du code
- garder une separation nette entre langage d'implementation et langage produit

Controle:

- CI et pre-commit executent `python Scripts/check_naming_convention.py`
- le controle bloque les termes francais deja identifies comme dette dans les identifiants de code

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

Le contrat interdit tout champ de contexte Azure DevOps (`PAT`, `server_url`, organisation, projet, equipe, plage de dates, types, etats `Done`).

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
Les champs autorises en base sont:

- `mc_client_id`
- `created_at`
- `last_seen`
- `mode`
- `backlog_size`
- `target_weeks`
- `n_sims`
- `samples_count`
- `percentiles`
- `distribution`
- `throughput_reliability`
- `include_zero_weeks`

### Historique client `GET /simulations/history`

- le cookie `IDMontecarlo` est lu cote backend
- reponse: jusqu'a 10 simulations recentes du client, limitees aux donnees statistiques anonymes
- aucun champ Azure DevOps historique n'est reexpose, y compris pour d'anciens documents Mongo

### Historique frontend local

- `useSimulationHistory.ts` lit et ecrit uniquement `localStorage`
- l'historique detaille reste contextualise par equipe dans le navigateur
- le frontend ne recharge plus l'historique Mongo pour le melanger a cet historique local

`result_distribution` contient des buckets `{ x, count }`:

- `x`: valeur simulee (semaines ou items selon le mode)
- `count`: frequence observee dans les simulations

### Interpretation metier

- mode `backlog_to_weeks`
  - question: "en combien de semaines terminer le backlog ?"
  - lecture: `P(X <= semaines)`
  - percentiles API: quantile empirique discret conservateur `higher`
  - ordre attendu: `P50 <= P70 <= P90`
  - exemple de lecture: `P90 = 90%` des simulations finissent en `P90` semaines ou moins
  - formule `risk_score`: `(P90 - P50) / P50`
- mode `weeks_to_items`
  - question: "combien d'items livrer en N semaines ?"
  - percentiles API: quantile de survie discret `lower`
  - niveaux utilises: `P90 -> q10`, `P70 -> q30`, `P50 -> q50`
  - ordre attendu: `P50 >= P70 >= P90`
  - lecture percentiles et courbe UI: `P(X >= items)`
  - compatibilite historique: le frontend ne recalcule depuis l'histogramme que pour
    d'anciennes reponses detectees par l'ordre legacy `P50 <= P70 <= P90`
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
  - `actions/setup-python@v6` (`python-version: "3.12"`)
  - `npm ci`
  - `pip install -r ../requirements.txt` pour demarrer `run_app.py` pendant les E2E Playwright
  - `npm run lint -- --max-warnings 0`
  - `npm run test:unit:coverage`
  - `npm run test:e2e`
  - `npm run build`
- job `docker-smoke`
  - build image
  - smoke tests `/health` et `/health/mongo`
  - payload `/simulate` strictement aligne sur le contrat statistique courant, sans champ legacy refuse
  - verification de persistance via `/simulate` puis `/simulations/history`
  - verification du `429` au-dela du seuil de `POST /simulate`

## Notes d'implementation recentes

Frontend:

- ecran simulation charge en lazy (`React.lazy`)
- erreurs Azure DevOps unifiees via `src/adoErrors.ts`
- orchestration App allegée via `src/AppFlowContent.tsx`, `src/appNavigation.ts`, `src/appShellSections.tsx` et `src/appTheme.ts`
- facade API allegee via `src/apiHelpers.ts` pour conserver des perimetres vitals plus stables
- logique forecast scindee entre facade `src/hooks/simulationForecastService.ts` et coeur `src/hooks/simulationForecastCore.ts`
- calcul du cycle time extrait dans `src/utils/cycleTime.ts` avec couverture unitaire ciblee
- quick filters persistants par scope `org::project::team`
- mode portefeuille avec rapport PDF multi-scenarios
- generation de rapport parallelisee avec tolerance aux echecs partiels
- mocks E2E Playwright elargis pour couvrir aussi `/simulations/history` et les revisions de work items

Backend/tests:

- backend FastAPI aligne Ruff/isort
- tests et conformite repo durcis autour de `pytest`
