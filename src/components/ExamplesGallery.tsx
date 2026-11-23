import React from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { CURATED_EXAMPLES, type CuratedExample } from '../lib/sparql';

interface ExamplesGalleryProps {
  onSelectExample: (example: CuratedExample) => void;
  onBackToQuery: () => void;
}

const FACET_NAMES_FR: Record<CuratedExample['facetHint'], string> = {
  categories: 'Catégories (P1821)',
  ingredients: 'Ingrédients (P5930)',
  additives: 'Additifs (P1820)',
  labels: 'Labels (P7927)',
  brands: 'Marques (P14229)',
  mixed: 'Mixte',
};

export const ExamplesGallery: React.FC<ExamplesGalleryProps> = ({
  onSelectExample,
  onBackToQuery,
}) => {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Exemples de requêtes Open Food Facts
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Requêtes prêtes à l’emploi illustrant la traduction entre questions en français et SPARQL QLever.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToQuery}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Retour au requêteur
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CURATED_EXAMPLES.map((ex) => (
          <article
            key={ex.id}
            className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="text-xs font-mono text-emerald-800">
                {FACET_NAMES_FR[ex.facetHint]}
              </div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                {ex.title}
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed">
                « {ex.question} »
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">{ex.explanation}</p>
            </div>

            <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-36 leading-relaxed">
              {ex.sparql}
            </pre>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onSelectExample(ex)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                Charger et exécuter
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
