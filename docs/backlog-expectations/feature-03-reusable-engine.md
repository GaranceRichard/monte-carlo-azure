# Feature 3 — Disposer d’un moteur statistique Python réutilisable et distribuable

Le résultat observable, le flux de valeur et le statut de la Feature sont définis dans le
[`registre du backlog`](../backlog.md). Ce document ne porte que ses attendus détaillés.

## Conditions d’entrée

- `14.1` et `14.2` confirment le package comme trajectoire soutenue et identifient les intégrateurs ;
- `2.20` stabilise le contrat statistique versionné ;
- `7.71` démontre dans le workspace que les frontières internes sont publiées et contrôlées avant leur distribution.

## Attendus

### 3.1 — Cas d’intégration et niveau de support du package définis

- identifier les intégrateurs cibles ;
- décrire les usages soutenus : script, service tiers, notebook, application interne ;
- définir stabilité et support ;
- distinguer API soutenue et éléments internes ;
- ne pas redécider la stratégie produit de la Feature 14.

### 3.2 — Frontière, nom et dépendances du package définis

- choisir nom d’import et nom de distribution ;
- définir versions Python soutenues ;
- définir dépendances runtime autorisées ;
- exclure FastAPI, Pydantic, MongoDB, Redis, Azure DevOps et frontend ;
- décider explicitement de la place de NumPy ;
- consommer les propriétés et frontières internes décidées par la Feature 7 sans les redéfinir.

### 3.3 — API publique, erreurs et politique de compatibilité définies

- définir commandes, résultats et erreurs exposés ;
- exposer un cas d’usage de haut niveau de type `simulate(command)` ;
- définir compatibilité et dépréciation ;
- rendre la version du contrat identifiable ;
- ne pas exposer quantiles internes, batching, histogrammes ou objets NumPy.

### 3.4 — Package installable avec métadonnées valides

- créer la structure du package ;
- ajouter `[project]` et le système de build ;
- déclarer licence, version et dépendances ;
- prouver l’import ;
- ne pas déplacer tout le moteur.

### 3.5 — Contrats métier internes exposés par l’API publique du package

- exposer les contrats internes préparés par la Feature 7 sans en créer une seconde autorité ;
- choisir uniquement les commandes, résultats, erreurs et Value Objects soutenus publiquement ;
- préserver la sémantique et les versions statistiques ;
- ne migrer aucun consommateur applicatif dans ce PBI.

### 3.6 — Moteur interne inclus derrière l’API publique du package

- inclure le moteur préparé par la Feature 7 dans la distribution ;
- conserver tirages, batching, censures, percentiles, fiabilité et histogrammes comme détails internes ;
- ne pas déplacer ni redécouper ces responsabilités dans la Feature 3 ;
- ne pas exposer le moteur directement comme API publique.

### 3.7 — Façade publique de simulation disponible dans le package

- exposer la façade publique ;
- stabiliser sa commande, son résultat et ses erreurs ;
- préserver les contrats externes soutenus ;
- laisser les migrations de consommateurs internes à la Feature 7.

### 3.8 — Isolation du package démontrée par un consommateur externe

- appliquer l’autorité de dépendances livrée par la Feature 7 au périmètre distribué ;
- démontrer depuis un consommateur externe l’absence de dépendance à FastAPI, MongoDB et au frontend ;
- refuser les imports profonds propres au package ;
- ne pas recréer un second moteur de contrôle architectural.

### 3.9 — Distributions `wheel` et `sdist` reproductibles

- construire `wheel` et `sdist` ;
- inspecter leur contenu ;
- inclure licence et métadonnées ;
- exclure application, secrets, rapports et fichiers de développement ;
- définir la reproductibilité.

### 3.10 — Installation isolée et usage par un consommateur externe démontrés

- installer le `wheel` dans un environnement propre ;
- exécuter la preuve hors de la racine du dépôt ;
- ne pas installer FastAPI, MongoDB, Redis ou frontend ;
- couvrir les deux modes, seed, percentiles, censures et erreurs ;
- distinguer cette preuve des tests internes.

### 3.11 — Artefacts versionnés du package produits dans la CI

- construire et tester le package isolément en CI ;
- produire des artefacts versionnés ;
- vérifier cohérence tag, version et artefact ;
- ne pas publier automatiquement sur PyPI sans décision de la Feature 14.

### 3.12 — Guide exécutable d’intégration du package disponible

- documenter l’installation ;
- montrer la commande et les deux modes ;
- expliquer percentiles, censures, rejeu par seed et erreurs ;
- documenter version et compatibilité ;
- exécuter les exemples comme preuve.
