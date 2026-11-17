import { create } from 'zustand';

export interface CustomerOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  sku?: string | null;
  barcode?: string | null;
  image_url?: string | null;
}

export interface CustomerOrder {
  id: string;
  company_id: string;
  total: number;
  status: string;
  fulfillment_type?: string;
  payment_method?: string;
  payment_status?: string;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_address?: string | null;
  tracking_number?: string | null;
  carrier_name?: string | null;
  notes?: string | null;
  created_at: string;
  companies?: { name: string };
  online_order_items?: CustomerOrderItem[];
}

interface EcommerceOrdersStore {
  orders: CustomerOrder[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  setOrders: (orders: CustomerOrder[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateOrderStatus: (orderId: string, status: string) => void;
  touch: () => void;
}

export const useEcommerceOrdersStore = create<EcommerceOrdersStore>((set) => ({
  orders: [],
  loading: false,
  error: null,
  lastFetched: null,

  setOrders: (orders) => set({ orders, lastFetched: Date.now(), error: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
      lastFetched: Date.now(),
    })),

  touch: () => set({ lastFetched: Date.now() }),
}));
