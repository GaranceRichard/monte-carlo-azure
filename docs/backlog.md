# Registre du backlog

Ce document constitue le registre de pilotage et de traçabilité des outcomes futurs. Une Feature ou un PBI
y exprime un résultat observable et démontrable, sans devenir une liste de tâches techniques. La colonne
`Réalisé le` est l’unique autorité de statut.

Les règles transverses sont définies dans [`backlog-governance.md`](backlog-governance.md) et les périmètres,
hors-périmètres et preuves attendues dans
[`backlog-expectations/`](backlog-expectations/README.md).

## Feature 1 — Disposer d’un système de preuve qualité gouverné

**Résultat observable :** les tests sont classifiés, sélectionnés, exécutés, dénombrés et pilotés
automatiquement selon leur nature réelle, leurs finalités, leurs risques et leurs profils d’exécution.

**Flux de valeur :** rendre mesurable et vérifiable la confiance apportée par la stratégie de test, plutôt que de s’appuyer uniquement sur le volume de tests ou la couverture du code.

**Attendus détaillés :** [`backlog-expectations/feature-01-quality-governance.md`](backlog-expectations/feature-01-quality-governance.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 1.1 | Standard de test versionné et documentation normative alignée | M | Sol Medium | 18/07/2026 |
| 1.2 | Dette documentaire Markdown identifiée et résorbée | L | Sol Élevé | 18/07/2026 |
| 1.3 | Risques et parcours critiques cartographiés | L | Sol Medium | 18/07/2026 |
| 1.4 | Modèle de classification des tests défini | M | Sol Élevé | 18/07/2026 |
| 1.5 | Patrimoine de tests existant classifié automatiquement | L | Sol Très élevé | 18/07/2026 |
| 1.6 | Cas logiques distingués des instances exécutées | L | Sol Très élevé | 18/07/2026 |
| 1.7 | Classifications absentes ou invalides bloquées | M | Sol Très élevé | 18/07/2026 |
| 1.8 | Profils d’exécution CI/CD recomposés | L | Sol Très élevé | 18/07/2026 |
| 1.9 | Tests ignorés, intermittents et en quarantaine gouvernés | M | Sol Très élevé | 22/07/2026 |
| 1.10 | Reporting consolidé de la stratégie de test publié | L | Sol Élevé | 22/07/2026 |
| 1.11 | Modification du README obligatoire et contrôlée à chaque commit | M | Sol Très élevé | 22/07/2026 |

## Feature 2 — Garantir la fiabilité du cœur statistique

**Résultat observable :** les règles statistiques communes sont formalisées, les divergences involontaires
entre Python et TypeScript sont supprimées et les invariants sont protégés par des contrats, un rejeu
déterministe et des références partagées.

**Flux de valeur :** assurer que les projections, diagnostics et décisions reposent sur des calculs cohérents, reproductibles et explicables, quel que soit le chemin d’exécution utilisé.

**Attendus détaillés :** [`backlog-expectations/feature-02-statistical-core.md`](backlog-expectations/feature-02-statistical-core.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 2.1 | Divergences statistiques Python et TypeScript inventoriées et qualifiées | M | Sol Très élevé | 22/07/2026 |
| 2.2 | Contrat normatif de parité statistique établi | M | Sol Très élevé | 22/07/2026 |
| 2.3 | DTO séparés des modèles statistiques métier | L | Sol Très élevé | 22/07/2026 |
| 2.4 | Value Objects statistiques prioritaires disponibles | L | Sol Très élevé | 26/07/2026 |
| 2.5 | Seed résolue exclusivement aux frontières d’exécution | M | Sol Élevé | 26/07/2026 |
| 2.6 | Port de tirage déterministe disponible dans les deux moteurs | M | Sol Très élevé | 26/07/2026 |
| 2.7 | PRNG contractuel commun opérationnel en Python et TypeScript | L | Sol Ultra | 26/07/2026 |
| 2.8 | Ordre logique des tirages stable et indépendant du batching | M | Sol Très élevé | 28/07/2026 |
| 2.9 | Schéma du corpus de référence statistique versionné | M | Sol Élevé | 28/07/2026 |
| 2.10 | Cas de référence des entrées, modes, censures et percentiles disponibles | M | Sol Très élevé | 28/07/2026 |
| 2.11 | Cas de référence du Risk Score, de la fiabilité et des histogrammes disponibles | M | Sol Très élevé | 28/07/2026 |
| 2.12 | Corpus partagé exécuté dans les deux moteurs | L | Sol Très élevé | 28/07/2026 |
| 2.13 | Validation normalisée et forme des résultats alignées | M | Sol Très élevé | 28/07/2026 |
| 2.14 | Censures, percentiles et Risk Score alignés | M | Sol Très élevé | 28/07/2026 |
| 2.15 | Métriques et labels de fiabilité du throughput alignés | M | Sol Très élevé | 29/07/2026 |
| 2.16 | Construction des histogrammes alignée | M | Sol Très élevé | 29/07/2026 |
| 2.17 | Rejeu exact interlangage démontré sur le corpus versionné | L | Sol Ultra | |
| 2.18 | Rapport de parité déterministe et distributionnelle disponible | M | Sol Très élevé | |
| 2.19 | Contrôles de parité bloquants dans le profil `main` | M | Sol Très élevé | |
| 2.20 | Dérives de version et de compatibilité statistique bloquées | M | Sol Très élevé | |

## Feature 3 — Disposer d’un moteur statistique Python réutilisable et distribuable

**Résultat observable :** un package Python installable et versionné permet à un consommateur externe
d’utiliser une API publique stable sans dépendre d’Azure DevOps, FastAPI, MongoDB, Redis ou du frontend.

**Flux de valeur :** permettre à un intégrateur d’exécuter une prévision conforme au contrat statistique sans dépendre de l’application Monte Carlo Azure ni de ses infrastructures.

**Attendus détaillés :** [`backlog-expectations/feature-03-reusable-engine.md`](backlog-expectations/feature-03-reusable-engine.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 3.1 | Cas d’intégration et niveau de support du package définis | M | Sol Medium | |
| 3.2 | Frontière, nom et dépendances du package définis | M | Sol Élevé | |
| 3.3 | API publique, erreurs et politique de compatibilité définies | M | Sol Très élevé | |
| 3.4 | Package installable avec métadonnées valides | M | Sol Élevé | |
| 3.5 | Contrats métier et Value Objects centralisés dans le package | L | Sol Très élevé | |
| 3.6 | Moteur statistique interne centralisé dans le package | L | Sol Très élevé | |
| 3.7 | Cas d’usage public disponible et backend consommateur du package | L | Sol Très élevé | |
| 3.8 | Dépendances interdites et contournements de l’API publique bloqués | M | Sol Très élevé | |
| 3.9 | Distributions `wheel` et `sdist` reproductibles | M | Sol Élevé | |
| 3.10 | Installation isolée et usage par un consommateur externe démontrés | M | Sol Très élevé | |
| 3.11 | Artefacts versionnés du package produits dans la CI | M | Sol Très élevé | |
| 3.12 | Guide exécutable d’intégration du package disponible | M | Sol Medium | |

## Feature 4 — Disposer d’une mise en production personnelle sécurisée

**Résultat observable :** une instance personnelle peut être exposée sans les risques immédiats identifiés
sur la persistance, les privilèges du conteneur et l’identification des clients.

**Flux de valeur :** permettre un déploiement personnel exploitable sans croissance silencieuse du stockage, privilèges excessifs dans le conteneur ou contournement du rate limiting.

**Attendus détaillés :** [`backlog-expectations/feature-04-personal-production.md`](backlog-expectations/feature-04-personal-production.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 4.1 | Rétention des simulations MongoDB bornée pour tous les clients | M | Sol Élevé | |
| 4.2 | Purge des simulations anciennes d’un client actif démontrée | M | Sol Élevé | |
| 4.3 | Dépendances Python runtime séparées des dépendances de développement | M | Sol Élevé | |
| 4.4 | Conteneur applicatif exécuté sous un utilisateur non-root | M | Sol Élevé | |
| 4.5 | Modèle de confiance des adresses clientes défini | S | Sol Très élevé | |
| 4.6 | Politique de proxy de confiance appliquée et démontrée | L | Sol Très élevé | |

## Feature 5 — Démontrer la valeur d’usage du mode portefeuille

**Résultat observable :** l’usage réel démontre si les scénarios, diagnostics et niveaux de complexité du
portefeuille soutiennent la décision avant tout enrichissement de l’interface.

**Flux de valeur :** vérifier que les quatre hypothèses et les trois dimensions de diagnostic facilitent réellement la décision en comité plutôt que d’augmenter la charge cognitive et le besoin d’explication.

**Attendus détaillés :** [`backlog-expectations/feature-05-portfolio-value.md`](backlog-expectations/feature-05-portfolio-value.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 5.1 | Protocole d’observation de l’usage portefeuille défini | S | Sol Medium | |
| 5.2 | Usage du portefeuille mesurable dans le respect de la vie privée | M | Sol Très élevé | |
| 5.3 | Utilisation réelle du portefeuille documentée | M | Sol Medium | |
| 5.4 | Décision de maintien, simplification ou divulgation progressive étayée | M | Sol Medium | |

## Feature 6 — Rendre mesurables la qualité réelle et les limites opérationnelles

**Résultat observable :** la capacité de détection des tests, les risques non fonctionnels et les
performances observables complètent la mesure de couverture structurelle.

**Flux de valeur :** disposer d’une base factuelle permettant de distinguer une suite de tests volumineuse d’une suite réellement efficace, et mesurer le produit avant toute optimisation ou montée en charge.

**Attendus détaillés :** [`backlog-expectations/feature-06-operational-quality.md`](backlog-expectations/feature-06-operational-quality.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 6.1 | Assertions, cas négatifs et valeurs limites qualifiés et renforcés | L | Sol Très élevé | |
| 6.2 | Tests déterministes et indépendants | L | Sol Très élevé | |
| 6.3 | Mutation testing actif sur le cœur critique | L | Sol Très élevé | |
| 6.4 | Seuils et matrice des contrôles non fonctionnels définis | M | Sol Élevé | |
| 6.5 | Sécurité, résilience et reprise couvertes par des tests renforcés | L | Sol Très élevé | |
| 6.6 | Accessibilité et compatibilité couvertes par des tests renforcés | L | Sol Élevé | |
| 6.7 | Observabilité et qualité des données couvertes par des tests renforcés | L | Sol Élevé | |
| 6.8 | Baseline de performance reproductible établie | L | Sol Très élevé | |

## Feature 7 — Disposer d’une architecture applicative évolutive et vérifiable

**Résultat observable :** une architecture hexagonale modulaire sans cycles isole les cas d’usage des
technologies d’accès aux données, de calcul, de persistance et de restitution.

**Flux de valeur :** permettre l’évolution du produit sans accroître le couplage, les responsabilités concentrées, les régressions ou le coût de chaque modification, grâce à des modules cohésifs communiquant par des contrats explicites.

**Attendus détaillés :** [`backlog-expectations/feature-07-evolvable-architecture.md`](backlog-expectations/feature-07-evolvable-architecture.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 7.1 | Modèle cible des dépendances internes formalisé | M | Sol Très élevé | |
| 7.2 | Directions de dépendance contrôlées automatiquement | M | Sol Très élevé | |
| 7.3 | Cycles de dépendances existants supprimés | L | Sol Ultra | |
| 7.4 | Port d’accès aux données de delivery défini | M | Sol Élevé | |
| 7.5 | Port du moteur de prévision défini | M | Sol Élevé | |
| 7.6 | Cas d’usage de lancement d’une prévision isolé | L | Sol Très élevé | |
| 7.7 | Port de persistance des simulations défini | M | Sol Élevé | |
| 7.8 | FastAPI découplé de la persistance MongoDB | L | Sol Très élevé | |
| 7.9 | Frontière d’identité structurelle et contractuelle | L | Sol Très élevé | |
| 7.10 | Contrats de communication inter-modules définis | M | Sol Très élevé | |
| 7.11 | Composition root et injection explicite des adaptateurs opérationnels | M | Sol Très élevé | |
| 7.12 | Contrats des ports et adaptateurs démontrés | L | Sol Très élevé | |
| 7.13 | Horloge et générateurs d’identifiants techniques injectables | M | Sol Élevé | |

## Feature 8 — Disposer de données Azure DevOps fiables et contextualisées par sprint

**Résultat observable :** les données Azure DevOps ont des limites explicitement qualifiées et sont
replacées dans le contexte réel des itérations Cloud et Server/TFS au travers d’un client structuré.

**Flux de valeur :** fournir aux prévisions un historique fiable, temporellement cohérent et replacé dans son contexte de sprint avant que le décideur n’interprète les résultats.

**Attendus détaillés :** [`backlog-expectations/feature-08-azure-devops-data.md`](backlog-expectations/feature-08-azure-devops-data.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 8.1 | Contrats d’accès aux données Azure DevOps définis | M | Sol Très élevé | |
| 8.2 | Authentification et connexion Azure DevOps isolées | M | Sol Très élevé | |
| 8.3 | Découverte des organisations, projets et équipes isolée | L | Sol Élevé | |
| 8.4 | Requêtes WIQL et récupération des révisions isolées | L | Sol Très élevé | |
| 8.5 | Transformations de throughput et de Cycle Time isolées | L | Sol Très élevé | |
| 8.6 | Adaptateurs Azure DevOps Cloud et Server séparés | L | Sol Très élevé | |
| 8.7 | Qualité et complétude des données collectées modélisées | M | Sol Très élevé | |
| 8.8 | Périodes partielles et historiques manquants détectés | L | Sol Élevé | |
| 8.9 | Qualité des données visible dans l’interface et les rapports | M | Sol Élevé | |
| 8.10 | Fenêtres et unités temporelles cohérentes | L | Sol Très élevé | |
| 8.11 | Itérations Azure DevOps Cloud collectées | L | Sol Élevé | |
| 8.12 | Itérations Azure DevOps Server/TFS collectées | L | Sol Très élevé | |
| 8.13 | Limites de sprint visibles dans les graphiques et rapports | L | Sol Élevé | |
| 8.14 | Prérequis de stabilité du flux qualifiés avant prévision | L | Sol Très élevé | |

## Feature 9 — Disposer de prévisions rejouables dans le temps et calibrées

**Résultat observable :** les états historiques d’une livraison passée sont reconstruits et les prévisions
sont rejouées à plusieurs dates d’observation sans fuite d’information future, puis leur trajectoire de
crédibilité est confrontée au résultat réel.

**Flux de valeur :** distinguer une simulation ponctuelle techniquement calculable d’une méthode
empiriquement calibrée pour soutenir une décision.

**Attendus détaillés :** [`backlog-expectations/feature-09-forecast-calibration.md`](backlog-expectations/feature-09-forecast-calibration.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 9.1 | Protocole de backtesting sans fuite d’information future établi | M | Sol Très élevé | |
| 9.2 | États historiques et points de rejeu reconstructibles | L | Sol Très élevé | |
| 9.3 | Trajectoire de crédibilité produite par rejeu des prévisions | L | Sol Très élevé | |
| 9.4 | Prévisions confrontées aux résultats observés | L | Sol Très élevé | |
| 9.5 | Stabilité, volatilité, dérive et rupture diagnostiquées | L | Sol Très élevé | |
| 9.6 | Délai de détection, faux signaux et robustesse mesurés | L | Sol Très élevé | |
| 9.7 | Percentiles calibrés et fenêtres historiques comparées | L | Sol Très élevé | |
| 9.8 | Synthèse métier formalisée et rôle du Risk Score décidé empiriquement | L | Sol Très élevé | |

## Feature 10 — Disposer d’une expérience de simulation cohérente et de restitutions fiables

**Résultat observable :** la configuration, la progression, l’historique, la comparaison et les
restitutions UI, PDF et export restent cohérents avec un cache local et un état d’expérience fiables.

**Flux de valeur :** empêcher l’affichage ou l’export de résultats devenus incohérents et permettre au décideur de retrouver la même information dans l’interface et dans les rapports.

**Attendus détaillés :** [`backlog-expectations/feature-10-simulation-experience.md`](backlog-expectations/feature-10-simulation-experience.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 10.1 | Configuration et état de l’expérience structurés | M | Sol Très élevé | |
| 10.2 | Lancement et progression visible orchestrés | L | Sol Très élevé | |
| 10.3 | Cache, historique local et migrations isolés | L | Sol Très élevé | |
| 10.4 | Invalidation, rechargement, comparaison et rejeu par seed sécurisés | M | Sol Très élevé | |
| 10.5 | Modèle commun des restitutions UI, PDF et export défini | M | Sol Élevé | |
| 10.6 | Diagnostics, graphiques et mise en page des restitutions séparés | L | Sol Élevé | |
| 10.7 | Pagination, rendu PDF, export et téléchargement séparés | L | Sol Élevé | |
| 10.8 | Artefacts et échecs partiels de restitution sécurisés | M | Sol Très élevé | |
| 10.9 | Formulations et conventions visuelles UI/PDF harmonisées | M | Sol Medium | |
| 10.10 | Composants frontend à responsabilités multiples audités et découpés | L | Sol Très élevé | |

## Feature 11 — Rendre les traitements coûteux exécutables à l’échelle

**Résultat observable :** les audits et autres traitements longs utilisent un mode interactif ou asynchrone
justifié par la charge mesurée, avec des jobs, workers, progressions, reprises et ressources maîtrisés.

**Flux de valeur :** soutenir une utilisation croissante avec des SLO, une consommation de ressources, une dégradation et des coûts explicitement maîtrisés.

**Attendus détaillés :** [`backlog-expectations/feature-11-scalability.md`](backlog-expectations/feature-11-scalability.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 11.1 | Modèle de charge conceptuelle et enveloppes mesurables établis | M | Sol Élevé | |
| 11.2 | Performances interactives et asynchrones comparées par benchmark | L | Sol Très élevé | |
| 11.3 | Seuil interactif ou asynchrone justifié par les mesures | L | Sol Très élevé | |
| 11.4 | Jobs et résultats agrégés persistés de façon minimisée | M | Sol Très élevé | |
| 11.5 | Jobs, progression, annulation et reprise maîtrisés | L | Sol Très élevé | |
| 11.6 | Workers distribuables avec ressources maîtrisées | L | Sol Ultra | |
| 11.7 | Traitements, ressources et coûts observables | L | Sol Très élevé | |
| 11.8 | Charge nominale, pointe, endurance et reprise validées | L | Sol Très élevé | |

## Feature 12 — Soutenir le pilotage de programme avec des relations opérationnelles explicites

**Résultat observable :** plusieurs projets sont consolidés dans une vue adaptée aux arbitrages de
direction, avec des relations opérationnelles explicites dans le modèle portefeuille.

**Flux de valeur :** transformer une comparaison statistique multiéquipes en capacité de pilotage de programme, sans confondre hypothèses, dépendances réelles, risques et décisions humaines.

**Attendus détaillés :** [`backlog-expectations/feature-12-program-management.md`](backlog-expectations/feature-12-program-management.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 12.1 | Modèle des relations opérationnelles entre équipes défini | M | Sol Très élevé | |
| 12.2 | Dépendances, séquencements et contraintes modélisés | L | Sol Très élevé | |
| 12.3 | Substituabilité et capacités partagées modélisées | L | Sol Très élevé | |
| 12.4 | Effets de cascade entre équipes et projets simulables | L | Sol Très élevé | |
| 12.5 | Modèle de consolidation programme disponible | L | Sol Très élevé | |
| 12.6 | Vue de direction de programme disponible | L | Sol Élevé | |
| 12.7 | Exports structurés de reporting programme disponibles | L | Sol Élevé | |

## Feature 13 — Disposer d’une gouvernance technique rationalisée

**Résultat observable :** les contrôles du dépôt protègent les risques utiles avec un coût, des
recouvrements et une maintenance maîtrisés, sans affaiblir les protections critiques.

**Flux de valeur :** conserver une forte confiance dans le produit tout en réduisant le temps de changement, la charge de maintenance et la complexité de reprise par un autre contributeur.

**Attendus détaillés :** [`backlog-expectations/feature-13-technical-governance.md`](backlog-expectations/feature-13-technical-governance.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 13.1 | Inventaire des contrôles, scripts, preuves et dépendances de gouvernance disponible | M | Sol Élevé | |
| 13.2 | Coût d’exécution et de maintenance de chaque contrôle mesuré | M | Sol Élevé | |
| 13.3 | Chaque contrôle relié à un risque produit ou opérationnel explicite | M | Sol Medium | |
| 13.4 | Contrôles redondants, indirects ou sans valeur démontrée identifiés | L | Sol Très élevé | |
| 13.5 | Contrôles simplifiés et fusionnés sans réduire la couverture des risques | L | Sol Ultra | |
| 13.6 | Temps de feedback local, PR et `main` réduit | L | Sol Très élevé | |
| 13.7 | Maintenance et diagnostic du système de qualité documentés | M | Sol Medium | |
| 13.8 | Évolution du coût de changement mesurée après rationalisation | M | Sol Medium | |
| 13.9 | Reprise du produit par un nouveau contributeur démontrée | M | Sol Medium | |
| 13.10 | Approvisionnement des images de services CI indépendant et immuable | M | Sol Élevé | |

## Feature 14 — Disposer d’une stratégie de diffusion claire et d’une adoption simplifiée

**Résultat observable :** l’ambition, la pérennité, le marché cible, les modes de distribution et le
parcours d’adoption réel du produit sont explicites pour une organisation Azure DevOps.

**Flux de valeur :** transformer un dépôt techniquement crédible en proposition lisible, testable et adoptable par ses utilisateurs et intégrateurs cibles.

**Attendus détaillés :** [`backlog-expectations/feature-14-distribution-strategy.md`](backlog-expectations/feature-14-distribution-strategy.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 14.1 | Ambition, modèle de diffusion et pérennité du produit décidés | S | Sol Medium | |
| 14.2 | Segments utilisateurs et organisations prioritaires définis | M | Sol Medium | |
| 14.3 | Différenciateurs futurs et critères de preuve de valeur formalisés | M | Sol Medium | |
| 14.4 | README et démo centrés sur la valeur actuelle et future sans confusion de statut | M | Sol Élevé | |
| 14.5 | Freins du parcours d’adoption réel cartographiés | M | Sol Medium | |
| 14.6 | Modèle d’authentification Azure DevOps choisi et justifié | M | Sol Très élevé | |
| 14.7 | Distribution Azure DevOps Marketplace évaluée et décidée | M | Sol Élevé | |
| 14.8 | Périmètre linguistique et internationalisation décidés | S | Sol Medium | |
| 14.9 | Activation et réussite du premier usage mesurables | M | Sol Très élevé | |

# Synthèse du backlog

**Feature en cours :** Feature 2 — Garantir la fiabilité du cœur statistique — 16/20 PBI réalisés (80 %).
**Prochain PBI :** `2.17` — Rejeu exact interlangage démontré sur le corpus versionné — non commencé.
**Reliquats de la Feature 2 :** `2.17`, `2.18`, `2.19`, `2.20`.
**Progression globale :** 27/140 PBI réalisés (19,29 %) ; 113 restants.

| Feature | Nombre de PBI | Réalisés | Restants |
| ---: | ---: | :---: | :---: |
| 1 — Disposer d’un système de preuve qualité gouverné | 11 | 11 | 0 |
| 2 — Garantir la fiabilité du cœur statistique | 20 | 16 | 4 |
| 3 — Disposer d’un moteur statistique Python réutilisable et distribuable | 12 | 0 | 12 |
| 4 — Disposer d’une mise en production personnelle sécurisée | 6 | 0 | 6 |
| 5 — Démontrer la valeur d’usage du mode portefeuille | 4 | 0 | 4 |
| 6 — Rendre mesurables la qualité réelle et les limites opérationnelles | 8 | 0 | 8 |
| 7 — Disposer d’une architecture applicative évolutive et vérifiable | 13 | 0 | 13 |
| 8 — Disposer de données Azure DevOps fiables et contextualisées par sprint | 14 | 0 | 14 |
| 9 — Disposer de prévisions rejouables dans le temps et calibrées | 8 | 0 | 8 |
| 10 — Disposer d’une expérience de simulation cohérente et de restitutions fiables | 10 | 0 | 10 |
| 11 — Rendre les traitements coûteux exécutables à l’échelle | 8 | 0 | 8 |
| 12 — Soutenir le pilotage de programme avec des relations opérationnelles explicites | 7 | 0 | 7 |
| 13 — Disposer d’une gouvernance technique rationalisée | 10 | 0 | 10 |
| 14 — Disposer d’une stratégie de diffusion claire et d’une adoption simplifiée | 9 | 0 | 9 |
| **Total** | **140** | **27** | **113** |

Aucun PBI n’est classé XL.

Les sujets conditionnels non numérotés ne sont pas inclus dans le total.
