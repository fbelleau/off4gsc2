"""Interface en langage naturel vers Open Food Facts & Wikidata via SPARQL QLever."""

from .off_qlever import (
    CURATED_EXAMPLES,
    DEFAULT_QLEVER_ENDPOINT,
    OFF_PREDICATES,
    build_qlever_system_prompt,
    detect_off_facet,
    execute_qlever_sparql,
    export_results_to_csv,
    fetch_off_products,
    is_valid_http_url,
    shorten_uri,
    translate_nl_to_sparql,
    validate_sparql_query,
)

__all__ = [
    "CURATED_EXAMPLES",
    "DEFAULT_QLEVER_ENDPOINT",
    "OFF_PREDICATES",
    "build_qlever_system_prompt",
    "detect_off_facet",
    "execute_qlever_sparql",
    "export_results_to_csv",
    "fetch_off_products",
    "is_valid_http_url",
    "shorten_uri",
    "translate_nl_to_sparql",
    "validate_sparql_query",
]
