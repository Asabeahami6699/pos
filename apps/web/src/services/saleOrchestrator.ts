import type { CartItem, Customer, Payment, User, Branch } from '../types';
import { api } from '../lib/api';
import { isOnline, isNetworkError } from '../lib/offline/network';
import { savePendingSale } from '../lib/offline/pendingSales';
import { decrementLocalStock } from '../lib/offline/catalogCache';

export interface ProcessSaleParams {
  cart: CartItem[];
  total: number;
  customer: Customer;
  payment: Payment;
  salesType: 'retail' | 'wholesale';
  user: User;
  selectedBranch: Branch;
}

export interface ProcessSaleResult {
  id: string;
  company_id: string;
  branch_id: string;
  salesperson_id: string;
  total: number;
  sales_type: string;
  created_at: string;
  offline?: boolean;
  pendingSync?: boolean;
}

function buildApiPayload(saleId: string, params: ProcessSaleParams) {
  const { cart, total, customer, payment, salesType, selectedBranch } = params;
  const roundedTotal = Math.round(total * 100) / 100;
  const paymentReceived = Math.round(payment.amount * 100) / 100;

  return {
    id: saleId,
    company_id: selectedBranch.company_id,
    branch_id: selectedBranch.id,
    total: roundedTotal,
    payment_method: payment.method,
    payment_received: paymentReceived,
    change_given: Math.max(0, Math.round((paymentReceived - roundedTotal) * 100) / 100),
    payment_notes: payment.notes?.trim() || undefined,
    sales_type: salesType,
    customer_name: customer.name?.trim() || null,
    customer_phone: customer.phone?.trim() || null,
    items: cart.map((item) => {
      const price = Math.round(item.unitPrice * (1 - item.discount / 100) * 100) / 100;
      const row: {
        product_id: string;
        quantity: number;
        price: number;
        original_price: number;
        wholesale_price?: number;
      } = {
        product_id: item.product.id,
        quantity: item.quantity,
        price,
        original_price: item.product.price,
      };
      if (typeof item.product.wholesale_price === 'number' && item.product.wholesale_price >= 0) {
        row.wholesale_price = item.product.wholesale_price;
      }
      return row;
    }),
    created_at: new Date().toISOString(),
  };
}

async function processSaleOnline(saleId: string, params: ProcessSaleParams): Promise<ProcessSaleResult> {
  const payload = buildApiPayload(saleId, params);
  const result = await api.createSale(payload);
  return result.data as ProcessSaleResult;
}

async function processSaleOffline(saleId: string, params: ProcessSaleParams): Promise<ProcessSaleResult> {
  await savePendingSale(saleId, params);
  await decrementLocalStock(
    params.selectedBranch.id,
    params.cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
  );

  const now = new Date().toISOString();
  return {
    id: saleId,
    company_id: params.selectedBranch.company_id,
    branch_id: params.selectedBranch.id,
    salesperson_id: params.user.id,
    total: params.total,
    sales_type: params.salesType,
    created_at: now,
    offline: true,
    pendingSync: true,
  };
}

export const saleOrchestrator = {
  async processSale(params: ProcessSaleParams): Promise<ProcessSaleResult> {
    const saleId = crypto.randomUUID();

    if (isOnline()) {
      try {
        return await processSaleOnline(saleId, params);
      } catch (error) {
        if (!isNetworkError(error)) throw error;
      }
    }

    return processSaleOffline(saleId, params);
  },

  buildApiPayload,
};
