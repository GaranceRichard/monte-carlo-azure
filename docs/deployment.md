# Déploiement en production

Ce guide privilégie un déploiement simple et reproductible via Docker Compose.
L'objectif est de lancer une instance complète, backend et frontend statique servi par FastAPI, sans configuration manuelle de `nginx` ou `systemd`.

## Option A: Docker Compose

### 1) Prérequis

- Docker Engine
- Plugin `docker compose`
- Redis pour le rate limiting:
  - soit service local via `docker-compose.yml` avec le service `redis`
  - soit instance gérée externe en pointant `APP_REDIS_URL`
- MongoDB pour la persistance:
  - soit service local via `docker-compose.yml` avec le service `mongo`
  - soit instance gérée externe en pointant `APP_MONGO_URL`

### 2) Depuis la racine du repo

```bash
cp .env.example .env
docker compose up -d --build
curl -sS http://127.0.0.1:8000/health
```

Si le endpoint retourne `{"status":"ok"}`, l'application est disponible sur :

- `http://127.0.0.1:8000`

### 3) Variables d'environnement

Le fichier `.env` est chargé par `docker-compose.yml`.
Base recommandée pour la production multi-workers :

```dotenv
APP_PORT=8000
APP_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
APP_CORS_ALLOW_CREDENTIALS=true
APP_FORECAST_TIMEOUT_SECONDS=30
APP_RATE_LIMIT_SIMULATE=20/minute
APP_REDIS_URL=redis://redis:6379/0
APP_MONGO_URL=mongodb://mongo:27017
APP_MONGO_DB=montecarlo
APP_MONGO_COLLECTION_SIMULATIONS=simulations
APP_MONGO_MIN_POOL_SIZE=5
APP_MONGO_MAX_POOL_SIZE=20
APP_MONGO_SERVER_SELECTION_TIMEOUT_MS=2000
APP_MONGO_CONNECT_TIMEOUT_MS=2000
APP_MONGO_SOCKET_TIMEOUT_MS=5000
APP_MONGO_MAX_IDLE_TIME_MS=60000
APP_PURGE_RETENTION_DAYS=90
```

Note rate limiting:

- en développement local, ne pas définir `APP_REDIS_URL`; l'application retombe sur `memory://`, ce qui est suffisant avec un seul processus
- en production avec `uvicorn --workers 2`, `APP_REDIS_URL` est requise pour partager le compteur entre les workers
- si Redis est indisponible, l'application reste permissive mais écrit un log `warning`; il faut donc surveiller les logs backend

### 4) Vérification de la persistance Mongo

Vérifier au démarrage que la persistance est active, pas seulement le health global.
Si Mongo est configuré mais indisponible, l'application doit échouer au startup plutôt que d'attendre la première requête :

```bash
docker compose logs -f backend
curl -sS http://127.0.0.1:8000/health/mongo
```

Le endpoint `/health/mongo` doit retourner `{"status":"ok"}` en production.

Vérifier ensuite la lecture d'historique avec cookie client :

```bash
curl -sS -H 'Cookie: IDMontecarlo=ops-smoke-client' \
  http://127.0.0.1:8000/simulations/history
```

Si Mongo est indisponible, l'API doit remonter une erreur explicite sur les chemins de persistance.

### 5) Vérification du rate limiting Redis

Vérifier que la limitation est bien partagée par Redis et qu'elle retourne `429` après dépassement du seuil :

```bash
for i in $(seq 1 21); do
  curl -s -o /tmp/rate-limit.json -w "%{http_code}\n" \
    -X POST http://127.0.0.1:8000/simulate \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: ops-rate-limit-check" \
    -d '{"throughput_samples":[1,2,3,4,5,6],"mode":"backlog_to_weeks","backlog_size":10,"n_sims":2000}'
done
```

Les 20 premières réponses doivent être `200`, puis la 21e doit être `429`.
Si Redis tombe, la limitation peut devenir permissive; dans ce cas, vérifier les logs :

```bash
docker compose logs -f backend
docker compose logs -f redis
```

### 6) Nettoyage des anciens champs Azure DevOps

Le nettoyage des anciens champs d'identité Azure DevOps n'est jamais lancé automatiquement au démarrage.
Exécuter explicitement le script suivant :

```bash
python Scripts/scrub_simulation_identity.py
python Scripts/scrub_simulation_identity.py --apply
```

- le mode par défaut est `dry-run`
- `--apply` exécute le `$unset`
- `mc_client_id` reste un identifiant anonyme non dérivé du contexte Azure DevOps

### 7) Cron de purge

Planifier une exécution quotidienne de `Scripts/purge_inactive_clients.py` sur l'hôte.
Exemple `crontab -e` :

```cron
0 3 * * * cd /opt/montecarlo && /usr/bin/docker compose run --rm backend python Scripts/purge_inactive_clients.py >> /var/log/montecarlo-purge.log 2>&1
```

Le script utilise `APP_MONGO_URL`, `APP_MONGO_DB` et `APP_PURGE_RETENTION_DAYS`.

### 8) Commandes utiles

```bash
docker compose logs -f backend
docker compose logs -f redis
docker compose logs -f mongo
docker compose restart backend
docker compose down -v
```

## Option B: Nginx + systemd

Cette option reste valable pour des environnements qui imposent un runtime Linux natif.

### 1) Prérequis

- Python 3.12
- Nginx
- Redis joignable par `APP_REDIS_URL`
- utilisateur système dédié, par exemple `montecarlo`

### 2) Installation backend

```bash
sudo mkdir -p /opt/montecarlo
sudo chown -R montecarlo:montecarlo /opt/montecarlo

cd /opt/montecarlo
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

### 3) Service systemd

Fichier `/etc/systemd/system/montecarlo-api.service` :

```ini
[Unit]
Description=Monte Carlo API (FastAPI)
After=network.target

[Service]
User=montecarlo
Group=montecarlo
WorkingDirectory=/opt/montecarlo
Environment=PYTHONUNBUFFERED=1
Environment=APP_REDIS_URL=redis://127.0.0.1:6379/0
ExecStart=/opt/montecarlo/.venv/bin/uvicorn backend.api:app --host 127.0.0.1 --port 8000 --workers 2 --proxy-headers
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Activation :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now montecarlo-api
sudo systemctl status montecarlo-api
```

Avec `--workers 2`, Redis doit être disponible via `APP_REDIS_URL`; sans cela, chaque worker comptera ses requêtes localement.

### 4) Reverse proxy Nginx

Fichier `/etc/nginx/sites-available/montecarlo-api` :

```nginx
server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

Activation :

```bash
sudo ln -s /etc/nginx/sites-available/montecarlo-api /etc/nginx/sites-enabled/montecarlo-api
sudo nginx -t
sudo systemctl reload nginx
```

## Notes de sécurité

- ne jamais exposer de PAT côté serveur
- conserver seulement les endpoints applicatifs documentés et nécessaires
- endpoints attendus:
  - `POST /simulate`
  - `GET /simulations/history`
  - `GET /health`
  - `GET /health/mongo`
- conserver `python Scripts/check_identity_boundary.py` en CI
