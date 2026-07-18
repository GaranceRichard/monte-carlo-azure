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

## Exemples vérifiés dans le dépôt

Ces exemples illustrent la décision après lecture du comportement ; ils ne constituent pas un inventaire ni
des métadonnées appliquées aux tests :

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

## Limites du PBI 1.4

Ce PBI définit seulement le contrat. Il ne crée aucun inventaire complet, ne classe aucun test existant,
n'ajoute aucun marqueur, ne modifie aucune configuration de framework ou de CI et ne rend pas la
classification bloquante. La collecte, la classification automatique, le dénombrement des instances et le
gate bloquant relèvent des PBI suivants.
