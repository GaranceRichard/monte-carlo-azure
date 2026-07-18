# Modèle de classification des tests

Le catalogue versionné [`config/test-classification.json`](../config/test-classification.json) définit les
vocabulaires et règles de résolution du projet. Le schéma Draft 2020-12
[`config/test-classification.schema.json`](../config/test-classification.schema.json) valide un enregistrement
par cas logique. Ils rendent opérationnel le modèle de `STD-TEST-001` sans classifier le patrimoine actuel.

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

## Collecte et génération de l’inventaire

Le PBI 1.4 définit le contrat : il ne crée aucun inventaire complet, ne classe aucun test existant et ne
rend pas la classification bloquante. Le présent PBI 1.5 ajoute la collecte et la classification informative
décrites ci-dessous, sans modifier le contrat.

La commande suivante reconstruit l’inventaire complet, sans donnée volatile :

```bash
python Scripts/classify_tests.py
```

Le résultat est écrit dans
[`reports/test-classification-inventory.json`](../reports/test-classification-inventory.json). Les
enregistrements sont triés par `logicalCaseId`; l’écriture UTF-8, les listes ordonnées et l’absence de
timestamp rendent deux générations successives identiques octet pour octet.

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
leur priorité et la preuve d’automatisation du profil actuel. Le moteur combine imports, appels, fixtures,
ressources, modificateurs, framework et mode d’exécution. Le chemin et le titre complètent ces preuves pour
les domaines, finalités et rattachements connus, mais une règle de nature ne peut pas réussir avec ces seuls
signaux secondaires.

Les frontières réelles ont priorité sur les contrats, puis sur les composants et la logique isolée. Un
scénario Playwright doit mobiliser des APIs navigateur observables. Une égalité contradictoire ou l’absence
de preuve suffisante produit `unresolved` et une `unresolvedReason`; le moteur ne choisit pas arbitrairement.
Les finalités et domaines sont additifs. Les rattachements `RISK-xxx` et `CP-xxx` exigent une correspondance
précise avec les preuves versionnées dans la matrice de risques et les parcours critiques.

Le profil courant est `main` car le workflow principal exécute `Scripts/quality_gate.py ci`, qui inclut les
couvertures Pytest et Vitest ainsi que Playwright. Cette observation ne recompose aucun profil : ce travail
reste réservé au PBI 1.8.

## Overrides auditables

[`config/test-classification-overrides.json`](../config/test-classification-overrides.json) est réservé aux
exceptions ponctuelles que l’analyse statique ne peut résoudre. Chaque entrée cible exactement un framework,
un chemin et un sélecteur, puis fournit une classification ou un statut, une justification et une preuve
observable. Les doublons de ciblage sont refusés. Un override ne doit ni utiliser de motif global, ni
remplacer les règles génériques, ni convertir en masse les ambiguïtés en saisie manuelle.

Le fichier reste vide tant qu’aucune exception nécessaire et auditée n’est identifiée. Les cas ambigus sont
donc visibles dans l’inventaire au lieu d’être masqués.

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

## Limites actuelles

L’analyse reste statique. Elle ne développe pas les titres calculés, ne suit pas toutes les fabriques de tests
et ne reconstitue pas automatiquement le comportement d’une fixture définie ailleurs. Ces cas restent
`unresolved` lorsqu’aucune autre preuve n’est suffisante. Le PBI 1.6 approfondira la distinction entre cas
logiques et instances exécutées.

Ce PBI n’ajoute aucun marqueur, ne modifie aucune configuration de framework, aucun profil CI/CD et aucune
gate. L’inventaire est une preuve versionnée, pas encore un contrôle bloquant; l’enforcement relève du
PBI 1.7.
