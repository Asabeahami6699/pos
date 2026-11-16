import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProductMediaItem {
  id?: string;
  url: string;
  media_type: 'image' | 'video';
  sort_order?: number;
}

export interface ShopCompany {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  product_count?: number;
}

export interface ShopProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  wholesale_price: number | null;
  category: string | null;
  company_id: string | null;
  stock: number;
  in_stock: boolean;
  company_name?: string;
  description?: string | null;
  is_online_listing?: boolean;
  marketplace_listing?: import('../types/marketplaceListing').MarketplaceListing | null;
  average_rating?: number;
  rating_count?: number;
  image_url?: string | null;
  media?: ProductMediaItem[];
  promoted?: boolean;
}

function randomSessionId(): string {
  return `sess_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

interface EcommerceCatalogStore {
  sessionId: string;
  companies: ShopCompany[];
  companiesLoading: boolean;
  companiesError: string | null;
  marketplaceProducts: ShopProduct[];
  marketplaceLoading: boolean;
  marketplaceError: string | null;
  marketplaceInitialized: boolean;
  categories: string[];
  selectedCategory: string | null;
  sidebarCategory: string | null;
  marketplaceLastUpdated: number | null;
  promotions: ShopProduct[];
  promotionsLoading: boolean;
  promotionsInitialized: boolean;
  companiesInitialized: boolean;
  productDetails: Record<string, ShopProduct>;
  storeProducts: Record<string, ShopProduct[]>;
  storeCompany: Record<string, ShopCompany | null>;
  storeLoading: Record<string, boolean>;
  lastUpdated: Record<string, number>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSidebarCategory: (category: string | null) => void;
  setCategories: (categories: string[]) => void;
  setCompanies: (companies: ShopCompany[]) => void;
  setCompaniesLoading: (loading: boolean) => void;
  setCompaniesError: (error: string | null) => void;
  setMarketplaceProducts: (products: ShopProduct[]) => void;
  setMarketplaceLoading: (loading: boolean) => void;
  setMarketplaceError: (error: string | null) => void;
  setMarketplaceInitialized: (value: boolean) => void;
  setPromotions: (products: ShopProduct[]) => void;
  setPromotionsLoading: (loading: boolean) => void;
  setPromotionsInitialized: (value: boolean) => void;
  setCompaniesInitialized: (value: boolean) => void;
  setProductDetail: (companyId: string, productId: string, product: ShopProduct) => void;
  getCachedProduct: (companyId: string, productId: string) => ShopProduct | undefined;
  touchMarketplace: () => void;
  setStoreCatalog: (companyId: string, company: ShopCompany, products: ShopProduct[]) => void;
  setStoreLoading: (companyId: string, loading: boolean) => void;
  touchStore: (companyId: string) => void;
  updateProductStock: (companyId: string, productId: string, stock: number) => void;
}

export const useEcommerceCatalogStore = create<EcommerceCatalogStore>()(
  persist(
    (set, get) => ({
      sessionId: randomSessionId(),
      companies: [],
      companiesLoading: false,
      companiesError: null,
      marketplaceProducts: [],
      marketplaceLoading: false,
      marketplaceError: null,
      marketplaceInitialized: false,
      categories: [],
      selectedCategory: null,
      sidebarCategory: null,
      marketplaceLastUpdated: null,
      promotions: [],
      promotionsLoading: false,
      promotionsInitialized: false,
      companiesInitialized: false,
      productDetails: {},
      storeProducts: {},
      storeCompany: {},
      storeLoading: {},
      lastUpdated: {},
      searchQuery: '',

      setSearchQuery: (q) => set({ searchQuery: q }),
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      setSidebarCategory: (category) => set({ sidebarCategory: category }),
      setCategories: (categories) => set({ categories }),
      setCompanies: (companies) => set({ companies }),
      setCompaniesLoading: (loading) => set({ companiesLoading: loading }),
      setCompaniesError: (error) => set({ companiesError: error }),
      setMarketplaceProducts: (products) =>
        set({ marketplaceProducts: products, marketplaceLastUpdated: Date.now() }),
      setMarketplaceLoading: (loading) => set({ marketplaceLoading: loading }),
      setMarketplaceError: (error) => set({ marketplaceError: error }),
      setMarketplaceInitialized: (value) => set({ marketplaceInitialized: value }),
      setPromotions: (products) => set({ promotions: products }),
      setPromotionsLoading: (loading) => set({ promotionsLoading: loading }),
      setPromotionsInitialized: (value) => set({ promotionsInitialized: value }),
      setCompaniesInitialized: (value) => set({ companiesInitialized: value }),

      setProductDetail: (companyId, productId, product) =>
        set((state) => ({
          productDetails: {
            ...state.productDetails,
            [`${companyId}:${productId}`]: product,
          },
        })),

      getCachedProduct: (companyId, productId) => {
        const state = get();
        const key = `${companyId}:${productId}`;
        if (state.productDetails[key]) return state.productDetails[key];
        return (
          state.marketplaceProducts.find(
            (p) => p.id === productId && p.company_id === companyId,
          ) ??
          state.storeProducts[companyId]?.find((p) => p.id === productId)
        );
      },

      touchMarketplace: () => set({ marketplaceLastUpdated: Date.now() }),

      setStoreCatalog: (companyId, company, products) =>
        set((state) => ({
          storeProducts: { ...state.storeProducts, [companyId]: products },
          storeCompany: { ...state.storeCompany, [companyId]: company },
          lastUpdated: { ...state.lastUpdated, [companyId]: Date.now() },
        })),

      setStoreLoading: (companyId, loading) =>
        set((state) => ({
          storeLoading: { ...state.storeLoading, [companyId]: loading },
        })),

      touchStore: (companyId) =>
        set((state) => ({
          lastUpdated: { ...state.lastUpdated, [companyId]: Date.now() },
        })),

      updateProductStock: (companyId, productId, stock) =>
        set((state) => {
          const products = state.storeProducts[companyId];
          const marketplaceProducts = state.marketplaceProducts.map((p) =>
            p.id === productId && p.company_id === companyId
              ? { ...p, stock, in_stock: stock > 0 }
              : p,
          );
          if (!products) {
            return { marketplaceProducts, marketplaceLastUpdated: Date.now() };
          }
          return {
            marketplaceProducts,
            marketplaceLastUpdated: Date.now(),
            storeProducts: {
              ...state.storeProducts,
              [companyId]: products.map((p) =>
                p.id === productId ? { ...p, stock, in_stock: stock > 0 } : p,
              ),
            },
            lastUpdated: { ...state.lastUpdated, [companyId]: Date.now() },
          };
        }),
    }),
    {
      name: 'pos-marketplace-store',
      partialize: (state) => ({ sessionId: state.sessionId }),
    },
  ),
);

export function getMarketplaceSessionId(): string {
  const id = useEcommerceCatalogStore.getState().sessionId;
  if (id) return id;
  const next = randomSessionId();
  useEcommerceCatalogStore.setState({ sessionId: next });
  return next;
}
