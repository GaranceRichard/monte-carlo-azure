# Architecture

## Vue d’ensemble

Monte Carlo Azure suit une architecture à frontière d’identité stricte :

- le frontend appelle Azure DevOps directement depuis le navigateur ;
- le backend FastAPI ne reçoit que des données anonymisées de throughput pour calculer les simulations ;
- le PAT Azure DevOps n’est jamais transmis au backend.

## Invariants de sécurité

Le SLA identité est non négociable :

- les données Azure DevOps peuvent exister dans le navigateur pour les appels directs à Azure DevOps ;
- elles sont interdites dans le payload `POST /simulate`, les modèles backend, les routes backend, la
  persistance Mongo, les réponses `GET /simulations/history` et tout proxy ou relais serveur ;
- le cookie `IDMontecarlo` et le champ `mc_client_id` restent autorisés car ils sont générés indépendamment
  d’Azure DevOps et ne contiennent ni organisation, ni projet, ni équipe ;
- la politique ne bloque pas « tous les UUID » : elle bloque les données d’identité Azure DevOps et les
  secrets associés quand ils franchissent la frontière serveur ;
- le cookie `IDMontecarlo` ne doit jamais être envoyé vers `https://dev.azure.com` ni
  `https://app.vssps.visualstudio.com` ;
- les appels Azure DevOps partent directement du navigateur vers :
  - `https://dev.azure.com`
  - `https://app.vssps.visualstudio.com`
  - ou une URL Azure DevOps Server saisie localement dans le navigateur

Le backend ne reçoit que :

- `throughput_samples`
- `include_zero_weeks`
- les paramètres de simulation (`mode`, `backlog_size` / `target_weeks`, `n_sims`, `seed` optionnel) ;
- bornes de contrat avant calcul : `throughput_samples` entre `6` et `521` valeurs,
  `n_sims` entre `1_000` et `200_000`, `target_weeks` entre `1` et `521`,
  `backlog_size` entre `1` et `1_000_000`
- un cookie anonyme `IDMontecarlo` pour relier un historique statistique non contextualisé.

Champs explicitement interdits à la frontière backend/payload :

- `client_context`
- `selected_org`
- `selected_project`
- `selected_team`
- `organization_name`
- `project_name`
- `team_name`
- `pat`
- `ado_pat`
- `personal_access_token`
- `server_url`
- `azure_devops_url`
- `ado_server_url`

Règles bloquées par la CI :

- `IDENTITY-001`: aucun proxy local `/ado` ou `/vssps`
- `IDENTITY-002`: aucun endpoint local ou backend recevant un PAT Azure DevOps
- `IDENTITY-003`: les appels ADO du navigateur utilisent les URL officielles ou une URL on-premise saisie localement
- `IDENTITY-004`: `ForecastRequestPayload` et `SimulateRequest` ne contiennent aucun contexte Azure DevOps
- `IDENTITY-005`: `postSimulate` et les modules de construction du payload n'envoient aucun champ Azure DevOps
- `IDENTITY-006`: `SimulationStore` ne persiste aucun champ Azure DevOps
- `IDENTITY-007`: `SimulationHistoryItem` et `GET /simulations/history` n'exposent aucun contexte Azure DevOps
- `IDENTITY-008`: aucun code backend ne contacte `dev.azure.com`, `visualstudio.com` ou un serveur ADO fourni par le client

Chemins surveillés par `Scripts/check_identity_boundary.py` :

- `frontend/src/types.ts`
- `frontend/src/api.ts`
- `frontend/src/hooks/simulationForecastCore.ts`
- `frontend/src/hooks/simulationForecastService.ts`
- tout fichier `frontend/src/` qui construit un `ForecastRequestPayload` ou appelle `postSimulate`
- `backend/api_models.py`
- `backend/api_routes_simulate.py`
- `backend/simulation_store.py`
- tout fichier `backend/` pour détecter un appel réseau Azure DevOps côté serveur
- `frontend/vite.config.js`
- toute configuration proxy/Nginx ajoutée au dépôt

Exceptions explicitement autorisées :

- `selectedOrg` dans `useOnboarding.ts`
- `selectedProject` dans `ProjectStep.tsx`
- `selectedTeam` dans `TeamStep.tsx` et dans l'historique local navigateur
- `pat` dans `frontend/src/adoClient.ts` et dans le parcours local navigateur
- `serverUrl` dans le navigateur pour Azure DevOps Server
- les tests qui vérifient l’interdiction de ces champs
- la documentation qui explique cette politique

Contrôles associés :

- le gate central exécute `Scripts/check_identity_boundary.py` et
  `Scripts/check_naming_convention.py` avant les suites applicatives ;
- toute proxyfication serveur (`/ado`, `/vssps`), réintroduction d’un champ ADO dans `POST /simulate`,
  persistance Mongo contextuelle ou exposition via `/simulations/history` fait échouer le gate ;
- l’échec reste bloquant : aucun avertissement, aucun `continue-on-error`, aucun masquage du code de sortie.

Invariants de préparation du throughput côté frontend :

- l’historique Azure DevOps est regroupé par semaines ISO du lundi au dimanche ;
- seules les semaines complètes, entièrement incluses dans la plage demandée, sont conservées ;
- la semaine courante est exclue tant qu’elle n’est pas entièrement écoulée ;
- les chaînes `YYYY-MM-DD` sont traitées comme dates locales (`src/date.ts`) pour éviter toute dérive UTC
  d’un jour.

Garde-fous serveur :

- rate limiting sur `POST /simulate` via `slowapi`
- stockage `memory://` en développement local mono-processus
- stockage Redis en production multi-workers pour partager le compteur entre processus
- mode permissif si Redis devient indisponible, avec log applicatif au niveau `warning`
- niveau de logs applicatifs réduit (`warning`)
- logs d’accès HTTP désactivés

## Structure du code

```text
frontend/
  src/
    adoClient.ts        # appels directs Azure DevOps
    api.ts              # appel backend /simulate uniquement
    apiHelpers.ts       # normalisation/fallbacks API hors wrapper vital
    AppFlowContent.tsx  # rendu des étapes onboarding/simulation
    appNavigation.ts    # navigation/backspace et helpers de retour
    appShellSections.tsx # sections shell, mode public et stepper
    appTheme.ts         # résolution/persistance du thème
    runtime.ts          # détection des modes standard, démo et connexion publique
    hooks/
      useOnboarding.ts  # PAT en state local
      useSimulation.ts             # orchestrateur, invalidation et rechargement par signature
      useSimulationPrefs.ts        # persistance localStorage des préférences
      useSimulationHistory.ts      # historique local versionné + migration legacy
      useSimulationChartData.ts    # mapping/useMemo des données graphiques
      useSimulationQuickFilters.ts # persistance des quick filters simulation
      useTeamOptions.ts            # chargement options équipe (types + états)
      usePortfolio.ts              # logique mode portefeuille
      usePortfolioReport.ts        # génération rapport portefeuille
      simulationForecastService.ts # façade forecast exposée au reste du front
      simulationForecastCore.ts    # logique forecast extraite et testée
    utils/
      cycleTime.ts        # calcul et tendances du cycle time en jours calendaires
      portfolioComparisonDiagnostic.ts # diagnostic métier comparatif des scénarios portefeuille
      portfolioComparisonPresentation.ts # libellés et formulations partagés UI/PDF
      simulationSignature.ts # signature canonique et sélection du cache local réutilisable
    components/steps/
      SimulationChartTabs.tsx      # tabs + rendu des charts Recharts
      simulationPrintReport.tsx    # rapport imprimable
      simulationChartsSvg.ts       # rendu SVG des graphiques exportés
      simulationPdfDownload.ts     # téléchargement PDF

backend/
  api.py                 # FastAPI + CORS + /simulate + /health
  api_routes_simulate.py # endpoint /simulate
  api_models.py          # SimulateRequest / SimulateResponse
  mc_core.py             # cœur Monte Carlo
```

## Convention de nommage

Règle du dépôt :

- tous les identifiants de code sont en anglais : variables, fonctions, types, props, clés d’objet et
  constantes ;
- toutes les chaînes affichées à l’utilisateur restent en français : libellés UI, messages, textes de
  rapport et erreurs métier.

Objectif :

- éviter les identifiants mixtes français/anglais dans une même zone du code ;
- garder une séparation nette entre langage d’implémentation et langage produit.

Contrôle :

- le plan central de `Scripts/quality_gate.py` exécute `Scripts/check_naming_convention.py` une seule fois ;
- le pré-commit l’exécute sur l’instantané de l’index Git, le pré-push sur le commit dans son worktree
  détaché, et la CI sur son checkout ;
- le contrôle bloque les termes français déjà identifiés comme dette dans les identifiants de code.

## API

Routes exposées :

- `GET /health`
- `POST /simulate`
- `GET /simulations/history`
- CORS autorisé : `GET`, `POST`, `OPTIONS`

Swagger :

- `/docs`

### Requête `POST /simulate`

```json
{
  "throughput_samples": [3, 5, 2, 4, 6, 3],
  "mode": "backlog_to_weeks",
  "backlog_size": 120,
  "n_sims": 20000,
  "seed": 123456
}
```

Le contrat interdit tout champ de contexte Azure DevOps (`PAT`, `server_url`, organisation, projet, équipe,
plage de dates, types, états `Done`).

ou

```json
{
  "throughput_samples": [3, 5, 2, 4, 6, 3],
  "mode": "weeks_to_items",
  "target_weeks": 12,
  "n_sims": 20000,
  "seed": 123456
}
```

### Réponse `POST /simulate`

```json
{
  "result_kind": "weeks",
  "result_percentiles": { "P50": 10, "P70": 12, "P90": 15 },
  "risk_score": 0.5,
  "result_distribution": [{ "x": 10, "count": 123 }],
  "completion_summary": {
    "completed_count": 18000,
    "censored_count": 2000,
    "censored_rate": 0.1,
    "horizon_weeks": 521
  },
  "samples_count": 30,
  "seed": 123456
}
```

Comportement du `seed` :

- `seed` est optionnel et borné à l’intervalle entier `0..4294967295` ;
- à payload identique, un même `seed` reproduit strictement la même simulation ;
- si aucun `seed` n’est fourni, le backend en génère un et le renvoie pour rendre le tirage rejouable ;
- côté backend, ce même tirage est exécuté par lots avec un unique générateur pseudo-aléatoire ;
  il n’y a ni réensemencement inter-lots, ni allocation complète `n_sims x horizon`.

Le backend persiste aussi la simulation dans MongoDB (collection `simulations`) quand le cookie
`IDMontecarlo` est présent. Les champs autorisés en base sont :

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
- `completion_summary`
- `throughput_reliability`
- `include_zero_weeks`
- `seed`

### Historique client `GET /simulations/history`

- le cookie `IDMontecarlo` est lu côté backend ;
- réponse : jusqu’à 10 simulations récentes du client, limitées aux données statistiques anonymes ;
- aucun champ Azure DevOps historique n’est réexposé, y compris pour d’anciens documents Mongo.

### Historique frontend local

- `useSimulationHistory.ts` lit et écrit uniquement `localStorage` ;
- l’historique détaillé reste contextualisé par équipe dans le navigateur ;
- le frontend ne recharge plus l’historique Mongo pour le mélanger à cet historique local ;
- les entrées locales portent un `schemaVersion` explicite ;
- les nouvelles entrées locales portent aussi la `seed` effectivement utilisée par l’exécution
  Monte Carlo frontend ou backend
- un rejeu local réapplique cette même `seed` tant que les paramètres de simulation ne changent pas ;
- la version courante migre les anciennes entrées sans version en interprétant leurs
  anciennes valeurs `Cycle Time` comme des semaines legacy à convertir en jours calendaires ;
- les historiques legacy sans `seed` restent compatibles ; ils sont restaurés avec `seed = null` ;
- la migration est idempotente : seules les entrées legacy sans version sont multipliées par `7` ;
- cette migration ne modifie ni le throughput hebdomadaire, ni les modes Monte Carlo en semaines,
  ni `target_weeks`

`result_distribution` contient des buckets `{ x, count }` :

- `x` : valeur simulée (semaines ou items selon le mode)
- `count` : fréquence observée dans les simulations

En `backlog_to_weeks`, `completion_summary` peut aussi être présent :

- `completed_count` : nombre de simulations terminées avant ou à l’horizon
- `censored_count` : nombre de simulations non terminées à l’horizon
- `censored_rate` : ratio `censored_count / total`
- `horizon_weeks` : horizon maximal de simulation

### Interprétation métier

- mode `backlog_to_weeks`
  - question : « en combien de semaines terminer le backlog ? »
  - lecture : `P(X <= semaines)`
  - percentiles API : quantile empirique discret conservateur `higher`
  - ordre attendu : `P50 <= P70 <= P90`
  - exemple de lecture : `P90 = 90%` des simulations finissent en `P90` semaines ou moins
  - le rang d’un percentile est calculé sur la population totale `n_sims`, pas seulement
    sur les simulations terminées
  - une simulation non terminée à l’horizon est comptée comme censure explicite
  - une fin exacte à l’horizon reste une vraie fin, distincte d’une censure
  - la distribution et les percentiles ne couvrent que les simulations terminées
  - un percentile absent signifie qu’il n’est pas identifiable avant l’horizon
  - la courbe de probabilité UI utilise `n_sims` comme dénominateur et reste bornée
    par le taux réel de complétion
  - `risk_score` est absent si `P50` ou `P90` manque
  - formule `risk_score` : `(P90 - P50) / P50`
- mode `weeks_to_items`
  - question : « combien d’items livrer en N semaines ? »
  - percentiles API : quantile de survie discret `lower`
  - niveaux utilisés : `P90 -> q10`, `P70 -> q30`, `P50 -> q50`
  - ordre attendu : `P50 >= P70 >= P90`
  - lecture percentiles et courbe UI : `P(X >= items)`
  - compatibilité historique : le frontend ne recalcule depuis l’histogramme que pour
    d’anciennes réponses détectées par l’ordre legacy `P50 <= P70 <= P90`
  - `risk_score` est absent si `P50` ou `P90` manque
  - formule `risk_score` : `(P50 - P90) / P50`

## Qualité technique

La sélection des contrôles est centralisée dans `Scripts/quality_gate.py` :

- `targeted` exécute les contrôles généraux et les tests directs identifiables ;
- `impacted` ajoute les contrôles du domaine et les dépendances proches ;
- `massive` exécute le plan complet ; tout chemin inconnu ou ambigu utilise ce niveau.

Les sources de changement sont distinctes : index Git pour le pré-commit, commits introduits pour le
pré-push, checkout de travail pour la CI. Le pré-push valide chaque SHA terminal distinct dans un worktree
détaché temporaire et n’utilise pas le workspace courant.

CI GitHub Actions :

- job unique `quality-gate` avec service MongoDB réel (`mongo:7`) ;
- installation explicite de Python, Node.js, des dépendances et de Chromium ;
- exécution de `python Scripts/quality_gate.py ci` ;
- plan massif ordonné : contrôles de dépôt et de sécurité, Ruff, ESLint, TypeScript, couvertures backend et
  frontend, build, E2E, puis smoke test Docker ;
- les suites avec couverture remplacent leurs suites simples équivalentes afin d’éviter une double
  exécution de Pytest ou Vitest ;
- smoke tests `/health`, `/health/mongo`, `/simulate`, `/simulations/history` et limitation `429`.

Les seuils E2E de 80 % sur `statements`, `branches`, `functions` et `lines` sont appliqués à partir de
`frontend/coverage/e2e-coverage-summary.json`. Le validateur vérifie également l’identité du run, les
timestamps, le périmètre, son fingerprint, la fraîcheur et la cohérence des métriques. Les artefacts
backend, frontend et E2E alimentent une agrégation Vitals unique, ensuite réutilisée par la conformité.

## Notes d’implémentation récentes

Frontend :

- écran simulation chargé en lazy (`React.lazy`)
- erreurs Azure DevOps unifiées via `src/adoErrors.ts`
- orchestration App allégée via `src/AppFlowContent.tsx`, `src/appNavigation.ts`,
  `src/appShellSections.tsx` et `src/appTheme.ts`
- façade API allégée via `src/apiHelpers.ts` pour conserver des périmètres Vitals plus stables
- logique forecast scindée entre façade `src/hooks/simulationForecastService.ts` et cœur
  `src/hooks/simulationForecastCore.ts`
- moteur Monte Carlo frontend et scénarios portefeuille désormais pilotés par une `seed`
  explicite unique par exécution logique, sans `Math.random()` dans les calculs de simulation
- calcul du cycle time extrait dans `src/utils/cycleTime.ts` avec couverture unitaire ciblée,
  en jours calendaires pour les restitutions frontend
- quick filters persistants par scope `org::project::team`
- mode portefeuille avec rapport PDF multi-scénarios
- diagnostic comparatif portefeuille pur : qualité historique, stabilité simulée et crédibilité des hypothèses
  restent séparées ; le rapport PDF le restitue sur une page dédiée, sans afficher le diagnostic détaillé
  dans l’UI
- référence de pilotage facultative conservée comme choix de présentation et de gouvernance, hors du
  diagnostic métier et sans effet sur `preferredScenario` ou les calculs
- mise en page de la comparaison PDF pilotée par un curseur vertical explicite et des sauts de page calculés
- génération de rapport parallélisée avec tolérance aux échecs partiels
- mocks E2E Playwright élargis pour couvrir aussi `/simulations/history` et les révisions de work items

Backend/tests :

- backend FastAPI aligné Ruff/isort
- tests et conformité du dépôt durcis autour de `pytest`
