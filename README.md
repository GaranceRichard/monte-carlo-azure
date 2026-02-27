# Monte Carlo Azure

[![CI](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml/badge.svg)](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml)

Outil de prévision basé sur une simulation Monte Carlo. Il répond au Use Case suivant : l'utilisateur se connecte et peut effectuer facilement une simulation sur un site avec peu d'informations, sans laisser de trace ou compromettre Azure avec son Token.

Documentation produit (vision, cible, valeur):
- [`PRODUCT.md`](PRODUCT.md)
- [`docs/definition-of-done.md`](docs/definition-of-done.md)
- [`docs/critical-paths.md`](docs/critical-paths.md)

Architecture V2:
- Le frontend appelle Azure DevOps directement depuis le navigateur.
- Le backend OVH ne reçoit que des données anonymes de throughput (`throughput_samples`) pour calculer la simulation.

Refactors récents (frontend):
- utilitaires centralisés `src/date.ts`, `src/storage.ts`, `src/utils/math.ts`, `src/utils/simulation.ts`
- gestion granulaire des erreurs Azure DevOps (`401/403/404/429/5xx`) via `src/adoErrors.ts` avec messages actionnables pour l'UI
- avertissement explicite en cas de chargement partiel des batches de work items (historique incomplet signalé dans les résultats)
- contexte simulation unifié `src/hooks/SimulationContext.tsx` (un seul provider exposant `SimulationViewModel` complet + `selectedTeam`)
- centralisation des accès `localStorage` via `storage.ts`
- extraction de l'export CSV throughput vers `src/utils/export.ts`
- extraction de la logique de calcul forecast vers `src/hooks/simulationForecastService.ts`
- extraction de la logique portefeuille vers `src/hooks/usePortfolio.ts` (etat modale, options equipe, orchestration forecast/rapport)
- extraction de la generation du rapport portefeuille vers `src/hooks/usePortfolioReport.ts` (progression, erreurs par equipe, export partiel)
- extraction du chargement des options d'equipe simulation vers `src/hooks/useTeamOptions.ts` (work item types + states par type)
- extraction de la persistance des quick filters simulation vers `src/hooks/useSimulationQuickFilters.ts`
- simplification du contrat de `useSimulationAutoRun` via un objet `params` groupe (surface d'entree reduite, comportement inchange)
- libelles metier clarifies dans l'UI portefeuille/simulation (modes lisibles pour PMO/COPIL)
- calcul du `risk score` harmonise sur les percentiles effectivement affiches (notamment mode `weeks_to_items`), avec affichage a 2 decimales dans les rapports
- gestion des erreurs Azure DevOps unifiee entre mode simulation et mode portefeuille (messages actionnables 401/403/404/429/5xx via `adoErrors.ts`)
- typages simulation segmentés (`SimulationForecastControls`, `SimulationDateRange`, `SimulationResult`, `ChartTab`)
- écran simulation chargé en lazy (`React.lazy`) + import dynamique du module rapport/PDF pour réduire la taille des chunks initiaux
- accessibilité du chargement renforcée dans `SimulationResultsPanel` (`role="status"` + `aria-live="polite"` pour annoncer `loadingStageMessage` aux lecteurs d'écran)
- cache en mémoire des options d'équipe portefeuille (`org::project::team`) pour éviter les appels ADO redondants lors des réouvertures de la modale
- génération du rapport portefeuille parallélisée (`Promise.allSettled`) avec progression visible `x/n équipes simulées`
- tolérance aux échecs partiels en portefeuille: les équipes en erreur sont listées sans bloquer l'export des équipes valides
- persistance locale de la "Configuration rapide" (types + états) par scope `org::project::team`, avec auto-apply si valide + bouton d'application manuelle
- modale portefeuille: bouton `Configuration rapide` affiche si une configuration existe pour l'equipe selectionnee, avec application manuelle et sauvegarde a la validation
- résumés compactés du panneau simulation reformulés en libellés métier plus lisibles (période, mode, filtres)
- mode portefeuille: critères généraux réorganisés sur 2 lignes, labels harmonisés (`Items` / `Semaines`), largeur du champ `Mode` augmentée et champs numériques centrés (`Items/Semaines`, `Nombre de simulations`, `Taux d'arrimage`)
- rapport portefeuille PDF enrichi: page de synthèse décisionnelle + hypothèses, détails par scénario, amélioration visuelle du tableau de synthèse (taille/couleurs/contraste) et espacement ajusté
- correction d'un bug de cohérence `Risk Score` entre synthèse PDF et pages de détail (même logique de percentiles selon le mode)
- correction du déclenchement multi-téléchargements PDF (binding bouton unique, suppression des doublons)
- robustesse e2e renforcée sur l'écran simulation (sélecteurs moins sensibles aux accents/encodage)
- fichier `frontend/tests/e2e/coverage.spec.js` normalisé en UTF-8 pour conformité `test_repo_compliance`

Mises à jour récentes (backend/tests):
- tri des imports `slowapi` dans `backend/api.py` pour conformité Ruff/isort
- découpage de la compréhension de liste dans `tests/test_api_simulate.py` pour respecter la limite de longueur de ligne

---

## Fonctionnalités

- Connexion Azure DevOps avec PAT côté navigateur (non transmis au backend)
- Sélection organisation -> projet -> équipe
- Accès à un mode `Portefeuille` depuis l'écran équipe
- Simulation portefeuille multi-équipes avec ajout via modale (types + états), sans doublon d'équipe
- Rapport portefeuille PDF avec page de synthèse PI, pages scénario (Optimiste/Arrimé/Conservateur), puis pages équipes
- Récupération du throughput hebdomadaire côté client
- Simulation Monte Carlo côté backend (`POST /simulate`)
- Visualisation des percentiles et distributions
- Visualisation d'un `Risk Score` (fiabilite de la prevision) avec code couleur:
  - `fiable` = vert
  - `incertain` = jaune
  - `fragile` = rouge
  - `non fiable` = noir
- Reinitialisation explicite des resultats si les filtres tickets sont reouverts apres une simulation (le bouton `Lancer la simulation` reapparait)
- Export CSV du throughput hebdomadaire
- Historique local des dernières simulations (localStorage, sans compte)
- Cookie client `IDMontecarlo` (UUID v4, 1 an, `SameSite=Strict`) pour relier les simulations à un client anonyme
- Persistence MongoDB des simulations via `/simulate` + restitution des 10 dernières via `/simulations/history`
- Paramètre de capacité réduite (ex: équipe à 70% pendant N semaines)
- Configuration rapide des filtres (types + états) mémorisée localement par organisation/projet/équipe
- Modale portefeuille: application de la configuration rapide existante par equipe et ecriture de la configuration validee
- Rapport portefeuille avec progression de simulation et gestion des erreurs par équipe
- Rapport portefeuille tolerant aux echecs partiels (export maintenu avec les equipes reussies)

---

## Sécurité

Le PAT Azure DevOps:
- est utilisé uniquement dans le navigateur de l'utilisateur
- ne transite jamais par le backend
- n'est pas sauvegardé par le serveur

### SLA Identité (Non Négociable)

Règle fondamentale:
- 0 donnée d'identification (PAT, UUID, ORG, Team) ne doit transiter par un serveur applicatif (local ou distant).
- Le cookie `IDMontecarlo` ne doit jamais transiter vers `https://dev.azure.com` ni `https://app.vssps.visualstudio.com`.
- Les appels Azure DevOps doivent partir directement du navigateur vers:
  - `https://dev.azure.com`
  - `https://app.vssps.visualstudio.com`

Toute transgression de cette règle est considérée comme une faute majeure.

Contrôle automatique:
- CI exécute `python Scripts/check_identity_boundary.py`
- Si une proxyfication serveur (`/ado`, `/vssps`) ou un endpoint local de résolution PAT est détecté, la CI échoue.

Le backend ne reçoit que:
- `throughput_samples` (liste d'entiers)
- les paramètres de simulation (`mode`, `backlog_size`/`target_weeks`, `n_sims`)

Garde-fous serveur:
- rate limiting distribue sur `POST /simulate` via Redis + slowapi (limite client/IP partagee entre workers)
- niveau de logs applicatifs réduit (`warning`) et logs d'accès HTTP désactivés

---

## Architecture

```text
frontend/
  src/
    adoClient.ts        # appels directs Azure DevOps
    api.ts              # appel backend /simulate uniquement
    hooks/
      useOnboarding.ts  # PAT en state local
      useSimulation.ts             # orchestrateur simulation
      useSimulationPrefs.ts        # persistance localStorage des préférences
      useSimulationHistory.ts      # historique local (10 dernières simulations)
      useSimulationChartData.ts    # mapping/useMemo des données graphiques
      useSimulationAutoRun.ts      # auto-run avec debounce (entree via objet params)
      useSimulationQuickFilters.ts # persistance des quick filters simulation (scope org/projet/equipe)
      useTeamOptions.ts            # chargement options equipe (types + etats) pour simulation
      usePortfolio.ts              # logique mode portefeuille (equipes, modal, quick config)
      usePortfolioReport.ts        # generation rapport portefeuille (parallelisation, progression, erreurs)
    components/steps/
      SimulationChartTabs.tsx      # tabs + rendu des charts Recharts
      simulationPrintReport.tsx    # rapport imprimable (orchestration HTML)
      simulationChartsSvg.ts       # rendu SVG des 3 graphiques exportés
      simulationPdfDownload.ts     # téléchargement PDF (jsPDF + svg2pdf)

backend/
  api.py                # FastAPI + CORS + route /simulate + /health
  api_routes_simulate.py # endpoint /simulate
  api_models.py         # SimulateRequest / SimulateResponse
  mc_core.py            # coeur Monte Carlo
```

---

## Prérequis

- Python 3.10+
- Node.js 20+
- Accès Azure DevOps + PAT
- Docker (optionnel, recommandé pour un déploiement rapide)

---

## Quick Start (Docker)

En 3 commandes:

```bash
cp .env.example .env
docker compose up -d --build
curl -sS http://127.0.0.1:8000/health
```

L'application (frontend servi par FastAPI) est ensuite disponible sur:
- `http://127.0.0.1:8000`

---

## Lancer en développement

Option rapide (Windows PowerShell, 4 terminaux: backend + frontend + health API + health Mongo):

```powershell
.\start-dev.ps1 -ThreeTerminals
```

Le terminal health verifie `http://127.0.0.1:8000/health` en boucle (intervalle par defaut: 5s).
Dans VS Code, `Ctrl+Shift+B` lance aussi la tache par defaut `Dev: 4 terminaux`.

### Backend

```bash
python -m venv .venv
# PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run_app.py
```

API: `http://127.0.0.1:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: `http://localhost:5173`

### Mode manuel en 4 terminaux

Terminal 1 (backend):

```powershell
python run_app.py --no-browser
```

Terminal 2 (frontend):

```powershell
npm --prefix frontend run dev
```

Terminal 3 (check recurrent health):

```powershell
while ($true) { try { Invoke-RestMethod http://127.0.0.1:8000/health -TimeoutSec 2 | ConvertTo-Json -Compress } catch { Write-Host $_.Exception.Message }; Start-Sleep -Seconds 5 }
```

Terminal 4 (check recurrent health Mongo):

```powershell
while ($true) { try { Invoke-RestMethod http://127.0.0.1:8000/health/mongo -TimeoutSec 2 | ConvertTo-Json -Compress } catch { Write-Host $_.Exception.Message }; Start-Sleep -Seconds 5 }
```

---

## API

- `GET /health`
- `POST /simulate`
- `GET /simulations/history`
- CORS autorisé: `GET`, `POST`, `OPTIONS`

Swagger: `/docs`

### Requête `POST /simulate`

```json
{
  "throughput_samples": [3, 5, 2, 4, 6, 3],
  "mode": "backlog_to_weeks",
  "backlog_size": 120,
  "n_sims": 20000
}
```

ou

```json
{
  "throughput_samples": [3, 5, 2, 4, 6, 3],
  "mode": "weeks_to_items",
  "target_weeks": 12,
  "n_sims": 20000
}
```

### Réponse `POST /simulate`

```json
{
  "result_kind": "weeks",
  "result_percentiles": { "P50": 10, "P70": 12, "P90": 15 },
  "risk_score": 0.5,
  "result_distribution": [{ "x": 10, "count": 123 }],
  "samples_count": 30
}
```

Le backend persiste aussi la simulation dans MongoDB (collection `simulations`) quand le cookie `IDMontecarlo` est présent.

### Historique client `GET /simulations/history`

- Le cookie `IDMontecarlo` est lu côté backend.
- Réponse: jusqu'à 10 simulations récentes du client (mode, paramètres, percentiles, distribution, timestamps).

`result_distribution` contient des buckets `{ x, count }`:
- `x`: valeur simulée (semaines ou items selon le mode)
- `count`: fréquence observée dans les simulations

### Interprétation métier

- mode `backlog_to_weeks`:
  - question: "en combien de semaines terminer le backlog ?"
  - lecture des probabilités: `P(X <= semaines)`
  - formule `risk_score`: `(P90 - P50) / P50`
- mode `weeks_to_items`:
  - question: "combien d'items livrer en N semaines ?"
  - en UI, la courbe de probabilité est affichée en `P(X >= items)` (probabilité d'atteindre au moins X items)
  - formule `risk_score`: `(P50 - P90) / P50` (borne inferieure a 0)

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

### Variables d'environnement Mongo / purge

- `APP_MONGO_URL` (ex: `mongodb://mongo:27017`)
- `APP_MONGO_DB` (défaut: `montecarlo`)
- `APP_MONGO_COLLECTION_SIMULATIONS` (défaut: `simulations`)
- `APP_SIMULATION_HISTORY_LIMIT` (défaut: `10`)
- `APP_PURGE_RETENTION_DAYS` (défaut script purge: `30`)

Purge planifiée:

```bash
python Scripts/purge_inactive_clients.py
```

Suite E2E découpée:
- `frontend/tests/e2e/onboarding.spec.js`
- `frontend/tests/e2e/selection.spec.js`
- `frontend/tests/e2e/simulation.spec.js`
- `frontend/tests/e2e/coverage.spec.js` (seuils Istanbul agrégés: statements >= 80%, branches >= 80%, functions >= 80%, lines >= 80%)

Sous Windows/VS Code, les tâches `pytest --cov` parallèles utilisent des fichiers coverage distincts via `COVERAGE_FILE` pour éviter les conflits de verrouillage.
Le projet desactive aussi le cacheprovider pytest via `pytest.ini` (`-p no:cacheprovider`) pour supprimer les warnings d'ecriture `.pytest_cache` en environnement restreint.

---

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

- Job `backend-tests`
  - Service MongoDB réel (`mongo:7`) pour exécuter les tests d'intégration
  - Setup Python 3.12
  - Installation des dépendances backend
  - Lint backend: `python -m ruff check .`
  - Vérification DoD: `python Scripts/check_dod_compliance.py`
  - Contrôle SLA identité: `python Scripts/check_identity_boundary.py`
  - Tests backend + seuil coverage: `python -m pytest --cov=backend --cov-fail-under=80 -q` avec `APP_MONGO_URL`/`APP_MONGO_DB`

- Job `frontend-tests`
  - Setup Node.js 22
  - Installation frontend: `npm ci` (dans `frontend`)
  - Lint frontend: `npm run lint -- --max-warnings 0`
  - Tests unitaires + coverage: `npm run test:unit:coverage` (Vitest)
  - Installation Playwright: `npx playwright install --with-deps chromium`
  - Tests e2e: `npm run test:e2e`

- Job `docker-smoke`
  - Build de l'image Docker à chaque push/PR
  - Démarrage via `docker compose up -d --build`
  - Smoke test santé: `GET /health` + `GET /health/mongo`
  - Vérification persistence: `POST /simulate` puis `GET /simulations/history` avec cookie `IDMontecarlo`

- Job `publish`
  - Déclenché uniquement sur `push` vers `main` après `docker-smoke`
  - Build + push de l'image vers GHCR avec tags `latest` et `${{ github.sha }}`
  - Le nom d'image GHCR est normalisé en minuscules (contrainte GHCR)

---

## Déploiement production

Guide complet:
- [`docs/deployment.md`](docs/deployment.md)

Le guide couvre:
- option Docker Compose (recommandée)
- option Nginx + systemd
- checks post-déploiement et points sécurité

---

## Bonnes pratiques

- Ne pas commiter de secrets (PAT, tokens, clés privées)
- Vérifier avant commit:

```bash
python Scripts/check_no_secrets.py
```

### Pré-commit local (activé automatiquement)

Le hook versionné est activé automatiquement après installation frontend via:
- `npm --prefix frontend install` (script `prepare` -> `git -C .. config --local core.hooksPath .githooks`)

Vérification manuelle (si nécessaire):

```bash
git config core.hooksPath .githooks
```

Le hook `pre-commit` exécute:
- validation de mise à jour du `README.md` si des fichiers code/config sont commités
- validation que `README.md` ne contient pas de mojibake (accents cassés)
- `python Scripts/check_no_secrets.py`
- `python Scripts/check_dod_compliance.py`
  - ce contrôle vérifie la conformité DoD au niveau référentiel (docs, CI, seuils, tasks)
  - les vérifications de tasks VS Code sont appliquées seulement si `.vscode/tasks.json` est présent
