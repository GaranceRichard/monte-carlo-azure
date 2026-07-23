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
- `IDENTITY-004`: `SimulateRequestDto` et `SimulateRequest` ne contiennent aucun contexte Azure DevOps
- `IDENTITY-005`: `postSimulate` et les modules de construction du payload n'envoient aucun champ Azure DevOps
- `IDENTITY-006`: `SimulationStore` ne persiste aucun champ Azure DevOps
- `IDENTITY-007`: `SimulationHistoryItem` et `GET /simulations/history` n'exposent aucun contexte Azure DevOps
- `IDENTITY-008`: aucun code backend ne contacte `dev.azure.com`, `visualstudio.com` ou un serveur ADO fourni par le client

Chemins surveillés par `Scripts/check_identity_boundary.py` :

- `frontend/src/types.ts`
- `frontend/src/api.ts`
- `frontend/src/api/simulationDtos.ts`
- `frontend/src/api/simulationMappers.ts`
- `frontend/src/hooks/simulationForecastCore.ts`
- `frontend/src/hooks/simulationForecastService.ts`
- tout fichier `frontend/src/` qui construit un `SimulateRequestDto` ou appelle `postSimulate`
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
    api.ts              # adaptateur HTTP /simulate et historique serveur
    api/
      simulationDtos.ts    # contrats JSON HTTP en snake_case
      simulationMappers.ts # conversions explicites HTTP <-> domaine
    domain/
      simulation.ts        # commande et résultat statistiques métier en camelCase
      simulationHistory.ts # historique interne contenant un SimulationResult
    storage/
      simulationHistoryDtos.ts    # schéma localStorage v2 inchangé
      simulationHistoryMappers.ts # conversions stockage/legacy <-> domaine
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
  api_routes_simulate.py # frontière HTTP, timeout, rate limit et persistance
  api_models.py          # DTO Pydantic HTTP uniquement
  simulation_mappers.py  # conversions DTO HTTP/persistance <-> domaine
  simulation_models.py   # modèles statistiques métier sans framework
  simulation_service.py  # orchestration statistique sans dépendance HTTP
  simulation_store.py    # frontière Mongo, document existant préservé
  mc_core.py             # cœur Monte Carlo
```

## Frontières de simulation

Les contrats externes et les modèles statistiques internes sont séparés par des mappers explicites :

- les DTO HTTP Python restent dans `backend/api_models.py` et les DTO HTTP TypeScript dans
  `frontend/src/api/simulationDtos.ts` ; leurs propriétés `snake_case` décrivent uniquement le JSON public ;
- `backend/simulation_models.py` et `frontend/src/domain/simulation.ts` portent les commandes et résultats
  métier ; le domaine TypeScript emploie exclusivement `camelCase` ;
- `backend/simulation_service.py` orchestre les fonctions existantes de `mc_core.py` sans importer Pydantic,
  FastAPI ou la persistance ;
- `frontend/src/utils/simulation.ts` reçoit et retourne les mêmes modèles métier que le chemin backend, sans
  importer les DTO HTTP ;
- `backend/simulation_store.py` convertit commande et résultat en document Mongo à sa frontière, tandis que
  `frontend/src/storage/simulationHistoryMappers.ts` convertit le modèle interne vers le schéma
  `localStorage` version 2 inchangé et prend en charge les migrations legacy existantes.

Flux backend :

```text
SimulationCommand
  -> mapper vers SimulateRequestDto
  -> POST /simulate
  -> SimulateRequest Pydantic
  -> mapper vers SimulationCommand Python
  -> simulation_service -> mc_core
  -> SimulationResult Python
  -> mapper vers SimulateResponse Pydantic
  -> SimulateResponseDto
  -> mapper vers SimulationResult TypeScript
```

Flux local :

```text
SimulationCommand TypeScript
  -> moteur local TypeScript
  -> SimulationResult TypeScript
```

Après ces deux flux, les hooks, le portefeuille, l'UI, les graphiques et les exports consomment uniquement
`SimulationResult`. Les contrôles de maintenabilité bloquent les imports des DTO par le domaine, le moteur
local ou l'UI, ainsi que toute dépendance du service ou du store Python envers les DTO HTTP.

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

Le standard [`STD-TEST-001`](docs/standards/STD-TEST-001.md) définit la norme de classification, de qualité
et de pilotage des tests. Son versionnement constitue la référence normative de la stratégie de test ; il
n’implique pas que le dépôt satisfait déjà l’ensemble de ses exigences. Les conditions opérationnelles et
les exigences plus strictes de la [`Definition of Done`](docs/definition-of-done.md) restent applicables.
La lecture factuelle des risques, contrôles présents, preuves et lacunes résiduelles est maintenue dans la
[`matrice risques–contrôles`](docs/risk-control-matrix.md), sans que son existence vaille conformité complète
au standard.

Le contrat de classification est versionné dans
[`config/test-classification.json`](config/test-classification.json) et son schéma d'enregistrement Draft
2020-12 dans [`config/test-classification.schema.json`](config/test-classification.schema.json). Les domaines
stables reflètent les frontières du produit et de la chaîne qualité ; les règles d'interprétation sont
documentées dans [`docs/test-classification.md`](docs/test-classification.md).

`Scripts/classify_tests.py` orchestre deux collecteurs statiques : l’AST Python pour les cas Pytest et un
collecteur JavaScript séparé fondé sur le compilateur TypeScript installé pour Vitest et Playwright. Le moteur
applique les signaux versionnés de `config/test-classification-rules.json`, puis les seules exceptions exactes
et justifiées de `config/test-classification-overrides.json`. Il écrit l’inventaire trié
`reports/test-classification-inventory.json`; aucune horloge ni information d’environnement n’entre dans sa
sérialisation.

Le comptage du PBI 1.6 forme une couche séparée. Les hooks Pytest et les reporters Vitest/Playwright observent
les collections et résultats natifs, puis `Scripts/report_test_execution_counts.py` rattache chaque instance
à l'identité de l'inventaire. La classification décrit ce qu'est un cas logique ; la collecte décrit les
instances développées par les paramètres et projets ; l'exécution décrit les instances réellement tentées ;
les retries ajoutent des tentatives à la même instance. Le consolidateur ne redécouvre aucun test, refuse les
rattachements absents ou ambigus. Le rapport agrège aussi les quatre profils principaux.

Les artefacts natifs sous `reports/test-execution-native/` sont des entrées locales régénérables. Seul le
rapport déterministe `reports/test-execution-counts.json`, lié par SHA-256 à l'inventaire, est versionné.

Le PBI 1.9 ajoute une couche indépendante dans `config/test-governance.json`, avec son propre schéma Draft
2020-12. Elle cible les `logicalCaseId` sans enrichir ni surcharger la classification. Le détecteur statique
reconnaît les skips, désactivations, expected failures, quarantaines et retries des trois frameworks, ainsi que
les marqueurs inconnus et les retries globaux. Le validateur bloque les cas non gouvernés, les entrées
invalides, expirées ou orphelines, les tests critiques ignorés et les quarantaines critiques non compensées.

Les reporters Pytest, Vitest et Playwright conservent désormais la séquence des résultats par tentative, le
résultat initial et le résultat final. `Scripts/check_test_governance.py` rapproche ces preuves du contrat et
produit `reports/test-governance-report.json` avec nombres, détails, expirations et taux d'instabilité. La
commande `Test governance compliance` est construite une seule fois par plan et rattachée au nœud existant
`aggregate` ; aucun nœud ni seuil du DAG n'est supprimé ou contourné.

Le PBI 1.10 ajoute une consolidation au même nœud, sans faire du dénombrement son agrégateur général.
`Scripts/report_test_strategy.py` construit une fois un modèle pur à partir de l'inventaire, du plan, du
snapshot de dénombrement, de la gouvernance, des résultats de nœuds et des couvertures déjà produits. Les
adaptateurs de preuves sont séparés du résumé stratégique et des renderers ; JSON et Markdown reçoivent le
même modèle et ne relisent aucune source. Le modèle sépare `globalReference`, `profileExecution` et
`strategicCoverage`, ainsi que la conformité de la gate et la complétude de la preuve stratégique.

Le manifest conserve l'identité, l'empreinte et les états observables de chaque preuve. Son
`evidenceBundleId` est un hash déterministe du bundle, jamais un `runId` supposé commun. La fraîcheur E2E
réutilise le contrat existant ; l'absence d'identité temporelle équivalente pour Pytest et Vitest reste
explicitement non mesurable. L'agrégateur courant n'exige pas son propre résultat final, ce qui évite une
dépendance circulaire ; son succès est matérialisé après le reporting par le code de sortie du DAG et le job
CI. Les snapshots `reports/test-strategy-report.{json,md}` sont versionnés, tandis que leur upload CI atteste
une exécution distante donnée.

`Scripts/check_test_classification.py` redécouvre les cas et reconstruit l'inventaire en mémoire sans écrire
dans le workspace. Il valide le catalogue, le schéma, les règles, overrides et exemptions, compare la
sérialisation exacte au rapport versionné, impose `unresolved = 0` et vérifie l'empreinte du rapport
d'exécution. Les 16 ambiguïtés initiales sont résolues par l'analyse comportementale, sans override ni
exemption.

Le contrôle est un invariant commun construit une seule fois dans chaque plan de `Scripts/quality_gate.py` :
`fast` l'exécute sur le snapshot de l'index, `push` sur le worktree temporaire du commit détaché et les modes
d’automatisation sur le workspace. La task `Validation : profil main` appelle directement ce même gate avec
`ci --profile main` et exécute son DAG parallélisable.

Le contrat [`config/test-execution-profiles.json`](config/test-execution-profiles.json) est la source de
vérité du DAG. `Scripts/test_execution_profiles.py` valide les inclusions, identifiants, dépendances,
cycles, accessibilité, agrégateur final, conflits d’écriture et ressources exclusives, puis produit
`reports/test-execution-plan.json`. Les inclusions sont :

- `pr = pr` ;
- `main = pr + main` ;
- `nightly = pr + main + nightly` ;
- `release = pr + main + release`.

`Scripts/quality_gate_plan.py` traduit un mode en profil sans modifier la classification de portée, tandis
que `Scripts/quality_gate_dag.py` regroupe les commandes par nœud et exécute les branches prêtes en parallèle.
Chaque cas logique est affecté exactement une fois au nœud de son framework. Les artefacts intermédiaires
sont isolés sous `reports/test-execution-artifacts/<profil>/<nœud>/`. Les producteurs publient la racine
`reports/test-execution-artifacts` et `aggregate` fusionne les téléchargements dans cette même racine ;
`_promote_artifacts()` retrouve ainsi l’arborescence par profil et nœud avant consolidation.
Le smoke Docker utilise le port hôte isolé `18080`, distinct des ports `8000/4173` de la branche E2E.

La sélection des contrôles est centralisée dans `Scripts/quality_gate.py` :

- `targeted` exécute les contrôles généraux et les tests directs identifiables ;
- `impacted` ajoute les contrôles du domaine et les dépendances proches ;
- `massive` exécute le plan complet ; tout chemin inconnu ou ambigu utilise ce niveau.

Le même plan exécute le ratchet de maintenabilité. Il compare les métriques de taille et de complexité,
les cycles, les directions de dépendance documentées et le mojibake à une baseline versionnée. La dette
existante peut rester stable ou diminuer ; toute dette nouvelle ou aggravée bloque la gate. Les seules
directions imposées sont la séparation entre `frontend/src` et `backend` dans les deux sens. Les directions
internes entre métier, application, infrastructure et présentation ne sont pas assez définies pour devenir
des règles automatiques.

Les sources de changement sont distinctes : index Git pour le pré-commit, commits introduits pour le
pré-push, checkout de travail pour la CI. Le pré-push valide chaque SHA terminal distinct dans un worktree
détaché temporaire et n’utilise pas le workspace courant.

Le hook `.githooks/pre-commit` délègue à `Scripts/quality_gate.py fast`, dont le contrôle de dépôt appelle
`Scripts/pre_commit_guard.py`. Cette garde lit les entrées `A/M/D/R` de l'index réel : tout index non vide doit
contenir `README.md` racine avec un statut ajouté ou modifié. Un README imbriqué, supprimé, renommé ou modifié
seulement dans le worktree est refusé. L'index vide reste accepté afin que les validations de conformité sans
intention de commit puissent s'exécuter.

Pour toute validation isolée, l’environnement de commande commun fixe explicitement
`MONTECARLO_E2E_PYTHON` sur l’interpréteur Python hôte. Cette règle est appliquée de façon identique à la
séquence, aux branches parallèles du DAG et à l’exécution d’un nœud sélectionné, afin que le serveur
Playwright du worktree utilise les dépendances Python hôte.

Dans un worktree détaché, les dépendances frontend installées sont exposées par un lien symbolique. Si sa
création échoue sous Windows, la gate utilise une jonction `cmd.exe /c mklink /J` ; sous POSIX, l’erreur du
lien symbolique est propagée. La décision de plateforme est isolée derrière `_is_windows()` afin que les
tests couvrent les deux branches sans modifier globalement `os.name` ni le type de chemin natif de l’hôte.

Le même seam pilote le retry interne de suppression des fichiers read-only dans les répertoires temporaires
Pytest. Les branches `chmod`, nouvelle tentative, rejet POSIX et erreur incompatible sont testées avec des
doubles indépendants de l’hôte. Les deux tests du système de fichiers réel sont maintenant portables et ne
reposent plus sur un `skipif` de plateforme.

CI GitHub Actions :

- `pull_request` sélectionne `pr`, le push sur `main` sélectionne `main`, la planification sélectionne
  `nightly` et l’événement de release publié sélectionne `release` ;
- `preflight` précède six jobs frères réellement parallélisables, chacun appelant
  `python Scripts/quality_gate.py ci --profile ... --node ...` ;
- `aggregate` dépend de toutes les branches et `publish` dépend de `aggregate` uniquement pour un push
  sur `main` ;
- les actions JavaScript s’exécutent nativement sous Node 24 avec les versions verrouillées
  `actions/checkout@v6`, `actions/setup-python@v6`, `actions/setup-node@v6`,
  `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `docker/login-action@v4` et
  `docker/build-push-action@v7` ; aucun `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` n’est défini et la conformité
  bloque les versions antérieures comme la réintroduction du forçage ;
- les producteurs uploadent `reports/test-execution-artifacts` et `aggregate` télécharge avec
  `merge-multiple` dans ce même répertoire avant de promouvoir les preuves backend, Vitest et E2E ;
- installation explicite des dépendances utiles dans chaque runner et de Chromium dans le job E2E ;
- `backend-tests` configure Node 22 avec le cache npm et exécute `npm --prefix frontend ci` avant la gate,
  car la classification Pytest charge TypeScript et importe la configuration Playwright ; il ne télécharge
  aucun navigateur et conserve `preflight` comme unique dépendance ;
- `aggregate` configure aussi Node 22 avec le cache npm et exécute `npm --prefix frontend ci` avant son
  agrégateur : `Test governance compliance` redécouvre les tests Vitest et Playwright via TypeScript ;
- le smoke test Docker reste bloquant dans la branche `release-or-container-checks` des profils complets ;
- les suites avec couverture remplacent leurs suites simples équivalentes afin d’éviter une double
  exécution de Pytest ou Vitest ;
- smoke tests `/health`, `/health/mongo`, `/simulate`, `/simulations/history` et limitation `429`.

La couverture Python est pilotée par `.coveragerc` pour `backend/`, `Scripts/` et `run_app.py`, avec
branches actives. Le validateur exige au moins 80 % globalement et par fichier, aucune ligne exécutable
non couverte et aucun fichier Python exécutable versionné absent du rapport.

Les seuils E2E de 80 % sur `statements`, `branches`, `functions` et `lines` sont appliqués à partir de
`frontend/coverage/e2e-coverage-summary.json`. Le validateur vérifie également l’identité du run, les
timestamps, le périmètre, son fingerprint, la fraîcheur et la cohérence des métriques. Les artefacts
Python — pour sa portion backend —, frontend et E2E alimentent une agrégation Vitals unique, ensuite
réutilisée par la conformité.

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
