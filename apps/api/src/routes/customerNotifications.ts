import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { getVapidPublicKey, isPushConfigured } from '../lib/pushNotifications.js';

function db(supabase: ReturnType<typeof getSupabaseAdmin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

function requireCustomer(req: AuthenticatedRequest, res: import('express').Response): boolean {
  if (req.userRole !== 'customer') {
    res.status(403).json({ success: false, error: 'Customer account required' });
    return false;
  }
  return true;
}

export const customerNotificationsRouter = Router();

customerNotificationsRouter.get('/push/vapid-public-key', (_req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.json({ success: true, data: { configured: false, publicKey: null } });
  }
  return res.json({ success: true, data: { configured: true, publicKey } });
});

customerNotificationsRouter.get('/push/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!requireCustomer(req, res)) return;
  try {
    const supabase = getSupabaseAdmin();
    const { count } = await db(supabase)
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.userId!);
    return res.json({
      success: true,
      data: { configured: isPushConfigured(), subscribed: (count ?? 0) > 0 },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed') });
  }
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  user_agent: z.string().optional(),
});

customerNotificationsRouter.post('/push/subscribe', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!requireCustomer(req, res)) return;
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await db(supabase).from('push_subscriptions').upsert(
      {
        user_id: req.userId!,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: parsed.data.user_agent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Subscribe failed') });
  }
});

customerNotificationsRouter.delete('/push/subscribe', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!requireCustomer(req, res)) return;
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : null;

  try {
    const supabase = getSupabaseAdmin();
    let query = db(supabase).from('push_subscriptions').delete().eq('user_id', req.userId!);
    if (endpoint) query = query.eq('endpoint', endpoint);
    const { error } = await query;
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Unsubscribe failed') });
  }
});

/** In-app marketplace notifications (order updates, returns, chat) */
customerNotificationsRouter.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!requireCustomer(req, res)) return;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('customer_notifications')
      .select('*')
      .eq('customer_id', req.userId!)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      if (String(error.message || '').includes('customer_notifications')) {
        return res.json({ success: true, data: [] });
      }
      throw error;
    }
    return res.json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load notifications'),
    });
  }
});

customerNotificationsRouter.get(
  '/notifications/unread-count',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    if (!requireCustomer(req, res)) return;
    try {
      const supabase = getSupabaseAdmin();
      const { count, error } = await db(supabase)
        .from('customer_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', req.userId!)
        .eq('read', false);
      if (error) {
        if (String(error.message || '').includes('customer_notifications')) {
          return res.json({ success: true, data: { count: 0 } });
        }
        throw error;
      }
      return res.json({ success: true, data: { count: count ?? 0 } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to count notifications'),
      });
    }
  },
);

customerNotificationsRouter.patch(
  '/notifications/:id/read',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    if (!requireCustomer(req, res)) return;
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await db(supabase)
        .from('customer_notifications')
        .update({ read: true })
        .eq('id', req.params.id)
        .eq('customer_id', req.userId!);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to mark notification read'),
      });
    }
  },
);

customerNotificationsRouter.post(
  '/notifications/read-all',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    if (!requireCustomer(req, res)) return;
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await db(supabase)
        .from('customer_notifications')
        .update({ read: true })
        .eq('customer_id', req.userId!)
        .eq('read', false);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to mark all read'),
      });
    }
  },
);
