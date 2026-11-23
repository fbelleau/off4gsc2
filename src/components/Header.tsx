import React from 'react';

export type ActiveSection = 'query' | 'examples' | 'schema' | 'docs' | 'python';

interface HeaderProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
  onNewQuery: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onNavigate,
  onNewQuery,
}) => {
  const navItems: Array<{ id: ActiveSection; label: string }> = [
    { id: 'query', label: 'Requêteur' },
    { id: 'examples', label: 'Exemples' },
    { id: 'schema', label: 'Schéma RDF' },
    { id: 'docs', label: 'Documentation' },
    { id: 'python', label: 'Python' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('query');
          }}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded"
        >
          Open Food Facts · QLever
        </a>

        <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  isActive
                    ? 'border-emerald-700 text-slate-900'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewQuery}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            Nouvelle requête
          </button>
        </div>
      </div>
    </header>
  );
};
