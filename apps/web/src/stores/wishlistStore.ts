import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WishlistItem {
  productId: string;
  companyId: string;
}

interface WishlistStore {
  items: WishlistItem[];
  serverSynced: boolean;
  toggle: (productId: string, companyId: string) => void;
  has: (productId: string) => boolean;
  setItems: (items: WishlistItem[]) => void;
  setServerSynced: (v: boolean) => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      serverSynced: false,
      toggle: (productId, companyId) => {
        const exists = get().items.some((i) => i.productId === productId);
        set({
          items: exists
            ? get().items.filter((i) => i.productId !== productId)
            : [...get().items, { productId, companyId }],
        });
      },
      has: (productId) => get().items.some((i) => i.productId === productId),
      setItems: (items) => set({ items }),
      setServerSynced: (serverSynced) => set({ serverSynced }),
    }),
    { name: 'pos-wishlist' },
  ),
);
