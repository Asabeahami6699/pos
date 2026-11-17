import { supabase } from './supabase';
import { getActingTenantId } from '../stores/tenantContextStore';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

/** Sent by super admins when scoped into a tenant dashboard */
export const ACTING_COMPANY_HEADER = 'X-Acting-Company-Id';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };
  const actingCompanyId = getActingTenantId();
  if (actingCompanyId) {
    headers[ACTING_COMPANY_HEADER] = actingCompanyId;
  }
  return headers;
}

function formatApiError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Request failed';
  const err = (data as { error?: unknown }).error;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object') {
    if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
      return (err as { message: string }).message;
    }
    if ('fieldErrors' in err || 'formErrors' in err) {
      const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const parts = [...(flat.formErrors ?? [])];
      for (const [field, msgs] of Object.entries(flat.fieldErrors ?? {})) {
        if (msgs?.length) parts.push(`${field}: ${msgs.join(', ')}`);
      }
      if (parts.length) return parts.join('; ');
    }
  }
  return 'Request failed';
}

export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    if (body && typeof body === 'object' && 'code' in body) {
      const code = (body as { code?: unknown }).code;
      if (typeof code === 'string') this.code = code;
    }
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      response.ok ? 'Invalid server response' : `Request failed (${response.status})`,
      response.status,
    );
  }

  if (!response.ok) {
    throw new ApiError(formatApiError(data), response.status, data);
  }

  return data as T;
}

export const api = {
  createCompany: (payload: {
    companyName: string;
    phone?: string;
    location?: string;
    plan: string;
    adminEmail: string;
    adminPassword: string;
    adminFullName: string;
  }) =>
    apiFetch<{ success: boolean; data?: { companyId: string; userId: string }; error?: string }>(
      '/api/companies',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  createStaff: (payload: {
    companyId: string;
    branchId: string;
    fullName: string;
    email: string;
    password: string;
    sales_type?: 'retail' | 'wholesale' | 'both';
  }) =>
    apiFetch<{ success: boolean; data?: { userId: string; branchName: string }; error?: string }>(
      '/api/staff',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  createSale: (payload: {
    id: string;
    company_id: string;
    branch_id: string;
    total: number;
    payment_method: string;
    payment_received: number;
    change_given?: number;
    payment_notes?: string;
    sales_type: 'retail' | 'wholesale';
    customer_name?: string | null;
    customer_phone?: string | null;
    items: Array<{
      product_id: string;
      quantity: number;
      price: number;
      original_price?: number;
      wholesale_price?: number;
    }>;
    created_at?: string;
  }) =>
    apiFetch<{ success: boolean; data: Record<string, unknown>; idempotent?: boolean }>(
      '/api/sales',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  logTenantAccess: (payload: {
    company_id: string;
    action: 'enter' | 'exit';
    meta?: Record<string, unknown>;
  }) =>
    apiFetch<{ success: boolean; data?: { id: string; created_at: string } }>(
      '/api/super-admin/tenant-access',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  createReturn: (payload: {
    sale_id: string;
    branch_id: string;
    company_id: string;
    reason: string;
    sales_type?: 'retail' | 'wholesale';
    items: Array<{
      product_id: string;
      quantity: number;
      price: number;
    }>;
  }) =>
    apiFetch<{ success: boolean; data: { id: string } }>(
      '/api/sales/returns',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  getAdminOnlineOrders: (status?: string) =>
    apiFetch<{ success: boolean; data: AdminOnlineOrder[] }>(
      `/api/shop/admin/orders${status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),

  updateAdminOnlineOrderStatus: (
    orderId: string,
    payload: {
      status?: AdminOnlineOrderStatus;
      tracking_number?: string;
      carrier_name?: string;
    },
  ) =>
    apiFetch<{ success: boolean; data: AdminOnlineOrder }>(`/api/shop/admin/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getAdminReturnRequests: () =>
    apiFetch<{ success: boolean; data: AdminReturnRequest[] }>('/api/shop/admin/returns'),

  updateAdminReturnRequest: (
    returnId: string,
    payload: { status: AdminReturnStatus; admin_notes?: string },
  ) =>
    apiFetch<{ success: boolean; data: AdminReturnRequest }>(
      `/api/shop/admin/returns/${returnId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),

  getPaystackBanks: () =>
    apiFetch<{ success: boolean; data: PaystackBank[] }>('/api/companies/paystack/banks'),

  getPaystackPayout: () =>
    apiFetch<{ success: boolean; data: PaystackPayoutSettings }>('/api/companies/paystack/payout'),

  resolvePaystackAccount: (payload: { bank_code: string; account_number: string }) =>
    apiFetch<{ success: boolean; data: { account_name: string; account_number: string } }>(
      '/api/companies/paystack/payout/resolve-account',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  setupPaystackPayout: (payload: {
    settlement_bank: string;
    account_number: string;
    account_name?: string;
    contact_email?: string;
    contact_phone?: string;
    platform_fee_percent?: number;
  }) =>
    apiFetch<{ success: boolean; data: Record<string, unknown> }>(
      '/api/companies/paystack/payout/setup',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  getCompanySettings: () =>
    apiFetch<{ success: boolean; data: CompanySettings }>('/api/companies/settings'),

  updateCompanySettings: (payload: {
    full_name?: string;
    phone?: string | null;
    address?: string | null;
    company_name?: string;
    company_phone?: string | null;
    company_location?: string | null;
    logo_url?: string | null;
    banner_url?: string | null;
    inventory_model?: 'warehouse' | 'branch_only';
    tax_rate_percent?: number;
    pos_discounts_enabled?: boolean;
    pos_max_discount_percent?: number;
    pos_quick_discounts?: number[];
    support_phone?: string | null;
    support_email?: string | null;
  }) =>
    apiFetch<{ success: boolean; data: CompanySettings }>('/api/companies/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getSubscription: () =>
    apiFetch<{ success: boolean; data: SubscriptionInfo }>('/api/companies/subscription'),

  getSuperAdminOverview: () =>
    apiFetch<{ success: boolean; data: SuperAdminOverview }>('/api/super-admin/overview'),

  getSuperAdminAnalytics: () =>
    apiFetch<{ success: boolean; data: SuperAdminAnalytics }>('/api/super-admin/analytics'),

  getSuperAdminCompanies: () =>
    apiFetch<{ success: boolean; data: SuperAdminCompany[] }>('/api/super-admin/companies'),

  updateSuperAdminCompany: (
    companyId: string,
    payload: Partial<{
      name: string;
      phone: string;
      location: string;
      plan: 'trial' | 'six_month' | 'yearly';
      platform_fee_percent: number | null;
      plan_started_at: string;
      plan_renewal_at: string;
      extend_plan: boolean;
    }>,
  ) =>
    apiFetch<{ success: boolean; data: Record<string, unknown> }>(
      `/api/super-admin/companies/${companyId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    ),

  setSuperAdminCompanyStatus: (companyId: string, status: 'active' | 'suspended') =>
    apiFetch<{ success: boolean; data: { id: string; name: string; status: string } }>(
      `/api/super-admin/companies/${companyId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    ),

  deleteSuperAdminCompany: (companyId: string) =>
    apiFetch<{ success: boolean; data: { deleted: string } }>(
      `/api/super-admin/companies/${companyId}`,
      { method: 'DELETE' },
    ),

  getPlatformSettings: () =>
    apiFetch<{
      success: boolean;
      data: {
        platform_fee_percent: number;
        support_email: string | null;
        support_phone: string | null;
      };
    }>('/api/super-admin/platform-settings'),

  updatePlatformSettings: (payload: {
    platform_fee_percent?: number;
    support_email?: string | null;
    support_phone?: string | null;
  }) =>
    apiFetch<{
      success: boolean;
      data: {
        platform_fee_percent: number;
        support_email: string | null;
        support_phone: string | null;
      };
    }>('/api/super-admin/platform-settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export interface CompanySettingsUser {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  role: string;
}

export interface CompanySettingsCompany {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  logo_url: string | null;
  banner_url: string | null;
  inventory_model: 'warehouse' | 'branch_only';
  tax_rate_percent?: number;
  pos_discounts_enabled?: boolean;
  pos_max_discount_percent?: number;
  pos_quick_discounts?: number[];
  support_phone?: string | null;
  support_email?: string | null;
}

export interface CompanySettings {
  user: CompanySettingsUser;
  company: CompanySettingsCompany;
}

export interface PaystackBank {
  name: string;
  slug: string;
  code: string;
  currency: string;
  type: string;
}

export interface PaystackPayoutSettings {
  id: string;
  name: string;
  paystack_subaccount_code: string | null;
  paystack_subaccount_status: 'none' | 'pending' | 'active' | 'error';
  payout_settlement_bank: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  payout_contact_email: string | null;
  payout_contact_phone: string | null;
  platform_fee_percent: number | null;
  default_platform_fee_percent: number;
  paystack_configured: boolean;
}

export type SubscriptionAccess = 'active' | 'warning' | 'locked';

export interface SubscriptionInfo {
  company_name: string;
  plan: string;
  status: string;
  plan_started_at: string | null;
  plan_renewal_at: string | null;
  days_until_renewal: number | null;
  access: SubscriptionAccess;
  lock_reason: string | null;
  support_email: string | null;
  support_phone: string | null;
}

export interface SuperAdminOverview {
  total_companies: number;
  active_companies: number;
  suspended_companies: number;
  expiring_soon: number;
  expired_companies: number;
  paystack_connected: number;
  online_orders: number;
  marketplace_gmv: number;
  platform_fees_collected: number;
  platform_fee_percent: number;
}

export interface SuperAdminAnalytics {
  plan_breakdown: Array<{ plan: string; count: number }>;
  status_breakdown: Array<{ status: string; count: number }>;
  online_trend: Array<{ date: string; orders: number; revenue: number }>;
  top_companies: Array<{
    company_id: string;
    name: string;
    plan: string;
    online_orders: number;
    online_revenue: number;
    pos_revenue: number;
    platform_fees: number;
    paystack_status: string;
  }>;
  totals: {
    online_orders_30d: number;
    online_revenue_30d: number;
    platform_fees_30d: number;
    pos_sales_30d: number;
  };
}

export interface SuperAdminCompany {
  id: string;
  name: string;
  phone?: string | null;
  location?: string | null;
  plan: string;
  status: string;
  created_at: string;
  plan_started_at: string | null;
  plan_renewal_at: string | null;
  platform_fee_percent: number | null;
  paystack_subaccount_code: string | null;
  paystack_subaccount_status: string;
  payout_account_name: string | null;
  payout_contact_email?: string | null;
  payout_contact_phone?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  subscription: SubscriptionInfo;
}

export type AdminOnlineOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface AdminOnlineOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  barcode?: string | null;
  sku?: string | null;
}

export interface AdminOnlineOrder {
  id: string;
  company_id: string;
  customer_id: string;
  status: AdminOnlineOrderStatus;
  total: number;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  fulfillment_type?: string | null;
  payment_method: string;
  payment_status?: string | null;
  notes: string | null;
  tracking_number?: string | null;
  carrier_name?: string | null;
  estimated_delivery_date?: string | null;
  created_at: string;
  updated_at: string;
  online_order_items?: AdminOnlineOrderItem[];
}

export type AdminReturnStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';

export interface AdminReturnRequest {
  id: string;
  order_id: string;
  company_id: string;
  customer_id: string | null;
  reason: string;
  status: AdminReturnStatus;
  items: Array<{ product_id: string; quantity: number }>;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  online_orders?: { id: string; total: number; status: string; shipping_name?: string };
}
