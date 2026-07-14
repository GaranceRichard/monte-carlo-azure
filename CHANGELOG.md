# Changelog

## Recent

### Frontend

- ajout du diagnostic comparatif portefeuille dans le modele de generation: qualite des historiques observes,
  stabilite des resultats simules et credibilite des hypotheses sont separees; aucune hypothese n'est preferee
  avec les seules donnees disponibles, et le rendu UI/PDF reste inchange
- alignement des diagnostics decisionnels entre l'interface et les rapports PDF simulation / portefeuille:
  statuts, justifications, actions conseillees, facteurs, qualite des donnees et incertitude reutilisent
  le langage decisionnel existant, sans modifier les calculs ni les recommandations
- mise en page de la synthese PDF portefeuille stabilisee sur une seule page: tableau decisionnel,
  comparaison des probabilites lisible et hypotheses en deux colonnes; les pages scenario conservent
  leurs sauts de page dedies
- harmonisation de la grammaire visuelle des graphiques Recharts et SVG: observations en barres, points pleins ou
  traits continus; moyenne mobile, moyenne glissante et courbe lissee pointillees; intervalle de variabilite en bande;
  probabilites continues. Les legendes d'interface et de rapport reproduisent desormais le style de chaque serie.
- clarification semantique des graphiques du rapport portefeuille: le throughput equipe,
  l'historique corr\u00E9l\u00E9 et les scenarios bootstrap sont distingues par des titres HTML et SVG
  coherents; les scenarios synthetiques restent explicitement presentes comme reconstruits par bootstrap
  et leurs dates utilisent les utilitaires de calendrier local pour eviter toute derive UTC
- centralisation du contrat de bornes Monte Carlo dans `src/simulationLimits.ts` et alignement
  des validations UI / simulation locale sur le backend: `n_sims` entre `1_000` et `200_000`,
  `target_weeks` entre `1` et `521`, `throughput_samples` entre `6` et `521` valeurs,
  `backlog_size` entre `1` et `1_000_000`, sans correction silencieuse des entrées invalides
- correction de la semantique des simulations `backlog_to_weeks` censurees:
  percentiles identifies sur le rang dans `n_sims`, courbe de probabilite plafonnee
  au vrai taux de completion, `Risk Score` masque si `P50` ou `P90` manque
- `backlog_to_weeks` ne code plus une non-terminaison par `521` seul: le frontend consomme
  et produit un `completion_summary` explicite (`completed_count`, `censored_count`,
  `censored_rate`, `horizon_weeks`) pour distinguer les censures des fins exactes a l'horizon
- les ecrans simulation et les exports PDF n'affichent plus de percentile fictif ni de
  `Risk Score` incomplet: percentiles absents si non identifiables, score absent si `P50`
  ou `P90` manque, avec note utilisateur sur la limite d'horizon
- compatibilite preservee avec les historiques legacy: le recalcul frontend reste reserve
  aux anciens historiques quand les nouveaux champs ne sont pas encore presents
- propagation de la `seed` Monte Carlo dans tous les chemins de simulation frontend:
  contrat `ForecastRequestPayload` / `ForecastResponse`, appel backend, moteur local demo,
  rapport portefeuille, historique local et rejeu
- generation d'une `seed` unique par execution logique frontend, conservee lors d'un rejeu
  d'historique sans reutiliser l'identifiant d'entree comme graine
- suppression des derniers `Math.random()` du moteur de simulation frontend au profit d'un
  generateur pseudo-aleatoire deterministe seedé
- compatibilite preservee avec les historiques locaux legacy depourvus de `seed`
- `Cycle Time` exprime partout en jours calendaires cote frontend: calcul, types, noms de proprietes,
  graphiques, tooltips, cartes, demo et exports PDF
- versionnement de l'historique local de simulation avec `schemaVersion`, migration idempotente
  des anciennes entrees sans version et conversion unique des anciennes valeurs `Cycle Time`
  stockees en semaines vers des jours calendaires (`* 7`)
- renommage des proprietes `Cycle Time` pour expliciter l'unite (`*Days`) et eviter les champs ambigus
- typage explicite de `AppFlowContent` sur `OnboardingState`, `OnboardingActions` et `SimulationViewModel`, avec test du rendu nominal de l'etape PAT et garde runtime conservee pour une etape inattendue
- suppression de `client_context` du contrat frontend/backend de simulation: `POST /simulate` transporte maintenant uniquement les donnees Monte Carlo statistiques
- l'historique detaille contextualise par equipe reste strictement local au navigateur; le frontend ne remappe plus l'historique Mongo dans `useSimulationHistory`
- le mode portefeuille et les scenarios agreges n'envoient plus de noms d'equipe ou de scenario au backend
- remplacement du scenario portefeuille `Conservateur` par `Historique corrélé`, construit a partir
  des semaines reelles communes a toutes les equipes pour conserver les variations partagees
  (vacances, incidents, ralentissements, dependances temporelles) dans le moteur Monte Carlo
- correction de la formule du scenario portefeuille `Friction` pour l'aligner sur l'explication metier:
  une seule equipe conserve 100% de sa capacite, puis chaque equipe supplementaire applique
  le meme cout d'alignement (`optimistic * alignmentRate^(teamCount - 1)`, expose avec borne
  d'exposant a `0` et pourcentage affiche identique au facteur reellement simule)
- le throughput hebdomadaire Azure DevOps n'integre plus de semaines calendaires incompletes:
  seules les semaines ISO completes du lundi au dimanche, entierement contenues dans la periode
  selectionnee et deja ecoulees au moment du calcul, alimentent desormais l'historique de simulation
- extraction des utilitaires calendaires dans `src/date.ts` (`parseLocalIsoDate`, `startOfIsoWeek`,
  `nextMonday`, `previousSunday`, `getCompleteWeekRange`) pour fiabiliser l'alignement local des dates
  sans derive UTC sur les chaines `YYYY-MM-DD`
- alignement des stats `totalWeeks` / `usedWeeks`, des graphes throughput et des scenarios E2E sur ce
  nouveau filtre de semaines completes, avec message explicite quand aucune semaine exploitable n'est disponible
- correction P0 du `Risk Score` pour garantir la meme formule metier entre backend, ecran et PDF:
  `backlog_to_weeks` utilise `(P90 - P50) / P50`, `weeks_to_items` utilise
  `(P50 - P90) / P50`, avec borne `0` si `P50 <= 0` ou si une ancienne reponse est incoherente
- suppression des derniers recalculs divergents du `Risk Score` dans le rapport portefeuille:
  les pages detail et la synthese PDF utilisent maintenant les percentiles metier exposes
- ajout de tests de coherence sur le `Risk Score` et les autres ratios (`cv`, `iqr_ratio`,
  `slope_norm`) pour verifier la parite backend/frontend et les gardes-fous d'affichage
- `weeks_to_items` n'effectue plus de double recalcul systematique des percentiles:
  les nouvelles reponses API utilisent directement `result_percentiles`, avec fallback
  histogramme conserve uniquement pour les historiques legacy detectes
- durcissement du workflow GitHub Pages avec une seconde tentative de `actions/deploy-pages` quand GitHub renvoie un echec transitoire apres creation du deploiement
- correction de la CI Playwright: le job `frontend-tests` installe aussi les dependances Python backend requises par `run_app.py` (`uvicorn`, FastAPI, etc.) avant `npm run test:e2e`
- stabilisation de `vitest run --coverage` sous Windows via `pool: "forks"` et `coverage.processingConcurrency: 1` pour eviter les erreurs V8 `ENOENT` sur `frontend/coverage/.tmp/coverage-*.json`
- couverture unitaire completee sur `getProjectionReliabilityNotice` dans `src/utils/simulation.ts` pour supprimer la ligne rouge restante dans le rapport
- extraction et tests dedies du calcul de `cycleTime` via `src/utils/cycleTime.ts`
- harmonisation du rendu `Cycle Time` avec les autres onglets graphiques, y compris legendes et libelles metier
- durcissement des mocks Playwright pour couvrir aussi l'historique client `/simulations/history` et les revisions Azure DevOps utilisees par le calcul de `cycleTime`
- correction du runtime GitHub Pages via `VITE_GITHUB_PAGES` pour garantir la demo publique sur `/` et la notice sur `?connect=true`
- remplacement du bandeau demo global par un badge `Démo` dans l'en-tete de l'ecran simulation
- nouveau point d'entree demo sur l'ecran de choix d'equipe avec texte d'orientation simulation vs portefeuille
- badge `Démo` visible aussi sur l'ecran de choix d'equipe en mode demo
- axe Y des graphes throughput/distribution borne a `0` et ajout d'une marge haute sur le throughput pour eviter les barres collees au plafond
- couverture unitaire renforcee sur `SimulationChartTabs.tsx` et scenario E2E demo aligne sur le nouveau badge
- couverture unitaire completee sur `adoPlatform.ts`, `ProjectStep.tsx`, `SimulationChartTabs.tsx`,
  `SimulationResultsPanel.tsx`, `src/utils/simulation.ts` et `src/utils/cycleTime.ts`
- couverture E2E durcie sur l'onboarding demo / deconnexion / theme et sur les branches directes
  `adoClient.ts`, avec stabilisation des scenarios Playwright associes
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
- refonte des scenarios portefeuille: `Optimiste`, `Arrime`, `Friction`, `Historique corrélé`
- ajout d'un graphe comparatif des 4 courbes de probabilite dans le PDF
- alignement CI front sur les 4 scenarios portefeuille
- ordre des scenarios harmonise partout
- correction d'un bug de coherence `Risk Score` entre synthese PDF et pages detail
- correction du declenchement multi-telechargements PDF
- robustesse e2e renforcee sur l'ecran simulation
- `frontend/tests/e2e/coverage.spec.js` normalise en UTF-8

### Backend et tests

- centralisation des bornes de contrat Monte Carlo dans `backend/simulation_limits.py` et
  validation `422` explicite avant simulation pour `n_sims`, `target_weeks`,
  `throughput_samples` et `backlog_size`, avec tests backend/frontend/E2E des bornes min/max
  et maintien du moteur batché sans allocation globale `n_sims x horizon`
- le moteur Monte Carlo backend n'alloue plus de matrice complete `n_sims x horizon`:
  les tirages sont maintenant executes par lots de taille centralisee avec un seul generateur
  pseudo-aleatoire par simulation, ce qui borne la memoire sans casser la reproductibilite
- ajout de tests backend pour verrouiller la reproductibilite entre tailles de lots et le
  traitement correct d'un dernier lot incomplet
- `backlog_to_weeks` distingue maintenant les simulations terminees des censures a l'horizon:
  nouvelle structure `FinishWeeksSimulation`, percentiles calcules uniquement sur les
  simulations terminees, `completion_summary` persiste dans l'historique Mongo et fin exacte
  a `521` semaines distincte d'une censure
- `risk_score` backend devient absent quand `P50` ou `P90` n'est pas identifiable, sans
  remplacement silencieux par `0` ou `521`
- ajout de tests backend/frontend pour couvrir les cas limites de censures completes, de fin
  exacte a l'horizon, d'absence de percentiles et d'absence de `Risk Score`
- ajout d'un `seed` Monte Carlo optionnel sur `POST /simulate`, valide entre `0` et `4294967295`, renvoye dans la reponse et persiste dans l'historique Mongo pour rejouer un tirage a l'identique
- ajout de tests API et store pour garantir la reproductibilite avec un `seed` fourni, la generation automatique d'un `seed` valide, et la compatibilite des lignes d'historique legacy depourvues de `seed`
- refonte de `Scripts/check_identity_boundary.py` autour des regles explicites `IDENTITY-001` a `IDENTITY-008`, avec collecte testable des violations sur les contrats `POST /simulate`, la persistance Mongo, l'historique backend, les proxies locaux et les appels Azure DevOps cote serveur
- ajout de `tests/test_identity_boundary.py` avec depots temporaires synthetiques pour verrouiller les cas conformes et les regressions interdites, sans dependre du repertoire `AppData\Local\Temp\pytest-of-*` sous Windows
- renommage de l'etape CI en `Enforce Azure DevOps identity boundary` et maintien de son caractere bloquant avant les tests backend
- suppression de `ClientContext` du modele API backend et persistance Mongo limitee aux seules donnees statistiques anonymes
- alignement du smoke test Docker CI sur le contrat courant de `POST /simulate`:
  le workflow n'envoie plus l'ancien champ `capacity_percent`, ce qui evite les `422`
  dus a `extra="forbid"` tout en gardant le garde-fou de derive de contrat
- projection defensive de `/simulations/history` pour exclure explicitement les anciens champs sensibles Azure DevOps, meme sur des documents legacy
- ajout du script `Scripts/scrub_simulation_identity.py` pour nettoyer les anciens champs d'identite Azure DevOps en `dry-run` par defaut puis `--apply`
- couverture de `backend/simulation_store.py` completee sur les branches defensives (`connect`, `_ensure_collection`, `_run_with_reconnect`, `close`) pour supprimer la marge devenue trop juste autour de la persistence Mongo
- correction de la semantique des percentiles Monte Carlo selon le mode:
  `backlog_to_weeks` utilise un quantile discret conservateur `higher`, `weeks_to_items`
  un quantile de survie `lower`, avec tests discrets cibles sur l'API et `mc_core`
- remplacement du client de test `fastapi.testclient.TestClient` par un helper local base sur `httpx` pour eviter le warning de depreciation Starlette/FastAPI dans les tests API
- auto-reparation de l'index TTL Mongo `last_seen_1` au demarrage en cas de conflit d'options historique
- tri des imports `slowapi` dans `backend/api.py` pour conformite Ruff/isort
- decoupage d'une comprehension de liste dans `tests/test_api_simulate.py` pour respecter la limite de longueur de ligne
- ajout de `tests/test_api_static.py` et couverture completee de `backend/api.py` / `backend/api_static.py`
  sur le `lifespan` FastAPI et le montage du frontend statique, avec repertoires temporaires locaux
  au workspace pour rester stables sous Windows
- DoD et garde-fous repo alignes sur `pytest` / FastAPI plutot que `manage.py test`
