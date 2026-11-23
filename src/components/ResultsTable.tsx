import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  ExternalLink,
  PackageSearch,
  Search,
  Wand2,
} from 'lucide-react';
import {
  detectOffFacetFromBinding,
  exportResultsToCsv,
  formatCellText,
  type OffFacetType,
  type SparqlBindingValue,
  type SparqlResponse,
} from '../lib/sparql';

interface ResultsTableProps {
  data: SparqlResponse | null;
  isLoading: boolean;
  error: string | null;
  canAiRepair: boolean;
  isRepairing: boolean;
  onAiRepair: () => void;
  onInspectOffFacet: (facet: OffFacetType, tag: string, displayName?: string) => void;
  onRunDefaultExample: () => void;
}

type SortDirection = 'asc' | 'desc' | null;

export const ResultsTable: React.FC<ResultsTableProps> = ({
  data,
  isLoading,
  error,
  canAiRepair,
  isRepairing,
  onAiRepair,
  onInspectOffFacet,
  onRunDefaultExample,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const vars = data?.head?.vars ?? [];
  const rawBindings = data?.results?.bindings ?? [];
  const executedQuery = data?.executedQuery ?? '';

  const filteredAndSorted = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    let rows = rawBindings;
    if (query) {
      rows = rows.filter((row) =>
        vars.some((v) => (row[v]?.value ?? '').toLowerCase().includes(query))
      );
    }

    if (sortCol && sortDir) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortCol]?.value ?? '';
        const bv = b[sortCol]?.value ?? '';
        const an = Number(av);
        const bn = Number(bv);
        let cmp = 0;
        if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') {
          cmp = an - bn;
        } else {
          cmp = av.localeCompare(bv, 'fr', { numeric: true, sensitivity: 'base' });
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [rawBindings, vars, filterText, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol(null);
      setSortDir(null);
    }
  };

  const triggerDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csv = exportResultsToCsv(vars, filteredAndSorted);
    triggerDownload(csv, 'openfoodfacts-qlever.csv', 'text/csv;charset=utf-8');
  };

  const handleExportJson = () => {
    triggerDownload(
      JSON.stringify(data, null, 2),
      'openfoodfacts-qlever.json',
      'application/json;charset=utf-8'
    );
  };

  if (error) {
    return (
      <section
        role="alert"
        className="bg-white border border-rose-200 rounded-xl p-5 space-y-3"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-rose-900">
              Erreur lors de l’exécution
            </h3>
            <p className="text-xs sm:text-sm font-mono text-rose-800 whitespace-pre-wrap break-words">
              {error}
            </p>
          </div>
        </div>
        {canAiRepair && (
          <div className="pt-1 flex items-center gap-3">
            <button
              type="button"
              disabled={isRepairing}
              onClick={onAiRepair}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
              {isRepairing ? 'Correction en cours...' : 'Corriger la requête avec l’IA'}
            </button>
          </div>
        )}
      </section>
    );
  }

  if (isLoading) {
    return (
      <section
        aria-busy="true"
        aria-label="Chargement des résultats QLever"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx} className="px-5 py-3 flex items-center gap-6">
              <div className="h-3.5 w-28 bg-slate-100 rounded animate-pulse" />
              <div className="h-3.5 w-44 bg-slate-100 rounded animate-pulse" />
              <div className="h-3.5 w-32 bg-slate-100 rounded animate-pulse" />
              <div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <h3 className="font-display text-base font-semibold text-slate-900">
          Prêt pour votre première requête SPARQL
        </h3>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          Saisissez une question en français ci-dessus ou lancez un des exemples Open Food Facts pour interroger le graphe QLever.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onRunDefaultExample}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Explorer les catégories Open Food Facts
          </button>
        </div>
      </section>
    );
  }

  const queryTime = data.meta?.['query-time-ms'];
  const totalCount = rawBindings.length;

  return (
    <section
      aria-labelledby="results-heading"
      data-testid="results-section"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Results Toolbar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 id="results-heading" className="text-sm font-semibold text-slate-900">
            Résultats
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>
              {filteredAndSorted.length}
              {filterText.trim() ? ` / ${totalCount}` : ''} lignes
            </span>
            {typeof queryTime === 'number' && (
              <>
                <span aria-hidden="true">·</span>
                <span>{queryTime} ms QLever</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {totalCount > 0 && (
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Filtrer les résultats"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filtrer..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-emerald-700 focus:outline-none w-40 sm:w-48"
              />
            </div>
          )}

          <div
            role="tablist"
            aria-label="Format d'affichage"
            className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'table'}
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tableau
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'json'}
              onClick={() => setViewMode('json')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'json'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              JSON QLever
            </button>
          </div>

          {totalCount > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table or Raw JSON */}
      {viewMode === 'json' ? (
        <pre className="p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-[520px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : totalCount === 0 ? (
        <div className="p-8 text-center space-y-2">
          <p className="text-sm font-medium text-slate-800">
            Aucun résultat retourné par QLever pour cette requête.
          </p>
          <p className="text-xs text-slate-500">
            Essayez d’élargir un filtre de langue ou de vérifier les propriétés Open Food Facts utilisées.
          </p>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Aucune ligne ne correspond au filtre « {filterText} ».
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {vars.map((col) => {
                  const isSorted = sortCol === col;
                  return (
                    <th
                      key={col}
                      scope="col"
                      className="px-4 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <span className="font-mono">?{col}</span>
                        {isSorted && sortDir === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                        ) : isSorted && sortDir === 'desc' ? (
                          <ArrowDown className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredAndSorted.map((row, rowIdx) => {
                // Find a human-readable display name from another column in the row if available
                const displayNameCell: SparqlBindingValue | undefined =
                  row.nom || row.categorie || row.additif || row.label || row.marque;

                return (
                  <tr
                    key={rowIdx}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {vars.map((col) => {
                      const cell = row[col];
                      const formatted = formatCellText(cell);
                      const isNumeric =
                        cell?.datatype?.includes('integer') ||
                        cell?.datatype?.includes('decimal') ||
                        cell?.datatype?.includes('int') ||
                        cell?.datatype?.includes('double');

                      const facet = detectOffFacetFromBinding(col, cell, executedQuery);

                      return (
                        <td
                          key={col}
                          className={`px-4 py-2.5 align-middle text-[13px] ${
                            isNumeric ? 'font-mono tabular-nums text-slate-800' : 'text-slate-800'
                          }`}
                        >
                          {!cell ? (
                            <span className="text-slate-300">—</span>
                          ) : cell.type === 'uri' ? (
                            <a
                              href={cell.value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 hover:text-emerald-800 hover:underline whitespace-nowrap"
                            >
                              {formatted}
                              <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                            </a>
                          ) : facet ? (
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono text-xs text-slate-700">
                                {formatted}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onInspectOffFacet(facet, cell.value, displayNameCell?.value)
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <PackageSearch className="w-3 h-3" aria-hidden="true" />
                                Produits OFF
                              </button>
                            </div>
                          ) : (
                            <span className="break-words">{formatted}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
