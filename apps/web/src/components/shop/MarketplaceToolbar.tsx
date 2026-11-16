import React from 'react';
import { useMarketplaceUiStore, type SortOption, type StockFilter } from '../../stores/marketplaceUiStore';

export const MarketplaceToolbar: React.FC = () => {
  const sortBy = useMarketplaceUiStore((s) => s.sortBy);
  const stockFilter = useMarketplaceUiStore((s) => s.stockFilter);
  const minPrice = useMarketplaceUiStore((s) => s.minPrice);
  const maxPrice = useMarketplaceUiStore((s) => s.maxPrice);
  const setSortBy = useMarketplaceUiStore((s) => s.setSortBy);
  const setStockFilter = useMarketplaceUiStore((s) => s.setStockFilter);
  const setPriceRange = useMarketplaceUiStore((s) => s.setPriceRange);
  const resetFilters = useMarketplaceUiStore((s) => s.resetFilters);

  const hasPriceFilter = minPrice != null || maxPrice != null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <select
        className="input-modern py-0.5 px-1.5 h-7 text-[10px] min-w-0 max-w-[7rem]"
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortOption)}
        aria-label="Sort products"
      >
        <option value="relevance">Relevance</option>
        <option value="price_asc">Price ↑</option>
        <option value="price_desc">Price ↓</option>
        <option value="rating">Top rated</option>
        <option value="newest">Newest</option>
      </select>
      <select
        className="input-modern py-0.5 px-1.5 h-7 text-[10px] min-w-0 max-w-[5.5rem]"
        value={stockFilter}
        onChange={(e) => setStockFilter(e.target.value as StockFilter)}
        aria-label="Stock filter"
      >
        <option value="all">All</option>
        <option value="in_stock">In stock</option>
      </select>
      <div className="inline-flex items-center gap-0.5 h-7 rounded-md border border-border bg-background px-1">
        <span className="text-muted-foreground px-0.5">₵</span>
        <input
          type="number"
          placeholder="min"
          className="w-10 bg-transparent text-[10px] outline-none placeholder:text-muted-foreground/60"
          value={minPrice ?? ''}
          onChange={(e) =>
            setPriceRange(e.target.value ? Number(e.target.value) : null, maxPrice)
          }
          aria-label="Minimum price"
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="number"
          placeholder="max"
          className="w-10 bg-transparent text-[10px] outline-none placeholder:text-muted-foreground/60"
          value={maxPrice ?? ''}
          onChange={(e) =>
            setPriceRange(minPrice, e.target.value ? Number(e.target.value) : null)
          }
          aria-label="Maximum price"
        />
      </div>
      {(hasPriceFilter || sortBy !== 'relevance' || stockFilter !== 'all') && (
        <button
          type="button"
          onClick={resetFilters}
          className="h-7 px-1.5 text-[10px] text-primary hover:underline"
        >
          Reset
        </button>
      )}
    </div>
  );
};
