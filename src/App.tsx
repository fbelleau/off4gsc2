import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { Header, type ActiveSection } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { QueryWorkspace } from './components/QueryWorkspace';
import { ResultsTable } from './components/ResultsTable';
import { ProductDrawer } from './components/ProductDrawer';
import { DocumentationPanel } from './components/DocumentationPanel';
import { ExamplesGallery } from './components/ExamplesGallery';
import {
  CURATED_EXAMPLES,
  DEFAULT_QLEVER_ENDPOINT,
  type CuratedExample,
  type NaturalLanguageResult,
  type OffFacetType,
  type QueryHistoryItem,
  type SparqlResponse,
} from './lib/sparql';

const HISTORY_STORAGE_KEY = 'off_qlever_history_v1';

function loadSavedHistory(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const initialExample = CURATED_EXAMPLES[0];

  const [activeSection, setActiveSection] = useState<ActiveSection>('query');
  const [question, setQuestion] = useState<string>(initialExample.question);
  const [sparql, setSparql] = useState<string>(initialExample.sparql);
  const [explanation, setExplanation] = useState<string>(initialExample.explanation);
  const [endpoint, setEndpoint] = useState<string>(DEFAULT_QLEVER_ENDPOINT);

  const [isTranslating, setIsTranslating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [results, setResults] = useState<SparqlResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<'nl' | 'qlever' | null>(null);

  const [history, setHistory] = useState<QueryHistoryItem[]>(() => loadSavedHistory());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [productSelection, setProductSelection] = useState<{
    facet: OffFacetType;
    tag: string;
    displayName?: string;
  } | null>(null);

  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);

  const pushHistory = useCallback(
    (item: Omit<QueryHistoryItem, 'id' | 'timestamp'>) => {
      setHistory((prev) => {
        const entry: QueryHistoryItem = {
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
        };
        const deduped = prev.filter(
          (p) => p.sparql.trim() !== item.sparql.trim() || p.question !== item.question
        );
        const next = [entry, ...deduped].slice(0, 25);
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    },
    []
  );

  const executeSparqlQuery = useCallback(
    async (
      queryToRun: string,
      opts?: {
        questionLabel?: string;
        explanationLabel?: string;
        endpointUrl?: string;
        recordHistory?: boolean;
      }
    ) => {
      const targetEndpoint = opts?.endpointUrl ?? endpoint;
      setIsExecuting(true);
      setError(null);
      setErrorSource(null);

      try {
        const resp = await fetch('/api/qlever/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sparql: queryToRun,
            endpoint: targetEndpoint,
          }),
        });
        const payload = await resp.json();

        if (!resp.ok) {
          setError(payload.error || 'Erreur lors de l’exécution sur QLever.');
          setErrorSource('qlever');
          return;
        }

        const sparqlData = payload as SparqlResponse;
        setResults(sparqlData);

        if (opts?.recordHistory !== false) {
          pushHistory({
            question: opts?.questionLabel ?? question,
            sparql: sparqlData.executedQuery || queryToRun,
            explanation: opts?.explanationLabel ?? explanation,
            endpoint: targetEndpoint,
            rowCount: sparqlData.results?.bindings?.length ?? 0,
            queryTimeMs: sparqlData.meta?.['query-time-ms'] ?? null,
          });
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Impossible de joindre le serveur QLever.'
        );
        setErrorSource('qlever');
      } finally {
        setIsExecuting(false);
      }
    },
    [endpoint, explanation, pushHistory, question]
  );

  // Execute the initial curated example on mount so the workspace opens with live QLever data
  useEffect(() => {
    void executeSparqlQuery(initialExample.sparql, {
      questionLabel: initialExample.question,
      explanationLabel: initialExample.explanation,
      recordHistory: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateNaturalLanguage = useCallback(
    async (runAfter: boolean) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      setIsTranslating(true);
      setError(null);
      setErrorSource(null);

      try {
        const resp = await fetch('/api/nl-to-sparql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed }),
        });
        const payload = await resp.json();

        if (!resp.ok) {
          setError(payload.error || 'Erreur lors de la traduction en SPARQL.');
          setErrorSource('nl');
          return;
        }

        const translated = payload as NaturalLanguageResult;
        setSparql(translated.sparql);
        setExplanation(translated.explanation || '');

        if (runAfter) {
          setIsTranslating(false);
          await executeSparqlQuery(translated.sparql, {
            questionLabel: trimmed,
            explanationLabel: translated.explanation,
          });
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur réseau lors de la traduction.');
        setErrorSource('nl');
      } finally {
        setIsTranslating(false);
      }
    },
    [executeSparqlQuery, question]
  );

  const handleAiRepair = async () => {
    if (!sparql.trim() || !error) return;
    setIsRepairing(true);
    try {
      const resp = await fetch('/api/nl-to-sparql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          previousSparql: sparql,
          qleverError: error,
        }),
      });
      const payload = await resp.json();
      if (!resp.ok) {
        setError(payload.error || 'Impossible de corriger la requête automatiquement.');
        setErrorSource('nl');
        return;
      }
      const fixed = payload as NaturalLanguageResult;
      setSparql(fixed.sparql);
      setExplanation(fixed.explanation || explanation);
      await executeSparqlQuery(fixed.sparql, {
        questionLabel: question,
        explanationLabel: fixed.explanation,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la correction IA.');
      setErrorSource('nl');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleSelectExample = (ex: CuratedExample) => {
    setActiveSection('query');
    setQuestion(ex.question);
    setSparql(ex.sparql);
    setExplanation(ex.explanation);
    void executeSparqlQuery(ex.sparql, {
      questionLabel: ex.question,
      explanationLabel: ex.explanation,
    });
  };

  const handleInsertSnippet = (snippet: string) => {
    setActiveSection('query');
    setSparql((prev) => {
      const base = prev.trim();
      if (!base) {
        return `PREFIX wdt: <http://www.wikidata.org/prop/direct/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nPREFIX ql: <http://qlever.cs.uni-freiburg.de/builtin/>\n\nSELECT ?item ?label WHERE {\n  ${snippet}\n  OPTIONAL { ?item rdfs:label ?label . FILTER(LANG(?label) = "fr") }\n}\nLIMIT 25`;
      }
      const lastBrace = base.lastIndexOf('}');
      if (lastBrace !== -1) {
        return `${base.slice(0, lastBrace)}  ${snippet}\n${base.slice(lastBrace)}`;
      }
      return `${base}\n${snippet}`;
    });
  };

  const handleSelectHistory = (item: QueryHistoryItem) => {
    setActiveSection('query');
    setQuestion(item.question);
    setSparql(item.sparql);
    setExplanation(item.explanation);
    setEndpoint(item.endpoint || DEFAULT_QLEVER_ENDPOINT);
    void executeSparqlQuery(item.sparql, {
      questionLabel: item.question,
      explanationLabel: item.explanation,
      endpointUrl: item.endpoint,
      recordHistory: false,
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleNewQuery = () => {
    setActiveSection('query');
    setQuestion('');
    setExplanation('');
    setError(null);
    setErrorSource(null);
    setTimeout(() => {
      questionInputRef.current?.focus();
    }, 30);
  };

  const handleNavigate = (section: ActiveSection) => {
    setActiveSection(section);
    if (section === 'schema') {
      // On desktop the schema is visible in the sidebar; on mobile open the drawer or show docs table
      if (window.innerWidth < 1024) {
        setMobileSidebarOpen(true);
      } else {
        setActiveSection('docs');
      }
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onNewQuery={handleNewQuery}
      />

      <div className="flex-1 max-w-[1440px] w-full mx-auto flex">
        <Sidebar
          history={history}
          onInsertSnippet={handleInsertSnippet}
          onSelectHistory={handleSelectHistory}
          onClearHistory={handleClearHistory}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Mobile utility bar for sidebar access & section switching */}
          <div className="flex flex-wrap items-center justify-between gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg whitespace-nowrap shrink-0"
            >
              <PanelLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Schéma
            </button>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveSection('query')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  activeSection === 'query' ? 'bg-white text-slate-900' : 'text-slate-600'
                }`}
              >
                Requêteur
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('examples')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  activeSection === 'examples' ? 'bg-white text-slate-900' : 'text-slate-600'
                }`}
              >
                Exemples
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('docs')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  activeSection === 'docs' ? 'bg-white text-slate-900' : 'text-slate-600'
                }`}
              >
                Docs
              </button>
            </div>
          </div>

          {activeSection === 'docs' || activeSection === 'schema' ? (
            <DocumentationPanel
              onBackToQuery={() => setActiveSection('query')}
              onInsertExampleQuery={(sampleSparql, sampleQuestion) => {
                setActiveSection('query');
                setQuestion(sampleQuestion);
                setSparql(sampleSparql);
                setExplanation(
                  'Recherche plein texte native QLever (ql:contains-word) sur les ingrédients Open Food Facts.'
                );
                void executeSparqlQuery(sampleSparql, {
                  questionLabel: sampleQuestion,
                  explanationLabel: 'Recherche plein texte QLever',
                });
              }}
            />
          ) : activeSection === 'examples' ? (
            <ExamplesGallery
              onSelectExample={handleSelectExample}
              onBackToQuery={() => setActiveSection('query')}
            />
          ) : (
            <>
              <QueryWorkspace
                question={question}
                onQuestionChange={setQuestion}
                sparql={sparql}
                onSparqlChange={setSparql}
                explanation={explanation}
                endpoint={endpoint}
                onEndpointChange={setEndpoint}
                isTranslating={isTranslating}
                isExecuting={isExecuting}
                onTranslateAndRun={() => void translateNaturalLanguage(true)}
                onTranslateOnly={() => void translateNaturalLanguage(false)}
                onExecuteSparql={() => void executeSparqlQuery(sparql)}
                onSelectExample={handleSelectExample}
                questionInputRef={questionInputRef}
              />

              <ResultsTable
                data={results}
                isLoading={isTranslating || isExecuting}
                error={error}
                canAiRepair={errorSource === 'qlever' && Boolean(sparql.trim())}
                isRepairing={isRepairing}
                onAiRepair={() => void handleAiRepair()}
                onInspectOffFacet={(facet, tag, displayName) =>
                  setProductSelection({ facet, tag, displayName })
                }
                onRunDefaultExample={() => handleSelectExample(CURATED_EXAMPLES[0])}
              />
            </>
          )}
        </main>
      </div>

      <ProductDrawer
        selection={productSelection}
        onClose={() => setProductSelection(null)}
      />
    </div>
  );
}
