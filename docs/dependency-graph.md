# Graphe factuel des dépendances

> Généré par `Scripts/report_dependency_graph.py` ; ne pas éditer manuellement.

## Portée et reproduction

Le graphe part des fichiers visibles par Git, exclut les tests et sépare les imports runtime des imports TypeScript de type. Il observe le code produit (`backend`, `frontend/src`, `run_app.py`) et l’infrastructure exécutable (`Scripts`, `frontend/scripts`).

```powershell
.\.venv\Scripts\python.exe Scripts/report_dependency_graph.py
.\.venv\Scripts\python.exe Scripts/report_dependency_graph.py --check
```

## Observations

| Modules | Arêtes | Points d’entrée | Entrées non résolues | Cycles | Cycles runtime | Imports profonds | Contournements conventionnels |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 244 | 1280 | 82 | 5 | 2 | 0 | 119 | 2 |

### Directions observées

| Source | Cible | Phase | Arêtes |
| --- | --- | --- | --- |
| backend | backend | runtime | 37 |
| frontend | frontend | compile | 85 |
| frontend | frontend | runtime | 146 |
| launcher | backend | runtime | 1 |
| quality | backend | runtime | 5 |
| quality | frontend | runtime | 3 |
| quality | quality | runtime | 232 |

### Cycles localisés

#### CYC-001 — compile-involved

frontend/src/demoData.ts → frontend/src/hooks/usePortfolioReport.ts → frontend/src/hooks/simulationForecastService.ts → frontend/src/hooks/simulationForecastCore.ts → frontend/src/demoData.ts

| Source | Cible | Ligne | Phase |
| --- | --- | --- | --- |
| frontend/src/demoData.ts | frontend/src/hooks/usePortfolioReport.ts | 3 | compile |
| frontend/src/hooks/usePortfolioReport.ts | frontend/src/hooks/simulationForecastService.ts | 7 | runtime |
| frontend/src/hooks/simulationForecastService.ts | frontend/src/hooks/simulationForecastCore.ts | 3 | runtime |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/demoData.ts | 8 | runtime |

#### CYC-002 — compile-involved

frontend/src/hooks/simulationForecastCore.ts → frontend/src/hooks/simulationForecastService.ts → frontend/src/hooks/simulationForecastCore.ts

| Source | Cible | Ligne | Phase |
| --- | --- | --- | --- |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/hooks/simulationForecastService.ts | 19 | compile |
| frontend/src/hooks/simulationForecastService.ts | frontend/src/hooks/simulationForecastCore.ts | 3 | runtime |

### Points d’entrée

| Déclaré dans | Ligne | Nature | Cible | Résolution |
| --- | --- | --- | --- | --- |
| .githooks/pre-commit | 17 | executable-reference | Scripts/quality_gate.py | internal |
| .githooks/pre-push | 17 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 59 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 83 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 112 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 148 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 174 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 206 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 231 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 256 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 292 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 328 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 364 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 399 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 434 | executable-reference | Scripts/quality_gate.py | internal |
| .github/workflows/ci.yml | 508 | executable-reference | Scripts/quality_gate.py | internal |
| .vscode/tasks.json | 29 | executable-reference | missing:start-mongo-dev.ps1 | missing |
| .vscode/tasks.json | 64 | executable-reference | run_app.py | internal |
| .vscode/tasks.json | 95 | executable-reference | missing:health-watch.ps1 | missing |
| .vscode/tasks.json | 123 | executable-reference | missing:health-watch.ps1 | missing |
| .vscode/tasks.json | 148 | executable-reference | Scripts/quality_gate.py | internal |
| .vscode/tasks.json | 172 | executable-reference | missing:run-front-coverage-staged.ps1 | missing |
| .vscode/tasks.json | 241 | executable-reference | .vscode/scripts/run-e2e-coverage.ps1 | internal |
| .vscode/tasks.json | 264 | executable-reference | .vscode/scripts/run-vitals-compliance.ps1 | internal |
| .vscode/tasks.json | 287 | executable-reference | .vscode/scripts/run-vitals-coverage.ps1 | internal |
| .vscode/tasks.json | 306 | executable-reference | Scripts/check_naming_convention.py | internal |
| Dockerfile | 25 | python-module-entrypoint | backend/api.py | internal |
| MonteCarloADO.spec | 5 | executable-reference | run_app.py | internal |
| Scripts/calibrate_statistical_distribution.py | 63 | python-main-guard | Scripts/calibrate_statistical_distribution.py | internal |
| Scripts/check_backlog_atomicity.py | 61 | python-main-guard | Scripts/check_backlog_atomicity.py | internal |
| Scripts/check_backlog_consistency.py | 284 | python-main-guard | Scripts/check_backlog_consistency.py | internal |
| Scripts/check_dod_compliance.py | 404 | python-main-guard | Scripts/check_dod_compliance.py | internal |
| Scripts/check_e2e_coverage.py | 367 | python-main-guard | Scripts/check_e2e_coverage.py | internal |
| Scripts/check_identity_boundary.py | 505 | python-main-guard | Scripts/check_identity_boundary.py | internal |
| Scripts/check_maintainability.py | 148 | python-main-guard | Scripts/check_maintainability.py | internal |
| Scripts/check_naming_convention.py | 180 | python-main-guard | Scripts/check_naming_convention.py | internal |
| Scripts/check_no_secrets.py | 301 | python-main-guard | Scripts/check_no_secrets.py | internal |
| Scripts/check_python_coverage.py | 170 | python-main-guard | Scripts/check_python_coverage.py | internal |
| Scripts/check_test_classification.py | 32 | python-main-guard | Scripts/check_test_classification.py | internal |
| Scripts/check_test_governance.py | 113 | python-main-guard | Scripts/check_test_governance.py | internal |
| Scripts/check_vitals_compliance.py | 191 | python-main-guard | Scripts/check_vitals_compliance.py | internal |
| Scripts/classify_tests.py | 105 | python-main-guard | Scripts/classify_tests.py | internal |
| Scripts/generate_statistical_consolidated_report.py | 81 | python-main-guard | Scripts/generate_statistical_consolidated_report.py | internal |
| Scripts/pre_commit_guard.py | 293 | python-main-guard | Scripts/pre_commit_guard.py | internal |
| Scripts/purge_inactive_clients.py | 47 | python-main-guard | Scripts/purge_inactive_clients.py | internal |
| Scripts/quality_gate.py | 1634 | python-main-guard | Scripts/quality_gate.py | internal |
| Scripts/report_dependency_graph.py | 276 | python-main-guard | Scripts/report_dependency_graph.py | internal |
| Scripts/report_test_execution_counts.py | 359 | python-main-guard | Scripts/report_test_execution_counts.py | internal |
| Scripts/report_test_strategy.py | 502 | python-main-guard | Scripts/report_test_strategy.py | internal |
| Scripts/report_vitals_coverage.py | 367 | python-main-guard | Scripts/report_vitals_coverage.py | internal |
| Scripts/run_statistical_compatibility.py | 111 | python-main-guard | Scripts/run_statistical_compatibility.py | internal |
| Scripts/run_statistical_distribution.py | 102 | python-main-guard | Scripts/run_statistical_distribution.py | internal |
| Scripts/run_statistical_exact_replay.py | 326 | python-main-guard | Scripts/run_statistical_exact_replay.py | internal |
| Scripts/run_statistical_reference_corpus.py | 219 | python-main-guard | Scripts/run_statistical_reference_corpus.py | internal |
| Scripts/scrub_simulation_identity.py | 98 | python-main-guard | Scripts/scrub_simulation_identity.py | internal |
| Scripts/setup_git_hooks.py | 30 | python-main-guard | Scripts/setup_git_hooks.py | internal |
| Scripts/statistical_main_enforcement.py | 219 | python-main-guard | Scripts/statistical_main_enforcement.py | internal |
| Scripts/test_execution_profiles.py | 255 | python-main-guard | Scripts/test_execution_profiles.py | internal |
| Scripts/validate_statistical_compatibility_evidence.py | 62 | python-main-guard | Scripts/validate_statistical_compatibility_evidence.py | internal |
| Scripts/validate_statistical_consolidated_report.py | 84 | python-main-guard | Scripts/validate_statistical_consolidated_report.py | internal |
| Scripts/validate_statistical_distribution_calibration.py | 70 | python-main-guard | Scripts/validate_statistical_distribution_calibration.py | internal |
| Scripts/validate_statistical_distribution_evidence.py | 43 | python-main-guard | Scripts/validate_statistical_distribution_evidence.py | internal |
| Scripts/validate_statistical_distribution_protocol.py | 53 | python-main-guard | Scripts/validate_statistical_distribution_protocol.py | internal |
| Scripts/validate_statistical_reference_corpus.py | 452 | python-main-guard | Scripts/validate_statistical_reference_corpus.py | internal |
| frontend/index.html | 21 | executable-reference | frontend/src/main.tsx | internal |
| frontend/package.json | 7 | npm-script | external:command:vite | external |
| frontend/package.json | 8 | npm-script | external:command:node | external |
| frontend/package.json | 9 | npm-script | external:command:vite | external |
| frontend/package.json | 10 | npm-script | external:command:tsc | external |
| frontend/package.json | 11 | npm-script | external:command:eslint | external |
| frontend/package.json | 12 | npm-script | external:command:vite | external |
| frontend/package.json | 13 | npm-script | external:command:vitest | external |
| frontend/package.json | 14 | npm-script | external:command:vitest | external |
| frontend/package.json | 15 | npm-script | external:command:vitest | external |
| frontend/package.json | 16 | npm-script | frontend/scripts/run-statistical-reference-corpus.mjs | internal |
| frontend/package.json | 17 | npm-script | frontend/scripts/run-e2e-coverage.mjs | internal |
| frontend/package.json | 18 | npm-script | external:command:npm | external |
| frontend/package.json | 19 | npm-script | frontend/scripts/run-e2e-coverage.mjs | internal |
| run_app.py | 62 | python-main-guard | run_app.py | internal |
| start-dev.ps1 | 57 | executable-reference | missing:.vscode/scripts/start-mongo-dev.ps1 | missing |
| start-dev.ps1 | 59 | executable-reference | run_app.py | internal |
| start-dev.ps1 | 86 | executable-reference | run_app.py | internal |

## Interprétation architecturale (non normative)

A deep import crosses into a nested source directory; a bypass targets a same-name directory while a sibling facade file exists.

Ces listes signalent des surfaces à examiner ; elles ne déclarent ni dépendance autorisée/interdite ni correction à réaliser.

### Contournements conventionnels

| Source | Cible | Ligne | Phase | Façade contournée |
| --- | --- | --- | --- | --- |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/api/simulationMappers.ts | 4 | runtime | frontend/src/api.ts |
| frontend/src/hooks/useSimulationHistory.ts | frontend/src/storage/simulationHistoryMappers.ts | 3 | runtime | frontend/src/storage.ts |

### Imports profonds

| Source | Cible | Ligne | Phase | Frontière traversée |
| --- | --- | --- | --- | --- |
| frontend/src/App.tsx | frontend/src/components/AppHeader.tsx | 2 | runtime | frontend/src/components |
| frontend/src/App.tsx | frontend/src/hooks/useOnboarding.ts | 4 | runtime | frontend/src/hooks |
| frontend/src/App.tsx | frontend/src/hooks/useSimulation.ts | 5 | runtime | frontend/src/hooks |
| frontend/src/AppFlowContent.tsx | frontend/src/components/steps/OrgStep.tsx | 2 | runtime | frontend/src/components |
| frontend/src/AppFlowContent.tsx | frontend/src/components/steps/PatStep.tsx | 3 | runtime | frontend/src/components |
| frontend/src/AppFlowContent.tsx | frontend/src/components/steps/PortfolioStep.tsx | 11 | runtime | frontend/src/components |
| frontend/src/AppFlowContent.tsx | frontend/src/components/steps/ProjectStep.tsx | 4 | runtime | frontend/src/components |
| frontend/src/AppFlowContent.tsx | frontend/src/components/steps/SimulationStep.tsx | 10 | runtime | frontend/src/components |
| frontend/src/AppFlowContent.tsx | frontend/src/components/steps/TeamStep.tsx | 5 | runtime | frontend/src/components |
| frontend/src/AppFlowContent.tsx | frontend/src/hooks/useOnboarding.ts | 6 | compile | frontend/src/hooks |
| frontend/src/AppFlowContent.tsx | frontend/src/hooks/useSimulation.ts | 7 | compile | frontend/src/hooks |
| frontend/src/adapters/seededSampleIndexDrawPort.ts | frontend/src/domain/sampleIndexDrawPort.ts | 1 | compile | frontend/src/domain |
| frontend/src/adapters/seededSampleIndexDrawPort.ts | frontend/src/domain/simulationValueObjects.ts | 2 | compile | frontend/src/domain |
| frontend/src/adoClient.ts | frontend/src/utils/cycleTime.ts | 16 | runtime | frontend/src/utils |
| frontend/src/api.ts | frontend/src/api/simulationDtos.ts | 6 | compile | frontend/src/api |
| frontend/src/api/simulationMappers.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/api/simulationMappers.ts | frontend/src/domain/simulationValueObjects.ts | 6 | runtime | frontend/src/domain |
| frontend/src/appShellSections.tsx | frontend/src/components/PublicConnectNotice.tsx | 2 | runtime | frontend/src/components |
| frontend/src/components/steps/DecisionDiagnostic.tsx | frontend/src/utils/decisionLanguage.ts | 2 | compile | frontend/src/utils |
| frontend/src/components/steps/OrgStep.tsx | frontend/src/utils/selectTopStart.ts | 4 | runtime | frontend/src/utils |
| frontend/src/components/steps/PortfolioStep.tsx | frontend/src/hooks/usePortfolio.ts | 11 | runtime | frontend/src/hooks |
| frontend/src/components/steps/PortfolioStep.tsx | frontend/src/utils/portfolioComparisonPresentation.ts | 12 | runtime | frontend/src/utils |
| frontend/src/components/steps/PortfolioStep.tsx | frontend/src/utils/selectTopStart.ts | 1 | runtime | frontend/src/utils |
| frontend/src/components/steps/ProjectStep.tsx | frontend/src/utils/selectTopStart.ts | 3 | runtime | frontend/src/utils |
| frontend/src/components/steps/SimulationChartTabs.tsx | frontend/src/components/ui/tabs.tsx | 16 | runtime | frontend/src/components |
| frontend/src/components/steps/SimulationChartTabs.tsx | frontend/src/hooks/SimulationContext.tsx | 17 | runtime | frontend/src/hooks |
| frontend/src/components/steps/SimulationChartTabs.tsx | frontend/src/utils/simulation.ts | 18 | runtime | frontend/src/utils |
| frontend/src/components/steps/SimulationChartTabs.tsx | frontend/src/utils/simulationDecisionDiagnostic.ts | 19 | runtime | frontend/src/utils |
| frontend/src/components/steps/SimulationControlPanel.tsx | frontend/src/hooks/SimulationContext.tsx | 5 | runtime | frontend/src/hooks |
| frontend/src/components/steps/SimulationFilterControls.tsx | frontend/src/hooks/SimulationContext.tsx | 1 | runtime | frontend/src/hooks |
| frontend/src/components/steps/SimulationHistoryRangeControls.tsx | frontend/src/hooks/SimulationContext.tsx | 1 | runtime | frontend/src/hooks |
| frontend/src/components/steps/SimulationModeAndParametersControls.tsx | frontend/src/hooks/SimulationContext.tsx | 1 | runtime | frontend/src/hooks |
| frontend/src/components/steps/SimulationModeAndParametersControls.tsx | frontend/src/utils/selectTopStart.ts | 10 | runtime | frontend/src/utils |
| frontend/src/components/steps/SimulationResultsPanel.tsx | frontend/src/components/ui/progress.tsx | 2 | runtime | frontend/src/components |
| frontend/src/components/steps/SimulationResultsPanel.tsx | frontend/src/hooks/SimulationContext.tsx | 3 | runtime | frontend/src/hooks |
| frontend/src/components/steps/SimulationResultsPanel.tsx | frontend/src/utils/selectTopStart.ts | 4 | runtime | frontend/src/utils |
| frontend/src/components/steps/SimulationResultsPanel.tsx | frontend/src/utils/simulation.ts | 5 | runtime | frontend/src/utils |
| frontend/src/components/steps/SimulationResultsPanel.tsx | frontend/src/utils/simulationDecisionDiagnostic.ts | 9 | runtime | frontend/src/utils |
| frontend/src/components/steps/SimulationStep.tsx | frontend/src/hooks/SimulationContext.tsx | 4 | runtime | frontend/src/hooks |
| frontend/src/components/steps/SimulationStep.tsx | frontend/src/hooks/useSimulation.ts | 6 | compile | frontend/src/hooks |
| frontend/src/components/steps/TeamStep.tsx | frontend/src/utils/selectTopStart.ts | 3 | runtime | frontend/src/utils |
| frontend/src/components/steps/TeamStep.tsx | frontend/src/utils/teamSort.ts | 4 | runtime | frontend/src/utils |
| frontend/src/components/steps/portfolioPrintReport.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/components/steps/portfolioPrintReport.ts | frontend/src/hooks/probability.ts | 3 | runtime | frontend/src/hooks |
| frontend/src/components/steps/portfolioPrintReport.ts | frontend/src/hooks/simulationTypes.ts | 2 | compile | frontend/src/hooks |
| frontend/src/components/steps/portfolioPrintReport.ts | frontend/src/utils/decisionLanguage.ts | 18 | compile | frontend/src/utils |
| frontend/src/components/steps/portfolioPrintReport.ts | frontend/src/utils/portfolioComparisonDiagnostic.ts | 20 | compile | frontend/src/utils |
| frontend/src/components/steps/portfolioPrintReport.ts | frontend/src/utils/portfolioComparisonPresentation.ts | 21 | runtime | frontend/src/utils |
| frontend/src/components/steps/portfolioPrintReport.ts | frontend/src/utils/simulation.ts | 4 | runtime | frontend/src/utils |
| frontend/src/components/steps/portfolioPrintReport.ts | frontend/src/utils/simulationDecisionDiagnostic.ts | 19 | runtime | frontend/src/utils |
| frontend/src/components/steps/simulationPrintReport.tsx | frontend/src/domain/simulation.ts | 18 | compile | frontend/src/domain |
| frontend/src/components/steps/simulationPrintReport.tsx | frontend/src/hooks/probability.ts | 13 | runtime | frontend/src/hooks |
| frontend/src/components/steps/simulationPrintReport.tsx | frontend/src/utils/decisionLanguage.ts | 19 | compile | frontend/src/utils |
| frontend/src/components/steps/simulationPrintReport.tsx | frontend/src/utils/simulation.ts | 14 | runtime | frontend/src/utils |
| frontend/src/components/steps/simulationPrintReport.tsx | frontend/src/utils/simulationDecisionDiagnostic.ts | 20 | runtime | frontend/src/utils |
| frontend/src/demoData.ts | frontend/src/hooks/usePortfolioReport.ts | 3 | compile | frontend/src/hooks |
| frontend/src/e2e/runtime.ts | frontend/src/hooks/useSimulationHistory.ts | 4 | runtime | frontend/src/hooks |
| frontend/src/e2e/runtime.ts | frontend/src/utils/teamSort.ts | 3 | runtime | frontend/src/utils |
| frontend/src/hooks/probability.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/adapters/seededSampleIndexDrawPort.ts | 2 | runtime | frontend/src/adapters |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/api/simulationMappers.ts | 4 | runtime | frontend/src/api |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/domain/simulation.ts | 9 | compile | frontend/src/domain |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/domain/simulation.ts | 12 | runtime | frontend/src/domain |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/domain/simulationHistory.ts | 26 | compile | frontend/src/domain |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/domain/simulationValueObjects.ts | 13 | runtime | frontend/src/domain |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/utils/math.ts | 14 | runtime | frontend/src/utils |
| frontend/src/hooks/simulationForecastCore.ts | frontend/src/utils/simulation.ts | 15 | runtime | frontend/src/utils |
| frontend/src/hooks/simulationForecastService.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/hooks/simulationForecastService.ts | frontend/src/domain/simulationHistory.ts | 2 | compile | frontend/src/domain |
| frontend/src/hooks/simulationSeedResolver.ts | frontend/src/domain/simulationValueObjects.ts | 1 | runtime | frontend/src/domain |
| frontend/src/hooks/simulationSeedResolver.ts | frontend/src/domain/simulationValueObjects.ts | 4 | compile | frontend/src/domain |
| frontend/src/hooks/simulationTypes.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/hooks/simulationTypes.ts | frontend/src/domain/simulationHistory.ts | 9 | compile | frontend/src/domain |
| frontend/src/hooks/simulationTypes.ts | frontend/src/utils/decisionLanguage.ts | 14 | compile | frontend/src/utils |
| frontend/src/hooks/useOnboarding.ts | frontend/src/utils/teamSort.ts | 10 | runtime | frontend/src/utils |
| frontend/src/hooks/usePortfolio.ts | frontend/src/domain/simulation.ts | 5 | compile | frontend/src/domain |
| frontend/src/hooks/usePortfolio.ts | frontend/src/utils/portfolioComparisonPresentation.ts | 23 | compile | frontend/src/utils |
| frontend/src/hooks/usePortfolio.ts | frontend/src/utils/teamSort.ts | 7 | runtime | frontend/src/utils |
| frontend/src/hooks/usePortfolioReport.ts | frontend/src/adapters/seededSampleIndexDrawPort.ts | 2 | runtime | frontend/src/adapters |
| frontend/src/hooks/usePortfolioReport.ts | frontend/src/components/steps/portfolioPrintReport.ts | 513 | runtime | frontend/src/components |
| frontend/src/hooks/usePortfolioReport.ts | frontend/src/domain/simulation.ts | 4 | compile | frontend/src/domain |
| frontend/src/hooks/usePortfolioReport.ts | frontend/src/utils/portfolioComparisonDiagnostic.ts | 21 | runtime | frontend/src/utils |
| frontend/src/hooks/usePortfolioReport.ts | frontend/src/utils/portfolioComparisonPresentation.ts | 26 | compile | frontend/src/utils |
| frontend/src/hooks/usePortfolioReport.ts | frontend/src/utils/simulation.ts | 12 | runtime | frontend/src/utils |
| frontend/src/hooks/usePortfolioReport.ts | frontend/src/utils/simulationDecisionDiagnostic.ts | 20 | runtime | frontend/src/utils |
| frontend/src/hooks/useSimulation.ts | frontend/src/domain/simulation.ts | 8 | compile | frontend/src/domain |
| frontend/src/hooks/useSimulation.ts | frontend/src/domain/simulationHistory.ts | 9 | compile | frontend/src/domain |
| frontend/src/hooks/useSimulation.ts | frontend/src/utils/export.ts | 17 | runtime | frontend/src/utils |
| frontend/src/hooks/useSimulation.ts | frontend/src/utils/simulationSignature.ts | 25 | runtime | frontend/src/utils |
| frontend/src/hooks/useSimulation.ts | frontend/src/utils/simulationSignature.ts | 29 | compile | frontend/src/utils |
| frontend/src/hooks/useSimulationChartData.ts | frontend/src/domain/simulation.ts | 2 | compile | frontend/src/domain |
| frontend/src/hooks/useSimulationChartData.ts | frontend/src/utils/cycleTime.ts | 6 | runtime | frontend/src/utils |
| frontend/src/hooks/useSimulationHistory.ts | frontend/src/domain/simulationHistory.ts | 7 | compile | frontend/src/domain |
| frontend/src/hooks/useSimulationHistory.ts | frontend/src/storage/simulationHistoryMappers.ts | 3 | runtime | frontend/src/storage |
| frontend/src/hooks/useSimulationPrefs.ts | frontend/src/domain/simulation.ts | 2 | compile | frontend/src/domain |
| frontend/src/simulationLimits.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/simulationLimits.ts | frontend/src/domain/simulationValueObjects.ts | 2 | runtime | frontend/src/domain |
| frontend/src/simulationLimits.ts | frontend/src/domain/simulationValueObjects.ts | 9 | runtime | frontend/src/domain |
| frontend/src/statisticalCorpusRunner.ts | frontend/src/adapters/seededSampleIndexDrawPort.ts | 1 | runtime | frontend/src/adapters |
| frontend/src/statisticalCorpusRunner.ts | frontend/src/domain/simulation.ts | 2 | runtime | frontend/src/domain |
| frontend/src/statisticalCorpusRunner.ts | frontend/src/domain/simulation.ts | 3 | compile | frontend/src/domain |
| frontend/src/statisticalCorpusRunner.ts | frontend/src/domain/simulationValueObjects.ts | 4 | runtime | frontend/src/domain |
| frontend/src/statisticalCorpusRunner.ts | frontend/src/utils/simulation.ts | 5 | runtime | frontend/src/utils |
| frontend/src/storage/simulationHistoryMappers.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/storage/simulationHistoryMappers.ts | frontend/src/domain/simulationHistory.ts | 2 | compile | frontend/src/domain |
| frontend/src/storage/simulationHistoryMappers.ts | frontend/src/domain/simulationValueObjects.ts | 3 | runtime | frontend/src/domain |
| frontend/src/utils/cycleTime.ts | frontend/src/hooks/simulationTypes.ts | 3 | compile | frontend/src/hooks |
| frontend/src/utils/forecastDiagnostics.ts | frontend/src/domain/simulation.ts | 2 | compile | frontend/src/domain |
| frontend/src/utils/portfolioComparisonDiagnostic.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/utils/simulation.ts | frontend/src/domain/histogram.ts | 10 | runtime | frontend/src/domain |
| frontend/src/utils/simulation.ts | frontend/src/domain/sampleIndexDrawPort.ts | 8 | compile | frontend/src/domain |
| frontend/src/utils/simulation.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/utils/simulation.ts | frontend/src/domain/simulationValueObjects.ts | 11 | runtime | frontend/src/domain |
| frontend/src/utils/simulation.ts | frontend/src/domain/simulationValueObjects.ts | 45 | runtime | frontend/src/domain |
| frontend/src/utils/simulation.ts | frontend/src/domain/throughputReliability.ts | 18 | runtime | frontend/src/domain |
| frontend/src/utils/simulationDecisionDiagnostic.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/utils/simulationDecisionDiagnostic.ts | frontend/src/domain/simulationHistory.ts | 2 | compile | frontend/src/domain |
| frontend/src/utils/simulationSignature.ts | frontend/src/domain/simulation.ts | 1 | compile | frontend/src/domain |
| frontend/src/utils/simulationSignature.ts | frontend/src/domain/simulationHistory.ts | 2 | compile | frontend/src/domain |

### Limites

- Static extraction does not prove that every conditional path ran.
- Type-only imports are compile dependencies, not JavaScript runtime loads.
- These findings do not define the target architecture or authorize a migration.
