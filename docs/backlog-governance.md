# Gouvernance du backlog

## Responsabilité des documents

- [`backlog.md`](backlog.md) est le registre des Features, PBI, tailles, modèles Codex et dates de réalisation.
- Le présent document est l’autorité des règles de granularité, de préparation et d’engagement.
- [`backlog-expectations/`](backlog-expectations/README.md) porte les attendus, précédences et audits détaillés.

## Séquence prioritaire actuelle

Feature prioritaire : 7

1. **Feature 7 — Réduire le coût de changement par une architecture explicite et modulaire**
2. **Feature 8 — Disposer de données Azure DevOps fiables et contextualisées par sprint**
3. **Feature 9 — Disposer de prévisions rejouables dans le temps et calibrées**
4. **Feature 10 — Disposer d’une expérience de simulation cohérente et de restitutions fiables**
5. **Feature 11 — Rendre les traitements coûteux exécutables à l’échelle**, lorsque les mesures le justifient.

Une position dans cette séquence n’autorise aucun développement. Une Feature ouverte doit d’abord être
raffinée puis déclarée conforme. La Feature 8 ne devient engageable qu’après la clôture de la Feature 7 et son
propre raffinement selon le présent standard.

## Registre de préparation des Features

| Feature | Statut de préparation |
| ---: | --- |
| 3 | À raffiner avant engagement |
| 4 | À raffiner avant engagement |
| 5 | À raffiner avant engagement |
| 6 | À raffiner avant engagement |
| 7 | Conforme au standard de granularité |
| 8 | À raffiner avant engagement |
| 9 | À raffiner avant engagement |
| 10 | À raffiner avant engagement |
| 11 | À raffiner avant engagement |
| 12 | À raffiner avant engagement |
| 13 | À raffiner avant engagement |
| 14 | À raffiner avant engagement |

Les Features 1 et 2 sont réalisées. Leur découpage historique ne constitue pas une dérogation pour les travaux
futurs.

## Doctrine de granularité orientée outcomes

> Un PBI porte un résultat architectural cohérent, une seule raison principale de changer et une publication
> autonome. Il peut inclure l’implémentation, les tests, la documentation, la migration locale et le retrait de
> l’ancien chemin nécessaires à ce même résultat.

La protection contre un nouveau PBI 2.21 ne doit pas produire l’excès inverse. Un contrat extrait, un
consommateur migré, un import bloqué, une ancienne déclaration retirée, un adaptateur disponible, une
documentation publiée ou un téléchargement disponible ne sont normalement pas des PBI autonomes. Ce sont
des éléments de réalisation ou de clôture de l’état architectural qu’ils rendent possible.

### Propriétés obligatoires d’un PBI

Chaque PBI démontre :

- un résultat observable ;
- une seule raison principale de changer ;
- une frontière architecturale principale ;
- une famille cohérente d’invariants ;
- une preuve principale ;
- un état publiable autonome.

Lorsque tous les éléments concourent à ce même outcome, le PBI peut inclure :

- le contrat local et son implémentation ;
- la migration d’un consommateur ou d’un groupe de consommateurs fortement cohésif ;
- les tests ciblés et la documentation durable ;
- le retrait de l’ancien chemin et le contrôle empêchant sa réintroduction ;
- l’intégration mécanique à une gate existante.

Ces opérations ne deviennent pas des responsabilités indépendantes lorsqu’aucune ne procure seule un état
utile et publiable.

### Découpage toujours obligatoire

Un raffinement distinct reste obligatoire pour :

- plusieurs domaines métier ou plusieurs cas d’usage indépendants ;
- Cloud et Server/TFS lorsque leurs comportements diffèrent ;
- plusieurs ports indépendants ou plusieurs mécanismes de persistance ;
- plusieurs familles indépendantes de diagnostics ;
- UI, PDF et CSV lorsqu’ils portent des comportements autonomes ;
- code produit et infrastructure de publication ;
- identité de snapshot et orchestration DAG ;
- création d’un système de preuve et enforcement transversal ;
- pré-commit, pré-push, worktree détaché et CI lorsqu’ils introduisent des comportements nouveaux distincts ;
- plusieurs hotspots sans cohésion, restitutions fonctionnelles ou migrations publiables séparément.

La présence de tests, de documentation, d’un diagnostic, d’un retrait d’ancien code ou d’un contrôle local ne
constitue pas à elle seule une seconde responsabilité.

## Tailles

- **XXS** et **XS** : outcomes locaux autorisés, sans objectif artificiel de petitesse.
- **S** : taille normale d’un outcome architectural local complet.
- **M** : outcome unique techniquement délicat, accompagné d’une justification spécifique.
- **L** et **XL** : tailles interdites à l’engagement et nécessitant un raffinement.

Aucune taille n’autorise plusieurs raisons de changer. Un PBI `M` explique pourquoi sa difficulté ne provient
pas d’une agrégation de résultats.

## Signaux de revue de découpage

Les seuils suivants déclenchent une revue, pas une violation automatique :

```text
plus de 8 fichiers de production
plus de 15 fichiers versionnés au total
plus de 2 frontières architecturales
plus d’une famille d’invariants
plus d’un résultat observable
plus d’un chemin d’exécution réellement nouveau
```

Un dépassement peut être accepté seulement si l’attendu démontre une raison de changer unique, une forte
cohésion et l’impossibilité raisonnable de publier les sous-étapes sans état transitoire artificiel. Cette
revue est consignée dans les attendus et dans l’attestation humaine de la Feature prioritaire.

Il n’existe plus de maximum mécanique d’un consommateur, cinq fichiers de production, dix fichiers versionnés,
une étape de migration ou un contrôle de blocage séparé. La documentation et le retrait de l’ancien chemin
font partie de la définition de fini de l’outcome concerné.

## Structure obligatoire des attendus

```markdown
## X.Y — État obtenu

- **Taille :** XXS | XS | S | M
- **Outcome :** résultat observable et autonome
- **Raison principale de changer :** une raison
- **Frontière principale :** une frontière architecturale
- **Famille d’invariants :** une famille cohérente
- **Preuve principale :** une preuve principale
- **Éléments de réalisation inclus :** opérations concourant à l’outcome
- **Hors périmètre :** exclusions explicites
- **Surface prévisionnelle :** N fichiers de production ; N fichiers versionnés
- **Prédécesseurs :** aucun ou liste explicite
- **Critères de clôture :** preuve et état publiable autonome
```

Un PBI `M` ajoute `Justification de la taille M`. Un titre purement opératoire ajoute une
`Justification du titre opératoire` démontrant la valeur architecturale autonome ; à défaut il doit être
fusionné dans son outcome parent.

## Cible quantitative de la Feature prioritaire

La Feature 7 vise 60 à 90 PBI, avec une préférence pour 65 à 80. Plus de 90 PBI refuse la version. Sous 55,
la revue doit démontrer qu’aucun PBI transversal comparable au 2.21 n’a été recréé. Le compteur final provient
du registre reconstruit et jamais d’une cible arbitraire.

## Contrôle automatique et revue humaine

Le contrôle spécialisé vérifie les éléments structurels :

- identifiants uniques, tailles reconnues et absence de `L` ou `XL` dans une Feature engageable ;
- justification spécifique des PBI `M` ;
- présence et unicité des champs obligatoires ;
- cohérence entre registre, attendus, dates et statut de préparation ;
- prédécesseurs existants, antérieurs, non dupliqués, réalisés avant leurs dépendants et graphe acyclique ;
- absence de sections ou de lignes d’audit orphelines ;
- audit complet de la Feature prioritaire ;
- traitement explicite des titres ressemblant à de simples opérations.

Il ne prétend pas résoudre seul l’analyse sémantique. L’attestation humaine synthétise la revue de chaque PBI :
outcome autonome, raison de changer, frontière et preuve principales, absence de simple tâche technique et
possibilité de publier seul. Les exceptions éventuelles sont détaillées séparément.

Le contrôle ne refuse pas automatiquement : contrat et migration locale, règle et diagnostic, implémentation
et non-régression, migration et retrait de l’ancien chemin, tests et documentation. Le champ `Éléments de
réalisation inclus` est précisément prévu pour les regrouper lorsqu’ils servent le même outcome.

Exécution directe :

```powershell
.\.venv\Scripts\python.exe Scripts/check_backlog_atomicity.py
```

La quality gate conserve deux diagnostics : `Backlog consistency` pour dates, compteurs et synthèses ;
`Backlog atomicity` pour granularité, attendus, statuts, précédences et audit humain.

## Préparation et engagement d’une Feature

Une Feature ouverte n’est engageable que lorsque :

- tous ses PBI possèdent leurs attendus complets ;
- aucun PBI n’est `L` ou `XL` et chaque `M` est justifié ;
- le graphe de précédence est acyclique ;
- chaque PBI est publiable seul et ne dépend pas d’un futur PBI ;
- les responsabilités relevant d’autres Features leur ont été restituées ;
- l’attestation humaine et le contrôle structurel concluent à 100 % de conformité.

Les Features non retraitées restent `À raffiner avant engagement` et ne sont pas validées sémantiquement par
le contrôle spécialisé.

## Retour d’expérience du PBI 2.21

Le PBI 2.21 est le contre-exemple officiel de concentration. Il a cumulé identité de snapshot, attestations,
orchestration DAG, parallélisme, preuves, enforcement, hooks Git, worktree détaché, rapports, documentation et
publication. Sa livraison a protégé les garanties attendues mais son étendue ne doit jamais servir de modèle.

La correction n’est pas de transformer chaque opération de fabrication en micro-PBI. Le bon niveau est
l’outcome cohésif : une seule raison de changer, ses éléments nécessaires, sa preuve principale et un état
publiable autonome.

## Gate README

La règle issue du PBI 1.11 exige qu’une évolution pertinente de `README.md` soit réellement stagée avec tout
commit. La gate vérifie le contenu indexé et refuse un commit si le README est absent du staging ou seulement
modifié dans le worktree. Une modification artificielle ne satisfait pas cette règle.

## Gestion des statuts, dates et compteurs

La colonne `Réalisé le` est l’autorité de statut : vide signifie non réalisé, une date `JJ/MM/AAAA` signifie
réalisé. Une Feature déclarée `Conforme au standard de granularité` est réalisée progressivement : elle peut
donc rester ouverte avec certains PBI datés et les suivants encore vides. Une date reste interdite tant que la
Feature est `À raffiner avant engagement`, et un PBI daté exige que tous ses prédécesseurs le soient déjà.
Une priorité peut apparaître à `0/N` sans date inventée.

`python Scripts/check_backlog_consistency.py --write` régénère les compteurs, pourcentages, Feature en cours,
prochain PBI et répartition des modèles. Sans `--write`, toute divergence est bloquante.

## Attribution des modèles Codex

- **Sol Medium** : cadrage, observation ou changement local prévisible.
- **Sol Élevé** : réalisation bornée aux frontières connues.
- **Sol Très élevé** : contrat, migration ou contrôle demandant un arbitrage délicat.
- **Sol Ultra** : raisonnement exceptionnel sur un outcome unique.

Le modèle estime la profondeur de raisonnement ; la taille estime l’ampleur de l’outcome après découpage.

## Répartition actuelle des 152 PBI non réalisés

| Modèle Codex | Nombre de PBI |
| --- | ---: |
| Sol Medium | 15 |
| Sol Élevé | 27 |
| Sol Très élevé | 107 |
| Sol Ultra | 3 |
| **Total** | **152** |
