import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { shopApi } from '../../lib/shopApi';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';

interface SearchAutocompleteProps {
  className?: string;
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const searchQuery = useEcommerceCatalogStore((s) => s.searchQuery);
  const setSearchQuery = useEcommerceCatalogStore((s) => s.setSearchQuery);
  const [suggestions, setSuggestions] = useState<
    Array<{ type: string; id: string; label: string; company_id?: string }>
  >([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      shopApi
        .searchSuggest(searchQuery.trim())
        .then((res) => setSuggestions(res.data ?? []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (s: { type: string; id: string; company_id?: string }) => {
    setOpen(false);
    if (s.type === 'store') navigate(`/store/${s.id}`);
    else if (s.company_id) navigate(`/product/${s.company_id}/${s.id}`);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        placeholder="Search products or stores…"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="input-modern pl-9 py-2 text-sm w-full h-9"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full glass-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={`${s.type}-${s.id}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary"
                onClick={() => pick(s)}
              >
                <span className="text-[10px] uppercase text-muted-foreground">{s.type}</span>
                <span className="block truncate">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
