import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  DEFAULT_QLEVER_ENDPOINT,
  buildQleverSystemPrompt,
  isValidHttpUrl,
  normalizeOffTag,
  validateSparqlQuery,
  type NaturalLanguageResult,
  type OffFacetType,
  type SparqlResponse,
} from './src/lib/sparql.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const OFF_FACET_PARAM_MAP: Record<OffFacetType, { queryParam: string; pathSegment: string }> = {
  categories: { queryParam: 'categories_tags', pathSegment: 'facets/categories' },
  ingredients: { queryParam: 'ingredients_tags', pathSegment: 'facets/ingredients' },
  additives: { queryParam: 'additives_tags', pathSegment: 'additive' },
  labels: { queryParam: 'labels_tags', pathSegment: 'facets/labels' },
  brands: { queryParam: 'brands_tags', pathSegment: 'facets/brands' },
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, endpoint: DEFAULT_QLEVER_ENDPOINT });
  });

  app.post('/api/nl-to-sparql', async (req, res) => {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const previousSparql =
      typeof req.body?.previousSparql === 'string' ? req.body.previousSparql.trim() : '';
    const qleverError =
      typeof req.body?.qleverError === 'string' ? req.body.qleverError.trim() : '';

    if (!question && !(previousSparql && qleverError)) {
      res.status(400).json({
        error: 'Veuillez saisir une question en langage naturel.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Clé API Gemini non configurée côté serveur. Vérifiez la variable GEMINI_API_KEY dans les secrets de l’application.',
      });
      return;
    }

    try {
      const prompt =
        previousSparql && qleverError
          ? `La requête SPARQL suivante a échoué sur QLever :\n\nQuestion d'origine : ${question || '(non précisée)'}\n\nRequête SPARQL :\n${previousSparql}\n\nErreur retournée par QLever :\n${qleverError}\n\nCorrige cette requête pour qu'elle s'exécute rapidement et sans erreur sur QLever.`
          : `Traduis cette demande en langage naturel en une requête SPARQL optimisée pour QLever sur les données Open Food Facts / Wikidata :\n\n"${question}"`;

      const schemaConfig = {
        systemInstruction: buildQleverSystemPrompt(),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sparql: {
              type: Type.STRING,
              description: 'Requête SPARQL complète et exécutable sur QLever avec ses PREFIX.',
            },
            explanation: {
              type: Type.STRING,
              description: 'Explication concise en français de ce que fait la requête SPARQL.',
            },
            detectedIntent: {
              type: Type.STRING,
              description: 'Intention principale résumée en 3 à 6 mots en français.',
            },
            offFacetHint: {
              type: Type.STRING,
              description:
                'Type principal Open Food Facts interrogé : categories, ingredients, additives, labels, brands, mixed ou general.',
            },
          },
          required: ['sparql', 'explanation', 'detectedIntent', 'offFacetHint'],
        },
      };

      const callModel = async (model: string, useLowThinking: boolean) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: useLowThinking
            ? { ...schemaConfig, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : schemaConfig,
        });

      const isTransient = (msg: string) =>
        /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded)\b/i.test(msg);

      let response;
      const attempts: Array<{ model: string; lowThinking: boolean; delayMs: number }> = [
        { model: 'gemini-4-hydrogen', lowThinking: true, delayMs: 0 },
        { model: 'gemini-4-hydrogen', lowThinking: true, delayMs: 700 },
        { model: 'gemini-3.1-flash-lite', lowThinking: false, delayMs: 1200 },
      ];

      let lastErr: unknown;
      for (const attempt of attempts) {
        if (attempt.delayMs > 0) {
          await new Promise((r) => setTimeout(r, attempt.delayMs));
        }
        try {
          response = await callModel(attempt.model, attempt.lowThinking);
          break;
        } catch (err) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          if (!isTransient(msg)) {
            throw err;
          }
        }
      }

      if (!response) {
        throw lastErr;
      }

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'Le modèle n’a renvoyé aucune réponse exploitable.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as NaturalLanguageResult;
      const validation = validateSparqlQuery(parsed.sparql);
      if (!validation.valid) {
        res.status(422).json({
          error: `Requête SPARQL générée invalide : ${validation.error}`,
          sparql: parsed.sparql,
        });
        return;
      }

      res.json({
        sparql: validation.normalizedQuery,
        explanation: parsed.explanation,
        detectedIntent: parsed.detectedIntent,
        offFacetHint: parsed.offFacetHint,
      });
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      console.error('Gemini NL-to-SPARQL error:', rawMessage);
      const isBusy = /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand)\b/i.test(rawMessage);
      res.status(isBusy ? 503 : 502).json({
        error: isBusy
          ? 'Le service de traduction Gemini est temporairement surchargé (503). Veuillez réessayer dans quelques secondes.'
          : `Erreur lors de la traduction en SPARQL : ${rawMessage}`,
      });
    }
  });

  app.post('/api/qlever/execute', async (req, res) => {
    const rawSparql = typeof req.body?.sparql === 'string' ? req.body.sparql : '';
    const requestedEndpoint =
      typeof req.body?.endpoint === 'string' && req.body.endpoint.trim()
        ? req.body.endpoint.trim()
        : DEFAULT_QLEVER_ENDPOINT;

    if (!isValidHttpUrl(requestedEndpoint)) {
      res.status(400).json({
        error: 'URL du point de terminaison QLever invalide (http:// ou https:// requis).',
      });
      return;
    }

    const validation = validateSparqlQuery(rawSparql);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const body = new URLSearchParams({ query: validation.normalizedQuery });
      const upstream = await fetch(requestedEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/sparql-results+json',
          'User-Agent': 'OpenFoodFacts-QLever-Explorer/1.0',
        },
        body: body.toString(),
        signal: controller.signal,
      });

      const responseText = await upstream.text();

      if (!upstream.ok) {
        let detail = responseText;
        try {
          const errJson = JSON.parse(responseText) as { exception?: string; error?: string };
          detail = errJson.exception || errJson.error || responseText;
        } catch {
          // keep raw response text
        }
        res.status(upstream.status >= 400 && upstream.status < 500 ? 400 : 502).json({
          error: detail.slice(0, 600),
          executedQuery: validation.normalizedQuery,
          endpoint: requestedEndpoint,
        });
        return;
      }

      const json = JSON.parse(responseText) as SparqlResponse;
      res.json({
        head: json.head ?? { vars: [] },
        results: json.results ?? { bindings: [] },
        meta: json.meta ?? {},
        executedQuery: validation.normalizedQuery,
        endpoint: requestedEndpoint,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        res.status(504).json({
          error:
            'Délai dépassé (20s) lors de l’exécution sur QLever. Essayez de restreindre le filtre ou d’ajouter un LIMIT plus bas.',
          executedQuery: validation.normalizedQuery,
          endpoint: requestedEndpoint,
        });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({
        error: `Impossible de joindre le serveur QLever : ${message}`,
        executedQuery: validation.normalizedQuery,
        endpoint: requestedEndpoint,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  });

  app.get('/api/off/products', async (req, res) => {
    const facet = typeof req.query.facet === 'string' ? (req.query.facet as OffFacetType) : null;
    const rawTag = typeof req.query.tag === 'string' ? req.query.tag : '';
    const tag = normalizeOffTag(rawTag);

    if (!facet || !(facet in OFF_FACET_PARAM_MAP) || !tag) {
      res.status(400).json({
        error: 'Paramètres facet et tag requis pour consulter Open Food Facts.',
      });
      return;
    }

    const { queryParam, pathSegment } = OFF_FACET_PARAM_MAP[facet];
    const cleanSlug = tag.replace(/^[a-z]{2}:/, '');
    const apiUrl = new URL('https://world.openfoodfacts.org/api/v2/search');
    apiUrl.searchParams.set(queryParam, tag);
    apiUrl.searchParams.set('page_size', '12');
    apiUrl.searchParams.set(
      'fields',
      'code,product_name,brands,nutriscore_grade,ecoscore_grade,nova_group,quantity,image_front_small_url'
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const upstream = await fetch(apiUrl.toString(), {
        headers: {
          'User-Agent': 'OpenFoodFacts-QLever-Explorer/1.0 (https://world.openfoodfacts.org)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!upstream.ok) {
        res.status(502).json({
          error: `Open Food Facts API a répondu avec le statut ${upstream.status}.`,
        });
        return;
      }

      const data = (await upstream.json()) as {
        count?: number;
        products?: Array<Record<string, unknown>>;
      };

      res.json({
        count: data.count ?? 0,
        products: (data.products ?? []).map((p) => ({
          code: String(p.code ?? ''),
          product_name: String(p.product_name || 'Produit sans nom'),
          brands: typeof p.brands === 'string' ? p.brands : undefined,
          nutriscore_grade:
            typeof p.nutriscore_grade === 'string' ? p.nutriscore_grade : undefined,
          ecoscore_grade: typeof p.ecoscore_grade === 'string' ? p.ecoscore_grade : undefined,
          nova_group: typeof p.nova_group === 'number' ? p.nova_group : undefined,
          quantity: typeof p.quantity === 'string' ? p.quantity : undefined,
          image_front_small_url:
            typeof p.image_front_small_url === 'string' ? p.image_front_small_url : undefined,
        })),
        facetUrl: `https://world.openfoodfacts.org/${pathSegment}/${encodeURIComponent(cleanSlug)}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({
        error: `Impossible de récupérer les produits Open Food Facts : ${message}`,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
