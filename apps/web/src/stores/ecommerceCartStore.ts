import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShopPriceType } from '../lib/shopProductPricing';

export interface ShopCartItem {
  companyId: string;
  companyName: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  priceType: ShopPriceType;
  quantity: number;
  maxStock: number;
  imageUrl?: string;
  category?: string | null;
}

interface EcommerceCartStore {
  items: ShopCartItem[];
  addItem: (item: Omit<ShopCartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string, companyId: string, priceType?: ShopPriceType) => void;
  updateQuantity: (
    productId: string,
    companyId: string,
    quantity: number,
    priceType?: ShopPriceType,
  ) => void;
  clearCompany: (companyId: string) => void;
  clearAll: () => void;
}

/** Stable selectors — use with useMemo, not inside useStore selectors */
export function selectCartTotalItems(items: ShopCartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function selectCartTotalAmount(items: ShopCartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function groupCartItemsByCompany(items: ShopCartItem[]): Record<string, ShopCartItem[]> {
  const groups: Record<string, ShopCartItem[]> = {};
  items.forEach((item) => {
    if (!groups[item.companyId]) groups[item.companyId] = [];
    groups[item.companyId].push(item);
  });
  return groups;
}

export const useEcommerceCartStore = create<EcommerceCartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const qty = item.quantity ?? 1;
        const priceType = item.priceType ?? 'retail';
        set((state) => {
          const existing = state.items.find(
            (i) =>
              i.productId === item.productId &&
              i.companyId === item.companyId &&
              (i.priceType ?? 'retail') === priceType,
          );
          if (existing) {
            const newQty = Math.min(existing.maxStock, existing.quantity + qty);
            return {
              items: state.items.map((i) =>
                i.productId === item.productId &&
                i.companyId === item.companyId &&
                (i.priceType ?? 'retail') === priceType
                  ? { ...i, quantity: newQty }
                  : i,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                ...item,
                priceType,
                quantity: Math.min(item.maxStock, qty),
              },
            ],
          };
        });
      },

      removeItem: (productId, companyId, priceType = 'retail') =>
        set((state) => ({
          items: state.items.filter(
            (i) =>
              !(
                i.productId === productId &&
                i.companyId === companyId &&
                (i.priceType ?? 'retail') === priceType
              ),
          ),
        })),

      updateQuantity: (productId, companyId, quantity, priceType = 'retail') => {
        if (quantity <= 0) {
          get().removeItem(productId, companyId, priceType);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId &&
            i.companyId === companyId &&
            (i.priceType ?? 'retail') === priceType
              ? { ...i, quantity: Math.min(i.maxStock, quantity) }
              : i,
          ),
        }));
      },

      clearCompany: (companyId) =>
        set((state) => ({
          items: state.items.filter((i) => i.companyId !== companyId),
        })),

      clearAll: () => set({ items: [] }),
    }),
    { name: 'pos-ecommerce-cart' },
  ),
);
