# Monte Carlo Azure

[![CI](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml/badge.svg)](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml)

Outil d'aide à la décision basé sur une simulation Monte Carlo. L'application transforme un historique
Azure DevOps en projection probabiliste ponctuelle, sans exposer le PAT Azure DevOps au backend.

Démo GitHub Pages:

- Démo publique: [https://garancerichard.github.io/monte-carlo-azure/](https://garancerichard.github.io/monte-carlo-azure/)

## En bref

- cible: directeur de projet, PMO, responsables delivery et portefeuille
- usage: sécuriser une date, arbitrer un périmètre, dimensionner une capacité, expliciter un niveau de risque
- principe clé: le frontend appelle Azure DevOps directement; le backend ne reçoit que les données de
  throughput minimisées nécessaires au calcul

## Positionnement produit

- **Capacité actuelle — simulation ponctuelle :** produire une projection à partir des données disponibles
  au moment du calcul pour arbitrer délai, capacité et périmètre.
- **Orientation stratégique future — audit rétrospectif :** pour une livraison passée, reconstruire plusieurs
  dates d'observation, n'utiliser à chacune que les données alors disponibles, rejouer la prévision et
  confronter sa trajectoire de crédibilité au résultat réel, sans fuite d'information future.
- **Hors cible actuelle :** monitoring continu, collecte permanente et alertes en temps réel.

Le différenciateur visé est de pouvoir prévoir une livraison, puis vérifier rétrospectivement comment la
crédibilité de cette prévision évoluait à mesure que de nouvelles observations devenaient disponibles.
Cette capacité de backtesting et de calibration est inscrite au backlog ; elle n'est pas encore livrée.

## Parcours de lecture

- vision produit et valeur: [`PRODUCT.md`](PRODUCT.md)
- trajectoire produit: [`docs/roadmap.md`](docs/roadmap.md)
- registre de pilotage des Features et PBI: [`docs/backlog.md`](docs/backlog.md)
- règles transverses de gouvernance du backlog:
  [`docs/backlog-governance.md`](docs/backlog-governance.md)
- attendus détaillés des Features, PBI et sujets conditionnels:
  [`docs/backlog-expectations/`](docs/backlog-expectations/README.md)
- état courant : Feature 2 en cours, PBI 2.15 réalisé et PBI 2.16 non commencé comme prochain item
- architecture, sécurité, API, CI: [`ARCHITECTURE.md`](ARCHITECTURE.md)
  - inclut la convention de nommage: identifiants de code en anglais, textes utilisateur en français
- historique des évolutions: [`CHANGELOG.md`](CHANGELOG.md)
- guide frontend: [`frontend/README.md`](frontend/README.md)
- standard de classification, de qualité et de pilotage des tests :
  [`docs/standards/STD-TEST-001.md`](docs/standards/STD-TEST-001.md)
- contrat normatif de parité statistique :
  [`docs/standards/STD-STAT-001.md`](docs/standards/STD-STAT-001.md)
- contrat et guide du modèle de classification :
  [`docs/test-classification.md`](docs/test-classification.md),
  [`config/test-classification.json`](config/test-classification.json) et
  [`config/test-classification.schema.json`](config/test-classification.schema.json)
- contrat de gouvernance des tests ignorés, intermittents et en quarantaine :
  [`config/test-governance.json`](config/test-governance.json) et
  [`config/test-governance.schema.json`](config/test-governance.schema.json)
- Definition of Done : [`docs/definition-of-done.md`](docs/definition-of-done.md)
- chemins critiques: [`docs/critical-paths.md`](docs/critical-paths.md)
- matrice risques–contrôles: [`docs/risk-control-matrix.md`](docs/risk-control-matrix.md)
- traçabilité vitals -> tests: [`docs/vitals-traceability.md`](docs/vitals-traceability.md)
- mapping coverage vitals: [`docs/vitals-coverage-map.json`](docs/vitals-coverage-map.json)
- déploiement production: [`docs/deployment.md`](docs/deployment.md)

---

## Fonctionnalités

- connexion Azure DevOps avec PAT côté navigateur
- support Azure DevOps Cloud et Azure DevOps Server / TFS on-premise
- sélection organisation -> projet -> équipe
- mode `Portefeuille` multi-équipes
- simulation Monte Carlo côté backend (`POST /simulate`)
- support optionnel d'un `seed` de simulation pour rejouer exactement un tirage Monte Carlo
- exécution backend par lots pour borner la mémoire sans allouer de matrice complète
  `n_sims x horizon`
- contrat de simulation borné avant calcul: `n_sims` entre `1_000` et `200_000`,
  `target_weeks` entre `1` et `521`, `throughput_samples` entre `6` et `521` valeurs,
  `backlog_size` entre `1` et `1_000_000`
- Value Objects statistiques immuables et validés en Python et TypeScript pour la seed, les entrées,
  les percentiles, la fiabilité du throughput, l’histogramme et la complétion ; les DTO HTTP,
  MongoDB et `localStorage` conservent leurs formats primitifs et sont convertis explicitement aux frontières
- résolution de la seed avant toute création de commande : `backend/simulation_seed.py` produit directement
  un `SimulationSeed` avec `secrets` à la frontière HTTP, tandis que
  `frontend/src/hooks/simulationSeedResolver.ts` valide la seed explicite ou utilise une seule fois
  `crypto.getRandomValues`; l’absence de Web Crypto est une erreur explicite
- ports de tirage injectés dans les moteurs : `SampleIndexDrawPort` reçoit uniquement le nombre
  d’échantillons et la forme vectorisée côté Python, ou le nombre d’échantillons côté TypeScript ;
  les adaptateurs de production implémentent seuls le contrat commun `mca-prng-v1`, vérifié dans les deux
  langages à partir de [`contracts/mca-prng-v1-vectors.json`](contracts/mca-prng-v1-vectors.json)
- ordre logique simulation-major commun : les slots hebdomadaires d’une simulation sont contigus et leur
  affectation reste identique quelle que soit la taille des lots backend
- démo locale et simulations portefeuille reproductibles à `seed` identique
- visualisation des percentiles et distributions
- sémantique métier des percentiles alignée sur le mode de simulation:
  - `backlog_to_weeks`: `P90` = 90% des simulations finissent en `P90` semaines ou moins
    seulement si assez de simulations sont terminées pour atteindre ce rang dans `n_sims`
  - `weeks_to_items`: `P90` = 90% des simulations livrent au moins `P90` items
- en `backlog_to_weeks`, les simulations non terminées à l'horizon sont des censures explicites:
  - une fin exacte à `521` semaines reste une vraie fin, distincte d'une censure
  - la distribution et les percentiles ne couvrent que les simulations terminées
  - un percentile absent signifie qu'il n'est pas identifiable avant l'horizon
  - la courbe de probabilité utilise `n_sims` comme dénominateur et reste plafonnée
    au taux réel de complétion, sans retour artificiel à `100%`
- badge `Démo` intégré à l'en-tête des écrans démo GitHub Pages (choix d'équipe et simulation)
- lisibilité renforcée des graphes de simulation, y compris les étiquettes de l'axe X
- légendes de graphiques harmonisées, affichées seulement quand utiles et sans débordement en bas du panneau
- convention visuelle commune à l'interface et aux rapports PDF: observations en barres, points pleins ou trait continu;
  moyenne mobile, moyenne glissante et lissage en trait pointillé; intervalle de variabilité en bande;
  probabilité et prévision en trait continu. Chaque légende reproduit le style de sa série.
- calcul du `cycleTime` extrait dans un utilitaire dédié avec couverture unitaire ciblée
- `Cycle Time` affiché partout en jours calendaires (cartes, graphiques, tooltips, démo et PDF)
- affichage d'un `Risk Score` avec code couleur
  - `backlog_to_weeks`: `(P90 - P50) / P50`
  - `weeks_to_items`: `(P50 - P90) / P50`
  - arrondi normatif `round half up` à quatre décimales par le Value Object de percentiles
  - absent si `P50` ou `P90` n'est pas identifiable ou si `P50 <= 0`
  - consommé tel quel par l’API, l’interface et les rapports, sans recalcul de présentation
- trois dimensions métier distinctes et indépendantes:
  - `dataQuality` qualifie la profondeur historique, les données Azure DevOps partielles
    et les problèmes de complétude
  - `forecastUncertainty` qualifie la dispersion, la volatilité, les censures et la
    possibilité de calculer les percentiles requis
  - la recommandation d'arbitrage traduit ces deux diagnostics en `supportable`, `caution`,
    `arbitration_required` ou `not_recommended`, avec une justification, des facteurs
    déterminants et une action conseillée
  - `frontend/src/utils/decisionLanguage.ts` fournit une formulation partagée, sans modifier
    les diagnostics : titre, statut lisible, justification existante, facteurs existants et
    action conseillée. Les statuts sont :
    - qualité des données : `sufficient` → « Données suffisantes », `watch` → « Données à
      surveiller », `insufficient` → « Données insuffisantes »
    - incertitude de prévision : `low` → « Incertitude faible », `moderate` → « Incertitude
      modérée », `high` → « Incertitude élevée », `unmeasurable` → « Incertitude impossible à mesurer »
    - recommandation de décision : `supportable` → « Décision appuyée par les données »,
      `caution` → « Décision possible avec prudence », `arbitration_required` → « Arbitrage
      nécessaire », `not_recommended` → « Décision non recommandée »
- le `Risk Score` conserve son calcul actuel et ne constitue pas une mesure de qualité
  des données ni une recommandation d'arbitrage
- export CSV du throughput hebdomadaire
- téléchargement direct du rapport PDF simulation sans fenêtre intermédiaire
- historique local des dernières simulations, contextualisé par équipe dans le navigateur
- cookie client `IDMontecarlo` pour relier un identifiant pseudonyme à ses simulations persistées
- persistance MongoDB minimisée des simulations statistiques et restitution des 10 dernières via
  `/simulations/history`
- configuration rapide des filtres (types + états) mémorisée localement
- rapport portefeuille PDF direct avec progression et tolérance aux échecs partiels
- page PDF « Comparaison des hypothèses » placée après la synthèse et avant le détail des scénarios
- titres de graphiques portefeuille explicites: historique équipe, historique corrélé,
  scénario bootstrap synthétique, comparaison des probabilités, distribution Monte Carlo et probabilité
- parité décisionnelle entre l'interface et les rapports PDF: statut, justification, action conseillée,
  facteurs, qualité des données et incertitude réutilisent les diagnostics existants; les informations
  absentes ou non comparables ne sont pas affichées
- la synthèse PDF portefeuille conserve sur sa première page les résultats chiffrés et la comparaison des
  probabilités; la conclusion décisionnelle comparative reste réservée à sa page dédiée

Scénarios portefeuille:

- `Indépendant`: somme des throughputs tirés indépendamment pour chaque équipe
- `Arrimé`: `Indépendant` réduit au facteur d'arrimage configuré
- `Friction`: application d'un coût d'alignement identique par équipe supplémentaire
- `Historique corrélé`: somme des throughputs observés sur les mêmes semaines pour toutes les équipes
  afin de conserver les variations communes réellement observées

Règle scénario portefeuille `Friction`:

- le facteur appliqué est `alignmentRate^(teamCount - 1)`
- l'exposant est borné à `0`
- `1` équipe => aucune pénalité (`100%` de capacité conservée)
- la pénalité commence à partir de la `2e` équipe
- le pourcentage affiché dans le rapport correspond exactement au facteur utilisé pour la simulation

Règle scénario portefeuille `Historique corrélé`:

- l'échantillon est construit à partir des `weeklyThroughput` réels de chaque équipe
- seules les semaines calendaires communes à toutes les équipes sont conservées
- le throughput portefeuille d'une semaine est la somme des throughputs observés cette même semaine
- `includeZeroWeeks=true` conserve les totaux `>= 0`
- `includeZeroWeeks=false` conserve uniquement les totaux `> 0`
- si aucune semaine commune complète n'est disponible, le frontend renvoie une erreur explicite

Diagnostic comparatif portefeuille:

- le modèle distingue la qualité des historiques observés, la stabilité du résultat simulé et la
  crédibilité de chaque hypothèse d'agrégation
- `Indépendant` est une reconstruction bootstrap indépendante, `Arrimé` repose sur un taux saisi,
  `Friction` est dérivé de ce taux et `Historique corrélé` repose sur des semaines communes observées
- une distribution stable ne valide pas une hypothèse; un taux saisi ou dérivé ne constitue pas une preuve
- l'historique corrélé ne démontre ni la substituabilité des équipes, ni leurs relations opérationnelles,
  ni la validité future du scénario
- avec les seules données historiques, résultats simulés et taux manuel, le diagnostic ne recommande aucun
  scénario unique et conclut que les preuves sont insuffisantes
- la comparaison de crédibilité des hypothèses est disponible dans le rapport portefeuille PDF uniquement ;
  le diagnostic détaillé n'est pas réintroduit dans l'interface de génération et le rapport réutilise le même
  diagnostic sans modifier les résultats chiffrés des simulations
- une recommandation de scénario provient exclusivement des preuves du diagnostic ; une référence de
  pilotage facultative, non sélectionnée par défaut, peut être choisie par l'utilisateur comme convention de
  gouvernance, sans modifier `preferredScenario`, les calculs ou la crédibilité attribuée aux hypothèses

Règle calendrier throughput:

- l'historique hebdomadaire utilise uniquement des semaines ISO complètes
- une semaine est retenue seulement si elle commence un lundi, se termine un dimanche,
  est entièrement comprise dans la période sélectionnée et est déjà totalement écoulée
- la semaine courante n'entre jamais dans la simulation tant que son dimanche n'est pas passé
- si la période ne contient aucune semaine complète, le frontend renvoie un message explicite

Le contrat de simulation ne transporte plus de paramètre de capacité réduite:
les projections reposent uniquement sur l'historique de throughput observé.
La route `POST /simulate` isole aussi la persistance Mongo du calcul principal:
la réponse utilisateur est retournée dès que la simulation est prête, puis l'écriture
de l'historique part en arrière-plan. Si Mongo est indisponible, l'incident reste limité
à l'historique et ne bloque plus le résultat de simulation.
Pour les deux modes, le frontend consomme directement les `result_percentiles` renvoyés par le moteur ou
l’API. Un percentile absent reste absent, y compris dans un historique ancien : aucune reconstruction depuis
l’histogramme n’est autorisée.
Le `Risk Score` est calculé une seule fois par l’autorité de domaine à partir de ces percentiles, arrondi
`round half up` à quatre décimales, puis propagé tel quel vers l’API, l’historique, l’interface et les exports
PDF. Une réponse calculable qui omet ce score ou en fournit une autre valeur est rejetée ; une absence
historique reste néanmoins lisible sans être comblée.
L'interface de résultats affiche aussi un diagnostic décisionnel distinct du Risk Score :
une synthèse de recommandation et un accès à son détail dans une modale.
La modale organise cette lecture en deux colonnes décisionnelle et complémentaire sur écran large,
tout en conservant l'ordre de décision sur mobile.
Lorsque l'historique local contient des simulations comparables, cette modale mesure aussi
la sensibilité à la fenêtre choisie et aide à arbitrer entre référence récente et scénario prudent.
Toute modification d'un paramètre métier invalide immédiatement le résultat affiché, sans
recalcul automatique. Un nouveau lancement recharge d'abord la simulation locale identique
la plus récente lorsqu'elle contient toutes les données du schéma courant.
En `backlog_to_weeks`, l'API expose aussi un `completion_summary` avec `completed_count`,
`censored_count`, `censored_rate` et `horizon_weeks` pour distinguer explicitement les
simulations terminées des non-terminaisons à l'horizon. Les anciennes entrées d'historique
restent compatibles: si ce bloc manque, le frontend conserve le comportement legacy.
Le `Cycle Time`, lui, reste une restitution frontend distincte du moteur Monte Carlo:
il est calculé et affiché en jours calendaires, tandis que le throughput historique,
les modes `backlog_to_weeks` / `weeks_to_items` et `target_weeks` restent exprimés en semaines.
L'historique local des simulations embarque aussi un `schemaVersion`; les anciennes entrées
sans version sont migrées une seule fois au chargement en convertissant leurs anciennes
valeurs `Cycle Time` stockées en semaines vers des jours calendaires (`* 7`).
Les nouvelles entrées locales embarquent aussi leur `seed`: une nouvelle simulation frontend
résout une seule `seed` uint32 par exécution logique avant de créer la commande, la transmet au backend si
besoin, l'utilise
dans le moteur démo / portefeuille, puis la conserve lors d'un rejeu local. Les historiques
plus anciens sans `seed` restent lisibles et rejouables, mais sans promesse de reproductibilité
bit à bit.

---

## Architecture des simulations : DTO, domaine et persistance

Les formes de transport ne servent plus de modèles statistiques internes. La séparation introduite par le
PBI 2.3 rend chaque frontière explicite sans modifier les résultats produits :

- `backend/api_models.py` reste réservé aux DTO Pydantic de `POST /simulate` et de l'historique HTTP ;
- [`backend/simulation_models.py`](backend/simulation_models.py) définit les conteneurs métier immuables
  `SimulationCommand`, `SimulationResult`, `HistogramBucket`, `CompletionSummary` et
  `ThroughputReliability`, sans dépendance à FastAPI, Pydantic ou MongoDB ;
- [`backend/simulation_service.py`](backend/simulation_service.py) orchestre les fonctions statistiques
  existantes de `backend/mc_core.py`, puis retourne un `SimulationResult` ;
- [`backend/simulation_mappers.py`](backend/simulation_mappers.py) convertit explicitement les DTO HTTP vers
  le domaine et le résultat métier vers les DTO de réponse ou d'historique ;
- `backend/simulation_store.py` reçoit la commande et le résultat métier, puis construit à sa frontière le
  document Mongo existant.

Côté TypeScript :

- [`frontend/src/domain/`](frontend/src/domain/) contient les modèles métier en `camelCase`, indépendants de
  React, de l'API et du stockage ;
- [`frontend/src/api/`](frontend/src/api/) contient les DTO HTTP en `snake_case` et leurs mappers ;
- [`frontend/src/storage/`](frontend/src/storage/) contient le DTO `localStorage` schema v2, ses mappers et
  les migrations legacy existantes ;
- `frontend/src/types.ts` conserve uniquement les types transverses, tandis que
  `frontend/src/hooks/simulationTypes.ts` porte les types de présentation.

Le chemin backend est désormais :

```text
SimulationCommand
→ SimulateRequestDto
→ POST /simulate
→ SimulationCommand Python
→ simulation_service / mc_core
→ SimulationResult Python
→ SimulateResponseDto
→ SimulationResult TypeScript
```

Le chemin démo reste entièrement local :

```text
SimulationCommand TypeScript
→ moteur Monte Carlo TypeScript
→ SimulationResult TypeScript
```

Les hooks, le portefeuille, l'interface, les graphiques, les exports CSV et les rapports PDF consomment donc
le même `SimulationResult` métier après les deux chemins. Les contrats JSON HTTP, les documents Mongo et les
clés/formats `localStorage` restent inchangés ; aucune migration de données n'est requise. Cette évolution est
strictement structurelle : elle ne change ni formule statistique, ni PRNG, ni ordre de tirage, ni percentile,
ni censure, ni Risk Score, ni histogramme. Elle prépare les PBI 2.4 à 2.8, qui traiteront séparément les Value
Objects, l'injection des sources variables, les jeux de référence, l'alignement statistique et la gate de
parité.

---

## Sécurité

Le PAT Azure DevOps:

- est utilisé uniquement dans le navigateur de l'utilisateur
- ne transite jamais par le backend
- n'est pas sauvegardé par le serveur
- en mode Cloud, les appels partent directement vers `https://dev.azure.com` et `https://app.vssps.visualstudio.com`

Les invariants techniques et les contrôles CI associés sont documentés dans [`ARCHITECTURE.md`](ARCHITECTURE.md).

Frontière d'identité Azure DevOps :

- le navigateur conserve le `PAT`, l'URL serveur, l'organisation, le projet, l'équipe, la période, les types, les états `Done`, l'historique hebdomadaire brut, le cycle time brut en jours calendaires et l'historique utilisateur contextualisé
- `POST /simulate` transmet uniquement `throughput_samples`, `include_zero_weeks`, `mode`, `backlog_size`, `target_weeks`, `n_sims` et un `seed` optionnel
- MongoDB ne persiste que `mc_client_id`, `created_at`, `last_seen`, les paramètres Monte Carlo et les
  résultats statistiques minimisés
- `mc_client_id` est un identifiant pseudonyme non dérivé d'Azure DevOps
- `Scripts/check_identity_boundary.py` bloque en CI toute réintroduction d'un champ Azure DevOps dans le payload de simulation, les modèles backend, la persistance Mongo, l'historique serveur, les proxies locaux ou les appels Azure DevOps côté backend
- les exécutions Pytest lancées par la couverture VS Code utilisent un temporaire isolé dans le workspace ;
  elles ne dépendent pas du répertoire temporaire global de l’utilisateur

---

## Prérequis

- Python 3.10+
- Node.js `^20.19.0` ou `>=22.12.0`
- accès Azure DevOps + PAT
- Docker (optionnel, recommandé pour un déploiement rapide)

## Quick Start (Docker)

```bash
cp .env.example .env
docker compose up -d --build
curl -sS http://127.0.0.1:8000/health
```

Application disponible sur:

- `http://127.0.0.1:8000`

## Lancer en développement

Option rapide (Windows PowerShell, 4 terminaux: mongo + backend + frontend + health):

```powershell
.\start-dev.ps1 -ThreeTerminals
```

Le terminal health vérifie `http://127.0.0.1:8000/health` et `http://127.0.0.1:8000/health/mongo` en boucle (intervalle par défaut: 5s).
Dans VS Code, `Ctrl+Shift+B` lance aussi la tâche par défaut `Dev: 5 terminaux`.

### Backend

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run_app.py
```

API: `http://127.0.0.1:8000`

Note rate limiting:
`APP_REDIS_URL` est inutile en développement local avec un seul processus `python run_app.py`.
Laissez cette variable absente pour conserver le backend `memory://`.
Elle devient requise en production quand l'API tourne avec plusieurs workers, sinon la limite est comptée séparément par processus.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: `http://localhost:5173`

Pour émuler le build GitHub Pages localement:

```powershell
$env:VITE_GITHUB_PAGES="true"
npm run build
```

Le workflow GitHub Pages retente une fois `actions/deploy-pages` si GitHub retourne un échec transitoire après création de l'artefact de déploiement.
Le smoke test Docker de la CI utilise aussi un payload `POST /simulate` strictement aligné
sur le contrat statistique courant (`throughput_samples`, `mode`, `backlog_size`, `target_weeks`,
`n_sims`, `include_zero_weeks`) afin de détecter toute dérive de contrat sans réintroduire
d'ancien champ refusé par l'API.

Sur GitHub Pages, la démo publique précharge les données puis laisse l’utilisateur choisir son point d’entrée.
Le mode démo est activé par `?demo=true` ou par le build GitHub Pages ; le wording et le badge `Démo` ne sont pas affichés en fonctionnement local ou Azure DevOps normal.

- `Simulation` pour ouvrir une équipe et ses graphiques/détail
- `Portefeuille` pour comparer plusieurs équipes et générer un rapport consolidé

Le frontend détecte automatiquement le mode Azure DevOps à partir de l'URL saisie :

- URL vide ou hôte `dev.azure.com` / `*.visualstudio.com` => Cloud
- tout autre hôte => on-prem

En on-prem, l'URL attendue est l'URL serveur + collection, par exemple :

- `https://ado.monentreprise.local/tfs/DefaultCollection`
- `https://devops700.itp.extra/700`

Le détail du flux Cloud / on-prem est documenté dans [`frontend/README.md`](frontend/README.md).

En E2E local, Playwright force aussi `VITE_API_BASE=http://127.0.0.1:8000` pour garder les mocks backend cohérents avec les appels `simulate` et `simulations/history`.
En CI GitHub Actions, `preflight` choisit le profil selon l’événement, puis les jobs `backend-static`,
`frontend-static`, `backend-tests`, `frontend-tests`, `e2e` et `release-or-container-checks` exécutent les
branches indépendantes sur des runners séparés. `aggregate` attend toutes les branches ; la publication
GHCR sur un push `main` dépend de cet agrégateur. Le déploiement GitHub Pages attend le succès du workflow
CI du même SHA avant de construire et publier le frontend.

Les actions JavaScript du workflow utilisent nativement Node 24 : `actions/checkout@v6`,
`actions/setup-python@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`,
`actions/download-artifact@v8`, `docker/login-action@v4` et `docker/build-push-action@v7`. Le workflow ne
définit pas `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` ; la conformité du dépôt bloque toute ancienne version de
ces actions et toute réintroduction de ce forçage.

Chaque runner installe ses propres dépendances. En particulier, `backend-tests` prépare Python et Node 22,
active le cache npm puis exécute `npm --prefix frontend ci` avant la quality gate. Les tests Pytest de
classification peuvent ainsi charger `frontend/node_modules/typescript/lib/typescript.js` et importer
`frontend/playwright.config.js`, qui dépend de `@playwright/test`. Ce job n’installe pas les navigateurs
Playwright : cette responsabilité reste limitée au job `e2e`.
Le job `aggregate` configure également Node 22, le cache npm et ces dépendances avant son agrégateur final,
car le contrôle de gouvernance redécouvre les tests Vitest et Playwright avec TypeScript.

Les jobs producteurs publient tous `reports/test-execution-artifacts`. Le job `aggregate` télécharge et
fusionne leurs preuves directement dans ce même répertoire, afin de reconstituer
`<profil>/<nœud>/…`. `_promote_artifacts()` peut alors retrouver et promouvoir les couvertures et résultats
backend, Vitest et E2E sans modifier les chemins internes du DAG.

### Mode manuel en 5 terminaux

Terminal 1 (mongo local dev):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\.vscode\scripts\start-mongo-dev.ps1 -DbPath .\.local-mongo\db -Port 27017
```

Terminal 2 (backend):

```powershell
$env:APP_MONGO_URL="mongodb://127.0.0.1:27017"
$env:APP_MONGO_DB="montecarlo"
python run_app.py --no-browser
```

Terminal 3 (frontend):

```powershell
npm --prefix frontend run dev
```

Terminal 4 (contrôle récurrent health):

```powershell
while ($true) { try { Invoke-RestMethod http://127.0.0.1:8000/health -TimeoutSec 2 | ConvertTo-Json -Compress } catch { Write-Host $_.Exception.Message }; Start-Sleep -Seconds 5 }
```

Terminal 5 (contrôle récurrent health Mongo):

```powershell
while ($true) { try { Invoke-RestMethod http://127.0.0.1:8000/health/mongo -TimeoutSec 2 | ConvertTo-Json -Compress } catch { Write-Host $_.Exception.Message }; Start-Sleep -Seconds 5 }
```

---

## Tests et couverture

Le modèle versionné de classification des cas logiques est décrit dans
[`docs/test-classification.md`](docs/test-classification.md). Il sépare nature, finalités, profil
d'exécution, domaines et criticité. L’inventaire déterministe du patrimoine Pytest, Vitest et Playwright se
reconstruit depuis la racine avec :

```bash
python Scripts/classify_tests.py
```

Le résultat est versionné dans
[`reports/test-classification-inventory.json`](reports/test-classification-inventory.json). Les règles et
exceptions auditables résident respectivement dans
[`config/test-classification-rules.json`](config/test-classification-rules.json) et
[`config/test-classification-overrides.json`](config/test-classification-overrides.json). La classification
est bloquante : le contrôle en lecture seule redécouvre les cas et compare exactement l'inventaire généré au
fichier versionné.

Le DAG commun est versionné dans
[`config/test-execution-profiles.json`](config/test-execution-profiles.json), validé par
[`config/test-execution-profiles.schema.json`](config/test-execution-profiles.schema.json) et rendu de façon
déterministe dans [`reports/test-execution-plan.json`](reports/test-execution-plan.json). Sa hiérarchie est
`pr = pr`, `main = pr + main`, `nightly = pr + main + nightly` et
`release = pr + main + release`.

```bash
python Scripts/check_test_classification.py
```

Après ajout, suppression, renommage ou modification d'un test, exécutez `python Scripts/classify_tests.py`,
les suites complètes Pytest, Vitest et Playwright, puis `python Scripts/report_test_execution_counts.py` et le
diagnostic ci-dessus. La gate refuse tout cas absent, obsolète, dupliqué, invalide ou `unresolved`, tout
override orphelin ou sans preuve et toute exemption incomplète ou expirée. Le dépôt courant conserve zéro
override, zéro exemption et zéro `unresolved`.

Le comptage d'exécution est distinct de cet inventaire. Après une exécution complète de chaque framework,
les hooks/reporters natifs écrivent les artefacts intermédiaires ignorés par Git, puis la commande suivante
produit le rapport consolidé versionné :

```bash
python -m pytest -q
npm --prefix frontend run test:unit
npm --prefix frontend run test:e2e
python Scripts/report_test_execution_counts.py
```

[`reports/test-execution-counts.json`](reports/test-execution-counts.json) expose les cas logiques, les
instances collectées et exécutées, les skips, les tentatives et les retries globalement, par framework,
statut, nature, profil et `logicalCaseId`. Son empreinte SHA-256 identifie exactement l'inventaire de classification
utilisé. Le rapport est trié et ne contient ni timestamp, durée, chemin absolu ni autre donnée volatile.

La gouvernance reste un contrat distinct de la classification. La commande suivante détecte par AST les
`skip`, désactivations, expected failures, quarantaines, marqueurs inconnus et retries de Pytest, Vitest et
Playwright, valide responsables, tickets, risques et échéances, puis consolide les résultats du profil :

```bash
python Scripts/check_test_governance.py --profile main --require-runtime
```

Le contrat [`config/test-governance.json`](config/test-governance.json) cible les mêmes `logicalCaseId`, sans
modifier leur classification. Toute entrée doit être exacte, non expirée et rattachée à un mécanisme détecté.
Un test critique ne peut pas être ignoré ; une quarantaine critique exige une mesure compensatoire et reste
exécutée dans son profil. Les retries globaux sont refusés. Lorsqu'un retry gouverné existe, les reporters
conservent `attemptResults`, `initialResult`, le nombre de tentatives et `finalResult`, de sorte que le premier
échec ne puisse jamais disparaître.

[`reports/test-governance-report.json`](reports/test-governance-report.json) est l'artefact consolidé destiné
au reporting du PBI 1.10 : nombres par état, détails, expirations, tentatives et taux d'instabilité. Le contrôle
`Test governance compliance` apparaît exactement une fois dans chaque plan et s'exécute dans `aggregate`,
après les producteurs de preuves natives pour les plans complets.

Le reporting stratégique consolide ces preuves sans relancer Pytest, Vitest ou Playwright :

```bash
python Scripts/report_test_strategy.py --profile main
```

Le contrat machine strict [`config/test-strategy-report.schema.json`](config/test-strategy-report.schema.json)
encadre [`reports/test-strategy-report.json`](reports/test-strategy-report.json), tandis que
[`reports/test-strategy-report.md`](reports/test-strategy-report.md) est rendu depuis le même modèle en mémoire.
`globalReference` décrit tout le patrimoine connu ; `profileExecution` décrit uniquement la sélection et les
preuves du profil demandé ; `strategicCoverage` rend visibles les dimensions démontrées et celles qui restent
`not_measured`. `qualityGateStatus` conclut sur les règles actuellement applicables (`compliant`,
`non_compliant` ou `incomplete_evidence`) et `strategyEvidenceStatus` indique séparément si toutes les
dimensions du standard sont mesurées. Une gate peut donc être conforme alors que la preuve stratégique reste
incomplète, sans score agrégé ni preuve inventée.

Chaque source consommée apparaît dans un manifest avec son empreinte et ses états de présence, validité,
fraîcheur et cohérence. `evidenceBundleId` identifie déterministement cet ensemble exact de fichiers ; il ne
prouve pas qu'ils proviennent de la même exécution physique. La fraîcheur E2E réutilise sa fenêtre
contractuelle ; aucune fenêtre arbitraire n'est ajoutée pour Pytest ou Vitest. Le nœud `aggregate` vérifie la
référence globale versionnée, produit Vitals et gouvernance, puis écrit les deux restitutions une seule fois.
Le rapport n'exige pas le `result.json` final de son propre nœud : ce succès reste attesté par le code de sortie
de la gate et par la CI. Les fichiers sous `reports/` sont les snapshots versionnés ; les artefacts uploadés par
GitHub Actions prouvent l'exécution distante correspondante et ne remplacent pas ces snapshots.

Depuis la racine:

```bash
python Scripts/quality_gate.py fast
python Scripts/quality_gate.py push
python Scripts/quality_gate.py ci
python Scripts/quality_gate.py nightly
python Scripts/quality_gate.py release
```

Le plan est construit à partir des chemins réellement modifiés, puis classé selon trois niveaux :

- `targeted` : tests directement rattachables à un changement local ;
- `impacted` : contrôles du domaine concerné et tests des dépendances proches ;
- `massive` : plan complet pour les changements transverses, structurels ou incertains.

Un chemin inconnu, une dépendance impossible à résoudre ou une ambiguïté provoque toujours un repli
conservateur vers `massive`. Un changement backend seul ne lance pas les suites frontend, et
réciproquement. Un changement mixte agrège les commandes sans doublon.

Les modes ne lisent pas le même état du dépôt :

- `fast`, appelé par le pré-commit, prend la liste des fichiers dans `git diff --cached` et exécute tous
  ses contrôles dans un instantané du contenu indexé. Une modification non indexée ne peut donc ni faire
  réussir ni faire échouer le hook ;
- `push`, appelé par le pré-push, interprète les références fournies par Git, calcule les commits et les
  fichiers introduits, puis valide une seule fois le SHA terminal de chaque référence dans un worktree
  détaché temporaire. Les suppressions de références n’exécutent pas de suite et le workspace courant,
  même sale, est ignoré ;
- `ci`, réservé à GitHub Actions, reçoit explicitement `--profile pr|main|nightly|release` et
  `--node <id>` ; les dépendances sont installées par chaque job, jamais par la gate ;
- `nightly` et `release` rendent les profils homonymes disponibles pour une validation locale explicite.

Le profil est orthogonal au niveau `targeted`, `impacted` ou `massive` : le premier sélectionne les cas par
sa hiérarchie d’inclusion, le second limite la portée de `fast`. À partir de `preflight`, les branches
statiques, backend, frontend, E2E et release/conteneur sont parallélisables. Leurs rapports et couvertures
intermédiaires utilisent `reports/test-execution-artifacts/<profil>/<nœud>/`; seul `aggregate`, qui dépend de
toutes les branches, consolide le plan final. Deux nœuds sans relation de dépendance ne peuvent déclarer ni
le même artefact écrit ni la même ressource exclusive.

Les worktrees détachés réutilisent les dépendances frontend par lien symbolique sous POSIX et, seulement si
ce lien échoue sous Windows, par jonction `mklink /J`. Les tests de plateforme simulent le seam
`_is_windows()` sans remplacer globalement `os.name`, ce qui conserve les chemins natifs de l’hôte.
Ce seam couvre aussi le retry des suppressions read-only : les branches Windows et POSIX sont exécutées
par des tests unitaires sur tous les systèmes. Les seuls skips de plateforme conservés vérifient les
attributs read-only réels de Windows et ne laissent aucune ligne Python non couverte sous Linux.

Dans toute validation isolée, la gate transmet aussi `MONTECARLO_E2E_PYTHON` avec l’interpréteur Python
hôte aux chemins séquentiel, parallèle et de nœud sélectionné, afin que le serveur Playwright du worktree
réutilise les dépendances Python hôte.

Dans un plan complet `main`, `nightly` ou `release`, les suites avec couverture remplacent les mêmes suites simples :
Pytest n’est pas exécuté une première fois sans couverture, et Vitest n’est pas exécuté une première fois
via `test:unit`. L’ordre interne de chaque nœud reste déterministe ; les nœuds indépendants ne sont plus
forcés dans un ordre global séquentiel.

La définition normative des niveaux de validation, des seuils et de la publiabilité se trouve dans
[`docs/definition-of-done.md`](docs/definition-of-done.md). La consommation détaillée des artefacts Vitals
est décrite dans [`docs/vitals-traceability.md`](docs/vitals-traceability.md).

Le ratchet de maintenabilité bloque uniquement une dette nouvelle ou aggravée sur la taille, la complexité,
les cycles, les directions de dépendance démontrables et le mojibake. Ses règles, sa baseline versionnée et
sa procédure explicite de mise à jour sont décrites dans
[`docs/maintainability.md`](docs/maintainability.md).
Les plafonds bloquants sont de 350 lignes non vides et 50 points de complexité par fichier, puis de
50 lignes non vides et 15 points de complexité par fonction. La synthèse de
[`docs/backlog.md`](docs/backlog.md) et la répartition des reliquats de gouvernance sont générées depuis les
tables de PBI ; `python Scripts/check_backlog_consistency.py` bloque toute nouvelle divergence.

### Variables d'environnement Mongo / purge

- `APP_MONGO_URL` (ex: `mongodb://mongo:27017`)
- `APP_MONGO_DB` (défaut: `montecarlo`)
- `APP_MONGO_COLLECTION_SIMULATIONS` (défaut: `simulations`)
- `APP_MONGO_MIN_POOL_SIZE` (défaut: `5`)
- `APP_MONGO_MAX_POOL_SIZE` (défaut: `20`)
- `APP_MONGO_SERVER_SELECTION_TIMEOUT_MS` (défaut: `2000`)
- `APP_MONGO_CONNECT_TIMEOUT_MS` (défaut: `2000`)
- `APP_MONGO_SOCKET_TIMEOUT_MS` (défaut: `5000`)
- `APP_MONGO_MAX_IDLE_TIME_MS` (défaut: `60000`)
- `APP_SIMULATION_HISTORY_LIMIT` (défaut: `10`)
- `APP_PURGE_RETENTION_DAYS` (défaut script purge: `30`)

Variable d'environnement rate limiting:

- `APP_RATE_LIMIT_SIMULATE` (défaut: `20/minute`)
- `APP_REDIS_URL` uniquement en production multi-workers; ne pas la définir en développement local

Variable d'environnement simulation:

- `APP_FORECAST_TIMEOUT_SECONDS` (défaut: `30`)
  - applique un timeout de réponse sur `POST /simulate`
  - le calcul NumPy continue jusqu'à sa fin dans son thread si le délai est dépassé, mais l'API rend immédiatement un `503`

Comportement du `seed` de simulation:

- `POST /simulate` accepte un `seed` entier optionnel entre `0` et `4294967295`
- à payload identique, renvoyer le même `seed` reproduit strictement le même résultat avec la version
  courante du moteur et du contrat aléatoire
- si aucun `seed` n'est fourni, le backend en génère un automatiquement et le renvoie dans la réponse
- la génération backend utilise `secrets` directement dans `0..4294967295` et retourne un
  `SimulationSeed` validé avant la création de la commande
- côté backend, `run_simulation` construit un seul adaptateur `mca-prng-v1` depuis la seed de la commande ;
  cet adaptateur conserve un état uint32 unique et traite les matrices en ordre C / row-major, sans
  réensemencement entre deux demandes
- l'historique Mongo persiste aussi ce `seed` pour faciliter l'analyse a posteriori d'une simulation
- côté frontend, une exécution logique ne consomme qu'une seule `seed`; le rejeu d'une entrée
  locale réemploie cette même `seed` tant que ses paramètres restent inchangés
- côté frontend, une seed absente est générée directement par `crypto.getRandomValues`; aucun repli
  `Date.now() >>> 0`, aucune troncature et aucune normalisation silencieuse ne sont autorisés
- côté frontend, le chemin démo/local compose un unique adaptateur `mca-prng-v1` par simulation et le
  bootstrap portefeuille en compose un depuis la seed optimiste déjà résolue ; le chemin HTTP transmet
  uniquement la seed au backend et ne construit aucun générateur local
- `mca-prng-v1` part d'une seed et d'un état dans `0..4294967295`, produit une sortie uint32 sans
  transition flottante, puis calcule l'indice par `floor(value * sampleCount / 2^32)`, sans réduction
  modulo ; la transition normative complète est décrite dans
  [`ARCHITECTURE.md`](ARCHITECTURE.md#port-de-tirage-dindices)
- les vecteurs canoniques figés couvrent les sorties uint32 et les indices d'échantillonnage ; Python et
  TypeScript lisent exactement le même fichier, distinct du futur corpus statistique
- l’ordre canonique parcourt d’abord les simulations, puis les semaines : le slot logique
  `(simulationIndex, weekIndex)` correspond à l’offset
  `simulationIndex * drawSlotsPerSimulation + weekIndex` dans la suite `mca-prng-v1`
- `drawSlotsPerSimulation` vaut `521` en `backlog_to_weeks` et `target_weeks` en `weeks_to_items` ; une fin
  anticipée ignore les slots restants pour le résultat mais les réserve avant la simulation suivante
- le backend peut découper les lignes contiguës en lots divisibles ou non divisibles sans changer cette
  affectation ; le frontend avance directement l’état sur les slots inutilisés, sans calculer leurs indices
- le changement d’ordre du PBI 2.8 peut modifier le rejeu local `backlog_to_weeks` d’une seed antérieure ;
  les tirages backend adoptés au PBI 2.7 et le mode `weeks_to_items` conservent leur ordre
- les résultats déjà persistés restent inchangés : aucun historique n'est supprimé ou migré, et aucun
  identifiant de PRNG n'est ajouté aux DTO, au JSON, à MongoDB ou à `localStorage`
- les formules de percentiles, Risk Score, fiabilité et histogrammes ne sont pas modifiées par cette règle ;
  le corpus statistique partagé commence au PBI 2.9
- la version externe du contrat et les règles de migration relèvent du PBI 2.20

## Corpus de référence statistique `1.0`

Le format partagé est défini par
[`contracts/statistical-reference-corpus-v1.0.schema.json`](contracts/statistical-reference-corpus-v1.0.schema.json),
un JSON Schema draft 2020-12 fermé à toute propriété inconnue. Chaque cas relie une entrée statistique
normalisée, une seed uint32 consommée par `mca-prng-v1`, un résultat normatif attendu et un niveau de preuve
`algorithmic`, `deterministic`, `replay` ou `distributional` issu de `STD-STAT-001`.

Le schéma discrimine les deux modes et impose leurs paramètres actifs, les bornes existantes, la forme des
percentiles, histogrammes, métriques de fiabilité et résumés de complétion. Les relations arithmétiques
interchamps non exprimables en JSON Schema standard sont consignées comme invariants normatifs, sans
extension propre à Python, TypeScript ou un validateur particulier. Le détail du contrat et de son
versionnement est dans
[`docs/statistical-reference-corpus.md`](docs/statistical-reference-corpus.md).

Le corpus normatif
[`contracts/statistical-reference-corpus-v1.0.json`](contracts/statistical-reference-corpus-v1.0.json)
contient les cinq cas minimaux du PBI 2.10 :

- `weeks_to_items` avec exclusion d’un zéro et percentiles de survie `P50 = 3`, `P70 = 2`, `P90 = 1` ;
- `backlog_to_weeks` avec zéro conservé, aucune censure et percentiles croissants `2`, `3`, `4` ;
- une fin certaine exactement en semaine `521`, distincte d’une censure ;
- une censure partielle avec 748 fins et 252 censures : P50 et P70 sont identifiables, P90 est absent ;
- une censure totale sans durée terminée ni percentile fabriqué.

Les résultats sont dérivés explicitement de `STD-STAT-001`, des vecteurs `mca-prng-v1` et de l’ordre
simulation-major. Les tables de tirages, cumuls et rangs sont publiées dans la documentation du corpus ;
aucun moteur Python ou TypeScript n’a servi d’oracle.

Le PBI 2.11 ajoute dix cas sans modifier les cinq précédents :

- Risk Score calculé et arrondi à `0.6667`, absent avec P90 manquant, puis absent avec P50 nul ;
- seuils exacts après `round half up` : CV `0.5/1/1.5`, IQR relatif `0.5/1` et pente normalisée
  `0.05/0.10/-0.15`, avec les quatre labels et leur priorité ;
- histogramme exact à six valeurs, histogramme continu `0..100` agrégé en 51 représentants pairs de
  `0` à `100`, puis plage `0..99 + 10000` représentée par `50` et `9999` ;
- masse totale `1000`, buckets non vides, ordre strict, bornes réelles et comptes exacts.

Ces cas matérialisent les divergences ST-24/D-02, ST-25, ST-30/D-03 et ST-33 de l’audit, notamment les
anciens centres `50/9951` et `51/10050`, sans aligner les moteurs.

Le contrôle autonome valide le métaschème, le corpus, ses invariants interchamps et sa complétude
2.10/2.11/2.14/2.15.
Il recalcule indépendamment les gardes/formules du score, les métriques et labels normalisés, protège les
résultats spécialisés et les représentants de buckets, et refuse les scénarios dupliqués. Il applique aussi
24 probes minimaux prouvant le rejet des types et bornes invalides, des zéros laissant moins de six
observations utiles, des paramètres absents ou inactifs et des champs hors contrat. L’exemple positif trivial
et le contre-exemple fermé restent des preuves structurelles séparées. Les diagnostics sont localisés par
JSON Pointer :

```bash
.venv\Scripts\python.exe Scripts/validate_statistical_reference_corpus.py
```

Le PBI 2.12 exécute désormais ces quinze cas dans les moteurs Python et TypeScript, après validation
complète du schéma et du corpus :

```bash
.venv\Scripts\python.exe Scripts/run_statistical_reference_corpus.py
```

Le runner Python appelle le service statistique métier ; le runner TypeScript appelle le moteur local via
son port `mca-prng-v1`. Chacun convertit uniquement les noms et Value Objects dans la forme canonique
`expected_result` : aucune valeur absente n’est fabriquée, aucun histogramme n’est trié et aucune tolérance
ou nouvel arrondi n’est appliqué. Le comparateur produit
[`reports/statistical-parity-report.json`](reports/statistical-parity-report.json), exploitable en CI, et
[`reports/statistical-parity-report.md`](reports/statistical-parity-report.md), lisible en revue.

Les statuts distinguent `schema_invalid` ou `corpus_invalid`, `engine_error`,
`normative_divergence` et `engine_divergence`. Une divergence statistique laisse la commande verte parce
que le contrôle reste informatif dans 2.12 ; un corpus inexécutable ou une erreur moteur rend la commande
en échec. Le profil `main` ne lance pas ce contrôle avant le PBI 2.19.

Le PBI 2.15 ajoute une seizième référence dédiée à sept observations. L’exécution courante trouve donc
14 cas entièrement conformes et deux divergences d’histogrammes déjà attendues
par l’audit : Python produit 100 buckets et TypeScript 51 centres impairs pour `0..100`; sur
`0..99 + 10000`, les représentants sont `50/9951` en Python et `51/10050` en TypeScript, contre
`50/9999` dans la norme.

Le PBI 2.13 aligne désormais, avant tout calcul, les validations normalisées des deux moteurs : tableau
fermé de 6 à 521 entiers finis positifs ou nuls, au moins six observations après application de la règle
des zéros, bornes communes, seed `uint32`, entrée fermée et présence exclusive du paramètre actif. Les
frontières de transport résolvent les mêmes valeurs par défaut (`include_zero_weeks = false`,
`n_sims = 20000`) puis transmettent des primitives aux Value Objects.

La réponse canonique exige `result_kind`, les percentiles présents seulement, la distribution,
`samples_count`, la fiabilité et la seed. Le Risk Score et la complétion sont strictement omis lorsqu’ils
sont indisponibles : `0`, `null`, `NaN`, chaîne vide et toute autre sentinelle sont refusés. Les DTO,
payloads API, documents MongoDB et objets `localStorage` restent des frontières primitives ; aucun objet
métier ne les franchit.

Le fichier partagé
[`contracts/statistical-validation-probes-v1.0.json`](contracts/statistical-validation-probes-v1.0.json)
porte 22 sondes positives et négatives, toutes concordantes entre Python et TypeScript dans le rapport de
parité. Ces sondes de validation ne modifient aucune formule statistique.

Le PBI 2.14 réutilise six cas normatifs discriminants du corpus et aligne les deux moteurs sur les censures,
les rangs `ceil(p × n_sims / 100)` de `backlog_to_weeks`, les quantiles de survie discrets de
`weeks_to_items` et P50/P70/P90 uniquement. Les non-terminaisons ne sont plus codées comme une durée
`521` interne : seules les durées terminées sont conservées avec la taille totale de population. Une fin
exacte en semaine `521` reste une fin.

Le Value Object `SimulationPercentiles` est l’autorité unique du Risk Score dans les deux langages. Il
applique la formule du mode et un arrondi rationnel `round half up` à quatre décimales ; les frontières
vérifient cette valeur et les consommateurs la propagent sans recalcul. P90 censuré, P50 manquant ou
`P50 <= 0` conservent l’absence du score. Aucun percentile absent n’est reconstruit depuis une distribution,
même pour un historique ancien.

Le PBI 2.15 centralise ensuite le calcul de fiabilité dans un calculateur de domaine et un Value Object par
langage. Les deux moteurs utilisent la moyenne arithmétique, la variance et l’écart-type de population, les
quartiles linéaires, la pente des moindres carrés avec `x[i] = i`, puis normalisent `cv`, `iqr_ratio` et
`slope_norm` à quatre décimales par `round half up` avant toute comparaison. Python ne dépend plus de
`numpy.percentile` ni de `numpy.polyfit`; le moteur et les consommateurs TypeScript ne portent plus de
calcul concurrent.

La catégorisation suit strictement `non fiable`, `fragile`, `incertain`, puis `fiable`. Une série
initialement fiable de six ou sept observations est ensuite dégradée en `incertain`. Le corpus conserve la
preuve à six observations et ajoute `reliability-seven-observations-degraded` : pour
`9,9,10,10,10,11,11`, la moyenne vaut `10`, la variance de population `4/7`, les quartiles
`9.5/10/10.5` et la pente normalisée `1/28`; les métriques exposées sont donc
`0.0756/0.1000/0.0357` et le label final `incertain`.

Le rapport reste à 14 cas intégralement conformes et deux divergences limitées aux histogrammes agrégés,
réservés au PBI 2.16. Le rejeu exact demeure réservé au PBI 2.17 et le contrôle de parité reste informatif
jusqu’au PBI 2.19.

Purge planifiée:

```bash
python Scripts/purge_inactive_clients.py
```

Nettoyage des anciens champs d'identité Azure DevOps dans Mongo:

```bash
.venv\Scripts\python.exe Scripts/scrub_simulation_identity.py
.venv\Scripts\python.exe Scripts/scrub_simulation_identity.py --apply
```

Le script est en `dry-run` par défaut et supprime uniquement les anciens champs sensibles via `$unset` en mode `--apply`.

Suite E2E découpée:

- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/selection.spec.js`
- `frontend/tests/e2e/simulation.spec.js`
- `frontend/tests/e2e/coverage.spec.js`

Sous Windows/VS Code, la couverture Python utilise un `--basetemp` unique sous
`.tmp/pytest/coverage-staged-<PID>-<GUID>`. Seul le répertoire créé par l’exécution courante est supprimé,
y compris après un échec ou une interruption ; le répertoire temporaire global de l’utilisateur n’est
jamais supprimé.
Le périmètre Python est déclaré une seule fois dans `.coveragerc`, avec couverture de branche active.
`Scripts/check_python_coverage.py` vérifie qu’aucun fichier Python exécutable versionné n’est absent du
rapport, que les seuils global et par fichier restent respectés et qu’aucune ligne exécutable ne reste
non couverte. Les tests sont exclus du périmètre mesuré, pas de l’exécution Pytest.
Le projet désactive aussi le cacheprovider pytest via `pytest.ini` (`-p no:cacheprovider`) pour supprimer les warnings d'écriture `.pytest_cache` en environnement restreint.
Pour la couverture frontend Vitest sous Windows, le projet utilise une exécution stable (`pool: "forks"` et `coverage.processingConcurrency: 1` dans `frontend/vitest.config.js`) afin d'éviter les pannes d'agrégation V8 de type `ENOENT ... frontend\coverage\.tmp\coverage-*.json`.
Dans ce repo, une ligne rouge dans le détail d'un rapport de coverage est considérée comme invalide et doit être couverte avant de considérer la tâche acceptable, même si les seuils globaux restent verts.
Le coverage Vitest inclut exhaustivement les sources exécutables de `frontend/src` et applique les
seuils de 80 % globalement et fichier par fichier. Les seules exclusions sont les feuilles CSS,
les tests/E2E, les déclarations `*.d.ts`, les fichiers générés et les deux modules TypeScript
strictement déclaratifs (`src/types.ts`, `src/hooks/simulationTypes.ts`). Ainsi, tout nouveau
fichier exécutable non testé apparaît dans le rapport et fait échouer la gate; aucun module de
production n'est exclu par convenance.
La task VS Code `Validation : profil main` exécute directement
`python Scripts/quality_gate.py ci --profile main`. Elle utilise le contrat versionné des profils, lance en
parallèle les branches indépendantes, isole leurs artefacts et termine par l’agrégateur bloquant. Celui-ci
produit le rapport Vitals puis contrôle sa conformité après promotion des couvertures backend, frontend et
E2E. Les scripts PowerShell `run-e2e-coverage.ps1`, `run-vitals-coverage.ps1` et
`run-vitals-compliance.ps1` restent disponibles pour le diagnostic ciblé. La validation produit notamment :

- `.coverage` et `.coverage.python.json` pour tous les fichiers exécutables sous `backend/`, `Scripts/`
  et `run_app.py` ;
- `frontend/coverage/coverage-final.json` et `frontend/coverage/index.html` pour Vitest ;
- `frontend/coverage/e2e-coverage-summary.json` pour les E2E ;
- `frontend/coverage/vitals-coverage-report.json` pour l’agrégation Vitals réutilisée par la conformité.
- `reports/test-strategy-report.json` et `reports/test-strategy-report.md` pour la consolidation stratégique
  machine et humaine du profil.

Les E2E appliquent réellement un seuil de 80 % sur `statements`, `branches`, `functions` et `lines`.
L’artefact doit être un JSON complet et cohérent, porter l’identité du run courant, ses timestamps,
l’identifiant et le fingerprint du périmètre, et rester dans la fenêtre de fraîcheur configurée. Une
métrique par fichier sans élément mesurable est représentée de façon canonique par
`total = covered = skipped = 0` et `pct = 100`; les métriques globales restent mesurables et bloquantes.

Ces scripts Python de coverage vitals font partie du lint backend et doivent rester conformes à `ruff check .`, y compris la limite de 100 caractères par ligne.
Les messages de validation backend et les imports des tests respectent également ce formatage Ruff.

Les détails d'API, d'architecture et de CI sont documentés dans [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Bonnes pratiques

- ne pas commiter de secrets (PAT, tokens, clés privées)
- vérifier avant commit:

```bash
python Scripts/check_no_secrets.py
```

### Pre-commit local (activé automatiquement)

Le hook versionné est activé automatiquement après installation frontend via:

- `npm --prefix frontend install` (script `prepare` -> `git -C .. config --local core.hooksPath .githooks`)

Vérification manuelle (si nécessaire):

```bash
git config core.hooksPath .githooks
```

Le hook `pre-commit` exécute `python Scripts/quality_gate.py fast` sur l’index Git. Dès que cet index contient
au moins un changement, `README.md` racine doit lui-même y être ajouté ou modifié. Une modification présente
uniquement dans le worktree, un autre README, ou une suppression/renommage du README racine ne satisfait pas
la règle. La pertinence de l'évolution documentée reste contrôlée par la DoD et la revue, sans heuristique
fragile sur la longueur ou les mots employés. Le hook `pre-push`
transmet ses références à `python Scripts/quality_gate.py push`, qui valide les commits poussés dans des
worktrees détachés. GitHub Actions exécute `python Scripts/quality_gate.py ci` sur son checkout. La
définition des contrôles reste donc unique ; le smoke test Docker est réservé à la CI. Les hooks restent
fail-fast et affichent la commande ainsi que la correction attendue.

Le mode `fast` exécute notamment:

- refus de tout index non vide qui ne contient pas un `README.md` racine ajouté ou modifié
- validation que `README.md` ne contient ni mojibake (accents cassés), ni désaccentuation massive du texte français
- `python Scripts/check_no_secrets.py`
  - bloque aussi les valeurs Azure DevOps non factices (`ADO_ORG`, `ADO_PROJECT`, etc.) dans la CI et les tests
  - refuse aussi les changements non documentés sur ce contrôle via le garde README du pre-commit
- `python Scripts/check_dod_compliance.py`
  - ce contrôle vérifie la conformité DoD au niveau référentiel (docs, CI, seuils, tasks)
  - les vérifications de tasks VS Code sont appliquées seulement si `.vscode/tasks.json` est présent
- `python Scripts/check_naming_convention.py`
  - bloque les identifiants de code contenant les termes français explicitement bannis par la convention repo
- `python Scripts/check_test_classification.py`
  - bloque les inventaires absents, obsolètes, invalides ou non déterministes ainsi que les exceptions non
    auditables

Une validation ciblée verte confirme uniquement le plan sélectionné. La validation complète correspond à
la task `Validation : profil main`. La conformité DoD ajoute les exigences normatives et documentaires. Enfin,
un changement n’est publiable qu’après validation complète, vérification du worktree et de la branche, et
présence confirmée du remote GitHub.

## Licence

Monte Carlo Azure est distribué sous licence
[Apache License 2.0](LICENSE).

Le projet a été initialement conçu et développé par **Garance Richard**.

Les organisations qui créent, modifient ou exploitent un fork sont seules
responsables de sa gouvernance, de sa maintenance, de sa sécurité, de son
support et des modifications qu'elles y apportent.

Les informations d'attribution sont précisées dans le fichier
[`NOTICE`](NOTICE).
