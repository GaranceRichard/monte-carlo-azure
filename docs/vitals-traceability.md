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

Tests ciblés :

- `frontend/src/hooks/Simulationforecastservice.test.tsx`
- `frontend/src/hooks/simulationForecastCore.ts`
- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/coverage.spec.js`

Le wrapper `frontend/src/hooks/simulationForecastService.ts` reste dans le périmètre vital, tandis que la
logique de branches frontend unitaires est portée par `frontend/src/hooks/simulationForecastCore.ts`.

### Cookie `IDMontecarlo`

Définition : le cookie `IDMontecarlo` ne doit jamais transiter vers `dev.azure.com` ou
`app.vssps.visualstudio.com`.

Tests ciblés :

- `frontend/src/clientId.test.ts`
- `frontend/tests/e2e/coverage.spec.js`

### Endpoint backend `POST /simulate`

Définition : l’endpoint `POST /simulate` reste valide, robuste et déterministe sur les erreurs.

Tests ciblés :

- `tests/test_api_simulate.py`
- `tests/test_api_history.py`

### Flux onboarding critique

Définition : le flux `PAT` → organisation → projet → équipe reste fonctionnel.

Tests ciblés :

- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/selection.spec.js`
- `frontend/src/hooks/useOnboarding.test.tsx`
- `frontend/src/App.test.tsx`
- `frontend/src/AppFlowContent.test.tsx`
- `frontend/tests/e2e/coverage.spec.js`

### Export de rapport simulation ou portefeuille (`SVG`/`PDF`)

Définition : la génération des rapports simulation et portefeuille reste stable et non régressive, avec un
téléchargement PDF direct sans prévisualisation SVG exposée à l’utilisateur.

Tests ciblés :

- `frontend/src/components/steps/simulationPrintReport.test.ts`
- `frontend/src/components/steps/simulationExportModules.test.ts`
- `frontend/src/components/steps/simulationPdfDownload.fallback.test.ts`
- `frontend/src/components/steps/portfolioPrintReport.test.ts`
- `frontend/src/components/steps/SimulationChartTabs.test.tsx`
- `frontend/tests/e2e/coverage.spec.js`

Contrôle local recommandé : lancer la task `Coverage: 8 terminaux`. Les scripts Vitals peuvent aussi être
appelés séparément pour diagnostiquer un artefact déjà produit, mais cela ne remplace pas la validation
complète.
