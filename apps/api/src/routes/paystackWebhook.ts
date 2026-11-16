import type { Request, Response } from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { verifyPaystackWebhookSignature } from '../lib/paystack.js';
import { completePaymentIfVerified } from './payments.js';

function db(supabase: ReturnType<typeof getSupabaseAdmin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

/** Paystack webhook — must use express.raw() middleware */
export async function paystackWebhookHandler(req: Request, res: Response) {
  const signature = req.headers['x-paystack-signature'] as string | undefined;
  const rawBody = req.body as Buffer;

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  try {
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      data: { reference?: string; status?: string };
    };

    if (event.event !== 'charge.success' || !event.data?.reference) {
      return res.json({ success: true, received: true });
    }

    const supabase = getSupabaseAdmin();
    const { data: tx } = await db(supabase)
      .from('payment_transactions')
      .select('customer_id, status, order_id')
      .eq('paystack_reference', event.data.reference)
      .maybeSingle();

    if (!tx || tx.status === 'success') {
      return res.json({ success: true });
    }

    await completePaymentIfVerified(supabase, event.data.reference, tx.customer_id as string);
    return res.json({ success: true });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return res.status(500).json({ success: false });
  }
}
