# Backlog consolidé et ordonnancé

## Séquence prioritaire actuelle

1. **1.11 — Rétablir la modification obligatoire du README comme gate de commit**
2. **Terminer la Feature 2 — Garantir la fiabilité du cœur statistique**
3. **Rationaliser le dispositif de gouvernance technique — Feature 13**
4. Réarbitrer les autres Features selon la stratégie de diffusion définie par la Feature 14

Aucun PBI ne peut être considéré comme committable si `README.md` n’a pas reçu une évolution pertinente, réellement stagée avec le changement livré.

---

## Feature 1 — Disposer d’un système de preuve qualité gouverné

**Description :** mettre en place un dispositif capable de classifier, sélectionner, exécuter, dénombrer et piloter automatiquement les tests selon leur nature réelle, leurs finalités, leurs risques et leurs profils d’exécution.

**Flux de valeur :** rendre mesurable et vérifiable la confiance apportée par la stratégie de test, plutôt que de s’appuyer uniquement sur le volume de tests ou la couverture du code.

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

### Règle portée par le PBI 1.11

La gate de commit doit vérifier le contenu réellement stagé et refuser tout commit lorsque :

- des changements sont destinés au commit ;
- `README.md` n’est pas modifié et stagé ;
- `README.md` est modifié dans le worktree mais absent du staging.

La règle s’applique sans exception implicite aux changements de code, tests, documentation, configuration, CI/CD, architecture, backlog et maintenance.

La modification du README doit être pertinente et refléter le changement livré. Une modification artificielle ou purement mécanique ne satisfait pas l’intention de la gate.

---

## Feature 2 — Garantir la fiabilité du cœur statistique

**Description :** formaliser les règles statistiques communes, supprimer les divergences involontaires entre Python et TypeScript et protéger les invariants du moteur par des contrats et des jeux de référence partagés.

**Flux de valeur :** assurer que les projections, diagnostics et décisions reposent sur des calculs cohérents, reproductibles et explicables, quel que soit le chemin d’exécution utilisé.

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 2.1 | Auditer les divergences statistiques Python et TypeScript | M | Sol Très élevé | 22/07/2026 |
| 2.2 | Définir le contrat normatif de parité statistique | M | Sol Très élevé | 22/07/2026 |
| 2.3 | Séparer les DTO des modèles statistiques métier | L | Sol Très élevé | 22/07/2026 |
| 2.4 | Introduire les Value Objects statistiques prioritaires | L | Sol Très élevé | |
| 2.5 | Injecter l’aléatoire, l’horloge et les identifiants variables | M | Sol Élevé | |
| 2.6 | Construire les jeux de référence statistiques partagés | M | Sol Élevé | |
| 2.7 | Aligner les implémentations statistiques | L | Sol Très élevé | |
| 2.8 | Bloquer les régressions de parité entre les moteurs | L | Sol Très élevé | |

---

## Feature 3 — Rendre le moteur statistique réutilisable et intégrable

**Description :** extraire le cœur Monte Carlo dans un package Python autonome, documenté, versionné et utilisable sans Azure DevOps, FastAPI, MongoDB ou frontend.

**Flux de valeur :** rendre concrète la promesse Apache 2.0 en permettant à un intégrateur tiers d’utiliser directement le moteur sans devoir comprendre, forker ou nettoyer l’ensemble de l’application.

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 3.1 | Séparer les trajectoires d’usage personnel et de réutilisabilité externe | M | Sol Medium | |
| 3.2 | Définir le périmètre et l’API publique du package | M | Sol Élevé | |
| 3.3 | Extraire le moteur et ses validations dans un package autonome | L | Sol Ultra | |
| 3.4 | Versionner, construire et tester le package isolément | L | Sol Très élevé | |
| 3.5 | Écrire un guide minimal d’intégration du moteur | M | Sol Medium | |

---

## Feature 4 — Sécuriser la mise en production personnelle

**Description :** corriger les risques immédiats de persistance, de conteneurisation et d’identification des clients avant toute exposition réelle de l’application.

**Flux de valeur :** permettre un déploiement personnel exploitable sans croissance silencieuse du stockage, privilèges excessifs dans le conteneur ou contournement du rate limiting.

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 4.1 | Corriger la politique de rétention des simulations MongoDB | M | Sol Élevé | |
| 4.2 | Prouver la purge des simulations anciennes pour un client actif | M | Sol Élevé | |
| 4.3 | Séparer les dépendances Python runtime et développement | M | Sol Élevé | |
| 4.4 | Exécuter le conteneur applicatif avec un utilisateur non-root | M | Sol Élevé | |
| 4.5 | Définir le modèle de confiance des adresses clientes | S | Sol Très élevé | |
| 4.6 | Appliquer et tester la politique de proxy de confiance | L | Sol Très élevé | |

---

## Feature 5 — Valider la valeur d’usage du mode portefeuille

**Description :** observer l’utilisation réelle du portefeuille avant d’ajouter de nouveaux scénarios, diagnostics ou niveaux de complexité à l’interface.

**Flux de valeur :** vérifier que les quatre hypothèses et les trois dimensions de diagnostic facilitent réellement la décision en comité plutôt que d’augmenter la charge cognitive et le besoin d’explication.

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 5.1 | Définir le protocole d’observation de l’usage portefeuille | S | Sol Medium | |
| 5.2 | Instrumenter l’usage du portefeuille dans le respect de la vie privée | M | Sol Très élevé | |
| 5.3 | Observer l’utilisation réelle du portefeuille | M | Sol Medium | |
| 5.4 | Décider de conserver, simplifier ou divulguer progressivement la complexité | M | Sol Medium | |

### Mesures attendues

L’instrumentation doit pouvoir mesurer sans collecter d’identité Azure DevOps :

- ouverture du mode portefeuille ;
- nombre d’équipes sélectionnées ;
- lancement des scénarios ;
- temps de calcul ;
- génération du PDF ;
- choix éventuel d’une référence de pilotage ;
- échecs partiels ;
- abandon du parcours.

Le protocole doit également vérifier si les utilisateurs distinguent correctement :

- les données observées ;
- l’incertitude statistique ;
- l’hypothèse de scénario ;
- la recommandation ;
- le refus de trancher faute de preuves.

---

## Feature 6 — Mesurer la qualité réelle et les limites opérationnelles

**Description :** compléter la couverture structurelle par une mesure de la capacité de détection des tests, des risques non fonctionnels et des performances observables du produit.

**Flux de valeur :** disposer d’une base factuelle permettant de distinguer une suite de tests volumineuse d’une suite réellement efficace, et mesurer le produit avant toute optimisation ou montée en charge.

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

### Bornes à intégrer dans la baseline

- `n_sims = 200 000` ;
- historique de 521 semaines ;
- horizon de 521 semaines ;
- simulations portefeuille multi-équipes ;
- calcul simultané de plusieurs scénarios ;
- génération PDF ;
- exécutions concurrentes.

---

## Feature 7 — Établir une architecture applicative évolutive

**Description :** formaliser les frontières internes, supprimer les cycles et isoler les cas d’usage des technologies d’accès aux données, de calcul et de persistance.

**Flux de valeur :** permettre l’évolution du produit sans accroître le couplage, les responsabilités concentrées, les régressions ou le coût de chaque modification.

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

### Résultat attendu du PBI 7.9

- objet-frontière typé limité aux données statistiques anonymes ;
- contrats dédiés aux données autorisées vers le backend ;
- interdiction architecturale des dépendances entre contexte ADO et moteur backend ;
- tests négatifs de contrat ;
- contrôle du graphe d’imports ;
- conservation du contrôle lexical comme défense complémentaire, non comme garantie unique.

---

## Feature 8 — Fiabiliser les données Azure DevOps et matérialiser les sprints

**Description :** restructurer le client Azure DevOps, qualifier explicitement les limites des données et intégrer le contexte réel des itérations Cloud et Server/TFS.

**Flux de valeur :** fournir aux prévisions un historique fiable, temporellement cohérent et replacé dans son contexte de sprint avant que le décideur n’interprète les résultats.

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

### Résultat attendu du PBI 8.14

- détecter les ruptures, dérives et périodes non représentatives ;
- signaler les historiques dont la stabilité est insuffisante ;
- distinguer absence de preuve et preuve d’instabilité ;
- dégrader ou bloquer la recommandation lorsque la prévision ne peut pas être défendue ;
- ne pas transformer l’absence d’une politique WIP connue en preuve automatique d’imprévisibilité.

---

## Feature 9 — Éprouver les prévisions face au temps et aux résultats réels

**Description :** comparer les projections aux résultats observés et détecter les changements de comportement qui rendent un historique moins représentatif.

**Flux de valeur :** distinguer une prévision techniquement calculable d’une méthode empiriquement crédible pour soutenir une décision.

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 9.1 | Définir le protocole de calibration et de backtesting | M | Sol Très élevé | |
| 9.2 | Construire les couples prévision–résultat observé | L | Sol Très élevé | |
| 9.3 | Mesurer la couverture empirique des percentiles | L | Sol Très élevé | |
| 9.4 | Comparer la crédibilité des différentes fenêtres historiques | L | Sol Très élevé | |
| 9.5 | Détecter les tendances et ruptures de régime | L | Sol Très élevé | |
| 9.6 | Détecter la saisonnalité et l’obsolescence de l’historique | L | Sol Très élevé | |
| 9.7 | Restituer les diagnostics de calibration et de non-stationnarité | L | Sol Élevé | |
| 9.8 | Calibrer, renommer ou retirer le Risk Score | L | Sol Très élevé | |

### Décision attendue sur le Risk Score

- tester sa relation avec les écarts réellement observés ;
- mesurer sa stabilité selon le mode, `n_sims` et la fenêtre historique ;
- vérifier sa valeur supplémentaire par rapport à P50, P90 et aux diagnostics ;
- calibrer les seuils de lecture ;
- le renommer en « Indice de dispersion » si aucune interprétation empirique du risque n’est démontrée ;
- le retirer s’il n’améliore pas la décision.

---

## Feature 10 — Fiabiliser l’expérience de simulation et les restitutions

**Description :** séparer les responsabilités frontend et PDF, fiabiliser l’état des simulations et garantir une présentation cohérente sur tous les supports.

**Flux de valeur :** empêcher l’affichage ou l’export de résultats devenus incohérents et permettre au décideur de retrouver la même information dans l’interface et dans les rapports.

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 10.1 | Cartographier et séparer les responsabilités d’état frontend | M | Sol Très élevé | |
| 10.2 | Extraire l’acquisition et l’orchestration des simulations | L | Sol Très élevé | |
| 10.3 | Isoler le cache, l’historique local et les migrations | L | Sol Très élevé | |
| 10.4 | Sécuriser invalidation, rechargement et rejeu par seed | M | Sol Très élevé | |
| 10.5 | Définir le modèle de données commun des rapports | M | Sol Élevé | |
| 10.6 | Séparer diagnostics, graphiques et mise en page | L | Sol Élevé | |
| 10.7 | Séparer pagination, rendu PDF et téléchargement | L | Sol Élevé | |
| 10.8 | Sécuriser les artefacts et les échecs partiels de génération | M | Sol Très élevé | |
| 10.9 | Harmoniser les formulations et conventions visuelles UI/PDF | M | Sol Medium | |

---

## Feature 11 — Faire passer la solution à l’échelle

**Description :** définir les objectifs de charge, instrumenter le produit et faire évoluer son exécution pour supporter davantage de concurrence, de volume et de traitements longs.

**Flux de valeur :** soutenir une utilisation croissante avec des SLO, une consommation de ressources, une dégradation et des coûts explicitement maîtrisés.

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 11.1 | Définir les volumes cibles, la concurrence et les SLO | M | Sol Élevé | |
| 11.2 | Construire le dispositif de tests de charge | L | Sol Très élevé | |
| 11.3 | Caractériser la montée en charge des workers et de la mémoire | L | Sol Très élevé | |
| 11.4 | Valider Redis et MongoDB en fonctionnement multi-worker | M | Sol Très élevé | |
| 11.5 | Concevoir le traitement asynchrone et l’annulation des calculs longs | L | Sol Très élevé | |
| 11.6 | Mettre en place une exécution distribuable et stateless | L | Sol Ultra | |
| 11.7 | Ajouter l’observabilité et le suivi des coûts de scalabilité | L | Sol Très élevé | |
| 11.8 | Valider charge nominale, pointe, endurance et reprise | L | Sol Très élevé | |

---

## Feature 12 — Étendre le produit au pilotage de programme

**Description :** enrichir le modèle portefeuille avec des relations opérationnelles explicites et consolider plusieurs projets dans une vue adaptée aux arbitrages de direction.

**Flux de valeur :** transformer une comparaison statistique multiéquipes en capacité de pilotage de programme, sans confondre hypothèses, dépendances réelles, risques et décisions humaines.

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 12.1 | Définir le modèle des relations opérationnelles entre équipes | M | Sol Très élevé | |
| 12.2 | Modéliser les dépendances, séquencements et contraintes | L | Sol Très élevé | |
| 12.3 | Modéliser la substituabilité et les capacités partagées | L | Sol Très élevé | |
| 12.4 | Simuler les effets de cascade entre équipes et projets | L | Sol Très élevé | |
| 12.5 | Construire le modèle de consolidation programme | L | Sol Très élevé | |
| 12.6 | Construire la vue de direction de programme | L | Sol Élevé | |
| 12.7 | Produire les exports structurés de reporting programme | L | Sol Élevé | |

---

## Feature 13 — Rationaliser le dispositif de gouvernance technique

**Description :** mesurer la valeur, le coût et les recouvrements des contrôles du dépôt, puis simplifier le dispositif sans affaiblir les protections critiques.

**Flux de valeur :** conserver une forte confiance dans le produit tout en réduisant le temps de changement, la charge de maintenance et la complexité de reprise par un autre contributeur.

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

### Principe de rationalisation

La Feature ne poursuit aucun objectif arbitraire de réduction du nombre de lignes ou de scripts.

Chaque contrôle doit être évalué selon :

- le risque protégé ;
- les défauts effectivement détectés ;
- le coût d’exécution ;
- le coût de maintenance ;
- les recouvrements avec d’autres contrôles ;
- la capacité d’un nouveau mainteneur à le comprendre et le réparer.

Les contrôles de sécurité, de contrat, de parité statistique et de protection des parcours critiques restent prioritaires.

---

## Feature 14 — Clarifier la stratégie de diffusion et réduire la friction d’adoption

**Description :** expliciter l’ambition du produit, son modèle de pérennité, son marché cible, ses modes de distribution et le parcours permettant à une organisation Azure DevOps de l’adopter réellement.

**Flux de valeur :** transformer un dépôt techniquement crédible en proposition lisible, testable et adoptable par ses utilisateurs et intégrateurs cibles.

| Numéro | Titre | Complexité | Modèle Codex | Réalisé le |
| ---: | --- | :---: | :---: | :---: |
| 14.1 | Décider de l’ambition, du modèle de diffusion et de la pérennité du produit | S | Sol Medium | |
| 14.2 | Définir les segments utilisateurs et organisations prioritaires | M | Sol Medium | |
| 14.3 | Formaliser les différenciateurs et les preuves de valeur | M | Sol Medium | |
| 14.4 | Recentrer le README et la démo sur la proposition de valeur | M | Sol Élevé | |
| 14.5 | Cartographier les freins du parcours d’adoption réel | M | Sol Medium | |
| 14.6 | Étudier et décider le modèle d’authentification Azure DevOps | M | Sol Très élevé | |
| 14.7 | Évaluer et décider une distribution Azure DevOps Marketplace | M | Sol Élevé | |
| 14.8 | Décider du périmètre linguistique et de l’internationalisation | S | Sol Medium | |
| 14.9 | Mesurer l’activation et la réussite du premier usage | M | Sol Très élevé | |

### Décisions possibles

La Feature doit permettre d’assumer explicitement une trajectoire parmi plusieurs options :

- projet portfolio et démonstrateur ;
- brique open source institutionnelle ;
- solution auto-hébergée ;
- offre de service ;
- SaaS ;
- extension Azure DevOps ;
- combinaison open source et services.

Elle doit également décider, sans automatisme :

- du maintien d’un positionnement francophone ;
- d’une éventuelle interface bilingue ;
- du maintien d’Azure DevOps comme spécialisation ;
- de l’intérêt réel d’OAuth ;
- de la pertinence d’un listing Marketplace.

---

# Sujets conditionnels à arbitrer ultérieurement

Les sujets suivants sont identifiés, mais ne sont pas comptabilisés comme PBI engagés tant que les Features 9 et 14 n’ont pas produit les décisions nécessaires.

## API HTTP publique et intégrations tierces

À envisager après stabilisation du moteur, du package et du modèle de diffusion :

- API HTTP versionnée ;
- OpenAPI public et exemples ;
- politique de compatibilité ;
- authentification et quotas ;
- intégrations Power BI, Grafana ou outils de reporting.

## Support Jira et autres sources de delivery

À envisager après :

- définition du port d’accès aux données ;
- isolation complète d’Azure DevOps ;
- validation d’un besoin de marché réel.

## Prévision d’un item individuel par Cycle Time et SLE

À envisager après fiabilisation des données et backtesting :

- scatterplot de Cycle Time ;
- percentiles par population comparable ;
- Service Level Expectation ;
- classes de service ;
- calibration empirique.

## Recalcul planifié des prévisions

À envisager uniquement après décision sur :

- OAuth ;
- Marketplace ;
- agent local ;
- gestion sécurisée d’identifiants persistants.

## Pondération optionnelle par récence

À ne considérer qu’après avoir démontré par backtesting que le tirage uniforme simple dégrade réellement les résultats dans certains contextes.

## Comparaison avec les fonctionnalités concurrentes

Tout écart avec un concurrent doit être reformulé en :

- problème utilisateur ;
- résultat attendu ;
- preuve de valeur ;
- coût et risques.

« Rattraper le marché » ne constitue pas à lui seul un PBI.

---

# Synthèse du backlog

| Feature | Nombre de PBI | Réalisés | Restants |
| ---: | ---: | :---: | :---: |
| 1 — Preuve qualité gouvernée | 11 | 11 | 0 |
| 2 — Fiabilité du cœur statistique | 8 | 3 | 5 |
| 3 — Réutilisabilité du moteur | 5 | 0 | 5 |
| 4 — Mise en production personnelle | 6 | 0 | 6 |
| 5 — Valeur d’usage du portefeuille | 4 | 0 | 4 |
| 6 — Qualité réelle et limites opérationnelles | 8 | 0 | 8 |
| 7 — Architecture applicative évolutive | 9 | 0 | 9 |
| 8 — Données Azure DevOps et sprints | 14 | 0 | 14 |
| 9 — Calibration et évolution temporelle | 8 | 0 | 8 |
| 10 — Expérience et restitutions | 9 | 0 | 9 |
| 11 — Scalabilité | 8 | 0 | 8 |
| 12 — Pilotage de programme | 7 | 0 | 7 |
| 13 — Rationalisation de la gouvernance | 9 | 0 | 9 |
| 14 — Stratégie de diffusion et adoption | 9 | 0 | 9 |
| **Total** | **115** | **14** | **101** |

Aucun PBI n’est classé XL.

Les sujets conditionnels non numérotés ne sont pas inclus dans le total.

---

# Attribution des modèles Codex

Les modèles Codex sont attribués selon le niveau minimal capable de réaliser le PBI avec une fiabilité suffisante.

- **Sol Medium** : cadrage, documentation, protocole, observation, analyse ou décision ; modifications techniques locales et très prévisibles.
- **Sol Élevé** : réalisation technique bornée, généralement multi-fichiers, dont les frontières et le résultat attendu sont déjà connus.
- **Sol Très élevé** : statistiques, sécurité, concurrence, CI/CD, contrats transverses, compatibilité, migrations ou refactors dont plusieurs choix restent à arbitrer.
- **Sol Ultra** : transformation structurelle massive nécessitant l’exploration et la modification coordonnées de plusieurs sous-systèmes fortement couplés.

La complexité du PBI et le modèle Codex sont deux informations distinctes :

- la **complexité** évalue l’ampleur du travail ;
- le **modèle** évalue la profondeur de raisonnement et l’incertitude nécessaires.

Un PBI `L` peut relever de Sol Élevé lorsqu’il est volumineux mais prévisible, tandis qu’un PBI `S` peut relever de Sol Très élevé lorsqu’il porte une décision de sécurité délicate.

Aucun PBI actuel ne relève de **Sol Minimal**, réservé aux corrections mécaniques telles que le formatage, le renommage évident ou la résolution d’une erreur de lint isolée.

## Répartition des 101 PBI non réalisés

| Modèle Codex | Nombre de PBI |
| --- | ---: |
| Sol Medium | 15 |
| Sol Élevé | 29 |
| Sol Très élevé | 53 |
| Sol Ultra | 4 |
| **Total** | **101** |
