"""Cœur métier Python : traduction Langage Naturel -> SPARQL QLever et passerelle Open Food Facts."""

from __future__ import annotations

import csv
import io
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

DEFAULT_QLEVER_ENDPOINT = "https://qlever.dev/api/wikidata"
OFF_SEARCH_API = "https://world.openfoodfacts.org/api/v2/search"
USER_AGENT = "OpenFoodFacts-QLever-Python/1.0 (https://world.openfoodfacts.org)"

OFF_PREDICATES: list[dict[str, str]] = [
    {
        "id": "wdt:P1821",
        "label_fr": "Catégorie Open Food Facts",
        "description_fr": "Relie un aliment ou une famille de produits à sa catégorie Open Food Facts.",
        "facet_type": "categories",
        "entity_count": "1 467",
    },
    {
        "id": "wdt:P5930",
        "label_fr": "Ingrédient Open Food Facts",
        "description_fr": "Identifiant canonique d'un ingrédient dans la taxonomie Open Food Facts.",
        "facet_type": "ingredients",
        "entity_count": "1 399",
    },
    {
        "id": "wdt:P1820",
        "label_fr": "Additif alimentaire OFF",
        "description_fr": "Identifiant d'un additif (E100, E330, etc.) dans Open Food Facts.",
        "facet_type": "additives",
        "entity_count": "366",
    },
    {
        "id": "wdt:P7927",
        "label_fr": "Label & certification OFF",
        "description_fr": "Labels qualité, bio, AOP/IGP ou certifications alimentaires.",
        "facet_type": "labels",
        "entity_count": "105",
    },
    {
        "id": "wdt:P14229",
        "label_fr": "Marque Open Food Facts",
        "description_fr": "Identifiant d'une marque agroalimentaire dans Open Food Facts.",
        "facet_type": "brands",
        "entity_count": "34",
    },
]

CURATED_EXAMPLES: list[dict[str, str]] = [
    {
        "id": "top-categories",
        "title": "Catégories les plus ramifiées",
        "question": "Quelles catégories Open Food Facts possèdent le plus de sous-catégories ?",
        "sparql": """PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?cat (SAMPLE(?nom) AS ?categorie) ?offCategory (COUNT(DISTINCT ?sub) AS ?sousCategories) WHERE {
  ?cat wdt:P1821 ?offCategory .
  ?sub wdt:P279 ?cat ;
       wdt:P1821 ?subOff .
  OPTIONAL { ?cat rdfs:label ?fr . FILTER(LANG(?fr) = "fr") }
  OPTIONAL { ?cat rdfs:label ?en . FILTER(LANG(?en) = "en") }
  BIND(COALESCE(?fr, ?en, ?offCategory) AS ?nom)
}
GROUP BY ?cat ?offCategory
ORDER BY DESC(?sousCategories)
LIMIT 25""",
    },
    {
        "id": "additives-e-codes",
        "title": "Additifs alimentaires et numéros E",
        "question": "Liste les additifs alimentaires Open Food Facts avec leur numéro E européen et leur nom en français.",
        "sparql": """PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?additive (SAMPLE(?nom) AS ?additif) ?eCode ?offAdditive WHERE {
  ?additive wdt:P1820 ?offAdditive .
  ?additive wdt:P628 ?eCode .
  OPTIONAL { ?additive rdfs:label ?fr . FILTER(LANG(?fr) = "fr") }
  OPTIONAL { ?additive rdfs:label ?en . FILTER(LANG(?en) = "en") }
  BIND(COALESCE(?fr, ?en, ?offAdditive) AS ?nom)
}
GROUP BY ?additive ?eCode ?offAdditive
ORDER BY ?eCode
LIMIT 30""",
    },
]

KNOWN_URI_PREFIXES: list[tuple[str, str]] = [
    ("http://www.wikidata.org/entity/", "wd:"),
    ("http://www.wikidata.org/prop/direct/", "wdt:"),
    ("http://www.wikidata.org/prop/", "p:"),
    ("http://wikiba.se/ontology#", "wikibase:"),
    ("http://www.w3.org/2000/01/rdf-schema#", "rdfs:"),
    ("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdf:"),
    ("http://schema.org/", "schema:"),
    ("http://www.w3.org/2001/XMLSchema#", "xsd:"),
    ("http://qlever.cs.uni-freiburg.de/builtin/", "ql:"),
]

OFF_FACET_PARAMS: dict[str, tuple[str, str]] = {
    "categories": ("categories_tags", "facets/categories"),
    "ingredients": ("ingredients_tags", "facets/ingredients"),
    "additives": ("additives_tags", "additive"),
    "labels": ("labels_tags", "facets/labels"),
    "brands": ("brands_tags", "facets/brands"),
}


class SparqlValidationError(ValueError):
    """Erreur levée lorsqu'une requête SPARQL est invalide ou non autorisée."""


class UpstreamApiError(RuntimeError):
    """Erreur levée lors d'un appel réseau vers Gemini, QLever ou Open Food Facts."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class ValidationResult:
    valid: bool
    normalized_query: str
    limit_added: bool
    error: str | None = None


def shorten_uri(uri: str) -> str:
    for base, prefix in KNOWN_URI_PREFIXES:
        if uri.startswith(base):
            return f"{prefix}{uri[len(base):]}"
    return uri


def is_valid_http_url(raw_url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(raw_url.strip())
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False


def strip_sparql_comments_and_strings(query: str) -> str:
    out: list[str] = []
    in_single = False
    in_double = False
    in_uri = False
    in_comment = False

    for i, ch in enumerate(query):
        prev = query[i - 1] if i > 0 else ""

        if in_comment:
            if ch == "\n":
                in_comment = False
                out.append("\n")
            continue

        if in_single:
            if ch == "'" and prev != "\\":
                in_single = False
            continue

        if in_double:
            if ch == '"' and prev != "\\":
                in_double = False
            continue

        if in_uri:
            if ch == ">":
                in_uri = False
            continue

        if ch == "#":
            in_comment = True
            continue
        if ch == "'":
            in_single = True
            out.append(" ")
            continue
        if ch == '"':
            in_double = True
            out.append(" ")
            continue
        if ch == "<":
            in_uri = True
            out.append(" ")
            continue

        out.append(ch)

    return "".join(out)


def validate_sparql_query(raw_query: str, default_limit: int = 100) -> ValidationResult:
    trimmed = raw_query.strip()
    if not trimmed:
        return ValidationResult(
            valid=False,
            normalized_query="",
            limit_added=False,
            error="La requête SPARQL est vide.",
        )

    stripped = strip_sparql_comments_and_strings(trimmed)

    if re.search(r"\b(INSERT|DELETE|DROP|CLEAR|LOAD|CREATE|COPY|MOVE|ADD)\b", stripped, re.I):
        return ValidationResult(
            valid=False,
            normalized_query=trimmed,
            limit_added=False,
            error="Seules les requêtes de lecture SPARQL (SELECT, ASK, CONSTRUCT, DESCRIBE) sont autorisées.",
        )

    if not re.search(r"\b(SELECT|ASK|CONSTRUCT|DESCRIBE)\b", stripped, re.I):
        return ValidationResult(
            valid=False,
            normalized_query=trimmed,
            limit_added=False,
            error="La requête doit contenir une clause SELECT, ASK, CONSTRUCT ou DESCRIBE.",
        )

    brace_depth = 0
    paren_depth = 0
    for ch in stripped:
        if ch == "{":
            brace_depth += 1
        elif ch == "}":
            brace_depth -= 1
        elif ch == "(":
            paren_depth += 1
        elif ch == ")":
            paren_depth -= 1

        if brace_depth < 0:
            return ValidationResult(
                valid=False,
                normalized_query=trimmed,
                limit_added=False,
                error='Accolade fermante "}" inattendue dans la requête SPARQL.',
            )
        if paren_depth < 0:
            return ValidationResult(
                valid=False,
                normalized_query=trimmed,
                limit_added=False,
                error='Parenthèse fermante ")" inattendue dans la requête SPARQL.',
            )

    if brace_depth != 0:
        return ValidationResult(
            valid=False,
            normalized_query=trimmed,
            limit_added=False,
            error='Accolades "{ }" non équilibrées dans la requête SPARQL.',
        )
    if paren_depth != 0:
        return ValidationResult(
            valid=False,
            normalized_query=trimmed,
            limit_added=False,
            error='Parenthèses "( )" non équilibrées dans la requête SPARQL.',
        )

    is_select = bool(re.search(r"\bSELECT\b", stripped, re.I))
    has_limit = bool(re.search(r"\bLIMIT\s+\d+\b", stripped, re.I))
    if is_select and not has_limit:
        return ValidationResult(
            valid=True,
            normalized_query=f"{trimmed}\nLIMIT {default_limit}",
            limit_added=True,
        )

    return ValidationResult(valid=True, normalized_query=trimmed, limit_added=False)


def detect_off_facet(
    var_name: str, cell: dict[str, Any] | None, query_text: str
) -> str | None:
    if not cell or cell.get("type") in ("uri", "bnode"):
        return None
    datatype = cell.get("datatype", "")
    if datatype and not datatype.endswith("#string"):
        return None

    val = str(cell.get("value", "")).strip()
    if not val or re.search(r"\s", val) or val.isdigit():
        return None

    lower_var = var_name.lower()
    lower_query = query_text.lower()

    if "off" in lower_var:
        if "cat" in lower_var:
            return "categories"
        if "ingr" in lower_var:
            return "ingredients"
        if "addit" in lower_var:
            return "additives"
        if "brand" in lower_var or "marque" in lower_var:
            return "brands"
        if "label" in lower_var:
            return "labels"

    if (
        re.match(
            r"^(nom|name|label|categorie|category|additif|ingredient|marque|brand|pays|country|sous|count|nb|total|code|ecode)",
            lower_var,
        )
        and "off" not in lower_var
    ):
        return None

    looks_like_slug = bool(
        re.match(r"^[a-z]{2}:[a-z0-9-]+$", val, re.I)
        or re.match(r"^[a-z0-9]+(-[a-z0-9]+)+$", val, re.I)
    )
    if "off" in lower_var or looks_like_slug:
        if "p1821" in lower_query and "p5930" not in lower_query and "p1820" not in lower_query:
            return "categories"
        if "p5930" in lower_query and "p1821" not in lower_query and "p1820" not in lower_query:
            return "ingredients"
        if "p1820" in lower_query:
            return "additives"
        if "p7927" in lower_query and "off" in lower_var:
            return "labels"
        if "p14229" in lower_query and "off" in lower_var:
            return "brands"

    if re.match(r"^e\d{3,4}[a-z]?(-[a-z0-9%-]+)?$", val) and "p1820" in lower_query:
        return "additives"

    return None


def export_results_to_csv(
    vars_list: list[str], bindings: list[dict[str, dict[str, Any]]]
) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(vars_list)
    for row in bindings:
        writer.writerow([row.get(col, {}).get("value", "") for col in vars_list])
    return buf.getvalue().rstrip("\n")


def build_qlever_system_prompt() -> str:
    return (
        "Tu es un expert en Web Sémantique, SPARQL 1.1 et QLever, spécialisé dans les données "
        "Open Food Facts reliées à Wikidata.\n"
        "Traduis la demande en langage naturel en une requête SPARQL valide, rapide et optimisée "
        "pour QLever (https://qlever.dev/api/wikidata).\n\n"
        "Propriétés Open Food Facts dans Wikidata :\n"
        "- wdt:P1821 : Open Food Facts food category ID (ex: 'french-cheeses', 'white-wines')\n"
        "- wdt:P5930 : Open Food Facts ingredient ID (ex: 'cocoa-butter', 'tarragon')\n"
        "- wdt:P1820 : Open Food Facts food additive ID (ex: 'e330', 'e100-curcumin')\n"
        "- wdt:P7927 : Open Food Facts label (ex: 'en:organic')\n"
        "- wdt:P14229 : Open Food Facts brand ID (ex: 'minute-maid')\n"
        "- wdt:P628 : Numéro E (code européen des additifs)\n"
        "- wdt:P279 : sous-classe de (hiérarchie taxonomique)\n\n"
        "Règles QLever :\n"
        "1. Déclarer les PREFIX (wd:, wdt:, rdfs:, schema:, ql:).\n"
        "2. Ne JAMAIS utiliser SERVICE wikibase:label (non supporté sur QLever). Utiliser OPTIONAL rdfs:label fr/en + COALESCE.\n"
        "3. Restreindre ?item avec une propriété Open Food Facts avant tout FILTER(CONTAINS(...)).\n"
        "4. Inclure un LIMIT raisonnable (25 à 50)."
    )


def _call_gemini_rest(
    api_key: str, model: str, prompt: str, system_instruction: str, low_thinking: bool
) -> dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    generation_config: dict[str, Any] = {
        "responseMimeType": "application/json",
        "responseSchema": {
            "type": "OBJECT",
            "properties": {
                "sparql": {"type": "STRING"},
                "explanation": {"type": "STRING"},
                "detectedIntent": {"type": "STRING"},
                "offFacetHint": {"type": "STRING"},
            },
            "required": ["sparql", "explanation", "detectedIntent", "offFacetHint"],
        },
    }
    if low_thinking:
        generation_config["thinkingConfig"] = {"thinkingLevel": "LOW"}

    payload = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": generation_config,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
            "User-Agent": "aistudio-build",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    candidates = raw.get("candidates") or []
    text = (
        candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if candidates
        else ""
    )
    if not text.strip():
        raise UpstreamApiError("Le modèle n'a renvoyé aucune réponse exploitable.", 502)
    return json.loads(text)


def translate_nl_to_sparql(
    question: str,
    *,
    previous_sparql: str = "",
    qlever_error: str = "",
    api_key: str | None = None,
) -> dict[str, str]:
    clean_question = question.strip()
    if not clean_question and not (previous_sparql.strip() and qlever_error.strip()):
        raise SparqlValidationError("Veuillez saisir une question en langage naturel.")

    resolved_key = (api_key or os.environ.get("GEMINI_API_KEY", "")).strip()
    if not resolved_key or resolved_key == "MY_GEMINI_API_KEY":
        raise UpstreamApiError(
            "Clé API Gemini non configurée côté serveur (GEMINI_API_KEY).", 503
        )

    if previous_sparql.strip() and qlever_error.strip():
        prompt = (
            f"La requête SPARQL suivante a échoué sur QLever :\n\n"
            f"Question : {clean_question or '(non précisée)'}\n"
            f"SPARQL :\n{previous_sparql}\n\n"
            f"Erreur QLever :\n{qlever_error}\n\n"
            "Corrige cette requête pour qu'elle s'exécute rapidement sur QLever."
        )
    else:
        prompt = (
            "Traduis cette demande en langage naturel en une requête SPARQL optimisée pour QLever "
            f'sur les données Open Food Facts / Wikidata :\n\n"{clean_question}"'
        )

    system_instruction = build_qlever_system_prompt()
    attempts = [
        ("gemini-4-hydrogen", True, 0.0),
        ("gemini-4-hydrogen", True, 0.7),
        ("gemini-3.1-flash-lite", False, 1.2),
    ]

    last_exc: Exception | None = None
    parsed: dict[str, Any] | None = None
    for model, low_thinking, delay in attempts:
        if delay > 0:
            time.sleep(delay)
        try:
            # Préfère le SDK officiel google-genai s'il est installé, sinon REST stdlib
            try:
                from google import genai  # type: ignore
                from google.genai import types  # type: ignore

                client = genai.Client(api_key=resolved_key)
                cfg_kwargs: dict[str, Any] = {
                    "system_instruction": system_instruction,
                    "response_mime_type": "application/json",
                    "response_schema": {
                        "type": "OBJECT",
                        "properties": {
                            "sparql": {"type": "STRING"},
                            "explanation": {"type": "STRING"},
                            "detectedIntent": {"type": "STRING"},
                            "offFacetHint": {"type": "STRING"},
                        },
                        "required": ["sparql", "explanation", "detectedIntent", "offFacetHint"],
                    },
                }
                if low_thinking:
                    cfg_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level="LOW")
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(**cfg_kwargs),
                )
                parsed = json.loads((resp.text or "").strip())
            except ImportError:
                parsed = _call_gemini_rest(resolved_key, model, prompt, system_instruction, low_thinking)
            break
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", errors="replace")
            last_exc = UpstreamApiError(body, err.code)
            if err.code not in (429, 503):
                raise last_exc
        except Exception as exc:
            last_exc = exc
            if not re.search(r"\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand)\b", str(exc), re.I):
                raise UpstreamApiError(str(exc), 502) from exc

    if parsed is None:
        raise UpstreamApiError(
            "Le service Gemini est temporairement surchargé (503). Veuillez réessayer.",
            503,
        ) from last_exc

    validation = validate_sparql_query(str(parsed.get("sparql", "")))
    if not validation.valid:
        raise SparqlValidationError(f"Requête SPARQL générée invalide : {validation.error}")

    return {
        "sparql": validation.normalized_query,
        "explanation": str(parsed.get("explanation", "")),
        "detectedIntent": str(parsed.get("detectedIntent", "")),
        "offFacetHint": str(parsed.get("offFacetHint", "general")),
    }


def execute_qlever_sparql(
    sparql: str, endpoint: str = DEFAULT_QLEVER_ENDPOINT, timeout_s: float = 20.0
) -> dict[str, Any]:
    target = (endpoint or DEFAULT_QLEVER_ENDPOINT).strip()
    if not is_valid_http_url(target):
        raise SparqlValidationError(
            "URL du point de terminaison QLever invalide (http:// ou https:// requis)."
        )

    validation = validate_sparql_query(sparql)
    if not validation.valid:
        raise SparqlValidationError(validation.error or "Requête SPARQL invalide.")

    encoded = urllib.parse.urlencode({"query": validation.normalized_query}).encode("utf-8")
    req = urllib.request.Request(
        target,
        data=encoded,
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/sparql-results+json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return {
                "head": data.get("head", {"vars": []}),
                "results": data.get("results", {"bindings": []}),
                "meta": data.get("meta", {}),
                "executedQuery": validation.normalized_query,
                "endpoint": target,
            }
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        detail = raw
        try:
            err_json = json.loads(raw)
            detail = err_json.get("exception") or err_json.get("error") or raw
        except Exception:
            pass
        status = 400 if 400 <= err.code < 500 else 502
        raise UpstreamApiError(detail[:600], status) from err
    except TimeoutError as err:
        raise UpstreamApiError(
            "Délai dépassé (20s) lors de l'exécution sur QLever.", 504
        ) from err
    except urllib.error.URLError as err:
        raise UpstreamApiError(
            f"Impossible de joindre le serveur QLever : {err.reason}", 502
        ) from err


def fetch_off_products(facet: str, tag: str, page_size: int = 12) -> dict[str, Any]:
    clean_tag = tag.strip()
    if facet not in OFF_FACET_PARAMS or not clean_tag:
        raise SparqlValidationError("Paramètres facet et tag requis pour Open Food Facts.")

    query_param, path_segment = OFF_FACET_PARAMS[facet]
    clean_slug = re.sub(r"^[a-z]{2}:", "", clean_tag)
    params = urllib.parse.urlencode(
        {
            query_param: clean_tag,
            "page_size": str(page_size),
            "fields": "code,product_name,brands,nutriscore_grade,ecoscore_grade,nova_group,quantity,image_front_small_url",
        }
    )
    url = f"{OFF_SEARCH_API}?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=12.0) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        raise UpstreamApiError(
            f"Open Food Facts API a répondu avec le statut {err.code}.", 502
        ) from err
    except urllib.error.URLError as err:
        raise UpstreamApiError(
            f"Impossible de récupérer les produits Open Food Facts : {err.reason}", 502
        ) from err

    products = []
    for p in payload.get("products") or []:
        products.append(
            {
                "code": str(p.get("code", "")),
                "product_name": str(p.get("product_name") or "Produit sans nom"),
                "brands": p.get("brands") if isinstance(p.get("brands"), str) else None,
                "nutriscore_grade": (
                    p.get("nutriscore_grade")
                    if isinstance(p.get("nutriscore_grade"), str)
                    else None
                ),
                "ecoscore_grade": (
                    p.get("ecoscore_grade")
                    if isinstance(p.get("ecoscore_grade"), str)
                    else None
                ),
                "nova_group": (
                    p.get("nova_group") if isinstance(p.get("nova_group"), int) else None
                ),
                "quantity": p.get("quantity") if isinstance(p.get("quantity"), str) else None,
                "image_front_small_url": (
                    p.get("image_front_small_url")
                    if isinstance(p.get("image_front_small_url"), str)
                    else None
                ),
            }
        )

    return {
        "count": payload.get("count", 0),
        "products": products,
        "facetUrl": f"https://world.openfoodfacts.org/{path_segment}/{urllib.parse.quote(clean_slug)}",
    }
