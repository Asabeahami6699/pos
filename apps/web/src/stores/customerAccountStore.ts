import { create } from 'zustand';
import { shopApi, type CustomerPaymentMethod } from '../lib/shopApi';

export type AddMomoPayload = {
  provider: string;
  phone_number: string;
  label?: string;
  is_default?: boolean;
};

export type AddCardPayload = {
  provider: string;
  label?: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default?: boolean;
};

interface CustomerAccountStore {
  paymentMethods: CustomerPaymentMethod[];
  paymentMethodsLoading: boolean;
  paymentMethodsError: string | null;
  paymentMethodsLoaded: boolean;

  fetchPaymentMethods: (options?: { force?: boolean }) => Promise<void>;
  addMomoPayment: (payload: AddMomoPayload) => Promise<CustomerPaymentMethod>;
  addCardPayment: (payload: AddCardPayload) => Promise<CustomerPaymentMethod>;
  resetAccount: () => void;
}

export const useCustomerAccountStore = create<CustomerAccountStore>((set, get) => ({
  paymentMethods: [],
  paymentMethodsLoading: false,
  paymentMethodsError: null,
  paymentMethodsLoaded: false,

  fetchPaymentMethods: async (options) => {
    const { force } = options ?? {};
    if (get().paymentMethodsLoading) return;
    if (get().paymentMethodsLoaded && !force) return;

    set({ paymentMethodsLoading: true, paymentMethodsError: null });
    try {
      const res = await shopApi.getPaymentMethods();
      set({
        paymentMethods: res.data ?? [],
        paymentMethodsLoaded: true,
      });
    } catch (e) {
      set({
        paymentMethodsError: e instanceof Error ? e.message : 'Failed to load payment methods',
      });
      throw e;
    } finally {
      set({ paymentMethodsLoading: false });
    }
  },

  addMomoPayment: async (payload) => {
    const methods = get().paymentMethods;
    const res = await shopApi.addPaymentMethod({
      type: 'mobile_money',
      provider: payload.provider,
      phone_number: payload.phone_number,
      label: payload.label ?? 'MoMo',
      is_default: payload.is_default ?? methods.length === 0,
    });
    const saved = res.data;
    set({
      paymentMethods: [...methods, saved],
      paymentMethodsLoaded: true,
    });
    return saved;
  },

  addCardPayment: async (payload) => {
    const methods = get().paymentMethods;
    const brand = payload.provider.charAt(0).toUpperCase() + payload.provider.slice(1);
    const res = await shopApi.addPaymentMethod({
      type: 'card',
      provider: payload.provider,
      label: payload.label ?? `${brand} •••• ${payload.card_last4}`,
      card_last4: payload.card_last4,
      card_exp_month: payload.card_exp_month,
      card_exp_year: payload.card_exp_year,
      is_default: payload.is_default ?? methods.length === 0,
    });
    const saved = res.data;
    set({
      paymentMethods: [...methods, saved],
      paymentMethodsLoaded: true,
    });
    return saved;
  },

  resetAccount: () =>
    set({
      paymentMethods: [],
      paymentMethodsLoading: false,
      paymentMethodsError: null,
      paymentMethodsLoaded: false,
    }),
}));

export function formatPaymentMethodSummary(method: CustomerPaymentMethod): string {
  if (method.type === 'card') {
    const last4 = method.card_last4 ?? '••••';
    const brand = method.provider ? method.provider.replace(/_/g, ' ') : 'Card';
    const exp =
      method.card_exp_month && method.card_exp_year
        ? ` · ${String(method.card_exp_month).padStart(2, '0')}/${String(method.card_exp_year).slice(-2)}`
        : '';
    return `${brand} •••• ${last4}${exp}`;
  }
  if (method.type === 'mobile_money') {
    return method.phone_number ?? method.label ?? 'Mobile money';
  }
  return method.label ?? method.type.replace(/_/g, ' ');
}
