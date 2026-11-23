export type OffFacetType = 'categories' | 'ingredients' | 'additives' | 'labels' | 'brands';

export interface SparqlBindingValue {
  type: 'uri' | 'literal' | 'typed-literal' | 'bnode';
  value: string;
  'xml:lang'?: string;
  datatype?: string;
}

export interface SparqlResponse {
  head: {
    vars: string[];
  };
  results: {
    bindings: Record<string, SparqlBindingValue>[];
  };
  meta?: {
    'query-time-ms'?: number;
    'result-size-total'?: number;
    warnings?: string[];
  };
  executedQuery?: string;
  endpoint?: string;
}

export interface NaturalLanguageResult {
  sparql: string;
  explanation: string;
  detectedIntent: string;
  offFacetHint: OffFacetType | 'mixed' | 'general';
}

export interface OffPredicateInfo {
  id: string;
  prefix: string;
  labelFr: string;
  descriptionFr: string;
  facetType?: OffFacetType;
  snippet: string;
  entityCount?: string;
}

export interface CuratedExample {
  id: string;
  title: string;
  question: string;
  facetHint: OffFacetType | 'mixed';
  sparql: string;
  explanation: string;
}

export interface OffProduct {
  code: string;
  product_name: string;
  brands?: string;
  nutriscore_grade?: string;
  ecoscore_grade?: string;
  nova_group?: number;
  quantity?: string;
  image_front_small_url?: string;
}

export interface QueryHistoryItem {
  id: string;
  question: string;
  sparql: string;
  explanation: string;
  endpoint: string;
  rowCount: number;
  queryTimeMs: number | null;
  timestamp: string;
}

export const DEFAULT_QLEVER_ENDPOINT = 'https://qlever.dev/api/wikidata';

export const STANDARD_PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
PREFIX ql: <http://qlever.cs.uni-freiburg.de/builtin/>`;

export const OFF_PREDICATES: OffPredicateInfo[] = [
  {
    id: 'wdt:P1821',
    prefix: 'P1821',
    labelFr: 'Catégorie Open Food Facts',
    descriptionFr: 'Relie un aliment ou une famille de produits à sa catégorie Open Food Facts.',
    facetType: 'categories',
    snippet: '?item wdt:P1821 ?offCategory .',
    entityCount: '1 467',
  },
  {
    id: 'wdt:P5930',
    prefix: 'P5930',
    labelFr: 'Ingrédient Open Food Facts',
    descriptionFr: 'Identifiant canonique d’un ingrédient dans la taxonomie Open Food Facts.',
    facetType: 'ingredients',
    snippet: '?item wdt:P5930 ?offIngredient .',
    entityCount: '1 399',
  },
  {
    id: 'wdt:P1820',
    prefix: 'P1820',
    labelFr: 'Additif alimentaire OFF',
    descriptionFr: 'Identifiant d’un additif (E100, E330, etc.) dans Open Food Facts.',
    facetType: 'additives',
    snippet: '?item wdt:P1820 ?offAdditive .',
    entityCount: '366',
  },
  {
    id: 'wdt:P7927',
    prefix: 'P7927',
    labelFr: 'Label & certification OFF',
    descriptionFr: 'Labels qualité, bio, AOP/IGP ou certifications alimentaires.',
    facetType: 'labels',
    snippet: '?item wdt:P7927 ?offLabel .',
    entityCount: '105',
  },
  {
    id: 'wdt:P14229',
    prefix: 'P14229',
    labelFr: 'Marque Open Food Facts',
    descriptionFr: 'Identifiant d’une marque agroalimentaire dans Open Food Facts.',
    facetType: 'brands',
    snippet: '?item wdt:P14229 ?offBrand .',
    entityCount: '34',
  },
  {
    id: 'wdt:P628',
    prefix: 'P628',
    labelFr: 'Numéro E (additif européen)',
    descriptionFr: 'Code E officiel de l’Union européenne (ex. E300, E330).',
    snippet: 'OPTIONAL { ?item wdt:P628 ?eCode . }',
  },
  {
    id: 'wdt:P279',
    prefix: 'P279',
    labelFr: 'Sous-classe de (taxonomie)',
    descriptionFr: 'Hiérarchie taxonomique entre catégories ou ingrédients alimentaires.',
    snippet: '?item wdt:P279 ?parent .',
  },
  {
    id: 'ql:contains-word',
    prefix: 'QLever FTS',
    labelFr: 'Recherche plein texte QLever',
    descriptionFr: 'Index plein texte natif QLever ultra-rapide sur les littéraux.',
    snippet: '?text ql:contains-entity ?item ;\n      ql:contains-word "chocolat" .',
  },
];

export const CURATED_EXAMPLES: CuratedExample[] = [
  {
    id: 'top-categories',
    title: 'Catégories les plus ramifiées',
    question: 'Quelles catégories Open Food Facts possèdent le plus de sous-catégories ?',
    facetHint: 'categories',
    explanation:
      'Compte les sous-catégories directes (wdt:P279) elles-mêmes reliées à Open Food Facts (wdt:P1821) et classe les familles les plus riches.',
    sparql: `PREFIX wdt: <http://www.wikidata.org/prop/direct/>
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
LIMIT 25`,
  },
  {
    id: 'additives-e-codes',
    title: 'Additifs alimentaires et numéros E',
    question: 'Liste les additifs alimentaires Open Food Facts avec leur numéro E européen et leur nom en français.',
    facetHint: 'additives',
    explanation:
      'Interroge les entités dotées d’un identifiant additif Open Food Facts (wdt:P1820) et récupère leur code E officiel (wdt:P628).',
    sparql: `PREFIX wdt: <http://www.wikidata.org/prop/direct/>
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
LIMIT 30`,
  },
  {
    id: 'french-cheeses',
    title: 'Fromages et produits laitiers',
    question: 'Quelles variétés de fromages sont référencées dans Open Food Facts ?',
    facetHint: 'categories',
    explanation:
      'Explore les sous-classes de fromage (wd:Q10943) possédant une catégorie Open Food Facts (wdt:P1821) et leur pays d’origine éventuel.',
    sparql: `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?cheese ?nom ?offCategory ?paysNom WHERE {
  ?cheese wdt:P279+ wd:Q10943 ;
          wdt:P1821 ?offCategory .
  OPTIONAL { ?cheese rdfs:label ?fr . FILTER(LANG(?fr) = "fr") }
  OPTIONAL { ?cheese rdfs:label ?en . FILTER(LANG(?en) = "en") }
  BIND(COALESCE(?fr, ?en, ?offCategory) AS ?nom)
  OPTIONAL {
    ?cheese wdt:P495 ?pays .
    ?pays rdfs:label ?paysNom .
    FILTER(LANG(?paysNom) = "fr")
  }
}
ORDER BY ?nom
LIMIT 30`,
  },
  {
    id: 'ingredients-spices',
    title: 'Épices et herbes aromatiques',
    question: 'Quelles épices et herbes sont indexées comme ingrédients dans Open Food Facts ?',
    facetHint: 'ingredients',
    explanation:
      'Recherche les sous-classes d’épice (wd:Q42527) possédant un identifiant d’ingrédient Open Food Facts (wdt:P5930).',
    sparql: `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?ingredient ?nom ?offIngredient WHERE {
  ?ingredient wdt:P279* wd:Q42527 ;
              wdt:P5930 ?offIngredient .
  OPTIONAL { ?ingredient rdfs:label ?fr . FILTER(LANG(?fr) = "fr") }
  OPTIONAL { ?ingredient rdfs:label ?en . FILTER(LANG(?en) = "en") }
  BIND(COALESCE(?fr, ?en, ?offIngredient) AS ?nom)
}
ORDER BY ?nom
LIMIT 30`,
  },
  {
    id: 'labels-certifications',
    title: 'Labels et certifications alimentaires',
    question: 'Quels labels alimentaires Open Food Facts sont associés à un pays ?',
    facetHint: 'labels',
    explanation:
      'Récupère les labels Open Food Facts (wdt:P7927), leur nom français ou anglais et le pays associé (wdt:P17).',
    sparql: `PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?labelEntity (SAMPLE(?nom) AS ?label) ?offLabel (SAMPLE(?paysFr) AS ?pays) WHERE {
  ?labelEntity wdt:P7927 ?offLabel .
  OPTIONAL { ?labelEntity rdfs:label ?fr . FILTER(LANG(?fr) = "fr") }
  OPTIONAL { ?labelEntity rdfs:label ?en . FILTER(LANG(?en) = "en") }
  BIND(COALESCE(?fr, ?en, ?offLabel) AS ?nom)
  OPTIONAL {
    ?labelEntity wdt:P17 ?p .
    ?p rdfs:label ?paysFr .
    FILTER(LANG(?paysFr) = "fr")
  }
}
GROUP BY ?labelEntity ?offLabel
ORDER BY ?label
LIMIT 30`,
  },
  {
    id: 'brands-linked',
    title: 'Marques agroalimentaires liées',
    question: 'Quelles marques agroalimentaires ont un identifiant Open Food Facts et quel est leur pays d’origine ?',
    facetHint: 'brands',
    explanation:
      'Liste les marques référencées via la propriété Open Food Facts brand ID (wdt:P14229) avec leur pays (wdt:P17) et leur site web éventuel.',
    sparql: `PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?brand (SAMPLE(?nom) AS ?marque) ?offBrand (SAMPLE(?paysFr) AS ?pays) WHERE {
  ?brand wdt:P14229 ?offBrand .
  OPTIONAL { ?brand rdfs:label ?fr . FILTER(LANG(?fr) = "fr") }
  OPTIONAL { ?brand rdfs:label ?en . FILTER(LANG(?en) = "en") }
  BIND(COALESCE(?fr, ?en, ?offBrand) AS ?nom)
  OPTIONAL {
    ?brand wdt:P17 ?p .
    ?p rdfs:label ?paysFr .
    FILTER(LANG(?paysFr) = "fr")
  }
}
GROUP BY ?brand ?offBrand
ORDER BY ?marque
LIMIT 30`,
  },
];

const KNOWN_URI_PREFIXES: Array<[string, string]> = [
  ['http://www.wikidata.org/entity/', 'wd:'],
  ['http://www.wikidata.org/prop/direct/', 'wdt:'],
  ['http://www.wikidata.org/prop/', 'p:'],
  ['http://wikiba.se/ontology#', 'wikibase:'],
  ['http://www.w3.org/2000/01/rdf-schema#', 'rdfs:'],
  ['http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rdf:'],
  ['http://schema.org/', 'schema:'],
  ['http://www.w3.org/2001/XMLSchema#', 'xsd:'],
  ['http://qlever.cs.uni-freiburg.de/builtin/', 'ql:'],
];

export function shortenUri(uri: string): string {
  for (const [base, prefix] of KNOWN_URI_PREFIXES) {
    if (uri.startsWith(base)) {
      return `${prefix}${uri.slice(base.length)}`;
    }
  }
  return uri;
}

export function stripSparqlCommentsAndStrings(query: string): string {
  let out = '';
  let inSingle = false;
  let inDouble = false;
  let inUri = false;
  let inComment = false;

  for (let i = 0; i < query.length; i++) {
    const ch = query[i];
    const prev = i > 0 ? query[i - 1] : '';

    if (inComment) {
      if (ch === '\n') {
        inComment = false;
        out += '\n';
      }
      continue;
    }

    if (inSingle) {
      if (ch === "'" && prev !== '\\') {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"' && prev !== '\\') {
        inDouble = false;
      }
      continue;
    }

    if (inUri) {
      if (ch === '>') {
        inUri = false;
      }
      continue;
    }

    if (ch === '#') {
      inComment = true;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      out += ' ';
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ' ';
      continue;
    }
    if (ch === '<') {
      inUri = true;
      out += ' ';
      continue;
    }
    out += ch;
  }

  return out;
}

export interface SparqlValidationResult {
  valid: boolean;
  error?: string;
  normalizedQuery: string;
  limitAdded: boolean;
}

export function validateSparqlQuery(rawQuery: string, defaultLimit = 100): SparqlValidationResult {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'La requête SPARQL est vide.',
      normalizedQuery: '',
      limitAdded: false,
    };
  }

  const stripped = stripSparqlCommentsAndStrings(trimmed);

  // Reject SPARQL Update / mutation keywords
  if (/\b(INSERT|DELETE|DROP|CLEAR|LOAD|CREATE|COPY|MOVE|ADD)\b/i.test(stripped)) {
    return {
      valid: false,
      error: 'Seules les requêtes de lecture SPARQL (SELECT, ASK, CONSTRUCT, DESCRIBE) sont autorisées.',
      normalizedQuery: trimmed,
      limitAdded: false,
    };
  }

  // Must contain a valid SPARQL read query form
  if (!/\b(SELECT|ASK|CONSTRUCT|DESCRIBE)\b/i.test(stripped)) {
    return {
      valid: false,
      error: 'La requête doit contenir une clause SELECT, ASK, CONSTRUCT ou DESCRIBE.',
      normalizedQuery: trimmed,
      limitAdded: false,
    };
  }

  // Check balanced braces and parentheses
  let braceDepth = 0;
  let parenDepth = 0;
  for (const ch of stripped) {
    if (ch === '{') braceDepth++;
    if (ch === '}') braceDepth--;
    if (ch === '(') parenDepth++;
    if (ch === ')') parenDepth--;
    if (braceDepth < 0) {
      return {
        valid: false,
        error: 'Parenthèse ou accolade fermante "}" inattendue dans la requête SPARQL.',
        normalizedQuery: trimmed,
        limitAdded: false,
      };
    }
    if (parenDepth < 0) {
      return {
        valid: false,
        error: 'Parenthèse fermante ")" inattendue dans la requête SPARQL.',
        normalizedQuery: trimmed,
        limitAdded: false,
      };
    }
  }

  if (braceDepth !== 0) {
    return {
      valid: false,
      error: 'Accolades "{ }" non équilibrées dans la requête SPARQL.',
      normalizedQuery: trimmed,
      limitAdded: false,
    };
  }
  if (parenDepth !== 0) {
    return {
      valid: false,
      error: 'Parenthèses "( )" non équilibrées dans la requête SPARQL.',
      normalizedQuery: trimmed,
      limitAdded: false,
    };
  }

  // Add default LIMIT on SELECT queries if none exists at top-level
  const isSelect = /\bSELECT\b/i.test(stripped);
  const hasLimit = /\bLIMIT\s+\d+\b/i.test(stripped);
  if (isSelect && !hasLimit) {
    return {
      valid: true,
      normalizedQuery: `${trimmed}\nLIMIT ${defaultLimit}`,
      limitAdded: true,
    };
  }

  return {
    valid: true,
    normalizedQuery: trimmed,
    limitAdded: false,
  };
}

export function normalizeOffTag(rawTag: string): string {
  const cleaned = rawTag.trim();
  if (!cleaned) return '';
  return cleaned;
}

export function detectOffFacetFromBinding(
  varName: string,
  cell: SparqlBindingValue | undefined,
  queryText: string
): OffFacetType | null {
  if (!cell || cell.type === 'uri' || cell.type === 'bnode') return null;
  if (cell.datatype && !cell.datatype.endsWith('#string')) return null;

  const val = cell.value.trim();
  if (!val || /\s/.test(val) || /^\d+$/.test(val)) {
    // OFF facet slugs never contain spaces and are never plain integers
    return null;
  }

  const lowerVar = varName.toLowerCase();
  const lowerQuery = queryText.toLowerCase();

  // Explicit Open Food Facts variable names (must start with or contain "off")
  if (lowerVar.includes('off')) {
    if (lowerVar.includes('cat')) return 'categories';
    if (lowerVar.includes('ingr')) return 'ingredients';
    if (lowerVar.includes('addit')) return 'additives';
    if (lowerVar.includes('brand') || lowerVar.includes('marque')) return 'brands';
    if (lowerVar.includes('label')) return 'labels';
  }

  // Non-OFF human display / count / code columns must never be treated as OFF facet tags
  if (
    /^(nom|name|label|categorie|category|additif|ingredient|marque|brand|pays|country|sous|count|nb|total|code|ecode)/.test(
      lowerVar
    ) &&
    !lowerVar.includes('off')
  ) {
    return null;
  }

  // Fallback for generic variable names (?offId, ?id, ?slug, ?tag) with clear OFF slug format
  const looksLikeOffSlug =
    /^[a-z]{2}:[a-z0-9-]+$/i.test(val) || /^[a-z0-9]+(-[a-z0-9]+)+$/i.test(val);

  if (lowerVar.includes('off') || looksLikeOffSlug) {
    if (lowerQuery.includes('p1821') && !lowerQuery.includes('p5930') && !lowerQuery.includes('p1820')) {
      return 'categories';
    }
    if (lowerQuery.includes('p5930') && !lowerQuery.includes('p1821') && !lowerQuery.includes('p1820')) {
      return 'ingredients';
    }
    if (lowerQuery.includes('p1820')) {
      return 'additives';
    }
    if (lowerQuery.includes('p7927') && lowerVar.includes('off')) {
      return 'labels';
    }
    if (lowerQuery.includes('p14229') && lowerVar.includes('off')) {
      return 'brands';
    }
  }

  // Lowercase e-number OFF slug pattern (e.g. e100-curcumin, e330)
  if (/^e\d{3,4}[a-z]?(-[a-z0-9%-]+)?$/.test(val) && lowerQuery.includes('p1820')) {
    return 'additives';
  }

  return null;
}

export function formatCellText(cell: SparqlBindingValue | undefined): string {
  if (!cell) return '—';
  if (cell.type === 'uri') {
    return shortenUri(cell.value);
  }
  return cell.value;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportResultsToCsv(
  vars: string[],
  bindings: Record<string, SparqlBindingValue>[]
): string {
  const header = vars.map(escapeCsvCell).join(',');
  const rows = bindings.map((row) =>
    vars.map((v) => escapeCsvCell(row[v]?.value ?? '')).join(',')
  );
  return [header, ...rows].join('\n');
}

export function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildQleverSystemPrompt(): string {
  return `Tu es un expert en Web Sémantique, SPARQL 1.1 et QLever, spécialisé dans les données Open Food Facts reliées à Wikidata.
Ton rôle est de traduire une question en langage naturel (en français ou en anglais) en une requête SPARQL valide, rapide et optimisée pour le moteur QLever (endpoint par défaut : https://qlever.dev/api/wikidata).

### Vocabulaire Wikidata <-> Open Food Facts (source officielle) :
- wdt:P1821 : Open Food Facts food category ID (ex: "french-cheeses", "white-wines", "en:fruits") — 1 467 catégories.
- wdt:P5930 : Open Food Facts ingredient ID (ex: "cocoa-butter", "sugar", "tarragon") — 1 399 ingrédients.
- wdt:P1820 : Open Food Facts food additive ID (ex: "e330", "e100-curcumin") — 366 additifs.
- wdt:P7927 : Open Food Facts label (ex: "en:organic", "en:fair-trade", "fr:ab-agriculture-biologique") — 105 labels.
- wdt:P14229 : Open Food Facts brand ID (ex: "minute-maid", "kellogg-s") — 34 marques.

### Propriétés Wikidata complémentaires utiles :
- wdt:P628 : Numéro E (code européen des additifs, ex: "E330", "E100").
- wdt:P279 : sous-classe de (ex: ?sub wdt:P279+ wd:Q10943 pour les sous-classes de fromage Q10943, Q2095 aliment, Q42527 épice, Q185217 produit laitier, Q3314483 fruit comestible, Q11004 légume, Q40050 boisson, Q195 chocolat).
- wdt:P31 : nature de l'élément (instance of).
- wdt:P17 / wdt:P495 : pays / pays d'origine.
- wdt:P366 : usage / fonction (ex: colorant, conservateur, antioxydant, édulcorant).
- wdt:P527 : composé de / contient.
- rdfs:label : libellé multilingue.
- schema:description : description courte.

### Règles strictes d'optimisation QLever :
1. TOUJOURS déclarer explicitement les PREFIX nécessaires en tête de requête (wd:, wdt:, rdfs:, schema:, ql:).
2. Ne JAMAIS utiliser SERVICE wikibase:label (c'est spécifique à Blazegraph WDQS et NON supporté sur QLever !). Utiliser explicitement rdfs:label avec FILTER(LANG(?var) = "fr") et un fallback optionnel en anglais :
   OPTIONAL { ?item rdfs:label ?fr . FILTER(LANG(?fr) = "fr") }
   OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
   BIND(COALESCE(?fr, ?en) AS ?nom)
3. Pour rechercher un mot-clé sur les libellés dans QLever, privilégier le graphe restreint aux entités Open Food Facts (ex: ?item wdt:P1821 ?offCategory . puis FILTER(CONTAINS(LCASE(STR(?nom)), "mot")) sur ce petit sous-ensemble de < 1500 entités) OU utiliser ql:contains-entity / ql:contains-word quand on cherche sur tout Wikidata. Ne jamais faire de FILTER(CONTAINS(...)) sur toute la table rdfs:label sans contraindre d'abord ?item par une propriété Open Food Facts (wdt:P1821, wdt:P5930, wdt:P1820, wdt:P7927, wdt:P14229).
4. Nommer les variables Open Food Facts de manière explicite (?offCategory, ?offIngredient, ?offAdditive, ?offLabel, ?offBrand) afin que l'interface puisse automatiquement proposer l'inspection des produits réels Open Food Facts.
5. Toujours inclure un LIMIT raisonnable (ex: LIMIT 25 ou LIMIT 50) et éviter les doublons via DISTINCT ou GROUP BY + SAMPLE().
6. Répondre uniquement au format JSON structuré demandé, avec une explication claire en français.`;
}
