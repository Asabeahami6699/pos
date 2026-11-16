import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabase.js';
import {
  requireAuth,
  requireRole,
  requireActiveSubscription,
  type AuthenticatedRequest,
} from '../middleware/auth.js';

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

const settingsUpdateSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().min(6).optional().nullable(),
  address: z.string().optional().nullable(),
  company_name: z.string().min(2).optional(),
  company_phone: z.string().optional().nullable(),
  company_location: z.string().optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  banner_url: z.string().url().optional().nullable(),
  inventory_model: z.enum(['warehouse', 'branch_only']).optional(),
  tax_rate_percent: z.number().min(0).max(100).optional(),
  pos_discounts_enabled: z.boolean().optional(),
  pos_max_discount_percent: z.number().min(0).max(100).optional(),
  pos_quick_discounts: z.array(z.number().min(0).max(100)).max(8).optional(),
  support_phone: z.string().min(6).optional().nullable(),
  support_email: z
    .union([z.string().email(), z.literal(''), z.null()])
    .optional(),
});

const COMPANY_SETTINGS_SELECT =
  'id, name, phone, location, logo_url, banner_url, inventory_model, tax_rate_percent, pos_discounts_enabled, pos_max_discount_percent, pos_quick_discounts, support_phone, support_email';

function parseQuickDiscounts(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [5, 10, 15];
  const nums = raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
  return nums.length ? nums : [5, 10, 15];
}

function mapCompanySettings(row: Record<string, unknown>) {
  const tax = Number(row.tax_rate_percent);
  const maxDisc = Number(row.pos_max_discount_percent);
  return {
    id: row.id,
    name: row.name ?? '',
    phone: row.phone ?? null,
    location: row.location ?? null,
    logo_url: row.logo_url ?? null,
    banner_url: row.banner_url ?? null,
    inventory_model: row.inventory_model === 'branch_only' ? 'branch_only' : 'warehouse',
    tax_rate_percent: Number.isFinite(tax) ? tax : 16,
    pos_discounts_enabled: row.pos_discounts_enabled !== false,
    pos_max_discount_percent: Number.isFinite(maxDisc) ? maxDisc : 100,
    pos_quick_discounts: parseQuickDiscounts(row.pos_quick_discounts),
    support_phone: row.support_phone ?? null,
    support_email: row.support_email ?? null,
  };
}

async function fetchCompanySettingsRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
) {
  let companyResult = await db(supabase)
    .from('companies')
    .select(COMPANY_SETTINGS_SELECT)
    .eq('id', companyId)
    .single();

  if (companyResult.error?.code === '42703') {
    companyResult = await db(supabase)
      .from('companies')
      .select('id, name, phone, location, logo_url, banner_url, inventory_model')
      .eq('id', companyId)
      .single();
  }

  return companyResult;
}

export const companySettingsRouter = Router();

companySettingsRouter.get(
  '/settings',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = requireCompanyAdmin(req, res);
    if (!companyId) return;

    try {
      const supabase = getSupabaseAdmin();

      const companyResult = await fetchCompanySettingsRow(supabase, companyId);
      const { data: company, error: companyError } = companyResult;

      if (companyError || !company) {
        return res.status(404).json({ success: false, error: 'Company not found' });
      }

      const { data: user, error: userError } = await db(supabase)
        .from('users')
        .select('id, full_name, phone, address, role')
        .eq('id', req.userId!)
        .single();

      if (userError || !user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      let email: string | null = null;
      const { data: authUser } = await supabase.auth.admin.getUserById(req.userId!);
      email = authUser?.user?.email ?? null;

      const userRow = user as Record<string, unknown>;

      return res.json({
        success: true,
        data: {
          user: {
            id: userRow.id,
            full_name: userRow.full_name ?? '',
            phone: userRow.phone ?? null,
            address: userRow.address ?? null,
            email,
            role: userRow.role,
          },
          company: mapCompanySettings(company as Record<string, unknown>),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to load settings'),
      });
    }
  },
);

companySettingsRouter.patch(
  '/settings',
  requireAuth,
  requireRole('company_admin', 'super_admin'),
  requireActiveSubscription,
  async (req: AuthenticatedRequest, res) => {
    const companyId = requireCompanyAdmin(req, res);
    if (!companyId) return;

    const parsed = settingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    try {
      const supabase = getSupabaseAdmin();
      const body = parsed.data;

      const userUpdates: Record<string, unknown> = {};
      if (body.full_name != null) userUpdates.full_name = body.full_name;
      if (body.phone !== undefined) userUpdates.phone = body.phone;
      if (body.address !== undefined) userUpdates.address = body.address;

      if (Object.keys(userUpdates).length > 0) {
        userUpdates.updated_at = new Date().toISOString();
        const { error: userError } = await db(supabase)
          .from('users')
          .update(userUpdates)
          .eq('id', req.userId!);

        if (userError) throw userError;
      }

      const companyUpdates: Record<string, unknown> = {};
      if (body.company_name != null) companyUpdates.name = body.company_name;
      if (body.company_phone !== undefined) companyUpdates.phone = body.company_phone;
      if (body.company_location !== undefined) companyUpdates.location = body.company_location;
      if (body.logo_url !== undefined) companyUpdates.logo_url = body.logo_url;
      if (body.banner_url !== undefined) companyUpdates.banner_url = body.banner_url;
      if (body.inventory_model !== undefined) companyUpdates.inventory_model = body.inventory_model;
      if (body.tax_rate_percent !== undefined) companyUpdates.tax_rate_percent = body.tax_rate_percent;
      if (body.pos_discounts_enabled !== undefined) {
        companyUpdates.pos_discounts_enabled = body.pos_discounts_enabled;
      }
      if (body.pos_max_discount_percent !== undefined) {
        companyUpdates.pos_max_discount_percent = body.pos_max_discount_percent;
      }
      if (body.pos_quick_discounts !== undefined) {
        companyUpdates.pos_quick_discounts = body.pos_quick_discounts;
      }
      if (body.support_phone !== undefined) companyUpdates.support_phone = body.support_phone;
      if (body.support_email !== undefined) {
        companyUpdates.support_email =
          body.support_email === '' ? null : body.support_email;
      }

      if (Object.keys(companyUpdates).length > 0) {
        let updateResult = await db(supabase)
          .from('companies')
          .update(companyUpdates)
          .eq('id', companyId);

        if (updateResult.error?.code === '42703') {
          const {
            tax_rate_percent: _t,
            pos_discounts_enabled: _d,
            pos_max_discount_percent: _m,
            pos_quick_discounts: _q,
            support_phone: _sp,
            support_email: _se,
            logo_url: _l,
            banner_url: _b,
            inventory_model: _im,
            ...basic
          } = companyUpdates;
          if (Object.keys(basic).length > 0) {
            updateResult = await db(supabase)
              .from('companies')
              .update(basic)
              .eq('id', companyId);
          } else {
            throw new Error(
              'POS settings columns missing. Run FIX_company_pos_settings.sql in Supabase.',
            );
          }
        }

        if (updateResult.error) throw updateResult.error;
      }

      const companyFetch = await fetchCompanySettingsRow(supabase, companyId);
      const { data: company } = companyFetch;

      const { data: user } = await db(supabase)
        .from('users')
        .select('id, full_name, phone, address, role')
        .eq('id', req.userId!)
        .single();

      const { data: authUser } = await supabase.auth.admin.getUserById(req.userId!);
      const userRow = (user ?? {}) as Record<string, unknown>;

      return res.json({
        success: true,
        data: {
          user: {
            id: userRow.id,
            full_name: userRow.full_name ?? '',
            phone: userRow.phone ?? null,
            address: userRow.address ?? null,
            email: authUser?.user?.email ?? null,
            role: userRow.role,
          },
          company: mapCompanySettings((company ?? {}) as Record<string, unknown>),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to update settings'),
      });
    }
  },
);
