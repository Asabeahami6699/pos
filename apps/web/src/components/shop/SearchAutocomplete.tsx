import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Package, Search, Store, X, Clock } from 'lucide-react';
import { shopApi } from '../../lib/shopApi';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';
import { shopRoutes } from '../../lib/roleRedirect';

const RECENT_KEY = 'mk-search-recent';
const MAX_RECENT = 6;

type Suggestion = {
  type: string;
  id: string;
  label: string;
  company_id?: string;
  company_name?: string;
};

interface SearchAutocompleteProps {
  className?: string;
  onActiveChange?: (active: boolean) => void;
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

function pushRecent(term: string) {
  const q = term.trim();
  if (q.length < 2) return;
  const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  className = '',
  onActiveChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const listId = useId();
  const searchQuery = useEcommerceCatalogStore((s) => s.searchQuery);
  const setSearchQuery = useEcommerceCatalogStore((s) => s.setSearchQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>(() => readRecent());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = searchQuery.trim();
  const showPanel = open;
  const productSuggestions = suggestions.filter((s) => s.type === 'product');
  const storeSuggestions = suggestions.filter((s) => s.type === 'store');
  const flatItems: Array<{ kind: 'suggestion' | 'recent'; value: Suggestion | string }> = [];
  if (q.length >= 2) {
    for (const s of suggestions) flatItems.push({ kind: 'suggestion', value: s });
  } else {
    for (const r of recent) flatItems.push({ kind: 'recent', value: r });
  }

  useEffect(() => {
    onActiveChange?.(open);
  }, [open, onActiveChange]);

  useEffect(() => {
    if (!open || q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      shopApi
        .searchSuggest(q)
        .then((res) => setSuggestions(res.data ?? []))
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [q, open]);

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const runSearch = (term: string) => {
    const next = term.trim();
    setSearchQuery(next);
    pushRecent(next);
    setRecent(readRecent());
    setOpen(false);
    if (location.pathname !== shopRoutes.home) {
      navigate(shopRoutes.home);
    }
  };

  const pickSuggestion = (s: Suggestion) => {
    pushRecent(s.label);
    setRecent(readRecent());
    setOpen(false);
    if (s.type === 'store') navigate(`/store/${s.id}`);
    else if (s.company_id) navigate(`/product/${s.company_id}/${s.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && flatItems[activeIndex]) {
        const item = flatItems[activeIndex];
        if (item.kind === 'recent') runSearch(item.value as string);
        else pickSuggestion(item.value as Suggestion);
        return;
      }
      runSearch(searchQuery);
    }
  };

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-[1]" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Search products or stores…"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="input-modern pl-9 pr-9 py-2 text-sm w-full h-9"
      />
      {searchQuery && (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:bg-secondary z-[1]"
          onClick={() => {
            setSearchQuery('');
            setSuggestions([]);
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="jm-search-suggestions absolute z-[60] left-0 right-0 top-[calc(100%+0.4rem)] glass-card border border-border rounded-xl shadow-xl overflow-hidden"
        >
          {q.length < 2 && recent.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent
              </p>
              <ul>
                {recent.map((term, idx) => (
                  <li key={term}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={activeIndex === idx}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 rounded-lg ${
                        activeIndex === idx ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'
                      }`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => runSearch(term)}
                    >
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{term}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {q.length < 2 && recent.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Type at least 2 characters to see suggestions
            </p>
          )}

          {q.length >= 2 && loading && (
            <p className="px-4 py-5 text-sm text-muted-foreground text-center animate-pulse">
              Searching…
            </p>
          )}

          {q.length >= 2 && !loading && suggestions.length === 0 && (
            <div className="px-4 py-5 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No matches for “{q}”</p>
              <button
                type="button"
                className="text-sm font-semibold text-primary hover:underline"
                onClick={() => runSearch(q)}
              >
                Search all products
              </button>
            </div>
          )}

          {q.length >= 2 && !loading && suggestions.length > 0 && (
            <div className="max-h-[min(60vh,22rem)] overflow-y-auto p-2">
              {storeSuggestions.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Stores
                  </p>
                  <ul>
                    {storeSuggestions.map((s) => {
                      const idx = flatItems.findIndex(
                        (item) =>
                          item.kind === 'suggestion' &&
                          (item.value as Suggestion).id === s.id &&
                          (item.value as Suggestion).type === s.type,
                      );
                      return (
                        <li key={`store-${s.id}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={activeIndex === idx}
                            className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-lg ${
                              activeIndex === idx
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-secondary'
                            }`}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => pickSuggestion(s)}
                          >
                            <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Store className="w-4 h-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium truncate">{s.label}</span>
                              <span className="block text-[11px] text-muted-foreground">Store</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {productSuggestions.length > 0 && (
                <div>
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Products
                  </p>
                  <ul>
                    {productSuggestions.map((s) => {
                      const idx = flatItems.findIndex(
                        (item) =>
                          item.kind === 'suggestion' &&
                          (item.value as Suggestion).id === s.id &&
                          (item.value as Suggestion).type === s.type,
                      );
                      return (
                        <li key={`product-${s.id}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={activeIndex === idx}
                            className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 rounded-lg ${
                              activeIndex === idx
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-secondary'
                            }`}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => pickSuggestion(s)}
                          >
                            <span className="w-9 h-9 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium truncate">{s.label}</span>
                              <span className="block text-[11px] text-muted-foreground truncate">
                                {s.company_name ? `Product · ${s.company_name}` : 'Product'}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className="w-full mt-1 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 rounded-lg text-left"
                onClick={() => runSearch(q)}
              >
                Search all for “{q}”
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
