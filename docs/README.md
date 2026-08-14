# Carte de la documentation

Cette carte indique à qui s’adresse chaque famille de documents, son rôle, son autorité et la nature de son
contenu. Elle sert d’index : un document de synthèse renvoie vers l’autorité compétente au lieu d’en recopier
les règles, les preuves ou l’historique.

## Autorités documentaires

| Information | Audience principale | Autorité | Rôle | Nature |
| --- | --- | --- | --- | --- |
| Problème, utilisateurs, positionnement, cas d’usage et valeur | Décideurs, utilisateurs, sponsors | [`PRODUCT.md`](../PRODUCT.md) | Vision produit durable | Produit |
| Synthèse des capacités, garanties, limites, usage et parcours de lecture | Toute personne découvrant le produit | [`README.md`](../README.md) | Porte d’entrée, sans historique de fabrication | Produit |
| Ordre des horizons de valeur | Décideurs produit et contributeurs | [`roadmap.md`](roadmap.md) | Trajectoire sans promesse calendaire | Produit |
| Features, PBI, résultats attendus, complexités, modèles, statuts et dates | Pilotage produit | [`backlog.md`](backlog.md) | Registre faisant autorité | Gouvernance |
| Règles de statut, priorité, dépendance, raffinement et génération du backlog | Pilotage et contributeurs | [`backlog-governance.md`](backlog-governance.md) | Gouvernance transverse | Gouvernance |
| Périmètres, hors-périmètres et preuves attendues des outcomes futurs | Product owner et réalisateurs | [`backlog-expectations/`](backlog-expectations/README.md) | Détail des attentes, sans autorité de statut | Chantier |
| Frontières, composants, flux, API et sécurité structurelle | Développeurs et exploitants | [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Architecture et contrats applicatifs | Technique |
| Responsabilités et flux frontend observés | Développeurs frontend et architectes | [`frontend-responsibilities-map.md`](frontend-responsibilities-map.md) | Baseline factuelle de l’existant, sans architecture cible | Technique |
| Règles statistiques normatives | Développeurs du moteur et reviewers | [`STD-STAT-001.md`](standards/STD-STAT-001.md) | Standard normatif | Norme |
| Forme, dérivation et exécution du corpus statistique | Développeurs du moteur et reviewers | [`statistical-reference-corpus.md`](statistical-reference-corpus.md) | Contrat opératoire et preuves dérivées | Contrat |
| Protocole, calibration et preuve de parité distributionnelle | Statisticiens, développeurs et reviewers | [`statistical-distribution-protocol.md`](statistical-distribution-protocol.md) | Contrat d’inférence multi-seeds et limites | Contrat |
| Lecture consolidée des preuves statistiques | Reviewers, statisticiens et qualité | [`statistical-consolidated-report.md`](statistical-consolidated-report.md) et [`../reports/statistical-consolidated-report.json`](../reports/statistical-consolidated-report.json) | Modèle de consolidation puis autorité machine générée | Preuve |
| Enforcement statistique du profil `main` | Développeurs, reviewers et qualité | [`statistical-main-enforcement.md`](statistical-main-enforcement.md) et [`../config/statistical-main-enforcement-v1.0.json`](../config/statistical-main-enforcement-v1.0.json) | Politique fermée, DAG, fraîcheur et alignement local/CI | Gouvernance |
| Classification et stratégie des tests | Développeurs et qualité | [`STD-TEST-001.md`](standards/STD-TEST-001.md) et [`test-classification.md`](test-classification.md) | Norme puis application au dépôt | Norme |
| Validation, couverture et publiabilité | Contributeurs | [`definition-of-done.md`](definition-of-done.md) | Procédure normative du dépôt | Gouvernance |
| Risques, chemins critiques et preuves Vitals | Qualité, sécurité et reviewers | [`risk-control-matrix.md`](risk-control-matrix.md), [`critical-paths.md`](critical-paths.md) et [`vitals-traceability.md`](vitals-traceability.md) | État de maîtrise et traçabilité | Preuve |
| Maintenabilité et exploitation | Mainteneurs et exploitants | [`maintainability.md`](maintainability.md) et [`deployment.md`](deployment.md) | Procédures spécialisées | Technique |
| Historique des changements | Utilisateurs et mainteneurs | [`CHANGELOG.md`](../CHANGELOG.md) | Chronologie des évolutions | Historique |
| Audits et rapports générés | Reviewers et qualité | [`statistical-parity-audit.md`](statistical-parity-audit.md) et [`../reports/`](../reports/) | Preuves historiques ou régénérables | Preuve |

## Constats de l’audit Markdown

L’audit a porté sur tous les fichiers `*.md` versionnés ou présents dans le corpus documentaire du dépôt.
Il a relevé les recouvrements suivants :

- le README cumulait présentation produit, architecture, contrat statistique, procédures de qualité et
  journal de PBI ;
- `PRODUCT.md`, le README et la roadmap répétaient le positionnement et certaines capacités ;
- le standard statistique, l’architecture et le guide du corpus racontaient à la fois la norme, son
  implémentation et sa chronologie ;
- le guide frontend répétait les capacités produit au lieu de rester centré sur l’usage et les frontières du
  frontend ;
- certains documents permanents conservaient des numéros de PBI uniquement pour expliquer leur ordre de
  fabrication ;
- l’attendu détaillé de la Feature 13 répétait un statut dont le registre du backlog est l’autorité ;
- la description de `CP-003` présentait encore tout le contrat statistique comme non aligné, alors que les
  seize cas courants concordent et que l’absence de gate bloquante reste la limite observable.

La répartition ci-dessus résout ces recouvrements. Une synthèse peut rappeler une garantie ou une limite,
mais les formules, seuils, contrats, statuts, dates et preuves restent dans leur autorité spécialisée.

Le test de traçabilité du corpus est redirigé vers ces autorités : il continue de contrôler les dérivations,
le standard, le rapport, le changelog et les attentes du backlog, et vérifie en plus que le README,
l’architecture, le standard, le guide du corpus et le guide de classification ne réintroduisent pas un
journal PBI. Cette adaptation est nécessaire pour contrôler la nouvelle séparation sans affaiblir la preuve
statistique ni ses gates.

## Règle sur les références PBI

Les numéros de PBI sont conservés dans le registre, sa gouvernance, les attendus détaillés, le changelog,
les audits, les rapports de preuve et les matrices qui pilotent explicitement un traitement futur. Ils ne
figurent pas dans les documents permanents lorsqu’ils n’apportent qu’une chronologie de fabrication.

Cette séparation ne change aucun statut : la colonne `Réalisé le` de [`backlog.md`](backlog.md) reste
l’unique autorité de réalisation.

## Inventaire fichier par fichier

| Fichier | Audience | Rôle et autorité | Orientation |
| --- | --- | --- | --- |
| [`../README.md`](../README.md) | Découverte, utilisateurs, contributeurs | Synthèse d’entrée ; aucune autorité de formule, statut ou historique | Produit |
| [`../PRODUCT.md`](../PRODUCT.md) | Décideurs, sponsors, utilisateurs | Autorité de vision, positionnement, cas d’usage et valeur | Produit |
| [`roadmap.md`](roadmap.md) | Décideurs produit | Autorité des horizons de valeur, sans calendrier | Produit |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Développeurs, exploitants | Autorité des frontières, composants, flux et contrats applicatifs | Technique |
| [`frontend-responsibilities-map.md`](frontend-responsibilities-map.md) | Développeurs frontend, architectes | Cartographie vérifiable des propriétaires, transformations, stockages, flux et couplages frontend actuels | Technique |
| [`../frontend/README.md`](../frontend/README.md) | Développeurs frontend | Guide de démarrage et frontières frontend | Technique |
| [`deployment.md`](deployment.md) | Exploitants | Procédure de déploiement et d’exploitation | Technique |
| [`maintainability.md`](maintainability.md) | Mainteneurs | Procédure et règles du ratchet | Gouvernance |
| [`backlog.md`](backlog.md) | Pilotage produit | Autorité des outcomes, statuts, dates, complexités et modèles | Gouvernance |
| [`backlog-governance.md`](backlog-governance.md) | Pilotage et contributeurs | Autorité des règles, priorités, dépendances et générations du backlog | Gouvernance |
| [`backlog-expectations/README.md`](backlog-expectations/README.md) | Product owner, réalisateurs | Index des attendus ; sans autorité de statut | Chantier |
| [`backlog-expectations/feature-01-quality-governance.md`](backlog-expectations/feature-01-quality-governance.md) | Product owner, qualité | Attendus détaillés de la Feature 1 | Chantier |
| [`backlog-expectations/feature-02-statistical-core.md`](backlog-expectations/feature-02-statistical-core.md) | Product owner, statistique | Attendus, décisions et preuves de la Feature 2 | Chantier |
| [`backlog-expectations/feature-03-reusable-engine.md`](backlog-expectations/feature-03-reusable-engine.md) | Product owner, intégrateurs | Attendus détaillés de la Feature 3 | Chantier |
| [`backlog-expectations/feature-04-personal-production.md`](backlog-expectations/feature-04-personal-production.md) | Product owner, exploitation | Attendus détaillés de la Feature 4 | Chantier |
| [`backlog-expectations/feature-05-portfolio-value.md`](backlog-expectations/feature-05-portfolio-value.md) | Product owner, recherche utilisateur | Mesures attendues de la Feature 5 | Chantier |
| [`backlog-expectations/feature-06-operational-quality.md`](backlog-expectations/feature-06-operational-quality.md) | Product owner, qualité | Bornes de preuve attendues de la Feature 6 | Chantier |
| [`backlog-expectations/feature-07-evolvable-architecture.md`](backlog-expectations/feature-07-evolvable-architecture.md) | Product owner, architecture | Attendus détaillés de la Feature 7 | Chantier |
| [`backlog-expectations/feature-08-azure-devops-data.md`](backlog-expectations/feature-08-azure-devops-data.md) | Product owner, données | Attendus détaillés de la Feature 8 | Chantier |
| [`backlog-expectations/feature-09-forecast-calibration.md`](backlog-expectations/feature-09-forecast-calibration.md) | Product owner, statistique | Protocole et preuves attendus de la Feature 9 | Chantier |
| [`backlog-expectations/feature-10-simulation-experience.md`](backlog-expectations/feature-10-simulation-experience.md) | Product owner, UX | Périmètre d’expérience et de restitution de la Feature 10 | Chantier |
| [`backlog-expectations/feature-11-scalability.md`](backlog-expectations/feature-11-scalability.md) | Product owner, exploitation | Mesures, décisions et limites attendues de la Feature 11 | Chantier |
| [`backlog-expectations/feature-12-program-management.md`](backlog-expectations/feature-12-program-management.md) | Product owner, programme | Attendus détaillés de la Feature 12 | Chantier |
| [`backlog-expectations/feature-13-technical-governance.md`](backlog-expectations/feature-13-technical-governance.md) | Product owner, qualité | Attendus et preuves de cadrage de la Feature 13 | Chantier |
| [`backlog-expectations/feature-14-distribution-strategy.md`](backlog-expectations/feature-14-distribution-strategy.md) | Product owner, stratégie | Décisions et preuves attendues de la Feature 14 | Chantier |
| [`backlog-expectations/conditional-topics.md`](backlog-expectations/conditional-topics.md) | Product owner | Sujets conditionnels hors registre engagé | Chantier |
| [`standards/STD-STAT-001.md`](standards/STD-STAT-001.md) | Statistique, développement | Autorité normative du contrat statistique | Norme |
| [`statistical-reference-corpus.md`](statistical-reference-corpus.md) | Statistique, développement | Guide du corpus ; les JSON liés sont les autorités machine | Contrat |
| [`statistical-distribution-protocol.md`](statistical-distribution-protocol.md) | Statistique, développement | Protocole distributionnel, calibration, décisions et limites | Contrat |
| [`statistical-compatibility.md`](statistical-compatibility.md) | Statistique, architecture, qualité | Surfaces, empreintes, décisions et traitements historiques de compatibilité | Contrat de preuve |
| [`statistical-consolidated-report.md`](statistical-consolidated-report.md) | Reviewers, statistique, qualité | Sources, règle de verdict, déterminisme et limites du rapport consolidé | Contrat de preuve |
| [`statistical-main-enforcement.md`](statistical-main-enforcement.md) | Développement, statistique, qualité | Autorité opératoire du sous-DAG statistique bloquant de `main` | Gouvernance |
| [`statistical-parity-audit.md`](statistical-parity-audit.md) | Reviewers, statistique | Relevé historique des divergences et décisions ouvertes | Preuve historique |
| [`standards/STD-TEST-001.md`](standards/STD-TEST-001.md) | Qualité, développement | Autorité normative de la stratégie de test | Norme |
| [`test-classification.md`](test-classification.md) | Qualité, développement | Application opératoire du modèle de classification | Contrat |
| [`definition-of-done.md`](definition-of-done.md) | Contributeurs | Autorité des gates, de la DoD et de la publiabilité | Gouvernance |
| [`risk-control-matrix.md`](risk-control-matrix.md) | Qualité, sécurité | Autorité de l’état de maîtrise des risques à sa date d’observation | Preuve |
| [`critical-paths.md`](critical-paths.md) | Qualité, produit | Autorité de la liste des parcours vitaux et candidats | Gouvernance |
| [`vitals-traceability.md`](vitals-traceability.md) | Qualité | Autorité de la traçabilité humaine des preuves Vitals | Preuve |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Utilisateurs, mainteneurs | Autorité de l’historique des changements | Historique |
| [`../reports/statistical-parity-report.md`](../reports/statistical-parity-report.md) | Reviewers, statistique | Rendu généré de l’état de parité ; le JSON associé est exploitable en CI | Preuve générée |
| [`../reports/statistical-exact-replay-evidence.json`](../reports/statistical-exact-replay-evidence.json) | Reviewers, statistique | Preuve JSON régénérable du rejeu exact et de l’indépendance du batching | Preuve générée |
| [`../reports/statistical-distribution-calibration.json`](../reports/statistical-distribution-calibration.json) | Reviewers, statistique | Calibration reproductible des faux positifs, tailles et écarts contrôlés | Preuve générée |
| [`../reports/statistical-distribution-evidence.json`](../reports/statistical-distribution-evidence.json) | Reviewers, statistique | Preuve JSON multi-seeds et verdict distributionnel ciblé | Preuve générée |
| [`../reports/statistical-compatibility-evidence.json`](../reports/statistical-compatibility-evidence.json) | Reviewers, statistique, qualité | Preuve canonique des versions, empreintes, décisions et traitements historiques | Preuve générée |
| [`../reports/statistical-consolidated-report.json`](../reports/statistical-consolidated-report.json) et [`../reports/statistical-consolidated-report.md`](../reports/statistical-consolidated-report.md) | Reviewers, statistique, qualité | Autorité machine consolidée et projection Markdown issue du même modèle | Preuve générée |
| [`../reports/test-strategy-report.md`](../reports/test-strategy-report.md) | Reviewers, qualité | Rendu généré de la stratégie de test ; le JSON associé est contractuel | Preuve générée |
| [`../AGENTS.md`](../AGENTS.md) | Agents de contribution | Instructions locales contraignantes, hors documentation produit | Gouvernance |
| [`README.md`](README.md) | Toute audience documentaire | Présente carte et index faisant autorité pour la répartition documentaire | Gouvernance documentaire |

## Inventaire et parcours

### Découvrir et décider

- [`../README.md`](../README.md) — synthèse produit, capacités, limites, usage et parcours ;
- [`../PRODUCT.md`](../PRODUCT.md) — vision, positionnement, utilisateurs, valeur et cas d’usage ;
- [`roadmap.md`](roadmap.md) — horizons de valeur déjà livré, maintenant, ensuite et plus tard.

### Piloter les outcomes futurs

- [`backlog.md`](backlog.md) — registre des 14 Features et de leurs PBI ;
- [`backlog-governance.md`](backlog-governance.md) — règles transverses et sections générées ;
- [`backlog-expectations/README.md`](backlog-expectations/README.md) — index des attendus détaillés ;
- [`backlog-expectations/feature-01-quality-governance.md`](backlog-expectations/feature-01-quality-governance.md) ;
- [`backlog-expectations/feature-02-statistical-core.md`](backlog-expectations/feature-02-statistical-core.md) ;
- [`backlog-expectations/feature-03-reusable-engine.md`](backlog-expectations/feature-03-reusable-engine.md) ;
- [`backlog-expectations/feature-04-personal-production.md`](backlog-expectations/feature-04-personal-production.md) ;
- [`backlog-expectations/feature-05-portfolio-value.md`](backlog-expectations/feature-05-portfolio-value.md) ;
- [`backlog-expectations/feature-06-operational-quality.md`](backlog-expectations/feature-06-operational-quality.md) ;
- [`backlog-expectations/feature-07-evolvable-architecture.md`](backlog-expectations/feature-07-evolvable-architecture.md) ;
- [`backlog-expectations/feature-08-azure-devops-data.md`](backlog-expectations/feature-08-azure-devops-data.md) ;
- [`backlog-expectations/feature-09-forecast-calibration.md`](backlog-expectations/feature-09-forecast-calibration.md) ;
- [`backlog-expectations/feature-10-simulation-experience.md`](backlog-expectations/feature-10-simulation-experience.md) ;
- [`backlog-expectations/feature-11-scalability.md`](backlog-expectations/feature-11-scalability.md) ;
- [`backlog-expectations/feature-12-program-management.md`](backlog-expectations/feature-12-program-management.md) ;
- [`backlog-expectations/feature-13-technical-governance.md`](backlog-expectations/feature-13-technical-governance.md) ;
- [`backlog-expectations/feature-14-distribution-strategy.md`](backlog-expectations/feature-14-distribution-strategy.md) ;
- [`backlog-expectations/conditional-topics.md`](backlog-expectations/conditional-topics.md) — sujets non
  comptabilisés comme PBI engagés.

### Comprendre et exploiter le système

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — architecture, sécurité, flux, API et contrats de persistance ;
- [`frontend-responsibilities-map.md`](frontend-responsibilities-map.md) — responsabilités, flux, stockages,
  transformations et couplages observés dans le frontend actuel ;
- [`../frontend/README.md`](../frontend/README.md) — démarrage et frontières propres au frontend ;
- [`deployment.md`](deployment.md) — déploiement et exploitation ;
- [`maintainability.md`](maintainability.md) — ratchet de maintenabilité.

### Vérifier les contrats et la qualité

- [`standards/STD-STAT-001.md`](standards/STD-STAT-001.md) — norme statistique ;
- [`statistical-reference-corpus.md`](statistical-reference-corpus.md) — corpus et dérivations ;
- [`statistical-distribution-protocol.md`](statistical-distribution-protocol.md) — protocole multi-seeds,
  calibration et interprétation des verdicts ;
- [`statistical-compatibility.md`](statistical-compatibility.md) — inventaire des surfaces normatives,
  extraction sémantique, décisions et traitements des données antérieures ;
- [`statistical-consolidated-report.md`](statistical-consolidated-report.md) — sources, verdicts, intégrité
  et limites de l’autorité consolidée ;
- [`statistical-main-enforcement.md`](statistical-main-enforcement.md) — politique fermée, attestations,
  DAG, isolation, diagnostics et alignement local/CI ;
- [`statistical-parity-audit.md`](statistical-parity-audit.md) — audit historique de parité ;
- [`standards/STD-TEST-001.md`](standards/STD-TEST-001.md) — norme de test ;
- [`test-classification.md`](test-classification.md) — application de la classification ;
- [`definition-of-done.md`](definition-of-done.md) — gate complète et DoD ;
- [`risk-control-matrix.md`](risk-control-matrix.md) — état des risques ;
- [`critical-paths.md`](critical-paths.md) — parcours vitaux ;
- [`vitals-traceability.md`](vitals-traceability.md) — preuves de couverture ;
- [`../reports/statistical-parity-report.md`](../reports/statistical-parity-report.md) et
  [`../reports/statistical-exact-replay-evidence.json`](../reports/statistical-exact-replay-evidence.json),
  [`../reports/statistical-distribution-evidence.json`](../reports/statistical-distribution-evidence.json) —
  preuves statistiques générées ;
- [`../reports/statistical-compatibility-evidence.json`](../reports/statistical-compatibility-evidence.json) —
  état canonique de compatibilité ;
- [`../reports/statistical-consolidated-report.json`](../reports/statistical-consolidated-report.json) et
  [`../reports/statistical-consolidated-report.md`](../reports/statistical-consolidated-report.md) — état
  consolidé machine et synthèse reviewer ;
- [`../reports/test-strategy-report.md`](../reports/test-strategy-report.md) — rendu qualité généré, non
  autorité éditoriale.

### Lire l’historique et les règles de contribution

- [`../CHANGELOG.md`](../CHANGELOG.md) — historique des évolutions ;
- [`../AGENTS.md`](../AGENTS.md) — instructions locales destinées aux agents de contribution, hors
  documentation produit.
