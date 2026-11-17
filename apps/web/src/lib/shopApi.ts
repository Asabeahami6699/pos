import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function shopFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isTracking = path.includes('/tracking');
  const isPublicPush = path.includes('/push/vapid-public-key');
  const needsAuth =
    (path.includes('/orders') &&
      !path.includes('/orders/guest') &&
      !isTracking) ||
    path.includes('/payments') ||
    path.includes('/ratings') ||
    path.includes('/profile') ||
    path.includes('/addresses') ||
    path.includes('/payment-methods') ||
    path.includes('/my-ratings') ||
    path.includes('/chat') ||
    path.includes('/admin/chat') ||
    path.includes('/promotions') ||
    path.includes('/wishlist') ||
    path.includes('/returns') ||
    path.includes('/loyalty') ||
    path.includes('/notifications') ||
    (path.includes('/push') && !isPublicPush);

  // Tracking: optional auth for logged-in customers; guests use ?token=
  const authHeaders = needsAuth || isTracking ? await getAuthHeaders() : {};

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const err = data.error;
    const message =
      typeof err === 'string'
        ? err
        : response.status === 503 && path.includes('/payments/')
          ? 'Paystack is not configured on the server. Add PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY to apps/api/.env, or choose Pay on delivery.'
          : 'Request failed';
    throw new Error(message);
  }
  return data as T;
}

export interface ProductRating {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string;
}

export const shopApi = {
  getCompanies: () =>
    shopFetch<{ success: boolean; data: import('../stores/ecommerceCatalogStore').ShopCompany[] }>(
      '/api/shop/companies',
    ),

  getCategories: () =>
    shopFetch<{ success: boolean; data: string[] }>('/api/shop/categories'),

  getAllProducts: (query?: string) =>
    shopFetch<{ success: boolean; data: import('../stores/ecommerceCatalogStore').ShopProduct[] }>(
      `/api/shop/products${query ? `?q=${encodeURIComponent(query)}` : ''}`,
    ),

  getStoreProducts: (companyId: string) =>
    shopFetch<{
      success: boolean;
      data: {
        company: import('../stores/ecommerceCatalogStore').ShopCompany;
        products: import('../stores/ecommerceCatalogStore').ShopProduct[];
      };
    }>(`/api/shop/companies/${companyId}/products`),

  getProductDetail: (companyId: string, productId: string) =>
    shopFetch<{
      success: boolean;
      data: {
        company: import('../stores/ecommerceCatalogStore').ShopCompany;
        product: import('../stores/ecommerceCatalogStore').ShopProduct;
        ratings: ProductRating[];
      };
    }>(`/api/shop/companies/${companyId}/products/${productId}`),

  submitRating: (
    companyId: string,
    productId: string,
    payload: { rating: number; comment?: string },
  ) =>
    shopFetch<{ success: boolean }>(
      `/api/shop/companies/${companyId}/products/${productId}/ratings`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  register: (payload: { fullName?: string; email: string; password: string; phone?: string }) =>
    shopFetch<{ success: boolean; message?: string }>('/api/shop/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createOrder: (payload: {
    company_id: string;
    shipping_name: string;
    shipping_phone: string;
    shipping_address?: string;
    fulfillment_type: 'delivery' | 'pickup';
    address_id?: string;
    payment_method: 'pay_on_delivery';
    notes?: string;
    promo_code?: string;
    shipping_fee?: number;
    discount_amount?: number;
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
    }>;
  }) =>
    shopFetch<{ success: boolean; data: { id: string } }>('/api/shop/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  initializePayment: (payload: {
    idempotency_key: string;
    company_id: string;
    shipping_name: string;
    shipping_phone: string;
    shipping_address?: string;
    fulfillment_type: 'delivery' | 'pickup';
    address_id?: string;
    notes?: string;
    promo_code?: string;
    shipping_fee?: number;
    discount_amount?: number;
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
    }>;
  }) =>
    shopFetch<{
      success: boolean;
      already_paid?: boolean;
      data: {
        reference?: string;
        access_code?: string;
        amount_kobo?: number;
        public_key?: string;
        email?: string;
        order_id?: string;
      };
    }>('/api/shop/payments/initialize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyPayment: (reference: string) =>
    shopFetch<{
      success: boolean;
      data: { order_id: string; reference: string; already_completed?: boolean };
    }>('/api/shop/payments/verify', {
      method: 'POST',
      body: JSON.stringify({ reference }),
    }),

  trackClick: (payload: {
    product_id: string;
    company_id: string;
    category?: string;
    session_id?: string;
  }) =>
    shopFetch<{ success: boolean }>('/api/shop/clicks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPromotions: (sessionId?: string) =>
    shopFetch<{
      success: boolean;
      data: import('../stores/ecommerceCatalogStore').ShopProduct[];
      categories?: string[];
    }>(`/api/shop/promotions${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`),

  getMyOrders: () =>
    shopFetch<{ success: boolean; data: unknown[] }>('/api/shop/orders'),

  getProfile: () =>
    shopFetch<{
      success: boolean;
      data: { id: string; full_name: string; email: string; phone: string | null; address: string | null };
    }>('/api/shop/profile'),

  updateProfile: (payload: { full_name?: string; phone?: string; address?: string }) =>
    shopFetch<{ success: boolean; data: unknown }>('/api/shop/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getAddresses: () =>
    shopFetch<{ success: boolean; data: CustomerAddress[] }>('/api/shop/addresses'),

  addAddress: (payload: Omit<CustomerAddress, 'id' | 'customer_id' | 'created_at'>) =>
    shopFetch<{ success: boolean; data: CustomerAddress }>('/api/shop/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteAddress: (addressId: string) =>
    shopFetch<{ success: boolean }>(`/api/shop/addresses/${addressId}`, { method: 'DELETE' }),

  getPaymentMethods: () =>
    shopFetch<{ success: boolean; data: CustomerPaymentMethod[] }>('/api/shop/payment-methods'),

  addPaymentMethod: (payload: Omit<CustomerPaymentMethod, 'id' | 'customer_id' | 'created_at'>) =>
    shopFetch<{ success: boolean; data: CustomerPaymentMethod }>('/api/shop/payment-methods', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMyRatings: () =>
    shopFetch<{ success: boolean; data: unknown[] }>('/api/shop/my-ratings'),

  getChat: (companyId: string) =>
    shopFetch<{ success: boolean; data: { thread_id: string; messages: unknown[] } }>(
      `/api/shop/chat/${companyId}`,
    ),

  getChatThreads: () =>
    shopFetch<{ success: boolean; data: unknown[] }>('/api/shop/chat/threads'),

  sendChatMessage: (companyId: string, body: string) =>
    shopFetch<{ success: boolean; data: unknown }>(`/api/shop/chat/${companyId}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  getAdminChatThreads: () =>
    shopFetch<{ success: boolean; data: unknown[] }>('/api/shop/admin/chat'),

  getAdminChatMessages: (threadId: string) =>
    shopFetch<{ success: boolean; data: unknown[] }>(`/api/shop/admin/chat/${threadId}/messages`),

  sendAdminChatMessage: (threadId: string, body: string) =>
    shopFetch<{ success: boolean; data: unknown }>(`/api/shop/admin/chat/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  searchSuggest: (q: string) =>
    shopFetch<{
      success: boolean;
      data: Array<{
        type: 'product' | 'store';
        id: string;
        label: string;
        company_id?: string;
        company_name?: string;
      }>;
    }>(`/api/shop/search/suggest?q=${encodeURIComponent(q)}`),

  validatePromo: (payload: { code: string; company_id: string; subtotal: number }) =>
    shopFetch<{
      success: boolean;
      data: { discount: number; promo: { code: string; description: string | null } };
    }>('/api/shop/promo/validate', { method: 'POST', body: JSON.stringify(payload) }),

  getShippingEstimate: (params: { region?: string; subtotal: number; fulfillment?: string }) => {
    const qs = new URLSearchParams({
      subtotal: String(params.subtotal),
      fulfillment: params.fulfillment ?? 'delivery',
    });
    if (params.region) qs.set('region', params.region);
    return shopFetch<{ success: boolean; data: { fee: number; estimated_days: number; free_over?: number } }>(
      `/api/shop/shipping/estimate?${qs}`,
    );
  },

  getWishlist: () => shopFetch<{ success: boolean; data: unknown[] }>('/api/shop/wishlist'),

  addWishlist: (product_id: string, company_id: string) =>
    shopFetch<{ success: boolean }>('/api/shop/wishlist', {
      method: 'POST',
      body: JSON.stringify({ product_id, company_id }),
    }),

  removeWishlist: (productId: string) =>
    shopFetch<{ success: boolean }>(`/api/shop/wishlist/${productId}`, { method: 'DELETE' }),

  trackProductView: (payload: { product_id: string; company_id: string; session_id?: string }) =>
    shopFetch<{ success: boolean }>('/api/shop/views', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRecentlyViewed: (sessionId?: string) =>
    shopFetch<{ success: boolean; data: import('../stores/ecommerceCatalogStore').ShopProduct[] }>(
      `/api/shop/recommendations/recent${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`,
    ),

  getRelatedProducts: (companyId: string, productId: string) =>
    shopFetch<{ success: boolean; data: import('../stores/ecommerceCatalogStore').ShopProduct[] }>(
      `/api/shop/recommendations/related/${companyId}/${productId}`,
    ),

  getSellerRatings: (companyId: string) =>
    shopFetch<{
      success: boolean;
      data: { average_rating: number; rating_count: number; ratings: unknown[] };
    }>(`/api/shop/companies/${companyId}/seller-ratings`),

  submitSellerRating: (companyId: string, payload: { rating: number; comment?: string }) =>
    shopFetch<{ success: boolean }>(`/api/shop/companies/${companyId}/seller-ratings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  syncAbandonedCart: (payload: { session_id?: string; email?: string; cart: unknown[] }) =>
    shopFetch<{ success: boolean }>('/api/shop/cart/abandoned', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createGuestOrder: (payload: {
    company_id: string;
    guest_email: string;
    shipping_name: string;
    shipping_phone: string;
    shipping_address?: string;
    fulfillment_type: 'delivery' | 'pickup';
    payment_method: 'pay_on_delivery';
    notes?: string;
    promo_code?: string;
    shipping_fee?: number;
    discount_amount?: number;
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
    }>;
  }) =>
    shopFetch<{ success: boolean; data: { id: string; guest_order_token: string } }>(
      '/api/shop/orders/guest',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getOrderTracking: (orderId: string, guestToken?: string) =>
    shopFetch<{ success: boolean; data: { order: unknown; events: unknown[] } }>(
      `/api/shop/orders/${orderId}/tracking${guestToken ? `?token=${encodeURIComponent(guestToken)}` : ''}`,
    ),

  createReturnRequest: (payload: {
    order_id: string;
    reason: string;
    items: Array<{ product_id: string; quantity: number }>;
  }) =>
    shopFetch<{ success: boolean; data: unknown }>('/api/shop/returns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getReturnRequests: () => shopFetch<{ success: boolean; data: unknown[] }>('/api/shop/returns'),

  getLoyalty: () =>
    shopFetch<{ success: boolean; data: { points: number; lifetime_points: number } }>('/api/shop/loyalty'),

  getVapidPublicKey: () =>
    shopFetch<{ success: boolean; data: { configured: boolean; publicKey: string | null } }>(
      '/api/shop/push/vapid-public-key',
    ),

  getPushStatus: () =>
    shopFetch<{ success: boolean; data: { configured: boolean; subscribed: boolean } }>(
      '/api/shop/push/status',
    ),

  subscribePush: (payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    user_agent?: string;
  }) =>
    shopFetch<{ success: boolean }>('/api/shop/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  unsubscribePush: (payload: { endpoint?: string }) =>
    shopFetch<{ success: boolean }>('/api/shop/push/subscribe', {
      method: 'DELETE',
      body: JSON.stringify(payload),
    }),

  getNotifications: () =>
    shopFetch<{ success: boolean; data: CustomerNotification[] }>('/api/shop/notifications'),

  getUnreadNotificationCount: () =>
    shopFetch<{ success: boolean; data: { count: number } }>('/api/shop/notifications/unread-count'),

  markNotificationRead: (id: string) =>
    shopFetch<{ success: boolean }>(`/api/shop/notifications/${id}/read`, { method: 'PATCH' }),

  markAllNotificationsRead: () =>
    shopFetch<{ success: boolean }>('/api/shop/notifications/read-all', { method: 'POST' }),
};

export interface CustomerNotification {
  id: string;
  customer_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface CustomerAddress {
  id?: string;
  customer_id?: string;
  label: string;
  full_name?: string | null;
  phone?: string | null;
  address_line: string;
  city?: string | null;
  region?: string | null;
  is_default?: boolean;
  created_at?: string;
}

export interface CustomerPaymentMethod {
  id?: string;
  customer_id?: string;
  type: 'mobile_money' | 'card' | 'pay_on_delivery';
  provider?: string | null;
  phone_number?: string | null;
  label?: string | null;
  card_last4?: string | null;
  card_exp_month?: number | null;
  card_exp_year?: number | null;
  is_default?: boolean;
  created_at?: string;
}
