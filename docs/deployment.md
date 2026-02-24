# Déploiement Production

Ce document décrit deux options de déploiement pour le backend (`FastAPI`) sur un serveur Linux (ex: OVH).

## Option A: Docker Compose (recommandée)

### 1) Pré-requis serveur
- Docker Engine + plugin `docker compose`
- Ports ouverts:
  - `80` / `443` (Nginx reverse proxy)
  - backend exposé en interne uniquement

### 2) Structure minimale

```text
/opt/montecarlo/
  backend/
  requirements.txt
  docker-compose.yml
  nginx/
    montecarlo.conf
```

### 3) `docker-compose.yml`

```yaml
services:
  api:
    image: python:3.12-slim
    container_name: montecarlo-api
    working_dir: /app
    volumes:
      - ./backend:/app/backend:ro
      - ./requirements.txt:/app/requirements.txt:ro
    command: >
      sh -c "pip install --no-cache-dir -r /app/requirements.txt &&
             uvicorn backend.api:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers"
    restart: unless-stopped
    expose:
      - "8000"

  nginx:
    image: nginx:1.27-alpine
    container_name: montecarlo-nginx
    depends_on:
      - api
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/montecarlo.conf:/etc/nginx/conf.d/default.conf:ro
      # Décommentez si vous gérez TLS localement:
      # - ./certs:/etc/nginx/certs:ro
    restart: unless-stopped
```

### 4) `nginx/montecarlo.conf`

```nginx
server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://api:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### 5) Lancer / mettre à jour

```bash
cd /opt/montecarlo
docker compose up -d
docker compose logs -f api
```

## Option B: Nginx + systemd (sans Docker)

### 1) Pré-requis
- Python 3.12 installé sur le serveur
- Nginx
- utilisateur système dédié, par exemple `montecarlo`

### 2) Installation backend

```bash
sudo mkdir -p /opt/montecarlo
sudo chown -R montecarlo:montecarlo /opt/montecarlo

# en tant que montecarlo
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

### 4) Nginx reverse proxy

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

## Vérifications post-déploiement

```bash
curl -sS https://api.example.com/health
```

Doit renvoyer un statut `200`.

## Notes sécurité
- Ne jamais exposer de PAT côté serveur.
- Garder uniquement `POST /simulate` et `GET /health`.
- Conserver le contrôle `Scripts/check_identity_boundary.py` en CI.
