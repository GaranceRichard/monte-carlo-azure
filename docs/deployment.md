# Deploiement Production

Ce guide privilegie un deploiement simple et reproductible via Docker Compose.
L'objectif est de lancer une instance complete (backend + frontend statique servi par FastAPI)
sans configuration manuelle de `nginx` ou `systemd`.

## Option A: Docker Compose (recommandee)

### 1) Pre-requis

- Docker Engine
- Plugin `docker compose`

### 2) Depuis la racine du repo

```bash
cp .env.example .env
docker compose up -d --build
curl -sS http://127.0.0.1:8000/health
```

Si le endpoint retourne `{"status":"ok"}`, l'application est disponible sur:

- `http://127.0.0.1:8000`

### 3) Variables d'environnement

Le fichier `.env` est charge par `docker-compose.yml`.
Base recommandee:

```dotenv
APP_PORT=8000
APP_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
APP_CORS_ALLOW_CREDENTIALS=true
APP_FORECAST_TIMEOUT_SECONDS=30
APP_RATE_LIMIT_SIMULATE=20/minute
APP_REDIS_URL=redis://redis:6379/0
```

### 4) Commandes utiles

```bash
docker compose logs -f backend
docker compose logs -f redis
docker compose restart backend
docker compose down -v
```

## Option B: Nginx + systemd (sans Docker)

Cette option reste valide pour des environnements qui imposent un runtime natif Linux.

### 1) Pre-requis

- Python 3.12
- Nginx
- Utilisateur systeme dedie (ex: `montecarlo`)

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

Fichier `/etc/systemd/system/montecarlo-api.service`:

```ini
[Unit]
Description=Monte Carlo API (FastAPI)
After=network.target

[Service]
User=montecarlo
Group=montecarlo
WorkingDirectory=/opt/montecarlo
Environment=PYTHONUNBUFFERED=1
ExecStart=/opt/montecarlo/.venv/bin/uvicorn backend.api:app --host 127.0.0.1 --port 8000 --workers 2 --proxy-headers
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Activation:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now montecarlo-api
sudo systemctl status montecarlo-api
```

### 4) Reverse proxy Nginx

Fichier `/etc/nginx/sites-available/montecarlo-api`:

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

Activation:

```bash
sudo ln -s /etc/nginx/sites-available/montecarlo-api /etc/nginx/sites-enabled/montecarlo-api
sudo nginx -t
sudo systemctl reload nginx
```

## Notes securite

- Ne jamais exposer de PAT cote serveur.
- Garder uniquement `POST /simulate` et `GET /health`.
- Conserver `python Scripts/check_identity_boundary.py` en CI.
