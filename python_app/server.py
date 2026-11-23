"""Serveur HTTP Python 3.11 autonome (stdlib) pour Open Food Facts · QLever."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import pathlib
import urllib.parse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .off_qlever import (
    DEFAULT_QLEVER_ENDPOINT,
    SparqlValidationError,
    UpstreamApiError,
    execute_qlever_sparql,
    fetch_off_products,
    translate_nl_to_sparql,
)

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"


def _load_dotenv_if_present() -> None:
    env_file = ROOT_DIR / ".env"
    if not env_file.is_file():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


class OffQleverHandler(BaseHTTPRequestHandler):
    server_version = "OffQleverPython/1.0"

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(min(length, 1024 * 1024))
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/health":
            self._send_json(
                HTTPStatus.OK,
                {"ok": True, "runtime": "python", "endpoint": DEFAULT_QLEVER_ENDPOINT},
            )
            return

        if parsed.path == "/api/python-files":
            py_dir = ROOT_DIR / "python_app"
            specs = [
                ("off_qlever.py", "Cœur métier : NL → SPARQL, exécution QLever, validation et API Open Food Facts"),
                ("cli.py", "Interface en ligne de commande (table, CSV, JSON, produits)"),
                ("server.py", "Serveur HTTP Python 3.11 autonome sans dépendances externes"),
                ("fastapi_app.py", "API FastAPI + Uvicorn pour déploiement Python moderne"),
                ("test_off_qlever.py", "Suite de tests unitaires Python (unittest)"),
                ("requirements.txt", "Dépendances optionnelles (google-genai, fastapi, uvicorn)"),
            ]
            files = []
            for name, desc in specs:
                fpath = py_dir / name
                if fpath.is_file():
                    files.append(
                        {"name": name, "description": desc, "content": fpath.read_text(encoding="utf-8")}
                    )
            self._send_json(HTTPStatus.OK, {"files": files})
            return

        if parsed.path == "/api/off/products":
            qs = urllib.parse.parse_qs(parsed.query)
            facet = (qs.get("facet") or [""])[0]
            tag = (qs.get("tag") or [""])[0]
            try:
                data = fetch_off_products(facet, tag)
                self._send_json(HTTPStatus.OK, data)
            except SparqlValidationError as err:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(err)})
            except UpstreamApiError as err:
                self._send_json(err.status_code, {"error": str(err)})
            return

        # Serve static frontend from dist/ if built
        if DIST_DIR.is_dir():
            rel = parsed.path.lstrip("/") or "index.html"
            candidate = (DIST_DIR / rel).resolve()
            if not str(candidate).startswith(str(DIST_DIR.resolve())) or not candidate.is_file():
                candidate = DIST_DIR / "index.html"
            if candidate.is_file():
                mime, _ = mimetypes.guess_type(str(candidate))
                data = candidate.read_bytes()
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", mime or "application/octet-stream")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

        self._send_json(
            HTTPStatus.NOT_FOUND,
            {"error": "Route non trouvée. Exécutez 'npm run build' pour servir l'interface."},
        )

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        try:
            body = self._read_json_body()
        except Exception:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Corps JSON invalide."})
            return

        if parsed.path == "/api/nl-to-sparql":
            try:
                res = translate_nl_to_sparql(
                    str(body.get("question", "")),
                    previous_sparql=str(body.get("previousSparql", "")),
                    qlever_error=str(body.get("qleverError", "")),
                )
                self._send_json(HTTPStatus.OK, res)
            except SparqlValidationError as err:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(err)})
            except UpstreamApiError as err:
                self._send_json(err.status_code, {"error": str(err)})
            return

        if parsed.path == "/api/qlever/execute":
            try:
                res = execute_qlever_sparql(
                    str(body.get("sparql", "")),
                    endpoint=str(body.get("endpoint") or DEFAULT_QLEVER_ENDPOINT),
                )
                self._send_json(HTTPStatus.OK, res)
            except SparqlValidationError as err:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(err)})
            except UpstreamApiError as err:
                self._send_json(err.status_code, {"error": str(err)})
            return

        self._send_json(HTTPStatus.NOT_FOUND, {"error": "Endpoint API inconnu."})


def main(argv: list[str] | None = None) -> int:
    _load_dotenv_if_present()
    parser = argparse.ArgumentParser(description="Serveur HTTP Python Open Food Facts · QLever")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "3000")))
    args = parser.parse_args(argv)

    server = ThreadingHTTPServer((args.host, args.port), OffQleverHandler)
    print(f"Serveur Python Open Food Facts · QLever actif sur http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
