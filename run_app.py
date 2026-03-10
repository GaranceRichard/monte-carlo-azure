import argparse
import asyncio
import os
import socket
import sys
import webbrowser


def configure_event_loop_policy() -> None:
    if sys.platform != "win32":
        return
    policy_cls = getattr(asyncio, "WindowsSelectorEventLoopPolicy", None)
    if policy_cls is None:
        return
    asyncio.set_event_loop_policy(policy_cls())


# Sous Windows, on force la policy des le chargement du module pour eviter
# les tracebacks Proactor bruyants quand un client coupe brutalement la connexion.
configure_event_loop_policy()


def is_port_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.25)
        return s.connect_ex((host, port)) != 0


def main():
    import uvicorn

    # IMPORTANT: import reel pour que PyInstaller embarque le package backend
    from backend.api import app

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

    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        loop="asyncio",
        log_level="warning",
        access_log=False,
    )


if __name__ == "__main__":
    main()
