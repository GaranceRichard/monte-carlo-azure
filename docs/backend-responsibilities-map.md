# Cartographie des responsabilités backend et du cycle de vie des données

## Portée et méthode

Cette carte décrit l'état exécuté du backend au 13 août 2026, sur le commit
`4bc9b01fce83682da3e7dbd79df898461a2437b4`. Elle part des entrées HTTP et opératoires, suit les objets
réellement construits, puis attribue les calculs, sorties et états persistés aux modules qui les portent.
Elle ne prescrit ni architecture cible, ni extraction de port, ni correction.

Depuis le PBI 7.32, la seule évolution de ce périmètre factuel est explicitée ci-dessous : les timestamps de
persistance passent par `BackendClock`, son adaptateur `SystemUtcClock` et la composition API, sans modifier
le cycle MongoDB ni sa politique de rétention.

Les conclusions ont été recoupées contre :

- les décorateurs de routes et l'enregistrement FastAPI dans `backend/api.py`,
  `backend/api_routes_simulate.py` et `backend/api_static.py` ;
- les imports internes du package `backend`, puis les appels directs entre mappers, service, moteurs et store ;
- les consommateurs hors package dans `run_app.py`, `Dockerfile`, `Scripts/statistical_corpus_runner.py`,
  `Scripts/scrub_simulation_identity.py` et `Scripts/purge_inactive_clients.py` ;
- les tests des routes, modèles, mappers, service, moteur, persistance et frontières d'identité.

La préparation Azure DevOps, le moteur TypeScript, `localStorage`, React et les restitutions sont hors de la
frontière backend. Les scripts de preuve statistique ne sont mentionnés que lorsqu'ils appellent directement
le moteur Python ; leur orchestration qualité relève du PBI 7.3.

## Topologie d'exécution et points d'entrée

| Entrée | Composition et propriétaire exécuté | Effet ou sortie |
| --- | --- | --- |
| Image conteneur | `Dockerfile` lance `uvicorn backend.api:app` avec deux workers ; chaque processus importe sa propre configuration, son limiteur et son `SimulationStore` globaux. Le point de composition actuel dans `api_routes_simulate` injecte `SystemUtcClock` au store. | API sur le port 8000 et frontend compilé copié sous `frontend/dist`. |
| Lanceur local | `run_app.py:main` importe `backend.api:app`, vérifie le port, ouvre éventuellement le navigateur et lance Uvicorn avec un worker. | Même application FastAPI, avec logs d'accès désactivés par le lanceur. |
| Cycle FastAPI | `backend.api:lifespan` appelle `simulation_store.connect()`, `limiter.check_storage()`, puis `simulation_store.close()` à l'arrêt. | Connexion et index Mongo initialisés si Mongo est activé ; disponibilité initiale du stockage de rate limit observée. |
| `GET /health` | `backend.api:health` ne consulte aucun service. | `200 {"status":"ok"}`. |
| `GET /health/mongo` | `backend.api:health_mongo` lit `SimulationStore.enabled`, puis appelle `ping()`. | `disabled`, `ok`, ou `503 mongo_unreachable`. |
| `POST /simulate` | `backend.api_routes_simulate:simulate`, après middleware CORS et SlowAPI. | Résultat statistique HTTP ; persistance Mongo éventuellement planifiée en tâche de fond. |
| `GET /simulations/history` | `backend.api_routes_simulate:simulation_history`. | Historique statistique minimisé du client identifié par cookie, ou liste vide/`503`. |
| Documentation FastAPI | Routes générées par FastAPI : `/openapi.json`, `/docs`, `/docs/oauth2-redirect`, `/redoc`. | Schéma et interfaces de documentation HTTP. |
| Frontend statique conditionnel | `backend.api_static:mount_frontend` monte `StaticFiles` sur `/` et déclare aussi `GET /` seulement si `frontend/dist` existe. Le montage est effectué après les routes API. | Fichiers compilés et fallback HTML ; aucune route statique n'est ajoutée quand le répertoire est absent. |
| Corpus statistique, hors HTTP | `Scripts/statistical_corpus_runner:execute_python_case` construit directement `SimulationCommand.from_normalized_input`, puis appelle `run_simulation_with_batch_size`. | Résultat canonique de preuve, sans DTO HTTP, seed aléatoire, rate limit ni persistance. |
| Nettoyage d'identité, opératoire | `Scripts/scrub_simulation_identity:main` construit son propre `MongoClient`, localise la collection via `ApiConfig` et retire en mode `--apply` les champs d'identité legacy. | Compte ou modifie les documents ; dry-run par défaut. |
| Purge, opératoire | `Scripts/purge_inactive_clients:main` lit directement les variables Mongo, trouve les identifiants dont `last_seen` est antérieur au cutoff, puis supprime tous leurs documents. | Suppression par client et compte rendu texte. Aucun appel ou ordonnanceur automatique n'est présent dans le dépôt. |

`frontend/src/api.ts:postSimulate` est le consommateur de production trouvé pour `POST /simulate` et envoie les
cookies avec `credentials: "include"`. Aucun appel de production à `GET /simulations/history` n'a été trouvé
dans `frontend/src`; la route reste couverte par les tests et utilisée par les procédures de déploiement.

## Flux complet de `POST /simulate`

```text
JSON + headers + cookie
  -> CORS / SlowAPI (clé X-Forwarded-For, adresse client ou "unknown")
  -> SimulateRequest Pydantic
  -> resolve_simulation_seed
  -> request_to_command
  -> SimulationCommand + Value Objects
  -> run_in_threadpool + timeout asyncio
  -> simulation_service
       -> tableau NumPy des échantillons utilisables
       -> McaPrngV1SampleIndexDrawPort(seed)
       -> mc_finish_weeks OU mc_items_done_for_weeks
       -> percentiles + fiabilité + histogramme + complétion
  -> SimulationResult
  -> result_to_response -> SimulateResponse -> JSON
  -> si cookie non vide ET Mongo activé : BackgroundTasks
       -> _persist_simulation -> SimulationStore.save_simulation -> MongoDB
```

### Transitions attribuées

| ID | Entrée | Transition et propriétaire | Sortie |
| --- | --- | --- | --- |
| B-01 | Requête HTTP | Les middlewares de `backend.api` appliquent CORS et SlowAPI. `ObservableLimiter` dans `api_routes_simulate` choisit la première valeur de `X-Forwarded-For`, sinon l'adresse du client, sinon `unknown`. | Requête admise, `429`, ou admission sans limitation partagée lorsque le stockage Redis est en panne. |
| B-02 | JSON brut | Pydantic construit `SimulateRequest`, refuse les champs supplémentaires et types non stricts, applique les défauts, puis instancie des Value Objects pour valider le contrat de mode et les bornes. | DTO HTTP fermé ou réponse FastAPI `422`. |
| B-03 | `req.seed` optionnelle | `simulation_seed.resolve_simulation_seed` conserve la valeur explicite ou appelle une fois `secrets.randbelow`, puis construit `SimulationSeed`. | Seed uint32 obligatoire et validée. |
| B-04 | DTO + seed | `simulation_mappers.request_to_command` appelle `SimulationCommand.create`, qui reconstruit `ThroughputSamples`, filtre éventuellement les zéros, construit compte/backlog/horizon et n'accepte que le paramètre actif du mode. | Commande de domaine immuable. |
| B-05 | Commande | La route délègue `simulation_service.run_simulation` au threadpool Starlette et borne l'attente avec `asyncio.wait_for`. | Résultat, `422` sur `StatisticalValueError`, ou `503` au timeout. |
| B-06 | `ThroughputSamples.usable_values` | `simulation_service._prepare_samples` les convertit en tableau NumPy entier ; le service construit exactement un `McaPrngV1SampleIndexDrawPort` depuis la seed. | Échantillons moteur + état PRNG propre à l'exécution. |
| B-07 | Commande, tableau, port de tirage | `simulation_service._run_engine` choisit `mc_core.mc_finish_weeks` ou `mc_core.mc_items_done_for_weeks` et transmet le port et la taille de lot. | `FinishWeeksSimulation` censuré à 521 semaines, ou tableau de nombres d'items. |
| B-08 | Demandes de tirages | `mc_core._draw_samples_batch` appelle `draw_sample_indices`; l'adaptateur `mca-prng-v1` avance son état uint32 et retourne une matrice d'indices C-order. | Lots de valeurs historiques rééchantillonnées sans remise à zéro entre lots. |
| B-09 | Population moteur | Le service sépare valeurs terminées et censurées, appelle `mc_core.percentiles`, `calculate_throughput_reliability` et `build_histogram`, puis construit les Value Objects de sortie. | Percentiles selon le mode, fiabilité, histogramme, complétion éventuelle. |
| B-10 | Agrégats | `SimulationResult.__post_init__` vérifie types, effectifs, mode, masse d'histogramme et présence de complétion ; `risk_score` est dérivé des percentiles par `SimulationPercentiles`. | Résultat de domaine cohérent ou erreur. |
| B-11 | Résultat | `simulation_mappers.result_to_response` convertit les Value Objects en primitives ; `SimulateResponse` revalide forme, effectifs et Risk Score ; FastAPI omet les valeurs `None`. | JSON HTTP public. |
| B-12 | Cookie + commande + résultat | Après construction de la réponse, la route lit le cookie configuré. Si sa valeur est non vide et Mongo activé, elle ajoute `_persist_simulation` aux `BackgroundTasks`. | Réponse non bloquée par l'écriture ; aucune écriture sans cookie ou Mongo. |
| B-13 | Tâche de fond | `_persist_simulation` appelle le store et absorbe toute erreur dans un log `warning`. Le store lit une fois son `BackendClock` injecté et réutilise l’instant sur la tentative Mongo éventuelle. | Document sauvegardé avec `created_at` et `last_seen` identiques, ou résultat déjà calculé rendu sans entrée d'historique. |

Le timeout borne l'attente HTTP, pas le calcul métier lui-même : la fonction synchrone a déjà été confiée au
threadpool. Le chemin de timeout ne construit donc ni réponse de résultat ni tâche de persistance, même si le
travail du thread ne dispose pas ici d'un mécanisme d'annulation coopérative.

## Modèles, transformations et autorités observées

| Forme | Module propriétaire | Création ou transformation | Consommateurs |
| --- | --- | --- | --- |
| `ApiConfig` | `backend/api_config.py` | Variables d'environnement lues et rabattues sur des défauts lors des imports de `api.py` et `api_routes_simulate.py`. | CORS, timeout, limiteur et `SimulationStore`. |
| DTO entrants/sortants | `backend/api_models.py` | Modèles Pydantic stricts de requête/réponse ; `SimulationHistoryItem` accepte explicitement plusieurs champs legacy optionnels. | FastAPI et `simulation_mappers`. |
| Commande et résultat | `backend/simulation_models.py` | Dataclasses immuables ; `SimulationCommand.create` et `from_normalized_input` sont deux entrées de construction. | Route via mapper, corpus statistique, service et store. |
| Primitives statistiques | `backend/simulation_value_objects.py` | Seed, compte, backlog, horizon, échantillons, percentiles, fiabilité, histogramme et complétion ; validations et arrondis associés. | Modèles, service, DTO et adaptateur PRNG. |
| Entrée moteur | `numpy.ndarray` | Conversion dans `simulation_service._prepare_samples`; matrices de tirage construites dans `mc_core`. | Service, cœur Monte Carlo et port de tirage. |
| Sortie moteur backlog | `mc_core.FinishWeeksSimulation` | Tableau des seules simulations terminées + population totale + horizon. | `simulation_service._resolve_result_population`. |
| Sortie moteur items | `numpy.ndarray` | Sommes par simulation pour l'horizon demandé. | Agrégation du service. |
| Document Mongo | Dictionnaire dans `simulation_store._simulation_document` | Conversion directe de `SimulationCommand` et `SimulationResult`; les échantillons bruts et le contexte Azure DevOps ne sont pas persistés. | Collection Mongo configurée. |
| Ligne d'historique | Dictionnaire projeté par `SimulationStore.list_recent` | Exclusion de `_id`, `mc_client_id` et champs sensibles ; dates converties en ISO UTC. | `persistence_row_to_history_item`, puis `SimulationHistoryItem`. |
| Instant de persistance | Port `backend/ports/clock:BackendClock` | `SystemUtcClock` lit `datetime.now(timezone.utc)` uniquement dans l’adaptateur système ; `DeterministicBackendClock` fournit l’instant contrôlé des tests. | `SimulationStore.save_simulation`. |

Les limites numériques sont centralisées dans `backend/simulation_limits.py`. Le Risk Score est calculé dans
`SimulationPercentiles.risk_score` en utilisant `backend/risk_score.py`. La catégorisation de fiabilité est
répartie entre le calcul de métriques de `backend/throughput_reliability.py` et la création du Value Object.
L'histogramme est construit par `backend/histogram.py`, puis sa forme et sa masse sont validées par
`Histogram.create`.

## Moteurs et appels

| Responsabilité | Appel réel | Dépendances transmises | Retour |
| --- | --- | --- | --- |
| Dispatch applicatif | `run_simulation` -> `run_simulation_with_batch_size` -> `_run_engine` | Commande, tableau NumPy, adaptateur `mca-prng-v1`, taille de batch. | `SimulationResult`. |
| Backlog vers semaines | `_run_engine` -> `mc_finish_weeks` | Backlog, échantillons utilisables, nombre de simulations, port ; `include_zero_weeks=True` car le filtrage a déjà eu lieu. | Semaines terminées et censure à 521. |
| Semaines vers items | `_run_engine` -> `mc_items_done_for_weeks` | Horizon, échantillons utilisables, nombre de simulations, port ; même convention de filtrage. | Items livrés par simulation. |
| Tirage | `mc_core._draw_samples_batch` -> `SampleIndexDrawPort.draw_sample_indices` | Nombre d'échantillons et forme `(simulations du lot, slots)`. | Indices NumPy. |
| Agrégats | Service -> `percentiles`, `calculate_throughput_reliability`, `build_histogram` | Population complète ou terminée selon le mode. | Primitives converties en Value Objects. |

`backend/numpy_sample_index_draw_port.py` est un tombstone suivi, sans classe ni chemin d'exécution. Le seul
adaptateur de tirage de production trouvé est `McaPrngV1SampleIndexDrawPort`.

## Stores, cache et persistance

### Rate limit : mémoire ou Redis

`ObservableLimiter` est instancié au niveau module. `APP_REDIS_URL` alimente en réalité le `storage_uri` de
SlowAPI : Redis conserve des compteurs de limitation, pas les simulations ni leurs résultats. Le défaut
`memory://` conserve ces compteurs dans le processus ; avec plusieurs workers, cet état n'est donc pas
partagé. Quand le stockage non mémoire échoue, le limiteur journalise l'indisponibilité et laisse passer les
requêtes jusqu'au rétablissement. Aucun cache backend de résultat de simulation n'a été trouvé.

### MongoDB

`SimulationStore` possède le client, la collection, le verrou de connexion, les index, la reconnexion et les
conversions documentaires. Son cycle réel est :

1. composition de `SystemUtcClock`, puis création globale du store depuis `ApiConfig` et le port horloge à
   l'import de `api_routes_simulate` ;
2. connexion au lifespan si `APP_MONGO_URL` n'est pas vide ;
3. création d'un index `(mc_client_id, created_at desc)` et d'un TTL de 30 jours sur `last_seen` ;
4. pour une sauvegarde, lecture unique de l’horloge injectée, insertion d'un document puis mise à jour de
   `last_seen` sur tous les documents du même client avec ce même instant ;
5. pour une lecture, filtre sur `mc_client_id`, tri décroissant par `created_at`, projection minimisée et
   limite configurable (10 par défaut) ;
6. sur `PyMongoError`, remise à zéro du client et une seconde tentative de l'opération complète ;
7. fermeture du client à l'arrêt du processus.

Le TTL est donc glissant au niveau du client : chaque sauvegarde réussie rafraîchit tous ses documents. Le
PBI 7.32 ne modifie ni sa durée de 30 jours ni la politique de purge. La
purge opératoire applique également une suppression au niveau du client. Le volume Docker
`montecarlo-mongo-data` rend les documents persistants au-delà du cycle du conteneur.

Document écrit quand les valeurs existent :

```text
mc_client_id, created_at, last_seen, mode,
backlog_size OU target_weeks, n_sims, samples_count,
percentiles, distribution, completion_summary?, risk_score?,
throughput_reliability, include_zero_weeks, seed
```

Le store ne persiste pas les échantillons de throughput. La projection de lecture retire aussi une liste
explicite de champs Azure DevOps legacy. `scrub_simulation_identity.py` peut les supprimer physiquement ; il
emploie le même `ApiConfig` mais son propre client. `purge_inactive_clients.py` emploie son propre lecteur de
variables, ses propres défauts et son propre client.

### Lecture de l'historique

```text
cookie configuré
  -> simulation_history
  -> SimulationStore.list_recent
  -> find/projection/sort/limit Mongo
  -> dates datetime vers chaînes ISO Z
  -> persistence_row_to_history_item
  -> SimulationHistoryItem
  -> JSON
```

Un cookie absent, vide, ou Mongo désactivé produit `[]`. Une erreur Mongo ou une ligne incompatible avec le
DTO produit `503`. Le serveur ne valide pas le format UUID du cookie : seul le frontend
`ensureMontecarloClientCookie` impose actuellement cette forme avant l'envoi.

## Sorties et transitions d'échec

| Situation | Propriétaire | Effet externe |
| --- | --- | --- |
| Entrée HTTP non conforme | Pydantic/FastAPI, puis `StatisticalValueError` capturée par la route | `422`. |
| Limite atteinte | SlowAPI + handler enregistré dans `api.py` | `429`. |
| Redis indisponible | `ObservableLimiter` | Warning et exécution permissive sans limitation partagée. |
| Calcul trop long | `asyncio.wait_for` dans la route | `503`, log structuré, aucune persistance planifiée. |
| Calcul valide | Mapper + DTO de réponse | `200`, JSON canonique avec valeurs absentes omises. |
| Mongo absent au démarrage | `SimulationStore.enabled` | API de calcul disponible ; historique vide et health Mongo `disabled`. |
| Écriture Mongo échouée | `_persist_simulation` | Warning ; la réponse de calcul demeure rendue. |
| Lecture/ping Mongo échoué | Route historique/health | `503`. |
| Frontend compilé absent | `mount_frontend` | Pas de montage statique ; les routes API et docs demeurent. |

## Responsabilités ambiguës, chevauchements et couplages observés

Ces constats décrivent l'état actuel et ne constituent pas un plan de refactoring.

| ID | Observation vérifiée | Preuve d'exécution |
| --- | --- | --- |
| C-01 | La route de simulation cumule adaptation HTTP, résolution de seed, timeout/threadpool, journalisation, rate limit, lecture d'identité, décision de persistance et planification de tâche de fond. | Imports et corps de `api_routes_simulate.simulate`, plus `_persist_simulation` et `ObservableLimiter` dans le même module. |
| C-02 | La composition dépend d'objets globaux construits à l'import et réutilisés par le lifespan et les routes. | `cfg`, `simulation_store` et `limiter` sont instanciés dans `api_routes_simulate`; `api.py` les importe directement. |
| C-03 | La validation entrante est effectuée une première fois par `SimulateRequest.validate_domain_contract`, puis reconstruite dans `SimulationCommand.create`. Le cas « historique insuffisant » est volontairement laissé traverser le DTO pour être converti en `422` par la route. | Appels aux mêmes Value Objects dans `api_models.py` et `simulation_models.py`; branche spéciale sur le message d'erreur. |
| C-04 | La réponse recalcule l'autorité du Risk Score après que le domaine l'a déjà dérivée. | `SimulationResult.risk_score` délègue à `SimulationPercentiles`; `SimulateResponse.validate_canonical_shape` recrée des percentiles et compare le score. |
| C-05 | Le service prépare les échantillons, choisit le moteur, crée le PRNG et calcule aussi percentiles, fiabilité, histogramme et complétion. | Graphe d'appels de `simulation_service.run_simulation_with_batch_size`. |
| C-06 | NumPy traverse le service, le cœur, le protocole de tirage et son adaptateur concret. | Imports `numpy` et annotations/retours dans `simulation_service.py`, `mc_core.py`, `sample_index_draw_port.py` et l'adaptateur. |
| C-07 | Le filtrage des zéros appartient au Value Object, mais le cœur conserve une seconde politique de filtrage. Le service lui transmet toujours `include_zero_weeks=True` sur la population déjà filtrée. | `ThroughputSamples.create`, `_prepare_samples`, puis appels de `_run_engine` vers `mc_core`. |
| C-08 | La conversion de persistance est divisée : le document domaine-vers-Mongo est construit dans le store, tandis que le mapper nommé persistance ne fait que ligne-vers-DTO. | `_simulation_document` dans `simulation_store.py`; `persistence_row_to_history_item` dans `simulation_mappers.py`. |
| C-09 | `SimulationStore` dépend à la fois d'`ApiConfig`, des modèles de domaine et de PyMongo ; les routes dépendent directement de ce store concret, sans autre abstraction sur le chemin exécuté. | Imports de `simulation_store.py` et instanciation/appels dans `api_routes_simulate.py`. |
| C-10 | La rétention a deux autorités exécutables : index TTL créé par le store et purge opératoire directe. Les deux valent 30 jours par défaut mais leurs configurations sont distinctes. | `_LAST_SEEN_TTL_SECONDS` et `_ensure_indexes`; `APP_PURGE_RETENTION_DAYS` dans `purge_inactive_clients.py`. |
| C-11 | Deux scripts opératoires contournent `SimulationStore` et gèrent directement client, collection et mutations Mongo. | `scrub_simulation_identity.py` et `purge_inactive_clients.py`. |
| C-12 | Les scripts de scrub et purge sont documentés comme commandes opératoires, mais aucun appel automatique n'existe dans le dépôt ; l'image runtime du `Dockerfile` copie `backend` et le frontend compilé, pas `Scripts`. | Recherche des appelants, `docs/deployment.md` et instructions `COPY` du `Dockerfile`. |
| C-13 | Le backend accepte toute valeur de cookie non vide comme clé de partition, alors que le navigateur ne crée que des UUID v4. | Lecture `.strip()` dans les deux routes et validation uniquement dans `frontend/src/clientId.ts`. |
| C-14 | La route d'historique est exposée et testée, mais aucun consommateur de production n'a été trouvé dans `frontend/src`. | Recherche de `/simulations/history`; seuls backend, tests et documentation de déploiement l'utilisent. |
| C-15 | Le montage statique sur `/` et la déclaration explicite `GET /` sont créés dans la même branche conditionnelle, après l'enregistrement des API. | Ordre des appels dans `api.py` et `api_static.mount_frontend`. |
| C-16 | Le runner de corpus appelle directement le service et les modèles internes, en parallèle du chemin HTTP. | Imports et appel `run_simulation_with_batch_size` dans `Scripts/statistical_corpus_runner.py`. |

## Matrice de preuve durable

| Conclusion | Imports/appels de production | Preuves ciblées existantes |
| --- | --- | --- |
| Routes, middleware, lifespan et health | `backend/api.py`, `backend/api_routes_simulate.py`, `backend/api_static.py` | `tests/test_api_health.py`, `tests/test_api_static.py`, `tests/test_api_simulate.py` |
| DTO fermés et transitions DTO/domaine | `api_models` -> `simulation_value_objects`; `simulation_mappers` -> `simulation_models` | `tests/test_api_models.py`, `tests/test_simulation_mappers.py`, `tests/test_api_simulate.py` |
| Dispatch et agrégation du service | `api_routes_simulate` -> `simulation_service` -> `mc_core`, `histogram`, `throughput_reliability` | `tests/test_simulation_service.py`, `tests/test_mc_core.py`, `tests/test_throughput_reliability.py` |
| PRNG unique et batching | `simulation_service` -> `McaPrngV1SampleIndexDrawPort` -> `SampleIndexDrawPort` consommé par `mc_core` | `tests/test_numpy_sample_index_draw_port.py`, `tests/test_simulation_service.py`, `tests/test_mc_core.py` |
| Persistance best-effort après calcul | Route -> `BackgroundTasks` -> `_persist_simulation` -> `SimulationStore.save_simulation` | `tests/test_api_history.py`, `tests/test_api_simulate.py`, `tests/test_simulation_store.py` |
| Projection et compatibilité d'historique | `SimulationStore.list_recent` -> `persistence_row_to_history_item` -> `SimulationHistoryItem` | `tests/test_api_history.py`, `tests/test_simulation_mappers.py`, `tests/test_simulation_store.py` |
| Frontière d'identité minimisée | DTO, route, document et projection backend | `tests/test_identity_boundary.py`, `tests/test_simulation_store.py` |
| Accès Mongo opératoires directs | `scrub_simulation_identity.py`, `purge_inactive_clients.py` | `tests/test_scrub_simulation_identity.py`, `tests/test_operational_scripts.py` |
| Entrée moteur hors HTTP | `Scripts/statistical_corpus_runner.py` -> modèles/service backend | `tests/test_statistical_corpus_runner.py` et preuves statistiques versionnées |

## Limites explicites de la carte

- Elle ne déduit aucune couche cible des noms actuels de fichiers.
- Elle n'affirme pas que les recouvrements sont des défauts ; elle les rend localisables.
- Elle n'analyse pas l'architecture de l'infrastructure qualité au-delà de ses appels directs au backend.
- Elle ne modifie ni moteur, tirage, ordre de batching, censure, percentile, Risk Score, fiabilité, histogramme,
  DTO, persistance, seuil, test ou gate statistique.
