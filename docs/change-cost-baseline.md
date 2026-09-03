# Baseline du coût de changement et de ses hotspots

> Générée par `Scripts/report_change_cost_baseline.py` ; ne pas éditer manuellement.

## Protocole reproductible

```powershell
.\.venv\Scripts\python.exe Scripts/report_change_cost_baseline.py
.\.venv\Scripts\python.exe Scripts/report_change_cost_baseline.py --check
```

Le premier appel recalcule la preuve JSON et cette projection depuis les fichiers courants et le graphe factuel 7.4. Le second exige une égalité octet pour octet. Pour la comparaison post-migration, conserver l'intention et les règles, ne modifier que les chemins dont la responsabilité a réellement bougé, documenter cette correspondance, puis comparer les mêmes métriques au rapport de référence.

## Règle de mesure

La baseline couvre 3 scénarios et 40 fichiers uniques. Un hotspot n'est confirmé que par au moins deux signaux : présence dans au moins 2 scénarios, degré de dépendance supérieur ou égal au P75 (6) ou taille supérieure ou égale au P75 des fichiers traversés (394 lignes).

Les métriques sont : fichiers et lignes physiques traversés (portée), fichiers de production et de test (nature du coût), couches distinctes (frontières), arêtes internes (cohésion statique), arêtes entrant ou sortant de la surface (couplage externe) et hotspots confirmés.

## Scénarios représentatifs

### Faire évoluer le contrat statistique de simulation

Le contrat POST /simulate traverse réellement transport, domaine et moteurs Python/TypeScript; sa preuve doit préserver les garanties statistiques interlangages.

Sources : `docs/frontend-responsibilities-map.md#simulation-déquipe`, `docs/backend-responsibilities-map.md#flux-complet-de-post-simulate`, `docs/statistical-compatibility.md`.

| Fichiers | Production | Tests | Lignes | Couches | Arêtes internes | Arêtes de frontière | Hotspots |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 21 | 13 | 8 | 5990 | 9 | 27 | 73 | 3 |

Couches : `backend-domain`, `backend-engine`, `backend-transport`, `frontend-application`, `frontend-delivery-or-engine`, `frontend-domain`, `frontend-transport`, `proof-tests`, `quality-statistical-proof`.

Fichiers : `Scripts/statistical_corpus_runner.py`, `backend/api_models.py`, `backend/mc_core.py`, `backend/simulation_mappers.py`, `backend/simulation_models.py`, `backend/simulation_service.py`, `backend/simulation_value_objects.py`, `frontend/src/api/simulationDtos.ts`, `frontend/src/api/simulationMappers.test.ts`, `frontend/src/api/simulationMappers.ts`, `frontend/src/application/team-forecast/localTeamForecast.ts`, `frontend/src/domain/simulation.ts`, `frontend/src/domain/simulationValueObjects.test.ts`, `frontend/src/domain/simulationValueObjects.ts`, `frontend/src/utils/simulation.ts`, `tests/test_api_models.py`, `tests/test_mc_core.py`, `tests/test_simulation_mappers.py`, `tests/test_simulation_service.py`, `tests/test_statistical_compatibility.py`, `tests/test_statistical_corpus_runner.py`.

### Faire évoluer une règle de collecte et de calendrier delivery

La collecte observée va de la cible Azure DevOps aux semaines et Cycle Time, puis aux hooks de simulation; elle représente un changement métier alimenté par un adaptateur externe.

Sources : `docs/frontend-responsibilities-map.md#collecte-et-transformations-delivery`, `docs/dependency-graph.md`.

| Fichiers | Production | Tests | Lignes | Couches | Arêtes internes | Arêtes de frontière | Hotspots |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 11 | 7 | 4 | 2591 | 4 | 8 | 63 | 3 |

Couches : `frontend-application`, `frontend-azure-adapter`, `frontend-delivery-or-engine`, `proof-tests`.

Fichiers : `frontend/src/adoClient.test.ts`, `frontend/src/adoClient.ts`, `frontend/src/adoPlatform.test.ts`, `frontend/src/adoPlatform.ts`, `frontend/src/application/team-forecast/localTeamForecast.ts`, `frontend/src/date.test.ts`, `frontend/src/date.ts`, `frontend/src/hooks/useSimulation.ts`, `frontend/src/types.ts`, `frontend/src/utils/cycleTime.test.ts`, `frontend/src/utils/cycleTime.ts`.

### Faire évoluer le profil de validation main sans réduire ses garanties

La carte qualité montre que profil, planification, exécution et preuves sont séparés mais coordonnés par le même DAG; ce scénario mesure ce coût sans rationaliser la gate.

Sources : `docs/quality-infrastructure-responsibilities-map.md#quality-gates-modes-et-profils`, `config/test-execution-profiles.json`.

| Fichiers | Production | Tests | Lignes | Couches | Arêtes internes | Arêtes de frontière | Hotspots |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 9 | 6 | 2 | 7274 | 3 | 7 | 14 | 1 |

Couches : `proof-tests`, `quality-contract`, `quality-orchestration`.

Fichiers : `Scripts/quality_gate.py`, `Scripts/quality_gate_dag.py`, `Scripts/quality_gate_plan.py`, `Scripts/test_execution_profiles.py`, `Scripts/test_execution_profiles_graph.py`, `Scripts/test_execution_profiles_validation.py`, `config/test-execution-profiles.json`, `tests/test_quality_gate.py`, `tests/test_test_execution_profiles.py`.

## Hotspots confirmés par les données

| Fichier | Scénarios | Degré | Lignes | Signaux |
| --- | ---: | ---: | ---: | --- |
| `frontend/src/application/team-forecast/localTeamForecast.ts` | 2 | 14 | 232 | repeatedTraversal, highCoupling |
| `frontend/src/hooks/useSimulation.ts` | 1 | 19 | 492 | highCoupling, largeFile |
| `frontend/src/domain/simulationValueObjects.ts` | 1 | 17 | 394 | highCoupling, largeFile |
| `backend/simulation_value_objects.py` | 1 | 12 | 429 | highCoupling, largeFile |
| `frontend/src/adoClient.ts` | 1 | 11 | 677 | highCoupling, largeFile |
| `Scripts/quality_gate.py` | 1 | 7 | 1631 | highCoupling, largeFile |

## Hypothèses et limites

- Les surfaces sont des hypothèses de changement revues à partir des cartes 7.1-7.4, pas des estimations issues de l'historique Git.
- Les lignes physiques et fichiers sont des proxys de portée; ils n'estiment ni le temps écoulé ni la difficulté cognitive.
- Les dépendances viennent du graphe statique, qui exclut les tests; les liens dynamiques ou portés uniquement par les données peuvent manquer.
- Un hotspot est relatif à ce dépôt et à ce protocole; il ne constitue pas à lui seul un défaut architectural.
- Après migration, conserver intention et règles; ne changer un chemin que si sa responsabilité bouge et expliciter la correspondance.
