"""Tests unitaires Python (unittest) pour le module Open Food Facts · QLever."""

import unittest

from python_app.off_qlever import (
    CURATED_EXAMPLES,
    OFF_PREDICATES,
    detect_off_facet,
    export_results_to_csv,
    is_valid_http_url,
    shorten_uri,
    validate_sparql_query,
)


class TestOffQleverPython(unittest.TestCase):
    def test_validate_rejects_empty_and_mutating(self) -> None:
        self.assertFalse(validate_sparql_query("   ").valid)
        self.assertFalse(
            validate_sparql_query("DELETE DATA { <http://a> <http://b> <http://c> }").valid
        )
        self.assertFalse(
            validate_sparql_query("INSERT DATA { <http://a> <http://b> <http://c> }").valid
        )

    def test_validate_balanced_braces_and_parens(self) -> None:
        self.assertFalse(validate_sparql_query("SELECT ?s WHERE { ?s ?p ?o ").valid)
        self.assertFalse(
            validate_sparql_query('SELECT ?s WHERE { ?s ?p ?o . FILTER(LANG(?o = "fr") }').valid
        )
        res = validate_sparql_query(
            '# commentaire {\nSELECT ?s WHERE { ?s ?p "{test}" . } LIMIT 5'
        )
        self.assertTrue(res.valid)
        self.assertFalse(res.limit_added)

    def test_validate_appends_default_limit(self) -> None:
        res = validate_sparql_query("SELECT ?s ?p WHERE { ?s ?p ?o . }", default_limit=50)
        self.assertTrue(res.valid)
        self.assertTrue(res.limit_added)
        self.assertTrue(res.normalized_query.endswith("LIMIT 50"))

    def test_curated_examples_are_valid(self) -> None:
        self.assertGreaterEqual(len(CURATED_EXAMPLES), 2)
        self.assertEqual(len(OFF_PREDICATES), 5)
        for ex in CURATED_EXAMPLES:
            res = validate_sparql_query(ex["sparql"])
            self.assertTrue(res.valid, f"Exemple invalide {ex['id']}: {res.error}")
            self.assertFalse(res.limit_added)

    def test_shorten_uri(self) -> None:
        self.assertEqual(shorten_uri("http://www.wikidata.org/entity/Q10943"), "wd:Q10943")
        self.assertEqual(
            shorten_uri("http://www.wikidata.org/prop/direct/P1821"), "wdt:P1821"
        )

    def test_detect_off_facet_filters_counts_and_labels(self) -> None:
        self.assertEqual(
            detect_off_facet(
                "offCategory",
                {"type": "literal", "value": "french-cheeses"},
                "SELECT ?offCategory WHERE { ?x wdt:P1821 ?offCategory }",
            ),
            "categories",
        )
        self.assertEqual(
            detect_off_facet(
                "offAdditive",
                {"type": "literal", "value": "e100-curcumin"},
                "SELECT ?offAdditive WHERE { ?x wdt:P1820 ?offAdditive }",
            ),
            "additives",
        )
        self.assertIsNone(
            detect_off_facet(
                "sousCategories",
                {
                    "type": "literal",
                    "value": "30",
                    "datatype": "http://www.w3.org/2001/XMLSchema#int",
                },
                "SELECT ?offCategory ?sousCategories WHERE { ?x wdt:P1821 ?offCategory }",
            )
        )
        self.assertIsNone(
            detect_off_facet(
                "categorie",
                {"type": "literal", "value": "confiserie"},
                "SELECT ?categorie ?offCategory WHERE { ?x wdt:P1821 ?offCategory }",
            )
        )
        self.assertIsNone(
            detect_off_facet(
                "codeE",
                {"type": "literal", "value": "E100"},
                "SELECT ?codeE ?offAdditive WHERE { ?x wdt:P1820 ?offAdditive }",
            )
        )

    def test_export_csv_and_url_validation(self) -> None:
        csv_text = export_results_to_csv(
            ["nom", "code"],
            [{"nom": {"value": 'Chocolat, noir "70%"'}, "code": {"value": "E322"}}],
        )
        self.assertEqual(csv_text, 'nom,code\n"Chocolat, noir ""70%""",E322')
        self.assertTrue(is_valid_http_url("https://qlever.dev/api/wikidata"))
        self.assertFalse(is_valid_http_url("ftp://example.com"))


if __name__ == "__main__":
    unittest.main()
