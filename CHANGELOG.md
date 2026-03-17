# Changelog

## Recent

### Frontend

- correction du runtime GitHub Pages via `VITE_GITHUB_PAGES` pour garantir la demo publique sur `/` et la notice sur `?connect=true`
- remplacement du bandeau demo global par un badge `Démo` dans l'en-tete de l'ecran simulation
- nouveau point d'entree demo sur l'ecran de choix d'equipe avec texte d'orientation simulation vs portefeuille
- badge `Démo` visible aussi sur l'ecran de choix d'equipe en mode demo
- axe Y des graphes throughput/distribution borne a `0` et ajout d'une marge haute sur le throughput pour eviter les barres collees au plafond
- couverture unitaire renforcee sur `SimulationChartTabs.tsx` et scenario E2E demo aligne sur le nouveau badge
- refactor de `App.tsx` en modules dedies: `AppFlowContent.tsx`, `appNavigation.ts`, `appShellSections.tsx`, `appTheme.ts`
- extraction des helpers API dans `src/apiHelpers.ts` pour separer les branches de normalisation du wrapper `api.ts`
- extraction du coeur forecast vers `src/hooks/simulationForecastCore.ts`, `simulationForecastService.ts` restant une facade mince
- ajout d'un jeu de tests unitaires et E2E cible pour remonter la couverture vitale (`coverage.spec.js`, `AppFlowContent.test.tsx`, `simulation.test.ts`, hooks/tests associes)
- alignement du mapping vital `SLA Identite` sur les fichiers reels apres refactor (`docs/vitals-coverage-map.json`)
- utilitaires centralises `src/date.ts`, `src/storage.ts`, `src/utils/math.ts`, `src/utils/simulation.ts`
- gestion granulaire des erreurs Azure DevOps (`401/403/404/429/5xx`) via `src/adoErrors.ts`
- avertissement explicite en cas de chargement partiel des batches de work items
- contexte simulation unifie `src/hooks/SimulationContext.tsx`
- centralisation des acces `localStorage` via `storage.ts`
- extraction de l'export CSV throughput vers `src/utils/export.ts`
- extraction de la logique forecast vers `src/hooks/simulationForecastService.ts`
- extraction de la logique portefeuille vers `src/hooks/usePortfolio.ts`
- extraction de la generation du rapport portefeuille vers `src/hooks/usePortfolioReport.ts`
- extraction du chargement des options d'equipe vers `src/hooks/useTeamOptions.ts`
- extraction de la persistance des quick filters vers `src/hooks/useSimulationQuickFilters.ts`
- simplification du contrat de `useSimulationAutoRun` via un objet `params`
- libelles metier clarifies dans l'UI portefeuille/simulation
- calcul du `risk score` harmonise sur les percentiles effectivement affiches
- typages simulation segmentes (`SimulationForecastControls`, `SimulationDateRange`, `SimulationResult`, `ChartTab`)
- ecran simulation charge en lazy + import dynamique du module rapport/PDF
- accessibilite du chargement renforcee dans `SimulationResultsPanel`
- cache memoire des options d'equipe portefeuille (`org::project::team`)
- generation du rapport portefeuille parallelisee (`Promise.allSettled`) avec progression visible
- tolerance aux echecs partiels en portefeuille
- persistance locale de la configuration rapide par scope `org::project::team`
- application manuelle de la configuration rapide depuis la modale portefeuille
- resumes du panneau simulation reformules en libelles metier
- mode portefeuille recompose pour une lecture plus claire des criteres generaux
- rapport portefeuille PDF enrichi avec page de synthese decisionnelle
- refonte des scenarios portefeuille: `Optimiste`, `Arrime`, `Friction`, `Conservateur`
- ajout d'un graphe comparatif des 4 courbes de probabilite dans le PDF
- alignement CI front sur les 4 scenarios portefeuille
- ordre des scenarios harmonise partout
- correction d'un bug de coherence `Risk Score` entre synthese PDF et pages detail
- correction du declenchement multi-telechargements PDF
- robustesse e2e renforcee sur l'ecran simulation
- `frontend/tests/e2e/coverage.spec.js` normalise en UTF-8

### Backend et tests

- auto-reparation de l'index TTL Mongo `last_seen_1` au demarrage en cas de conflit d'options historique
- tri des imports `slowapi` dans `backend/api.py` pour conformite Ruff/isort
- decoupage d'une comprehension de liste dans `tests/test_api_simulate.py` pour respecter la limite de longueur de ligne
- DoD et garde-fous repo alignes sur `pytest` / FastAPI plutot que `manage.py test`
