# Feature 11 — Rendre les traitements coûteux exécutables à l’échelle

Le résultat observable, le flux de valeur et le statut de la Feature sont définis dans le
[`registre du backlog`](../backlog.md). Ce document ne porte que ses attendus détaillés.

## Principe de charge

La charge conceptuelle d'un audit rétrospectif est :

```text
points de rejeu × scénarios × simulations × fenêtres
```

Cette expression sert à construire les benchmarks ; elle ne suffit pas à fixer un seuil. Aucun volume,
temps ou nombre de combinaisons ne doit être déclaré « interactif » ou « asynchrone » avant mesures sur des
enveloppes représentatives.

## Dépendances et frontière

- la Feature 9 fournit la logique métier mesurable ;
- la Feature 10 fournit l'expérience et consomme un contrat de progression commun ;
- la Feature 11 choisit et met en œuvre le mode d'exécution selon les benchmarks.

La Feature 11 n'est donc pas un préalable intégral à la Feature 10. Le chemin interactif reste utilisable
tant que les mesures le justifient ; seuls les traitements coûteux basculent vers les jobs.

## Attendus par PBI

### 11.1 — Modèle de charge conceptuelle et enveloppes mesurables établis

- définir les dimensions de charge, leur cardinalité et leurs interactions ;
- inclure CPU, mémoire, durée, concurrence, volume de résultats et coût de persistance ;
- construire des enveloppes réalistes sans seuil arbitraire ;
- identifier les métriques nécessaires à la décision interactif/asynchrone.

### 11.2 — Performances interactives et asynchrones comparées par benchmark

- mesurer le chemin interactif sur les enveloppes définies ;
- mesurer le coût propre aux jobs, files, persistances et workers ;
- comparer latence, débit, mémoire, concurrence, stabilité et coût ;
- conserver les conditions et versions de chaque benchmark.

### 11.3 — Seuil interactif ou asynchrone justifié par les mesures

- formaliser une politique explicable fondée sur les métriques mesurées ;
- prévoir une estimation de charge avant lancement ;
- rendre la décision visible et compréhensible dans l'expérience ;
- versionner la politique et permettre sa révision après de nouveaux benchmarks ;
- ne fixer aucun seuil avant preuve empirique.

### 11.4 — Jobs et résultats agrégés persistés de façon minimisée

La persistance MongoDB future est limitée à :

- paramètres normalisés ;
- seed ;
- versions du moteur, du PRNG et du contrat statistique ;
- empreinte des données ;
- état et progression du job ;
- diagnostics et résultats agrégés ;
- métriques de durée et de ressources utiles ;
- dates de création, mise à jour et expiration TTL.

Sont exclus :

- PAT et secrets ;
- URL Azure DevOps ;
- work items et identifiants détaillés ;
- titres, descriptions et historique brut ;
- utilisateurs et équipes ;
- organisation, projet et contexte Azure DevOps.

Les identifiants techniques indispensables sont pseudonymisés. La minimisation et la pseudonymisation ne
doivent pas être qualifiées d'anonymisation sans preuve dédiée.

### 11.5 — États de jobs, annulation et reprise maîtrisés

- définir les états et transitions de job ;
- exposer ces états à travers la progression applicative livrée par le PBI 7.53 ;
- permettre l'annulation coopérative et libérer les ressources ;
- définir reprise, nouvelle tentative, idempotence et résultat partiel ;
- distinguer interruption utilisateur, erreur transitoire et échec définitif.

### 11.6 — Workers distribuables avec ressources maîtrisées

- isoler l'exécution des jobs des requêtes interactives ;
- borner concurrence, CPU, mémoire, temps et volume de résultats ;
- garantir idempotence et absence de double publication ;
- définir la distribution, la reprise après perte d'un worker et la compatibilité de versions ;
- préserver les invariants statistiques de la Feature 2.

### 11.7 — Traitements, ressources et coûts observables

- corréler job, worker, version, progression et métriques sans réintroduire de contexte Azure DevOps ;
- observer latence de file, durée de calcul, mémoire, CPU, annulations, reprises et échecs ;
- définir alertes opérationnelles sur l'infrastructure d'exécution sans transformer le produit en monitoring
  continu des prévisions ;
- suivre les coûts par enveloppe de charge.

### 11.8 — Charge nominale, pointe, endurance et reprise validées

- démontrer le comportement nominal et en pointe ;
- vérifier endurance, files saturées, annulation et reprise ;
- mesurer la dégradation et les limites de ressources ;
- confirmer ou réviser la politique interactif/asynchrone ;
- documenter les limites non résolues.

## Cache et déduplication

La déduplication d'un audit repose sur la clé conceptuelle :

```text
empreinte des données + paramètres + seed + version moteur + version contrat statistique
```

Une correspondance partielle ne suffit pas à réutiliser un résultat. La persistance serveur des jobs et le
cache local de la Feature 10 peuvent partager cette identité conceptuelle sans partager leurs données
contextuelles.

## Hors périmètre

- protocole métier de backtesting et calibration ;
- conception des diagnostics temporels ;
- monitoring continu des prévisions ;
- collecte permanente des données Azure DevOps ;
- alertes produit en temps réel.
