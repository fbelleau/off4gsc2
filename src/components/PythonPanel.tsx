import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, Terminal } from 'lucide-react';
import { DEFAULT_QLEVER_ENDPOINT } from '../lib/sparql';

interface PythonFileEntry {
  name: string;
  description: string;
  content: string;
}

interface PythonPanelProps {
  question: string;
  sparql: string;
  endpoint: string;
  onBackToQuery: () => void;
}

function buildDynamicPythonSnippet(question: string, sparql: string, endpoint: string): string {
  const safeQuestion = (
    question.trim() || 'Quels additifs ont un code E et sont référencés dans Open Food Facts ?'
  ).replace(/"/g, '\\"');
  const safeSparql = (
    sparql.trim() ||
    `PREFIX wdt: <http://www.wikidata.org/prop/direct/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n\nSELECT ?item ?nom ?offId WHERE {\n  ?item wdt:P1820 ?offId .\n  OPTIONAL { ?item rdfs:label ?nom . FILTER(LANG(?nom) = "fr") }\n}\nLIMIT 20`
  ).replace(/"""/g, '\\"\\"\\"');
  const targetEndpoint = (endpoint || DEFAULT_QLEVER_ENDPOINT).trim();

  return `"""Exécution en Python : Langage naturel -> SPARQL -> QLever (Open Food Facts)."""
import json
import os
import urllib.parse
import urllib.request
from google import genai
from google.genai import types

QUESTION = "${safeQuestion}"
QLEVER_ENDPOINT = "${targetEndpoint}"

# Option 1 : Traduire la question en langage naturel avec Gemini
def traduire_en_sparql(question: str) -> str:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    resp = client.models.generate_content(
        model="gemini-4-hydrogen",
        contents=f"Traduis en SPARQL QLever (Open Food Facts / Wikidata) : {question}",
        config=types.GenerateContentConfig(
            system_instruction=(
                "Utilise les propriétés Wikidata Open Food Facts : "
                "wdt:P1821 (catégorie), wdt:P5930 (ingrédient), wdt:P1820 (additif), "
                "wdt:P7927 (label), wdt:P14229 (marque). Pas de SERVICE wikibase:label."
            ),
            response_mime_type="application/json",
            response_schema={
                "type": "OBJECT",
                "properties": {"sparql": {"type": "STRING"}},
                "required": ["sparql"],
            },
        ),
    )
    return json.loads(resp.text)["sparql"]

# Option 2 : Exécuter directement la requête SPARQL actuelle sur QLever
SPARQL = """${safeSparql}"""

def executer_qlever(sparql: str, endpoint: str = QLEVER_ENDPOINT) -> dict:
    data = urllib.parse.urlencode({"query": sparql}).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/sparql-results+json",
            "User-Agent": "OpenFoodFacts-QLever-Python/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))

if __name__ == "__main__":
    # Décommentez la ligne suivante pour traduire dynamiquement via GEMINI_API_KEY :
    # requete = traduire_en_sparql(QUESTION)
    requete = SPARQL
    resultat = executer_qlever(requete)
    temps_ms = resultat.get("meta", {}).get("query-time-ms")
    lignes = resultat.get("results", {}).get("bindings", [])
    print(f"{len(lignes)} lignes retournées par QLever ({temps_ms} ms)")
    for row in lignes[:10]:
        print({k: v.get("value") for k, v in row.items()})
`;
}

export const PythonPanel: React.FC<PythonPanelProps> = ({
  question,
  sparql,
  endpoint,
  onBackToQuery,
}) => {
  const [files, setFiles] = useState<PythonFileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('off_qlever.py');
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const dynamicSnippet = useMemo(
    () => buildDynamicPythonSnippet(question, sparql, endpoint),
    [question, sparql, endpoint]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingFiles(true);
      setFilesError(null);
      try {
        const resp = await fetch('/api/python-files');
        const json = await resp.json();
        if (cancelled) return;
        if (!resp.ok) {
          setFilesError(json.error || 'Impossible de charger les sources Python.');
        } else {
          setFiles(json.files ?? []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setFilesError(err instanceof Error ? err.message : 'Erreur réseau.');
        }
      } finally {
        if (!cancelled) {
          setLoadingFiles(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard failures
    }
  };

  const handleDownload = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const activeFile = files.find((f) => f.name === selectedFile) ?? files[0];

  return (
    <section className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Implémentation Python (CLI, Serveur & FastAPI)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Équivalent complet en Python 3.11 avec traduction Gemini, exécution SPARQL QLever et passerelle Open Food Facts.
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

      {/* Quick Start Commands */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
            CLI en langage naturel
          </div>
          <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
            python3 -m python_app.cli &quot;Quels fromages français ?&quot;
          </pre>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
            Serveur Python autonome
          </div>
          <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
            python3 -m python_app.server --port 3000
          </pre>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
            FastAPI + Tests unitaires
          </div>
          <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
            python3 -m unittest discover -s python_app -v
          </pre>
        </div>
      </div>

      {/* Dynamic Script for Current Query */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-slate-100">
              Script Python généré pour votre requête actuelle
            </h2>
            <p className="text-[11px] text-slate-400">
              Prêt à exécuter avec votre variable d’environnement GEMINI_API_KEY
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy('dynamic', dynamicSnippet)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedKey === 'dynamic' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  Copier le script
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleDownload('requete_off_qlever.py', dynamicSnippet)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Télécharger .py
            </button>
          </div>
        </div>
        <pre className="p-4 font-mono text-xs text-slate-100 overflow-x-auto max-h-[360px] leading-relaxed">
          {dynamicSnippet}
        </pre>
      </div>

      {/* Full python_app/ Source Browser */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Modules du paquet <code className="font-mono text-xs">python_app/</code>
            </h2>
            {activeFile && (
              <p className="text-xs text-slate-500 mt-0.5">{activeFile.description}</p>
            )}
          </div>

          {activeFile && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(activeFile.name, activeFile.content)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {copiedKey === activeFile.name ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
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
                onClick={() => handleDownload(activeFile.name, activeFile.content)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Télécharger
              </button>
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          {files.map((file) => {
            const active = activeFile?.name === file.name;
            return (
              <button
                key={file.name}
                type="button"
                onClick={() => setSelectedFile(file.name)}
                className={`px-3 py-1.5 font-mono text-xs rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-emerald-900 font-semibold border border-slate-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {file.name}
              </button>
            );
          })}
        </div>

        {loadingFiles ? (
          <div className="p-6 text-xs text-slate-500">Chargement des fichiers Python...</div>
        ) : filesError ? (
          <div className="p-6 text-xs text-rose-700">{filesError}</div>
        ) : activeFile ? (
          <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-[460px] leading-relaxed">
            {activeFile.content}
          </pre>
        ) : null}
      </div>
    </section>
  );
};
