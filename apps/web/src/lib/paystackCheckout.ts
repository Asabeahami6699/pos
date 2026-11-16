declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: PaystackPopOptions) => { openIframe: () => void };
    };
  }
}

export interface PaystackPopOptions {
  key: string;
  email: string;
  amount: number;
  ref: string;
  currency?: string;
  onClose: () => void;
  callback: (response: { reference: string; status: string }) => void;
}

const PAYSTACK_SCRIPT = 'https://js.paystack.co/v1/inline.js';

let scriptPromise: Promise<void> | null = null;

export function loadPaystackScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PAYSTACK_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = PAYSTACK_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export async function openPaystackCheckout(options: PaystackPopOptions): Promise<string> {
  await loadPaystackScript();

  if (!window.PaystackPop) {
    throw new Error('Paystack is unavailable');
  }

  return new Promise((resolve, reject) => {
    const handler = window.PaystackPop!.setup({
      ...options,
      onClose: () => {
        options.onClose();
        reject(new Error('Payment cancelled'));
      },
      callback: (response) => {
        options.callback(response);
        resolve(response.reference);
      },
    });
    handler.openIframe();
  });
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
