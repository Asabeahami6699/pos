import webpush from 'web-push';
import type { getSupabaseAdmin } from './supabase.js';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

function db(supabase: SupabaseAdmin) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

let vapidConfigured = false;

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export function configureWebPush(): void {
  if (!isPushConfigured() || vapidConfigured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidConfigured = true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function sendPushToUser(
  supabase: SupabaseAdmin,
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!isPushConfigured()) return;
  configureWebPush();

  const { data: subs } = await db(supabase)
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs?.length) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
  });

  await Promise.allSettled(
    subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        await db(supabase)
          .from('push_subscriptions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: unknown) {
        const status = err && typeof err === 'object' && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 0;
        if (status === 404 || status === 410) {
          await db(supabase).from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }),
  );
}
