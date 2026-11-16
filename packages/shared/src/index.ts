export type UserRole = 'super_admin' | 'company_admin' | 'salesperson' | 'customer';

export type SalesType = 'retail' | 'wholesale' | 'both';

export interface Company {
  id: string;
  name: string;
  phone?: string;
  location?: string;
  plan: string;
  status: string;
  created_at: string;
}

export interface CreateCompanyPayload {
  companyName: string;
  phone?: string;
  location?: string;
  plan: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
}

export interface CreateStaffPayload {
  companyId: string;
  branchId: string;
  fullName: string;
  email: string;
  password: string;
  sales_type?: SalesType;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export * from './database.types.js';
export * from './subscriptionPlans.js';
