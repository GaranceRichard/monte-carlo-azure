# Gouvernance du backlog

## Responsabilité des documents

- [`backlog.md`](backlog.md) est le registre de pilotage : il porte les Features, les PBI, leur complexité, leur modèle Codex et leur date de réalisation.
- Le présent document porte les règles transverses de gouvernance, de statut, de raffinement et d’attribution.
- [`backlog-expectations/`](backlog-expectations/README.md) porte les attendus détaillés des Features et PBI ainsi que les sujets conditionnels.

## Séquence prioritaire actuelle

1. **Feature 2 — Garantir la fiabilité du cœur statistique**
2. **Feature 8 — Fiabiliser les données Azure DevOps et leur cohérence temporelle**
3. **Feature 9 — Rejouer les prévisions dans le temps et les calibrer**
4. **Feature 10 — Concevoir l’expérience et les restitutions**
5. **Feature 11 — Exécuter les traitements coûteux à l’échelle**, seulement lorsque les benchmarks
   démontrent que l’exécution interactive ne suffit plus

Cette séquence exprime les dépendances `Feature 2 → Feature 8 → Feature 9 → Feature 10 / Feature 11`.
La Feature 11 n’est pas un préalable intégral à la Feature 10 : les deux peuvent progresser après la logique
métier de la Feature 9, et seuls les traitements mesurés comme coûteux basculent vers l’asynchrone.
La Feature 14 porte en parallèle la décision de positionnement et de diffusion.

Aucun PBI ne peut être considéré comme committable si `README.md` n’a pas reçu une évolution pertinente, réellement stagée avec le changement livré.

## Gate README

### Règle portée par le PBI 1.11

La gate de commit doit vérifier le contenu réellement stagé et refuser tout commit lorsque :

- des changements sont destinés au commit ;
- `README.md` n’est pas modifié et stagé ;
- `README.md` est modifié dans le worktree mais absent du staging.

La règle s’applique sans exception implicite aux changements de code, tests, documentation, configuration, CI/CD, architecture, backlog et maintenance.

La modification du README doit être pertinente et refléter le changement livré. Une modification artificielle ou purement mécanique ne satisfait pas l’intention de la gate.

## Gestion des statuts et des dates

La colonne `Réalisé le` constitue l’autorité de statut du registre :

- une cellule vide désigne un PBI non réalisé ;
- une date au format `JJ/MM/AAAA` désigne un PBI réalisé à cette date ;
- les totaux de la synthèse et la répartition par modèle sont recalculés à partir des tables de PBI.

`python Scripts/check_backlog_consistency.py --write` régénère ces deux sections depuis cette autorité.
Sans `--write`, le même script est bloquant dans la garde du dépôt et refuse toute divergence de compteurs,
pourcentages, Feature en cours, prochain PBI ou liste de reliquats.

Un changement de statut exige une preuve présente dans le dépôt ou son historique. Une description
d'attendus, un titre de commit documentaire ou l'existence d'un PBI ne constituent pas une preuve de
livraison. La date retenue doit être démontrable et documentée ; à défaut, le PBI reste ouvert.

## Complexité des PBI

- **S** : résultat borné et local, aux dépendances connues, dont la preuve est simple et ciblée.
- **M** : résultat cohérent pouvant toucher plusieurs fichiers, aux frontières connues, nécessitant plusieurs vérifications coordonnées.
- **L** : résultat transverse portant un objectif principal unique, avec plusieurs composants ou consommateurs et une preuve complète dédiée.
- **XL** : transformation réunissant plusieurs résultats indépendants, sous-systèmes ou migrations et imposant un raffinement préalable.

Aucun PBI `XL` ne peut être engagé.

## Règle de raffinement des PBI

Un PBI doit produire un résultat principal démontrable et rester livrable indépendamment des PBI suivants.

Un raffinement est obligatoire lorsqu’un item combine au moins deux natures de transformation parmi :

- introduction d’un modèle ou d’une abstraction ;
- migration de ses consommateurs ;
- modification ou alignement d’un algorithme ;
- création d’un corpus de preuve ;
- automatisation d’une gate ;
- modification d’un contrat externe ;
- migration ou invalidation de données.

Les signaux suivants imposent une revue de découpage sans constituer des limites mécaniques :

- plusieurs familles d’invariants indépendantes ;
- modification substantielle simultanée du backend, du frontend, des persistances et des restitutions ;
- impossibilité de décrire la valeur livrée en une phrase sans plusieurs résultats reliés par « et » ;
- nécessité de corriger des dettes historiques étrangères au résultat principal ;
- validation complète exigeant plusieurs dispositifs de preuve qui pourraient être livrés séparément.

Aucun PBI `XL` ne peut être engagé. Un PBI `L` reste autorisé lorsqu’il porte un seul résultat cohérent malgré une réalisation transverse.

## Retour d’expérience du PBI 2.4

Le PBI 2.4 a livré le résultat attendu, mais son périmètre était trop large pour une complexité `L`. Il réunissait plusieurs familles de Value Objects, leur intégration dans deux langages, la migration des frontières et consommateurs, la suppression d’autorités concurrentes et la reprise de la preuve qualité.

Cette réalisation ne doit pas servir de modèle de granularité. Pour la suite de la Feature 2 :

- un PBI porte un seul résultat statistique ou architectural principal ;
- l’introduction d’une abstraction est séparée de l’alignement des algorithmes ;
- la construction d’un corpus est séparée de son exécution ;
- l’alignement d’une famille de règles est séparé des autres familles ;
- le reporting de parité, son intégration à la gate et la compatibilité versionnée restent trois résultats distincts ;
- aucun PBI ne combine modèle, algorithmes, corpus, gate et migration.

## Attribution des modèles Codex

Les modèles Codex sont attribués selon le niveau minimal capable de réaliser le PBI avec une fiabilité suffisante.

- **Sol Medium** : cadrage, documentation, protocole, observation, analyse ou décision ; modifications techniques locales et très prévisibles.
- **Sol Élevé** : réalisation technique bornée, généralement multi-fichiers, dont les frontières et le résultat attendu sont déjà connus.
- **Sol Très élevé** : statistiques, sécurité, concurrence, CI/CD, contrats transverses, compatibilité, migrations ou refactors dont plusieurs choix restent à arbitrer.
- **Sol Ultra** : transformation structurelle massive nécessitant l’exploration et la modification coordonnées de plusieurs sous-systèmes fortement couplés.

La complexité du PBI et le modèle Codex sont deux informations distinctes :

- la **complexité** évalue l’ampleur du travail ;
- le **modèle** évalue la profondeur de raisonnement et l’incertitude nécessaires.

Un PBI `L` peut relever de Sol Élevé lorsqu’il est volumineux mais prévisible, tandis qu’un PBI `S` peut relever de Sol Très élevé lorsqu’il porte une décision de sécurité délicate.

Aucun PBI actuel ne relève de **Sol Minimal**, réservé aux corrections mécaniques telles que le formatage, le renommage évident ou la résolution d’une erreur de lint isolée.

## Répartition actuelle des 114 PBI non réalisés

| Modèle Codex | Nombre de PBI |
| --- | ---: |
| Sol Medium | 15 |
| Sol Élevé | 30 |
| Sol Très élevé | 65 |
| Sol Ultra | 4 |
| **Total** | **114** |
