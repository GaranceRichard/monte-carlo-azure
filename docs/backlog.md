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
déterministe, des preuves exactes et distributionnelles et des références partagées.

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
| 2.17 | Rejeu exact interlangage démontré sur le corpus versionné | L | Sol Ultra | 29/07/2026 |
| 2.18 | Protocole de parité distributionnelle versionné et testable | M | Sol Très élevé | 01/08/2026 |
| 2.19 | Rapport consolidé de parité déterministe, exacte et distributionnelle disponible | M | Sol Très élevé | 01/08/2026 |
| 2.20 | Dérives de version et décisions de compatibilité statistique bloquées | M | Sol Très élevé | 01/08/2026 |
| 2.21 | Contrôles complets de parité et de compatibilité bloquants dans le profil `main` | M | Sol Très élevé | 02/08/2026 |

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
| 3.5 | Contrats métier internes exposés par l’API publique du package | M | Sol Très élevé | |
| 3.6 | Moteur interne inclus derrière l’API publique du package | M | Sol Très élevé | |
| 3.7 | Façade publique de simulation disponible dans le package | M | Sol Très élevé | |
| 3.8 | Isolation du package démontrée par un consommateur externe | M | Sol Très élevé | |
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

## Feature 7 — Réduire le coût de changement par une architecture explicite et modulaire

**Résultat observable :** une architecture hexagonale pragmatique, guidée par la séparation des
préoccupations et contrôlée automatiquement, isole les responsabilités métier, applicatives, techniques, de
présentation et de qualité. Les futures capacités évoluent par modifications locales, publiables et
démontrables sans travaux transversaux disproportionnés.

**Flux de valeur :** permettre l’évolution du produit sans reproduire le coût, l’étendue et l’instabilité
rencontrés sur le PBI 2.21, grâce à des frontières explicites, des modules cohésifs et des changements
atomiques.

**Attendus détaillés :** [`backlog-expectations/feature-07-evolvable-architecture.md`](backlog-expectations/feature-07-evolvable-architecture.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 7.1 | Les responsabilités frontend et leurs flux de données sont cartographiés | S | Sol Élevé | 13/08/2026 |
| 7.2 | Les responsabilités backend et le cycle de vie des données sont cartographiés | S | Sol Élevé | 13/08/2026 |
| 7.3 | Les responsabilités de l’infrastructure qualité sont cartographiées | S | Sol Élevé | 13/08/2026 |
| 7.4 | Les dépendances, cycles et contournements réels sont établis | S | Sol Très élevé | 13/08/2026 |
| 7.5 | Le coût de changement et ses hotspots disposent d’une baseline | S | Sol Medium | 20/08/2026 |
| 7.6 | Chaque donnée structurante possède une autorité explicite | XS | Sol Très élevé | |
| 7.7 | Les directions de dépendance cibles sont décidées | S | Sol Très élevé | |
| 7.8 | L’architecture cible possède des frontières acceptées | M | Sol Ultra | |
| 7.9 | La migration architecturale suit une séquence acyclique | S | Sol Très élevé | |
| 7.10 | L’autorité des dépendances est lisible et diagnostiquable automatiquement | S | Sol Très élevé | |
| 7.11 | Le domaine reste indépendant des technologies | S | Sol Très élevé | |
| 7.12 | Les API publiques empêchent les imports profonds | S | Sol Très élevé | |
| 7.13 | Les cycles de dépendance sont empêchés | S | Sol Très élevé | |
| 7.14 | Les adaptateurs restent indépendants entre eux | S | Sol Très élevé | |
| 7.15 | Les DTO techniques restent confinés à leurs adaptateurs | S | Sol Très élevé | |
| 7.16 | Les modules partagés respectent une direction de dépendance explicite | S | Sol Très élevé | |
| 7.17 | Le contrôle architectural protège les profils locaux et main | S | Sol Très élevé | |
| 7.18 | Les diagnostics architecturaux sont exploitables par les contributeurs | XS | Sol Élevé | |
| 7.19 | La prévision frontend dépend d’un contrat indépendant de React | M | Sol Ultra | |
| 7.20 | La configuration portefeuille dépend d’un contrat indépendant du hook applicatif | S | Sol Très élevé | |
| 7.21 | L’événement de delivery porte un fait métier normalisé | S | Sol Très élevé | |
| 7.22 | La fenêtre historique appartient au domaine delivery | S | Sol Très élevé | |
| 7.23 | La semaine et le fuseau horaire suivent une politique métier unique | S | Sol Très élevé | |
| 7.24 | Les périodes partielles sont explicites dans le domaine delivery | XS | Sol Très élevé | |
| 7.25 | Les calculs de throughput appartiennent au domaine delivery | S | Sol Très élevé | |
| 7.26 | Les calculs de Cycle Time appartiennent au domaine delivery | S | Sol Très élevé | |
| 7.27 | La complétude de l’historique est un invariant delivery | S | Sol Très élevé | |
| 7.28 | Les discontinuités de l’historique sont un invariant delivery | S | Sol Très élevé | |
| 7.29 | La cohérence chronologique est un invariant delivery | S | Sol Très élevé | |
| 7.30 | Les diagnostics delivery traversent la frontière applicative sans perte | S | Sol Très élevé | |
| 7.31 | Le temps frontend est injectable et déterministe | S | Sol Très élevé | |
| 7.32 | Le temps backend est injectable et déterministe | S | Sol Très élevé | |
| 7.33 | L’identité des historiques est injectable | S | Sol Très élevé | |
| 7.34 | L’identité du client frontend est injectable | S | Sol Très élevé | |
| 7.35 | La connexion Azure DevOps confine le PAT derrière un contrat opaque | S | Sol Très élevé | |
| 7.36 | La découverte Azure DevOps dépend d’un port applicatif | S | Sol Très élevé | |
| 7.37 | Les requêtes WIQL dépendent d’un port applicatif | S | Sol Très élevé | |
| 7.38 | La lecture des work items dépend d’un port applicatif | S | Sol Très élevé | |
| 7.39 | La lecture des révisions dépend d’un port applicatif | S | Sol Très élevé | |
| 7.40 | Les DTO Azure DevOps restent confinés dans les adaptateurs | S | Sol Très élevé | |
| 7.41 | La connexion Cloud respecte le contrat Azure DevOps commun | S | Sol Très élevé | |
| 7.42 | La connexion Server/TFS respecte le contrat Azure DevOps commun | S | Sol Très élevé | |
| 7.43 | L’onboarding dépend des ports Azure DevOps plutôt que de la façade historique | S | Sol Très élevé | |
| 7.44 | Les accès Azure DevOps directs sont empêchés hors adaptateurs | S | Sol Très élevé | |
| 7.45 | Le moteur Python est accessible par un port sans type NumPy | S | Sol Très élevé | |
| 7.46 | Le moteur TypeScript local est accessible par un port applicatif | S | Sol Très élevé | |
| 7.47 | Le moteur TypeScript HTTP est accessible par un port applicatif | S | Sol Très élevé | |
| 7.48 | La persistance des simulations dépend d’un port applicatif | S | Sol Très élevé | |
| 7.49 | MongoDB implémente le port de persistance des simulations | S | Sol Très élevé | |
| 7.50 | La mémoire implémente le port de persistance des simulations | XS | Sol Très élevé | |
| 7.51 | L’historique d’équipe est exposé par un cas d’usage applicatif | S | Sol Très élevé | |
| 7.52 | La prévision d’équipe est exposée par un cas d’usage applicatif | S | Sol Très élevé | |
| 7.53 | La prévision portefeuille est exposée par un cas d’usage applicatif | S | Sol Très élevé | |
| 7.54 | La composition frontend assemble uniquement des ports applicatifs | S | Sol Très élevé | |
| 7.55 | La composition backend assemble uniquement des ports applicatifs | S | Sol Très élevé | |
| 7.56 | La frontière d’identité backend expose le minimum nécessaire | XS | Sol Très élevé | |
| 7.57 | Le limiteur de simulation est observable hors de la route HTTP | S | Sol Très élevé | |
| 7.58 | Le cycle de persistance des simulations est orchestré hors de la route HTTP | S | Sol Très élevé | |
| 7.59 | L’orchestration des prévisions est indépendante des hooks React | S | Sol Très élevé | |
| 7.60 | Le résultat équipe possède un modèle de présentation indépendant | S | Sol Très élevé | |
| 7.61 | Le résultat portefeuille possède un modèle de présentation indépendant | S | Sol Très élevé | |
| 7.62 | React ne contient aucun calcul métier de restitution | S | Sol Très élevé | |
| 7.63 | Les rapports ne contiennent aucun calcul métier | S | Sol Très élevé | |
| 7.64 | Les adaptateurs UI et rapport évoluent indépendamment | S | Sol Très élevé | |
| 7.65 | La génération des rapports ne dépend pas du DOM | XS | Sol Très élevé | |
| 7.66 | Les modèles de présentation sont accessibles par une API publique stable | XS | Sol Très élevé | |
| 7.67 | Le graphe produit reste indépendant de l’infrastructure qualité | S | Sol Très élevé | |
| 7.68 | Le runner statistique reste indépendant des adaptateurs backend | S | Sol Très élevé | |
| 7.69 | La preuve statistique possède un producteur et un vérificateur indépendants du produit | S | Sol Très élevé | |
| 7.70 | L’orchestration qualité délègue ses chemins d’exécution à des composants explicites | S | Sol Très élevé | |
| 7.71 | L’architecture est vérifiée dans le workspace | S | Sol Très élevé | |
| 7.72 | L’architecture est vérifiée dans un worktree détaché | S | Sol Très élevé | |
| 7.73 | L’architecture est vérifiée dans la CI | S | Sol Très élevé | |
| 7.74 | La réduction du coût de changement est mesurée | M | Sol Très élevé | |
| 7.75 | L’engageabilité de la Feature 8 est démontrée par un historique d’équipe | S | Sol Ultra | |

## Feature 8 — Disposer de données Azure DevOps fiables et contextualisées par sprint

**Résultat observable :** les données Azure DevOps ont des limites explicitement qualifiées et sont
replacées dans le contexte réel des itérations Cloud et Server/TFS au travers d’un client structuré.

**Flux de valeur :** fournir aux prévisions un historique fiable, temporellement cohérent et replacé dans son contexte de sprint avant que le décideur n’interprète les résultats.

**Attendus détaillés :** [`backlog-expectations/feature-08-azure-devops-data.md`](backlog-expectations/feature-08-azure-devops-data.md)

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 8.1 | Pagination complète des données de delivery démontrée | M | Sol Très élevé | |
| 8.2 | Lots partiels de collecte signalés sans perte silencieuse | M | Sol Très élevé | |
| 8.3 | Provenance des données de delivery visible | M | Sol Élevé | |
| 8.4 | Types et états de work items appliqués à la collecte | M | Sol Très élevé | |
| 8.5 | Périmètre d’équipe appliqué à la collecte | M | Sol Très élevé | |
| 8.6 | Compatibilité fonctionnelle des collectes Cloud et Server/TFS démontrée | L | Sol Très élevé | |
| 8.7 | Qualité et complétude des données collectées qualifiées | M | Sol Très élevé | |
| 8.8 | Périodes partielles et historiques manquants détectés | L | Sol Élevé | |
| 8.9 | Qualité des données visible dans l’interface et les rapports | M | Sol Élevé | |
| 8.10 | Jeu de données présenté sur une fenêtre temporelle cohérente | L | Sol Très élevé | |
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
| 10.5 | Résultats et diagnostics de simulation lisibles dans l’interface | M | Sol Élevé | |
| 10.6 | Contenu PDF compréhensible sans lecture de l’interface | M | Sol Élevé | |
| 10.7 | Pagination PDF fiable sur les rapports réels | L | Sol Élevé | |
| 10.8 | Artefacts et échecs partiels de restitution sécurisés | M | Sol Très élevé | |
| 10.9 | Formulations et repères visuels compréhensibles dans chaque restitution | M | Sol Medium | |
| 10.10 | Téléchargements de restitution compréhensibles et accessibles | M | Sol Élevé | |

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
| 11.5 | États de jobs, annulation et reprise maîtrisés | L | Sol Très élevé | |
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
| 13.1 | Coût d’exécution et de maintenance de chaque contrôle mesuré | M | Sol Élevé | |
| 13.2 | Chaque contrôle relié à un risque produit ou opérationnel explicite | M | Sol Medium | |
| 13.3 | Contrôles redondants, indirects ou sans valeur démontrée identifiés | L | Sol Très élevé | |
| 13.4 | Contrôles simplifiés et fusionnés sans réduire la couverture des risques | L | Sol Ultra | |
| 13.5 | Temps de feedback local, PR et `main` réduit | L | Sol Très élevé | |
| 13.6 | Maintenance et diagnostic du système de qualité documentés | M | Sol Medium | |
| 13.7 | Évolution du coût de changement mesurée après rationalisation | M | Sol Medium | |
| 13.8 | Reprise du produit par un nouveau contributeur démontrée | M | Sol Medium | |
| 13.9 | Approvisionnement des images de services CI indépendant et immuable | M | Sol Élevé | |

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

**Feature en cours :** Feature 7 — Réduire le coût de changement par une architecture explicite et modulaire — 5/75 PBI réalisés (6,67 %).
**Prochain PBI :** 7.6 — Chaque donnée structurante possède une autorité explicite — non commencé.
**Dernière Feature terminée :** Feature 2 — Garantir la fiabilité du cœur statistique — 21/21 PBI réalisés (100 %).
**Reliquats de la Feature 7 :** `7.6`, `7.7`, `7.8`, `7.9`, `7.10`, `7.11`, `7.12`, `7.13`, `7.14`, `7.15`, `7.16`, `7.17`, `7.18`, `7.19`, `7.20`, `7.21`, `7.22`, `7.23`, `7.24`, `7.25`, `7.26`, `7.27`, `7.28`, `7.29`, `7.30`, `7.31`, `7.32`, `7.33`, `7.34`, `7.35`, `7.36`, `7.37`, `7.38`, `7.39`, `7.40`, `7.41`, `7.42`, `7.43`, `7.44`, `7.45`, `7.46`, `7.47`, `7.48`, `7.49`, `7.50`, `7.51`, `7.52`, `7.53`, `7.54`, `7.55`, `7.56`, `7.57`, `7.58`, `7.59`, `7.60`, `7.61`, `7.62`, `7.63`, `7.64`, `7.65`, `7.66`, `7.67`, `7.68`, `7.69`, `7.70`, `7.71`, `7.72`, `7.73`, `7.74`, `7.75`.
**Progression globale :** 37/202 PBI réalisés (18,32 %) ; 165 restants.

| Feature | Nombre de PBI | Réalisés | Restants |
| ---: | ---: | :---: | :---: |
| 1 — Disposer d’un système de preuve qualité gouverné | 11 | 11 | 0 |
| 2 — Garantir la fiabilité du cœur statistique | 21 | 21 | 0 |
| 3 — Disposer d’un moteur statistique Python réutilisable et distribuable | 12 | 0 | 12 |
| 4 — Disposer d’une mise en production personnelle sécurisée | 6 | 0 | 6 |
| 5 — Démontrer la valeur d’usage du mode portefeuille | 4 | 0 | 4 |
| 6 — Rendre mesurables la qualité réelle et les limites opérationnelles | 8 | 0 | 8 |
| 7 — Réduire le coût de changement par une architecture explicite et modulaire | 75 | 5 | 70 |
| 8 — Disposer de données Azure DevOps fiables et contextualisées par sprint | 14 | 0 | 14 |
| 9 — Disposer de prévisions rejouables dans le temps et calibrées | 8 | 0 | 8 |
| 10 — Disposer d’une expérience de simulation cohérente et de restitutions fiables | 10 | 0 | 10 |
| 11 — Rendre les traitements coûteux exécutables à l’échelle | 8 | 0 | 8 |
| 12 — Soutenir le pilotage de programme avec des relations opérationnelles explicites | 7 | 0 | 7 |
| 13 — Disposer d’une gouvernance technique rationalisée | 9 | 0 | 9 |
| 14 — Disposer d’une stratégie de diffusion claire et d’une adoption simplifiée | 9 | 0 | 9 |
| **Total** | **202** | **37** | **165** |

Aucun PBI n’est classé XL.

Les sujets conditionnels non numérotés ne sont pas inclus dans le total.
