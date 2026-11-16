import { Router } from 'express';
import { z } from 'zod';
import {
  computePlanRenewalDate,
  normalizeSubscriptionPlan,
  subscriptionPlanBucket,
  SUBSCRIPTION_PLANS,
} from '@pos-inventory/shared';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  loadPlatformSettings,
  updatePlatformSettings,
} from '../lib/platformSettings.js';
import { evaluateSubscription } from '../lib/subscription.js';

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

export const superAdminRouter = Router();

superAdminRouter.use(requireAuth, requireRole('super_admin'));

superAdminRouter.get('/overview', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const [
      { count: totalCompanies },
      { count: activeCompanies },
      { count: suspendedCompanies },
      { count: expiringSoon },
      { count: expiredCompanies },
      { count: paystackConnected },
      { count: onlineOrders },
      { data: recentPayments },
      platformSettings,
    ] = await Promise.all([
      db(supabase).from('companies').select('*', { count: 'exact', head: true }),
      db(supabase).from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db(supabase).from('companies').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
      db(supabase)
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .lte('plan_renewal_at', weekFromNow.toISOString())
        .gt('plan_renewal_at', now.toISOString()),
      db(supabase).from('companies').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
      db(supabase)
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('paystack_subaccount_status', 'active'),
      db(supabase).from('online_orders').select('*', { count: 'exact', head: true }),
      db(supabase)
        .from('payment_transactions')
        .select('amount, platform_fee, status')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(500),
      loadPlatformSettings(),
    ]);

    const payments = (recentPayments ?? []) as Array<{ amount: number; platform_fee?: number }>;
    const totalGmv = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const totalPlatformFees = payments.reduce((sum, p) => sum + Number(p.platform_fee ?? 0), 0);

    return res.json({
      success: true,
      data: {
        total_companies: totalCompanies ?? 0,
        active_companies: activeCompanies ?? 0,
        suspended_companies: suspendedCompanies ?? 0,
        expiring_soon: expiringSoon ?? 0,
        expired_companies: expiredCompanies ?? 0,
        paystack_connected: paystackConnected ?? 0,
        online_orders: onlineOrders ?? 0,
        marketplace_gmv: Math.round(totalGmv * 100) / 100,
        platform_fees_collected: Math.round(totalPlatformFees * 100) / 100,
        platform_fee_percent: platformSettings.platform_fee_percent,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load overview'),
    });
  }
});

superAdminRouter.get('/analytics', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      { data: companies },
      { data: orders },
      { data: payments },
      { data: sales },
    ] = await Promise.all([
      db(supabase)
        .from('companies')
        .select('id, name, plan, status, plan_renewal_at, paystack_subaccount_status, platform_fee_percent, created_at'),
      db(supabase)
        .from('online_orders')
        .select('id, company_id, total, status, payment_method, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString()),
      db(supabase)
        .from('payment_transactions')
        .select('company_id, amount, platform_fee, vendor_amount, status, created_at')
        .eq('status', 'success')
        .gte('created_at', thirtyDaysAgo.toISOString()),
      db(supabase)
        .from('sales')
        .select('company_id, total, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString()),
    ]);

    const companyRows = (companies ?? []) as Array<Record<string, unknown>>;
    const orderRows = (orders ?? []) as Array<Record<string, unknown>>;
    const paymentRows = (payments ?? []) as Array<Record<string, unknown>>;
    const salesRows = (sales ?? []) as Array<Record<string, unknown>>;

    const planBreakdown = SUBSCRIPTION_PLANS.map((plan) => ({
      plan,
      count: companyRows.filter((c) => subscriptionPlanBucket(String(c.plan)) === plan).length,
    }));

    const statusBreakdown = ['active', 'suspended', 'expired'].map((status) => ({
      status,
      count: companyRows.filter((c) => c.status === status).length,
    }));

    const ordersByDay = new Map<string, { count: number; revenue: number }>();
    for (const order of orderRows) {
      const day = String(order.created_at).slice(0, 10);
      const entry = ordersByDay.get(day) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += Number(order.total ?? 0);
      ordersByDay.set(day, entry);
    }

    const onlineTrend = [...ordersByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, orders: v.count, revenue: Math.round(v.revenue * 100) / 100 }));

    const topCompaniesByOnline = companyRows
      .map((c) => {
        const cid = String(c.id);
        const companyOrders = orderRows.filter((o) => o.company_id === cid);
        const companyPayments = paymentRows.filter((p) => p.company_id === cid);
        return {
          company_id: cid,
          name: String(c.name),
          plan: String(c.plan),
          online_orders: companyOrders.length,
          online_revenue: Math.round(companyOrders.reduce((s, o) => s + Number(o.total ?? 0), 0) * 100) / 100,
          pos_revenue: Math.round(salesRows.filter((s) => s.company_id === cid).reduce((sum, s) => sum + Number(s.total ?? 0), 0) * 100) / 100,
          platform_fees: Math.round(companyPayments.reduce((s, p) => s + Number(p.platform_fee ?? 0), 0) * 100) / 100,
          paystack_status: String(c.paystack_subaccount_status ?? 'none'),
        };
      })
      .sort((a, b) => b.online_revenue - a.online_revenue)
      .slice(0, 10);

    return res.json({
      success: true,
      data: {
        plan_breakdown: planBreakdown,
        status_breakdown: statusBreakdown,
        online_trend: onlineTrend,
        top_companies: topCompaniesByOnline,
        totals: {
          online_orders_30d: orderRows.length,
          online_revenue_30d: Math.round(orderRows.reduce((s, o) => s + Number(o.total ?? 0), 0) * 100) / 100,
          platform_fees_30d: Math.round(paymentRows.reduce((s, p) => s + Number(p.platform_fee ?? 0), 0) * 100) / 100,
          pos_sales_30d: Math.round(salesRows.reduce((s, row) => s + Number(row.total ?? 0), 0) * 100) / 100,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load analytics'),
    });
  }
});

superAdminRouter.get('/platform-settings', async (_req, res) => {
  try {
    const settings = await loadPlatformSettings();
    return res.json({
      success: true,
      data: {
        ...settings,
        env_fallback: {
          platform_fee_percent: Number(process.env.PLATFORM_FEE_PERCENT ?? 5),
          support_email: process.env.PLATFORM_SUPPORT_EMAIL ?? null,
          support_phone: process.env.PLATFORM_SUPPORT_PHONE ?? null,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load platform settings'),
    });
  }
});

const platformSettingsSchema = z.object({
  platform_fee_percent: z.number().min(0).max(50).optional(),
  support_email: z.string().email().nullable().optional(),
  support_phone: z.string().min(6).nullable().optional(),
});

superAdminRouter.patch('/platform-settings', async (req, res) => {
  const parsed = platformSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  if (
    parsed.data.platform_fee_percent == null &&
    parsed.data.support_email === undefined &&
    parsed.data.support_phone === undefined
  ) {
    return res.status(400).json({ success: false, error: 'No settings to update' });
  }

  try {
    const settings = await updatePlatformSettings(parsed.data);
    return res.json({ success: true, data: settings });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: getErrorMessage(error, 'Failed to update platform settings'),
    });
  }
});

superAdminRouter.get('/companies', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('companies')
      .select(
        'id, name, phone, location, plan, status, created_at, plan_started_at, plan_renewal_at, platform_fee_percent, paystack_subaccount_code, paystack_subaccount_status, payout_account_name, payout_contact_email, payout_contact_phone',
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const companyIds = rows.map((row) => String(row.id));

    const adminMap = new Map<string, { id: string; full_name: string | null }>();
    if (companyIds.length > 0) {
      const { data: adminUsers } = await db(supabase)
        .from('users')
        .select('id, company_id, full_name')
        .eq('role', 'company_admin')
        .in('company_id', companyIds);

      for (const admin of (adminUsers ?? []) as Array<{
        id: string;
        company_id: string;
        full_name: string | null;
      }>) {
        if (admin.company_id && !adminMap.has(admin.company_id)) {
          adminMap.set(admin.company_id, { id: admin.id, full_name: admin.full_name });
        }
      }
    }

    const adminEmailMap = new Map<string, string>();
    await Promise.all(
      [...adminMap.entries()].map(async ([companyId, admin]) => {
        const { data: authData } = await supabase.auth.admin.getUserById(admin.id);
        const email = authData?.user?.email;
        if (email) adminEmailMap.set(companyId, email);
      }),
    );

    const enriched = rows.map((row) => {
      const companyId = String(row.id);
      const admin = adminMap.get(companyId);
      const adminEmail = adminEmailMap.get(companyId) ?? null;
      const payoutEmail = row.payout_contact_email as string | null;
      const payoutPhone = row.payout_contact_phone as string | null;

      return {
        ...row,
        admin_name: admin?.full_name ?? null,
        admin_email: adminEmail,
        contact_email: payoutEmail ?? adminEmail,
        contact_phone: (row.phone as string | null) ?? payoutPhone,
        subscription: evaluateSubscription({
          plan: String(row.plan),
          status: String(row.status),
          plan_started_at: row.plan_started_at as string | null,
          plan_renewal_at: row.plan_renewal_at as string | null,
        }),
      };
    });

    return res.json({ success: true, data: enriched });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to list companies'),
    });
  }
});

const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  plan: z.enum(['trial', 'six_month', 'yearly', 'basic', 'premium']).optional(),
  platform_fee_percent: z.number().min(0).max(50).nullable().optional(),
  plan_started_at: z.string().datetime().optional(),
  plan_renewal_at: z.string().datetime().optional(),
  extend_plan: z.boolean().optional(),
});

superAdminRouter.patch('/companies/:id', async (req, res) => {
  const parsed = updateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: fetchError } = await db(supabase)
      .from('companies')
      .select('id, plan, plan_started_at, plan_renewal_at, status')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name != null) updates.name = parsed.data.name;
    if (parsed.data.phone != null) updates.phone = parsed.data.phone;
    if (parsed.data.location != null) updates.location = parsed.data.location;
    if (parsed.data.platform_fee_percent !== undefined) {
      updates.platform_fee_percent = parsed.data.platform_fee_percent;
    }
    if (parsed.data.plan_started_at != null) updates.plan_started_at = parsed.data.plan_started_at;

    const nextPlan = parsed.data.plan != null
      ? normalizeSubscriptionPlan(parsed.data.plan)
      : normalizeSubscriptionPlan(String(existing.plan));
    if (parsed.data.plan != null) updates.plan = nextPlan;

    if (parsed.data.extend_plan) {
      const base = existing.plan_renewal_at ? new Date(existing.plan_renewal_at) : new Date();
      const startFrom = base.getTime() > Date.now() ? base : new Date();
      updates.plan_renewal_at = computePlanRenewalDate(nextPlan, startFrom).toISOString();
      updates.status = 'active';
    } else if (parsed.data.plan_renewal_at != null) {
      updates.plan_renewal_at = parsed.data.plan_renewal_at;
    } else if (parsed.data.plan != null && parsed.data.plan !== existing.plan) {
      updates.plan_renewal_at = computePlanRenewalDate(nextPlan, new Date()).toISOString();
      updates.plan_started_at = new Date().toISOString();
    }

    const { data, error } = await db(supabase)
      .from('companies')
      .update(updates)
      .eq('id', req.params.id)
      .select(
        'id, name, phone, location, plan, status, plan_started_at, plan_renewal_at, platform_fee_percent, paystack_subaccount_status',
      )
      .single();

    if (error) throw error;

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: getErrorMessage(error, 'Failed to update company'),
    });
  }
});

const statusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

superAdminRouter.patch('/companies/:id/status', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('companies')
      .update({ status: parsed.data.status })
      .eq('id', req.params.id)
      .select('id, name, status')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Company not found' });

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: getErrorMessage(error, 'Failed to update company status'),
    });
  }
});

superAdminRouter.delete('/companies/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const companyId = req.params.id;

    const { data: staff, error: staffError } = await db(supabase)
      .from('users')
      .select('id')
      .eq('company_id', companyId);

    if (staffError) throw staffError;

    const { error: deleteError } = await db(supabase).from('companies').delete().eq('id', companyId);
    if (deleteError) throw deleteError;

    for (const user of (staff ?? []) as Array<{ id: string }>) {
      await supabase.auth.admin.deleteUser(user.id).catch(() => undefined);
    }

    return res.json({ success: true, data: { deleted: companyId } });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: getErrorMessage(error, 'Failed to delete company'),
    });
  }
});

export const subscriptionRouter = Router();

subscriptionRouter.get(
  '/subscription',
  requireAuth,
  requireRole('company_admin', 'salesperson'),
  async (req: AuthenticatedRequest, res) => {
    if (!req.companyId) {
      return res.status(403).json({ success: false, error: 'Company context required' });
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data: company, error } = await db(supabase)
        .from('companies')
        .select('id, name, plan, status, plan_started_at, plan_renewal_at')
        .eq('id', req.companyId)
        .single();

      if (error || !company) {
        return res.status(404).json({ success: false, error: 'Company not found' });
      }

      const row = company as {
        id: string;
        name: string;
        plan: string;
        status: string;
        plan_started_at: string | null;
        plan_renewal_at: string | null;
      };

      const renewalMs = row.plan_renewal_at ? new Date(row.plan_renewal_at).getTime() : null;
      if (row.status === 'active' && renewalMs != null && renewalMs < Date.now()) {
        await db(supabase).from('companies').update({ status: 'expired' }).eq('id', row.id);
        row.status = 'expired';
      }

      const subscription = evaluateSubscription(row);
      const platformSettings = await loadPlatformSettings();

      return res.json({
        success: true,
        data: {
          company_name: row.name,
          ...subscription,
          support_email: platformSettings.support_email,
          support_phone: platformSettings.support_phone,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to load subscription'),
      });
    }
  },
);
