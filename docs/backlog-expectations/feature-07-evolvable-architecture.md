# Feature 7 — Réduire le coût de changement par une architecture explicite et modulaire

## Résultat observable

Les responsabilités métier, applicatives, techniques, de présentation et de qualité sont séparées par des
frontières explicites. Chaque évolution locale peut être publiée et démontrée sans rouvrir un chantier
transversal comparable au PBI 2.21.

## Doctrine de reconstruction

Un PBI décrit ici un état architectural obtenu, une seule raison principale de changer et une publication
autonome. Le contrat local, son implémentation, la migration cohésive, les tests, la documentation, le retrait
de l’ancien chemin et son contrôle de non-régression sont des éléments de réalisation du même outcome.

La Feature 7 ne porte ni la distribution externe du package Python de la Feature 3, ni les capacités
fonctionnelles de collecte de la Feature 8, ni l’expérience des restitutions de la Feature 10, ni la
rationalisation du système qualité de la Feature 13.

## Audit de conformité

Statut : Conforme au standard de granularité
PBI total : 75
PBI XXS : 0
PBI XS : 7
PBI S : 65
PBI M : 3
PBI L : 0
PBI XL : 0
PBI sans attendus : 0
Cycles de précédence : 0

La conformité structurelle est recalculée par `Scripts/check_backlog_atomicity.py`. L’attestation synthétique
consigne en plus la revue humaine de la cohésion et du caractère publiable de l’ensemble des outcomes.

## Traçabilité de la reconstruction

| Axe | Lignes initiales | Outcomes Feature 7 | Restituées | Étapes absorbées |
| --- | ---: | ---: | ---: | ---: |
| Diagnostic et cible | 12 | 9 | 0 | 3 |
| Contrôles architecturaux | 13 | 9 | 0 | 4 |
| Frontières frontend | 14 | 2 | 0 | 12 |
| Domaine temporel et delivery | 24 | 10 | 0 | 14 |
| Horloge et identité | 10 | 4 | 0 | 6 |
| Azure DevOps | 40 | 10 | 20 | 10 |
| Moteurs, application et persistance | 39 | 15 | 0 | 24 |
| Présentation et restitutions | 26 | 7 | 12 | 7 |
| Infrastructure qualité | 8 | 4 | 4 | 0 |
| Preuves de sortie | 4 | 5 | 0 | -1 |
| **Total** | **190** | **75** | **36** | **80** |

La valeur `-1` correspond à l’ajout d’un outcome explicite de mesure du coût de changement. Les capacités
restituées sont décrites dans les attendus des Features 8, 10 et 13 ; les étapes absorbées restent exigées par
les critères de clôture des outcomes parents.

## 7.1 — Les responsabilités frontend et leurs flux de données sont cartographiés

- **Taille :** S
- **Outcome :** Une carte vérifiable attribue chaque responsabilité frontend à une couche et rend les flux de données visibles.
- **Raison principale de changer :** Décider où placer les évolutions frontend sans reproduire les couplages actuels.
- **Frontière principale :** Frontend.
- **Famille d’invariants :** Propriété des responsabilités frontend.
- **Preuve principale :** Revue de la [carte frontend livrée](../frontend-responsibilities-map.md) contre les imports et les points d’entrée réels.
- **Éléments de réalisation inclus :** Inventaire des hooks, services, modèles et vues ; flux entrants et sortants ; documentation durable.
- **Hors périmètre :** Migration du code et expérience fonctionnelle des écrans.
- **Surface prévisionnelle :** 0 fichiers de production ; 4 fichiers versionnés
- **Prédécesseurs :** aucun
- **Critères de clôture :** Chaque responsabilité et flux observé possède un propriétaire, les écarts sont tracés et la carte est publiable seule.

## 7.2 — Les responsabilités backend et le cycle de vie des données sont cartographiés

- **Taille :** S
- **Outcome :** Une carte vérifiable expose les responsabilités backend depuis la route HTTP jusqu’au moteur et à la persistance.
- **Raison principale de changer :** Localiser les changements backend et les transitions de données.
- **Frontière principale :** Backend.
- **Famille d’invariants :** Propriété du cycle de vie backend.
- **Preuve principale :** Revue de la [carte backend livrée](../backend-responsibilities-map.md) contre les routes, services, moteurs et stores réels.
- **Éléments de réalisation inclus :** Inventaire des entrées HTTP, transformations, appels moteur et opérations de persistance ; documentation durable.
- **Hors périmètre :** Extraction des ports et modification des comportements fonctionnels.
- **Surface prévisionnelle :** 0 fichiers de production ; 4 fichiers versionnés
- **Prédécesseurs :** aucun
- **Critères de clôture :** Chaque transition et responsabilité backend est attribuée, les couplages sont visibles et la carte est publiable seule.

## 7.3 — Les responsabilités de l’infrastructure qualité sont cartographiées

- **Taille :** S
- **Outcome :** Une carte distingue les responsabilités de preuve, d’orchestration et d’exécution de l’infrastructure qualité.
- **Raison principale de changer :** Empêcher le système qualité de dépendre implicitement du graphe produit.
- **Frontière principale :** Infrastructure qualité.
- **Famille d’invariants :** Propriété des responsabilités qualité.
- **Preuve principale :** Revue de la [carte de l’infrastructure qualité livrée](../quality-infrastructure-responsibilities-map.md) contre les scripts et profils de validation réels.
- **Éléments de réalisation inclus :** Inventaire des générateurs, validateurs, runners et chemins d’exécution ; documentation durable.
- **Hors périmètre :** Rationalisation du coût des contrôles relevant de la Feature 13.
- **Surface prévisionnelle :** 0 fichiers de production ; 4 fichiers versionnés
- **Prédécesseurs :** aucun
- **Critères de clôture :** Chaque script critique a une responsabilité explicite, les recouvrements sont visibles et la carte est publiable seule.

## 7.4 — Les dépendances, cycles et contournements réels sont établis

- **Taille :** S
- **Outcome :** Un graphe factuel expose les dépendances autorisées, les cycles et les contournements d’API du dépôt.
- **Raison principale de changer :** Fonder la migration sur le graphe exécuté plutôt que sur une architecture supposée.
- **Frontière principale :** Graphe de dépendances du dépôt.
- **Famille d’invariants :** Direction et acyclicité des dépendances.
- **Preuve principale :** Comparaison du [graphe factuel livré](../dependency-graph.md) et de sa [preuve machine](../../reports/dependency-graph.json) avec les imports et points d’entrée réels.
- **Éléments de réalisation inclus :** Extraction du graphe ; inventaire des cycles ; inventaire des imports profonds ; restitution actionnable.
- **Hors périmètre :** Correction des dépendances recensées.
- **Surface prévisionnelle :** 1 fichier de production ; 6 fichiers versionnés
- **Prédécesseurs :** aucun
- **Critères de clôture :** Le graphe est reproductible, chaque cycle et contournement a une localisation et l’état peut être publié sans migration.

## 7.5 — Le coût de changement et ses hotspots disposent d’une baseline

- **Taille :** S
- **Outcome :** Une baseline relie des changements représentatifs aux fichiers, couches et hotspots qu’ils traversent.
- **Raison principale de changer :** Mesurer objectivement la réduction de portée promise par la Feature 7.
- **Frontière principale :** Mesure du coût de changement.
- **Famille d’invariants :** Reproductibilité de la mesure architecturale.
- **Preuve principale :** Recalcul de la baseline sur les scénarios documentés.
- **Éléments de réalisation inclus :** Choix des scénarios ; inventaire des hotspots ; mesure initiale ; protocole de comparaison.
- **Hors périmètre :** Optimisation des performances produit et rationalisation des gates.
- **Surface prévisionnelle :** 1 fichier de production ; 6 fichiers versionnés
- **Prédécesseurs :** 7.1, 7.2, 7.3, 7.4
- **Critères de clôture :** Les scénarios, mesures et limites sont reproductibles et la baseline est publiable avant toute migration.

## 7.6 — Chaque donnée structurante possède une autorité explicite

- **Taille :** XS
- **Outcome :** Les données structurantes ont un propriétaire unique et une règle de transformation explicite.
- **Raison principale de changer :** Éviter les définitions concurrentes d’une même donnée entre couches.
- **Frontière principale :** Propriété des données.
- **Famille d’invariants :** Autorité et transformation des données.
- **Preuve principale :** Revue croisée du [registre des autorités livré](../structured-data-authority-registry.md) et des producteurs réels.
- **Éléments de réalisation inclus :** Registre des autorités ; règles de transformation ; traitement des ambiguïtés ; documentation durable.
- **Hors périmètre :** Migration des producteurs et consommateurs.
- **Surface prévisionnelle :** 0 fichiers de production ; 4 fichiers versionnés
- **Prédécesseurs :** 7.1, 7.2
- **Critères de clôture :** Aucune donnée structurante auditée ne possède deux autorités et le registre est publiable seul.

## 7.7 — Les directions de dépendance cibles sont décidées

- **Taille :** S
- **Outcome :** Une décision durable fixe les dépendances permises entre domaine, application, ports, adaptateurs et présentation.
- **Raison principale de changer :** Donner une règle commune aux migrations locales.
- **Frontière principale :** Architecture hexagonale cible.
- **Famille d’invariants :** Direction des dépendances entre couches.
- **Preuve principale :** Revue de la [décision livrée](../target-dependency-directions.md) contre les cas limites issus du graphe réel.
- **Éléments de réalisation inclus :** Règles de direction ; exceptions interdites ; exemples conformes et non conformes ; décision durable.
- **Hors périmètre :** Choix détaillé de chaque port et migration du code.
- **Surface prévisionnelle :** 0 fichiers de production ; 5 fichiers versionnés
- **Prédécesseurs :** 7.4, 7.6
- **Critères de clôture :** Chaque relation de couche a une direction sans ambiguïté et la décision peut être publiée avant les migrations.

## 7.8 — L’architecture cible possède des frontières acceptées

- **Taille :** M
- **Outcome :** Une architecture cible unique attribue les responsabilités et frontières nécessaires à la réduction du coût de changement.
- **Raison principale de changer :** Aligner les migrations sur un état cible cohérent à l’échelle du dépôt.
- **Frontière principale :** Architecture cible du produit.
- **Famille d’invariants :** Cohérence des frontières et responsabilités.
- **Preuve principale :** Revue de l’[architecture cible acceptée](../target-architecture.md) contre les scénarios de changement de la baseline.
- **Éléments de réalisation inclus :** Vue cible ; responsabilités ; ports attendus ; règles de composition ; décisions durables.
- **Hors périmètre :** Implémentation des frontières et capacités fonctionnelles futures.
- **Surface prévisionnelle :** 0 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
- **Critères de clôture :** L’état cible couvre les scénarios de référence, n’agrège pas leurs implémentations et est publiable comme décision autonome.
- **Justification de la taille M :** La difficulté vient de la décision cohérente sur une seule architecture cible, pas de la livraison simultanée de ses migrations.

## 7.9 — La migration architecturale suit une séquence acyclique

- **Taille :** S
- **Outcome :** Une séquence ordonne les outcomes architecturaux sans état transitoire non publiable ni dépendance future.
- **Raison principale de changer :** Permettre des livraisons incrémentales sûres.
- **Frontière principale :** Plan de migration architecturale.
- **Famille d’invariants :** Publication incrémentale et acyclicité.
- **Preuve principale :** Validation automatisée de la [séquence de migration acyclique](../architecture-migration-sequence.md) et de sa projection machine.
- **Éléments de réalisation inclus :** Graphe des outcomes ; chemins parallèles ; points de convergence ; stratégie de retour arrière.
- **Hors périmètre :** Réalisation des outcomes ordonnés.
- **Surface prévisionnelle :** 0 fichiers de production ; 5 fichiers versionnés
- **Prédécesseurs :** 7.8
- **Critères de clôture :** Chaque outcome dépend uniquement d’états antérieurs publiables et la séquence est exploitable seule.

## 7.10 — L’autorité des dépendances est lisible et diagnostiquable automatiquement

- **Taille :** S
- **Outcome :** Une autorité versionnée des dépendances est parsée et produit des diagnostics localisés.
- **Raison principale de changer :** Transformer les décisions architecturales en règles vérifiables.
- **Frontière principale :** Contrôle des dépendances.
- **Famille d’invariants :** Intégrité de l’autorité architecturale.
- **Preuve principale :** [Tests du format, du parseur et des diagnostics invalides](../../tests/test_dependency_authority.py), complétés par la [preuve de validation déterministe](../../reports/dependency-authority-validation.json).
- **Éléments de réalisation inclus :** Format d’autorité ; parseur ; validation ; diagnostics ; documentation du format.
- **Hors périmètre :** Familles de règles architecturales particulières.
- **Surface prévisionnelle :** 4 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 7.7, 7.8
- **Critères de clôture :** Une autorité valide est acceptée, chaque défaut est actionnable et l’outil est publiable sans les règles suivantes.

## 7.11 — Le domaine reste indépendant des technologies

- **Taille :** S
- **Outcome :** Le contrôle architectural refuse toute dépendance du domaine vers une technologie ou un adaptateur.
- **Raison principale de changer :** Préserver la stabilité du métier face aux choix techniques.
- **Frontière principale :** Domaine.
- **Famille d’invariants :** Indépendance technologique du domaine.
- **Preuve principale :** Tests positifs et négatifs de dépendances du domaine.
- **Éléments de réalisation inclus :** Règle ; diagnostic ; cas limites ; intégration mécanique au contrôle ; documentation ciblée.
- **Hors périmètre :** Imports profonds et dépendances entre adaptateurs.
- **Surface prévisionnelle :** 3 fichiers de production ; 7 fichiers versionnés
- **Prédécesseurs :** 7.10
- **Critères de clôture :** Les dépendances conformes passent, les dépendances technologiques échouent avec leur chemin et la règle est publiable seule.

## 7.12 — Les API publiques empêchent les imports profonds

- **Taille :** S
- **Outcome :** Chaque module gouverné expose une API publique et les consommateurs ne peuvent plus contourner cette frontière.
- **Raison principale de changer :** Rendre l’intérieur des modules modifiable sans effet transversal.
- **Frontière principale :** API publiques des modules.
- **Famille d’invariants :** Encapsulation des modules.
- **Preuve principale :** Tests des imports autorisés et des contournements refusés.
- **Éléments de réalisation inclus :** Règle ; diagnostic ; exceptions explicites ; intégration mécanique ; documentation ciblée.
- **Hors périmètre :** Contenu fonctionnel des API et cycles entre modules.
- **Surface prévisionnelle :** 3 fichiers de production ; 7 fichiers versionnés
- **Prédécesseurs :** 7.10
- **Critères de clôture :** Les imports publics restent valides, les imports profonds sont localisés et la règle est publiable seule.

## 7.13 — Les cycles de dépendance sont empêchés

- **Taille :** S
- **Outcome :** Le graphe architectural refuse les cycles directs et indirects dans les modules gouvernés.
- **Raison principale de changer :** Empêcher la réapparition des boucles responsables de changements transversaux.
- **Frontière principale :** Graphe des modules.
- **Famille d’invariants :** Acyclicité des dépendances.
- **Preuve principale :** Tests de cycles directs, indirects et graphes acycliques.
- **Éléments de réalisation inclus :** Détection ; diagnostic du chemin cyclique ; tests ; intégration mécanique ; documentation ciblée.
- **Hors périmètre :** Migration du cycle frontend recensé.
- **Surface prévisionnelle :** 3 fichiers de production ; 7 fichiers versionnés
- **Prédécesseurs :** 7.10
- **Critères de clôture :** Tout cycle est rejeté avec son chemin, les graphes acycliques passent et la règle est publiable seule.

## 7.14 — Les adaptateurs restent indépendants entre eux

- **Taille :** S
- **Outcome :** Un adaptateur dépend des ports partagés mais jamais d’un autre adaptateur.
- **Raison principale de changer :** Permettre le remplacement indépendant des technologies.
- **Frontière principale :** Adaptateurs.
- **Famille d’invariants :** Indépendance des adaptateurs.
- **Preuve principale :** Tests de relations autorisées et interdites entre adaptateurs.
- **Éléments de réalisation inclus :** Règle ; diagnostic ; tests ; intégration mécanique ; documentation ciblée.
- **Hors périmètre :** Conformité fonctionnelle propre à chaque technologie.
- **Surface prévisionnelle :** 3 fichiers de production ; 7 fichiers versionnés
- **Prédécesseurs :** 7.10
- **Critères de clôture :** Les ports restent partageables, les liens entre adaptateurs échouent et la règle est publiable seule.

## 7.15 — Les DTO techniques restent confinés à leurs adaptateurs

- **Taille :** S
- **Outcome :** Aucun DTO de transport ou de stockage ne traverse la frontière de son adaptateur.
- **Raison principale de changer :** Éviter que les formats techniques deviennent des contrats métier.
- **Frontière principale :** Frontière des DTO techniques.
- **Famille d’invariants :** Confinement des représentations techniques.
- **Preuve principale :** Tests de fuites de DTO et de mappages conformes.
- **Éléments de réalisation inclus :** Règle ; diagnostic ; tests ; intégration mécanique ; documentation ciblée.
- **Hors périmètre :** Définition des modèles métier et comportement des adaptateurs.
- **Surface prévisionnelle :** 3 fichiers de production ; 7 fichiers versionnés
- **Prédécesseurs :** 7.6, 7.10
- **Critères de clôture :** Toute fuite est localisée, les modèles internes restent autorisés et la règle est publiable seule.

## 7.16 — Les modules partagés respectent une direction de dépendance explicite

- **Taille :** S
- **Outcome :** Les modules partagés ne deviennent pas une zone de dépendances bidirectionnelles ou de responsabilités sans propriétaire.
- **Raison principale de changer :** Prévenir la recréation de couplages transversaux sous une façade commune.
- **Frontière principale :** Modules partagés.
- **Famille d’invariants :** Direction et propriété du code partagé.
- **Preuve principale :** Tests des directions permises et des responsabilités orphelines.
- **Éléments de réalisation inclus :** Règle ; diagnostic ; tests ; intégration mécanique ; documentation ciblée.
- **Hors périmètre :** Refactorisation de tous les modules partagés existants.
- **Surface prévisionnelle :** 3 fichiers de production ; 7 fichiers versionnés
- **Prédécesseurs :** 7.6, 7.10
- **Critères de clôture :** Chaque dépendance partagée respecte une direction, chaque autorité est identifiable et la règle est publiable seule.

## 7.17 — Le contrôle architectural protège les profils locaux et main

- **Taille :** S
- **Outcome :** Le contrôle architectural s’exécute dans les profils locaux pertinents et bloque le profil main sur une violation.
- **Raison principale de changer :** Rendre les règles effectives dans le flux de contribution courant.
- **Frontière principale :** Planification de la quality gate.
- **Famille d’invariants :** Enforcement cohérent des règles architecturales.
- **Preuve principale :** Tests du plan de gate et exécution des profils configurés.
- **Éléments de réalisation inclus :** Étape de gate ; configuration des profils ; tests ; diagnostic agrégé ; documentation d’exécution.
- **Hors périmètre :** Nouveau comportement de hook Git et validation en worktree détaché.
- **Surface prévisionnelle :** 3 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 7.11, 7.12, 7.13, 7.14, 7.15, 7.16
- **Critères de clôture :** Les profils déclarés invoquent la même autorité, une violation bloque main et l’intégration est publiable seule.

## 7.18 — Les diagnostics architecturaux sont exploitables par les contributeurs

- **Taille :** XS
- **Outcome :** Chaque échec architectural indique le PBI, la règle, la valeur observée et la correction attendue.
- **Raison principale de changer :** Permettre une correction locale sans connaissance implicite du contrôle.
- **Frontière principale :** Expérience contributeur du contrôle architectural.
- **Famille d’invariants :** Actionnabilité des diagnostics.
- **Preuve principale :** Tests de sortie et revue de la documentation opératoire.
- **Éléments de réalisation inclus :** Format de diagnostic ; cas d’erreur ; documentation durable ; exemple de résolution.
- **Hors périmètre :** Rationalisation générale de l’expérience contributeur relevant de la Feature 13.
- **Surface prévisionnelle :** 1 fichier de production ; 5 fichiers versionnés
- **Prédécesseurs :** 7.17
- **Critères de clôture :** Chaque famille de règle produit un diagnostic complet et l’aide peut être publiée avec le contrôle existant.

## 7.19 — La prévision frontend dépend d’un contrat indépendant de React

- **Taille :** M
- **Outcome :** Le module de prévision consomme un contrat applicatif stable et ne dépend plus des hooks React ni de l’ancienne façade cyclique.
- **Raison principale de changer :** Rompre le cycle de prévision frontend autour d’une frontière applicative cohérente.
- **Frontière principale :** Prévision applicative frontend.
- **Famille d’invariants :** Indépendance de la prévision vis-à-vis de React.
- **Preuve principale :** Tests contractuels de la prévision et contrôle de l’absence du cycle.
- **Éléments de réalisation inclus :** Contrat des opérations de prévision ; implémentation locale ; migration du noyau consommateur ; retrait des déclarations historiques ; blocage de l’import inverse ; documentation.
- **Hors périmètre :** Expérience utilisateur de simulation et distribution externe du moteur Python.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.13
- **Critères de clôture :** La prévision fonctionne par le contrat, l’ancienne façade n’est plus requise, le cycle est impossible et l’outcome est publiable seul.
- **Justification de la taille M :** Le contrat, la migration cohésive et le retrait du cycle forment un seul état publiable ; les séparer créerait une façade transitoire artificielle.

## 7.20 — La configuration portefeuille dépend d’un contrat indépendant du hook applicatif

- **Taille :** S
- **Outcome :** La configuration portefeuille est définie par un contrat stable sans dépendre du hook qui l’utilise.
- **Raison principale de changer :** Permettre l’évolution de la configuration et du hook sans dépendance inverse.
- **Frontière principale :** Configuration applicative portefeuille.
- **Famille d’invariants :** Indépendance de la configuration vis-à-vis de React.
- **Preuve principale :** Tests contractuels de configuration et contrôle des imports.
- **Éléments de réalisation inclus :** Contrat local ; migration du consommateur cohésif ; retrait de la déclaration historique ; blocage du retour au hook ; documentation.
- **Hors périmètre :** Orchestration fonctionnelle du portefeuille et expérience utilisateur.
- **Surface prévisionnelle :** 5 fichiers de production ; 9 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.12
- **Critères de clôture :** Le consommateur utilise le contrat, le hook n’en est plus l’autorité et l’outcome est publiable seul.

## 7.21 — L’événement de delivery porte un fait métier normalisé

- **Taille :** S
- **Outcome :** Un événement de delivery représente le fait métier utile sans DTO Azure DevOps ni détail de restitution.
- **Raison principale de changer :** Donner une autorité stable aux transformations temporelles.
- **Frontière principale :** Domaine delivery.
- **Famille d’invariants :** Normalisation des événements de delivery.
- **Preuve principale :** Tests du modèle et des conversions aux limites de la frontière.
- **Éléments de réalisation inclus :** Modèle métier ; invariants ; conversions locales ; migration des consommateurs cohésifs ; retrait des représentations concurrentes.
- **Hors périmètre :** Collecte fonctionnelle Azure DevOps et affichage des événements.
- **Surface prévisionnelle :** 5 fichiers de production ; 9 fichiers versionnés
- **Prédécesseurs :** 7.6, 7.8, 7.9
- **Critères de clôture :** Les calculs delivery consomment le modèle normalisé, aucun DTO technique ne fuite et l’outcome est publiable seul.

## 7.22 — La fenêtre historique appartient au domaine delivery

- **Taille :** S
- **Outcome :** La sélection d’une fenêtre historique suit un invariant métier unique réutilisable par les consommateurs.
- **Raison principale de changer :** Éliminer les calculs de fenêtre dupliqués dans les couches techniques.
- **Frontière principale :** Domaine delivery.
- **Famille d’invariants :** Inclusion dans la fenêtre historique.
- **Preuve principale :** Tests de bornes, fenêtres vides et migrations locales.
- **Éléments de réalisation inclus :** Value Object ; règles de bornes ; migration du groupe consommateur ; retrait des anciens calculs ; contrôle de non-régression.
- **Hors périmètre :** Choix fonctionnel de la profondeur d’historique par l’utilisateur.
- **Surface prévisionnelle :** 6 fichiers de production ; 10 fichiers versionnés
- **Prédécesseurs :** 7.21
- **Critères de clôture :** Une seule règle sélectionne les événements, les anciens calculs ne sont plus appelés et l’outcome est publiable seul.

## 7.23 — La semaine et le fuseau horaire suivent une politique métier unique

- **Taille :** S
- **Outcome :** Les dates de delivery sont rattachées à une semaine ISO selon une politique de fuseau horaire explicite.
- **Raison principale de changer :** Éviter des regroupements temporels divergents entre couches.
- **Frontière principale :** Calendrier du domaine delivery.
- **Famille d’invariants :** Semaine ISO et normalisation temporelle.
- **Preuve principale :** Tests des changements de semaine, d’année et de fuseau.
- **Éléments de réalisation inclus :** Value Object de semaine ; politique de fuseau ; migration locale des regroupements ; retrait des calculs concurrents.
- **Hors périmètre :** Contexte fonctionnel des sprints Azure DevOps.
- **Surface prévisionnelle :** 6 fichiers de production ; 11 fichiers versionnés
- **Prédécesseurs :** 7.21
- **Critères de clôture :** Tous les regroupements delivery utilisent la même politique, les cas limites sont prouvés et l’outcome est publiable seul.

## 7.24 — Les périodes partielles sont explicites dans le domaine delivery

- **Taille :** XS
- **Outcome :** Une période incomplète est représentée explicitement au lieu d’être confondue avec une période complète.
- **Raison principale de changer :** Empêcher une interprétation silencieuse des bords de fenêtre.
- **Frontière principale :** Domaine delivery.
- **Famille d’invariants :** Statut des périodes partielles.
- **Preuve principale :** Tests des périodes initiales, finales et complètes.
- **Éléments de réalisation inclus :** Type de résultat ; règles de construction ; migration locale ; diagnostic associé.
- **Hors périmètre :** Présentation fonctionnelle des avertissements dans l’UI et les rapports.
- **Surface prévisionnelle :** 4 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 7.22, 7.23
- **Critères de clôture :** Aucun bord incomplet n’est présenté comme complet, le statut traverse le domaine et l’outcome est publiable seul.

## 7.25 — Les calculs de throughput appartiennent au domaine delivery

- **Taille :** S
- **Outcome :** Le throughput est calculé par une transformation métier unique à partir des événements de delivery.
- **Raison principale de changer :** Éliminer les variantes de calcul dispersées dans les consommateurs.
- **Frontière principale :** Domaine delivery.
- **Famille d’invariants :** Définition et unité du throughput.
- **Preuve principale :** Tests de la transformation, de son unité et des migrations locales.
- **Éléments de réalisation inclus :** Unité explicite ; transformation ; migration du groupe consommateur ; retrait des anciens calculs ; contrôle de non-régression.
- **Hors périmètre :** Analyse fonctionnelle de stabilité du flux relevant de la Feature 8.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.21, 7.22, 7.23, 7.24
- **Critères de clôture :** Tous les consommateurs cohésifs obtiennent le même throughput, les anciennes variantes ont disparu et l’outcome est publiable seul.

## 7.26 — Les calculs de Cycle Time appartiennent au domaine delivery

- **Taille :** S
- **Outcome :** Le Cycle Time est calculé par une transformation métier unique à partir des événements de delivery.
- **Raison principale de changer :** Éliminer les variantes de durée dispersées dans les consommateurs.
- **Frontière principale :** Domaine delivery.
- **Famille d’invariants :** Définition et unité du Cycle Time.
- **Preuve principale :** Tests de la transformation, de son unité et des migrations locales.
- **Éléments de réalisation inclus :** Unité explicite ; transformation ; migration du groupe consommateur ; retrait des anciens calculs ; contrôle de non-régression.
- **Hors périmètre :** Interprétation fonctionnelle des durées dans les restitutions.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.21, 7.22, 7.23, 7.24
- **Critères de clôture :** Tous les consommateurs cohésifs obtiennent le même Cycle Time, les anciennes variantes ont disparu et l’outcome est publiable seul.

## 7.27 — La complétude de l’historique est un invariant delivery

- **Taille :** S
- **Outcome :** Le domaine qualifie explicitement si l’historique requis est complet.
- **Raison principale de changer :** Empêcher une prévision construite silencieusement sur des données incomplètes.
- **Frontière principale :** Domaine delivery.
- **Famille d’invariants :** Complétude de l’historique.
- **Preuve principale :** Tests des historiques complets, incomplets et absents.
- **Éléments de réalisation inclus :** Règle ; diagnostic ; intégration au résultat delivery ; tests ; documentation métier.
- **Hors périmètre :** Signalement visuel de la qualité des données relevant de la Feature 8.
- **Surface prévisionnelle :** 5 fichiers de production ; 10 fichiers versionnés
- **Prédécesseurs :** 7.21, 7.22, 7.24
- **Critères de clôture :** La complétude est calculée une fois, conservée dans le résultat et l’outcome est publiable seul.

## 7.28 — Les discontinuités de l’historique sont un invariant delivery

- **Taille :** S
- **Outcome :** Le domaine détecte et qualifie les ruptures dans la suite d’événements attendue.
- **Raison principale de changer :** Distinguer une absence réelle d’activité d’un trou de collecte.
- **Frontière principale :** Domaine delivery.
- **Famille d’invariants :** Continuité de l’historique.
- **Preuve principale :** Tests des séquences continues, discontinues et ambiguës.
- **Éléments de réalisation inclus :** Règle ; diagnostic ; intégration au résultat delivery ; tests ; documentation métier.
- **Hors périmètre :** Récupération fonctionnelle des lots manquants relevant de la Feature 8.
- **Surface prévisionnelle :** 5 fichiers de production ; 10 fichiers versionnés
- **Prédécesseurs :** 7.21, 7.23
- **Critères de clôture :** Chaque rupture détectable possède un diagnostic stable, le résultat le conserve et l’outcome est publiable seul.

## 7.29 — La cohérence chronologique est un invariant delivery

- **Taille :** S
- **Outcome :** Le domaine refuse ou qualifie les événements dont l’ordre temporel est incohérent.
- **Raison principale de changer :** Protéger les calculs contre des séquences temporelles impossibles.
- **Frontière principale :** Domaine delivery.
- **Famille d’invariants :** Cohérence chronologique des événements.
- **Preuve principale :** Tests des ordres valides, inversés et simultanés.
- **Éléments de réalisation inclus :** Règle ; diagnostic ; intégration au résultat delivery ; tests ; documentation métier.
- **Hors périmètre :** Correction à la source des données Azure DevOps.
- **Surface prévisionnelle :** 5 fichiers de production ; 10 fichiers versionnés
- **Prédécesseurs :** 7.21, 7.23
- **Critères de clôture :** Les incohérences sont déterministes, localisées dans le résultat et l’outcome est publiable seul.

## 7.30 — Les diagnostics delivery traversent la frontière applicative sans perte

- **Taille :** S
- **Outcome :** Le résultat applicatif conserve les diagnostics delivery sans les recalculer ni les réduire silencieusement.
- **Raison principale de changer :** Préserver la qualité des données jusqu’aux consommateurs.
- **Frontière principale :** Résultat applicatif delivery.
- **Famille d’invariants :** Conservation des diagnostics métier.
- **Preuve principale :** Tests de propagation de chaque diagnostic à travers la frontière.
- **Éléments de réalisation inclus :** Contrat de résultat ; mappage local ; migration des consommateurs cohésifs ; tests de non-perte.
- **Hors périmètre :** Formulation et affichage fonctionnels des diagnostics.
- **Surface prévisionnelle :** 6 fichiers de production ; 11 fichiers versionnés
- **Prédécesseurs :** 7.24, 7.27, 7.28, 7.29
- **Critères de clôture :** Chaque diagnostic produit par le domaine est observable inchangé côté application et l’outcome est publiable seul.

## 7.31 — Le temps frontend est injectable et déterministe

- **Taille :** S
- **Outcome :** Les timestamps frontend dépendent d’une horloge injectée plutôt que du navigateur global.
- **Raison principale de changer :** Rendre les usages temporels frontend testables et rejouables.
- **Frontière principale :** Temps frontend.
- **Famille d’invariants :** Déterminisme de l’horloge frontend.
- **Preuve principale :** Tests avec horloge contrôlée et adaptateur navigateur.
- **Éléments de réalisation inclus :** Port d’horloge ; adaptateur principal ; migration des usages cohésifs ; retrait des accès directs ; documentation.
- **Hors périmètre :** Horloge backend et politique métier de semaine.
- **Surface prévisionnelle :** 6 fichiers de production ; 10 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9
- **Critères de clôture :** Les usages ciblés sont déterministes, l’horloge réelle reste disponible par composition et l’outcome est publiable seul.

## 7.32 — Le temps backend est injectable et déterministe

- **Taille :** S
- **Outcome :** Les timestamps backend dépendent d’une horloge injectée plutôt que du temps système direct.
- **Raison principale de changer :** Rendre le cycle de persistance backend testable et rejouable.
- **Frontière principale :** Temps backend.
- **Famille d’invariants :** Déterminisme de l’horloge backend.
- **Preuve principale :** [Tests du port, de la composition UTC](../../tests/test_backend_clock.py) et du [cycle de persistance avec horloge contrôlée](../../tests/test_simulation_store.py).
- **Éléments de réalisation inclus :** Port d’horloge ; adaptateur principal ; migration des usages cohésifs ; retrait des accès directs ; documentation.
- **Hors périmètre :** Horloge frontend et politique de rétention des données.
- **Surface prévisionnelle :** 6 fichiers de production ; 10 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9
- **Critères de clôture :** Les timestamps ciblés sont déterministes, l’UTC réel reste disponible par composition et l’outcome est publiable seul.

## 7.33 — L’identité des historiques est injectable

- **Taille :** S
- **Outcome :** La création d’un identifiant d’historique dépend d’un port technique injectable.
- **Raison principale de changer :** Séparer l’identité technique du cas d’usage qui crée l’historique.
- **Frontière principale :** Identité des historiques.
- **Famille d’invariants :** Unicité et injectabilité de l’identité d’historique.
- **Preuve principale :** Tests avec générateur déterministe et adaptateur UUID.
- **Éléments de réalisation inclus :** Port ; adaptateur principal ; migration du cas d’usage cohésif ; retrait de l’accès direct ; documentation.
- **Hors périmètre :** Identité du client frontend et identité de snapshot statistique.
- **Surface prévisionnelle :** 6 fichiers de production ; 10 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9
- **Critères de clôture :** Le cas d’usage contrôle son générateur, l’unicité réelle reste assurée par composition et l’outcome est publiable seul.

## 7.34 — L’identité du client frontend est injectable

- **Taille :** S
- **Outcome :** L’identifiant client est produit derrière un port injecté sans accès UUID direct dans le consommateur.
- **Raison principale de changer :** Rendre l’identité client testable sans la confondre avec l’identité d’historique.
- **Frontière principale :** Identité du client frontend.
- **Famille d’invariants :** Unicité et injectabilité de l’identité client.
- **Preuve principale :** Tests avec générateur déterministe et adaptateur navigateur.
- **Éléments de réalisation inclus :** Port ; adaptateur principal ; migration du consommateur cohésif ; retrait de l’accès direct ; documentation.
- **Hors périmètre :** Identité d’historique et comportement fonctionnel des cookies.
- **Surface prévisionnelle :** 5 fichiers de production ; 9 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9
- **Critères de clôture :** Le consommateur contrôle son générateur, l’identité réelle reste disponible par composition et l’outcome est publiable seul.

## 7.35 — La connexion Azure DevOps confine le PAT derrière un contrat opaque

- **Taille :** S
- **Outcome :** L’application ouvre une connexion Azure DevOps sans manipuler ni exposer directement le PAT.
- **Raison principale de changer :** Isoler le secret et les détails de connexion de la logique applicative.
- **Frontière principale :** Port de connexion Azure DevOps.
- **Famille d’invariants :** Confidentialité du PAT et opacité de la connexion.
- **Preuve principale :** Tests contractuels de connexion et de non-exposition du secret.
- **Éléments de réalisation inclus :** Contrat opaque ; gestion locale du PAT ; migration du point d’entrée de référence ; retrait de l’accès direct ; documentation.
- **Hors périmètre :** Authentification complète de chaque plateforme et collecte fonctionnelle.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.15
- **Critères de clôture :** Le consommateur de référence ne voit jamais le PAT, le contrat est substituable et l’outcome est publiable seul.

## 7.36 — La découverte Azure DevOps dépend d’un port applicatif

- **Taille :** S
- **Outcome :** La découverte de projets et d’équipes est exprimée par un port sans détail de transport.
- **Raison principale de changer :** Séparer le besoin applicatif de découverte de son implémentation Azure DevOps.
- **Frontière principale :** Port de découverte Azure DevOps.
- **Famille d’invariants :** Indépendance de la découverte.
- **Preuve principale :** Tests contractuels des résultats et erreurs de découverte.
- **Éléments de réalisation inclus :** Contrat ; modèles de résultat ; migration du consommateur de référence ; retrait du chemin direct ; documentation.
- **Hors périmètre :** Exhaustivité fonctionnelle Cloud et Server/TFS.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.15
- **Critères de clôture :** Le consommateur de référence dépend du port, aucun DTO de transport ne fuite et l’outcome est publiable seul.

## 7.37 — Les requêtes WIQL dépendent d’un port applicatif

- **Taille :** S
- **Outcome :** L’application exprime une requête de delivery sans construire ni exécuter directement le transport WIQL.
- **Raison principale de changer :** Isoler le langage et le transport de requête de la logique applicative.
- **Frontière principale :** Port de requête WIQL.
- **Famille d’invariants :** Encapsulation des requêtes de delivery.
- **Preuve principale :** Tests contractuels de requête, paramètres et diagnostics.
- **Éléments de réalisation inclus :** Contrat ; représentation de requête ; migration de référence ; retrait du chemin direct ; documentation.
- **Hors périmètre :** Pagination et lots partiels relevant de la Feature 8.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.15
- **Critères de clôture :** Le besoin de requête est exprimé sans HTTP ni DTO Azure, les erreurs restent explicites et l’outcome est publiable seul.

## 7.38 — La lecture des work items dépend d’un port applicatif

- **Taille :** S
- **Outcome :** La lecture de work items est accessible par un port dont le contrat ne dépend pas du SDK Azure DevOps.
- **Raison principale de changer :** Isoler la récupération des éléments de travail de la logique delivery.
- **Frontière principale :** Port de lecture des work items.
- **Famille d’invariants :** Encapsulation de la lecture des work items.
- **Preuve principale :** Tests contractuels de lecture et de confinement des DTO.
- **Éléments de réalisation inclus :** Contrat ; résultat interne ; migration de référence ; retrait du chemin direct ; documentation.
- **Hors périmètre :** Types, états, pagination et qualité fonctionnelle de la collecte.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.15
- **Critères de clôture :** Le consommateur de référence ne dépend pas du SDK, les DTO restent internes et l’outcome est publiable seul.

## 7.39 — La lecture des révisions dépend d’un port applicatif

- **Taille :** S
- **Outcome :** La lecture des révisions est accessible par un port distinct de la lecture des work items.
- **Raison principale de changer :** Isoler la temporalité des révisions sans élargir le port des work items.
- **Frontière principale :** Port de lecture des révisions.
- **Famille d’invariants :** Encapsulation de la lecture des révisions.
- **Preuve principale :** Tests contractuels de lecture et de confinement des DTO de révision.
- **Éléments de réalisation inclus :** Contrat ; résultat interne ; migration de référence ; retrait du chemin direct ; documentation.
- **Hors périmètre :** Reconstitution fonctionnelle complète de l’historique Azure DevOps.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.15
- **Critères de clôture :** Le consommateur de référence ne dépend pas du SDK, les DTO restent internes et l’outcome est publiable seul.

## 7.40 — Les DTO Azure DevOps restent confinés dans les adaptateurs

- **Taille :** S
- **Outcome :** Les work items et révisions Azure DevOps deviennent des événements delivery avant de franchir la frontière technique.
- **Raison principale de changer :** Empêcher les formats Azure DevOps de contaminer le domaine et l’application.
- **Frontière principale :** Adaptateurs Azure DevOps.
- **Famille d’invariants :** Confinement et conversion des DTO Azure DevOps.
- **Preuve principale :** Tests des mappages et contrôle automatisé des fuites de DTO.
- **Éléments de réalisation inclus :** Mappages work item et révision ; erreurs de conversion ; migration de référence ; retrait des fuites ; documentation.
- **Hors périmètre :** Règles fonctionnelles de qualité des données et provenance utilisateur.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.15, 7.21, 7.38, 7.39
- **Critères de clôture :** Aucun DTO Azure ne sort des adaptateurs, les événements métier sont prouvés et l’outcome est publiable seul.

## 7.41 — La connexion Cloud respecte le contrat Azure DevOps commun

- **Taille :** S
- **Outcome :** Un adaptateur de connexion Cloud prouve que le contrat commun peut être implémenté sans fuite de plateforme.
- **Raison principale de changer :** Valider la substituabilité du port sur la plateforme Cloud.
- **Frontière principale :** Adaptateur de connexion Azure DevOps Cloud.
- **Famille d’invariants :** Conformité Cloud au contrat de connexion.
- **Preuve principale :** Kit contractuel de connexion exécuté sur l’adaptateur Cloud.
- **Éléments de réalisation inclus :** Adaptateur de référence ; gestion des erreurs Cloud ; tests de conformité ; composition minimale ; documentation.
- **Hors périmètre :** Collecte Cloud complète, pagination, lots partiels et itérations.
- **Surface prévisionnelle :** 6 fichiers de production ; 11 fichiers versionnés
- **Prédécesseurs :** 7.35
- **Critères de clôture :** Le kit commun passe sur Cloud, aucun détail Cloud ne traverse le port et l’outcome est publiable seul.

## 7.42 — La connexion Server/TFS respecte le contrat Azure DevOps commun

- **Taille :** S
- **Outcome :** Un adaptateur de connexion Server/TFS prouve que le contrat commun peut être implémenté avec ses particularités propres.
- **Raison principale de changer :** Valider séparément la substituabilité du port sur Server/TFS.
- **Frontière principale :** Adaptateur de connexion Azure DevOps Server/TFS.
- **Famille d’invariants :** Conformité Server/TFS au contrat de connexion.
- **Preuve principale :** Kit contractuel de connexion exécuté sur l’adaptateur Server/TFS.
- **Éléments de réalisation inclus :** Adaptateur de référence ; gestion des erreurs Server/TFS ; tests de conformité ; composition minimale ; documentation.
- **Hors périmètre :** Collecte Server/TFS complète, pagination, lots partiels et itérations.
- **Surface prévisionnelle :** 6 fichiers de production ; 11 fichiers versionnés
- **Prédécesseurs :** 7.35
- **Critères de clôture :** Le kit commun passe sur Server/TFS, ses particularités restent confinées et l’outcome est publiable seul.

## 7.43 — L’onboarding dépend des ports Azure DevOps plutôt que de la façade historique

- **Taille :** S
- **Outcome :** Le cas d’usage d’onboarding utilise les ports de connexion et de découverte sans appeler la façade `adoClient`.
- **Raison principale de changer :** Prouver les frontières Azure DevOps sur un cas d’usage cohésif réel.
- **Frontière principale :** Cas d’usage d’onboarding Azure DevOps.
- **Famille d’invariants :** Dépendance de l’onboarding envers les ports applicatifs.
- **Preuve principale :** Tests du cas d’usage avec doubles des ports.
- **Éléments de réalisation inclus :** Migration du contrôle du PAT ; migration de la découverte projet et équipe ; retrait des appels directs ; documentation.
- **Hors périmètre :** Migration de tous les consommateurs et comportements complets de collecte.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.35, 7.36, 7.41, 7.42
- **Critères de clôture :** L’onboarding est testable sans `adoClient`, fonctionne par composition et l’outcome est publiable seul.

## 7.44 — Les accès Azure DevOps directs sont empêchés hors adaptateurs

- **Taille :** S
- **Outcome :** Aucun module métier ou applicatif ne peut utiliser le transport Azure DevOps ni l’ancienne façade directement.
- **Raison principale de changer :** Empêcher la réintroduction du couplage supprimé par les ports.
- **Frontière principale :** Accès techniques Azure DevOps.
- **Famille d’invariants :** Exclusivité des adaptateurs Azure DevOps.
- **Preuve principale :** Contrôle architectural des imports et appels HTTP Azure DevOps.
- **Éléments de réalisation inclus :** Règle ; diagnostic ; retrait des responsabilités historiques de la façade ; tests ; intégration au contrôle existant.
- **Hors périmètre :** Fonctionnalités de collecte et compatibilité métier Cloud ou Server/TFS.
- **Surface prévisionnelle :** 5 fichiers de production ; 10 fichiers versionnés
- **Prédécesseurs :** 7.35, 7.36, 7.37, 7.38, 7.39, 7.40, 7.43
- **Critères de clôture :** Les seuls accès techniques résident dans les adaptateurs, toute réintroduction échoue et l’outcome est publiable seul.

## 7.45 — Le moteur Python est accessible par un port sans type NumPy

- **Taille :** S
- **Outcome :** Le backend exécute une simulation Python par un port dont les entrées et sorties ne révèlent aucun type NumPy.
- **Raison principale de changer :** Isoler le moteur statistique de la couche HTTP et de l’application.
- **Frontière principale :** Port du moteur Python.
- **Famille d’invariants :** Indépendance du contrat moteur vis-à-vis de NumPy.
- **Preuve principale :** Tests contractuels du port et du chemin `POST /simulate`.
- **Éléments de réalisation inclus :** Port ; adaptateur principal ; migration de la route ; retrait de l’accès direct ; contrôle de non-régression ; documentation.
- **Hors périmètre :** Distribution externe du package Python relevant de la Feature 3.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.11
- **Critères de clôture :** La route fonctionne par le port, aucun type NumPy ne fuite et l’outcome est publiable seul.

## 7.46 — Le moteur TypeScript local est accessible par un port applicatif

- **Taille :** S
- **Outcome :** Le chemin de démonstration exécute le moteur TypeScript local derrière un contrat applicatif stable.
- **Raison principale de changer :** Rendre le moteur local substituable sans modifier ses consommateurs.
- **Frontière principale :** Adaptateur du moteur TypeScript local.
- **Famille d’invariants :** Conformité du moteur local au port de simulation.
- **Preuve principale :** Tests contractuels du moteur local et du chemin de démonstration.
- **Éléments de réalisation inclus :** Port partagé ; adaptateur local ; migration du chemin de démonstration ; retrait de l’accès direct ; documentation.
- **Hors périmètre :** Moteur HTTP et expérience fonctionnelle de simulation.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.11
- **Critères de clôture :** Le chemin de démonstration ne connaît que le port, l’accès direct est empêché et l’outcome est publiable seul.

## 7.47 — Le moteur TypeScript HTTP est accessible par un port applicatif

- **Taille :** S
- **Outcome :** Le chemin standard exécute le moteur HTTP derrière le même contrat applicatif sans détail de transport.
- **Raison principale de changer :** Rendre le moteur HTTP substituable sans coupler l’application au protocole.
- **Frontière principale :** Adaptateur du moteur TypeScript HTTP.
- **Famille d’invariants :** Conformité du moteur HTTP au port de simulation.
- **Preuve principale :** Tests contractuels du moteur HTTP et du chemin standard.
- **Éléments de réalisation inclus :** Adaptateur HTTP ; mappage transport ; migration du chemin standard ; retrait de l’accès direct ; documentation.
- **Hors périmètre :** Moteur local et comportements de résilience fonctionnelle.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.46
- **Critères de clôture :** Le chemin standard ne connaît que le port, le transport reste confiné et l’outcome est publiable seul.

## 7.48 — La persistance des simulations dépend d’un port applicatif

- **Taille :** S
- **Outcome :** Les cas d’usage expriment la sauvegarde et la lecture d’historiques par un port sans dépendance MongoDB.
- **Raison principale de changer :** Séparer le cycle applicatif des choix de persistance.
- **Frontière principale :** Port de persistance des simulations.
- **Famille d’invariants :** Contrat de sauvegarde et lecture d’historiques.
- **Preuve principale :** Tests contractuels du port avec un double contrôlé.
- **Éléments de réalisation inclus :** Port ; modèles d’entrée et sortie ; migration du groupe de cas d’usage cohésif ; retrait des types Mongo ; documentation.
- **Hors périmètre :** Implémentations MongoDB et mémoire.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.8, 7.9, 7.15
- **Critères de clôture :** Les cas d’usage sont testables sans base de données, aucun DTO Mongo ne fuite et l’outcome est publiable seul.

## 7.49 — MongoDB implémente le port de persistance des simulations

- **Taille :** S
- **Outcome :** La persistance MongoDB respecte le port applicatif et confine ses modèles, erreurs et cycle de connexion.
- **Raison principale de changer :** Rendre MongoDB remplaçable sans modifier les cas d’usage.
- **Frontière principale :** Adaptateur de persistance MongoDB.
- **Famille d’invariants :** Conformité MongoDB au port de persistance.
- **Preuve principale :** Kit contractuel exécuté sur l’adaptateur MongoDB.
- **Éléments de réalisation inclus :** Adaptateur ; mappage de persistance ; composition ; migration des accès cohésifs ; retrait des accès directs ; documentation.
- **Hors périmètre :** Adaptateur mémoire et politiques fonctionnelles de rétention.
- **Surface prévisionnelle :** 8 fichiers de production ; 14 fichiers versionnés
- **Prédécesseurs :** 7.32, 7.48
- **Critères de clôture :** Le kit passe sur MongoDB, les détails restent confinés et l’outcome est publiable seul.

## 7.50 — La mémoire implémente le port de persistance des simulations

- **Taille :** XS
- **Outcome :** Un adaptateur mémoire respecte le port de persistance pour les scénarios sans MongoDB.
- **Raison principale de changer :** Fournir une substitution locale déterministe distincte du mécanisme MongoDB.
- **Frontière principale :** Adaptateur de persistance mémoire.
- **Famille d’invariants :** Conformité mémoire au port de persistance.
- **Preuve principale :** Kit contractuel exécuté sur l’adaptateur mémoire.
- **Éléments de réalisation inclus :** Adaptateur ; composition locale ; tests de conformité ; documentation.
- **Hors périmètre :** Persistance durable, concurrence et comportement MongoDB.
- **Surface prévisionnelle :** 4 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 7.48
- **Critères de clôture :** Le kit passe sur l’adaptateur mémoire, ses limites sont explicites et l’outcome est publiable seul.

## 7.51 — L’historique d’équipe est exposé par un cas d’usage applicatif

- **Taille :** S
- **Outcome :** Un cas d’usage retourne un historique d’équipe métier avec ses diagnostics sans exposer Azure DevOps ni la persistance.
- **Raison principale de changer :** Donner une frontière applicative unique à l’acquisition d’un historique.
- **Frontière principale :** Cas d’usage d’historique d’équipe.
- **Famille d’invariants :** Orchestration et conservation des diagnostics d’historique.
- **Preuve principale :** Tests du cas d’usage avec doubles des ports Azure DevOps et de persistance.
- **Éléments de réalisation inclus :** Contrat du cas d’usage ; orchestration ; migration du consommateur de référence ; retrait de l’appel façade ; documentation.
- **Hors périmètre :** Collecte fonctionnelle exhaustive et présentation de la qualité des données.
- **Surface prévisionnelle :** 8 fichiers de production ; 14 fichiers versionnés
- **Prédécesseurs :** 7.30, 7.35, 7.36, 7.37, 7.38, 7.39, 7.40, 7.48
- **Critères de clôture :** Le cas d’usage est prouvé par doubles, retourne le résultat delivery complet et l’outcome est publiable seul.

## 7.52 — La prévision d’équipe est exposée par un cas d’usage applicatif

- **Taille :** S
- **Outcome :** Un cas d’usage orchestre la prévision d’équipe à partir d’un historique et d’un port moteur.
- **Raison principale de changer :** Retirer l’orchestration de prévision des hooks et services techniques.
- **Frontière principale :** Cas d’usage de prévision d’équipe.
- **Famille d’invariants :** Orchestration applicative de la prévision d’équipe.
- **Preuve principale :** Tests du cas d’usage avec historique et moteur contrôlés.
- **Éléments de réalisation inclus :** Contrat ; orchestration ; migration du noyau consommateur ; retrait du chemin historique ; documentation.
- **Hors périmètre :** Affichage des résultats et expérience de lancement.
- **Surface prévisionnelle :** 8 fichiers de production ; 14 fichiers versionnés
- **Prédécesseurs :** 7.19, 7.25, 7.26, 7.45, 7.46, 7.47, 7.51
- **Critères de clôture :** Le cas d’usage est testable sans UI, moteur réel ni Azure DevOps et l’outcome est publiable seul.

## 7.53 — La prévision portefeuille est exposée par un cas d’usage applicatif

- **Taille :** S
- **Outcome :** Un cas d’usage orchestre une prévision portefeuille à partir de configurations et prévisions d’équipes.
- **Raison principale de changer :** Retirer l’orchestration portefeuille des hooks React.
- **Frontière principale :** Cas d’usage de prévision portefeuille.
- **Famille d’invariants :** Orchestration applicative de la prévision portefeuille.
- **Preuve principale :** Tests du cas d’usage avec équipes et progression contrôlées.
- **Éléments de réalisation inclus :** Contrat ; orchestration ; progression applicative ; migration du consommateur cohésif ; retrait du chemin historique ; documentation.
- **Hors périmètre :** Pilotage de programme et comportement visuel de progression.
- **Surface prévisionnelle :** 8 fichiers de production ; 14 fichiers versionnés
- **Prédécesseurs :** 7.20, 7.31, 7.34, 7.52
- **Critères de clôture :** Le cas d’usage est testable sans hook React, expose sa progression par contrat et l’outcome est publiable seul.

## 7.54 — La composition frontend assemble uniquement des ports applicatifs

- **Taille :** S
- **Outcome :** Un composition root frontend choisit les adaptateurs sans exposer leurs détails aux cas d’usage.
- **Raison principale de changer :** Centraliser les choix techniques frontend hors de la logique applicative.
- **Frontière principale :** Composition frontend.
- **Famille d’invariants :** Assemblage des dépendances frontend.
- **Preuve principale :** Tests de composition et contrôle des imports des cas d’usage.
- **Éléments de réalisation inclus :** Composition root ; configuration des adaptateurs ; migration des points d’entrée ; retrait des constructions dispersées ; documentation.
- **Hors périmètre :** Composition backend et fonctionnalités de l’interface.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.31, 7.34, 7.41, 7.42, 7.43, 7.46, 7.47, 7.52, 7.53
- **Critères de clôture :** Les points d’entrée assemblent des ports, les cas d’usage ignorent les adaptateurs et l’outcome est publiable seul.

## 7.55 — La composition backend assemble uniquement des ports applicatifs

- **Taille :** S
- **Outcome :** Un composition root backend choisit moteur, horloge et persistance sans contaminer les routes ni cas d’usage.
- **Raison principale de changer :** Centraliser les choix techniques backend hors de la logique applicative.
- **Frontière principale :** Composition backend.
- **Famille d’invariants :** Assemblage des dépendances backend.
- **Preuve principale :** Tests de composition et contrôle des imports backend.
- **Éléments de réalisation inclus :** Composition root ; configuration des adaptateurs ; migration du point d’entrée ; retrait des constructions dispersées ; documentation.
- **Hors périmètre :** Composition frontend et déploiement de l’application.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.32, 7.33, 7.45, 7.48, 7.49, 7.50, 7.51
- **Critères de clôture :** Le point d’entrée assemble des ports, les routes ignorent les adaptateurs et l’outcome est publiable seul.

## 7.56 — La frontière d’identité backend expose le minimum nécessaire

- **Taille :** XS
- **Outcome :** Le backend expose uniquement les informations d’identité requises par ses cas d’usage.
- **Raison principale de changer :** Empêcher l’identité technique de devenir une façade transversale.
- **Frontière principale :** Identité backend.
- **Famille d’invariants :** Minimisation du contrat d’identité.
- **Preuve principale :** Tests du contrat public et contrôle des imports profonds.
- **Éléments de réalisation inclus :** Contrat minimal ; migration du consommateur ; retrait des exports inutiles ; documentation.
- **Hors périmètre :** Authentification utilisateur et génération d’identité d’historique.
- **Surface prévisionnelle :** 4 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 7.12, 7.55
- **Critères de clôture :** Aucun consommateur ne dépend d’un détail d’identité, le contrat minimal est prouvé et l’outcome est publiable seul.

## 7.57 — Le limiteur de simulation est observable hors de la route HTTP

- **Taille :** S
- **Outcome :** Le limiteur possède une responsabilité applicative explicite avec état et diagnostics observables.
- **Raison principale de changer :** Séparer la maîtrise de charge du protocole HTTP.
- **Frontière principale :** Limitation applicative des simulations.
- **Famille d’invariants :** Capacité et observabilité du limiteur.
- **Preuve principale :** Tests de capacité, libération et diagnostics du limiteur.
- **Éléments de réalisation inclus :** Contrat ; implémentation ; migration de la route et de la composition ; retrait de l’ancien câblage ; documentation.
- **Hors périmètre :** SLO et montée en charge distribuée relevant de la Feature 11.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.45, 7.55
- **Critères de clôture :** La route délègue au limiteur, son état est testable, l’ancien câblage a disparu et l’outcome est publiable seul.

## 7.58 — Le cycle de persistance des simulations est orchestré hors de la route HTTP

- **Taille :** S
- **Outcome :** La route déclenche une orchestration applicative de sauvegarde sans appeler MongoDB ni un store concret.
- **Raison principale de changer :** Séparer la persistance du traitement du protocole HTTP.
- **Frontière principale :** Orchestration de persistance backend.
- **Famille d’invariants :** Atomicité du cycle de sauvegarde applicatif.
- **Preuve principale :** Tests de la route avec port de persistance contrôlé.
- **Éléments de réalisation inclus :** Orchestration ; migration de la sauvegarde, lecture et cycle de vie cohésifs ; retrait des accès directs ; contrôle architectural ; documentation.
- **Hors périmètre :** Politiques fonctionnelles de rétention et mécanismes autres que MongoDB ou mémoire.
- **Surface prévisionnelle :** 8 fichiers de production ; 14 fichiers versionnés
- **Prédécesseurs :** 7.48, 7.49, 7.50, 7.55, 7.57
- **Critères de clôture :** La route ne connaît que l’orchestration, aucun accès Mongo direct subsiste et l’outcome est publiable seul.

## 7.59 — L’orchestration des prévisions est indépendante des hooks React

- **Taille :** S
- **Outcome :** Les hooks React déclenchent les cas d’usage de prévision sans porter de règles d’orchestration.
- **Raison principale de changer :** Rendre les prévisions testables et réutilisables hors de React.
- **Frontière principale :** Adaptation React des cas d’usage de prévision.
- **Famille d’invariants :** Absence d’orchestration applicative dans les hooks.
- **Preuve principale :** Tests des hooks avec cas d’usage contrôlés et contrôle des imports.
- **Éléments de réalisation inclus :** Migration des hooks cohésifs ; adaptation des résultats et progressions ; retrait de l’ancienne orchestration ; documentation.
- **Hors périmètre :** Comportement visuel de lancement, cache et historique local relevant de la Feature 10.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.19, 7.20, 7.52, 7.53, 7.54
- **Critères de clôture :** Les hooks ne décident plus de l’orchestration, les cas d’usage restent substituables et l’outcome est publiable seul.

## 7.60 — Le résultat équipe possède un modèle de présentation indépendant

- **Taille :** S
- **Outcome :** Un modèle de présentation équipe traduit le résultat applicatif sans ajouter de calcul métier.
- **Raison principale de changer :** Découpler les besoins de restitution du contrat des cas d’usage.
- **Frontière principale :** Présentation du résultat équipe.
- **Famille d’invariants :** Fidélité du modèle de présentation équipe.
- **Preuve principale :** Tests de mappage depuis le résultat applicatif.
- **Éléments de réalisation inclus :** Modèle ; mapper ; migration des consommateurs structurants ; retrait des formes concurrentes ; documentation.
- **Hors périmètre :** Mise en page, formulation, accessibilité et téléchargement relevant de la Feature 10.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.30, 7.52
- **Critères de clôture :** Le modèle conserve les valeurs et diagnostics, ne recalcule rien et l’outcome est publiable seul.

## 7.61 — Le résultat portefeuille possède un modèle de présentation indépendant

- **Taille :** S
- **Outcome :** Un modèle de présentation portefeuille traduit le résultat applicatif sans ajouter de calcul métier.
- **Raison principale de changer :** Découpler les restitutions portefeuille du contrat du cas d’usage.
- **Frontière principale :** Présentation du résultat portefeuille.
- **Famille d’invariants :** Fidélité du modèle de présentation portefeuille.
- **Preuve principale :** Tests de mappage depuis le résultat applicatif portefeuille.
- **Éléments de réalisation inclus :** Modèle ; mapper ; migration des consommateurs structurants ; retrait des formes concurrentes ; documentation.
- **Hors périmètre :** Pilotage de programme, mise en page et téléchargement.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.53
- **Critères de clôture :** Le modèle conserve les valeurs et diagnostics, ne recalcule rien et l’outcome est publiable seul.

## 7.62 — React ne contient aucun calcul métier de restitution

- **Taille :** S
- **Outcome :** Les composants React consomment les modèles de présentation sans recalculer les résultats de simulation.
- **Raison principale de changer :** Empêcher les divergences métier entre le domaine et l’interface.
- **Frontière principale :** Adaptateurs de présentation React.
- **Famille d’invariants :** Absence de calcul métier dans React.
- **Preuve principale :** Tests des composants avec modèles contrôlés et contrôle architectural ciblé.
- **Éléments de réalisation inclus :** Migration des composants cohésifs ; retrait des calculs ; règle de non-régression ; tests ; documentation.
- **Hors périmètre :** Design, accessibilité et comportement fonctionnel de l’expérience.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.60, 7.61
- **Critères de clôture :** Les composants affichent les modèles sans dériver de valeur métier, toute réintroduction échoue et l’outcome est publiable seul.

## 7.63 — Les rapports ne contiennent aucun calcul métier

- **Taille :** S
- **Outcome :** Les adaptateurs de rapport consomment les modèles de présentation sans recalculer les résultats de simulation.
- **Raison principale de changer :** Empêcher les divergences métier entre le domaine et les rapports.
- **Frontière principale :** Adaptateurs de rapport.
- **Famille d’invariants :** Absence de calcul métier dans les rapports.
- **Preuve principale :** Tests des adaptateurs avec modèles contrôlés et contrôle architectural ciblé.
- **Éléments de réalisation inclus :** Migration des rendus structurants ; retrait des calculs ; règle de non-régression ; tests ; documentation.
- **Hors périmètre :** Contenu, pagination, téléchargement et formulation des rapports relevant de la Feature 10.
- **Surface prévisionnelle :** 8 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.60, 7.61
- **Critères de clôture :** Les rapports rendent les modèles sans dériver de valeur métier, toute réintroduction échoue et l’outcome est publiable seul.

## 7.64 — Les adaptateurs UI et rapport évoluent indépendamment

- **Taille :** S
- **Outcome :** L’UI et les rapports partagent des modèles stables mais ne dépendent pas de leurs implémentations respectives.
- **Raison principale de changer :** Permettre une évolution de restitution sans modification collatérale.
- **Frontière principale :** Séparation des adaptateurs de présentation.
- **Famille d’invariants :** Indépendance entre UI et rapports.
- **Preuve principale :** Tests de contrat des modèles et contrôle des dépendances entre adaptateurs.
- **Éléments de réalisation inclus :** API des modèles ; migration des imports ; retrait des dépendances croisées ; contrôle de non-régression ; documentation.
- **Hors périmètre :** Cohérence fonctionnelle et visuelle entre les restitutions.
- **Surface prévisionnelle :** 7 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.62, 7.63
- **Critères de clôture :** Chaque adaptateur peut être remplacé sans modifier l’autre, les modèles restent communs et l’outcome est publiable seul.

## 7.65 — La génération des rapports ne dépend pas du DOM

- **Taille :** XS
- **Outcome :** Un rapport reçoit des données structurées et ne lit jamais le DOM de l’interface.
- **Raison principale de changer :** Séparer le rendu de rapport de l’état visuel du navigateur.
- **Frontière principale :** Entrée des adaptateurs de rapport.
- **Famille d’invariants :** Indépendance des rapports vis-à-vis du DOM.
- **Preuve principale :** Test de génération sans environnement DOM et contrôle des accès interdits.
- **Éléments de réalisation inclus :** Entrée structurée ; migration du rendu de référence ; retrait des lectures DOM ; contrôle ; documentation.
- **Hors périmètre :** Contenu fonctionnel et pagination du PDF.
- **Surface prévisionnelle :** 5 fichiers de production ; 9 fichiers versionnés
- **Prédécesseurs :** 7.63, 7.64
- **Critères de clôture :** Le rendu de référence fonctionne sans DOM, toute lecture métier du DOM échoue et l’outcome est publiable seul.

## 7.66 — Les modèles de présentation sont accessibles par une API publique stable

- **Taille :** XS
- **Outcome :** Les consommateurs de présentation utilisent une API publique sans importer les mappers ou structures internes.
- **Raison principale de changer :** Rendre l’implémentation de présentation modifiable localement.
- **Frontière principale :** API publique de présentation.
- **Famille d’invariants :** Encapsulation des modèles de présentation.
- **Preuve principale :** Tests de l’API et contrôle des imports profonds.
- **Éléments de réalisation inclus :** API publique ; migration des imports ; retrait des exports internes ; contrôle ; documentation.
- **Hors périmètre :** Comportements fonctionnels des restitutions.
- **Surface prévisionnelle :** 5 fichiers de production ; 9 fichiers versionnés
- **Prédécesseurs :** 7.12, 7.60, 7.61, 7.64, 7.65
- **Critères de clôture :** Les consommateurs utilisent l’API stable, les détails restent privés et l’outcome est publiable seul.

## 7.67 — Le graphe produit reste indépendant de l’infrastructure qualité

- **Taille :** S
- **Outcome :** Les scripts de qualité inspectent le produit sans devenir une dépendance de ses modules ni importer leurs adaptateurs internes.
- **Raison principale de changer :** Préserver une frontière nette entre système observé et système de preuve.
- **Frontière principale :** Frontière produit-qualité.
- **Famille d’invariants :** Direction des dépendances entre produit et qualité.
- **Preuve principale :** Analyse du graphe et tests des imports interdits.
- **Éléments de réalisation inclus :** Règle de frontière ; migration des imports problématiques ; tests ; diagnostic ; documentation.
- **Hors périmètre :** Rationalisation, coût et fusion des contrôles relevant de la Feature 13.
- **Surface prévisionnelle :** 6 fichiers de production ; 11 fichiers versionnés
- **Prédécesseurs :** 7.3, 7.8, 7.11, 7.12
- **Critères de clôture :** Le produit ne dépend pas de la qualité, la qualité n’importe pas d’adaptateur interne et l’outcome est publiable seul.

## 7.68 — Le runner statistique reste indépendant des adaptateurs backend

- **Taille :** S
- **Outcome :** Le runner statistique consomme une preuve publique sans importer le package interne du backend.
- **Raison principale de changer :** Éviter un couplage inverse entre preuve statistique et application backend.
- **Frontière principale :** Runner de preuve statistique.
- **Famille d’invariants :** Indépendance du runner statistique.
- **Preuve principale :** Exécution du runner avec contrôle du graphe d’import.
- **Éléments de réalisation inclus :** Contrat de preuve ; migration du runner ; retrait de l’import interne ; test de non-régression ; documentation.
- **Hors périmètre :** Modification du cœur statistique et rationalisation du runner.
- **Surface prévisionnelle :** 6 fichiers de production ; 11 fichiers versionnés
- **Prédécesseurs :** 7.67
- **Critères de clôture :** Le runner produit la même preuve par l’API autorisée, aucun import backend interne subsiste et l’outcome est publiable seul.

## 7.69 — La preuve statistique possède un producteur et un vérificateur indépendants du produit

- **Taille :** S
- **Outcome :** Un modèle de preuve partagé permet à un producteur et à un vérificateur indépendants du produit de coopérer.
- **Raison principale de changer :** Empêcher la preuve de dépendre de l’implémentation qu’elle vérifie.
- **Frontière principale :** Preuve statistique.
- **Famille d’invariants :** Indépendance de production et de vérification de la preuve.
- **Preuve principale :** Test d’un rapport produit puis vérifié sans import produit interne.
- **Éléments de réalisation inclus :** Modèle de rapport ; producteur ; vérificateur ; migration locale de l’orchestration ; tests ; documentation.
- **Hors périmètre :** Identité de snapshot et orchestration DAG du noyau statistique déjà clôturé.
- **Surface prévisionnelle :** 7 fichiers de production ; 13 fichiers versionnés
- **Prédécesseurs :** 7.67, 7.68
- **Critères de clôture :** Le rapport constitue la seule interface, production et vérification restent séparées et l’outcome est publiable seul.

## 7.70 — L’orchestration qualité délègue ses chemins d’exécution à des composants explicites

- **Taille :** S
- **Outcome :** L’orchestrateur de gate délègue la classification et l’exécution de ses chemins sans contenir leurs mécanismes internes.
- **Raison principale de changer :** Empêcher `quality_gate` de devenir un nouveau point de concentration transversal.
- **Frontière principale :** Orchestration de la quality gate.
- **Famille d’invariants :** Séparation entre orchestration et exécution qualité.
- **Preuve principale :** Tests du plan de gate avec composants d’exécution contrôlés.
- **Éléments de réalisation inclus :** Contrats d’exécution ; délégation des chemins existants ; migration mécanique ; tests ; documentation.
- **Hors périmètre :** Réduction du temps de feedback, suppression ou fusion de contrôles relevant de la Feature 13.
- **Surface prévisionnelle :** 8 fichiers de production ; 14 fichiers versionnés
- **Prédécesseurs :** 7.17, 7.67, 7.68, 7.69
- **Critères de clôture :** L’orchestrateur ne porte plus les mécanismes délégués, les profils restent équivalents et l’outcome est publiable seul.

## 7.71 — L’architecture est vérifiée dans le workspace

- **Taille :** S
- **Outcome :** Le workspace courant démontre toutes les frontières architecturales et leur non-régression.
- **Raison principale de changer :** Obtenir une preuve locale reproductible avant les autres chemins d’exécution.
- **Frontière principale :** Validation architecturale du workspace.
- **Famille d’invariants :** Conformité architecturale locale.
- **Preuve principale :** Exécution verte du contrôle architectural et des preuves ciblées dans le workspace.
- **Éléments de réalisation inclus :** Scénario de validation ; agrégation des preuves ; diagnostic des écarts ; documentation de reproduction.
- **Hors périmètre :** Worktree détaché et CI.
- **Surface prévisionnelle :** 0 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 7.18, 7.44, 7.56, 7.58, 7.59, 7.66, 7.70
- **Critères de clôture :** Le scénario local est vert depuis un workspace propre et sa preuve peut être publiée indépendamment des autres chemins.

## 7.72 — L’architecture est vérifiée dans un worktree détaché

- **Taille :** S
- **Outcome :** Le contrôle architectural et ses autorités fonctionnent depuis un worktree détaché sans dépendance au chemin courant.
- **Raison principale de changer :** Couvrir le risque propre de résolution des chemins dans cet environnement.
- **Frontière principale :** Validation architecturale en worktree détaché.
- **Famille d’invariants :** Portabilité de la preuve architecturale.
- **Preuve principale :** Exécution verte dans un worktree détaché éphémère.
- **Éléments de réalisation inclus :** Scénario dédié ; résolution des autorités ; diagnostic ; documentation de reproduction.
- **Hors périmètre :** Nouveau hook Git et validation CI.
- **Surface prévisionnelle :** 0 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 7.71
- **Critères de clôture :** Le scénario détaché est vert sans état du workspace principal et sa preuve est publiable seule.

## 7.73 — L’architecture est vérifiée dans la CI

- **Taille :** S
- **Outcome :** La CI bloque une violation architecturale en utilisant la même autorité que le workspace.
- **Raison principale de changer :** Protéger la branche partagée contre les régressions architecturales.
- **Frontière principale :** Validation architecturale en CI.
- **Famille d’invariants :** Parité de l’enforcement architectural.
- **Preuve principale :** Exécution CI verte et mutation contrôlée démontrant le blocage.
- **Éléments de réalisation inclus :** Étape CI existante ; branchement de l’autorité ; test de planification ; diagnostic ; documentation.
- **Hors périmètre :** Approvisionnement des images CI relevant de la Feature 13.
- **Surface prévisionnelle :** 0 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 7.17, 7.71
- **Critères de clôture :** La même règle passe localement et en CI, une mutation échoue et l’outcome est publiable seul.

## 7.74 — La réduction du coût de changement est mesurée

- **Taille :** M
- **Outcome :** Les scénarios de la baseline traversent moins de frontières et de hotspots après la migration sans perte de comportement.
- **Raison principale de changer :** Démontrer que la Feature 7 réduit réellement la portée des évolutions.
- **Frontière principale :** Mesure du coût de changement.
- **Famille d’invariants :** Comparabilité avant-après des scénarios architecturaux.
- **Preuve principale :** Rapport comparatif reproductible sur les scénarios de la baseline.
- **Éléments de réalisation inclus :** Rejeu des scénarios ; mesure des surfaces ; comparaison ; analyse des écarts ; documentation des limites.
- **Hors périmètre :** Rationalisation du coût des contrôles qualité relevant de la Feature 13.
- **Surface prévisionnelle :** 0 fichiers de production ; 12 fichiers versionnés
- **Prédécesseurs :** 7.5, 7.71, 7.72, 7.73
- **Critères de clôture :** La méthode est identique avant et après, la réduction est chiffrée, les exceptions sont expliquées et l’outcome est publiable seul.
- **Justification de la taille M :** La difficulté tient à une mesure comparative fiable d’un seul résultat, pas à l’agrégation de nouvelles frontières ou capacités.

## 7.75 — L’engageabilité de la Feature 8 est démontrée par un historique d’équipe

- **Taille :** S
- **Outcome :** Un historique d’équipe traverse les frontières communes jusqu’au cas d’usage sans dépendre des capacités fonctionnelles encore à raffiner de la Feature 8.
- **Raison principale de changer :** Prouver que la prochaine Feature peut s’appuyer sur l’architecture sans réouvrir ses fondations.
- **Frontière principale :** Cas d’acceptation architectural de l’historique d’équipe.
- **Famille d’invariants :** Engageabilité des frontières communes Azure DevOps et delivery.
- **Preuve principale :** Test d’acceptation architectural avec adaptateur de référence et cas d’usage d’historique.
- **Éléments de réalisation inclus :** Scénario de référence ; données contrôlées ; vérification des frontières ; documentation des préconditions de Feature 8.
- **Hors périmètre :** Pagination, lots partiels, itérations, contexte de sprint et compatibilité fonctionnelle complète.
- **Surface prévisionnelle :** 0 fichiers de production ; 10 fichiers versionnés
- **Prédécesseurs :** 7.40, 7.43, 7.44, 7.51, 7.71, 7.72, 7.73, 7.74
- **Critères de clôture :** Le scénario traverse uniquement les ports publiés, toutes les preuves sont vertes et Feature 8 reste marquée à raffiner avant engagement.

## Attestation synthétique de conformité

Les 75 PBI de la Feature 7 ont été audités et sont conformes au standard de granularité : chacun porte un
outcome autonome, une seule raison principale de changer, une frontière et une preuve principales, ne se
réduit pas à une tâche technique et peut être publié seul. La conformité structurelle reste vérifiée par
`Scripts/check_backlog_atomicity.py`.

- **PBI audités :** 75
- **Titres purement opératoires :** 0
- **PBI `L` ou `XL` :** 0
- **Cycles :** 0
- **Prédécesseurs futurs :** 0
- **Exceptions :** 0

### Justifications des PBI `M`

- **7.8 — L’architecture cible possède des frontières acceptées :** la difficulté vient de la décision cohérente sur une seule architecture cible, pas de la livraison simultanée de ses migrations.
- **7.19 — La prévision frontend dépend d’un contrat indépendant de React :** le contrat, la migration cohésive et le retrait du cycle forment un seul état publiable ; les séparer créerait une façade transitoire artificielle.
- **7.74 — La réduction du coût de changement est mesurée :** la difficulté tient à une mesure comparative fiable d’un seul résultat, pas à l’agrégation de nouvelles frontières ou capacités.

### Exceptions

Aucune.

## Résultats restitués

- **Feature 3 :** distribution externe, API distribuable, wheel, sdist et preuve par consommateur externe du package Python.
- **Feature 8 :** collectes Cloud et Server/TFS complètes, pagination, lots partiels, provenance, types et états, périmètres d’équipe, qualité des données, itérations, contexte de sprint et compatibilité fonctionnelle.
- **Feature 10 :** expérience utilisateur, contenu et pagination PDF, téléchargements, accessibilité, formulations, cohérence visuelle et comportements fonctionnels des exports.
- **Feature 13 :** rationalisation et coût des contrôles, temps de feedback, maintenance, gouvernance des images CI et reprise par un contributeur.
