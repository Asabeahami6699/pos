import type { getSupabaseAdmin } from './supabase.js';
import { sendPushToUser } from './pushNotifications.js';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

/** Optional browser push — inbox is the in-app hub for seller messages. */
export async function notifyCustomer(
  supabase: SupabaseAdmin,
  customerId: string,
  payload: {
    title: string;
    body: string;
    link?: string;
  },
): Promise<void> {
  await sendPushToUser(supabase, customerId, {
    title: payload.title,
    body: payload.body,
    url: payload.link,
  });
}
