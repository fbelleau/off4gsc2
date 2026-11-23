"""Interface en ligne de commande (CLI) Python pour Open Food Facts · QLever."""

from __future__ import annotations

import argparse
import json
import sys

from .off_qlever import (
    CURATED_EXAMPLES,
    DEFAULT_QLEVER_ENDPOINT,
    execute_qlever_sparql,
    export_results_to_csv,
    fetch_off_products,
    shorten_uri,
    translate_nl_to_sparql,
)


def _print_table(vars_list: list[str], bindings: list[dict]) -> None:
    if not vars_list or not bindings:
        print("Aucun résultat retourné.")
        return

    rows: list[list[str]] = []
    for row in bindings:
        cells = []
        for v in vars_list:
            cell = row.get(v)
            if not cell:
                cells.append("—")
            elif cell.get("type") == "uri":
                cells.append(shorten_uri(cell["value"]))
            else:
                cells.append(str(cell.get("value", "")))
        rows.append(cells)

    widths = [
        max(len(f"?{v}"), *(len(r[i]) for r in rows))
        for i, v in enumerate(vars_list)
    ]
    header = " | ".join(f"?{v}".ljust(widths[i]) for i, v in enumerate(vars_list))
    sep = "-+-".join("-" * widths[i] for i in range(len(vars_list)))
    print(header)
    print(sep)
    for r in rows:
        print(" | ".join(r[i].ljust(widths[i]) for i in range(len(vars_list))))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Interroger Open Food Facts via SPARQL QLever en langage naturel."
    )
    parser.add_argument(
        "question",
        nargs="?",
        help="Question en français à traduire en SPARQL puis exécuter sur QLever.",
    )
    parser.add_argument(
        "--sparql",
        help="Exécuter directement une requête SPARQL sans passer par la traduction IA.",
    )
    parser.add_argument(
        "--example",
        choices=[ex["id"] for ex in CURATED_EXAMPLES],
        help="Exécuter un exemple prédéfini.",
    )
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_QLEVER_ENDPOINT,
        help=f"URL du point de terminaison QLever (défaut : {DEFAULT_QLEVER_ENDPOINT}).",
    )
    parser.add_argument(
        "--format",
        choices=["table", "json", "csv"],
        default="table",
        help="Format d'affichage des résultats.",
    )
    parser.add_argument(
        "--products",
        nargs=2,
        metavar=("FACET", "TAG"),
        help="Consulter les produits Open Food Facts (ex: --products categories french-cheeses).",
    )
    args = parser.parse_args(argv)

    try:
        if args.products:
            facet, tag = args.products
            res = fetch_off_products(facet, tag)
            if args.format == "json":
                print(json.dumps(res, ensure_ascii=False, indent=2))
            else:
                print(f"{res['count']} produits sur Open Food Facts ({res['facetUrl']})\n")
                for p in res["products"]:
                    nutri = p.get("nutriscore_grade") or "?"
                    print(f"- [{p['code']}] {p['product_name']} ({p.get('brands') or '—'}) · Nutri-Score {nutri}")
            return 0

        sparql_query = args.sparql
        if args.example:
            ex = next(e for e in CURATED_EXAMPLES if e["id"] == args.example)
            print(f"# Exemple : {ex['question']}\n", file=sys.stderr)
            sparql_query = ex["sparql"]
        elif args.question and not sparql_query:
            translated = translate_nl_to_sparql(args.question)
            print(f"# Intention : {translated['detectedIntent']}", file=sys.stderr)
            print(f"# Explication : {translated['explanation']}\n", file=sys.stderr)
            print(f"{translated['sparql']}\n", file=sys.stderr)
            sparql_query = translated["sparql"]

        if not sparql_query:
            parser.print_help()
            return 1

        result = execute_qlever_sparql(sparql_query, endpoint=args.endpoint)
        vars_list = result["head"]["vars"]
        bindings = result["results"]["bindings"]
        qtime = result.get("meta", {}).get("query-time-ms")

        if args.format == "json":
            print(json.dumps(result, ensure_ascii=False, indent=2))
        elif args.format == "csv":
            print(export_results_to_csv(vars_list, bindings))
        else:
            print(f"# {len(bindings)} lignes ({qtime} ms QLever)\n", file=sys.stderr)
            _print_table(vars_list, bindings)
        return 0
    except Exception as exc:
        print(f"Erreur : {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
