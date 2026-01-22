# Monte Carlo Azure

Outil de prévision (forecast) basé sur une simulation de Monte Carlo, alimenté par l’historique de throughput Azure DevOps (Work Items fermés).  
Le projet expose une API (FastAPI) et une UI (React/Vite). En mode “bundle”, l’API sert directement le front compilé.

---

## Fonctionnalités

- Liste des équipes ADO et lecture d’une configuration par équipe
- Extraction d’historique (Work Items fermés) et calcul du throughput hebdomadaire
- Simulation Monte Carlo (N itérations) pour estimer une distribution de dates/semaines de complétion
- API REST + UI web
- Tests automatisés (pytest + mocks)

---

## Architecture

```
backend/
  api.py            # FastAPI (endpoints + static frontend in bundle)
  ado_client.py     # client ADO
  ado_core.py       # requêtes ADO / récupération des items
  ado_config.py     # config (env + settings)
  mc_core.py        # calcul throughput + Monte Carlo
frontend/           # UI React/Vite
Scripts/            # scripts utilitaires (smoke, list teams, etc.)
tests/              # tests pytest
run_app.py          # lance l’API (dev)
```

---

## Prérequis

- Python 3.10+ (recommandé)
- Node.js 18+ (pour le front)
- Accès Azure DevOps + PAT (Personal Access Token) avec droits minimum (Work Items read)

---

## Configuration

### Variables d’environnement

Crée un fichier `.env` **local** (non versionné) à partir de `.env.example`.

Exemple :

```env
ADO_ORG=messqc
ADO_PROJECT=Projet-700
ADO_PAT=

# Optionnel
ADO_DEFAULT_TEAM=CEA-CentreExcellenceAgilite Team
ADO_DEFAULT_AREA_PATH=Projet-700\DGPRITN Team\DGINST Team\DCEN Team\Efficience
```

> ⚠️ Sécurité : ne commite jamais de `.env` ni de token. Un hook de contrôle est fourni : `Scripts/check_no_secrets.py`.

---

## Lancer en développement

### Backend (API)

1) Créer un environnement virtuel + installer les dépendances (exemple) :
```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2) Lancer l’API :
```bash
python run_app.py
```

API dispo (par défaut) : `http://127.0.0.1:8000`

### Frontend (UI)

Dans `frontend/` :
```bash
npm install
npm run dev
```

UI dispo : `http://localhost:5173`

---

## Endpoints principaux

- `GET /health` : check de santé
- `GET /teams` : liste des équipes
- `GET /teams/{team}/settings` : settings d’équipe (si applicable)
- `POST /forecast` : calcule un forecast (paramètres : team, area path, backlog, nb simulations, etc.)

> Les paramètres exacts sont visibles via la doc interactive FastAPI (Swagger) : `/docs`.

---

## Tests

À la racine :
```bash
pytest
```

---

## Packaging (PyInstaller)

Le projet inclut un spec PyInstaller : `MonteCarloADO.spec`.  
Objectif : produire un exécutable qui embarque l’API et sert le `frontend/dist`.

1) Build du frontend :
```bash
cd frontend
npm install
npm run build
cd ..
```

2) Build PyInstaller (exemple) :
```bash
pyinstaller MonteCarloADO.spec
```

L’exécutable se retrouve dans `dist/`.

> Bonnes pratiques : `dist/` et `build/` ne doivent pas être versionnés (cf. `.gitignore`).

---

## Hypothèses et limites

- Le throughput est calculé sur la base de la date de clôture (ClosedDate) et d’états “terminés” (selon le workflow ADO).
- Les semaines à throughput nul peuvent être exclues (selon la logique retenue) pour éviter de “polluer” la distribution.
- Les résultats Monte Carlo dépendent fortement :
  - de la qualité de l’historique (stabilité du flux, changements de process),
  - du périmètre retenu (Area Path / Team),
  - de la définition de “Done” dans ADO.

---

## Sécurité

- Ne pas commiter de secrets (`.env`, PAT, clés privées).
- Script de vérification avant commit : `Scripts/check_no_secrets.py`.

---

## Roadmap (suggestion)

- Stabiliser la reproductibilité (fichier de dépendances Python + scripts de build)
- Ajouter des percentiles (P50/P80/P90) et conversion en dates estimées
- Ajouter un écran “diagnostic” (périmètre, nombre de semaines, zéros exclus)
- CI GitHub Actions : tests + build + release

---

## Licence

À définir.
Si le dépôt est destiné à un usage interne (ADO + contexte organisation), dépôt privé recommandé.
