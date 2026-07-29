# Registre du backlog

Ce document constitue le registre de pilotage des Features et PBI. Les règles transverses sont définies dans [`backlog-governance.md`](backlog-governance.md) et les attendus détaillés dans [`backlog-expectations/`](backlog-expectations/README.md).

## Feature 1 — Disposer d’un système de preuve qualité gouverné

**Description :** mettre en place un dispositif capable de classifier, sélectionner, exécuter, dénombrer et piloter automatiquement les tests selon leur nature réelle, leurs finalités, leurs risques et leurs profils d’exécution.

**Flux de valeur :** rendre mesurable et vérifiable la confiance apportée par la stratégie de test, plutôt que de s’appuyer uniquement sur le volume de tests ou la couverture du code.

**Attendus détaillés :** [`backlog-expectations/feature-01-quality-governance.md`](backlog-expectations/feature-01-quality-governance.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 1.1 | Versionner le standard de test et aligner la documentation normative | M | Sol Medium | 18/07/2026 |
| 1.2 | Auditer et résorber la dette documentaire Markdown | L | Sol Élevé | 18/07/2026 |
| 1.3 | Cartographier les risques et les parcours critiques | L | Sol Medium | 18/07/2026 |
| 1.4 | Définir le modèle de classification des tests | M | Sol Élevé | 18/07/2026 |
| 1.5 | Classifier automatiquement le patrimoine de tests existant | L | Sol Très élevé | 18/07/2026 |
| 1.6 | Distinguer les cas logiques des instances exécutées | L | Sol Très élevé | 18/07/2026 |
| 1.7 | Bloquer les classifications absentes ou invalides | M | Sol Très élevé | 18/07/2026 |
| 1.8 | Recomposer les profils d’exécution CI/CD | L | Sol Très élevé | 18/07/2026 |
| 1.9 | Gouverner les tests ignorés, intermittents et en quarantaine | M | Sol Très élevé | 22/07/2026 |
| 1.10 | Publier un reporting consolidé de la stratégie de test | L | Sol Élevé | 22/07/2026 |
| 1.11 | Rétablir la modification obligatoire du README comme gate de commit | M | Sol Très élevé | 22/07/2026 |

## Feature 2 — Garantir la fiabilité du cœur statistique

**Description :** formaliser les règles statistiques communes, supprimer les divergences involontaires entre Python et TypeScript et protéger les invariants du moteur par des contrats, un rejeu déterministe et des références partagées.

**Flux de valeur :** assurer que les projections, diagnostics et décisions reposent sur des calculs cohérents, reproductibles et explicables, quel que soit le chemin d’exécution utilisé.

**Attendus détaillés :** [`backlog-expectations/feature-02-statistical-core.md`](backlog-expectations/feature-02-statistical-core.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 2.1 | Auditer les divergences statistiques Python et TypeScript | M | Sol Très élevé | 22/07/2026 |
| 2.2 | Définir le contrat normatif de parité statistique | M | Sol Très élevé | 22/07/2026 |
| 2.3 | Séparer les DTO des modèles statistiques métier | L | Sol Très élevé | 22/07/2026 |
| 2.4 | Introduire les Value Objects statistiques prioritaires | L | Sol Très élevé | 26/07/2026 |
| 2.5 | Isoler la résolution de seed aux frontières d’exécution | M | Sol Élevé | 26/07/2026 |
| 2.6 | Introduire un port de tirage déterministe dans les deux moteurs | M | Sol Très élevé | 26/07/2026 |
| 2.7 | Implémenter le PRNG contractuel commun Python et TypeScript | L | Sol Ultra | 26/07/2026 |
| 2.8 | Garantir l’ordre logique des tirages et l’indépendance du batching | M | Sol Très élevé | 28/07/2026 |
| 2.9 | Versionner le schéma du corpus de référence statistique | M | Sol Élevé | 28/07/2026 |
| 2.10 | Construire les cas de référence des entrées, modes, censures et percentiles | M | Sol Très élevé | 28/07/2026 |
| 2.11 | Construire les cas de référence du Risk Score, de la fiabilité et des histogrammes | M | Sol Très élevé | 28/07/2026 |
| 2.12 | Exécuter le corpus partagé dans les deux moteurs | L | Sol Très élevé | 28/07/2026 |
| 2.13 | Aligner la validation normalisée et la forme des résultats | M | Sol Très élevé | 28/07/2026 |
| 2.14 | Aligner les censures, percentiles et Risk Score | M | Sol Très élevé | 28/07/2026 |
| 2.15 | Aligner les métriques et labels de fiabilité du throughput | M | Sol Très élevé | |
| 2.16 | Aligner la construction des histogrammes | M | Sol Très élevé | |
| 2.17 | Établir le rejeu exact interlangage sur le corpus versionné | L | Sol Ultra | |
| 2.18 | Produire le rapport de parité déterministe et distributionnelle | M | Sol Très élevé | |
| 2.19 | Intégrer les contrôles de parité au profil `main` | M | Sol Très élevé | |
| 2.20 | Bloquer les dérives de version et de compatibilité statistique | M | Sol Très élevé | |

## Feature 3 — Distribuer un moteur statistique Python réutilisable

**Description :** produire un package Python installable, versionné et utilisable par un consommateur externe au travers d’une API publique stable, sans dépendance à Azure DevOps, FastAPI, MongoDB, Redis ou au frontend.

**Flux de valeur :** permettre à un intégrateur d’exécuter une prévision conforme au contrat statistique sans dépendre de l’application Monte Carlo Azure ni de ses infrastructures.

**Attendus détaillés :** [`backlog-expectations/feature-03-reusable-engine.md`](backlog-expectations/feature-03-reusable-engine.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 3.1 | Définir les cas d’intégration et le niveau de support du package | M | Sol Medium | |
| 3.2 | Définir la frontière, le nom et les dépendances du package | M | Sol Élevé | |
| 3.3 | Définir l’API publique, les erreurs et la politique de compatibilité | M | Sol Très élevé | |
| 3.4 | Créer le squelette installable et les métadonnées du package | M | Sol Élevé | |
| 3.5 | Extraire les contrats métier et Value Objects dans le package | L | Sol Très élevé | |
| 3.6 | Extraire le moteur statistique interne dans le package | L | Sol Très élevé | |
| 3.7 | Exposer le cas d’usage public et migrer le backend vers le package | L | Sol Très élevé | |
| 3.8 | Bloquer les dépendances interdites et les contournements de l’API publique | M | Sol Très élevé | |
| 3.9 | Construire les distributions `wheel` et `sdist` reproductibles | M | Sol Élevé | |
| 3.10 | Prouver l’installation isolée et l’usage par un consommateur externe | M | Sol Très élevé | |
| 3.11 | Produire les artefacts versionnés du package dans la CI | M | Sol Très élevé | |
| 3.12 | Écrire un guide exécutable d’intégration du package | M | Sol Medium | |

## Feature 4 — Sécuriser la mise en production personnelle

**Description :** corriger les risques immédiats de persistance, de conteneurisation et d’identification des clients avant toute exposition réelle de l’application.

**Flux de valeur :** permettre un déploiement personnel exploitable sans croissance silencieuse du stockage, privilèges excessifs dans le conteneur ou contournement du rate limiting.

**Attendus détaillés :** [`backlog-expectations/feature-04-personal-production.md`](backlog-expectations/feature-04-personal-production.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 4.1 | Corriger la politique de rétention des simulations MongoDB | M | Sol Élevé | |
| 4.2 | Prouver la purge des simulations anciennes pour un client actif | M | Sol Élevé | |
| 4.3 | Séparer les dépendances Python runtime et développement | M | Sol Élevé | |
| 4.4 | Exécuter le conteneur applicatif avec un utilisateur non-root | M | Sol Élevé | |
| 4.5 | Définir le modèle de confiance des adresses clientes | S | Sol Très élevé | |
| 4.6 | Appliquer et tester la politique de proxy de confiance | L | Sol Très élevé | |

## Feature 5 — Valider la valeur d’usage du mode portefeuille

**Description :** observer l’utilisation réelle du portefeuille avant d’ajouter de nouveaux scénarios, diagnostics ou niveaux de complexité à l’interface.

**Flux de valeur :** vérifier que les quatre hypothèses et les trois dimensions de diagnostic facilitent réellement la décision en comité plutôt que d’augmenter la charge cognitive et le besoin d’explication.

**Attendus détaillés :** [`backlog-expectations/feature-05-portfolio-value.md`](backlog-expectations/feature-05-portfolio-value.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 5.1 | Définir le protocole d’observation de l’usage portefeuille | S | Sol Medium | |
| 5.2 | Instrumenter l’usage du portefeuille dans le respect de la vie privée | M | Sol Très élevé | |
| 5.3 | Observer l’utilisation réelle du portefeuille | M | Sol Medium | |
| 5.4 | Décider de conserver, simplifier ou divulguer progressivement la complexité | M | Sol Medium | |

## Feature 6 — Mesurer la qualité réelle et les limites opérationnelles

**Description :** compléter la couverture structurelle par une mesure de la capacité de détection des tests, des risques non fonctionnels et des performances observables du produit.

**Flux de valeur :** disposer d’une base factuelle permettant de distinguer une suite de tests volumineuse d’une suite réellement efficace, et mesurer le produit avant toute optimisation ou montée en charge.

**Attendus détaillés :** [`backlog-expectations/feature-06-operational-quality.md`](backlog-expectations/feature-06-operational-quality.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 6.1 | Auditer les assertions, cas négatifs et valeurs limites | L | Sol Très élevé | |
| 6.2 | Renforcer le déterminisme et l’indépendance des tests | L | Sol Très élevé | |
| 6.3 | Introduire le mutation testing sur le cœur critique | L | Sol Très élevé | |
| 6.4 | Définir les seuils et la matrice des contrôles non fonctionnels | M | Sol Élevé | |
| 6.5 | Renforcer les tests de sécurité, résilience et reprise | L | Sol Très élevé | |
| 6.6 | Renforcer les tests d’accessibilité et de compatibilité | L | Sol Élevé | |
| 6.7 | Renforcer les tests d’observabilité et de qualité des données | L | Sol Élevé | |
| 6.8 | Établir une baseline de performance reproductible | L | Sol Très élevé | |

## Feature 7 — Établir une architecture applicative évolutive

**Description :** formaliser une architecture hexagonale modulaire, supprimer les cycles et isoler les cas d’usage des technologies d’accès aux données, de calcul, de persistance et de restitution.

**Flux de valeur :** permettre l’évolution du produit sans accroître le couplage, les responsabilités concentrées, les régressions ou le coût de chaque modification, grâce à des modules cohésifs communiquant par des contrats explicites.

**Attendus détaillés :** [`backlog-expectations/feature-07-evolvable-architecture.md`](backlog-expectations/feature-07-evolvable-architecture.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 7.1 | Définir le modèle cible des dépendances internes | M | Sol Très élevé | |
| 7.2 | Automatiser le contrôle des directions de dépendance | M | Sol Très élevé | |
| 7.3 | Supprimer les cycles de dépendances existants | L | Sol Ultra | |
| 7.4 | Définir le port d’accès aux données de delivery | M | Sol Élevé | |
| 7.5 | Définir le port du moteur de prévision | M | Sol Élevé | |
| 7.6 | Introduire le cas d’usage de lancement d’une prévision | L | Sol Très élevé | |
| 7.7 | Définir le port de persistance des simulations | M | Sol Élevé | |
| 7.8 | Découpler FastAPI de la persistance MongoDB | L | Sol Très élevé | |
| 7.9 | Rendre la frontière d’identité structurelle et contractuelle | L | Sol Très élevé | |
| 7.10 | Définir les contrats de communication inter-modules | M | Sol Très élevé | |
| 7.11 | Introduire le composition root et l’injection explicite des adaptateurs | M | Sol Très élevé | |
| 7.12 | Prouver les contrats des ports et adaptateurs | L | Sol Très élevé | |
| 7.13 | Injecter l’horloge et les générateurs d’identifiants techniques | M | Sol Élevé | |

## Feature 8 — Fiabiliser les données Azure DevOps et matérialiser les sprints

**Description :** restructurer le client Azure DevOps, qualifier explicitement les limites des données et intégrer le contexte réel des itérations Cloud et Server/TFS.

**Flux de valeur :** fournir aux prévisions un historique fiable, temporellement cohérent et replacé dans son contexte de sprint avant que le décideur n’interprète les résultats.

**Attendus détaillés :** [`backlog-expectations/feature-08-azure-devops-data.md`](backlog-expectations/feature-08-azure-devops-data.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 8.1 | Définir les contrats d’accès aux données Azure DevOps | M | Sol Très élevé | |
| 8.2 | Isoler l’authentification et la connexion Azure DevOps | M | Sol Très élevé | |
| 8.3 | Isoler la découverte des organisations, projets et équipes | L | Sol Élevé | |
| 8.4 | Isoler les requêtes WIQL et la récupération des révisions | L | Sol Très élevé | |
| 8.5 | Isoler les transformations de throughput et de Cycle Time | L | Sol Très élevé | |
| 8.6 | Séparer les adaptateurs Azure DevOps Cloud et Server | L | Sol Très élevé | |
| 8.7 | Modéliser la qualité et la complétude des données collectées | M | Sol Très élevé | |
| 8.8 | Détecter les périodes partielles et les historiques manquants | L | Sol Élevé | |
| 8.9 | Restituer la qualité des données dans l’interface et les rapports | M | Sol Élevé | |
| 8.10 | Assurer la cohérence des fenêtres et unités temporelles | L | Sol Très élevé | |
| 8.11 | Collecter les itérations Azure DevOps Cloud | L | Sol Élevé | |
| 8.12 | Collecter les itérations Azure DevOps Server/TFS | L | Sol Très élevé | |
| 8.13 | Matérialiser les limites de sprint dans les graphiques et rapports | L | Sol Élevé | |
| 8.14 | Qualifier les prérequis de stabilité du flux avant prévision | L | Sol Très élevé | |

## Feature 9 — Rejouer les prévisions dans le temps et les calibrer

**Description :** reconstruire les états historiques d’une livraison passée, rejouer les prévisions à
plusieurs dates d’observation sans fuite d’information future et confronter leur trajectoire de crédibilité
au résultat réel.

**Flux de valeur :** distinguer une simulation ponctuelle techniquement calculable d’une méthode
empiriquement calibrée pour soutenir une décision.

**Attendus détaillés :** [`backlog-expectations/feature-09-forecast-calibration.md`](backlog-expectations/feature-09-forecast-calibration.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 9.1 | Définir le protocole de backtesting sans fuite d’information future | M | Sol Très élevé | |
| 9.2 | Reconstruire les états historiques et les points de rejeu | L | Sol Très élevé | |
| 9.3 | Rejouer les prévisions et construire la trajectoire de crédibilité | L | Sol Très élevé | |
| 9.4 | Confronter les prévisions aux résultats observés | L | Sol Très élevé | |
| 9.5 | Diagnostiquer stabilité, volatilité, dérive et rupture | L | Sol Très élevé | |
| 9.6 | Mesurer délai de détection, faux signaux et robustesse | L | Sol Très élevé | |
| 9.7 | Calibrer les percentiles et comparer les fenêtres historiques | L | Sol Très élevé | |
| 9.8 | Formaliser la synthèse métier et décider empiriquement du Risk Score | L | Sol Très élevé | |

## Feature 10 — Concevoir l’expérience de simulation et ses restitutions

**Description :** porter la configuration, la progression visible, l’historique, la comparaison et les
restitutions UI, PDF et export, tout en fiabilisant le cache local et l’état de l’expérience.

**Flux de valeur :** empêcher l’affichage ou l’export de résultats devenus incohérents et permettre au décideur de retrouver la même information dans l’interface et dans les rapports.

**Attendus détaillés :** [`backlog-expectations/feature-10-simulation-experience.md`](backlog-expectations/feature-10-simulation-experience.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 10.1 | Structurer la configuration et l’état de l’expérience | M | Sol Très élevé | |
| 10.2 | Orchestrer le lancement et la progression visible | L | Sol Très élevé | |
| 10.3 | Isoler le cache, l’historique local et les migrations | L | Sol Très élevé | |
| 10.4 | Sécuriser invalidation, rechargement, comparaison et rejeu par seed | M | Sol Très élevé | |
| 10.5 | Définir le modèle commun des restitutions UI, PDF et export | M | Sol Élevé | |
| 10.6 | Séparer diagnostics, graphiques et mise en page des restitutions | L | Sol Élevé | |
| 10.7 | Séparer pagination, rendu PDF, export et téléchargement | L | Sol Élevé | |
| 10.8 | Sécuriser les artefacts et les échecs partiels de restitution | M | Sol Très élevé | |
| 10.9 | Harmoniser les formulations et conventions visuelles UI/PDF | M | Sol Medium | |
| 10.10 | Auditer et découper les composants frontend à responsabilités multiples | L | Sol Très élevé | |

## Feature 11 — Exécuter les traitements coûteux à l’échelle

**Description :** mesurer la charge des audits et autres traitements longs, décider empiriquement du
passage interactif ou asynchrone et maîtriser jobs, workers, progression, reprise et ressources.

**Flux de valeur :** soutenir une utilisation croissante avec des SLO, une consommation de ressources, une dégradation et des coûts explicitement maîtrisés.

**Attendus détaillés :** [`backlog-expectations/feature-11-scalability.md`](backlog-expectations/feature-11-scalability.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 11.1 | Modéliser la charge conceptuelle et les enveloppes à mesurer | M | Sol Élevé | |
| 11.2 | Benchmarker les exécutions interactives et asynchrones | L | Sol Très élevé | |
| 11.3 | Décider le seuil interactif ou asynchrone à partir des mesures | L | Sol Très élevé | |
| 11.4 | Persister de façon minimisée les jobs et résultats agrégés | M | Sol Très élevé | |
| 11.5 | Gérer jobs, progression, annulation et reprise | L | Sol Très élevé | |
| 11.6 | Mettre en place des workers distribuables et maîtrisés | L | Sol Ultra | |
| 11.7 | Observer les traitements, ressources et coûts | L | Sol Très élevé | |
| 11.8 | Valider charge nominale, pointe, endurance et reprise | L | Sol Très élevé | |

## Feature 12 — Étendre le produit au pilotage de programme

**Description :** enrichir le modèle portefeuille avec des relations opérationnelles explicites et consolider plusieurs projets dans une vue adaptée aux arbitrages de direction.

**Flux de valeur :** transformer une comparaison statistique multiéquipes en capacité de pilotage de programme, sans confondre hypothèses, dépendances réelles, risques et décisions humaines.

**Attendus détaillés :** [`backlog-expectations/feature-12-program-management.md`](backlog-expectations/feature-12-program-management.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 12.1 | Définir le modèle des relations opérationnelles entre équipes | M | Sol Très élevé | |
| 12.2 | Modéliser les dépendances, séquencements et contraintes | L | Sol Très élevé | |
| 12.3 | Modéliser la substituabilité et les capacités partagées | L | Sol Très élevé | |
| 12.4 | Simuler les effets de cascade entre équipes et projets | L | Sol Très élevé | |
| 12.5 | Construire le modèle de consolidation programme | L | Sol Très élevé | |
| 12.6 | Construire la vue de direction de programme | L | Sol Élevé | |
| 12.7 | Produire les exports structurés de reporting programme | L | Sol Élevé | |

## Feature 13 — Rationaliser le dispositif de gouvernance technique

**Description :** mesurer la valeur, le coût et les recouvrements des contrôles du dépôt, puis simplifier le dispositif sans affaiblir les protections critiques.

**Flux de valeur :** conserver une forte confiance dans le produit tout en réduisant le temps de changement, la charge de maintenance et la complexité de reprise par un autre contributeur.

**Attendus détaillés :** [`backlog-expectations/feature-13-technical-governance.md`](backlog-expectations/feature-13-technical-governance.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 13.1 | Inventorier les contrôles, scripts, preuves et dépendances de gouvernance | M | Sol Élevé | |
| 13.2 | Mesurer le coût d’exécution et de maintenance de chaque contrôle | M | Sol Élevé | |
| 13.3 | Relier chaque contrôle à un risque produit ou opérationnel explicite | M | Sol Medium | |
| 13.4 | Détecter les contrôles redondants, indirects ou sans valeur démontrée | L | Sol Très élevé | |
| 13.5 | Simplifier et fusionner les contrôles sans réduire la couverture des risques | L | Sol Ultra | |
| 13.6 | Réduire le temps de feedback local, PR et `main` | L | Sol Très élevé | |
| 13.7 | Documenter la maintenance et le diagnostic du système de qualité | M | Sol Medium | |
| 13.8 | Mesurer l’évolution du coût de changement après rationalisation | M | Sol Medium | |
| 13.9 | Tester la reprise du produit par un nouveau contributeur | M | Sol Medium | |
| 13.10 | Sécuriser l’approvisionnement des images de services CI | M | Sol Élevé | |

## Feature 14 — Clarifier la stratégie de diffusion et réduire la friction d’adoption

**Description :** expliciter l’ambition du produit, son modèle de pérennité, son marché cible, ses modes de distribution et le parcours permettant à une organisation Azure DevOps de l’adopter réellement.

**Flux de valeur :** transformer un dépôt techniquement crédible en proposition lisible, testable et adoptable par ses utilisateurs et intégrateurs cibles.

**Attendus détaillés :** [`backlog-expectations/feature-14-distribution-strategy.md`](backlog-expectations/feature-14-distribution-strategy.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 14.1 | Décider de l’ambition, du modèle de diffusion et de la pérennité du produit | S | Sol Medium | |
| 14.2 | Définir les segments utilisateurs et organisations prioritaires | M | Sol Medium | |
| 14.3 | Formaliser les différenciateurs futurs et les preuves de valeur | M | Sol Medium | |
| 14.4 | Recentrer le README et la démo sur la proposition de valeur actuelle et future | M | Sol Élevé | |
| 14.5 | Cartographier les freins du parcours d’adoption réel | M | Sol Medium | |
| 14.6 | Étudier et décider le modèle d’authentification Azure DevOps | M | Sol Très élevé | |
| 14.7 | Évaluer et décider une distribution Azure DevOps Marketplace | M | Sol Élevé | |
| 14.8 | Décider du périmètre linguistique et de l’internationalisation | S | Sol Medium | |
| 14.9 | Mesurer l’activation et la réussite du premier usage | M | Sol Très élevé | |

# Synthèse du backlog

**Feature en cours :** Feature 2 — Garantir la fiabilité du cœur statistique — 14/20 PBI réalisés (70 %).
**Prochain PBI :** `2.15` — Aligner les métriques et labels de fiabilité du throughput — non commencé.
**Reliquats de la Feature 2 :** `2.15`, `2.16`, `2.17`, `2.18`, `2.19`, `2.20`.
**Progression globale :** 25/140 PBI réalisés (17,86 %) ; 115 restants.

| Feature | Nombre de PBI | Réalisés | Restants |
| ---: | ---: | :---: | :---: |
| 1 — Disposer d’un système de preuve qualité gouverné | 11 | 11 | 0 |
| 2 — Garantir la fiabilité du cœur statistique | 20 | 14 | 6 |
| 3 — Distribuer un moteur statistique Python réutilisable | 12 | 0 | 12 |
| 4 — Sécuriser la mise en production personnelle | 6 | 0 | 6 |
| 5 — Valider la valeur d’usage du mode portefeuille | 4 | 0 | 4 |
| 6 — Mesurer la qualité réelle et les limites opérationnelles | 8 | 0 | 8 |
| 7 — Établir une architecture applicative évolutive | 13 | 0 | 13 |
| 8 — Fiabiliser les données Azure DevOps et matérialiser les sprints | 14 | 0 | 14 |
| 9 — Rejouer les prévisions dans le temps et les calibrer | 8 | 0 | 8 |
| 10 — Concevoir l’expérience de simulation et ses restitutions | 10 | 0 | 10 |
| 11 — Exécuter les traitements coûteux à l’échelle | 8 | 0 | 8 |
| 12 — Étendre le produit au pilotage de programme | 7 | 0 | 7 |
| 13 — Rationaliser le dispositif de gouvernance technique | 10 | 0 | 10 |
| 14 — Clarifier la stratégie de diffusion et réduire la friction d’adoption | 9 | 0 | 9 |
| **Total** | **140** | **25** | **115** |

Aucun PBI n’est classé XL.

Les sujets conditionnels non numérotés ne sont pas inclus dans le total.
