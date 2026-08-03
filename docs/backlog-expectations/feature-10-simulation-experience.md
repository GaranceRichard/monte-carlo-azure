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

Statut : À raffiner avant engagement.

Les modèles de présentation, leurs API, la séparation UI-rapports et les contrôles interdisant les calculs
métier dans les rendus sont des fondations livrées par la Feature 7. La Feature 10 conserve l’expérience
utilisateur, le contenu et la pagination PDF, les téléchargements, l’accessibilité, les formulations, la
cohérence visuelle et les comportements fonctionnels des exports. Elle devra raffiner ces ancres avant
engagement sans redécouper les frontières architecturales.

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

## 10.10 — Téléchargements de restitution compréhensibles et accessibles

Les parcours de téléchargement doivent :

- annoncer clairement le format et le contenu produit ;
- rendre l’action accessible au clavier et aux technologies d’assistance ;
- conserver un diagnostic utile lorsque la restitution échoue ;
- ne pas dupliquer les mappers ou les moteurs de rendu de la Feature 7.
