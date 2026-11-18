import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Search, Tags } from 'lucide-react';
import {
  PRODUCT_CATEGORY_GROUPS,
  buildCategoryPath,
  findCategoryGroupByName,
  flattenProductCategories,
  splitCategoryValue,
} from '../../lib/productCategories';

interface ProductCategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  helpText?: string;
}

export const ProductCategoryPicker: React.FC<ProductCategoryPickerProps> = ({
  value,
  onChange,
  label = 'Category',
  required = false,
  helpText = 'Pick a department, then a subcategory for marketplace browse.',
}) => {
  const parsed = splitCategoryValue(value);
  const [main, setMain] = useState(parsed.main || PRODUCT_CATEGORY_GROUPS[0].name);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const next = splitCategoryValue(value);
    if (next.main) setMain(next.main);
  }, [value]);

  const activeGroup = useMemo(
    () => findCategoryGroupByName(main) ?? PRODUCT_CATEGORY_GROUPS[0],
    [main],
  );

  const filteredFlat = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flattenProductCategories().filter(
      (row) =>
        row.main.toLowerCase().includes(q) ||
        row.sub.toLowerCase().includes(q) ||
        row.path.toLowerCase().includes(q),
    );
  }, [query]);

  const selectMain = (name: string) => {
    setMain(name);
    setQuery('');
    // Keep previous sub only if it exists under the new main
    const group = findCategoryGroupByName(name);
    if (group && parsed.sub && group.subs.includes(parsed.sub)) {
      onChange(buildCategoryPath(name, parsed.sub));
    } else {
      onChange('');
    }
  };

  const selectSub = (sub: string) => {
    const groupName = activeGroup?.name || main;
    if (!groupName) return;
    onChange(buildCategoryPath(groupName, sub));
    setQuery('');
  };

  const selectFlat = (path: string) => {
    onChange(path);
    const next = splitCategoryValue(path);
    setMain(next.main);
    setQuery('');
  };

  const selectedPath = value.trim();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <label className="block text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </label>
          {helpText && <p className="text-[11px] text-muted-foreground mt-0.5">{helpText}</p>}
        </div>
        {selectedPath && (
          <span className="inline-flex items-center gap-1 max-w-[55%] text-[11px] font-semibold rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-1">
            <Tags className="w-3 h-3 shrink-0" />
            <span className="truncate">{selectedPath.replace('/', ' · ')}</span>
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Quick search all categories…"
          className="input-modern !pl-9 py-2.5 text-sm"
        />
      </div>

      {query.trim() ? (
        <div className="rounded-xl border border-border bg-card max-h-56 overflow-y-auto">
          {filteredFlat.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No categories match.</p>
          ) : (
            <ul className="p-1.5 space-y-0.5">
              {filteredFlat.slice(0, 40).map((row) => {
                const active = selectedPath === row.path;
                return (
                  <li key={row.path}>
                    <button
                      type="button"
                      onClick={() => selectFlat(row.path)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                        active
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-secondary text-foreground'
                      }`}
                    >
                      <span className="text-base leading-none">{row.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{row.sub}</span>
                        <span className="block text-[10px] text-muted-foreground truncate">
                          {row.main}
                        </span>
                      </span>
                      {active && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
            {/* Departments */}
            <div className="border-b sm:border-b-0 sm:border-r border-border bg-secondary/30">
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Department
              </p>
              <div className="max-h-52 sm:max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                {PRODUCT_CATEGORY_GROUPS.map((group) => {
                  const active = (main || activeGroup.name) === group.name;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => selectMain(group.name)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2 transition-colors ${
                        active
                          ? `${group.accent} border font-semibold`
                          : 'hover:bg-background text-foreground border border-transparent'
                      }`}
                    >
                      <span className="text-base leading-none">{group.emoji}</span>
                      <span className="min-w-0 flex-1 truncate">{group.name}</span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 ${
                          active ? 'opacity-80' : 'opacity-30'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategories */}
            <div>
              <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-border/70">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {activeGroup.emoji} {activeGroup.name}
                </p>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {activeGroup.subs.length} options
                </span>
              </div>
              <div className="max-h-52 sm:max-h-64 overflow-y-auto p-2">
                <div className="flex flex-wrap gap-1.5">
                  {activeGroup.subs.map((sub) => {
                    const path = buildCategoryPath(activeGroup.name, sub);
                    const active = selectedPath === path;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => selectSub(sub)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] sm:text-xs transition-all ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-background text-foreground border-border hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedPath && (
        <p className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          Select a subcategory so this product shows under the right marketplace aisle.
        </p>
      )}
    </div>
  );
};
