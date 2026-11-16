import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole, requireActiveSubscription, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  createPaystackSubaccount,
  getDefaultPlatformFeePercent,
  listPaystackBanks,
  resolvePaystackBankAccount,
  resolvePlatformFeePercent,
  updatePaystackSubaccount,
} from '../lib/paystack.js';

function db(supabase: ReturnType<typeof getSupabaseAdmin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function requireCompanyAdmin(req: AuthenticatedRequest, res: import('express').Response): string | null {
  if (!req.companyId) {
    res.status(403).json({ success: false, error: 'Company context required' });
    return null;
  }
  if (req.userRole !== 'company_admin' && req.userRole !== 'super_admin') {
    res.status(403).json({ success: false, error: 'Company admin required' });
    return null;
  }
  return req.companyId;
}

export const paystackPayoutRouter = Router();

paystackPayoutRouter.get(
  '/banks',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  async (_req, res) => {
    try {
      const banks = await listPaystackBanks('GHS');
      return res.json({ success: true, data: banks });
    } catch (error) {
      return res.status(503).json({
        success: false,
        error: getErrorMessage(error, 'Failed to load banks'),
      });
    }
  },
);

paystackPayoutRouter.get('/payout', requireAuth, requireRole('company_admin', 'super_admin'), async (req, res) => {
  const companyId = requireCompanyAdmin(req, res);
  if (!companyId) return;

  try {
    const supabase = getSupabaseAdmin();
    const { data: company, error } = await db(supabase)
      .from('companies')
      .select(
        'id, name, paystack_subaccount_code, paystack_subaccount_status, payout_settlement_bank, payout_account_number, payout_account_name, payout_contact_email, payout_contact_phone, platform_fee_percent',
      )
      .eq('id', companyId)
      .single();

    if (error || !company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const row = company as Record<string, unknown>;

    return res.json({
      success: true,
      data: {
        ...row,
        default_platform_fee_percent: getDefaultPlatformFeePercent(),
        paystack_configured: Boolean(process.env.PAYSTACK_SECRET_KEY),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load payout settings'),
    });
  }
});

const resolveAccountSchema = z.object({
  bank_code: z.string().min(2),
  account_number: z.string().min(8).max(20),
});

paystackPayoutRouter.post(
  '/payout/resolve-account',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  requireActiveSubscription,
  async (req: AuthenticatedRequest, res) => {
    if (!requireCompanyAdmin(req, res)) return;

    const parsed = resolveAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    try {
      const resolved = await resolvePaystackBankAccount(
        parsed.data.account_number,
        parsed.data.bank_code,
      );
      return res.json({ success: true, data: resolved });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: getErrorMessage(error, 'Account verification failed'),
      });
    }
  },
);

const setupPayoutSchema = z.object({
  settlement_bank: z.string().min(2),
  account_number: z.string().min(8).max(20),
  account_name: z.string().min(2).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().min(6).optional(),
  platform_fee_percent: z.number().min(0).max(50).optional(),
});

paystackPayoutRouter.post(
  '/payout/setup',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  requireActiveSubscription,
  async (req: AuthenticatedRequest, res) => {
    const companyId = requireCompanyAdmin(req, res);
    if (!companyId) return;

    const parsed = setupPayoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data: companyRow, error: companyError } = await db(supabase)
        .from('companies')
        .select(
          'id, name, paystack_subaccount_code, paystack_subaccount_status, platform_fee_percent',
        )
        .eq('id', companyId)
        .single();

      if (companyError || !companyRow) {
        return res.status(404).json({ success: false, error: 'Company not found' });
      }

      const company = companyRow as {
        id: string;
        name: string;
        paystack_subaccount_code: string | null;
        paystack_subaccount_status: string;
        platform_fee_percent: number | null;
      };

      let accountName = parsed.data.account_name?.trim();
      if (!accountName) {
        const resolved = await resolvePaystackBankAccount(
          parsed.data.account_number,
          parsed.data.settlement_bank,
        );
        accountName = resolved.account_name;
      }

      const feePercent = resolvePlatformFeePercent(
        parsed.data.platform_fee_percent ?? company.platform_fee_percent,
      );

      const contactEmail = parsed.data.contact_email ?? req.userEmail;
      const contactPhone = parsed.data.contact_phone;

      let subaccountCode = company.paystack_subaccount_code as string | null;
      let subaccountStatus: 'pending' | 'active' | 'error' = 'pending';

      if (subaccountCode) {
        const updated = await updatePaystackSubaccount(subaccountCode, {
          businessName: accountName,
          settlementBank: parsed.data.settlement_bank,
          accountNumber: parsed.data.account_number,
          percentageCharge: feePercent,
          active: true,
        });
        subaccountStatus = updated.active && updated.is_verified ? 'active' : 'pending';
      } else {
        const created = await createPaystackSubaccount({
          businessName: accountName,
          settlementBank: parsed.data.settlement_bank,
          accountNumber: parsed.data.account_number,
          percentageCharge: feePercent,
          primaryContactEmail: contactEmail,
          primaryContactName: accountName,
          primaryContactPhone: contactPhone,
        });
        subaccountCode = created.subaccount_code;
        subaccountStatus = created.active && created.is_verified ? 'active' : 'pending';
      }

      const { error: updateError } = await db(supabase)
        .from('companies')
        .update({
          paystack_subaccount_code: subaccountCode,
          paystack_subaccount_status: subaccountStatus,
          payout_settlement_bank: parsed.data.settlement_bank,
          payout_account_number: parsed.data.account_number,
          payout_account_name: accountName,
          payout_contact_email: contactEmail ?? null,
          payout_contact_phone: contactPhone ?? null,
          platform_fee_percent: parsed.data.platform_fee_percent ?? company.platform_fee_percent,
        })
        .eq('id', companyId);

      if (updateError) throw updateError;

      return res.json({
        success: true,
        data: {
          paystack_subaccount_code: subaccountCode,
          paystack_subaccount_status: subaccountStatus,
          payout_account_name: accountName,
          platform_fee_percent: feePercent,
        },
      });
    } catch (error) {
      const supabase = getSupabaseAdmin();
      await db(supabase)
        .from('companies')
        .update({ paystack_subaccount_status: 'error' })
        .eq('id', companyId);

      return res.status(400).json({
        success: false,
        error: getErrorMessage(error, 'Failed to set up Paystack payout'),
      });
    }
  },
);
