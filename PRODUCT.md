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

Trois dimensions metier restent distinctes :

- la qualite des donnees qualifie la profondeur historique, la completude et les collectes Azure DevOps partielles ;
- l'incertitude de prevision qualifie la dispersion, la volatilite, les censures et la possibilite de calculer les percentiles requis ;
- la recommandation d'arbitrage traduit ces diagnostics en decision supportable, decision sous precautions, arbitrage humain ou blocage.

Le `Risk Score` conserve son calcul actuel a partir de `P50` et `P90` : il n'est ni une mesure de qualite des donnees, ni un substitut aux diagnostics ou a la recommandation.

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
- en `backlog_to_weeks`, les censures a l'horizon sont explicites et lues a part
- export CSV du throughput hebdomadaire
- historique local des simulations recentes, contextualise par equipe dans le navigateur
- cookie client `IDMontecarlo` pour relier un client anonyme a son historique persiste
- persistence MongoDB et restitution des 10 dernieres simulations statistiques anonymes via `/simulations/history`
- configuration rapide des filtres types + etats, memorisee localement
- mode `Portefeuille` multi-equipes
- rapport PDF portefeuille avec synthese decisionnelle et pages detaillees

Regle produit sur l'historique hebdomadaire :

- une semaine utilisable est une semaine complete du lundi au dimanche
- elle doit etre entierement comprise dans la periode selectionnee
- elle doit etre deja completement ecoulee au moment du calcul
- la semaine courante n'est donc jamais injectee partiellement dans la simulation

## Parcours de demo

Le produit propose un parcours de demonstration publique via GitHub Pages pour permettre une prise en main immediate sans prerequis technique ni backend actif.

Processus cible :

- l'utilisateur arrive directement sur la demo publique
- il commence sur un ecran de choix d'equipe qui presente les deux parcours disponibles
- il peut ensuite ouvrir la notice de connexion Azure DevOps
- la demo permet d'explorer le flux et les ecrans avec des donnees preconfigurees
- les ecrans de choix d'equipe et de simulation signalent explicitement ce contexte via un badge `Démo` dans l'en-tete
- la notice publique explique ensuite comment basculer vers un usage reel avec Azure DevOps

Objectif produit :

- rendre la valeur du produit visible avant toute configuration
- montrer le flux complet sans demander de `PAT`
- laisser l'utilisateur choisir explicitement entre une lecture equipe et une lecture portefeuille
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
  - en `backlog_to_weeks`, prudent = plus de semaines
- si certaines simulations n'atteignent pas le backlog avant l'horizon, elles sont comptees
  a part comme censures et n'entrent ni dans la distribution ni dans les percentiles
  - mais l'identifiabilite d'un `Pxx` continue, elle, d'etre jugee sur le total de simulations
    lancees: si le rang n'est pas atteignable dans `n_sims`, le percentile reste absent
- la courbe de probabilite backlog reste plafonnee au taux reel de completion, sans remonter
  artificiellement a `100%`
- `Risk Score` pour objectiver la dispersion

Decision supportee :

- accepter le niveau de risque
- ajuster le perimetre
- renforcer la capacite

### 2. Arbitrer une capacite cible

Question metier :

"Combien d'items peut-on livrer en N semaines avec un niveau de confiance donne ?"

Le produit repond a cette question via le mode `weeks_to_items`.

Lecture attendue :

- `P50` pour une lecture mediane
- `P90` pour une lecture prudente
  - en `weeks_to_items`, prudent = moins d'items garantis
- `Risk Score` calcule sur les percentiles metier du mode
  - `backlog_to_weeks`: `(P90 - P50) / P50`
  - `weeks_to_items`: `(P50 - P90) / P50`
  - si `P50` ou `P90` manque, le score n'est pas affiche

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
- `Historique corrélé`

Lecture produit du scenario `Historique corrélé` :

- il ne s'agit pas d'un tirage independant par equipe
- le portefeuille additionne les throughputs observes sur les memes semaines pour toutes les equipes
- seules les semaines communes completes sont conservees
- ce scenario conserve les variations simultanees observees, sans demontrer leurs causes, les dependances
  operationnelles, la substituabilite des equipes ou leur validite future

Le diagnostic comparatif portefeuille separe explicitement :

- la qualite des historiques observes par equipe et les faits a verifier au niveau portefeuille;
- la stabilite ou l'incertitude de chaque resultat simule;
- la credibilite de l'hypothese sous-jacente et son type de preuve: observation, calcul, saisie utilisateur ou
  absence de preuve comparative.

Une distribution stable ne valide pas une hypothese. Avec les seules donnees historiques, les resultats simules
et un taux d'alignement manuel, le produit ne privilegie aucun scenario unique: la conclusion « preuves
insuffisantes pour privilegier une hypothese » est un resultat metier valide. Ce diagnostic est disponible dans
le modele portefeuille; son affichage UI et PDF reste a concevoir.

Le rapport portefeuille gere aussi la progression de generation et la tolerance aux echecs partiels par equipe.

La restitution graphique du rapport distingue explicitement les donnees affichees :

- historique equipe : `Throughput hebdomadaire`
- scenario bootstrap synthetique : `D\u00E9bit simul\u00E9 du sc\u00E9nario`, avec une note de provenance
- historique reel aligne entre equipes : `Throughput historique corr\u00E9l\u00E9`
- comparaison multi-scenarios : `Courbes de probabilit\u00E9s compar\u00E9es`
- resultats Monte Carlo : `Distribution Monte Carlo` et `Courbe de probabilit\u00E9`

## Modele de simulation

Le coeur du produit repose sur :

- le throughput reel observe
- la simulation Monte Carlo
- l'agregation des iterations simulees
- le recalcul des percentiles selon le mode utilise
  - `backlog_to_weeks`: quantile discret conservateur sur `P(X <= semaines)`
  - `weeks_to_items`: quantile de survie sur `P(X >= items)`
- en `backlog_to_weeks`, une simulation non terminee a l'horizon maximal est une censure
  explicite, distincte d'une fin exacte a l'horizon

En mode portefeuille, le produit compare plusieurs hypotheses d'agregation plutot que de masquer l'incertitude derriere une seule projection.

## Invariants de securite et de gouvernance

Principe non negociable :

- le PAT Azure DevOps est utilise uniquement dans le navigateur
- aucune donnee d'identification Azure DevOps ne doit transiter par le backend
- le backend ne recoit que des donnees anonymisees de throughput et des parametres de simulation
- `mc_client_id` est un identifiant anonyme et non derive du contexte Azure DevOps

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
- suppression des divergences restantes entre backend, interface et export PDF
- ajout de tests de coherence dedies sur `Risk Score`, `cv`, `iqr_ratio` et `slope_norm`
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
