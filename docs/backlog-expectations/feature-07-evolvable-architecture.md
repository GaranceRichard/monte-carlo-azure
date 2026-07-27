# Feature 7 — Établir une architecture applicative évolutive

**Description :** formaliser une architecture hexagonale modulaire, supprimer les cycles et isoler les cas d’usage des technologies d’accès aux données, de calcul, de persistance et de restitution.

**Flux de valeur :** permettre l’évolution du produit sans accroître le couplage, les responsabilités concentrées, les régressions ou le coût de chaque modification, grâce à des modules cohésifs communiquant par des contrats explicites.

**Backlog :** [`../backlog.md`](../backlog.md)

## Résultat attendu du PBI 7.1

Le modèle cible doit formaliser une architecture hexagonale modulaire et préciser pour chaque module :

- sa responsabilité métier ;
- son API publique ;
- les commandes, requêtes, résultats et événements qu’il expose ;
- les données et états dont il est propriétaire ;
- les dépendances autorisées et interdites ;
- les ports entrants et sortants ;
- les adaptateurs techniques associés ;
- les éléments réellement partagés, limités à des contrats ou Value Objects stables.

Le modèle doit empêcher qu’un simple découpage de répertoires masque des dépendances transverses ou un état mutable partagé.

## Résultat attendu du PBI 7.2

Le contrôle automatisé doit notamment bloquer :

- les dépendances du domaine vers React, FastAPI, MongoDB, Azure DevOps ou toute autre technologie périphérique ;
- les imports profonds dans les fichiers internes d’un autre module ;
- les contournements des API publiques de modules ;
- les dépendances directes entre adaptateurs ;
- les cycles entre modules ;
- l’utilisation des DTO de transport hors des adaptateurs et mappers autorisés ;
- la constitution d’un répertoire `shared` sans responsabilité ni contrat explicite.

Les règles doivent être exécutées par la gate normative et produire un diagnostic actionnable sans exemption silencieuse.

## Résultat attendu du PBI 7.10

Les contrats de communication inter-modules doivent :

- distinguer commandes, requêtes, résultats et événements ;
- définir les entrées, sorties et erreurs métier de chaque module ;
- préciser les communications synchrones et asynchrones ;
- interdire le partage direct d’état mutable ;
- définir les responsabilités transactionnelles ;
- documenter les règles d’évolution et de compatibilité des contrats internes ;
- conserver les données Azure DevOps contextualisées dans le navigateur et limiter la frontière backend aux
  données statistiques minimisées.

## Résultat attendu du PBI 7.11

Le composition root doit :

- centraliser l’assemblage des cas d’usage, ports et adaptateurs ;
- injecter les implémentations concrètes depuis la périphérie ;
- supprimer les instanciations techniques dispersées dans le domaine et les cas d’usage ;
- permettre de remplacer les adaptateurs Azure DevOps, moteur de prévision, persistance et reporting ;
- fournir des implémentations en mémoire pour les tests ;
- rendre la configuration d’exécution explicite et testable.

## Résultat attendu du PBI 7.12

Les contrats des ports et adaptateurs doivent être prouvés par :

- une suite de conformité commune par port ;
- les mêmes invariants appliqués à chaque adaptateur d’un port ;
- des tests de contrat pour les moteurs Python et TypeScript ;
- des tests de contrat pour MongoDB, `localStorage` et les adaptateurs mémoire ;
- des tests négatifs sur les données interdites ;
- des tests d’intégration aux frontières sans duplication des règles métier ;
- la preuve que le remplacement d’un adaptateur ne modifie pas la sémantique du cas d’usage.

## Résultat attendu du PBI 7.13

- isoler les lectures de l’horloge utilisées pour les timestamps, expirations et métadonnées techniques ;
- isoler les générateurs d’identifiants sans sémantique statistique ;
- injecter des implémentations déterministes dans les tests ;
- conserver la résolution de seed et le PRNG dans la Feature 2 ;
- ne modifier ni les contrats publics ni le sens des résultats statistiques.

## Résultat attendu du PBI 7.9

- objet-frontière typé limité aux données statistiques minimisées ;
- contrats dédiés aux données autorisées vers le backend ;
- interdiction architecturale des dépendances entre contexte ADO et moteur backend ;
- tests négatifs de contrat ;
- contrôle du graphe d’imports ;
- conservation du contrôle lexical comme défense complémentaire, non comme garantie unique.
