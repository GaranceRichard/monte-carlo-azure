# Vitals Traceability

Ce document relie chaque point vital officiel a ses preuves de test et a ses controles de conformite.

## Regles

- Chaque point vital doit avoir au moins un test cible reference ici.
- Les chemins references doivent exister dans le repo.
- La task locale de coverage doit executer le controle `vitals compliance`.

## Matrice officielle

### SLA Identite

- Definition: aucune donnee d'identification Azure DevOps (`PAT`, `UUID`, `ORG`, `Team`) ne transite par un serveur applicatif.
- Tests cibles:
  - `frontend/src/hooks/Simulationforecastservice.test.tsx`
  - `frontend/tests/e2e/onboarding.spec.js`
  - `frontend/tests/e2e/coverage.spec.js`

### Cookie IDMontecarlo

- Definition: le cookie `IDMontecarlo` ne doit jamais transiter vers `dev.azure.com` ou `app.vssps.visualstudio.com`.
- Tests cibles:
  - `frontend/src/clientId.test.ts`
  - `frontend/tests/e2e/coverage.spec.js`

### Endpoint backend `POST /simulate`

- Definition: l'endpoint `POST /simulate` doit rester valide, robuste et deterministe sur erreurs.
- Tests cibles:
  - `tests/test_api_simulate.py`
  - `tests/test_api_history.py`

### Flux onboarding critique

- Definition: le flux `PAT -> organisation -> projet -> equipe` doit rester fonctionnel.
- Tests cibles:
  - `frontend/tests/e2e/onboarding.spec.js`
  - `frontend/tests/e2e/selection.spec.js`
  - `frontend/src/hooks/useOnboarding.test.tsx`

### Export rapport simulation (SVG/PDF)

- Definition: la generation de rapport simulation/portefeuille reste stable et non regressive.
- Tests cibles:
  - `frontend/src/components/steps/simulationPrintReport.test.ts`
  - `frontend/src/components/steps/simulationExportModules.test.ts`
  - `frontend/src/components/steps/portfolioPrintReport.test.ts`
- Controle local recommande: utiliser `npm --prefix frontend run test:unit:coverage`, `python Scripts/report_vitals_coverage.py` et `powershell -NoProfile -ExecutionPolicy Bypass -File .\.vscode\scripts\run-vitals-compliance.ps1 -WorkspaceRoot .`.
- Reference actuelle:
  - `frontend_unit` / `branches`: `95.78%`
