import React, { useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
} from 'lucide-react';
import {
  CURATED_EXAMPLES,
  DEFAULT_QLEVER_ENDPOINT,
  type CuratedExample,
} from '../lib/sparql';

interface QueryWorkspaceProps {
  question: string;
  onQuestionChange: (value: string) => void;
  sparql: string;
  onSparqlChange: (value: string) => void;
  explanation: string;
  endpoint: string;
  onEndpointChange: (value: string) => void;
  isTranslating: boolean;
  isExecuting: boolean;
  onTranslateAndRun: () => void;
  onTranslateOnly: () => void;
  onExecuteSparql: () => void;
  onSelectExample: (example: CuratedExample) => void;
  questionInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const QueryWorkspace: React.FC<QueryWorkspaceProps> = ({
  question,
  onQuestionChange,
  sparql,
  onSparqlChange,
  explanation,
  endpoint,
  onEndpointChange,
  isTranslating,
  isExecuting,
  onTranslateAndRun,
  onTranslateOnly,
  onExecuteSparql,
  onSelectExample,
  questionInputRef,
}) => {
  const [copied, setCopied] = useState(false);
  const [showEndpointInput, setShowEndpointInput] = useState(false);

  const busy = isTranslating || isExecuting;

  const handleCopy = async () => {
    if (!sparql.trim()) return;
    try {
      await navigator.clipboard.writeText(sparql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback silently ignored
    }
  };

  const handleQuestionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (question.trim() && !busy) {
        onTranslateAndRun();
      }
    }
  };

  const handleSparqlKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (sparql.trim() && !busy) {
        onExecuteSparql();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Natural Language Composer */}
      <section
        aria-labelledby="nl-heading"
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1
              id="nl-heading"
              className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight text-balance"
            >
              Interroger Open Food Facts en langage naturel
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Posez une question en français : elle est traduite en SPARQL puis exécutée en direct sur QLever.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
            Ctrl + Entrée pour lancer
          </span>
        </div>

        <div>
          <label htmlFor="nl-question" className="sr-only">
            Question en langage naturel sur Open Food Facts
          </label>
          <textarea
            ref={questionInputRef}
            id="nl-question"
            rows={2}
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            onKeyDown={handleQuestionKeyDown}
            placeholder="Ex. Quels additifs alimentaires Open Food Facts ont un numéro E européen ? Ou : Quels fromages français sont référencés ?"
            className="w-full rounded-lg border border-slate-300 bg-slate-50/60 px-4 py-3 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 resize-y transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={busy || !question.trim()}
              onClick={onTranslateAndRun}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {isTranslating
                ? 'Traduction SPARQL...'
                : isExecuting
                  ? 'Exécution QLever...'
                  : 'Traduire & exécuter'}
            </button>

            <button
              type="button"
              disabled={busy || !question.trim()}
              onClick={onTranslateOnly}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <Code2 className="w-4 h-4" aria-hidden="true" />
              Traduire seulement
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowEndpointInput((v) => !v)}
            aria-expanded={showEndpointInput}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
            Endpoint QLever
          </button>
        </div>

        {showEndpointInput && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <label
              htmlFor="qlever-endpoint"
              className="text-xs font-medium text-slate-700 whitespace-nowrap"
            >
              URL SPARQL QLever :
            </label>
            <input
              id="qlever-endpoint"
              type="url"
              value={endpoint}
              onChange={(e) => onEndpointChange(e.target.value)}
              placeholder={DEFAULT_QLEVER_ENDPOINT}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
            {endpoint !== DEFAULT_QLEVER_ENDPOINT && (
              <button
                type="button"
                onClick={() => onEndpointChange(DEFAULT_QLEVER_ENDPOINT)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                Réinitialiser
              </button>
            )}
          </div>
        )}

        {/* Quick Examples Strip */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="text-xs font-medium text-slate-500">Exemples prêts à exécuter</div>
          <div className="flex flex-wrap gap-2">
            {CURATED_EXAMPLES.map((example) => (
              <button
                key={example.id}
                type="button"
                disabled={busy}
                onClick={() => onSelectExample(example)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SPARQL Query Editor Panel */}
      <section
        aria-labelledby="sparql-heading"
        className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2
              id="sparql-heading"
              className="text-xs font-semibold text-slate-200 tracking-wide whitespace-nowrap"
            >
              Requête SPARQL QLever
            </h2>
            {explanation && (
              <span className="text-xs text-slate-400 truncate max-w-xl" title={explanation}>
                · {explanation}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!sparql.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  Copier
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onExecuteSparql}
              disabled={busy || !sparql.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed rounded-md transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              Exécuter SPARQL
            </button>
          </div>
        </div>

        <div className="p-1">
          <label htmlFor="sparql-editor" className="sr-only">
            Éditeur de requête SPARQL
          </label>
          <textarea
            id="sparql-editor"
            value={sparql}
            onChange={(e) => onSparqlChange(e.target.value)}
            onKeyDown={handleSparqlKeyDown}
            rows={Math.min(15, Math.max(7, (sparql ? sparql.split('\n').length : 7) + 1))}
            spellCheck={false}
            placeholder="La requête SPARQL générée apparaîtra ici. Vous pouvez aussi écrire ou modifier une requête manuellement..."
            className="w-full bg-slate-900 px-4 py-3 font-mono text-xs sm:text-[13px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none resize-y"
          />
        </div>
      </section>
    </div>
  );
};
