# Backlog consolidé et ordonnancé

## Feature 1 — Disposer d’un système de preuve qualité gouverné

**Description :** mettre en place un dispositif capable de classifier, sélectionner, exécuter, dénombrer et piloter automatiquement les tests selon leur nature réelle, leurs finalités, leurs risques et leurs profils d’exécution.

**Flux de valeur :** rendre mesurable et vérifiable la confiance apportée par la stratégie de test, plutôt que de s’appuyer uniquement sur le volume de tests ou la couverture du code.

| Numéro | Titre                                                                | Complexité | Modèle Codex | Réalisé le |
| -----: | -------------------------------------------------------------------- | :--------: | :----------: |:----------:|
|    1.1 | Versionner le standard de test et aligner la documentation normative |      M     |  Sol Medium  | 18/07/2026 |
|    1.2 | Auditer et résorber la dette documentaire Markdown                   |      L     |   Sol High   |            |
|    1.3 | Cartographier les risques et les parcours critiques                  |      L     |  Sol Medium  |            |
|    1.4 | Définir le modèle de classification des tests                        |      M     |   Sol High   |            |
|    1.5 | Classifier automatiquement le patrimoine de tests existant           |      L     |   Sol High   |            |
|    1.6 | Distinguer les cas logiques des instances exécutées                  |      L     |   Sol High   |            |
|    1.7 | Bloquer les classifications absentes ou invalides                    |      M     |   Sol High   |            |
|    1.8 | Recomposer les profils d’exécution CI/CD                             |      L     |   Sol High   |            |
|    1.9 | Gouverner les tests ignorés, intermittents et en quarantaine         |      M     |   Sol High   |            |
|   1.10 | Publier un reporting consolidé de la stratégie de test               |      L     |   Sol High   |            |

---

## Feature 2 — Garantir la fiabilité du cœur statistique

**Description :** formaliser les règles statistiques communes, supprimer les divergences involontaires entre Python et TypeScript et protéger les invariants du moteur par des contrats et des jeux de référence partagés.

**Flux de valeur :** assurer que les projections, diagnostics et décisions reposent sur des calculs cohérents, reproductibles et explicables, quel que soit le chemin d’exécution utilisé.

| Numéro | Titre                                                         | Complexité | Modèle Codex |
| -----: | ------------------------------------------------------------- | :--------: | :----------: |
|    2.1 | Auditer les divergences statistiques Python et TypeScript     |      M     |   Sol High   |
|    2.2 | Définir le contrat normatif de parité statistique             |      M     |   Sol High   |
|    2.3 | Séparer les DTO des modèles statistiques métier               |      L     |   Sol High   |
|    2.4 | Introduire les Value Objects statistiques prioritaires        |      L     |   Sol High   |
|    2.5 | Injecter l’aléatoire, l’horloge et les identifiants variables |      M     |   Sol High   |
|    2.6 | Construire les jeux de référence statistiques partagés        |      M     |   Sol High   |
|    2.7 | Aligner les implémentations statistiques                      |      L     |   Sol High   |
|    2.8 | Bloquer les régressions de parité entre les moteurs           |      L     |   Sol High   |

---

## Feature 3 — Rendre le moteur statistique réutilisable et intégrable

**Description :** extraire le cœur Monte Carlo dans un package Python autonome, documenté, versionné et utilisable sans Azure DevOps, FastAPI, MongoDB ou frontend.

**Flux de valeur :** rendre concrète la promesse Apache 2.0 en permettant à un intégrateur tiers d’utiliser directement le moteur sans devoir comprendre, forker ou nettoyer l’ensemble de l’application.

| Numéro | Titre                                                                    | Complexité | Modèle Codex |
| -----: | ------------------------------------------------------------------------ | :--------: | :----------: |
|    3.1 | Séparer les trajectoires d’usage personnel et de réutilisabilité externe |      M     |  Sol Medium  |
|    3.2 | Définir le périmètre et l’API publique du package                        |      M     |   Sol High   |
|    3.3 | Extraire le moteur et ses validations dans un package autonome           |      L     |   Sol High   |
|    3.4 | Versionner, construire et tester le package isolément                    |      L     |   Sol High   |
|    3.5 | Écrire un guide minimal d’intégration du moteur                          |      M     |  Sol Medium  |

---

## Feature 4 — Sécuriser la mise en production personnelle

**Description :** corriger les risques immédiats de persistance, de conteneurisation et d’identification des clients avant toute exposition réelle de l’application.

**Flux de valeur :** permettre un déploiement personnel exploitable sans croissance silencieuse du stockage, privilèges excessifs dans le conteneur ou contournement du rate limiting.

| Numéro | Titre                                                           | Complexité | Modèle Codex |
| -----: | --------------------------------------------------------------- | :--------: | :----------: |
|    4.1 | Corriger la politique de rétention des simulations MongoDB      |      M     |   Sol High   |
|    4.2 | Prouver la purge des simulations anciennes pour un client actif |      M     |   Sol High   |
|    4.3 | Séparer les dépendances Python runtime et développement         |      M     |   Sol High   |
|    4.4 | Exécuter le conteneur applicatif avec un utilisateur non-root   |      M     |   Sol High   |
|    4.5 | Définir le modèle de confiance des adresses clientes            |      S     |   Sol High   |
|    4.6 | Appliquer et tester la politique de proxy de confiance          |      L     |   Sol High   |

---

## Feature 5 — Valider la valeur d’usage du mode portefeuille

**Description :** observer l’utilisation réelle du portefeuille avant d’ajouter de nouveaux scénarios, diagnostics ou niveaux de complexité à l’interface.

**Flux de valeur :** vérifier que les quatre hypothèses et les trois dimensions de diagnostic facilitent réellement la décision en comité plutôt que d’augmenter la charge cognitive et le besoin d’explication.

| Numéro | Titre                                                                       | Complexité | Modèle Codex |
| -----: | --------------------------------------------------------------------------- | :--------: | :----------: |
|    5.1 | Définir le protocole d’observation de l’usage portefeuille                  |      S     |  Sol Medium  |
|    5.2 | Observer l’utilisation réelle du portefeuille                               |      M     |  Sol Medium  |
|    5.3 | Décider de conserver, simplifier ou divulguer progressivement la complexité |      M     |  Sol Medium  |

---

## Feature 6 — Mesurer la qualité réelle et les limites opérationnelles

**Description :** compléter la couverture structurelle par une mesure de la capacité de détection des tests, des risques non fonctionnels et des performances observables du produit.

**Flux de valeur :** disposer d’une base factuelle permettant de distinguer une suite de tests volumineuse d’une suite réellement efficace, et mesurer le produit avant toute optimisation ou montée en charge.

| Numéro | Titre                                                           | Complexité | Modèle Codex |
| -----: | --------------------------------------------------------------- | :--------: | :----------: |
|    6.1 | Auditer les assertions, cas négatifs et valeurs limites         |      L     |   Sol High   |
|    6.2 | Renforcer le déterminisme et l’indépendance des tests           |      L     |   Sol High   |
|    6.3 | Introduire le mutation testing sur le cœur critique             |      L     |   Sol High   |
|    6.4 | Définir les seuils et la matrice des contrôles non fonctionnels |      M     |   Sol High   |
|    6.5 | Renforcer les tests de sécurité, résilience et reprise          |      L     |   Sol High   |
|    6.6 | Renforcer les tests d’accessibilité et de compatibilité         |      L     |   Sol High   |
|    6.7 | Renforcer les tests d’observabilité et de qualité des données   |      L     |   Sol High   |
|    6.8 | Établir une baseline de performance reproductible               |      L     |   Sol High   |

---

## Feature 7 — Établir une architecture applicative évolutive

**Description :** formaliser les frontières internes, supprimer les cycles et isoler les cas d’usage des technologies d’accès aux données, de calcul et de persistance.

**Flux de valeur :** permettre l’évolution du produit sans accroître le couplage, les responsabilités concentrées, les régressions ou le coût de chaque modification.

| Numéro | Titre                                                  | Complexité | Modèle Codex |
| -----: | ------------------------------------------------------ | :--------: | :----------: |
|    7.1 | Définir le modèle cible des dépendances internes       |      M     |   Sol High   |
|    7.2 | Automatiser le contrôle des directions de dépendance   |      M     |   Sol High   |
|    7.3 | Supprimer les cycles de dépendances existants          |      L     |   Sol High   |
|    7.4 | Définir le port d’accès aux données de delivery        |      M     |   Sol High   |
|    7.5 | Définir le port du moteur de prévision                 |      M     |   Sol High   |
|    7.6 | Introduire le cas d’usage de lancement d’une prévision |      L     |   Sol High   |
|    7.7 | Définir le port de persistance des simulations         |      M     |   Sol High   |
|    7.8 | Découpler FastAPI de la persistance MongoDB            |      L     |   Sol High   |

---

## Feature 8 — Fiabiliser les données Azure DevOps et matérialiser les sprints

**Description :** restructurer le client Azure DevOps, qualifier explicitement les limites des données et intégrer le contexte réel des itérations Cloud et Server/TFS.

**Flux de valeur :** fournir aux prévisions un historique fiable, temporellement cohérent et replacé dans son contexte de sprint avant que le décideur n’interprète les résultats.

| Numéro | Titre                                                              | Complexité | Modèle Codex |
| -----: | ------------------------------------------------------------------ | :--------: | :----------: |
|    8.1 | Définir les contrats d’accès aux données Azure DevOps              |      M     |   Sol High   |
|    8.2 | Isoler l’authentification et la connexion Azure DevOps             |      M     |   Sol High   |
|    8.3 | Isoler la découverte des organisations, projets et équipes         |      L     |   Sol High   |
|    8.4 | Isoler les requêtes WIQL et la récupération des révisions          |      L     |   Sol High   |
|    8.5 | Isoler les transformations de throughput et de Cycle Time          |      L     |   Sol High   |
|    8.6 | Séparer les adaptateurs Azure DevOps Cloud et Server               |      L     |   Sol High   |
|    8.7 | Modéliser la qualité et la complétude des données collectées       |      M     |   Sol High   |
|    8.8 | Détecter les périodes partielles et les historiques manquants      |      L     |   Sol High   |
|    8.9 | Restituer la qualité des données dans l’interface et les rapports  |      M     |   Sol High   |
|   8.10 | Assurer la cohérence des fenêtres et unités temporelles            |      L     |   Sol High   |
|   8.11 | Collecter les itérations Azure DevOps Cloud                        |      L     |   Sol High   |
|   8.12 | Collecter les itérations Azure DevOps Server/TFS                   |      L     |   Sol High   |
|   8.13 | Matérialiser les limites de sprint dans les graphiques et rapports |      L     |   Sol High   |

---

## Feature 9 — Éprouver les prévisions face au temps et aux résultats réels

**Description :** comparer les projections aux résultats observés et détecter les changements de comportement qui rendent un historique moins représentatif.

**Flux de valeur :** distinguer une prévision techniquement calculable d’une méthode empiriquement crédible pour soutenir une décision.

| Numéro | Titre                                                            | Complexité | Modèle Codex |
| -----: | ---------------------------------------------------------------- | :--------: | :----------: |
|    9.1 | Définir le protocole de calibration et de backtesting            |      M     |   Sol High   |
|    9.2 | Construire les couples prévision–résultat observé                |      L     |   Sol High   |
|    9.3 | Mesurer la couverture empirique des percentiles                  |      L     |   Sol High   |
|    9.4 | Comparer la crédibilité des différentes fenêtres historiques     |      L     |   Sol High   |
|    9.5 | Détecter les tendances et ruptures de régime                     |      L     |   Sol High   |
|    9.6 | Détecter la saisonnalité et l’obsolescence de l’historique       |      L     |   Sol High   |
|    9.7 | Restituer les diagnostics de calibration et de non-stationnarité |      L     |   Sol High   |

---

## Feature 10 — Fiabiliser l’expérience de simulation et les restitutions

**Description :** séparer les responsabilités frontend et PDF, fiabiliser l’état des simulations et garantir une présentation cohérente sur tous les supports.

**Flux de valeur :** empêcher l’affichage ou l’export de résultats devenus incohérents et permettre au décideur de retrouver la même information dans l’interface et dans les rapports.

| Numéro | Titre                                                        | Complexité | Modèle Codex |
| -----: | ------------------------------------------------------------ | :--------: | :----------: |
|   10.1 | Cartographier et séparer les responsabilités d’état frontend |      M     |   Sol High   |
|   10.2 | Extraire l’acquisition et l’orchestration des simulations    |      L     |   Sol High   |
|   10.3 | Isoler le cache, l’historique local et les migrations        |      L     |   Sol High   |
|   10.4 | Sécuriser invalidation, rechargement et rejeu par seed       |      M     |   Sol High   |
|   10.5 | Définir le modèle de données commun des rapports             |      M     |   Sol High   |
|   10.6 | Séparer diagnostics, graphiques et mise en page              |      L     |   Sol High   |
|   10.7 | Séparer pagination, rendu PDF et téléchargement              |      L     |   Sol High   |
|   10.8 | Sécuriser les artefacts et les échecs partiels de génération |      M     |   Sol High   |
|   10.9 | Harmoniser les formulations et conventions visuelles UI/PDF  |      M     |   Sol High   |

---

## Feature 11 — Faire passer la solution à l’échelle

**Description :** définir les objectifs de charge, instrumenter le produit et faire évoluer son exécution pour supporter davantage de concurrence, de volume et de traitements longs.

**Flux de valeur :** soutenir une utilisation croissante avec des SLO, une consommation de ressources, une dégradation et des coûts explicitement maîtrisés.

| Numéro | Titre                                                                | Complexité | Modèle Codex |
| -----: | -------------------------------------------------------------------- | :--------: | :----------: |
|   11.1 | Définir les volumes cibles, la concurrence et les SLO                |      M     |   Sol High   |
|   11.2 | Construire le dispositif de tests de charge                          |      L     |   Sol High   |
|   11.3 | Caractériser la montée en charge des workers et de la mémoire        |      L     |   Sol High   |
|   11.4 | Valider Redis et MongoDB en fonctionnement multi-worker              |      M     |   Sol High   |
|   11.5 | Concevoir le traitement asynchrone et l’annulation des calculs longs |      L     |   Sol High   |
|   11.6 | Mettre en place une exécution distribuable et stateless              |      L     |   Sol High   |
|   11.7 | Ajouter l’observabilité et le suivi des coûts de scalabilité         |      L     |   Sol High   |
|   11.8 | Valider charge nominale, pointe, endurance et reprise                |      L     |   Sol High   |

---

## Feature 12 — Étendre le produit au pilotage de programme

**Description :** enrichir le modèle portefeuille avec des relations opérationnelles explicites et consolider plusieurs projets dans une vue adaptée aux arbitrages de direction.

**Flux de valeur :** transformer une comparaison statistique multiéquipes en capacité de pilotage de programme, sans confondre hypothèses, dépendances réelles, risques et décisions humaines.

| Numéro | Titre                                                         | Complexité | Modèle Codex |
| -----: | ------------------------------------------------------------- | :--------: | :----------: |
|   12.1 | Définir le modèle des relations opérationnelles entre équipes |      M     |   Sol High   |
|   12.2 | Modéliser les dépendances, séquencements et contraintes       |      L     |   Sol High   |
|   12.3 | Modéliser la substituabilité et les capacités partagées       |      L     |   Sol High   |
|   12.4 | Simuler les effets de cascade entre équipes et projets        |      L     |   Sol High   |
|   12.5 | Construire le modèle de consolidation programme               |      L     |   Sol High   |
|   12.6 | Construire la vue de direction de programme                   |      L     |   Sol High   |
|   12.7 | Produire les exports structurés de reporting programme        |      L     |   Sol High   |

---

# Synthèse du backlog

|                                       Feature | Nombre de PBI |
| --------------------------------------------: | ------------: |
|                  1 — Preuve qualité gouvernée |            10 |
|             2 — Fiabilité du cœur statistique |             8 |
|                 3 — Réutilisabilité du moteur |             5 |
|            4 — Mise en production personnelle |             6 |
|            5 — Valeur d’usage du portefeuille |             3 |
| 6 — Qualité réelle et limites opérationnelles |             8 |
|        7 — Architecture applicative évolutive |             8 |
|           8 — Données Azure DevOps et sprints |            13 |
|       9 — Calibration et évolution temporelle |             7 |
|               10 — Expérience et restitutions |             9 |
|                              11 — Scalabilité |             8 |
|                    12 — Pilotage de programme |             7 |
|                                     **Total** |    **92 PBI** |

Aucun PBI n’est classé XL. Les PBI de réalisation technique, même de complexité M, utilisent généralement **Sol High** lorsque le risque porte sur les statistiques, l’architecture, la sécurité, la CI/CD ou les contrats.
