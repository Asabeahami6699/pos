import { Router } from 'express';
import { z } from 'zod';
import type { CreateCompanyPayload } from '@pos-inventory/shared';
import { computePlanRenewalDate, normalizeSubscriptionPlan } from '@pos-inventory/shared';
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

export const companiesRouter = Router();

const createCompanySchema = z.object({
  companyName: z.string().min(2),
  phone: z.string().optional(),
  location: z.string().optional(),
  plan: z.string().default('trial'),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminFullName: z.string().min(2),
});

companiesRouter.post('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const payload: CreateCompanyPayload = parsed.data;

  try {
    const supabase = getSupabaseAdmin();
    const plan = normalizeSubscriptionPlan(payload.plan);
    const planStartedAt = new Date();
    const planRenewalAt = computePlanRenewalDate(plan, planStartedAt);

    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .insert([{
        name: payload.companyName,
        phone: payload.phone,
        location: payload.location,
        plan,
        status: 'active',
        plan_started_at: planStartedAt.toISOString(),
        plan_renewal_at: planRenewalAt.toISOString(),
      }])
      .select()
      .single();

    if (companyError || !companyData) {
      throw companyError ?? new Error('Failed to create company');
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: payload.adminEmail,
      password: payload.adminPassword,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      await supabase.from('companies').delete().eq('id', companyData.id);
      throw authError ?? new Error('Failed to create admin user');
    }

    const { error: userError } = await supabase.from('users').insert([{
      id: authData.user.id,
      company_id: companyData.id,
      role: 'company_admin',
      full_name: payload.adminFullName,
    }]);

    if (userError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('companies').delete().eq('id', companyData.id);
      throw userError;
    }

    return res.status(201).json({
      success: true,
      data: { companyId: companyData.id, userId: authData.user.id },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});
