# Product Vision

## Monte Carlo Azure

Monte Carlo Azure est un outil d'aide a la decision pour la planification sous incertitude.
Il transforme un historique Azure DevOps en projections probabilistes exploitables, sans exposer le PAT Azure DevOps au backend.

## Positionnement

Le produit s'adresse en priorite a :

- directeur de projet
- PMO
- responsables delivery
- responsables portefeuille
- directions programme ou transformation

Le produit ne remplace pas le jugement managerial. Il rend l'incertitude visible, mesurable et actionnable.

## Probleme traite

Les decisions de planification reposent encore souvent sur :

- des estimations subjectives
- des moyennes historiques peu explicites
- des story points heterogenes
- des engagements calendaires non probabilises

Les effets observes sont connus :

- engagements intenables
- arbitrages tardifs
- tensions operationnelles
- perte de credibilite en comite

Monte Carlo Azure repond a ce probleme en produisant des distributions probabilistes a partir du throughput reel.

## Proposition de valeur

Le produit permet de :

- securiser une date a partir d'un backlog restant
- convertir un horizon cible en capacite livrable probable
- visualiser la dispersion et la stabilite d'un scenario
- consolider plusieurs equipes dans une lecture portefeuille
- expliciter un niveau de risque via percentiles et `Risk Score`

Valeur attendue :

- decisions explicitees par niveau de confiance
- arbitrages scope / delai plus structures
- dialogue directionnel plus serein
- preparation COPIL plus rapide

## Capacites produit actuelles

Fonctionnalites actuellement presentes dans le produit :

- page publique GitHub Pages pour decouvrir le produit sans backend
- mode demo accessible publiquement pour illustrer le parcours et les restitutions
- notice publique de connexion pour expliquer le mode Azure DevOps reel
- connexion Azure DevOps avec PAT cote navigateur
- selection organisation -> projet -> equipe
- simulation Monte Carlo cote backend via `POST /simulate`
- deux modes de projection :
  - backlog vers semaines
  - semaines vers items
- visualisation des percentiles et distributions
- affichage d'un `Risk Score`
- export CSV du throughput hebdomadaire
- historique local des simulations recentes
- cookie client `IDMontecarlo` pour relier un client anonyme a son historique persiste
- persistence MongoDB et restitution des 10 dernieres simulations via `/simulations/history`
- parametre de capacite reduite
- configuration rapide des filtres types + etats, memorisee localement
- mode `Portefeuille` multi-equipes
- rapport PDF portefeuille avec synthese decisionnelle et pages detaillees

## Parcours de demo

Le produit propose un parcours de demonstration publique via GitHub Pages pour permettre une prise en main immediate sans prerequis technique ni backend actif.

Processus cible :

- l'utilisateur arrive directement sur la demo publique
- il peut ensuite ouvrir la notice de connexion Azure DevOps
- la demo permet d'explorer le flux et les ecrans avec des donnees preconfigurees
- la notice publique explique ensuite comment basculer vers un usage reel avec Azure DevOps

Objectif produit :

- rendre la valeur du produit visible avant toute configuration
- montrer le flux complet sans demander de `PAT`
- separer clairement la decouverte produit du mode reel connecte a Azure DevOps

## Cas d'usage

### 1. Securiser une date

Exemple :

- 80 items restants
- historique de throughput sur plusieurs semaines
- simulation de plusieurs milliers d'iterations

Restitution attendue :

- `P50` pour une lecture mediane
- `P85` ou `P90` pour une lecture prudente
- `Risk Score` pour objectiver la dispersion

Decision supportee :

- accepter le niveau de risque
- ajuster le perimetre
- renforcer la capacite

### 2. Arbitrer une capacite cible

Question metier :

"Combien d'items peut-on livrer en N semaines avec un niveau de confiance donne ?"

Le produit repond a cette question via le mode `weeks_to_items`.

### 3. Piloter un portefeuille

Le mode portefeuille permet de :

- selectionner plusieurs equipes
- consolider les projections
- comparer plusieurs hypotheses d'agregation
- produire un support exportable pour revue de pilotage

Les scenarios actuellement proposes sont :

- `Optimiste`
- `Arrime`
- `Friction`
- `Conservateur`

Le rapport portefeuille gere aussi la progression de generation et la tolerance aux echecs partiels par equipe.

## Modele de simulation

Le coeur du produit repose sur :

- le throughput reel observe
- la simulation Monte Carlo
- l'agregation des iterations simulees
- le recalcul des percentiles selon le mode utilise

En mode portefeuille, le produit compare plusieurs hypotheses d'agregation plutot que de masquer l'incertitude derriere une seule projection.

## Invariants de securite et de gouvernance

Principe non negociable :

- le PAT Azure DevOps est utilise uniquement dans le navigateur
- aucune donnee d'identification Azure DevOps ne doit transiter par le backend
- le backend ne recoit que des donnees anonymisees de throughput et des parametres de simulation

Cette frontiere d'identite est un invariant produit autant qu'un invariant d'architecture.
Elle est protegee par des controles CI dedies.

## Non-objectifs

Monte Carlo Azure :

- ne remplace pas Azure DevOps
- ne fait pas de gestion de backlog
- ne remplace pas la decision humaine
- ne promet pas un resultat certain
- explicite une probabilite plutot qu'un engagement artificiellement precis

## Indicateurs de pilotage

Le produit cherche a rester :

- rapide a calculer
- stable dans ses simulations
- explicite dans ses hypotheses
- fiable dans ses exports et ses parcours critiques

Indicateurs utiles :

- temps moyen de calcul
- stabilite des resultats
- variance observee
- taux d'erreur API
- usage du mode portefeuille
- qualite de restitution des scenarios

## Etat recent du produit

Les evolutions recentes les plus structurantes sont :

- refonte du mode portefeuille autour de 4 scenarios explicites
- harmonisation du calcul du `Risk Score` avec les percentiles affiches
- generation parallele du rapport portefeuille avec progression visible
- tolerance aux echecs partiels lors de l'agregation portefeuille
- enrichissement du rapport PDF avec une page de synthese orientee decision
- durcissement des tests, de la CI et des controles de conformite repo
- mise sous controle des points vitaux via traceabilite et coverage dediee

## Vision

La trajectoire produit est claire :

- passer d'un outil equipe a un outil portefeuille robuste
- mieux soutenir les arbitrages de direction
- rendre les hypotheses de simulation plus lisibles et plus gouvernables
- conserver une architecture stricte ou l'identite Azure DevOps reste cote navigateur

## Resume executif

Monte Carlo Azure transforme des donnees operationnelles en decisions probabilisees.
Le produit aide a arbitrer delai, capacite et perimetre avec un niveau de confiance explicite, tout en preservant une frontiere de securite stricte entre Azure DevOps et le backend.
