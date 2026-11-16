import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
export type StockFilter = 'all' | 'in_stock';

interface MarketplaceUiStore {
  sortBy: SortOption;
  stockFilter: StockFilter;
  minPrice: number | null;
  maxPrice: number | null;
  setSortBy: (sort: SortOption) => void;
  setStockFilter: (filter: StockFilter) => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  resetFilters: () => void;
}

export const useMarketplaceUiStore = create<MarketplaceUiStore>()(
  persist(
    (set) => ({
      sortBy: 'relevance',
      stockFilter: 'all',
      minPrice: null,
      maxPrice: null,
      setSortBy: (sortBy) => set({ sortBy }),
      setStockFilter: (stockFilter) => set({ stockFilter }),
      setPriceRange: (minPrice, maxPrice) => set({ minPrice, maxPrice }),
      resetFilters: () => set({ sortBy: 'relevance', stockFilter: 'all', minPrice: null, maxPrice: null }),
    }),
    { name: 'pos-marketplace-ui' },
  ),
);

export function applyProductFilters<T extends {
  price: number;
  in_stock?: boolean;
  stock?: number;
  average_rating?: number;
  created_at?: string;
}>(
  products: T[],
  opts: { sortBy: SortOption; stockFilter: StockFilter; minPrice: number | null; maxPrice: number | null },
): T[] {
  let list = [...products];

  if (opts.stockFilter === 'in_stock') {
    list = list.filter((p) => p.in_stock !== false && (p.stock ?? 0) > 0);
  }
  if (opts.minPrice != null) list = list.filter((p) => p.price >= opts.minPrice!);
  if (opts.maxPrice != null) list = list.filter((p) => p.price <= opts.maxPrice!);

  switch (opts.sortBy) {
    case 'price_asc':
      list.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      list.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      list.sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
      break;
    case 'newest':
      list.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
      break;
    default:
      break;
  }

  return list;
}
