import React, { useState } from 'react';
import { Database, History, Plus, Trash2 } from 'lucide-react';
import { OFF_PREDICATES, type OffPredicateInfo, type QueryHistoryItem } from '../lib/sparql';

interface SidebarProps {
  history: QueryHistoryItem[];
  onInsertSnippet: (snippet: string) => void;
  onSelectHistory: (item: QueryHistoryItem) => void;
  onClearHistory: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  history,
  onInsertSnippet,
  onSelectHistory,
  onClearHistory,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const [tab, setTab] = useState<'schema' | 'history'>('schema');

  const handleInsert = (pred: OffPredicateInfo) => {
    onInsertSnippet(pred.snippet);
    onCloseMobile?.();
  };

  const handleHistoryPick = (item: QueryHistoryItem) => {
    onSelectHistory(item);
    onCloseMobile?.();
  };

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <div
          role="tablist"
          aria-label="Outils latéraux"
          className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'schema'}
            onClick={() => setTab('schema')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'schema'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            Schéma RDF
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            onClick={() => setTab('history')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            Historique ({history.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'schema' ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 tracking-tight">
                Propriétés Open Food Facts
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Cliquez sur un prédicat pour insérer son motif de triplet dans l’éditeur SPARQL.
              </p>
            </div>

            <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
              {OFF_PREDICATES.map((pred) => (
                <button
                  key={pred.id}
                  type="button"
                  onClick={() => handleInsert(pred)}
                  className="w-full text-left py-3 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-emerald-800">
                      {pred.id}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-emerald-800 transition-colors">
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      Insérer
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-slate-800">
                    {pred.labelFr}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 leading-snug">
                    {pred.descriptionFr}
                  </div>
                  {pred.entityCount && (
                    <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-400">
                      {pred.entityCount} entités indexées
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-900 tracking-tight">
                Requêtes récentes
              </h2>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-700 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                  Vider
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center leading-relaxed">
                Aucune requête exécutée pour le moment. Posez une question ou choisissez un exemple.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleHistoryPick(item)}
                    className="w-full text-left py-3 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    <p className="text-xs font-medium text-slate-900 line-clamp-2 leading-snug">
                      {item.question || 'Requête SPARQL manuelle'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                      <span>{item.rowCount} lignes</span>
                      {item.queryTimeMs !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.queryTimeMs} ms</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {new Date(item.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        aria-label="Référence RDF et historique"
        className="hidden lg:block w-[280px] shrink-0"
      >
        <div className="sticky top-14 h-[calc(100vh-3.5rem)]">{content}</div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-80 max-w-[85vw] h-full bg-white shadow-xl z-50">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
