# Feature 3 — Distribuer un moteur statistique Python réutilisable

**Description :** produire un package Python installable, versionné et utilisable par un consommateur externe au travers d’une API publique stable, sans dépendance à Azure DevOps, FastAPI, MongoDB, Redis ou au frontend.

**Flux de valeur :** permettre à un intégrateur d’exécuter une prévision conforme au contrat statistique sans dépendre de l’application Monte Carlo Azure ni de ses infrastructures.

**Backlog :** [`../backlog.md`](../backlog.md)

## Conditions d’entrée

- `14.1` et `14.2` confirment le package comme trajectoire soutenue et identifient les intégrateurs ;
- `2.20` stabilise le contrat statistique versionné ;
- `7.1` valide le modèle cible des dépendances internes.

## Attendus

### 3.1

- identifier les intégrateurs cibles ;
- décrire les usages soutenus : script, service tiers, notebook, application interne ;
- définir stabilité et support ;
- distinguer API soutenue et éléments internes ;
- ne pas redécider la stratégie produit de la Feature 14.

### 3.2

- choisir nom d’import et nom de distribution ;
- définir versions Python soutenues ;
- définir dépendances runtime autorisées ;
- exclure FastAPI, Pydantic, MongoDB, Redis, Azure DevOps et frontend ;
- décider explicitement de la place de NumPy ;
- attribuer la propriété des modèles, limites, erreurs et règles statistiques.

### 3.3

- définir commandes, résultats et erreurs exposés ;
- exposer un cas d’usage de haut niveau de type `simulate(command)` ;
- définir compatibilité et dépréciation ;
- rendre la version du contrat identifiable ;
- ne pas exposer quantiles internes, batching, histogrammes ou objets NumPy.

### 3.4

- créer la structure du package ;
- ajouter `[project]` et le système de build ;
- déclarer licence, version et dépendances ;
- prouver l’import ;
- ne pas déplacer tout le moteur.

### 3.5

- déplacer limites, Value Objects, commandes, résultats et erreurs métier ;
- migrer les consommateurs vers une autorité unique ;
- interdire les copies durables ;
- préserver la sémantique et les contrats externes.

### 3.6

- déplacer les deux modes de simulation ;
- déplacer tirages, batching, censures, percentiles, fiabilité et histogrammes ;
- conserver le calcul comme détail interne ;
- ne pas l’exposer directement comme API publique.

### 3.7

- déplacer l’orchestration du cas d’usage ;
- exposer la façade publique ;
- migrer le backend vers cette façade ;
- empêcher les appels directs aux détails internes ;
- préserver HTTP et MongoDB.

### 3.8

- bloquer les dépendances vers l’application et ses frameworks ;
- bloquer les imports profonds contournant l’API ;
- empêcher cycles et duplications ;
- intégrer les contrôles à la gate avec diagnostic actionnable.

### 3.9

- construire `wheel` et `sdist` ;
- inspecter leur contenu ;
- inclure licence et métadonnées ;
- exclure application, secrets, rapports et fichiers de développement ;
- définir la reproductibilité.

### 3.10

- installer le `wheel` dans un environnement propre ;
- exécuter la preuve hors de la racine du dépôt ;
- ne pas installer FastAPI, MongoDB, Redis ou frontend ;
- couvrir les deux modes, seed, percentiles, censures et erreurs ;
- distinguer cette preuve des tests internes.

### 3.11

- construire et tester le package isolément en CI ;
- produire des artefacts versionnés ;
- vérifier cohérence tag, version et artefact ;
- ne pas publier automatiquement sur PyPI sans décision de la Feature 14.

### 3.12

- documenter l’installation ;
- montrer la commande et les deux modes ;
- expliquer percentiles, censures, rejeu par seed et erreurs ;
- documenter version et compatibilité ;
- exécuter les exemples comme preuve.
