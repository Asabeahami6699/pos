import type { getSupabaseAdmin } from './supabase.js';
import { sendPushToUser } from './pushNotifications.js';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

function db(supabase: SupabaseAdmin) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

/** Persist in-app notification + optional browser push. */
export async function notifyCustomer(
  supabase: SupabaseAdmin,
  customerId: string,
  payload: {
    title: string;
    body: string;
    link?: string;
    type?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const type = payload.type ?? 'order';

  try {
    const { error } = await db(supabase).from('customer_notifications').insert({
      customer_id: customerId,
      type,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      metadata: payload.metadata ?? {},
      read: false,
    });
    if (error) {
      console.warn('customer_notifications insert failed:', error.message);
    }
  } catch (e) {
    console.warn('customer_notifications insert error:', e);
  }

  try {
    await sendPushToUser(supabase, customerId, {
      title: payload.title,
      body: payload.body,
      url: payload.link,
    });
  } catch (e) {
    console.warn('customer push failed:', e);
  }
}
