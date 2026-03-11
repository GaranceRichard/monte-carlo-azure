# Monte Carlo Azure

[![CI](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml/badge.svg)](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml)

Outil de prevision base sur une simulation Monte Carlo. L'application aide a transformer un historique Azure DevOps en projection probabiliste, sans exposer le PAT Azure DevOps au backend.

## En bref

- cible: directeur de projet, PMO, responsables delivery et portefeuille
- usage: securiser une date, arbitrer un perimetre, dimensionner une capacite, expliciter un niveau de risque
- principe cle: le frontend appelle Azure DevOps directement; le backend ne recoit que des donnees anonymisees de throughput

## Parcours de lecture

- vision produit et valeur: [`PRODUCT.md`](PRODUCT.md)
- architecture, securite, API, CI: [`ARCHITECTURE.md`](ARCHITECTURE.md)
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
- visualisation des percentiles et distributions
- affichage d'un `Risk Score` avec code couleur
- export CSV du throughput hebdomadaire
- historique local des dernieres simulations
- cookie client `IDMontecarlo` pour relier un client anonyme a ses simulations persistees
- persistence MongoDB des simulations et restitution des 10 dernieres via `/simulations/history`
- configuration rapide des filtres (types + etats) memorisee localement
- rapport portefeuille PDF avec progression et tolerance aux echecs partiels

Le contrat de simulation ne transporte plus de parametre de capacite reduite:
les projections reposent uniquement sur l'historique de throughput observe.

---

## Securite

Le PAT Azure DevOps:

- est utilise uniquement dans le navigateur de l'utilisateur
- ne transite jamais par le backend
- n'est pas sauvegarde par le serveur
- en mode Cloud, les appels partent directement vers `https://dev.azure.com` et `https://app.vssps.visualstudio.com`

Les invariants techniques et les controles CI associes sont documentes dans [`ARCHITECTURE.md`](ARCHITECTURE.md).

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

Le frontend detecte automatiquement le mode Azure DevOps a partir de l'URL saisie :

- URL vide ou hote `dev.azure.com` / `*.visualstudio.com` => Cloud
- tout autre hote => on-prem

En on-prem, l'URL attendue est l'URL serveur + collection, par exemple :

- `https://ado.monentreprise.local/tfs/DefaultCollection`
- `https://devops700.itp.extra/700`

Le detail du flux Cloud / on-prem est documente dans [`frontend/README.md`](frontend/README.md).

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
$env:VITALS_FRONTEND_COVERAGE="1"
npm --prefix frontend run test:unit:coverage
powershell -NoProfile -ExecutionPolicy Bypass -File .\.vscode\scripts\run-vitals-compliance.ps1 -WorkspaceRoot .
```

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

Purge planifiee:

```bash
python Scripts/purge_inactive_clients.py
```

Suite E2E decoupee:

- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/selection.spec.js`
- `frontend/tests/e2e/simulation.spec.js`
- `frontend/tests/e2e/coverage.spec.js`

Sous Windows/VS Code, les taches `pytest --cov` paralleles utilisent des fichiers coverage distincts via `COVERAGE_FILE` pour eviter les conflits de verrouillage.
Le projet desactive aussi le cacheprovider pytest via `pytest.ini` (`-p no:cacheprovider`) pour supprimer les warnings d'ecriture `.pytest_cache` en environnement restreint.
La task VS Code `Coverage: 8 terminaux` execute aussi:

- `Scripts/check_vitals_compliance.py` pour verifier la traceabilite des points vitaux vers leurs tests cibles
- `Scripts/report_vitals_coverage.py` pour afficher les taux de couverture par vital a partir des artefacts backend/frontend/e2e
- `frontend/coverage-vitals/coverage-final.json` comme artefact dedie au frontend unit vitals

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
- `python Scripts/check_dod_compliance.py`
  - ce controle verifie la conformite DoD au niveau referentiel (docs, CI, seuils, tasks)
  - les verifications de tasks VS Code sont appliquees seulement si `.vscode/tasks.json` est present
