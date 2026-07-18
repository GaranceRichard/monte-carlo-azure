# Changelog

## Recent

### Qualité et outillage

- ajout du modèle versionné de classification des cas logiques selon `STD-TEST-001` : catalogue de
  vocabulaires, domaines et règles de résolution, schéma JSON Draft 2020-12, documentation et tests de
  cohérence, sans classification du patrimoine ni modification des gates
- création de la matrice risques–contrôles et enrichissement des parcours critiques, avec distinction explicite
  entre maîtrise démontrée, couverture partielle et lacune planifiée
- audit de tous les fichiers Markdown suivis par Git, correction des accents, encodages et échappements
  Unicode, et vérification des liens internes et de la cohérence factuelle
- versionnement de `STD-TEST-001`, standard de classification, de qualité et de pilotage des tests, et
  alignement des références normatives dans le README, la DoD et l’architecture
- correction de la portabilité Linux des tests de la gate : la détection Windows passe par un seam dédié,
  le fallback `cmd.exe /c mklink /J` force d’abord l’échec du lien symbolique, et aucun test ne modifie plus
  globalement `os.name` ; les retries de suppression read-only et la suppression d’une jonction sont
  simulés sans skip de plateforme, tandis que les deux tests du comportement réel du système de fichiers
  Windows restent explicitement conditionnels
- ajout d’un ratchet de maintenabilité déterministe sur la taille, la complexité, les cycles, les
  directions de dépendance démontrables et le mojibake, avec baseline et exceptions justifiées versionnées
- découpage du moteur de maintenabilité entre collecte des métriques, analyse des dépendances, chargement de
  configuration, comparaison au ratchet et restitution CLI, tout en conservant un point d’entrée unique
- extension de la couverture Python à tous les fichiers exécutables versionnés sous `backend/`, `Scripts/`
  et à `run_app.py`, avec branches actives, seuil global et par fichier, absence de ligne rouge et contrôle
  bloquant d’un fichier exécutable manquant
- ajout d’un test unitaire déterministe du repli de téléchargement PDF quand l’API de sauvegarde directe
  échoue, sans modification du comportement de production ni du contenu PDF

### Frontend

- ajout d'une page PDF « Comparaison des hypothèses » après la synthèse portefeuille: qualité des historiques
  observés, stabilité des résultats simulés et crédibilité des hypothèses restent séparées, sans reconstruire
  de recommandation depuis les résultats statistiques
- retrait du diagnostic comparatif détaillé de l'interface de génération; seul un contrôle compact permet de
  choisir facultativement une référence de pilotage, sans sélection par défaut et hors du diagnostic métier
- distinction explicite dans le rapport entre recommandation issue des preuves, préconisation de démarche et
  référence de pilotage choisie comme convention de gouvernance
- libellé utilisateur `Indépendant` harmonisé dans la synthèse, les légendes et les pages du rapport; lecture
  prudente alignée sur le percentile P90 effectivement exposé et diagnostics d'équipe rendus sans concaténation
- alignement des diagnostics décisionnels entre l'interface et les rapports PDF simulation / portefeuille:
  statuts, justifications, actions conseillées, facteurs, qualité des données et incertitude réutilisent
  le langage décisionnel existant, sans modifier les calculs ni les recommandations
- mise en page de la synthèse PDF portefeuille stabilisée sur une seule page: tableau décisionnel,
  comparaison des probabilités lisible et hypothèses en deux colonnes; les pages scénario conservent
  leurs sauts de page dédiés
- harmonisation de la grammaire visuelle des graphiques Recharts et SVG: observations en barres, points pleins ou
  traits continus; moyenne mobile, moyenne glissante et courbe lissée pointillées; intervalle de variabilité en bande;
  probabilités continues. Les légendes d'interface et de rapport reproduisent désormais le style de chaque série.
- clarification sémantique des graphiques du rapport portefeuille: le throughput équipe,
  l'historique corrélé et les scénarios bootstrap sont distingués par des titres HTML et SVG
  cohérents; les scénarios synthétiques restent explicitement présentés comme reconstruits par bootstrap
  et leurs dates utilisent les utilitaires de calendrier local pour éviter toute dérive UTC
- centralisation du contrat de bornes Monte Carlo dans `src/simulationLimits.ts` et alignement
  des validations UI / simulation locale sur le backend: `n_sims` entre `1_000` et `200_000`,
  `target_weeks` entre `1` et `521`, `throughput_samples` entre `6` et `521` valeurs,
  `backlog_size` entre `1` et `1_000_000`, sans correction silencieuse des entrées invalides
- correction de la sémantique des simulations `backlog_to_weeks` censurées:
  percentiles identifiés sur le rang dans `n_sims`, courbe de probabilité plafonnée
  au vrai taux de complétion, `Risk Score` masqué si `P50` ou `P90` manque
- `backlog_to_weeks` ne code plus une non-terminaison par `521` seul: le frontend consomme
  et produit un `completion_summary` explicite (`completed_count`, `censored_count`,
  `censored_rate`, `horizon_weeks`) pour distinguer les censures des fins exactes à l'horizon
- les écrans simulation et les exports PDF n'affichent plus de percentile fictif ni de
  `Risk Score` incomplet: percentiles absents si non identifiables, score absent si `P50`
  ou `P90` manque, avec note utilisateur sur la limite d'horizon
- compatibilité préservée avec les historiques legacy: le recalcul frontend reste réservé
  aux anciens historiques quand les nouveaux champs ne sont pas encore présents
- propagation de la `seed` Monte Carlo dans tous les chemins de simulation frontend:
  contrat `ForecastRequestPayload` / `ForecastResponse`, appel backend, moteur local démo,
  rapport portefeuille, historique local et rejeu
- génération d'une `seed` unique par exécution logique frontend, conservée lors d'un rejeu
  d'historique sans réutiliser l'identifiant d'entrée comme graine
- suppression des derniers `Math.random()` du moteur de simulation frontend au profit d'un
  générateur pseudo-aléatoire déterministe seedé
- compatibilité préservée avec les historiques locaux legacy dépourvus de `seed`
- `Cycle Time` exprimé partout en jours calendaires côté frontend: calcul, types, noms de propriétés,
  graphiques, tooltips, cartes, démo et exports PDF
- versionnement de l'historique local de simulation avec `schemaVersion`, migration idempotente
  des anciennes entrées sans version et conversion unique des anciennes valeurs `Cycle Time`
  stockées en semaines vers des jours calendaires (`* 7`)
- renommage des propriétés `Cycle Time` pour expliciter l'unité (`*Days`) et éviter les champs ambigus
- typage explicite de `AppFlowContent` sur `OnboardingState`, `OnboardingActions` et `SimulationViewModel`, avec test du rendu nominal de l'étape PAT et garde runtime conservée pour une étape inattendue
- suppression de `client_context` du contrat frontend/backend de simulation: `POST /simulate` transporte maintenant uniquement les données Monte Carlo statistiques
- l'historique détaillé contextualisé par équipe reste strictement local au navigateur; le frontend ne remappe plus l'historique Mongo dans `useSimulationHistory`
- le mode portefeuille et les scénarios agrégés n'envoient plus de noms d'équipe ou de scénario au backend
- remplacement du scénario portefeuille `Conservateur` par `Historique corrélé`, construit à partir
  des semaines réelles communes à toutes les équipes pour conserver les variations partagées
  (vacances, incidents, ralentissements, dépendances temporelles) dans le moteur Monte Carlo
- correction de la formule du scénario portefeuille `Friction` pour l'aligner sur l'explication métier:
  une seule équipe conserve 100% de sa capacité, puis chaque équipe supplémentaire applique
  le même coût d'alignement (`optimistic * alignmentRate^(teamCount - 1)`, exposé avec borne
  d'exposant à `0` et pourcentage affiché identique au facteur réellement simulé)
- le throughput hebdomadaire Azure DevOps n'intègre plus de semaines calendaires incomplètes:
  seules les semaines ISO complètes du lundi au dimanche, entièrement contenues dans la période
  sélectionnée et déjà écoulées au moment du calcul, alimentent désormais l'historique de simulation
- extraction des utilitaires calendaires dans `src/date.ts` (`parseLocalIsoDate`, `startOfIsoWeek`,
  `nextMonday`, `previousSunday`, `getCompleteWeekRange`) pour fiabiliser l'alignement local des dates
  sans dérive UTC sur les chaînes `YYYY-MM-DD`
- alignement des stats `totalWeeks` / `usedWeeks`, des graphes throughput et des scénarios E2E sur ce
  nouveau filtre de semaines complètes, avec message explicite quand aucune semaine exploitable n'est disponible
- correction P0 du `Risk Score` pour garantir la même formule métier entre backend, écran et PDF:
  `backlog_to_weeks` utilise `(P90 - P50) / P50`, `weeks_to_items` utilise
  `(P50 - P90) / P50`, avec borne `0` si `P50 <= 0` ou si une ancienne réponse est incohérente
- suppression des derniers recalculs divergents du `Risk Score` dans le rapport portefeuille:
  les pages détail et la synthèse PDF utilisent maintenant les percentiles métier exposés
- ajout de tests de cohérence sur le `Risk Score` et les autres ratios (`cv`, `iqr_ratio`,
  `slope_norm`) pour vérifier la parité backend/frontend et les gardes-fous d'affichage
- `weeks_to_items` n'effectue plus de double recalcul systématique des percentiles:
  les nouvelles réponses API utilisent directement `result_percentiles`, avec fallback
  histogramme conservé uniquement pour les historiques legacy détectés
- durcissement du workflow GitHub Pages avec une seconde tentative de `actions/deploy-pages` quand GitHub renvoie un échec transitoire après création du déploiement
- correction de la CI Playwright: le job `frontend-tests` installe aussi les dépendances Python backend requises par `run_app.py` (`uvicorn`, FastAPI, etc.) avant `npm run test:e2e`
- stabilisation de `vitest run --coverage` sous Windows via `pool: "forks"` et `coverage.processingConcurrency: 1` pour éviter les erreurs V8 `ENOENT` sur `frontend/coverage/.tmp/coverage-*.json`
- couverture unitaire complétée sur `getProjectionReliabilityNotice` dans `src/utils/simulation.ts` pour supprimer la ligne rouge restante dans le rapport
- extraction et tests dédiés du calcul de `cycleTime` via `src/utils/cycleTime.ts`
- harmonisation du rendu `Cycle Time` avec les autres onglets graphiques, y compris légendes et libellés métier
- durcissement des mocks Playwright pour couvrir aussi l'historique client `/simulations/history` et les révisions Azure DevOps utilisées par le calcul de `cycleTime`
- correction du runtime GitHub Pages via `VITE_GITHUB_PAGES` pour garantir la démo publique sur `/` et la notice sur `?connect=true`
- remplacement du bandeau démo global par un badge `Démo` dans l'en-tête de l'écran simulation
- nouveau point d'entrée démo sur l'écran de choix d'équipe avec texte d'orientation simulation vs portefeuille
- badge `Démo` visible aussi sur l'écran de choix d'équipe en mode démo
- axe Y des graphes throughput/distribution borné à `0` et ajout d'une marge haute sur le throughput pour éviter les barres collées au plafond
- couverture unitaire renforcée sur `SimulationChartTabs.tsx` et scénario E2E démo aligné sur le nouveau badge
- couverture unitaire complétée sur `adoPlatform.ts`, `ProjectStep.tsx`, `SimulationChartTabs.tsx`,
  `SimulationResultsPanel.tsx`, `src/utils/simulation.ts` et `src/utils/cycleTime.ts`
- couverture E2E durcie sur l'onboarding démo / déconnexion / thème et sur les branches directes
  `adoClient.ts`, avec stabilisation des scénarios Playwright associés
- refactor de `App.tsx` en modules dédiés: `AppFlowContent.tsx`, `appNavigation.ts`, `appShellSections.tsx`, `appTheme.ts`
- extraction des helpers API dans `src/apiHelpers.ts` pour séparer les branches de normalisation du wrapper `api.ts`
- extraction du cœur forecast vers `src/hooks/simulationForecastCore.ts`, `simulationForecastService.ts` restant une façade mince
- ajout d'un jeu de tests unitaires et E2E ciblé pour remonter la couverture vitale (`coverage.spec.js`, `AppFlowContent.test.tsx`, `simulation.test.ts`, hooks/tests associés)
- alignement du mapping vital `SLA Identite` sur les fichiers réels après refactor (`docs/vitals-coverage-map.json`)
- utilitaires centralisés `src/date.ts`, `src/storage.ts`, `src/utils/math.ts`, `src/utils/simulation.ts`
- gestion granulaire des erreurs Azure DevOps (`401/403/404/429/5xx`) via `src/adoErrors.ts`
- avertissement explicite en cas de chargement partiel des batches de work items
- contexte simulation unifié `src/hooks/SimulationContext.tsx`
- centralisation des accès `localStorage` via `storage.ts`
- extraction de l'export CSV throughput vers `src/utils/export.ts`
- extraction de la logique forecast vers `src/hooks/simulationForecastService.ts`
- extraction de la logique portefeuille vers `src/hooks/usePortfolio.ts`
- extraction de la génération du rapport portefeuille vers `src/hooks/usePortfolioReport.ts`
- extraction du chargement des options d'équipe vers `src/hooks/useTeamOptions.ts`
- extraction de la persistance des quick filters vers `src/hooks/useSimulationQuickFilters.ts`
- simplification du contrat de `useSimulationAutoRun` via un objet `params`
- libellés métier clarifiés dans l'UI portefeuille/simulation
- calcul du `risk score` harmonisé sur les percentiles effectivement affichés
- typages simulation segmentés (`SimulationForecastControls`, `SimulationDateRange`, `SimulationResult`, `ChartTab`)
- écran simulation chargé en lazy + import dynamique du module rapport/PDF
- accessibilité du chargement renforcée dans `SimulationResultsPanel`
- cache mémoire des options d'équipe portefeuille (`org::project::team`)
- génération du rapport portefeuille parallélisée (`Promise.allSettled`) avec progression visible
- tolérance aux échecs partiels en portefeuille
- persistance locale de la configuration rapide par scope `org::project::team`
- application manuelle de la configuration rapide depuis la modale portefeuille
- résumés du panneau simulation reformulés en libellés métier
- mode portefeuille recomposé pour une lecture plus claire des critères généraux
- rapport portefeuille PDF enrichi avec page de synthèse décisionnelle
- refonte des scénarios portefeuille: `Optimiste`, `Arrime`, `Friction`, `Historique corrélé`
- ajout d'un graphe comparatif des 4 courbes de probabilité dans le PDF
- alignement CI front sur les 4 scénarios portefeuille
- ordre des scénarios harmonisé partout
- correction d'un bug de cohérence `Risk Score` entre synthèse PDF et pages détail
- correction du déclenchement multi-téléchargements PDF
- robustesse e2e renforcée sur l'écran simulation
- `frontend/tests/e2e/coverage.spec.js` normalisé en UTF-8

### Backend et tests

- centralisation des bornes de contrat Monte Carlo dans `backend/simulation_limits.py` et
  validation `422` explicite avant simulation pour `n_sims`, `target_weeks`,
  `throughput_samples` et `backlog_size`, avec tests backend/frontend/E2E des bornes min/max
  et maintien du moteur batché sans allocation globale `n_sims x horizon`
- le moteur Monte Carlo backend n'alloue plus de matrice complète `n_sims x horizon`:
  les tirages sont maintenant exécutés par lots de taille centralisée avec un seul générateur
  pseudo-aléatoire par simulation, ce qui borne la mémoire sans casser la reproductibilité
- ajout de tests backend pour verrouiller la reproductibilité entre tailles de lots et le
  traitement correct d'un dernier lot incomplet
- `backlog_to_weeks` distingue maintenant les simulations terminées des censures à l'horizon:
  nouvelle structure `FinishWeeksSimulation`, percentiles calculés uniquement sur les
  simulations terminées, `completion_summary` persisté dans l'historique Mongo et fin exacte
  à `521` semaines distincte d'une censure
- `risk_score` backend devient absent quand `P50` ou `P90` n'est pas identifiable, sans
  remplacement silencieux par `0` ou `521`
- ajout de tests backend/frontend pour couvrir les cas limites de censures complètes, de fin
  exacte à l'horizon, d'absence de percentiles et d'absence de `Risk Score`
- ajout d'un `seed` Monte Carlo optionnel sur `POST /simulate`, valide entre `0` et `4294967295`, renvoyé dans la réponse et persisté dans l'historique Mongo pour rejouer un tirage à l'identique
- ajout de tests API et store pour garantir la reproductibilité avec un `seed` fourni, la génération automatique d'un `seed` valide, et la compatibilité des lignes d'historique legacy dépourvues de `seed`
- refonte de `Scripts/check_identity_boundary.py` autour des règles explicites `IDENTITY-001` à `IDENTITY-008`, avec collecte testable des violations sur les contrats `POST /simulate`, la persistance Mongo, l'historique backend, les proxies locaux et les appels Azure DevOps côté serveur
- ajout de `tests/test_identity_boundary.py` avec dépôts temporaires synthétiques pour verrouiller les cas conformes et les régressions interdites, sans dépendre du répertoire `AppData\Local\Temp\pytest-of-*` sous Windows
- renommage de l'étape CI en `Enforce Azure DevOps identity boundary` et maintien de son caractère bloquant avant les tests backend
- suppression de `ClientContext` du modèle API backend et persistance Mongo limitée aux seules données statistiques anonymes
- alignement du smoke test Docker CI sur le contrat courant de `POST /simulate`:
  le workflow n'envoie plus l'ancien champ `capacity_percent`, ce qui évite les `422`
  dus à `extra="forbid"` tout en gardant le garde-fou de dérive de contrat
- projection défensive de `/simulations/history` pour exclure explicitement les anciens champs sensibles Azure DevOps, même sur des documents legacy
- ajout du script `Scripts/scrub_simulation_identity.py` pour nettoyer les anciens champs d'identité Azure DevOps en `dry-run` par défaut puis `--apply`
- couverture de `backend/simulation_store.py` complétée sur les branches défensives (`connect`, `_ensure_collection`, `_run_with_reconnect`, `close`) pour supprimer la marge devenue trop juste autour de la persistance Mongo
- correction de la sémantique des percentiles Monte Carlo selon le mode:
  `backlog_to_weeks` utilise un quantile discret conservateur `higher`, `weeks_to_items`
  un quantile de survie `lower`, avec tests discrets ciblés sur l'API et `mc_core`
- remplacement du client de test `fastapi.testclient.TestClient` par un helper local basé sur `httpx` pour éviter le warning de dépréciation Starlette/FastAPI dans les tests API
- auto-réparation de l'index TTL Mongo `last_seen_1` au démarrage en cas de conflit d'options historique
- tri des imports `slowapi` dans `backend/api.py` pour conformité Ruff/isort
- découpage d'une compréhension de liste dans `tests/test_api_simulate.py` pour respecter la limite de longueur de ligne
- ajout de `tests/test_api_static.py` et couverture complétée de `backend/api.py` / `backend/api_static.py`
  sur le `lifespan` FastAPI et le montage du frontend statique, avec répertoires temporaires locaux
  au workspace pour rester stables sous Windows
- DoD et garde-fous repo alignés sur `pytest` / FastAPI plutôt que `manage.py test`
