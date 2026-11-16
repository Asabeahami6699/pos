import crypto from 'crypto';
import { getCachedPlatformFeePercent } from './platformSettings.js';

const PAYSTACK_BASE = 'https://api.paystack.co';

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }
  return key;
}

export function getPaystackPublicKey(): string {
  return process.env.PAYSTACK_PUBLIC_KEY ?? '';
}

export function getDefaultPlatformFeePercent(): number {
  const cached = getCachedPlatformFeePercent();
  if (cached != null && !Number.isNaN(cached)) return cached;

  const raw = Number(process.env.PLATFORM_FEE_PERCENT ?? 5);
  if (Number.isNaN(raw)) return 5;
  return Math.min(Math.max(raw, 0), 50);
}

export function resolvePlatformFeePercent(companyPercent: number | null | undefined): number {
  if (companyPercent != null && !Number.isNaN(Number(companyPercent))) {
    return Math.min(Math.max(Number(companyPercent), 0), 50);
  }
  return getDefaultPlatformFeePercent();
}

export function computePlatformFeeAmount(totalGhs: number, feePercent: number): number {
  return Math.round(totalGhs * feePercent) / 100;
}

export function generatePaystackReference(): string {
  return `MP-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}

export function toKobo(amountGhs: number): number {
  return Math.round(amountGhs * 100);
}

interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    channel: string;
    metadata: Record<string, unknown>;
  };
}

export interface PaystackBank {
  name: string;
  slug: string;
  code: string;
  currency: string;
  type: string;
}

export interface PaystackSubaccountData {
  subaccount_code: string;
  business_name: string;
  account_number: string;
  settlement_bank: string;
  percentage_charge: number;
  is_verified: boolean;
  active: boolean;
}

async function paystackRequest<T>(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const body = (await response.json()) as PaystackApiResponse<T>;
  if (!response.ok || !body.status) {
    throw new Error(body.message || 'Paystack request failed');
  }
  return body.data;
}

export async function listPaystackBanks(currency = 'GHS'): Promise<PaystackBank[]> {
  const data = await paystackRequest<PaystackBank[]>(`/bank?currency=${currency}`);
  return data ?? [];
}

export async function resolvePaystackBankAccount(
  accountNumber: string,
  bankCode: string,
): Promise<{ account_name: string; account_number: string }> {
  const response = await fetch(
    `${PAYSTACK_BASE}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    {
      headers: { Authorization: `Bearer ${getSecretKey()}` },
    },
  );
  const body = (await response.json()) as PaystackApiResponse<{
    account_name: string;
    account_number: string;
  }>;
  if (!response.ok || !body.status) {
    throw new Error(body.message || 'Could not verify bank account');
  }
  return body.data;
}

export async function createPaystackSubaccount(params: {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
  percentageCharge: number;
  description?: string;
  primaryContactEmail?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
}): Promise<PaystackSubaccountData> {
  return paystackRequest<PaystackSubaccountData>('/subaccount', {
    method: 'POST',
    body: {
      business_name: params.businessName,
      settlement_bank: params.settlementBank,
      account_number: params.accountNumber,
      percentage_charge: params.percentageCharge,
      description: params.description ?? 'Marketplace vendor settlement',
      primary_contact_email: params.primaryContactEmail,
      primary_contact_name: params.primaryContactName,
      primary_contact_phone: params.primaryContactPhone,
    },
  });
}

export async function updatePaystackSubaccount(
  subaccountCode: string,
  params: {
    businessName?: string;
    settlementBank?: string;
    accountNumber?: string;
    percentageCharge?: number;
    active?: boolean;
  },
): Promise<PaystackSubaccountData> {
  const body: Record<string, unknown> = {};
  if (params.businessName) body.business_name = params.businessName;
  if (params.settlementBank) body.settlement_bank = params.settlementBank;
  if (params.accountNumber) body.account_number = params.accountNumber;
  if (params.percentageCharge != null) body.percentage_charge = params.percentageCharge;
  if (params.active != null) body.active = params.active;

  return paystackRequest<PaystackSubaccountData>(`/subaccount/${encodeURIComponent(subaccountCode)}`, {
    method: 'PUT',
    body,
  });
}

export async function initializePaystackTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  subaccount?: string;
  transactionChargeKobo?: number;
  bearer?: 'account' | 'subaccount';
}): Promise<PaystackInitializeResponse['data']> {
  const payload: Record<string, unknown> = {
    email: params.email,
    amount: params.amountKobo,
    reference: params.reference,
    callback_url: params.callbackUrl,
    metadata: params.metadata,
    currency: 'GHS',
  };

  if (params.subaccount) {
    payload.subaccount = params.subaccount;
    if (params.transactionChargeKobo != null && params.transactionChargeKobo > 0) {
      payload.transaction_charge = params.transactionChargeKobo;
    }
    if (params.bearer) {
      payload.bearer = params.bearer;
    }
  }

  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as PaystackInitializeResponse;
  if (!response.ok || !body.status) {
    throw new Error(body.message || 'Paystack initialization failed');
  }
  return body.data;
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResponse['data']> {
  const response = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
    },
  });

  const body = (await response.json()) as PaystackVerifyResponse;
  if (!response.ok || !body.status) {
    throw new Error(body.message || 'Paystack verification failed');
  }
  return body.data;
}

export function verifyPaystackWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return hash === signature;
}

export async function refundPaystackTransaction(
  transactionReference: string,
  amountKobo?: number,
  reason?: string,
): Promise<{ status: string; transaction_reference: string }> {
  const body: Record<string, unknown> = {
    transaction: transactionReference,
    merchant_note: reason ?? 'Customer refund',
  };
  if (amountKobo != null && amountKobo > 0) {
    body.amount = amountKobo;
  }

  return paystackRequest<{ status: string; transaction_reference: string }>('/refund', {
    method: 'POST',
    body,
  });
}
