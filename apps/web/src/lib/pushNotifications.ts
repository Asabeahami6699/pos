import { shopApi } from './shopApi';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function getPushStatus(): Promise<{ configured: boolean; subscribed: boolean }> {
  try {
    const res = await shopApi.getPushStatus();
    return res.data;
  } catch {
    return { configured: false, subscribed: false };
  }
}

export async function subscribeToPush(): Promise<'granted' | 'denied' | 'unsupported' | 'unconfigured'> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }

  const keyRes = await shopApi.getVapidPublicKey();
  if (!keyRes.data.configured || !keyRes.data.publicKey) {
    return 'unconfigured';
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const registration = await registerServiceWorker();
  if (!registration) return 'unsupported';

  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Invalid push subscription');
  }

  await shopApi.subscribePush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    user_agent: navigator.userAgent,
  });

  return 'granted';
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration) {
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await shopApi.unsubscribePush({ endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } else {
    await shopApi.unsubscribePush({});
  }
}
