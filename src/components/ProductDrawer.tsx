import React, { useEffect, useState } from 'react';
import { ExternalLink, Package, X } from 'lucide-react';
import type { OffFacetType, OffProduct } from '../lib/sparql';

interface ProductDrawerProps {
  selection: {
    facet: OffFacetType;
    tag: string;
    displayName?: string;
  } | null;
  onClose: () => void;
}

const FACET_LABELS_FR: Record<OffFacetType, string> = {
  categories: 'Catégorie',
  ingredients: 'Ingrédient',
  additives: 'Additif',
  labels: 'Label',
  brands: 'Marque',
};

const ProductThumb: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400 overflow-hidden">
      <Package className="w-5 h-5" aria-hidden="true" />
      {src && !failed && (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};

export const ProductDrawer: React.FC<ProductDrawerProps> = ({ selection, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<OffProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facetUrl, setFacetUrl] = useState<string>('');

  useEffect(() => {
    if (!selection) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          facet: selection.facet,
          tag: selection.tag,
        });
        const resp = await fetch(`/api/off/products?${params.toString()}`);
        const json = await resp.json();
        if (cancelled) return;
        if (!resp.ok) {
          setError(json.error || 'Erreur lors du chargement des produits Open Food Facts.');
          setProducts([]);
        } else {
          setProducts(json.products ?? []);
          setTotalCount(json.count ?? 0);
          setFacetUrl(json.facetUrl ?? '');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur réseau Open Food Facts.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selection]);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, onClose]);

  if (!selection) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-900/35"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        aria-label="Produits Open Food Facts associés"
        className="relative z-10 w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-mono text-emerald-800 font-medium">
              {FACET_LABELS_FR[selection.facet]} · {selection.tag}
            </div>
            <h2 className="mt-0.5 font-display text-lg font-bold text-slate-900 truncate">
              {selection.displayName || selection.tag}
            </h2>
            {!loading && !error && (
              <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                {totalCount.toLocaleString('fr-FR')} produits recensés sur Open Food Facts
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau produits"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 py-2">
                  <div className="w-14 h-14 rounded-lg bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3.5 w-3/4 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800">
              {error}
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Aucun produit trouvé dans l’API Open Food Facts pour le tag « {selection.tag} ».
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {products.map((product) => {
                const nutri =
                  product.nutriscore_grade &&
                  product.nutriscore_grade !== 'not-applicable' &&
                  product.nutriscore_grade !== 'unknown'
                    ? `Nutri-Score ${product.nutriscore_grade.toUpperCase()}`
                    : null;
                const nova = product.nova_group ? `NOVA ${product.nova_group}` : null;
                const metaParts = [product.brands, product.quantity, nutri, nova].filter(
                  Boolean
                );

                return (
                  <li key={product.code} className="py-3.5 flex items-start gap-3.5">
                    <ProductThumb
                      src={product.image_front_small_url}
                      alt={product.product_name}
                    />
                    <div className="min-w-0 flex-1">
                      <a
                        href={`https://world.openfoodfacts.org/product/${encodeURIComponent(product.code)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-full text-sm font-medium text-slate-900 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                      >
                        <span className="truncate">{product.product_name}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                      </a>
                      {metaParts.length > 0 && (
                        <div className="mt-1 text-xs text-slate-500 leading-relaxed">
                          {metaParts.join(' · ')}
                        </div>
                      )}
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400 tabular-nums">
                        EAN {product.code}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {facetUrl && (
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">Source : world.openfoodfacts.org</span>
            <a
              href={facetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:underline"
            >
              Ouvrir sur Open Food Facts
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        )}
      </aside>
    </div>
  );
};
