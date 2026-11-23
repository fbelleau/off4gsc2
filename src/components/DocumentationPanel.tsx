import React from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { DEFAULT_QLEVER_ENDPOINT, OFF_PREDICATES } from '../lib/sparql';

interface DocumentationPanelProps {
  onBackToQuery: () => void;
  onInsertExampleQuery: (sparql: string, question: string) => void;
}

export const DocumentationPanel: React.FC<DocumentationPanelProps> = ({
  onBackToQuery,
  onInsertExampleQuery,
}) => {
  const ftsSample = `PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ql: <http://qlever.cs.uni-freiburg.de/builtin/>

SELECT DISTINCT ?item ?nom ?offIngredient WHERE {
  ?text ql:contains-entity ?item ;
        ql:contains-word "cacao" .
  ?item wdt:P5930 ?offIngredient ;
        rdfs:label ?nom .
  FILTER(LANG(?nom) = "fr")
}
LIMIT 20`;

  return (
    <section className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Architecture Open Food Facts · QLever
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Comment fonctionne la traduction du langage naturel vers SPARQL et l’exécution haute performance sur QLever.
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="text-xs font-mono text-emerald-800 font-semibold">01. Langage naturel</div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Traduction sémantique
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Votre question en français est analysée côté serveur pour identifier les entités alimentaires, les filtres taxonomiques et les propriétés Open Food Facts correspondantes.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="text-xs font-mono text-emerald-800 font-semibold">02. Moteur QLever</div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Exécution SPARQL 1.1
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            La requête est exécutée en quelques dizaines de millisecondes sur l’index QLever ({DEFAULT_QLEVER_ENDPOINT}), avec support des chemins de propriétés (<code className="font-mono text-xs">wdt:P279+</code>) et du plein texte.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="text-xs font-mono text-emerald-800 font-semibold">03. Produits réels</div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Pont Open Food Facts v2
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Chaque identifiant retourné (catégorie, ingrédient, additif, label ou marque) ouvre directement les fiches produits réelles issues de l’API Open Food Facts.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Référence des prédicats Open Food Facts dans Wikidata
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Prédicat</th>
                <th className="py-2.5 pr-4">Rôle sémantique</th>
                <th className="py-2.5 pr-4 text-right">Entités</th>
                <th className="py-2.5">Motif SPARQL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {OFF_PREDICATES.map((pred) => (
                <tr key={pred.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-4 font-mono text-xs font-semibold text-emerald-800 whitespace-nowrap">
                    {pred.id}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-700">{pred.labelFr}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-slate-500 text-right tabular-nums whitespace-nowrap">
                    {pred.entityCount ?? '—'}
                  </td>
                  <td className="py-2.5 font-mono text-xs text-slate-600">
                    {pred.snippet.replace('\n', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Recherche plein texte native QLever (<code className="font-mono text-sm">ql:contains-word</code>)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Contrairement à SPARQL standard, QLever indexe les mots-clés pour éviter les scans complets lents.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onInsertExampleQuery(
                ftsSample,
                'Quels ingrédients Open Food Facts mentionnent le mot cacao ?'
              )
            }
            className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Tester cette requête
          </button>
        </div>

        <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
          {ftsSample}
        </pre>

        <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-slate-500">
          <a
            href="https://qlever.dev/wikidata"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-800 hover:underline font-medium"
          >
            Interface QLever Wikidata
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://world.openfoodfacts.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-800 hover:underline font-medium"
          >
            Open Food Facts
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
};
