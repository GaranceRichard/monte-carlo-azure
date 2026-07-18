# Traçabilité des Vitals

Ce document relie chaque point vital officiel à ses preuves de test et décrit la consommation des artefacts
de couverture. La sélection machine des fichiers sources reste définie dans
[`vitals-coverage-map.json`](vitals-coverage-map.json).

## Règles de collecte et de validité

- Chaque point vital possède au moins un test ciblé référencé ici, et chaque chemin référencé existe dans le
  dépôt.
- `.coverage.python.json` fournit le périmètre Python complet ; la carte Vitals y consomme les métriques
  des sources backend concernées.
- `frontend/coverage/coverage-final.json` fournit les métriques frontend unitaires.
- `frontend/coverage/e2e-coverage-summary.json` fournit les métriques E2E par fichier.
- `frontend/coverage/vitals-coverage-report.json` agrège ces sources une seule fois ; le contrôle de
  conformité réutilise ce rapport sans recalculer les mêmes données.
- Le rapport agrégé enregistre la taille et la date de modification de chaque source. Une source modifiée,
  absente ou remplacée rend le rapport périmé.
- L’artefact E2E doit respecter son schéma, contenir les quatre métriques, correspondre au `runId` et aux
  timestamps courants, ainsi qu’à l’identifiant et au fingerprint du périmètre configuré.
- Pour une métrique par fichier sans élément mesurable, Istanbul produit et le validateur conserve
  `total = covered = skipped = 0` avec `pct = 100`. Une valeur globale sous le seuil n’est jamais masquée
  par cette règle.

La task `Coverage: 8 terminaux` enchaîne les scripts PowerShell versionnés de couverture et de Vitals, puis
le contrôle de convention de nommage. Les taux Vitals minimaux restent fixés à 95 %.

## Matrice officielle

### SLA Identité

Définition : aucune donnée d’identification Azure DevOps (`PAT`, `UUID`, `ORG`, `Team`) ne transite par un
serveur applicatif.

Parcours : `CP-001`.

Risques traités : `RISK-001`.

Niveaux de preuve démontrables : unitaire, composant, E2E simulé et contrôle statique de dépôt.

Finalités actuellement couvertes : fonctionnel, sécurité et confidentialité de la frontière d'identité.

Tests ciblés :

- `tests/test_identity_boundary.py`
- `frontend/src/hooks/Simulationforecastservice.test.tsx`
- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/coverage.spec.js`

Sources de couverture configurées : `frontend/src/hooks/simulationForecastService.ts`,
`frontend/src/hooks/simulationForecastCore.ts` et, pour l'E2E, `frontend/src/api.ts`. La référence antérieure à
`frontend/src/hooks/simulationForecastCore.ts` dans la liste des tests était invalide comme preuve de test :
c'est une source mesurée, désormais décrite comme telle.

### Cookie `IDMontecarlo`

Définition : le cookie `IDMontecarlo` ne doit jamais transiter vers `dev.azure.com` ou
`app.vssps.visualstudio.com`.

Parcours : `CP-002`.

Risques traités : `RISK-002`.

Niveaux de preuve démontrables : unitaire et E2E simulé.

Finalités actuellement couvertes : fonctionnel, sécurité et confidentialité.

Tests ciblés :

- `frontend/src/clientId.test.ts`
- `frontend/tests/e2e/coverage.spec.js`

Sources de couverture configurées : `frontend/src/clientId.ts` en unitaire et E2E, ainsi que
`backend/api_routes_simulate.py` pour la lecture du cookie côté backend.

### Endpoint backend `POST /simulate`

Définition : l’endpoint `POST /simulate` reste valide, robuste et déterministe sur les erreurs.

Parcours : `CP-003`.

Risques traités : `RISK-003`, `RISK-004`, `RISK-005`, `RISK-011`, `RISK-013`, `RISK-016`, `RISK-017`.

Niveaux de preuve démontrables : unitaire du moteur, composant/API, contrat par validation Pydantic et
intégration MongoDB conditionnelle.

Finalités actuellement couvertes : fonctionnel, sécurité de contrat, robustesse, résilience partielle et
performance bornée; aucune preuve de charge n'est revendiquée.

Tests ciblés :

- `tests/test_api_simulate.py`
- `tests/test_api_history.py`

Sources de couverture configurées : `backend/api_routes_simulate.py` et `backend/mc_core.py`.

### Flux onboarding critique

Définition : le flux `PAT` → organisation → projet → équipe reste fonctionnel.

Parcours : `CP-004`.

Risques traités : `RISK-001`, `RISK-002`, `RISK-006`, `RISK-007`, `RISK-018`, `RISK-019`.

Niveaux de preuve démontrables : unitaire, composant/hook et E2E avec services Azure DevOps simulés.

Finalités actuellement couvertes : fonctionnel, sécurité, gestion d'erreur, accessibilité ponctuelle au
clavier et compatibilité logique Cloud/on-premise. Aucune compatibilité réelle multi-plateforme n'est déduite.

Tests ciblés :

- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/selection.spec.js`
- `frontend/src/hooks/useOnboarding.test.tsx`
- `frontend/src/App.test.tsx`
- `frontend/src/AppFlowContent.test.tsx`
- `frontend/tests/e2e/coverage.spec.js`

Sources de couverture configurées : `frontend/src/App.tsx` et `frontend/src/hooks/useOnboarding.ts`.

### Export de rapport simulation ou portefeuille (`SVG`/`PDF`)

Définition : la génération des rapports simulation et portefeuille reste stable et non régressive, avec un
téléchargement PDF direct sans prévisualisation SVG exposée à l’utilisateur.

Parcours : `CP-005`.

Risques traités : `RISK-004`, `RISK-008`, `RISK-009`, `RISK-010`, `RISK-018`, `RISK-019`.

Niveaux de preuve démontrables : unitaire, composant et E2E du déclenchement. Les tests qui doublent `jsPDF`
ne sont pas assimilés à une validation d'un fichier PDF réel.

Finalités actuellement couvertes : fonctionnel, robustesse de génération, cohérence de présentation partielle,
accessibilité sémantique partielle et compatibilité du repli de téléchargement.

Tests ciblés :

- `frontend/src/components/steps/simulationPrintReport.test.ts`
- `frontend/src/components/steps/simulationExportModules.test.ts`
- `frontend/src/components/steps/simulationPdfDownload.fallback.test.ts`
- `frontend/src/components/steps/portfolioPrintReport.test.ts`
- `frontend/src/components/steps/SimulationChartTabs.test.tsx`
- `frontend/tests/e2e/coverage.spec.js`

Sources de couverture configurées : `frontend/src/components/steps/simulationPrintReport.tsx`,
`frontend/src/components/steps/simulationPdfDownload.ts` et
`frontend/src/components/steps/portfolioPrintReport.ts`.

Contrôle local recommandé : lancer la task `Coverage: 8 terminaux`. Les scripts Vitals peuvent aussi être
appelés séparément pour diagnostiquer un artefact déjà produit, mais cela ne remplace pas la validation
complète.
