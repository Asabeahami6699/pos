import type { UserRole } from '../types';

/** Dashboard or home path after auth, by role */
export function getHomePathForRole(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin/dashboard';
    case 'company_admin':
      return '/admin/inventory';
    case 'salesperson':
      return '/pos/salespersonPage';
    case 'customer':
      return '/';
    default:
      return '/';
  }
}

/** Staff login page (not customer shop auth) */
export const STAFF_LOGIN_PATH = '/login';

/** Protected staff routes redirect here when unauthorized */
export const STAFF_AUTH_PATH = '/login';

export const shopRoutes = {
  home: '/',
  store: (companyId: string) => `/store/${companyId}`,
  product: (companyId: string, productId: string) => `/product/${companyId}/${productId}`,
  categories: '/categories',
  category: (slug: string) => `/categories/${encodeURIComponent(slug)}`,
  cart: '/cart',
  checkout: '/checkout',
  orders: '/orders',
  account: '/account',
  inbox: '/account/inbox',
  notifications: '/account/notifications',
  chat: '/chat',
  chatRoom: (companyId: string) => `/chat/${companyId}`,
  customerLogin: (redirect?: string) =>
    `/auth/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`,
  customerSignup: (redirect?: string) =>
    `/auth/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`,
};
