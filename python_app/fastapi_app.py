"""Application FastAPI alternative pour déployer l'API Python avec Uvicorn."""

from __future__ import annotations

import pathlib
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .off_qlever import (
    DEFAULT_QLEVER_ENDPOINT,
    SparqlValidationError,
    UpstreamApiError,
    execute_qlever_sparql,
    fetch_off_products,
    translate_nl_to_sparql,
)

app = FastAPI(title="Open Food Facts · QLever API", version="1.0.0")

DIST_DIR = pathlib.Path(__file__).resolve().parent.parent / "dist"


class NlToSparqlRequest(BaseModel):
    question: str = ""
    previousSparql: str = ""
    qleverError: str = ""


class QleverExecuteRequest(BaseModel):
    sparql: str
    endpoint: str = DEFAULT_QLEVER_ENDPOINT


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "runtime": "fastapi", "endpoint": DEFAULT_QLEVER_ENDPOINT}


@app.post("/api/nl-to-sparql")
def api_nl_to_sparql(payload: NlToSparqlRequest) -> dict:
    try:
        return translate_nl_to_sparql(
            payload.question,
            previous_sparql=payload.previousSparql,
            qlever_error=payload.qleverError,
        )
    except SparqlValidationError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except UpstreamApiError as err:
        raise HTTPException(status_code=err.status_code, detail=str(err)) from err


@app.post("/api/qlever/execute")
def api_qlever_execute(payload: QleverExecuteRequest) -> dict:
    try:
        return execute_qlever_sparql(payload.sparql, endpoint=payload.endpoint)
    except SparqlValidationError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except UpstreamApiError as err:
        raise HTTPException(status_code=err.status_code, detail=str(err)) from err


@app.get("/api/off/products")
def api_off_products(
    facet: str = Query(..., description="categories, ingredients, additives, labels ou brands"),
    tag: str = Query(..., description="Identifiant Open Food Facts"),
) -> dict:
    try:
        return fetch_off_products(facet, tag)
    except SparqlValidationError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    except UpstreamApiError as err:
        raise HTTPException(status_code=err.status_code, detail=str(err)) from err


if DIST_DIR.is_dir():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str) -> FileResponse:
        candidate = DIST_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(DIST_DIR / "index.html"))
