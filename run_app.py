import argparse
import os
import socket
import webbrowser

import uvicorn

# IMPORTANT: import reel pour que PyInstaller embarque le package backend
from backend.api import app


def is_port_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.25)
        return s.connect_ex((host, port)) != 0


def main():
    parser = argparse.ArgumentParser(description="MonteCarloADO launcher")
    parser.add_argument("--host", default=os.getenv("APP_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("APP_PORT", "8000")))
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    host, port = args.host, args.port

    if not is_port_free(host, port):
        raise SystemExit(
            f"Port {port} deja utilise sur {host}. "
            f"Essayez: --port {port + 1} (ex: 3001) ou --port 8000."
        )

    url = f"http://{host}:{port}/"
    if not args.no_browser:
        webbrowser.open(url)

    # On passe l'objet app (pas une string), donc pas d'import dynamique
    uvicorn.run(app, host=host, port=port, reload=False, log_level="warning", access_log=False)


if __name__ == "__main__":
    main()
