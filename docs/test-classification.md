# Modèle de classification des tests

Le catalogue versionné [`config/test-classification.json`](../config/test-classification.json) définit les
vocabulaires et règles de résolution du projet. Le schéma Draft 2020-12
[`config/test-classification.schema.json`](../config/test-classification.schema.json) valide un enregistrement
par cas logique. Ils rendent opérationnel le modèle de `STD-TEST-001` sur tout le patrimoine découvert.

## Dimensions indépendantes

Chaque enregistrement identifie d'abord le cas logique, son framework, son fichier et son sélecteur. Les axes
de classification restent indépendants :

- `nature` : exactement une nature principale pour un cas `classified` ;
- `purposes` : une ou plusieurs finalités pour un cas `classified` ;
- `executionProfile` : exactement un profil principal pour un cas `classified` ;
- `domains` : zéro, un ou plusieurs domaines produit ;
- `criticality` : zéro ou une criticité, obligatoire dès qu'un `risk` ou `criticalPath` est référencé ;
- `status` : exactement une valeur parmi `classified`, `unresolved` et `exempted` ;
- `framework` : exactement une valeur parmi `pytest`, `vitest` et `playwright`.

Les listes interdisent les doublons et le schéma refuse les propriétés inconnues. Un producteur doit aussi
rejeter les noms de propriétés JSON dupliqués avant validation, car JSON Schema opère sur l'objet déjà parsé.

## Décision sur la nature principale

| Nature | Décision fondée sur le comportement réellement exécuté |
| --- | --- |
| `unit` | Une unité logique isolée, sans infrastructure réelle ni frontière technique externe. |
| `component` | Un module cohérent via son interface publique et ses collaborations internes réelles, avec frontières externes remplacées. |
| `integration` | Au moins une frontière technique réelle : réseau, processus, fichier persistant, base, cache ou service contrôlé. |
| `contract` | La compatibilité d'une interface producteur-consommateur, d'un schéma, des types, formats ou règles de versionnement est l'objet principal. |
| `e2e` | Un parcours traverse le système assemblé depuis son point d'entrée observable jusqu'au résultat. |

Une seule nature est retenue, selon le périmètre maximal réellement exécuté. Le comportement observé prime
toujours sur le nom du test, son dossier, son marqueur supposé ou son framework. Une métadonnée qui contredit
ce comportement est invalide.

## Ambiguïtés et exemptions

Quand les preuves ne permettent pas une décision fiable, le cas reste `unresolved` avec `unresolvedReason` :
la classification ne doit pas être devinée. Une exemption est distincte d'une ambiguïté. Le statut `exempted`
exige une justification, un propriétaire, un approbateur et une date d'expiration. Il représente une décision
temporaire et traçable, pas une nouvelle nature ni un moyen de masquer une contradiction.

## Cas logiques et paramétrage

`logicalCaseId` désigne l'unité de comptage. Une fonction ou un scénario paramétré garde un seul identifiant
et un sélecteur sans suffixe d'instance ; ses jeux de données produisent plusieurs instances exécutées, pas
plusieurs cas logiques. Les fixtures, helpers et données de test ne sont pas des cas logiques autonomes.

## Profils d'exécution et niveaux de gate

`pr`, `main`, `nightly` et `release` indiquent le profil principal du pipeline où le cas doit s'exécuter. Les
niveaux `targeted`, `impacted` et `massive` décrivent au contraire l'étendue d'un plan calculé par le quality
gate à partir des changements. Ils ne sont ni des profils, ni des valeurs acceptées par le schéma, ni des
champs d'un enregistrement de classification.

L’inclusion versionnée est `pr = pr`, `main = pr + main`,
`nightly = pr + main + nightly` et `release = pr + main + release`. Elle est définie dans
[`config/test-execution-profiles.json`](../config/test-execution-profiles.json), indépendamment des niveaux
de portée.

## Collecte et génération de l’inventaire

Le PBI 1.4 a défini le contrat, le PBI 1.5 a ajouté la collecte et la classification automatiques, le PBI
1.7 a rendu l’inventaire bloquant, le PBI 1.8 rend les profils exécutables par un DAG commun et le PBI 1.9
ajoute une gouvernance indépendante des mécanismes qui modifient l'exécution.

La commande suivante reconstruit l’inventaire complet, sans donnée volatile :

```bash
python Scripts/classify_tests.py
```

Le résultat est écrit dans
[`reports/test-classification-inventory.json`](../reports/test-classification-inventory.json). Les
enregistrements sont triés par `logicalCaseId`; l’écriture UTF-8, les listes ordonnées et l’absence de
timestamp rendent deux générations successives identiques octet pour octet.

Le diagnostic bloquant, strictement en lecture seule, s'exécute avec :

```bash
python Scripts/check_test_classification.py
```

Il redécouvre tous les cas, régénère l'inventaire en mémoire, compare sa sérialisation exacte au fichier
versionné et refuse les cas absents ou obsolètes, les doublons, les contrats invalides, les `unresolved`, les
overrides orphelins ou incomplets et les exemptions non approuvées, incomplètes ou expirées. Il vérifie aussi
que l'empreinte de `reports/test-execution-counts.json` correspond aux octets de l'inventaire versionné. Le
contrôle n'écrit aucun fichier et ne régénère jamais silencieusement un artefact.

Après ajout, suppression, renommage ou modification d'un test, la procédure de régénération est :

```bash
python Scripts/classify_tests.py
python -m pytest -q
npm --prefix frontend run test:unit
npm --prefix frontend run test:e2e
python Scripts/report_test_execution_counts.py
python Scripts/check_test_classification.py
```

Les trois exécutions complètes reconstruisent les artefacts natifs nécessaires au rapport d'exécution. Une
modification de règles ou d'override exige la même régénération, même si aucun fichier de test n'a changé.

La découverte ne lance pas les tests :

- Pytest est analysé avec l’AST Python. Les fonctions et méthodes collectables des fichiers de test sont
  retenues, y compris les classes imbriquées, décorateurs de paramétrage, skips et déclarations
  conditionnelles. Les fixtures, helpers, données et fonctions imbriquées dans un helper sont exclues ;
- Vitest et Playwright sont analysés par
  [`Scripts/collect_js_tests.mjs`](../Scripts/collect_js_tests.mjs) avec le compilateur TypeScript déjà
  installé. Les suites imbriquées, aliases d’import, `.each`, `.skip`, `.only`, `.todo`, `.skipIf` et
  `.runIf` restent une déclaration logique chacun ;
- Playwright est limité au répertoire configuré `frontend/tests/e2e`. Un appel de configuration comme
  `test.use` ou un hook n’est jamais assimilé à un scénario.

Le sélecteur Pytest reprend `Classe::méthode` ou le nom de fonction. Les sélecteurs Vitest et Playwright
reprennent le chemin de titres de suites et ajoutent la position de déclaration, ce qui distingue deux
titres identiques sans compter les lignes de données de `.each`. `logicalCaseId` concatène de manière
déterministe framework, chemin relatif et sélecteur.

## Preuves et résolution

[`config/test-classification-rules.json`](../config/test-classification-rules.json) versionne les signaux,
leur priorité et les preuves de chaque règle de profil. Ces preuves documentent nature, finalités,
criticité, coût et infrastructure, déterminisme et rôle dans la livraison. Le moteur combine imports, appels, fixtures,
ressources, modificateurs, framework et mode d’exécution. Le chemin et le titre complètent ces preuves pour
les domaines, finalités et rattachements connus, mais une règle de nature ne peut pas réussir avec ces seuls
signaux secondaires.

Les frontières réelles ont priorité sur les contrats, puis sur les composants et la logique isolée. Un
scénario Playwright doit mobiliser des APIs navigateur observables. Une égalité contradictoire ou l’absence
de preuve suffisante produit `unresolved` et une `unresolvedReason`; le moteur ne choisit pas arbitrairement.
Les finalités et domaines sont additifs. Les rattachements `RISK-xxx` et `CP-xxx` exigent une correspondance
précise avec les preuves versionnées dans la matrice de risques et les parcours critiques.

Il n’existe plus d’attribution globale `currentExecutionProfile`. Chaque cas conserve exactement un profil
principal calculé par les preuves prioritaires ; le défaut `pr` ne s’applique qu’en l’absence d’une preuve
plus spécifique. Le chemin ou le framework ne suffisent pas à justifier une règle : la configuration porte
la justification opérationnelle complète.

## Plan d’exécution déterministe

`Scripts/test_execution_profiles.py` valide le contrat et produit
[`reports/test-execution-plan.json`](../reports/test-execution-plan.json). Pour chaque profil et nœud, ce
rapport liste les cas, frameworks, natures, criticités, commandes et dépendances. `preflight` précède
`backend-static`, `frontend-static`, `backend-tests`, `frontend-tests`, `e2e` et
`release-or-container-checks`; `aggregate` dépend de ces six branches. Les écritures intermédiaires sont
isolées par profil et nœud, et tout conflit entre branches parallèles est bloquant.

Dans GitHub Actions, chaque producteur uploade la racine `reports/test-execution-artifacts`. `aggregate`
télécharge les artefacts avec fusion multiple dans ce même répertoire, ce qui préserve les chemins
`<profil>/backend-tests`, `<profil>/frontend-tests` et `<profil>/e2e`. Le promoteur peut alors copier les
couvertures et résultats natifs vers leurs emplacements consolidés sans réécrire les chemins du contrat.
Le transport repose sur `actions/upload-artifact@v7` et `actions/download-artifact@v8`, qui utilisent
nativement Node 24 ; aucune variable de forçage du runtime JavaScript n’est nécessaire dans le workflow.

Les jobs GitHub Actions étant isolés, chaque branche prépare les dépendances qu’elle consomme. Le nœud
`backend-tests` installe Python, configure Node 22 avec le cache npm, puis exécute
`npm --prefix frontend ci` avant la quality gate. Cette installation rend disponibles le moteur TypeScript
utilisé par la classification et `@playwright/test`, importé par `frontend/playwright.config.js`. Aucun
navigateur Playwright n’est installé dans ce nœud ; leur installation appartient exclusivement à `e2e`.

## Overrides auditables

[`config/test-classification-overrides.json`](../config/test-classification-overrides.json) est réservé aux
exceptions ponctuelles que l’analyse statique ne peut résoudre. Chaque entrée cible exactement un framework,
un chemin et un sélecteur, puis fournit une classification ou un statut, une justification et une preuve
observable. Les doublons de ciblage sont refusés. Un override ne doit ni utiliser de motif global, ni
remplacer les règles génériques, ni convertir en masse les ambiguïtés en saisie manuelle.

Le fichier reste vide tant qu’aucune exception nécessaire et auditée n’est identifiée. Les 16 ambiguïtés
historiques ont été résolues par des preuves comportementales plus précises ; aucun override ni aucune
exemption n'a été créé. Toute nouvelle ambiguïté fait échouer la gate au lieu d'être masquée.

## Exemples vérifiés dans le dépôt

Ces exemples illustrent des décisions désormais produites dans l’inventaire :

- `tests/test_mc_core.py::test_mc_finish_weeks_reproducible_for_seed` exécute le calcul statistique en
  mémoire sans frontière externe : exemple `unit`, finalité `functional`, domaine `statistical_engine` ;
- `frontend/src/components/steps/SimulationResultsPanel.test.tsx` rend le composant et ses collaborations
  dans l'environnement Vitest avec les frontières remplacées : exemple `component`, domaines
  `user_interface` et `history` ;
- `tests/test_simulation_store.py::test_save_and_list_recent_with_real_mongo` traverse la frontière MongoDB
  lorsqu'une instance réelle est disponible : exemple `integration`, domaines `persistence` et `history` ;
- `tests/test_api_simulate.py::test_simulate_accepts_contract_boundaries` protège prioritairement les bornes
  du contrat HTTP : exemple `contract`, domaines `api` et `statistical_engine` ;
- `frontend/tests/e2e/onboarding.spec.js` pilote un navigateur à travers le parcours assemblé avec services
  contrôlés : exemples `e2e`, domaines `identity`, `azure_devops` et `user_interface`.

## Comptage des collections et exécutions

Le rapport [`reports/test-execution-counts.json`](../reports/test-execution-counts.json) applique les
définitions communes suivantes :

- `logicalCases` : déclarations uniques présentes dans l'inventaire de classification ;
- `collectedInstances` : instances natives après expansion des paramètres et projets ;
- `executedInstances` : instances uniques ayant eu au moins une tentative, hors skip/todo non exécuté ;
- `skippedInstances` : instances collectées sans tentative ;
- `attempts` : toutes les tentatives, y compris une erreur de setup ou d'infrastructure attachée ;
- `retries` : tentatives supplémentaires d'une instance déjà exécutée.

Les invariants sont `collectedInstances = executedInstances + skippedInstances` et
`attempts = executedInstances + retries`. Un paramètre ou un projet développe une instance, jamais un cas
logique ; un retry ne développe ni cas logique ni instance. Un résultat `skipped` peut appartenir à une
instance exécutée lorsque le skip/xfail a été décidé pendant sa tentative.

Pytest est rapproché par node ID, chemin et déclaration Python après retrait du suffixe paramétré. Vitest
utilise le chemin et la position AST native, y compris l'ancre du tableau de `.each` et les titres dynamiques.
Playwright utilise chemin, ligne, colonne et projet ; son identifiant natif conserve retries et répétitions
sur la même instance. Aucun framework n'est rapproché par le seul titre. Une instance orpheline ou ambiguë,
un cas logique absent ou une collecte qui ne couvre pas les trois frameworks invalide la consolidation.

Les résultats disponibles sont `passed`, `failed`, `skipped`, `todo` et `infrastructureError`. Les erreurs de
setup/hook identifiables restent des tentatives exécutées. Une limite native demeure : un framework peut
exposer un échec attaché sans distinguer une assertion d'une erreur d'infrastructure ; le rapport conserve
alors l'état natif le plus précis sans inférence sur le texte de la console.

Le dépôt versionné exige désormais `unresolved = 0`. Une ambiguïté nouvelle doit être résolue par une preuve
automatique ou, si l'analyse statique ne peut réellement pas conclure, par un override exact, justifié et
appuyé par une preuve observable. Une exemption nécessite en plus une approbation réelle et une expiration
future.

## Limites de classification

L’analyse reste statique. Elle ne développe pas les titres calculés, ne suit pas toutes les fabriques de tests
et ne reconstitue pas automatiquement le comportement d’une fixture définie ailleurs. Ces limites ne
permettent plus de versionner un cas `unresolved` : elles imposent une preuve automatique améliorée ou un
override strictement ciblé et auditable. Le comptage d'exécution ne change pas la nature attribuée.

Le contrôle de classification est exécuté une seule fois par plan `fast`, `push`, `ci`, `nightly` et `release`
via `Scripts/quality_gate.py`, avec respectivement l'index Git, le commit détaché et le workspace comme source.
La task `Validation : profil main` l'exécute directement avec `ci --profile main`.

## Gouvernance distincte des états d'exécution

[`config/test-governance.json`](../config/test-governance.json) est un contrat versionné séparé de la
classification et validé par
[`config/test-governance.schema.json`](../config/test-governance.schema.json). Il réutilise uniquement
`logicalCaseId` comme clé de rattachement. Une entrée exige état normalisé, justification, cause, responsable,
ticket, criticité, risque, date d'entrée, échéance et profil d'exécution. Une quarantaine critique exige en
plus une mesure compensatoire ; tout retry par cas exige `preserveFirstFailure: true` et un maximum explicite
de tentatives.

`Scripts/check_test_governance.py` combine l'AST Python et les preuves AST TypeScript déjà découvertes. Il
détecte les appels et marqueurs Pytest `skip`, `skipif`, `xfail`, quarantaine et retry ; les variantes Vitest
`skip`, `skipIf`, `runIf`, `todo`, `only`, `fails` et retry ; les variantes Playwright `skip`, `fixme`, `fail`,
tag `@quarantine` et retry. Il inspecte aussi les configurations globales et refuse les marqueurs inconnus.
Un mécanisme global de retry est toujours invalide, car il ne peut pas être gouverné par cas logique.

La gate bloque tout mécanisme sans entrée, état incohérent, entrée expirée ou orpheline, test critique ignoré,
quarantaine non exécutable et quarantaine critique sans mesure compensatoire. Une quarantaine est une
annotation exécutable, jamais un alias de `skip`. Son `executionProfile` doit rester identique au profil issu
des preuves de classification et l'inclusion `pr`/`main`/`nightly`/`release` détermine sa sélection.

Les reporters natifs écrivent pour chaque instance `attemptResults`, `initialResult`, `attempts`,
`finalResult` et `result`. Le contrôle complet refuse une séquence incomplète ou un premier échec masqué. Le
rapport [`reports/test-governance-report.json`](../reports/test-governance-report.json), conforme à
[`config/test-governance-report.schema.json`](../config/test-governance-report.schema.json), agrège nombres,
détails, échéances et taux d'instabilité sans timestamp ni chemin absolu. Il est produit par l'unique commande
`Test governance compliance`, rattachée au nœud `aggregate` sans ajouter de branche au DAG.

L'audit initial du PBI 1.9 a trouvé trois appels `pytest.skip(...)` et deux sélections `skipif` de plateforme.
Les deux préconditions de fichiers versionnés et les deux sélections Windows étaient devenues inutiles ; elles
ont été supprimées. Le test Mongo réel échoue désormais explicitement si le service requis par son profil
`main` est absent. L'inventaire final ne contient aucun mécanisme de skip, expected failure, quarantaine ou
retry et le contrat reste donc vide, sans métadonnée fabriquée.
