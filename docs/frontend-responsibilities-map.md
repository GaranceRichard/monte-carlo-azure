# Cartographie factuelle des responsabilités frontend

## Statut et périmètre

Cette carte décrit le frontend observé le 13 août 2026 au commit
`4bc9b01fce83682da3e7dbd79df898461a2437b4`. Elle constitue une baseline descriptive : les noms de couches
ci-dessous servent à localiser les responsabilités actuelles, pas à prescrire une architecture cible.

Depuis cette baseline, le PBI 7.31 a fait évoluer un périmètre cohésif : le timestamp de la nouvelle entrée
d’historique de prévision passe par `FrontendClock`, `BrowserClock` porte l’accès réel et le bootstrap React
les relie par `createBrowserComposition`. Les règles de semaine/fuseau et les autres usages calendaires ne
sont pas migrés par cet outcome.

L’analyse couvre les sources exécutables sous `frontend/src/`, le point d’entrée Vite, les scripts qui
chargent le moteur TypeScript hors navigateur et les frontières navigateur, HTTP et stockage. Les tests ont
servi à confirmer les points d’entrée et les usages, mais ne sont pas attribués à une couche produit. Les
constats ont été vérifiés contre les imports statiques et dynamiques, les appels `fetch`, les accès aux API du
navigateur et les fonctions effectivement appelées.

Pour maintenir cette carte, toute évolution du frontend doit au minimum être revue depuis :

```powershell
rg --files frontend/src -g "*.ts" -g "*.tsx" -g "*.jsx" -g "!*.test.*"
rg -n "^import |^export .* from |import\(" frontend/src -g "!*.test.*"
rg -n "fetch|localStorage|document\.|window\.|globalThis\.crypto|new Date|Date\.now" frontend/src -g "!*.test.*"
```

## Points d’entrée et composition observés

| Point d’entrée | Chaîne réellement exécutée | Responsabilité actuelle |
| --- | --- | --- |
| Application navigateur | `index.html` → `src/main.tsx` → composition navigateur → `App` | Vite charge `main.tsx`, qui compose l’horloge réelle puis crée la racine React en mode strict. `App` résout le runtime, instancie les hooks d’onboarding et de simulation, initialise thème et cookie, puis compose le shell. |
| Routage d’écran interne | `App` → `AppFlowContent` → composant d’étape | Aucun routeur externe : la valeur `step` de `useOnboarding` sélectionne `PatStep`, `OrgStep`, `ProjectStep`, `TeamStep`, `SimulationStep` ou `PortfolioStep`. Les deux derniers sont chargés avec `React.lazy`. |
| Simulation d’équipe | `App` → `useSimulation` → API publique `application/team-forecast` → `localTeamForecast` | `App` construit un grand view model puis `SimulationStep` le diffuse par `SimulationContext` aux contrôles, résultats et graphiques. Le hook dépend du contrat applicatif sans dépendance retour vers React. |
| Portefeuille | `AppFlowContent` → `PortfolioStep` → `usePortfolio` → `usePortfolioReport` | Le hook de vue détient les critères et équipes ; le hook de rapport collecte, simule, diagnostique et déclenche le téléchargement. |
| Corpus TypeScript | `scripts/run-statistical-reference-corpus.mjs` → Vite SSR → `statisticalCorpusRunner.ts` | Valide le corpus par le script Python autoritaire, charge le moteur TypeScript, exécute les cas et écrit le rapport JSON sur la sortie standard. |
| Sondes de validation | `scripts/run-statistical-validation-probes.mjs` → Vite SSR → `statisticalCorpusRunner.ts` | Charge les sondes versionnées, applique la construction de commande et publie l’acceptation ou le rejet. |
| Plan distributionnel | `scripts/run-statistical-distribution.mjs` → Vite SSR → `statisticalDistributionRunner.ts` | Lit un plan JSON sur l’entrée standard, vérifie son contrat puis réutilise le runner de corpus. |
| Pont E2E | `src/e2e/runtime.ts` | Réexporte React, `createRoot`, le tri des équipes et l’historique de simulation pour l’instrumentation E2E ; ce n’est pas une composition applicative utilisateur. |

Les modes `standard`, `demo` et `connect` sont résolus par `runtime.ts` à partir de
`VITE_GITHUB_PAGES` et des paramètres `demo=true` ou `connect=true`. Le mode `connect` remplace
l’application par une notice ; le mode `demo` conserve les mêmes vues mais branche les données préparées et
le moteur TypeScript local.

## Propriétaires actuels des responsabilités

Les « propriétaires » de cette table sont les modules qui réalisent aujourd’hui le comportement. Ils ne
préjugent pas de leur emplacement futur.

| Zone observée | Fichiers propriétaires | Responsabilités et données détenues |
| --- | --- | --- |
| Composition et shell | `main.tsx`, `composition/browser/index.ts`, `App.tsx`, `AppFlowContent.tsx`, `appNavigation.ts`, `appShellSections.tsx`, `runtime.ts` | Assemblage de l’horloge réelle, montage React, choix du mode public, enchaînement des étapes, retour clavier/stepper, déconnexion et passage des view models. |
| Thème et identité navigateur | `appTheme.ts`, `clientId.ts` | Lecture/écriture du thème, application de l’attribut DOM, création et renouvellement du cookie pseudonyme `IDMontecarlo`. |
| Vues d’onboarding | `AppHeader.tsx`, `PublicConnectNotice.tsx`, `PatStep.tsx`, `OrgStep.tsx`, `ProjectStep.tsx`, `TeamStep.tsx` | Saisie du PAT et de l’URL Server/TFS, sélection organisation/collection, projet et équipe, affichage des erreurs et navigation. `TeamStep` retrie aussi les équipes pour l’affichage. |
| Vue simulation | `SimulationStep.tsx`, `SimulationControlPanel.tsx`, `SimulationHistoryRangeControls.tsx`, `SimulationModeAndParametersControls.tsx`, `SimulationFilterControls.tsx`, `SimulationResultsPanel.tsx`, `SimulationChartTabs.tsx`, `DecisionDiagnostic.tsx` | Édition des critères, lancement, affichage des percentiles/censures/diagnostics, sélection de l’historique, construction de données de graphiques supplémentaires et déclenchement CSV/PDF. |
| Vue portefeuille | `PortfolioStep.tsx` | Édition des critères portefeuille, sélection des équipes et filtres, progression, erreurs partielles et lancement du rapport. |
| Primitives et style | `components/ui/progress.tsx`, `components/ui/tabs.tsx`, `chartVisualSemantics.ts`, `index.css`, `App.css` | Adaptation de Radix, conventions visuelles des graphiques et styles globaux des écrans/rapports. |
| Orchestration onboarding | `hooks/useOnboarding.ts` | État de session du PAT et du serveur, détection Cloud/Server, appels de découverte, tri, transitions d’étapes et remise à zéro. |
| Orchestration simulation | `hooks/useSimulation.ts` | Agrégation des préférences, filtres, options d’équipe, historique, invalidation/réutilisation par signature, états de chargement, appel de prévision et view model complet. |
| Hooks spécialisés simulation | `useTeamOptions.ts`, `useSimulationPrefs.ts`, `useSimulationHistory.ts`, `useSimulationQuickFilters.ts`, `useSimulationChartData.ts` | Chargement/fallback des types et états, persistance des préférences et historiques, persistance des filtres, dérivation des séries de graphiques et résumés Cycle Time. |
| Contexte React | `hooks/SimulationContext.tsx` | Diffusion du `SimulationViewModel` complet et de l’équipe sélectionnée à tout le sous-arbre simulation. |
| Orchestration portefeuille | `hooks/usePortfolio.ts`, `hooks/usePortfolioReport.ts` | État des critères et équipes, cache mémoire des options, préférences, collecte parallèle, simulation parallèle équipes/scénarios, tolérance aux échecs partiels, diagnostic comparatif et export. |
| Contrat et implémentation de prévision | `application/team-forecast/index.ts`, `application/team-forecast/contract.ts`, `application/team-forecast/localTeamForecast.ts` | Le contrat `TeamForecast` définit collecte, simulation sur échantillons et prévision complète. L’implémentation locale sélectionne données réelles/démo, construit la commande, choisit le moteur HTTP/local, traduit les erreurs et crée l’entrée d’historique avec une seed et un instant injecté, sans importer React ni les hooks. |
| Temps de prévision | `ports/clock/index.ts`, `adapters/browser/clock/index.ts`, `composition/browser/index.ts` | Port minimal retournant l’instant ISO, lecture réelle de `Date` confinée à l’adaptateur et assemblage au bootstrap React. |
| Accès Azure DevOps | `adoClient.ts`, `adoPlatform.ts`, `adoErrors.ts` | Détection Cloud/Server, en-têtes PAT, découverte profil/organisation/collection/projet/équipe, types/états, WIQL, lots de work items, révisions, erreurs contextualisées et avertissements de collecte partielle. |
| Accès backend Monte Carlo | `api.ts`, `apiHelpers.ts`, `api/simulationDtos.ts`, `api/simulationMappers.ts` | `POST /simulate`, base d’API Vite, DTO `snake_case`, transformation commande/réponse et validation des invariants statistiques reçus. |
| Domaine statistique explicite | `domain/simulation.ts`, `domain/simulationValueObjects.ts`, `domain/histogram.ts`, `domain/riskScore.ts`, `domain/throughputReliability.ts`, `domain/sampleIndexDrawPort.ts` | Commande discriminée, Value Objects et bornes, percentiles, censures, histogramme, Risk Score, fiabilité du throughput et port minimal de tirage. |
| Modèle d’historique | `domain/simulationHistory.ts` | Forme interne de l’historique local, contexte d’équipe, critères, échantillon, résultat et avertissement. |
| Moteur et scénarios | `utils/simulation.ts`, `adapters/seededSampleIndexDrawPort.ts` | Moteur Monte Carlo local, bootstrap déterministe, scénarios portefeuille, agrégation corrélée, légende de risque et adaptateur PRNG contractuel. |
| Delivery et temps | `date.ts`, `utils/cycleTime.ts`, `types.ts` | Dates locales, semaines ISO complètes, agrégation hebdomadaire, calcul et tendances de Cycle Time, formes partagées `NamedEntity`, throughput et Cycle Time. |
| Diagnostics décisionnels | `utils/forecastDiagnostics.ts`, `utils/decisionLanguage.ts`, `utils/simulationDecisionDiagnostic.ts`, `utils/portfolioComparisonDiagnostic.ts`, `utils/portfolioComparisonPresentation.ts` | Qualité des données, incertitude, sensibilité historique, recommandation, langage utilisateur, crédibilité/stabilité des scénarios portefeuille et présentation associée. |
| Identité de résultat | `utils/simulationSignature.ts` | Canonicalisation des paramètres, signature de résultat, validation d’une entrée réutilisable et sélection de la plus récente. |
| Limites et utilitaires | `simulationLimits.ts`, `utils/math.ts`, `utils/teamSort.ts`, `utils/selectTopStart.ts` | Réexport des bornes du domaine, validation d’entrée, conversions numériques, tri et comportement de listes. |
| Démo | `demoData.ts` | Organisations, projets, équipes, historiques, Cycle Time et configurations portefeuille préparés. |
| Stockage local | `storage.ts`, `storage/simulationHistoryDtos.ts`, `storage/simulationHistoryMappers.ts` | Adaptateur `localStorage` best effort, clés de préférences/filtres, DTO versionnés, conversion modèle/stockage et migration de l’ancien Cycle Time. |
| Restitutions sortantes | `utils/export.ts`, `simulationChartsSvg.ts`, `simulationPrintReport.tsx`, `portfolioPrintReport.ts`, `simulationPdfDownload.ts` | CSV, SVG autonomes, HTML de rapport, lecture du DOM de rapport, mise en page jsPDF et téléchargement. |
| Preuve statistique frontend | `statisticalCorpusRunner.ts`, `statisticalDistributionRunner.ts` | Exécution et canonicalisation du moteur TypeScript pour corpus, sondes et cohortes distributionnelles. |

## Stockage et état

| Support | Clé ou emplacement | Producteur / lecteur | Contenu et durée observés |
| --- | --- | --- | --- |
| État React en mémoire | `useOnboarding` | `App`, vues d’étapes | PAT, URL serveur, entités sélectionnées, erreurs et étape. Le PAT n’est écrit ni dans `localStorage` ni dans le cookie applicatif. |
| État React en mémoire | `useSimulation` | sous-arbre `SimulationContext` | Critères, résultat courant, séries, diagnostics, historique chargé et états de progression. |
| État React en mémoire | `usePortfolio` / `usePortfolioReport` | `PortfolioStep` | Configurations d’équipes, critères, résultats transitoires, erreurs partielles et progression. |
| Caches mémoire | `adoClient.ts` | accès Azure DevOps | Promesses de profil PAT et de découverte Server/TFS en vol ; les entrées sont supprimées à la fin de l’appel. |
| Cache mémoire | `usePortfolio.ts` | modale d’équipe | Types et états par organisation/projet/équipe, vidé lorsque projet ou organisation change. |
| Cookie navigateur | `IDMontecarlo` | `clientId.ts`, backend via `credentials: include` | UUID v4 pseudonyme, `SameSite=Strict`, chemin `/`, durée d’un an. |
| `localStorage` | `theme` | `App.tsx`, `appTheme.ts` | Mode `light` ou `dark`. |
| `localStorage` | `mc_simulation_prefs_v2` | `useSimulationPrefs.ts` | Période, mode, zéros, objectif et nombre de simulations. |
| `localStorage` | `mc_simulation_history_v2` | `useSimulationHistory.ts` | Dix simulations connectées au maximum, avec contexte Azure DevOps détaillé et résultat. |
| `localStorage` | `mc_demo_simulation_history_v1` | `useSimulationHistory.ts` | Historique de démonstration séparé, dix entrées au maximum. |
| `localStorage` | `mc_quick_filters_v1::<org>::<project>::<team>` | `storage.ts`, hooks simulation/portefeuille | Types de tickets et états terminés, contextualisés par équipe. |
| `localStorage` | `mc_portfolio_prefs_v1` | `usePortfolio.ts`, `storage.ts` | Taux d’alignement, avec lecture compatible de l’ancienne propriété `arrimageRate`. |

Tous les accès `localStorage` sont encapsulés dans `storageGetItem`, `storageSetItem` et
`storageRemoveItem`, qui absorbent les erreurs. L’horodatage de l’entrée de prévision est injecté ; le cookie,
les UUID, le DOM, l’URL courante et les usages calendaires hors de ce périmètre restent accédés directement
par leurs consommateurs. Aucun usage de `sessionStorage` n’a été trouvé.

## Flux entrants et sortants

### Connexion et découverte Azure DevOps

```text
PAT + URL Server/TFS saisis
  -> useOnboarding (validation et état de session)
  -> adoPlatform (cible et URL normalisée)
  -> adoClient (profil/collection/organisations -> projets -> équipes)
  -> API Azure DevOps Cloud 7.1 ou Server/TFS 6.0
  -> objets {id?, name?}, triés par les hooks/vues
  -> AppFlowContent et composants d’étape
```

Le PAT est placé dans l’en-tête `Authorization: Basic` uniquement sur les appels directs Azure DevOps. Les
réponses techniques sont principalement retournées sous forme d’objets simples ; les erreurs HTTP sont
transformées en messages contextualisés par `adoErrors.ts`.

### Simulation d’équipe

```text
Contrôles React
  -> useSimulation
  -> signature de la configuration
     -> entrée locale valide trouvée : restauration sans appel externe
     -> sinon : API publique TeamForecast -> localTeamForecast.runSimulationForecast
        -> démo : demoData
        -> connecté : adoClient / WIQL / work items / révisions
        -> weeklyThroughput + cycleTimeDaysData + avertissement
        -> commande domaine normalisée + seed
        -> démo : moteur TypeScript local + PRNG
        -> connecté : DTO HTTP -> POST /simulate -> mapper de réponse
        -> FrontendClock (un instant)
        -> SimulationResult + SimulationHistoryEntry horodatée
  -> état React + localStorage
  -> résultats, graphiques, diagnostic, CSV ou PDF
```

Le backend reçoit seulement les échantillons de throughput, le mode, l’objectif actif, l’option des semaines
nulles, `n_sims` et la seed. Les identifiants Azure DevOps, le PAT, les dates, types et états ne sont pas
présents dans `SimulateRequestDto`. Le cookie pseudonyme est joint par `credentials: "include"`.

### Collecte et transformations delivery

`adoClient.ts` aligne d’abord la période sur des semaines complètes. Il construit ensuite une requête WIQL,
résout le périmètre d’équipe, charge les work items par lots de 200 puis leurs révisions. Les dates de
fermeture/résolution deviennent un compte par lundi ISO. Les transitions `New` vers un état actif puis vers
un état terminé deviennent des observations de Cycle Time en jours. Les échecs de lots ou de révisions sont
conservés sous forme d’avertissement tandis que les données disponibles continuent leur chemin.

### Portefeuille et rapport

```text
Critères + configurations d’équipes
  -> usePortfolioReport
  -> collectes d’équipes en parallèle
  -> équipes réussies + erreurs partielles
  -> échantillons indépendant / aligné / friction / historique corrélé
  -> simulations équipes et quatre scénarios en parallèle
  -> résultats + fiabilité + diagnostics équipe/portefeuille
  -> import dynamique de portfolioPrintReport
  -> données structurées -> HTML/SVG -> DOM détaché
  -> simulationPdfDownload -> jsPDF/svg2pdf -> fichier PDF
```

### Runners statistiques hors navigateur

Les scripts Node lisent les contrats JSON versionnés depuis un fichier ou l’entrée standard, démarrent Vite
en middleware SSR et chargent les runners TypeScript. Ceux-ci construisent les mêmes commandes domaine et
appellent le même moteur local et le même adaptateur PRNG que la démo. Leur unique sortie fonctionnelle est
un JSON écrit sur la sortie standard ; ils n’utilisent ni React, ni Azure DevOps, ni `localStorage`.

## Registre des transformations

| Transformation | Propriétaire actuel | Entrée → sortie |
| --- | --- | --- |
| Cible Azure DevOps | `adoPlatform.ts` | URL libre → cible Cloud/Server, racine, collection et candidats. |
| Fenêtre complète | `date.ts` | dates locales demandées → premier lundi, dernier dimanche terminé ou aucune fenêtre. |
| Périmètre équipe | `adoClient.ts` | équipe → clause Area Path exacte ou récursive, avec fallback projet/équipe. |
| Collecte delivery | `adoClient.ts` | WIQL + DTO work items/révisions → semaines de throughput, sources Cycle Time et avertissements. |
| Cycle Time | `utils/cycleTime.ts` | révisions → observations en jours → tendance glissante, bornes et résumé. |
| Entrée utilisateur | `application/team-forecast/localTeamForecast.ts` puis `domain/*` | chaînes/nombres et échantillons → commande discriminée et Value Objects validés. |
| Transport backend | `api/simulationMappers.ts` | commande `camelCase` → DTO `snake_case` ; réponse fermée → `SimulationResult` validé. |
| Simulation locale | `utils/simulation.ts` | commande + port de tirage → échantillons simulés, percentiles, censures, histogramme, Risk Score et fiabilité. |
| Horodatage de prévision | `application/team-forecast/localTeamForecast.ts` + `FrontendClock` | instant injecté lu une fois → `createdAt` et fallback d’identité de la même entrée. |
| Scénarios portefeuille | `utils/simulation.ts` | historiques de plusieurs équipes → échantillons indépendant, aligné, friction et agrégation par semaines communes. |
| Historique local | `storage/simulationHistoryMappers.ts` | modèle interne ↔ DTO version 2 ; anciennes valeurs Cycle Time sans version → jours. |
| Identité de configuration | `utils/simulationSignature.ts` | contexte et critères triés/canonisés → signature JSON ; historique → réutilisable ou non. |
| Données de graphiques | `useSimulationChartData.ts`, `SimulationChartTabs.tsx` | résultat et historique → histogramme lissé, probabilité, moyenne mobile et modèle Cycle Time. |
| Diagnostic équipe | `forecastDiagnostics.ts`, `decisionLanguage.ts`, `simulationDecisionDiagnostic.ts` | données, résultat et historique → qualité, incertitude, sensibilité et langage décisionnel/HTML. |
| Diagnostic portefeuille | `portfolioComparisonDiagnostic.ts`, `portfolioComparisonPresentation.ts` | fiabilités, scénarios et semaines communes → constats, crédibilité, risques et texte de comparaison. |
| Exports | `utils/export.ts`, modules de rapport | throughput → CSV ; modèles → SVG/HTML → DOM → PDF. |

## Dépendances vérifiées

Les relations suivantes sont directement présentes dans les imports et points d’appel actuels :

- `index.html` importe `/src/main.tsx`, qui importe la composition navigateur et `App` ; la composition
  instancie `BrowserClock`, puis `App` transmet le port à `useSimulation` ;
- `application/team-forecast/localTeamForecast.ts` importe directement `adoClient`, `api`, les mappers HTTP,
  `demoData`, l’adaptateur PRNG et le moteur de `utils/simulation.ts` ;
- `application/team-forecast/contract.ts` ne dépend que des formes du domaine et de `FrontendClock` ; le
  module ne possède aucune arête vers React, les hooks, les composants ou la présentation React ;
- `useSimulation.ts` et `usePortfolioReport.ts` importent la prévision uniquement par
  `application/team-forecast/index.ts` ; `usePortfolioReport.ts` conserve ses dépendances directes vers les
  calculs de scénarios, les diagnostics et, dynamiquement, le rapport de présentation ;
- `domain/simulationHistory.ts` importe les formes de `types.ts` et `utils/cycleTime.ts` importe des types de
  `hooks/simulationTypes.ts` ; `demoData.ts` ne dépend plus d’un type déclaré par un hook ;
- les rapports importent `hooks/probability.ts` et `hooks/simulationTypes.ts`, puis
  `simulationPdfDownload.ts` relit leurs HTML par sélecteurs DOM ;
- les frontières de prévision, d’horloge et de composition exposent des API publiques `index.ts`, conformément
  à l’autorité de dépendances ; les anciennes façades `simulationForecastService.ts` et
  `simulationForecastCore.ts` ne sont plus présentes.

## Responsabilités ambiguës, chevauchements et couplages observés

Ces écarts sont des observations de l’état courant. Une ligne résolue est conservée explicitement pour rendre
la réduction de couplage traçable ; cette carte ne décide pas l’ordre des migrations restantes.

| Identifiant | Constat factuel | Preuves dans le graphe actuel |
| --- | --- | --- |
| FE-01 | La composition technique reste distribuée entre `App` et l’implémentation locale de prévision. | Une composition frontend distincte assemble l’horloge réelle, mais `App` instancie encore les hooks et `localTeamForecast` choisit lui-même données démo/réelles, moteur local/HTTP et adaptateur PRNG. |
| FE-02 | Les hooks cumulent état React et orchestration applicative. | `useOnboarding` valide le PAT et pilote la découverte ; `useSimulation` gère cache, invalidation, persistance et exécution ; `usePortfolioReport` collecte, simule, diagnostique et exporte. |
| FE-03 | `adoClient.ts` concentre plusieurs raisons de changer. | Le même fichier contient authentification, découverte Cloud/Server, transport HTTP, construction WIQL, lots/révisions, politique d’erreur partielle, agrégation hebdomadaire et appel du calcul Cycle Time. |
| FE-04 — résolu par 7.19 | La frontière de prévision est unidirectionnelle. | Les hooks consommateurs importent l’API publique `application/team-forecast/index.ts`; le contrat et `localTeamForecast` n’importent ni React ni les hooks. Les deux anciennes façades ont été supprimées, les deux composantes cycliques observées ont disparu et la règle `team-forecast-must-remain-react-independent` interdit la dépendance retour. |
| FE-05 | L’autorité des modèles est répartie entre plusieurs zones. | Modèles dans `types.ts`, `domain/*`, `hooks/simulationTypes.ts`, DTO HTTP et DTO stockage ; `domain/simulationHistory` dépend de `types.ts`, et des utilitaires/rapports dépendent de types de hooks. |
| FE-06 | Le répertoire `utils` porte à la fois domaine, application et présentation. | `utils/simulation.ts` contient le moteur et les scénarios ; `forecastDiagnostics.ts` contient des règles décisionnelles ; `export.ts` manipule le DOM ; les modules `*Presentation` et de signature y résident aussi. |
| FE-07 | Des composants React dérivent encore des valeurs de restitution. | `SimulationChartTabs` calcule moyenne mobile, modèle Cycle Time, fiabilité et diagnostic ; `SimulationResultsPanel` recalcule une légende de risque, la fiabilité et le même diagnostic. |
| FE-08 | Les mêmes transformations de présentation sont exécutées à plusieurs endroits. | Diagnostic équipe construit dans le panneau, les graphiques et le portefeuille ; probabilité reconstruite dans le hook de graphiques et les deux rapports ; seuils de légende de risque présents dans `computeRiskLegend` et localement dans `SimulationResultsPanel`. |
| FE-09 | Les rapports dépendent de leur propre structure HTML et de noms de classes. | Les builders créent HTML/SVG puis `simulationPdfDownload.ts` recherche `.meta-row`, `.decision-diagnostic`, `.summary-table`, `.hypothesis`, `.kpi` et `.chart-wrap svg` dans un DOM détaché. |
| FE-10 | Les politiques de stockage sont partagées entre adaptateur et hooks. | `storage.ts` détient clés, sérialisation simple et compatibilité portefeuille ; les hooks choisissent limites, moments d’écriture, validation des filtres et migrations d’historique. |
| FE-11 | Plusieurs dépendances navigateur ne sont pas injectées. | L’heure de création de l’historique de prévision passe désormais par `FrontendClock`; les accès directs à `window`, `document`, `localStorage`, les autres usages de `Date`, `crypto.randomUUID`, `crypto.getRandomValues`, `Math.random`, `Blob` et `URL.createObjectURL` restent observés hors de ce périmètre. |
| FE-12 | Les flux simulation et portefeuille dupliquent la sélection de filtres. | `useTeamOptions.ts` et `usePortfolio.ts` possèdent chacun leur validation types/états, lecture des raccourcis, fallback et mise à jour d’état. |
| FE-13 | Le contexte de simulation expose une surface large. | `SimulationContext` transmet tout le `SimulationViewModel`; chaque sous-composant peut lire commandes, données, stockage, erreurs et actions sans contrat local plus étroit. |
| FE-14 | Des surfaces exportées ne participent à aucun chemin produit observé. | `listOrgsDirect`, `getWeeklyThroughputDirect`, `simulationHistoryItemDtoToModel` et `validateSimulationInputContract` n’ont aucun consommateur hors de leur déclaration ou de leurs tests ; le chemin de mapping de l’historique backend associé n’est pas appelé par l’application. |
| FE-15 | Les données de démonstration dépendent d’un type appartenant à un hook. | `demoData.ts` importe `TeamPortfolioConfig` depuis `usePortfolioReport.ts`, alors que les hooks consomment ensuite les données de démonstration. |

## Limites de la carte

- Elle décrit les dépendances sources et les flux exécutables actuels, sans mesurer leur coût de changement ;
  cette mesure relève d’un outcome ultérieur de la Feature 7.
- Elle ne qualifie pas encore l’ensemble des cycles, imports profonds ou règles autorisées à l’échelle du
  dépôt ; ce graphe transversal possède son propre outcome.
- Elle ne décide aucune frontière cible, aucun port futur et aucune migration.
- Elle ne modifie ni n’interprète les garanties statistiques : les Value Objects, moteurs, mappers et runners
  sont seulement localisés, et leurs autorités restent celles du standard et des contrats existants.
