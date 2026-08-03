# Feature 8 — Disposer de données Azure DevOps fiables et contextualisées par sprint

Le résultat observable, le flux de valeur et le statut de la Feature sont définis dans le
[`registre du backlog`](../backlog.md). Ce document ne porte que ses attendus détaillés.

## Frontière avec la Feature 7

Statut : À raffiner avant engagement.

La Feature 8 consomme les ports communs, les adaptateurs de connexion de référence, les objets temporels,
les diagnostics et les règles de dépendance livrés par la Feature 7. Elle conserve les résultats fonctionnels
de collecte, de qualification et de contexte d’itération : implémentations Cloud et Server/TFS complètes,
pagination, lots partiels, provenance, types et états, périmètres d’équipe, qualité des données, itérations,
contexte de sprint et compatibilité fonctionnelle. Les PBI 8.1 à 8.14 sont des ancres à raffiner et ne
redéfinissent aucune fondation architecturale.

## 8.14 — Prérequis de stabilité du flux qualifiés avant prévision

- détecter les ruptures, dérives et périodes non représentatives ;
- signaler les historiques dont la stabilité est insuffisante ;
- distinguer absence de preuve et preuve d’instabilité ;
- dégrader ou bloquer la recommandation lorsque la prévision ne peut pas être défendue ;
- ne pas transformer l’absence d’une politique WIP connue en preuve automatique d’imprévisibilité.
