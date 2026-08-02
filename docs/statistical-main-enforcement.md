# Enforcement statistique du profil `main`

Ce document décrit l’autorité d’exécution qui rend obligatoires les preuves statistiques déjà définies. Il
ne modifie ni `STD-STAT-001`, ni `mca-prng-v1`, ni le corpus, ni les sondes, ni le protocole
distributionnel, ni leurs seuils, ni les décisions de compatibilité.

La politique machine fermée est
[`config/statistical-main-enforcement-v1.0.json`](../config/statistical-main-enforcement-v1.0.json). Son
[schéma](../config/statistical-main-enforcement-v1.0.schema.json) et le
[schéma des attestations](../config/statistical-main-attestation-v1.0.schema.json) sont validés avant les
preuves. `Scripts/statistical_main_enforcement.py` est l’unique adaptateur bloquant de cette politique.

## Audit du plan existant

Avant cette intégration, le profil `main` exécutait les contrôles de dépôt, lint, typecheck, couvertures,
build, E2E, Vitals, gouvernance et reporting stratégique. Les preuves statistiques étaient produites ou
validées par leurs commandes spécialisées et certaines suites Pytest les exerçaient indirectement, mais le
DAG ne possédait aucun nœud statistique explicite. Le rapport consolidé et la preuve de compatibilité
versionnés restaient donc des preuves de référence, pas des prérequis de l’agrégateur.

Les responsabilités demeurent distinctes :

| Entrée | Source contrôlée | Portée | Garantie statistique complète |
| --- | --- | --- | --- |
| `fast` / pré-commit | snapshot de l’index | retour ciblé, profil `pr` | non |
| `push` / pré-push | SHA terminal dans un worktree détaché | ciblé ou impacté ; plan complet seulement pour un changement `massive` | seulement lorsque le risque `massive` déclenche le plan complet |
| `ci --profile pr` / pull request | checkout de `${{ github.sha }}` | profil `pr` | non |
| `ci --profile main` / push sur `main` et tâche VS Code | snapshot local complet ou checkout de `${{ github.sha }}` | autorité complète | oui |
| `nightly` | même socle que `main`, plus le profil planifié | autorité complète héritée | oui |
| `release` | même socle que `main`, plus le profil de publication | autorité complète héritée | oui |

Les modes légers ne sont donc pas présentés comme équivalents à `main`. Le pré-push conserve son
déclenchement `massive` pour les changements de gate, d’autorités ou de moteurs : le risque couvert est le
faux vert avant publication, le coût supplémentaire est celui mesuré ci-dessous et aucune suite existante
n’est supprimée.

## DAG d’autorité

Le contrat [`config/test-execution-profiles.json`](../config/test-execution-profiles.json) reste l’unique
autorité du graphe. `conditionalNeeds` exprime l’arête vers la branche statistique uniquement pour les
profils qui activent cette branche ; le schéma fermé et le validateur refusent une dépendance obligatoire
inactive, absente ou cyclique.

| Nœud | Contrôles logiques produits une fois | Prérequis |
| --- | --- | --- |
| `statistical-authorities` | corpus et sondes ; protocole distributionnel | `preflight` et validation technique des autorités/schémas |
| `statistical-deterministic-parity` | parité déterministe et normative | autorités |
| `statistical-exact-replay` | rejeu exact interlangage ; indépendance du batching | autorités |
| `statistical-distributional-parity` | preuve de parité distributionnelle | autorités et protocole |
| `statistical-compatibility` | versions et décisions de compatibilité | trois branches de preuve spécialisées |
| `statistical-consolidated-report` | génération ; validation indépendante et verdict | preuves spécialisées et compatibilité |
| `aggregate` | verdict final de la gate | branches historiques et rapport statistique validé |

Après `statistical-authorities`, les preuves déterministe, exacte et distributionnelle sont indépendantes et
restent parallélisables. La compatibilité les rejoint. Le générateur consolidé reçoit leurs chemins
d’artefacts du run ; il ne relance aucun moteur. La validation consolidée reconstruit le modèle attendu
depuis ces mêmes sources, compare JSON, Markdown et empreinte, applique la politique fermée, puis écrit une
attestation. Il n’existe pas de second validateur concurrent chargé de remplacer une preuve invalide.

La preuve exacte est générée une seule fois. Les contrôles `exact_replay` et `batching_independence`
inspectent deux propriétés distinctes du même artefact. Chaque consommateur réutilise les artefacts du run
sous `reports/test-execution-artifacts/<profil>/<nœud>/`.

## Politique fermée des statuts

`match` est le seul résultat final accepté, et seulement après validation des sources, schémas, versions,
empreintes, dépendances et snapshot. Les dispositions sont :

| Disposition | Statuts |
| --- | --- |
| accepté | `match` |
| informatif mais interdit comme verdict final obligatoire | `no_normative_impact` |
| non applicable mais interdit comme verdict final obligatoire | `not_applicable` |
| interdit comme résultat final | `not_evaluated`, `not_compared`, `divergence`, `invalid`, `inconclusive` |
| bloquant | divergences normative, interlangage, de sondes, batching et distributionnelle ; non-conclusion statistique ; incompatibilités de version ; preuve, schéma ou empreinte invalide ; preuve périmée ; source absente ; erreurs moteur, protocole ou infrastructure ; décision ou migration absente/incohérente ; toute classification fermée de compatibilité non conforme |

Un statut inconnu bloque également : il ne peut être ajouté implicitement par un producteur. Les tests de
mutation vérifient aussi l’absence de `skip`, retry, quarantaine, `continue-on-error` ou exemption silencieuse
dans le plan statistique.

## Fraîcheur et isolation

Chaque contrôle réussi écrit une attestation run-scoped contenant :

- les identifiants exacts des contrôles attestés ;
- la version et l’empreinte canonique de la politique ;
- une identité SHA-256 du snapshot contrôlé et le nombre de fichiers concernés ;
- les chemins relatifs et SHA-256 des artefacts consommés ou produits.

L’identité `sha256-controlled-snapshot-v1` est calculée sur le périmètre immuable des sources validées :
moteurs Python et TypeScript, scripts, contrats, configurations, autorités documentaires, workflows et
dépendances verrouillées pertinentes. Elle est déterministe, indépendante des chemins absolus et ne dépend
d’aucun horodatage mural. Les sorties créées pendant la validation — attestations, preuves spécialisées,
rapport de calibration, couvertures, builds, caches et rapports temporaires — restent hors de ce périmètre ;
leurs contenus sont protégés séparément par les empreintes d’artefacts et de preuves.

Chaque nœud recalcule cette même identité depuis les sources immuables du snapshot avant de produire ou de
consommer une attestation. Les branches parallèles et séquentielles observent donc la même valeur pendant le
run, sans qu’une sortie puisse la transformer. Une modification d’une véritable source produit en revanche
une autre identité. Une attestation provenant d’un autre snapshot ou d’un ancien run, utilisant une autre
politique, référençant un chemin extérieur, un artefact absent ou un contenu modifié est refusée. Le contrôle
de compatibilité recalcule en plus les empreintes sémantiques des preuves courantes ; la consolidation compare
son modèle aux mêmes chemins courants.

La validation locale complète copie une fois les fichiers suivis et non ignorés du workspace dans un
répertoire temporaire. Les sources sont lues dans cette copie. Le `GIT_DIR` hôte est exposé uniquement pour
les lectures Git nécessaires, avec `GIT_WORK_TREE` fixé au snapshot. `frontend/node_modules` peut être lié
une seule fois depuis l’hôte comme dépendance technique ; ce lien n’autorise aucune lecture des sources du
workspace et disparaît après succès, échec ou interruption. Une dépendance frontend absente bloque avant la
preuve. Les sorties restent dans le snapshot et le workspace versionné n’est pas réécrit par la gate.

## Diagnostics et reproduction

Les contrôles spécialisés restent la source du diagnostic détaillé. L’enforcement ajoute le statut observé,
le contrôle, la source ou preuve, les empreintes ou versions disponibles, l’action corrective et la commande
de reproduction. Le rapport consolidé conserve les JSON Pointers, cas, sondes, batches, scénarios, métriques,
composants et surfaces normatives déjà localisés ; il ne les remplace pas.

Commandes isolées principales :

```powershell
.venv\Scripts\python.exe Scripts\statistical_main_enforcement.py validate-authorities --output reports/test-execution-artifacts/main/statistical-authorities/authority-attestation.json
.venv\Scripts\python.exe Scripts\validate_statistical_reference_corpus.py
.venv\Scripts\python.exe Scripts\run_statistical_reference_corpus.py
.venv\Scripts\python.exe Scripts\run_statistical_exact_replay.py
.venv\Scripts\python.exe Scripts\validate_statistical_distribution_protocol.py
.venv\Scripts\python.exe Scripts\run_statistical_distribution.py
.venv\Scripts\python.exe Scripts\run_statistical_compatibility.py
.venv\Scripts\python.exe Scripts\generate_statistical_consolidated_report.py
.venv\Scripts\python.exe Scripts\validate_statistical_consolidated_report.py
```

La commande d’autorité complète reste :

```powershell
.venv\Scripts\python.exe Scripts\quality_gate.py ci --profile main
```

## Alignement local et GitHub Actions

La tâche VS Code `Validation : profil main` appelle exactement cette commande. Le workflow
`.github/workflows/ci.yml` sélectionne les mêmes nœuds par `--node`, sur le checkout explicite de
`${{ github.sha }}`. Les trois preuves indépendantes sont des jobs parallèles ; les artefacts sont téléchargés
par compatibilité, puis consolidation. Le job `aggregate` s’exécute avec `if: always()` et échoue
explicitement si un nœud obligatoire n’est pas `success`, ou si un nœud statistique est sauté hors `pr`.

La publication dépend uniquement d’`aggregate`, reconfirme le SHA du checkout et publie l’image avec ce SHA.
Le dépôt ne permet pas de démontrer la configuration de branch protection GitHub : le statut `aggregate`
doit être configuré comme required check dans la protection externe de `main`.

## Mesure de coût

Mesure locale Windows, dépendances chaudes, le 1er août 2026, sur les nœuds sélectionnés isolément :

| Nœud | Durée |
| --- | ---: |
| autorités | 1,676 s |
| parité déterministe | 2,368 s |
| rejeu exact et batching | 2,763 s |
| parité distributionnelle | 10,541 s |
| compatibilité | 1,515 s |
| consolidation et validation | 1,395 s |

La somme séquentielle est `20,258 s`. Le chemin critique statistique théorique est `15,127 s` grâce aux
trois branches parallèles, soit `5,131 s` évitées sans retirer de contrôle. Ces durées sont informatives et
ne participent ni à la fraîcheur ni au verdict statistique.

## Limite de garantie

Le profil `main` garantit la conformité aux autorités, versions, cas du corpus, sondes, scénarios, seeds,
métriques et protocoles déclarés. Le rejeu exact reste borné à ce corpus ; la preuve distributionnelle reste
bornée à son design ; l’ensemble ne constitue ni une équivalence universelle, ni un backtesting empirique,
ni une promesse d’exactitude future sur toute donnée Azure DevOps.
