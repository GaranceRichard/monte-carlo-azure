# Feature 10 — Fiabiliser l’expérience de simulation et les restitutions

**Description :** séparer les responsabilités frontend et PDF, fiabiliser l’état des simulations et garantir une présentation cohérente sur tous les supports.

**Flux de valeur :** empêcher l’affichage ou l’export de résultats devenus incohérents et permettre au décideur de retrouver la même information dans l’interface et dans les rapports.

**Backlog :** [`../backlog.md`](../backlog.md)

## Résultat attendu du PBI 10.10

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
