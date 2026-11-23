import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURATED_EXAMPLES,
  OFF_PREDICATES,
  detectOffFacetFromBinding,
  exportResultsToCsv,
  isValidHttpUrl,
  shortenUri,
  validateSparqlQuery,
} from './sparql';

test('validateSparqlQuery rejects empty or mutating queries', () => {
  const emptyRes = validateSparqlQuery('   ');
  assert.equal(emptyRes.valid, false);

  const deleteRes = validateSparqlQuery('DELETE DATA { <http://a> <http://b> <http://c> }');
  assert.equal(deleteRes.valid, false);

  const insertRes = validateSparqlQuery('INSERT DATA { <http://a> <http://b> <http://c> }');
  assert.equal(insertRes.valid, false);
});

test('validateSparqlQuery detects unbalanced braces and parentheses', () => {
  const badBraces = validateSparqlQuery('SELECT ?s WHERE { ?s ?p ?o ');
  assert.equal(badBraces.valid, false);

  const badParens = validateSparqlQuery('SELECT ?s WHERE { ?s ?p ?o . FILTER(LANG(?o = "fr") }');
  assert.equal(badParens.valid, false);

  // Braces inside string literals or comments should not trigger imbalance
  const literalBraces = validateSparqlQuery(
    '# comment with {\nSELECT ?s WHERE { ?s ?p "{test}" . } LIMIT 5'
  );
  assert.equal(literalBraces.valid, true);
  assert.equal(literalBraces.limitAdded, false);
});

test('validateSparqlQuery appends default LIMIT on SELECT queries without LIMIT', () => {
  const res = validateSparqlQuery('SELECT ?s ?p WHERE { ?s ?p ?o . }', 50);
  assert.equal(res.valid, true);
  assert.equal(res.limitAdded, true);
  assert.match(res.normalizedQuery, /LIMIT 50$/);
});

test('all curated examples pass SPARQL validation', () => {
  assert.ok(CURATED_EXAMPLES.length >= 6);
  assert.ok(OFF_PREDICATES.length >= 5);
  for (const example of CURATED_EXAMPLES) {
    const validation = validateSparqlQuery(example.sparql);
    assert.equal(validation.valid, true, `Example ${example.id} should be valid: ${validation.error}`);
    assert.equal(validation.limitAdded, false, `Example ${example.id} should include explicit LIMIT`);
  }
});

test('shortenUri compresses standard Wikidata and QLever namespaces', () => {
  assert.equal(shortenUri('http://www.wikidata.org/entity/Q10943'), 'wd:Q10943');
  assert.equal(shortenUri('http://www.wikidata.org/prop/direct/P1821'), 'wdt:P1821');
  assert.equal(shortenUri('http://qlever.cs.uni-freiburg.de/builtin/contains-word'), 'ql:contains-word');
  assert.equal(shortenUri('https://world.openfoodfacts.org/'), 'https://world.openfoodfacts.org/');
});

test('detectOffFacetFromBinding identifies Open Food Facts facets accurately', () => {
  assert.equal(
    detectOffFacetFromBinding(
      'offCategory',
      { type: 'literal', value: 'white-wines' },
      'SELECT ?offCategory WHERE { ?x wdt:P1821 ?offCategory }'
    ),
    'categories'
  );
  assert.equal(
    detectOffFacetFromBinding(
      'offAdditive',
      { type: 'literal', value: 'e330' },
      'SELECT ?offAdditive WHERE { ?x wdt:P1820 ?offAdditive }'
    ),
    'additives'
  );
  assert.equal(
    detectOffFacetFromBinding(
      'offIngredient',
      { type: 'literal', value: 'tarragon' },
      'SELECT ?offIngredient WHERE { ?x wdt:P5930 ?offIngredient }'
    ),
    'ingredients'
  );
  // Labels with spaces or single-word French labels or integer counts must not trigger OFF facet buttons
  assert.equal(
    detectOffFacetFromBinding(
      'nom',
      { type: 'literal', value: 'vin blanc' },
      'SELECT ?nom ?offCategory WHERE { ?x wdt:P1821 ?offCategory }'
    ),
    null
  );
  assert.equal(
    detectOffFacetFromBinding(
      'categorie',
      { type: 'literal', value: 'confiserie' },
      'SELECT ?categorie ?offCategory WHERE { ?x wdt:P1821 ?offCategory }'
    ),
    null
  );
  assert.equal(
    detectOffFacetFromBinding(
      'sousCategories',
      {
        type: 'literal',
        value: '30',
        datatype: 'http://www.w3.org/2001/XMLSchema#int',
      },
      'SELECT ?offCategory ?sousCategories WHERE { ?x wdt:P1821 ?offCategory }'
    ),
    null
  );
});

test('exportResultsToCsv escapes commas, quotes, and newlines safely', () => {
  const csv = exportResultsToCsv(
    ['nom', 'code'],
    [
      {
        nom: { type: 'literal', value: 'Chocolat, noir "70%"' },
        code: { type: 'literal', value: 'E322' },
      },
    ]
  );
  assert.equal(csv, 'nom,code\n"Chocolat, noir ""70%""",E322');
});

test('isValidHttpUrl accepts http/https and rejects invalid schemes', () => {
  assert.equal(isValidHttpUrl('https://qlever.dev/api/wikidata'), true);
  assert.equal(isValidHttpUrl('http://localhost:7001'), true);
  assert.equal(isValidHttpUrl('ftp://example.com'), false);
  assert.equal(isValidHttpUrl('not-a-url'), false);
});
