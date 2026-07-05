# Monte Carlo Azure

[![CI](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml/badge.svg)](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml)

Outil de prevision base sur une simulation Monte Carlo. L'application aide a transformer un historique Azure DevOps en projection probabiliste, sans exposer le PAT Azure DevOps au backend.

Demo GitHub Pages:

- Démo publique: [https://garancerichard.github.io/monte-carlo-azure/](https://garancerichard.github.io/monte-carlo-azure/)

## En bref

- cible: directeur de projet, PMO, responsables delivery et portefeuille
- usage: securiser une date, arbitrer un perimetre, dimensionner une capacite, expliciter un niveau de risque
- principe cle: le frontend appelle Azure DevOps directement; le backend ne recoit que des donnees anonymisees de throughput

## Parcours de lecture

- vision produit et valeur: [`PRODUCT.md`](PRODUCT.md)
- architecture, securite, API, CI: [`ARCHITECTURE.md`](ARCHITECTURE.md)
  - inclut la convention de nommage: identifiants de code en anglais, textes utilisateur en francais
- historique des evolutions: [`CHANGELOG.md`](CHANGELOG.md)
- guide frontend: [`frontend/README.md`](frontend/README.md)
- definition of done: [`docs/definition-of-done.md`](docs/definition-of-done.md)
- chemins critiques: [`docs/critical-paths.md`](docs/critical-paths.md)
- traceabilite vitals -> tests: [`docs/vitals-traceability.md`](docs/vitals-traceability.md)
- mapping coverage vitals: [`docs/vitals-coverage-map.json`](docs/vitals-coverage-map.json)
- deploiement production: [`docs/deployment.md`](docs/deployment.md)

---

## Fonctionnalites

- connexion Azure DevOps avec PAT cote navigateur
- support Azure DevOps Cloud et Azure DevOps Server / TFS on-premise
- selection organisation -> projet -> equipe
- mode `Portefeuille` multi-equipes
- simulation Monte Carlo cote backend (`POST /simulate`)
- support optionnel d'un `seed` de simulation pour rejouer exactement un tirage Monte Carlo
- demo locale et simulations portefeuille reproductibles a `seed` identique
- visualisation des percentiles et distributions
- semantique metier des percentiles alignee sur le mode de simulation:
  - `backlog_to_weeks`: `P90` = 90% des simulations finissent en `P90` semaines ou moins
  - `weeks_to_items`: `P90` = 90% des simulations livrent au moins `P90` items
- en `backlog_to_weeks`, les simulations non terminees a l'horizon sont des censures explicites:
  - une fin exacte a `521` semaines reste une vraie fin, distincte d'une censure
  - la distribution et les percentiles ne couvrent que les simulations terminees
  - un percentile absent signifie qu'il n'est pas identifiable avant l'horizon
- badge `Démo` integre a l'en-tete des ecrans demo GitHub Pages (choix d'equipe et simulation)
- lisibilite renforcee des graphes de simulation, y compris les etiquettes de l'axe X
- legendes de graphiques harmonisees, affichees seulement quand utiles et sans debordement en bas du panneau
- calcul du `cycleTime` extrait dans un utilitaire dedie avec couverture unitaire ciblee
- `Cycle Time` affiche partout en jours calendaires (cartes, graphiques, tooltips, demo et PDF)
- affichage d'un `Risk Score` avec code couleur
  - `backlog_to_weeks`: `(P90 - P50) / P50`
  - `weeks_to_items`: `(P50 - P90) / P50`
  - absent si `P50` ou `P90` n'est pas identifiable
- export CSV du throughput hebdomadaire
- telechargement direct du rapport PDF simulation sans fenetre intermediaire
- historique local des dernieres simulations, contextualise par equipe dans le navigateur
- cookie client `IDMontecarlo` pour relier un client anonyme a ses simulations persistees
- persistence MongoDB des simulations statistiques anonymes et restitution des 10 dernieres via `/simulations/history`
- configuration rapide des filtres (types + etats) memorisee localement
- rapport portefeuille PDF direct avec progression et tolerance aux echecs partiels

Scenarios portefeuille:

- `Optimiste`: somme des throughputs tires independamment pour chaque equipe
- `Arrime`: `Optimiste` reduit au facteur d'arrimage configure
- `Friction`: application d'un cout d'alignement identique par equipe supplementaire
- `Historique corrélé`: somme des throughputs observes sur les memes semaines pour toutes les equipes
  afin de conserver les variations communes reellement observees

Regle scenario portefeuille `Friction`:

- le facteur applique est `alignmentRate^(teamCount - 1)`
- l'exposant est borne a `0`
- `1` equipe => aucune penalite (`100%` de capacite conservee)
- la penalite commence a partir de la `2e` equipe
- le pourcentage affiche dans le rapport correspond exactement au facteur utilise pour la simulation

Regle scenario portefeuille `Historique corrélé`:

- l'echantillon est construit a partir des `weeklyThroughput` reels de chaque equipe
- seules les semaines calendaires communes a toutes les equipes sont conservees
- le throughput portefeuille d'une semaine est la somme des throughputs observes cette meme semaine
- `includeZeroWeeks=true` conserve les totaux `>= 0`
- `includeZeroWeeks=false` conserve uniquement les totaux `> 0`
- si aucune semaine commune complete n'est disponible, le frontend renvoie une erreur explicite

Regle calendrier throughput:

- l'historique hebdomadaire utilise uniquement des semaines ISO completes
- une semaine est retenue seulement si elle commence un lundi, se termine un dimanche,
  est entierement comprise dans la periode selectionnee et est deja totalement ecoulee
- la semaine courante n'entre jamais dans la simulation tant que son dimanche n'est pas passe
- si la periode ne contient aucune semaine complete, le frontend renvoie un message explicite

Le contrat de simulation ne transporte plus de parametre de capacite reduite:
les projections reposent uniquement sur l'historique de throughput observe.
La route `POST /simulate` isole aussi la persistance Mongo du calcul principal:
la reponse utilisateur est retournee des que la simulation est prete, puis l'ecriture
de l'historique part en arriere-plan. Si Mongo est indisponible, l'incident reste limite
a l'historique et ne bloque plus le resultat de simulation.
Pour `weeks_to_items`, le frontend consomme directement les `result_percentiles`
renvoyes par l'API et ne recalcule depuis l'histogramme que pour d'anciens historiques
detectes par un ordre legacy `P50 <= P70 <= P90`.
Le `Risk Score`, lui, est maintenant calcule partout a partir des percentiles metier
effectivement exposes par l'API et affiches a l'ecran, y compris dans les exports PDF.
En `backlog_to_weeks`, l'API expose aussi un `completion_summary` avec `completed_count`,
`censored_count`, `censored_rate` et `horizon_weeks` pour distinguer explicitement les
simulations terminees des non-terminaisons a l'horizon. Les anciennes entrees d'historique
restent compatibles: si ce bloc manque, le frontend conserve le comportement legacy.
Le `Cycle Time`, lui, reste une restitution frontend distincte du moteur Monte Carlo:
il est calcule et affiche en jours calendaires, tandis que le throughput historique,
les modes `backlog_to_weeks` / `weeks_to_items` et `target_weeks` restent exprimes en semaines.
L'historique local des simulations embarque aussi un `schemaVersion`; les anciennes entrees
sans version sont migrees une seule fois au chargement en convertissant leurs anciennes
valeurs `Cycle Time` stockees en semaines vers des jours calendaires (`* 7`).
Les nouvelles entrees locales embarquent aussi leur `seed`: une nouvelle simulation frontend
genere une seule `seed` par execution logique, la transmet au backend si besoin, l'utilise
dans le moteur demo / portefeuille, puis la conserve lors d'un rejeu local. Les historiques
plus anciens sans `seed` restent lisibles et rejouables, mais sans promesse de reproductibilite
bit a bit.

---

## Securite

Le PAT Azure DevOps:

- est utilise uniquement dans le navigateur de l'utilisateur
- ne transite jamais par le backend
- n'est pas sauvegarde par le serveur
- en mode Cloud, les appels partent directement vers `https://dev.azure.com` et `https://app.vssps.visualstudio.com`

Les invariants techniques et les controles CI associes sont documentes dans [`ARCHITECTURE.md`](ARCHITECTURE.md).

Frontiere d'identite Azure DevOps :

- le navigateur conserve le `PAT`, l'URL serveur, l'organisation, le projet, l'equipe, la periode, les types, les etats `Done`, l'historique hebdomadaire brut, le cycle time brut en jours calendaires et l'historique utilisateur contextualise
- `POST /simulate` transmet uniquement `throughput_samples`, `include_zero_weeks`, `mode`, `backlog_size`, `target_weeks`, `n_sims` et un `seed` optionnel
- MongoDB ne persiste que `mc_client_id`, `created_at`, `last_seen`, les parametres Monte Carlo et les resultats statistiques anonymes
- `mc_client_id` est un identifiant anonyme non derive d'Azure DevOps
- `Scripts/check_identity_boundary.py` bloque en CI toute reintroduction d'un champ Azure DevOps dans le payload de simulation, les modeles backend, la persistence Mongo, l'historique serveur, les proxies locaux ou les appels Azure DevOps cote backend
- `tests/test_identity_boundary.py` construit ses depots temporaires dans le workspace du repo pour rester stable sous Windows, meme si `AppData\Local\Temp\pytest-of-*` est verrouille

---

## Prerequis

- Python 3.10+
- Node.js 20+
- acces Azure DevOps + PAT
- Docker (optionnel, recommande pour un deploiement rapide)

## Quick Start (Docker)

```bash
cp .env.example .env
docker compose up -d --build
curl -sS http://127.0.0.1:8000/health
```

Application disponible sur:

- `http://127.0.0.1:8000`

## Lancer en developpement

Option rapide (Windows PowerShell, 4 terminaux: mongo + backend + frontend + health):

```powershell
.\start-dev.ps1 -ThreeTerminals
```

Le terminal health verifie `http://127.0.0.1:8000/health` et `http://127.0.0.1:8000/health/mongo` en boucle (intervalle par defaut: 5s).
Dans VS Code, `Ctrl+Shift+B` lance aussi la tache par defaut `Dev: 5 terminaux`.

### Backend

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run_app.py
```

API: `http://127.0.0.1:8000`

Note rate limiting:
`APP_REDIS_URL` est inutile en developpement local avec un seul processus `python run_app.py`.
Laissez cette variable absente pour conserver le backend `memory://`.
Elle devient requise en production quand l'API tourne avec plusieurs workers, sinon la limite est comptee separement par processus.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: `http://localhost:5173`

Pour emuler le build GitHub Pages localement:

```powershell
$env:VITE_GITHUB_PAGES="true"
npm run build
```

Le workflow GitHub Pages retente une fois `actions/deploy-pages` si GitHub retourne un echec transitoire apres creation de l'artefact de deploiement.
Le smoke test Docker de la CI utilise aussi un payload `POST /simulate` strictement aligne
sur le contrat statistique courant (`throughput_samples`, `mode`, `backlog_size`, `target_weeks`,
`n_sims`, `include_zero_weeks`) afin de detecter toute derive de contrat sans reintroduire
d'ancien champ refuse par l'API.

Sur GitHub Pages, la demo publique precharge les donnees puis laisse l'utilisateur choisir son point d'entree:

- `Simulation` pour ouvrir une equipe et ses graphiques/detail
- `Portefeuille` pour comparer plusieurs equipes et generer un rapport consolide

Le frontend detecte automatiquement le mode Azure DevOps a partir de l'URL saisie :

- URL vide ou hote `dev.azure.com` / `*.visualstudio.com` => Cloud
- tout autre hote => on-prem

En on-prem, l'URL attendue est l'URL serveur + collection, par exemple :

- `https://ado.monentreprise.local/tfs/DefaultCollection`
- `https://devops700.itp.extra/700`

Le detail du flux Cloud / on-prem est documente dans [`frontend/README.md`](frontend/README.md).

En E2E local, Playwright force aussi `VITE_API_BASE=http://127.0.0.1:8000` pour garder les mocks backend coherents avec les appels `simulate` et `simulations/history`.
En CI GitHub Actions, le job `frontend-tests` installe aussi `requirements.txt` avant `npm run test:e2e`, car Playwright demarre `run_app.py` et a donc besoin de `uvicorn` et des dependances backend.

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

Terminal 4 (check recurrent health):

```powershell
while ($true) { try { Invoke-RestMethod http://127.0.0.1:8000/health -TimeoutSec 2 | ConvertTo-Json -Compress } catch { Write-Host $_.Exception.Message }; Start-Sleep -Seconds 5 }
```

Terminal 5 (check recurrent health Mongo):

```powershell
while ($true) { try { Invoke-RestMethod http://127.0.0.1:8000/health/mongo -TimeoutSec 2 | ConvertTo-Json -Compress } catch { Write-Host $_.Exception.Message }; Start-Sleep -Seconds 5 }
```

---

## Tests et coverage

Depuis la racine:

```bash
.venv\Scripts\python.exe -m ruff check .
.venv\Scripts\python.exe -m ruff format --check .
APP_MONGO_URL=mongodb://localhost:27017 APP_MONGO_DB=montecarlo_test .venv\Scripts\python.exe -m pytest --cov=backend --cov-report=term-missing -q
```

Frontend:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run lint -- --max-warnings 0
npm --prefix frontend run test:unit
npm --prefix frontend run test:unit:coverage
npm --prefix frontend run test:e2e
npm --prefix frontend run test:e2e:coverage:console
.venv\Scripts\python.exe -m pytest --cov=backend --cov-fail-under=80 --cov-report=term-missing -q
```

Coverage vitals:

```powershell
npm --prefix frontend run test:unit:coverage
python Scripts/report_vitals_coverage.py
powershell -NoProfile -ExecutionPolicy Bypass -File .\.vscode\scripts\run-vitals-compliance.ps1 -WorkspaceRoot .
```

Reference actuelle apres recalcul local:

- `SLA Identite`: frontend_unit / branches = `100%`, e2e / branches = `100%`
- `Flux onboarding critique`: frontend_unit / branches = `95.80%`, e2e / branches = `100%`
- `Export rapport simulation (SVG/PDF)`: frontend_unit / branches = `95.94%`

### Variables d'environnement Mongo / purge

- `APP_MONGO_URL` (ex: `mongodb://mongo:27017`)
- `APP_MONGO_DB` (defaut: `montecarlo`)
- `APP_MONGO_COLLECTION_SIMULATIONS` (defaut: `simulations`)
- `APP_MONGO_MIN_POOL_SIZE` (defaut: `5`)
- `APP_MONGO_MAX_POOL_SIZE` (defaut: `20`)
- `APP_MONGO_SERVER_SELECTION_TIMEOUT_MS` (defaut: `2000`)
- `APP_MONGO_CONNECT_TIMEOUT_MS` (defaut: `2000`)
- `APP_MONGO_SOCKET_TIMEOUT_MS` (defaut: `5000`)
- `APP_MONGO_MAX_IDLE_TIME_MS` (defaut: `60000`)
- `APP_SIMULATION_HISTORY_LIMIT` (defaut: `10`)
- `APP_PURGE_RETENTION_DAYS` (defaut script purge: `30`)

Variable d'environnement rate limiting:

- `APP_RATE_LIMIT_SIMULATE` (defaut: `20/minute`)
- `APP_REDIS_URL` uniquement en production multi-workers; ne pas la definir en developpement local

Variable d'environnement simulation:

- `APP_FORECAST_TIMEOUT_SECONDS` (defaut: `30`)
  - applique un timeout de reponse sur `POST /simulate`
  - le calcul NumPy continue jusqu'a sa fin dans son thread si le delai est depasse, mais l'API rend immediatement un `503`

Comportement du `seed` de simulation:

- `POST /simulate` accepte un `seed` entier optionnel entre `0` et `4294967295`
- a payload identique, renvoyer le meme `seed` reproduit strictement le meme resultat de simulation
- si aucun `seed` n'est fourni, le backend en genere un automatiquement et le renvoie dans la reponse
- l'historique Mongo persiste aussi ce `seed` pour faciliter l'analyse a posteriori d'une simulation
- cote frontend, une execution logique ne consomme qu'une seule `seed`; le rejeu d'une entree
  locale reemploie cette meme `seed` tant que ses parametres restent inchanges

Purge planifiee:

```bash
python Scripts/purge_inactive_clients.py
```

Nettoyage des anciens champs d'identite Azure DevOps dans Mongo:

```bash
.venv\Scripts\python.exe Scripts/scrub_simulation_identity.py
.venv\Scripts\python.exe Scripts/scrub_simulation_identity.py --apply
```

Le script est en `dry-run` par defaut et supprime uniquement les anciens champs sensibles via `$unset` en mode `--apply`.

Suite E2E decoupee:

- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/selection.spec.js`
- `frontend/tests/e2e/simulation.spec.js`
- `frontend/tests/e2e/coverage.spec.js`

Sous Windows/VS Code, les taches `pytest --cov` paralleles utilisent des fichiers coverage distincts via `COVERAGE_FILE` pour eviter les conflits de verrouillage.
Le projet desactive aussi le cacheprovider pytest via `pytest.ini` (`-p no:cacheprovider`) pour supprimer les warnings d'ecriture `.pytest_cache` en environnement restreint.
Pour la couverture frontend Vitest sous Windows, le projet utilise une execution stable (`pool: "forks"` et `coverage.processingConcurrency: 1` dans `frontend/vitest.config.js`) afin d'eviter les pannes d'agregation V8 de type `ENOENT ... frontend\coverage\.tmp\coverage-*.json`.
Dans ce repo, une ligne rouge dans le detail d'un rapport de coverage est consideree comme invalide et doit etre couverte avant de considerer la tache acceptable, meme si les seuils globaux restent verts.
La task VS Code `Coverage: 8 terminaux` execute aussi:

- `Scripts/check_vitals_compliance.py` pour verifier la traceabilite des points vitaux vers leurs tests cibles
- `Scripts/report_vitals_coverage.py` pour afficher les taux de couverture par vital a partir des artefacts backend/frontend/e2e
- `Scripts/check_naming_convention.py` en fin de sequence pour bloquer la reintroduction d'identifiants hors convention
- `frontend/coverage/coverage-final.json` comme artefact frontend unique pour le global et les vitals

Ces scripts Python de coverage vitals font partie du lint backend et doivent rester conformes a `ruff check .`, y compris la limite de 100 caracteres par ligne.

Les details d'API, d'architecture et de CI sont documentes dans [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Bonnes pratiques

- ne pas commiter de secrets (PAT, tokens, cles privees)
- verifier avant commit:

```bash
python Scripts/check_no_secrets.py
```

### Pre-commit local (active automatiquement)

Le hook versionne est active automatiquement apres installation frontend via:

- `npm --prefix frontend install` (script `prepare` -> `git -C .. config --local core.hooksPath .githooks`)

Verification manuelle (si necessaire):

```bash
git config core.hooksPath .githooks
```

Le hook `pre-commit` execute:

- validation de mise a jour du `README.md` si des fichiers code/config sont commites
- validation que `README.md` ne contient pas de mojibake (accents casses)
- `python Scripts/check_no_secrets.py`
  - bloque aussi les valeurs Azure DevOps non factices (`ADO_ORG`, `ADO_PROJECT`, etc.) dans la CI et les tests
  - refuse aussi les changements non documentes sur ce controle via le garde README du pre-commit
- `python Scripts/check_dod_compliance.py`
  - ce controle verifie la conformite DoD au niveau referentiel (docs, CI, seuils, tasks)
  - les verifications de tasks VS Code sont appliquees seulement si `.vscode/tasks.json` est present
- `python Scripts/check_naming_convention.py`
  - bloque les identifiants de code contenant les termes francais explicitement bannis par la convention repo

## Licence

Monte Carlo Azure est distribue sous licence
[Apache License 2.0](LICENSE).

Le projet a ete initialement concu et developpe par **Garance Richard**.

Les organisations qui creent, modifient ou exploitent un fork sont seules
responsables de sa gouvernance, de sa maintenance, de sa securite, de son
support et des modifications qu'elles y apportent.

Les informations d'attribution sont precisees dans le fichier
[`NOTICE`](NOTICE).
