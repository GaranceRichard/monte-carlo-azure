# Feature 10 — Disposer d’une expérience de simulation cohérente et de restitutions fiables

Le résultat observable, le flux de valeur et le statut de la Feature sont définis dans le
[`registre du backlog`](../backlog.md). Ce document ne porte que ses attendus détaillés.

## Périmètre

La Feature 10 porte :

- la configuration d'une simulation ponctuelle ou d'un futur audit rétrospectif ;
- la progression présentée à l'utilisateur, quel que soit le mode d'exécution ;
- l'historique local, la comparaison des exécutions et le rejeu par seed ;
- les restitutions UI, PDF et export ;
- le cache local et ses migrations.

Elle ne porte ni le protocole de backtesting et de calibration de la Feature 9, ni l'infrastructure de jobs,
workers, annulation et reprise de la Feature 11.

## Cache local

Pour l'audit rétrospectif futur, la clé conceptuelle du cache est :

```text
empreinte des données + paramètres + seed + version moteur + version contrat statistique
```

Une entrée n'est réutilisable que si ces cinq dimensions sont identiques. La configuration affichée,
l'historique et les comparaisons doivent conserver les informations nécessaires pour expliquer une
invalidation ou une réutilisation.

## Restitution de l'audit futur

L'expérience devra rendre lisibles les points de rejeu, la trajectoire de crédibilité, la confrontation au
résultat réel, les diagnostics temporels et la calibration sans les présenter comme une surveillance en
temps réel. Une progression UI n'implique pas à elle seule une exécution asynchrone.

## 10.10 — Composants frontend à responsabilités multiples audités et découpés

L’audit et le découpage frontend doivent :

- inventorier les composants, hooks et services cumulant plusieurs responsabilités ;
- mesurer leur complexité, leurs dépendances et leurs motifs de modification ;
- découper le frontend par capacité métier et responsabilité cohésive ;
- distinguer conteneurs, sections métier et composants de présentation ;
- attribuer explicitement la propriété de l’état ;
- exposer une API publique par Feature frontend ;
- interdire les imports de fichiers internes entre Features ;
- préserver les comportements, l’accessibilité, les contrats UI/PDF et la couverture de tests ;
- éviter toute limite arbitraire de lignes ou tout micro-découpage sans valeur démontrée.

Un éventuel socle UI partagé ne doit être engagé qu’après preuve de duplication significative et ne doit contenir aucune règle métier.
