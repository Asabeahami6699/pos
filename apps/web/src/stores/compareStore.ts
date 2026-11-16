import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShopProduct } from './ecommerceCatalogStore';

const MAX_COMPARE = 4;

interface CompareStore {
  items: Array<ShopProduct & { companyId: string; companyName: string }>;
  add: (product: ShopProduct, companyId: string, companyName: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      items: [],
      add: (product, companyId, companyName) => {
        if (get().items.some((i) => i.id === product.id)) return true;
        if (get().items.length >= MAX_COMPARE) return false;
        set({
          items: [...get().items, { ...product, companyId, companyName }],
        });
        return true;
      },
      remove: (productId) =>
        set({ items: get().items.filter((i) => i.id !== productId) }),
      clear: () => set({ items: [] }),
      has: (productId) => get().items.some((i) => i.id === productId),
    }),
    { name: 'pos-compare' },
  ),
);
