# Registre des autorités des données structurantes

## Statut et portée

Ce registre décrit les autorités exécutées du produit, établi le 20 août 2026 au commit
`661720f038f2d1136517cceaca435097df77fc97` puis tenu à jour lors de leurs basculements atomiques. Le PBI 7.21
a transféré les événements SD-07 au domaine delivery le 23 août 2026 ; le PBI 7.22 y a ajouté l’autorité de
leur fenêtre historique le 26 août 2026. Il prolonge les cartographies factuelles
[`frontend`](frontend-responsibilities-map.md) et [`backend`](backend-responsibilities-map.md) sans décider
d'une architecture cible. Aucun producteur, consommateur, import, mapper, modèle, contrat statistique ou flux
n'est modifié par ce document.

Une donnée est auditée ici lorsqu'elle remplit au moins un des critères suivants : elle traverse une frontière
HTTP ou de stockage, elle est partagée entre plusieurs modules produit, elle choisit un chemin d'exécution, ou
elle porte un invariant métier, statistique, d'identité ou de configuration. Les props locales, états visuels
éphémères, points de tooltip et autres formes confinées à un seul composant de présentation ne sont pas des
données structurantes dans ce registre. Les artefacts de preuve et de gouvernance qualité conservent leurs
autorités spécialisées décrites dans la [carte de l'infrastructure qualité](quality-infrastructure-responsibilities-map.md).

Dans ce registre, l'**autorité actuelle** est l'unique propriétaire qui définit la signification, la forme ou
les invariants de la donnée dans son périmètre. Un producteur, un DTO de frontière, un mapper, un validateur de
sortie, une sérialisation ou un modèle de présentation peut répéter cette forme pour l'adapter ou la contrôler ;
il ne devient pas pour autant une seconde autorité. Toute répétition qui peut diverger est néanmoins conservée
dans la colonne `Ambiguïté` et détaillée plus bas.

## Registre vérifié

| ID | Donnée structurante | Autorité actuelle unique | Producteurs réels | Consommateurs réels | Transformation explicite | Ambiguïté |
| --- | --- | --- | --- | --- | --- | --- |
| SD-01 | Mode public et capacités du runtime frontend | `frontend/src/runtime.ts` : `PublicAppMode`, `AppRuntime`, `resolveAppRuntime` | `VITE_GITHUB_PAGES` et paramètres `demo`/`connect` de l'URL | `App`, `AppFlowContent`, `renderPublicMode` et `PublicModeGate` | flags d'environnement + query string → `standard`, `demo` ou `connect` et booléens dérivés | A-01 |
| SD-02 | Étape de navigation applicative | `frontend/src/types.ts` : `AppStep` | transitions de `useOnboarding` | `App`, `AppFlowContent`, `appNavigation`, `appShellSections`, `useSimulation`, `useTeamOptions` et filtres | actions de navigation → valeur d'étape ; `OnboardingStepTarget` en extrait les quatre retours autorisés | A-01 |
| SD-03 | État de session et view model d'onboarding | `frontend/src/hooks/useOnboarding.ts` : `OnboardingState`, `OnboardingActions`, `OnboardingViewModel` | saisies utilisateur, `adoPlatform`, `adoClient` et `demoData` | `App` et composants `PatStep`, `OrgStep`, `ProjectStep`, `TeamStep` | PAT/URL saisis → session mémoire, cible, entités sélectionnées, erreurs et étape ; le PAT n'est pas persisté | aucune définition concurrente observée |
| SD-04 | Cible et adresse Azure DevOps | `frontend/src/adoPlatform.ts` : `AdoDeploymentTarget` et fonctions de normalisation/collection | URL Server/TFS saisie ou absence d'URL pour Cloud | `useOnboarding`, `adoClient` et `OrgStep` | URL libre → cible `cloud`/`onprem`, racine normalisée, collection et candidats | A-01 |
| SD-05 | Entité de découverte organisation/projet/équipe côté application | `frontend/src/types.ts` : `NamedEntity` | réponses de `adoClient` et `demoData` | `useOnboarding`, `usePortfolio`, vues de sélection, `teamSort` | DTO Azure DevOps `{id,name}` ou `{name}` → forme structurale interne puis tri | A-02 |
| SD-06 | Options de types et d'états d'une équipe | signature de retour de `frontend/src/adoClient.ts:getTeamOptionsDirect` | endpoints work item types/states Azure DevOps et `DEMO_TEAM_OPTIONS` | `useTeamOptions` et `usePortfolio` | listes techniques → types triés + `statesByType`; les hooks valident ensuite les raccourcis sélectionnés | A-03 |
| SD-07 | Événements delivery normalisés et fenêtre historique | `frontend/src/domain/delivery/` : `DeliveryEvent`, `DeliveryHistoryWindow` et leurs constructeurs | mapper `adapters/azure-devops/deliveryEventMappers.ts`, puis construction de la fenêtre par `getTeamDeliveryDataDirect` | sélection delivery, puis agrégation hebdomadaire de `adoClient.ts` et calcul de Cycle Time dans `utils/cycleTime.ts` | DTO work item/révision → faits UTC immuables ; bornes absolues `[début inclus, fin exclue]` → items livrés et faits de cycle de vie associés | aucune définition concurrente observée |
| SD-08 | Signification normative des entrées et résultats statistiques | `docs/standards/STD-STAT-001.md` | moteurs Python et TypeScript conformes au standard | API, historiques, UI, rapports et runners statistiques | distribution brute → percentiles, censure, Risk Score, fiabilité et histogramme selon les règles `STAT-PAR-*` | A-05 |
| SD-09 | Commande, primitives et résultat statistiques en mémoire TypeScript | module `frontend/src/domain/`, principalement `simulation.ts` et `simulationValueObjects.ts` | `localTeamForecast` par le contrat applicatif `TeamForecast`, mapper HTTP, mapper de stockage, moteur local et runner de corpus | moteur local, mapper HTTP, hooks, historique, diagnostics et runners | entrées inconnues → Value Objects/commande discriminée ; moteur ou DTO validé → `SimulationResult` immuable | A-05, A-06, A-07 |
| SD-10 | Contrat HTTP public de simulation et d'historique | `backend/api_models.py` : `SimulateRequest`, `SimulateResponse`, `SimulationHistoryItem` | FastAPI/Pydantic à l'entrée ; `result_to_response` et `persistence_row_to_history_item` à la sortie | route `POST /simulate`, route `GET /simulations/history`, OpenAPI et mappers frontend | JSON `snake_case` fermé ↔ DTO Pydantic ; les mappers traduisent vers/depuis les modèles de domaine | A-05, A-06, A-08 |
| SD-11 | Historique local de simulation en mémoire | `frontend/src/domain/simulationHistory.ts` : `SimulationHistoryEntry`, `SampleStats` | `localTeamForecast` avec le port injecté `FrontendClock`, exposé par l’API publique `application/team-forecast` | `useSimulation`, `useSimulationHistory`, signature/réutilisation, diagnostics et rapports | contexte + observations delivery + résultat + un instant injecté → entrée version 2 horodatée et identifiée | A-09 |
| SD-12 | Représentation persistée de l'historique local | frontière `frontend/src/storage/`, principalement `simulationHistoryDtos.ts` et `simulationHistoryMappers.ts` | `simulationHistoryModelToDto`, puis `useSimulationHistory` | `localStorage`, `parseSimulationHistory`, puis modèle SD-11 | modèle interne ↔ DTO version 2 ; ancien `cycleTime` en semaines → `cycleTimeDays` lors d'une lecture legacy | A-09 |
| SD-13 | Préférences de simulation persistées | `frontend/src/hooks/simulationTypes.ts` : `StoredSimulationPrefs` | `useSimulationPrefs` | `useSimulationPrefs` via `mc_simulation_prefs_v2` | état de contrôles → JSON ; lecture JSON best effort → valeurs initiales | A-04 |
| SD-14 | Raccourcis d'équipe et préférences portefeuille persistés | `frontend/src/storage.ts` : `StoredQuickFilters`, `StoredPortfolioPrefs` et clés associées | `useSimulationQuickFilters` et `usePortfolio` | `useTeamOptions` et `usePortfolio` | sélection contextualisée → JSON ; lecture filtre/déduplique ; `arrimageRate` legacy → `alignmentRate` | A-04 |
| SD-15 | Configuration d'une équipe du portefeuille | `frontend/src/hooks/usePortfolioReport.ts` : `TeamPortfolioConfig` | `usePortfolio` et `DEMO_PORTFOLIO_TEAM_CONFIGS` | `usePortfolioReport` | options équipe + sélections types/états → configuration transmise à la collecte et aux simulations | A-10 |
| SD-16 | Résultat d'un scénario portefeuille | `frontend/src/hooks/simulationTypes.ts` : `PortfolioScenarioResult` | `usePortfolioReport:toScenarioResult` | diagnostic comparatif et `portfolioPrintReport` | échantillons de scénario + résultat statistique → hypothèse, seed, percentiles, distribution et diagnostic | A-11 |
| SD-17 | Section d'équipe d'un rapport portefeuille | `frontend/src/hooks/usePortfolioReport.ts` : `PortfolioReportSection` | phase de simulation d'équipes de `usePortfolioReport` | `portfolioPrintReport` chargé dynamiquement | configuration + observations + résultat → section structurée de rapport | A-11 |
| SD-18 | Diagnostic comparatif portefeuille | `frontend/src/utils/portfolioComparisonDiagnostic.ts` : `PortfolioComparisonDiagnostic` | `buildPortfolioComparisonDiagnostic` | `usePortfolioReport`, présentation comparative et rapport portefeuille | observations d'équipes + stabilité des scénarios + semaines communes → faits, limites, risques et conclusion | A-11 |
| SD-19 | Identité pseudonyme du client navigateur | `frontend/src/clientId.ts` : `ensureMontecarloClientCookie` | cookie existant UUID v4 ou générateur navigateur/fallback | navigateur via `credentials: include`, puis routes backend comme clé opaque de partition | cookie → validation UUID v4 ; valeur absente/invalide → nouvel identifiant et cookie `SameSite=Strict` | A-12 |
| SD-20 | Configuration runtime du backend applicatif | `backend/api_config.py` : `ApiConfig`, parseurs et `get_api_config` | variables d'environnement `APP_*` avec défauts du module | `backend.api`, routes, limiteur et `SimulationStore` | chaînes d'environnement → valeurs typées/rabattues ; construction des objets globaux à l'import | A-12, A-13 |
| SD-21 | Commande, primitives et résultat statistiques en mémoire Python | module de domaine backend, principalement `backend/simulation_models.py`, `backend/simulation_value_objects.py` et `backend/simulation_limits.py` | mapper HTTP, runner de corpus et `simulation_service` | service/moteur, mapper de réponse, store et runner de corpus | DTO ou entrée normalisée → Value Objects/commande ; sortie moteur → résultat immuable validé | A-05, A-06, A-07 |
| SD-22 | Document de simulation MongoDB | `backend/simulation_store.py:_simulation_document` | `SimulationStore.save_simulation` depuis SD-21 et SD-19 | collection Mongo, projection `list_recent`, scrub et purge opératoires | commande + résultat + identité + UTC → dictionnaire Mongo minimisé ; les échantillons bruts et le contexte Azure DevOps sont omis | A-14 |
| SD-23 | Vue d'historique backend exposée | `backend/api_models.py:SimulationHistoryItem` | projection de `SimulationStore.list_recent`, puis `persistence_row_to_history_item` | FastAPI `GET /simulations/history` ; aucun consommateur produit frontend observé | document Mongo projeté → retrait identité/champs sensibles → dates ISO UTC → DTO public | A-08, A-14 |

## Transformations de bout en bout

| ID | Chaîne exécutée | Règle de transformation observée |
| --- | --- | --- |
| T-01 | URL publique → SD-01 → shell | `resolveAppRuntime` applique la priorité `demo`, puis `connect` sur Pages, puis le mode démo Pages. |
| T-02 | saisies onboarding → SD-04/SD-05/SD-06 | `adoPlatform` normalise la cible ; `adoClient` transforme les réponses Cloud ou Server/TFS en entités et options consommables. |
| T-03 | dates/types/états/équipe → SD-07 | `getCompleteWeekRange` conserve l’alignement existant ; le mapper Azure DevOps convertit work items et révisions en événements ; `DeliveryHistoryWindow` sélectionne les items livrés avant que `adoClient` regroupe leurs faits par lundi et que `calculateCycleTimeData` convertisse leurs paires début/fin en jours. |
| T-04 | SD-07 + critères + seed → SD-09 | `localTeamForecast` construit la commande TypeScript derrière le contrat `TeamForecast` ; les Value Objects filtrent éventuellement les zéros et appliquent les bornes existantes. |
| T-05 | SD-09 → SD-10 → SD-21 | `simulationCommandToDto` passe de `camelCase` à `snake_case`; Pydantic valide le transport ; `request_to_command` reconstruit la commande Python. |
| T-06 | SD-09 ou SD-21 → résultat statistique | les moteurs produisent la distribution brute ; leurs domaines dérivent et valident les résultats sous l'autorité SD-08. |
| T-07 | SD-21 → SD-10 → SD-09 | `result_to_response` sérialise ; `simulateResponseDtoToResult` ferme, transforme et revalide la réponse. |
| T-08 | SD-09 + contexte + `FrontendClock` → SD-11 → SD-12 | `localTeamForecast` lit un instant, le réutilise pour le timestamp et l’identité de repli, puis les mappers de stockage sérialisent, migrent les anciennes durées et refusent les résultats invalides. |
| T-09 | SD-21 + SD-19 → SD-22 → SD-23 | `_simulation_document` écrit ; `list_recent` projette/minimise ; le mapper construit le DTO public. |
| T-10 | SD-07 + SD-15 → SD-16/SD-17/SD-18 | `usePortfolioReport` collecte et simule en parallèle, construit les scénarios/sections puis le diagnostic avant le rendu PDF. |
| T-11 | environnement → SD-20 → API/store | `get_api_config` parse les variables et les objets globaux fournissent CORS, timeout, rate limit, cookie et paramètres Mongo. |

## Ambiguïtés et définitions concurrentes observées

Ces constats ne sont ni corrigés ni transformés en cible par ce PBI.

- **A-01 — alias locaux de valeurs partagées :** `appNavigation.ts` et `appShellSections.tsx` redéclarent
  `OnboardingStep`; ce dernier redéclare aussi `RuntimeMode` et `DeploymentTarget`. Les valeurs coïncident avec
  SD-01, SD-02 et SD-04, mais aucun import ne garantit leur concordance.
- **A-02 — typage structurel Azure DevOps :** `adoClient.ts` déclare ses propres `AdoOrg`, `AdoProject` et
  `AdoTeam`. Les hooks acceptent ces objets comme SD-05 par compatibilité structurelle, sans mapper explicite.
- **A-03 — option d'équipe orpheline :** `frontend/src/types.ts:TeamOptionResponse` inclut `doneStates` mais
  n'a aucun consommateur. La forme réellement produite est la signature de `getTeamOptionsDirect`, sans ce
  champ.
- **A-04 — politiques réparties entre stockage et hooks :** les DTO et clés résident dans SD-12 à SD-14,
  tandis que les hooks choisissent les limites, moments d'écriture, fallbacks et validations. Les flux
  simulation et portefeuille valident séparément des raccourcis de même forme.
- **A-05 — implémentations statistiques parallèles :** TypeScript, Python, DTO et schémas répètent des formes
  normatives. SD-08 reste l'autorité sémantique ; le corpus, la compatibilité et le profil `main` contrôlent
  ces implémentations. Le présent registre ne change aucune règle ni aucun seuil statistique.
- **A-06 — validation recouvrante :** Pydantic valide l'entrée avant que `SimulationCommand.create` reconstruise
  les mêmes Value Objects. Les DTO de réponse et mappers recalculent certaines valeurs attendues uniquement
  pour refuser une divergence ; ils ne produisent pas une nouvelle valeur métier.
- **A-07 — transformations statistiques encore distribuées :** le Value Object filtre les semaines nulles,
  alors que les cœurs conservent aussi une option de filtrage ; le service leur passe `true` après le filtrage.
  Le service calcule en outre percentiles, fiabilité, histogramme et complétion autour du moteur.
- **A-08 — miroir d'historique backend inactif :** `SimulationHistoryItemDto`,
  `ServerSimulationHistoryItem` et `simulationHistoryItemDtoToModel` existent côté frontend, mais aucun appel
  produit à `/simulations/history` n'est présent. Ils reflètent SD-23 sans participer au flux exécuté.
- **A-09 — version d'historique local répétée :** la valeur `2` apparaît dans le modèle SD-11, le DTO SD-12,
  le mapper et le contrôle de réutilisation. Le mapper est la seule transition de stockage exécutée, mais les
  littéraux ne sont pas dérivés d'une constante partagée.
- **A-10 — configuration portefeuille déclarée par son consommateur :** `demoData.ts` importe
  `TeamPortfolioConfig` depuis `usePortfolioReport.ts`, que `usePortfolio.ts` réexporte ensuite. L'autorité est
  unique mais placée dans le hook d'orchestration qui consomme la donnée.
- **A-11 — modèles de restitution dispersés :** scénarios, sections et diagnostics ont chacun l'autorité
  enregistrée en SD-16 à SD-18. Les composants et rapports recalculent encore certaines dérivations de
  présentation, notamment probabilités, légendes et diagnostics ; elles ne remplacent pas le résultat
  statistique SD-08/SD-09.
- **A-12 — nom du cookie non partagé :** SD-19 émet toujours `IDMontecarlo`; SD-20 permet au backend de lire
  un autre nom via `APP_CLIENT_COOKIE_NAME`, avec le même défaut. Une surcharge backend peut donc rompre la
  jonction. Le format UUID est imposé seulement par le navigateur ; le backend accepte toute valeur non vide.
- **A-13 — rétention concurrente hors `ApiConfig` :** le TTL du store vaut 30 jours, tandis que
  `purge_inactive_clients.py` lit directement `APP_PURGE_RETENTION_DAYS` (30 par défaut) et que
  `docs/deployment.md` illustre 90 jours. Ce sont deux politiques exécutables de cycle de vie, pas une seconde
  définition de la forme SD-22 ; aucune autorité transverse de rétention ne peut être affirmée aujourd'hui.
- **A-14 — persistance sans DTO dédié :** la forme SD-22 est construite directement dans le store ; le mapper
  nommé `persistence_row_to_history_item` ne traite que la projection vers SD-23. Les scripts de scrub et purge
  contournent le store avec leurs propres clients Mongo.

Les types de présentation locaux `ProbabilityPoint` sont aussi déclarés dans `hooks/probability.ts` et
`hooks/simulationTypes.ts`. Ils sont confinés au calcul de graphique et restent hors du périmètre structurant
défini plus haut ; la duplication demeure visible ici pour ne pas être masquée.

## Preuve d'unicité et méthode de revue

Le registre contient **23 données structurantes auditées**. Chacune possède exactement une cellule
`Autorité actuelle unique` et un propriétaire actuel vérifié dans le flux exécuté : **23 attributions
simples, 0 autorité absente, 0 donnée avec plusieurs autorités déclarées**. Les copies, validateurs et
politiques concurrentes observés sont séparés dans A-01 à A-14 ; cette séparation n'affirme pas qu'ils sont
déjà dérivés automatiquement ou qu'ils ne peuvent pas diverger.

La revue a été effectuée depuis les points d'entrée et non depuis les seuls noms de fichiers :

```powershell
rg --files frontend/src -g "*.ts" -g "*.tsx" -g "*.jsx" -g "!*.test.*"
rg -n "^import |^export .* from |import\(" frontend/src -g "!*.test.*"
rg -n "^(from backend|from \.)" backend Scripts/statistical_corpus_runner.py run_app.py
rg -n "^(export )?(interface|type|class)|^class |^@dataclass" frontend/src backend -g "!*.test.*"
rg -n "fetch|localStorage|document\.|request\.cookies|_simulation_document|SimulationStore" frontend/src backend
git diff --name-status 4bc9b01fce83682da3e7dbd79df898461a2437b4..HEAD -- frontend/src backend
```

Le basculement SD-07 est prouvé par les tests des événements, de la fenêtre historique, des mappers Azure
DevOps, du calcul de Cycle Time et du client Azure DevOps. Les anciennes sources de révisions et les
consommations directes des événements bruts ne traversent plus les calculs ; la forme hebdomadaire et les
points de Cycle Time restent des résultats dérivés destinés aux consommateurs existants.

La dernière commande constituait la preuve d’absence de migration du registre initial. Les tests existants de
modèles, mappers, routes, persistance, identité, domaine statistique et compatibilité restent les preuves
exécutables des autres chemins. Les transformations de semaine, période partielle, throughput, Cycle Time et
diagnostics prévues par 7.23 à 7.30 ne sont pas anticipées.
