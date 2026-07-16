# Frontend Monte Carlo Azure

Frontend React + Vite de Monte Carlo Azure.
Cette application appelle Azure DevOps directement depuis le navigateur, puis envoie uniquement des
données anonymisées de throughput au backend FastAPI pour la simulation.

## Azure DevOps Cloud et on-prem

Le frontend supporte maintenant deux modes d’accès Azure DevOps :

- Azure DevOps Cloud
- Azure DevOps Server / TFS on-premise

Règle de détection :

- URL Azure vide → mode Cloud
- hôte `dev.azure.com` ou `*.visualstudio.com` → mode Cloud
- tout autre hôte → mode on-prem

Comportement d’onboarding :

- Cloud : renseigner uniquement le `PAT`
- On-prem : renseigner le `PAT` et l’`URL Azure`
- l’URL on-prem attendue est l’URL serveur + collection
  - exemple : `https://ado.monentreprise.local/tfs/DefaultCollection`
  - exemple : `https://devops700.itp.extra/700`

Si une URL on-prem plus profonde est saisie, le frontend tente de retrouver la première collection valide
de gauche à droite, puis normalise l’URL retenue pour la suite du flux.

Important :

- le `PAT` reste côté navigateur
- aucun secret Azure DevOps n’est envoyé au backend
- les appels on-prem utilisent une `api-version` compatible serveur (`6.0`)
- les appels Cloud utilisent l’`api-version` Azure DevOps Services (`7.1`)

## Scripts utiles

Depuis `frontend/` :

```bash
npm install
npm run dev
```

Scripts disponibles :

- `npm run dev` : démarrage Vite en local
- `npm run build` : build production
- `npm run typecheck` : vérification TypeScript
- `npm run lint -- --max-warnings 0` : lint strict ESLint
- `npm run test:unit` : tests unitaires Vitest
- `npm run test:unit:coverage` : tests unitaires avec couverture
- `npm run test:e2e` : tests Playwright avec validation bloquante de l’artefact de couverture E2E
- `npm run test:e2e:coverage:console` : même validation E2E avec reporter console
- `python ../Scripts/report_vitals_coverage.py` : synthèse locale des couvertures Vitals à partir des
  artefacts générés

Couverture critique frontend :

```powershell
npm run test:unit:coverage
python ..\Scripts\report_vitals_coverage.py
powershell -NoProfile -ExecutionPolicy Bypass -File ..\.vscode\scripts\run-vitals-compliance.ps1 -WorkspaceRoot ..
```

## Capacités frontend

Le frontend couvre notamment :

- onboarding Azure DevOps (`PAT` → organisation → projet → équipe)
- support Cloud et Azure DevOps Server / TFS on-premise
- écran de simulation avec percentiles, distributions et `Risk Score`
  - `weeks_to_items` consomme directement les percentiles métier renvoyés par l’API
  - recalcul depuis l’histogramme réservé aux anciens historiques détectés en ordre legacy
  - formule centralisée dans `src/utils/simulation.ts`
  - `backlog_to_weeks` : `(P90 - P50) / P50`
  - `weeks_to_items` : `(P50 - P90) / P50`
  - en `backlog_to_weeks`, les censures à l’horizon sont exposées via `completion_summary`
  - la distribution n’affiche que les simulations terminées
  - les percentiles `backlog_to_weeks` restent indexés sur le total `n_sims` ; un `Pxx`
    absent signifie que le rang n’est pas atteignable avec le nombre de simulations terminées
  - un percentile absent n’est pas remplacé par `0` ou `521`
  - la courbe de probabilité utilise le total simulé comme dénominateur et plafonne
    au taux réel de complétion
  - le `Risk Score` n’est pas affiché si `P50` ou `P90` manque
- langage décisionnel partagé dans `src/utils/decisionLanguage.ts`
  - `buildDecisionLanguage` transforme les diagnostics existants en trois dimensions de restitution :
    qualité des données, incertitude de prévision et recommandation de décision
  - chaque dimension expose un titre, un statut lisible, la justification et les facteurs
    déjà calculés, ainsi que l’action conseillée par la recommandation existante
  - le module ne calcule aucun diagnostic et ne modifie ni les percentiles, ni le `Risk Score`,
    ni les règles de recommandation
  - il est volontairement indépendant de React ; l’interface et les exports PDF réutilisent ses
    formulations sans recalculer les diagnostics
- historique throughput aligné sur des semaines ISO complètes uniquement
  - début aligné sur le premier lundi complet inclus ou suivant `startDate`
  - fin alignée sur le dernier dimanche complet inclus ou précédant `endDate`
  - exclusion systématique de la semaine courante tant qu’elle n’est pas terminée
  - message explicite si la plage choisie ne contient aucune semaine exploitable
- historique local des simulations
- historique local contextualisé par équipe, conservé uniquement dans `localStorage`
- `Cycle Time` calculé et affiché en jours calendaires dans les cartes, graphiques, tooltips et exports PDF
- grammaire visuelle identique dans les graphiques de simulation et les SVG des rapports : observations en
  barres, points pleins ou traits continus ; tendances et lissages pointillés ; variabilité en bande ;
  probabilités en trait continu. Les légendes reproduisent le marqueur de la série affichée.
- historique local versionné : les anciennes entrées sans `schemaVersion` sont migrées une seule fois
  de semaines vers jours calendaires pour le `Cycle Time`
- mode portefeuille multi-équipes
  - scénario `Independant` : somme des tirages indépendants par équipe
  - scénario `Arrime` : réduction du scénario indépendant par le facteur d’arrimage
  - scénario `Friction` : facteur `alignmentRate^(teamCount - 1)`
  - `1` équipe conserve `100 %` de capacité ; la pénalité commence à la `2e` équipe
  - le pourcentage affiché dans le rapport reprend exactement le facteur appliqué
  - scénario `Historique corrélé` : somme des throughputs observés sur les mêmes semaines
    pour toutes les équipes, en ne conservant que l’intersection complète des semaines
  - `includeZeroWeeks` est appliqué après agrégation sur le total portefeuille
  - absence de semaine commune complète → erreur explicite
- export PDF direct des restitutions simulation et portefeuille, sans prévisualisation SVG utilisateur
  - les exports expliquent explicitement la limite d’horizon et les censures quand elles existent
  - les SVG reprennent la même convention visuelle et les mêmes légendes que l’interface
  - le rapport portefeuille conserve une synthèse chiffrée, puis consacre une page à la comparaison des
    hypothèses avant les pages détaillées des scénarios et des équipes
  - cette comparaison consomme le diagnostic métier existant et distingue qualité historique, stabilité
    simulée et crédibilité des hypothèses ; elle n’est pas affichée en détail dans l’interface de génération
  - une référence de pilotage facultative peut être transmise au rapport comme convention de gouvernance,
    sans sélection par défaut et sans modifier la recommandation issue des preuves ou les calculs
  - la pagination de la comparaison utilise un curseur vertical explicite pour les contenus multilignes
- persistance locale de certaines préférences et quick filters

## Notes de structure récentes

- `src/App.tsx` orchestre des modules plus petits :
  - `src/AppFlowContent.tsx` pour le rendu des étapes
  - `src/appNavigation.ts` pour la navigation retour
  - `src/appShellSections.tsx` pour le shell et les modes publics
- `src/appTheme.ts` pour le thème
- `src/api.ts` reste un wrapper fin ; les normalisations et fallbacks vivent dans `src/apiHelpers.ts`
- `src/hooks/simulationForecastService.ts` reste la façade forecast publique ; les branches métier sont dans `src/hooks/simulationForecastCore.ts`
- `src/date.ts` centralise les utilitaires de dates locales et l’alignement des semaines complètes sans parser `YYYY-MM-DD` en UTC
- `src/utils/cycleTime.ts` porte le calcul et les tendances du cycle time en jours calendaires pour les
  onglets simulation et l’export
- `src/hooks/useSimulationHistory.ts` migre les historiques locaux legacy sans version :
  les anciennes valeurs `Cycle Time` en semaines sont converties en jours calendaires, sans toucher au
  throughput ni à `targetWeeks`

## Contraintes d’architecture

- le `PAT` Azure DevOps reste côté navigateur
- aucun appel frontend ne doit envoyer de secret Azure DevOps au backend
- les appels backend concernent uniquement la simulation statistique et l’historique anonyme
- `POST /simulate` n’envoie jamais `selectedOrg`, `selectedProject`, `selectedTeam`, `startDate`, `endDate`,
  `types`, `doneStates`, `pat` ou `serverUrl`

## Qualité

Les commandes frontend sont orchestrées par `Scripts/quality_gate.py` selon le niveau `targeted`,
`impacted` ou `massive`. Un changement frontend isolé ne lance pas les suites backend ; une dépendance
incertaine provoque un repli vers le plan massif.

Dans le plan complet, `test:unit:coverage` remplace `test:unit` afin de ne pas exécuter deux fois les mêmes
tests. Les E2E appliquent un seuil global de 80 % sur `statements`, `branches`, `functions` et `lines`, puis
produisent `coverage/e2e-coverage-summary.json`. Les règles de fraîcheur et de cohérence de cet artefact
sont décrites dans [`../docs/definition-of-done.md`](../docs/definition-of-done.md).

## Liens utiles

- vue produit : [`../PRODUCT.md`](../PRODUCT.md)
- architecture : [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- guide principal : [`../README.md`](../README.md)
