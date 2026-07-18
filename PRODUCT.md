# Product Vision

## Monte Carlo Azure

Monte Carlo Azure est un outil d'aide à la décision pour la planification sous incertitude.
Il transforme un historique Azure DevOps en projections probabilistes exploitables, sans exposer le PAT Azure DevOps au backend.

## Positionnement

Le produit s'adresse en priorité à :

- directeur de projet
- PMO
- responsables delivery
- responsables portefeuille
- directions programme ou transformation

Le produit ne remplace pas le jugement managérial. Il rend l'incertitude visible, mesurable et actionnable.

Trois dimensions métier restent distinctes :

- la qualité des données qualifie la profondeur historique, la complétude et les collectes Azure DevOps partielles ;
- l'incertitude de prévision qualifie la dispersion, la volatilité, les censures et la possibilité de calculer les percentiles requis ;
- la recommandation d'arbitrage traduit ces diagnostics en décision supportable, décision sous précautions, arbitrage humain ou blocage.

Le `Risk Score` conserve son calcul actuel à partir de `P50` et `P90` : il n'est ni une mesure de qualité des données, ni un substitut aux diagnostics ou à la recommandation.

## Problème traité

Les décisions de planification reposent encore souvent sur :

- des estimations subjectives
- des moyennes historiques peu explicites
- des story points hétérogènes
- des engagements calendaires non probabilisés

Les effets observés sont connus :

- engagements intenables
- arbitrages tardifs
- tensions opérationnelles
- perte de crédibilité en comité

Monte Carlo Azure répond à ce problème en produisant des distributions probabilistes à partir du throughput réel.

## Proposition de valeur

Le produit permet de :

- sécuriser une date à partir d'un backlog restant
- convertir un horizon cible en capacité livrable probable
- visualiser la dispersion et la stabilité d'un scénario
- consolider plusieurs équipes dans une lecture portefeuille
- expliciter un niveau de risque via percentiles et `Risk Score`

Valeur attendue :

- décisions explicitées par niveau de confiance
- arbitrages scope / délai plus structurés
- dialogue directionnel plus serein
- préparation COPIL plus rapide

## Capacités produit actuelles

Fonctionnalités actuellement présentes dans le produit :

- page publique GitHub Pages pour découvrir le produit sans backend
- mode démo accessible publiquement pour illustrer le parcours et les restitutions
- notice publique de connexion pour expliquer le mode Azure DevOps réel
- connexion Azure DevOps avec PAT côté navigateur
- sélection organisation -> projet -> équipe
- simulation Monte Carlo côté backend via `POST /simulate`
- deux modes de projection :
  - backlog vers semaines
  - semaines vers items
- visualisation des percentiles et distributions
- affichage d'un `Risk Score`
- en `backlog_to_weeks`, les censures à l'horizon sont explicites et lues à part
- export CSV du throughput hebdomadaire
- historique local des simulations récentes, contextualisé par équipe dans le navigateur
- cookie client `IDMontecarlo` pour relier un client anonyme à son historique persisté
- persistance MongoDB et restitution des 10 dernières simulations statistiques anonymes via `/simulations/history`
- configuration rapide des filtres types + états, mémorisée localement
- mode `Portefeuille` multi-équipes
- rapport PDF portefeuille avec synthèse décisionnelle et pages détaillées

Règle produit sur l'historique hebdomadaire :

- une semaine utilisable est une semaine complète du lundi au dimanche
- elle doit être entièrement comprise dans la période sélectionnée
- elle doit être déjà complètement écoulée au moment du calcul
- la semaine courante n'est donc jamais injectée partiellement dans la simulation

## Parcours de démo

Le produit propose un parcours de démonstration publique via GitHub Pages pour permettre une prise en main immédiate sans prérequis technique ni backend actif.

Processus cible :

- l'utilisateur arrive directement sur la démo publique
- il commence sur un écran de choix d'équipe qui présente les deux parcours disponibles
- il peut ensuite ouvrir la notice de connexion Azure DevOps
- la démo permet d'explorer le flux et les écrans avec des données préconfigurées
- les écrans de choix d'équipe et de simulation signalent explicitement ce contexte via un badge `Démo` dans l'en-tête
- la notice publique explique ensuite comment basculer vers un usage réel avec Azure DevOps

Objectif produit :

- rendre la valeur du produit visible avant toute configuration
- montrer le flux complet sans demander de `PAT`
- laisser l'utilisateur choisir explicitement entre une lecture équipe et une lecture portefeuille
- séparer clairement la découverte produit du mode réel connecté à Azure DevOps

## Cas d'usage

### 1. Sécuriser une date

Exemple :

- 80 items restants
- historique de throughput sur plusieurs semaines
- simulation de plusieurs milliers d'itérations

Restitution attendue :

- `P50` pour une lecture médiane
- `P90` pour une lecture prudente
  - en `backlog_to_weeks`, prudent = plus de semaines
- si certaines simulations n'atteignent pas le backlog avant l'horizon, elles sont comptées
  à part comme censures et n'entrent ni dans la distribution ni dans les percentiles
  - mais l'identifiabilité d'un `Pxx` continue, elle, d'être jugée sur le total de simulations
    lancées : si le rang n'est pas atteignable dans `n_sims`, le percentile reste absent
- la courbe de probabilité backlog reste plafonnée au taux réel de complétion, sans remonter
  artificiellement à `100%`
- `Risk Score` pour objectiver la dispersion

Décision supportée :

- accepter le niveau de risque
- ajuster le périmètre
- renforcer la capacité

### 2. Arbitrer une capacité cible

Question métier :

"Combien d'items peut-on livrer en N semaines avec un niveau de confiance donné ?"

Le produit répond à cette question via le mode `weeks_to_items`.

Lecture attendue :

- `P50` pour une lecture médiane
- `P90` pour une lecture prudente
  - en `weeks_to_items`, prudent = moins d'items garantis
- `Risk Score` calculé sur les percentiles métier du mode
  - `backlog_to_weeks`: `(P90 - P50) / P50`
  - `weeks_to_items`: `(P50 - P90) / P50`
  - si `P50` ou `P90` manque, le score n'est pas affiché

### 3. Piloter un portefeuille

Le mode portefeuille permet de :

- sélectionner plusieurs équipes
- consolider les projections
- comparer plusieurs hypothèses d'agrégation
- produire un support exportable pour revue de pilotage

Les scénarios actuellement proposés sont :

- `Indépendant`
- `Arrimé`
- `Friction`
- `Historique corrélé`

Lecture produit du scénario `Historique corrélé` :

- il ne s'agit pas d'un tirage indépendant par équipe
- le portefeuille additionne les throughputs observés sur les mêmes semaines pour toutes les équipes
- seules les semaines communes complètes sont conservées
- ce scénario conserve les variations simultanées observées, sans démontrer leurs causes, les dépendances
  opérationnelles, la substituabilité des équipes ou leur validité future

Le diagnostic comparatif portefeuille sépare explicitement :

- la qualité des historiques observés par équipe et les faits à vérifier au niveau portefeuille;
- la stabilité ou l'incertitude de chaque résultat simulé;
- la crédibilité de l'hypothèse sous-jacente et son type de preuve: observation, calcul, saisie utilisateur ou
  absence de preuve comparative.

Une distribution stable ne valide pas une hypothèse. Avec les seules données historiques, les résultats simulés
et un taux d'alignement manuel, le produit ne privilégie aucun scénario unique: la conclusion « preuves
insuffisantes pour privilégier une hypothèse » est un résultat métier valide. Le diagnostic détaillé n'est pas
affiché dans l'interface de génération; il est restitué dans une page dédiée du rapport portefeuille PDF, après
la synthèse et avant le détail des scénarios.

L'utilisateur peut choisir, sans sélection par défaut, un scénario de référence de pilotage. Ce choix facultatif
est une convention de gouvernance distincte de la recommandation issue des preuves: il ne modifie ni
`preferredScenario`, ni la crédibilité des hypothèses, ni les calculs. Lorsque les preuves sont insuffisantes,
la préconisation porte sur la démarche de documentation, de calibration et de backtest, pas sur un scénario.

Le rapport portefeuille gère aussi la progression de génération et la tolérance aux échecs partiels par équipe.

La restitution graphique du rapport distingue explicitement les données affichées :

- historique équipe : `Throughput hebdomadaire`
- scénario bootstrap synthétique : `Débit simulé du scénario`, avec une note de provenance
- historique réel aligné entre équipes : `Throughput historique corrélé`
- comparaison multi-scénarios : `Courbes de probabilités comparées`
- résultats Monte Carlo : `Distribution Monte Carlo` et `Courbe de probabilité`

## Modèle de simulation

Le cœur du produit repose sur :

- le throughput réel observé
- la simulation Monte Carlo
- l'agrégation des itérations simulées
- le recalcul des percentiles selon le mode utilisé
  - `backlog_to_weeks`: quantile discret conservateur sur `P(X <= semaines)`
  - `weeks_to_items`: quantile de survie sur `P(X >= items)`
- en `backlog_to_weeks`, une simulation non terminée à l'horizon maximal est une censure
  explicite, distincte d'une fin exacte à l'horizon

En mode portefeuille, le produit compare plusieurs hypothèses d'agrégation plutôt que de masquer l'incertitude derrière une seule projection.

## Invariants de sécurité et de gouvernance

Principe non négociable :

- le PAT Azure DevOps est utilisé uniquement dans le navigateur
- aucune donnée d'identification Azure DevOps ne doit transiter par le backend
- le backend ne reçoit que des données anonymisées de throughput et des paramètres de simulation
- `mc_client_id` est un identifiant anonyme et non dérivé du contexte Azure DevOps

Cette frontière d'identité est un invariant produit autant qu'un invariant d'architecture.
Elle est protégée par des contrôles CI dédiés.

## Non-objectifs

Monte Carlo Azure :

- ne remplace pas Azure DevOps
- ne fait pas de gestion de backlog
- ne remplace pas la décision humaine
- ne promet pas un résultat certain
- explicite une probabilité plutôt qu'un engagement artificiellement précis

## Indicateurs de pilotage

Le produit cherche à rester :

- rapide à calculer
- stable dans ses simulations
- explicite dans ses hypothèses
- fiable dans ses exports et ses parcours critiques

Indicateurs utiles :

- temps moyen de calcul
- stabilité des résultats
- variance observée
- taux d'erreur API
- usage du mode portefeuille
- qualité de restitution des scénarios

## État récent du produit

Les évolutions récentes les plus structurantes sont :

- refonte du mode portefeuille autour de 4 scénarios explicites
- harmonisation du calcul du `Risk Score` avec les percentiles affichés
- suppression des divergences restantes entre backend, interface et export PDF
- ajout de tests de cohérence dédiés sur `Risk Score`, `cv`, `iqr_ratio` et `slope_norm`
- génération parallèle du rapport portefeuille avec progression visible
- tolérance aux échecs partiels lors de l'agrégation portefeuille
- enrichissement du rapport PDF avec une page de synthèse orientée décision
- durcissement des tests, de la CI et des contrôles de conformité repo
- mise sous contrôle des points vitaux via traçabilité et coverage dédiée

## Vision

La trajectoire produit est claire :

- passer d'un outil équipe à un outil portefeuille robuste
- mieux soutenir les arbitrages de direction
- rendre les hypothèses de simulation plus lisibles et plus gouvernables
- conserver une architecture stricte où l'identité Azure DevOps reste côté navigateur

## Résumé exécutif

Monte Carlo Azure transforme des données opérationnelles en décisions probabilisées.
Le produit aide à arbitrer délai, capacité et périmètre avec un niveau de confiance explicite, tout en préservant une frontière de sécurité stricte entre Azure DevOps et le backend.
