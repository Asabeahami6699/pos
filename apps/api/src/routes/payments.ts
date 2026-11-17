import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  generatePaystackReference,
  getPaystackPublicKey,
  initializePaystackTransaction,
  toKobo,
  verifyPaystackTransaction,
  computePlatformFeeAmount,
  resolvePlatformFeePercent,
} from '../lib/paystack.js';
import {
  reserveCheckoutStock,
  validateCheckoutStock,
  type CheckoutPayload,
} from '../services/shopOrders.js';
import { notifyCustomer } from '../lib/customerNotifications.js';

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

const checkoutItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
});

const checkoutPayloadSchema = z
  .object({
    idempotency_key: z.string().uuid(),
    company_id: z.string().uuid(),
    shipping_name: z.string().min(2),
    shipping_phone: z.string().min(6),
    shipping_address: z.string().optional(),
    fulfillment_type: z.enum(['delivery', 'pickup']).default('delivery'),
    address_id: z.string().uuid().optional(),
    notes: z.string().optional(),
    items: z.array(checkoutItemSchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment_type === 'delivery') {
      if (!data.shipping_address || data.shipping_address.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Delivery address is required',
          path: ['shipping_address'],
        });
      }
    }
  });

export const paymentsRouter = Router();

paymentsRouter.post('/initialize', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  const parsed = checkoutPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const data = parsed.data;
  const customerId = req.userId!;

  try {
    if (!getPaystackPublicKey()) {
      return res.status(503).json({ success: false, error: 'Paystack is not configured' });
    }

    const supabase = getSupabaseAdmin();

    const { data: existingTx } = await db(supabase)
      .from('payment_transactions')
      .select('*')
      .eq('idempotency_key', data.idempotency_key)
      .maybeSingle();

    if (existingTx?.status === 'success' && existingTx.order_id) {
      return res.json({
        success: true,
        already_paid: true,
        data: { order_id: existingTx.order_id, reference: existingTx.paystack_reference },
      });
    }

    if (existingTx?.status === 'pending') {
      return res.json({
        success: true,
        data: {
          reference: existingTx.paystack_reference,
          amount_kobo: existingTx.amount_kobo,
          public_key: getPaystackPublicKey(),
          email: req.userEmail,
        },
      });
    }

    const stockCheck = await validateCheckoutStock(supabase, data.company_id, data.items);
    if (!stockCheck.ok) {
      return res.status(409).json({ success: false, error: stockCheck.error });
    }

    const { data: company, error: companyError } = await db(supabase)
      .from('companies')
      .select(
        'paystack_subaccount_code, paystack_subaccount_status, platform_fee_percent, name',
      )
      .eq('id', data.company_id)
      .single();

    if (companyError || !company) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const subaccountCode = company?.paystack_subaccount_code as string | null;
    if (
      !subaccountCode ||
      company?.paystack_subaccount_status === 'none' ||
      company?.paystack_subaccount_status === 'error'
    ) {
      return res.status(422).json({
        success: false,
        error: `${(company?.name as string) ?? 'This store'} has not completed Paystack payout setup. Choose pay on delivery or try another store.`,
        code: 'PAYOUT_NOT_CONFIGURED',
      });
    }

    const feePercent = resolvePlatformFeePercent(
      company?.platform_fee_percent as number | null | undefined,
    );
    const platformFeeGhs = computePlatformFeeAmount(stockCheck.total, feePercent);
    const vendorAmountGhs = Math.round((stockCheck.total - platformFeeGhs) * 100) / 100;

    const checkoutPayload: CheckoutPayload = {
      company_id: data.company_id,
      shipping_name: data.shipping_name,
      shipping_phone: data.shipping_phone,
      shipping_address: data.shipping_address,
      fulfillment_type: data.fulfillment_type,
      address_id: data.address_id,
      payment_method: 'paystack',
      notes: data.notes,
      items: stockCheck.validatedItems,
    };

    const reference = generatePaystackReference();
    const amountKobo = toKobo(stockCheck.total);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    const paystackData = await initializePaystackTransaction({
      email: req.userEmail ?? `${customerId}@marketplace.local`,
      amountKobo,
      reference,
      callbackUrl: `${frontendUrl}/checkout?reference=${reference}`,
      metadata: {
        customer_id: customerId,
        company_id: data.company_id,
        idempotency_key: data.idempotency_key,
        platform_fee_percent: feePercent,
      },
      subaccount: subaccountCode,
      transactionChargeKobo: toKobo(platformFeeGhs),
      bearer: 'account',
    });

    const { data: insertedTx, error: insertError } = await db(supabase).from('payment_transactions').insert({
      customer_id: customerId,
      company_id: data.company_id,
      idempotency_key: data.idempotency_key,
      paystack_reference: reference,
      amount: stockCheck.total,
      amount_kobo: amountKobo,
      platform_fee: platformFeeGhs,
      vendor_amount: vendorAmountGhs,
      currency: 'GHS',
      status: 'pending',
      payment_method: 'paystack',
      checkout_payload: checkoutPayload,
    }).select('id').single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: dup } = await db(supabase)
          .from('payment_transactions')
          .select('paystack_reference, amount_kobo, order_id, status')
          .eq('idempotency_key', data.idempotency_key)
          .single();
        if (dup?.status === 'success' && dup.order_id) {
          return res.json({ success: true, already_paid: true, data: { order_id: dup.order_id } });
        }
        return res.json({
          success: true,
          data: {
            reference: dup.paystack_reference,
            amount_kobo: dup.amount_kobo,
            public_key: getPaystackPublicKey(),
            email: req.userEmail,
          },
        });
      }
      throw insertError;
    }

    if (insertedTx?.id) {
      await reserveCheckoutStock(
        supabase,
        data.company_id,
        stockCheck.validatedItems,
        insertedTx.id as string,
      );
    }

    return res.json({
      success: true,
      data: {
        reference: paystackData.reference,
        access_code: paystackData.access_code,
        authorization_url: paystackData.authorization_url,
        amount_kobo: amountKobo,
        public_key: getPaystackPublicKey(),
        email: req.userEmail,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Payment initialization failed'),
    });
  }
});

paymentsRouter.post('/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';
  if (!reference) {
    return res.status(400).json({ success: false, error: 'Payment reference required' });
  }

  try {
    const result = await completePaymentIfVerified(getSupabaseAdmin(), reference, req.userId!);
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: getErrorMessage(error, 'Payment verification failed'),
    });
  }
});

export async function completePaymentIfVerified(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  reference: string,
  customerId: string,
) {
  const { data: tx, error: txError } = await db(supabase)
    .from('payment_transactions')
    .select('*')
    .eq('paystack_reference', reference)
    .single();

  if (txError || !tx) {
    throw new Error('Payment transaction not found');
  }

  if (tx.customer_id !== customerId) {
    throw new Error('Unauthorized payment reference');
  }

  if (tx.status === 'success' && tx.order_id) {
    return { order_id: tx.order_id as string, reference, already_completed: true };
  }

  const verified = await verifyPaystackTransaction(reference);

  if (verified.status !== 'success') {
    await db(supabase)
      .from('payment_transactions')
      .update({ status: 'failed', paystack_response: verified, updated_at: new Date().toISOString() })
      .eq('id', tx.id);
    throw new Error('Payment was not successful');
  }

  if (verified.amount !== tx.amount_kobo) {
    throw new Error('Payment amount mismatch — contact support');
  }

  const payload = tx.checkout_payload as CheckoutPayload;

  const stockCheck = await validateCheckoutStock(supabase, payload.company_id, payload.items);
  if (!stockCheck.ok) {
    await db(supabase).rpc('release_checkout_reservations', {
      p_payment_transaction_id: tx.id,
    });
    throw new Error(stockCheck.error);
  }

  const { data: orderId, error: fulfillError } = await db(supabase).rpc('complete_payment_and_fulfill', {
    p_transaction_id: tx.id,
    p_customer_id: customerId,
    p_paystack_response: verified,
  });

  if (fulfillError) throw fulfillError;

  const fulfilledOrderId = String(orderId ?? '');
  if (fulfilledOrderId) {
    void notifyCustomer(supabase, customerId, {
      type: 'order',
      title: 'Payment received',
      body: 'Your order was paid successfully. We will notify you as it progresses.',
      link: `/orders/${fulfilledOrderId}/track`,
      metadata: { order_id: fulfilledOrderId, payment_reference: reference },
    });
  }

  return { order_id: orderId as string, reference };
}
