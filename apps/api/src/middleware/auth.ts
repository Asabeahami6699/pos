import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@pos-inventory/shared';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { evaluateSubscription } from '../lib/subscription.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
  companyId?: string | null;
  /** Set when a super_admin scopes into a tenant via X-Acting-Company-Id */
  actingAsCompanyId?: string | null;
}

function readActingCompanyHeader(req: Request): string | null {
  const raw = req.headers['x-acting-company-id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing authorization token' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ success: false, error: 'User profile not found' });
    }

    req.userId = user.id;
    req.userEmail = user.email ?? undefined;
    req.userRole = profile.role as UserRole;
    req.companyId = profile.company_id;
    req.actingAsCompanyId = null;

    // Super-admin tenant impersonation: scope company context without changing their user row
    if (profile.role === 'super_admin') {
      const actingId = readActingCompanyHeader(req);
      if (actingId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: company, error: companyError } = await (supabase as any)
          .from('companies')
          .select('id')
          .eq('id', actingId)
          .maybeSingle();

        if (companyError || !company) {
          return res.status(403).json({
            success: false,
            error: 'Invalid acting company context',
          });
        }

        req.companyId = actingId;
        req.actingAsCompanyId = actingId;

        // Audit mutating impersonated API calls (enter/exit logged separately)
        const method = req.method.toUpperCase();
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          void dbInsertTenantAccessLog(supabase, {
            actor_user_id: user.id,
            company_id: actingId,
            action: 'api',
            path: `${method} ${req.originalUrl.split('?')[0]}`,
          });
        }
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
}

async function dbInsertTenantAccessLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  row: {
    actor_user_id: string;
    company_id: string;
    action: 'enter' | 'exit' | 'api';
    path: string;
  },
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('tenant_access_logs').insert({
      ...row,
      meta: {},
    });
  } catch {
    // Never block the request on audit failure
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    if (allowedRoles.includes(req.userRole)) {
      return next();
    }

    // Super admin scoped into a tenant may use company_admin endpoints
    if (
      req.userRole === 'super_admin' &&
      req.actingAsCompanyId &&
      allowedRoles.includes('company_admin')
    ) {
      return next();
    }

    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  };
}

export async function requireActiveSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.userRole === 'super_admin' || req.userRole === 'customer') {
    return next();
  }

  if (!req.companyId) {
    return next();
  }

  try {
    const supabase = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: company, error } = await (supabase as any)
      .from('companies')
      .select('plan, status, plan_started_at, plan_renewal_at')
      .eq('id', req.companyId)
      .single();

    if (error || !company) {
      return res.status(403).json({ success: false, error: 'Company not found' });
    }

    const subscription = evaluateSubscription({
      plan: company.plan as string,
      status: company.status as string,
      plan_started_at: (company.plan_started_at as string | null) ?? null,
      plan_renewal_at: (company.plan_renewal_at as string | null) ?? null,
    });
    if (subscription.access === 'locked') {
      return res.status(402).json({
        success: false,
        error: subscription.lock_reason ?? 'Subscription inactive',
        code: 'SUBSCRIPTION_LOCKED',
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Subscription check failed',
    });
  }
}
