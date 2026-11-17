import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  fulfillOnlineOrder,
  validateCheckoutStock,
  type CheckoutPayload,
} from '../services/shopOrders.js';
import { fetchSellableStockMap, stockForProduct } from '../lib/inventoryModel.js';

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

function requireCustomer(req: AuthenticatedRequest, res: import('express').Response): boolean {
  if (req.userRole !== 'customer') {
    res.status(403).json({ success: false, error: 'Customer account required' });
    return false;
  }
  return true;
}

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive(),
});

const baseOrderFields = {
  company_id: z.string().uuid(),
  shipping_name: z.string().min(2),
  shipping_phone: z.string().min(6),
  shipping_address: z.string().optional(),
  fulfillment_type: z.enum(['delivery', 'pickup']).default('delivery'),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
  promo_code: z.string().optional(),
  shipping_fee: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
};

function computeEstimatedDelivery(fulfillmentType: string): string {
  const d = new Date();
  d.setDate(d.getDate() + (fulfillmentType === 'pickup' ? 1 : 3));
  return d.toISOString().slice(0, 10);
}

export async function validatePromoCode(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  code: string,
  companyId: string,
  subtotal: number,
): Promise<{ ok: true; discount: number; promo: { code: string; description: string | null } } | { ok: false; error: string }> {
  const normalized = code.trim().toUpperCase();
  const { data: promo, error } = await db(supabase)
    .from('promo_codes')
    .select('*')
    .eq('code', normalized)
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .eq('active', true)
    .maybeSingle();

  if (error || !promo) return { ok: false, error: 'Invalid promo code' };
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { ok: false, error: 'Promo code expired' };
  }
  if (promo.max_uses != null && promo.used_count >= promo.max_uses) {
    return { ok: false, error: 'Promo code limit reached' };
  }
  if (subtotal < Number(promo.min_order_amount ?? 0)) {
    return { ok: false, error: `Minimum order ₵${promo.min_order_amount} required` };
  }

  const discount =
    promo.discount_type === 'fixed'
      ? Math.min(subtotal, Number(promo.discount_value))
      : Math.round(subtotal * (Number(promo.discount_value) / 100) * 100) / 100;

  return {
    ok: true,
    discount,
    promo: { code: promo.code, description: promo.description ?? null },
  };
}

export const marketplaceFeaturesRouter = Router();

/** Search suggestions */
marketplaceFeaturesRouter.get('/search/suggest', async (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  if (q.length < 2) return res.json({ success: true, data: [] });

  try {
    const supabase = getSupabaseAdmin();
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, company_id, companies(name)')
      .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
      .limit(8);

    const suggestions = (products ?? []).map((p) => ({
      type: 'product' as const,
      id: p.id,
      label: p.name,
      company_id: p.company_id,
      company_name: (p as { companies?: { name: string } }).companies?.name ?? 'Store',
    }));

    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', `%${q}%`)
      .limit(4);

    const storeSuggestions = (companies ?? []).map((c) => ({
      type: 'store' as const,
      id: c.id,
      label: c.name,
    }));

    return res.json({ success: true, data: [...suggestions, ...storeSuggestions].slice(0, 10) });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Search failed') });
  }
});

/** Shipping estimate */
marketplaceFeaturesRouter.get('/shipping/estimate', (req, res) => {
  const region = String(req.query.region ?? '').toLowerCase();
  const subtotal = Number(req.query.subtotal ?? 0);
  const fulfillment = String(req.query.fulfillment ?? 'delivery');

  if (fulfillment === 'pickup') {
    return res.json({ success: true, data: { fee: 0, estimated_days: 1 } });
  }

  let fee = 15;
  if (region.includes('accra') || region.includes('tema')) fee = 12;
  else if (region.includes('kumasi')) fee = 18;
  else if (subtotal >= 200) fee = 10;

  return res.json({
    success: true,
    data: { fee, estimated_days: 3, free_over: 500 },
  });
});

/** Validate promo */
marketplaceFeaturesRouter.post('/promo/validate', async (req, res) => {
  const parsed = z
    .object({
      code: z.string().min(2),
      company_id: z.string().uuid(),
      subtotal: z.number().positive(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  try {
    const supabase = getSupabaseAdmin();
    const result = await validatePromoCode(
      supabase,
      parsed.data.code,
      parsed.data.company_id,
      parsed.data.subtotal,
    );
    if (!result.ok) return res.status(400).json({ success: false, error: result.error });
    return res.json({ success: true, data: { discount: result.discount, promo: result.promo } });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Promo validation failed') });
  }
});

/** Wishlist */
marketplaceFeaturesRouter.get('/wishlist', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!requireCustomer(req, res)) return;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('customer_wishlists')
      .select('*, products(*), companies(id, name)')
      .eq('customer_id', req.userId!)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed to load wishlist') });
  }
});

marketplaceFeaturesRouter.post('/wishlist', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!requireCustomer(req, res)) return;
  const parsed = z
    .object({ product_id: z.string().uuid(), company_id: z.string().uuid() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('customer_wishlists')
      .upsert(
        {
          customer_id: req.userId!,
          product_id: parsed.data.product_id,
          company_id: parsed.data.company_id,
        },
        { onConflict: 'customer_id,product_id' },
      )
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed to add wishlist') });
  }
});

marketplaceFeaturesRouter.delete(
  '/wishlist/:productId',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    if (!requireCustomer(req, res)) return;
    try {
      const supabase = getSupabaseAdmin();
      const { error } = await db(supabase)
        .from('customer_wishlists')
        .delete()
        .eq('customer_id', req.userId!)
        .eq('product_id', req.params.productId);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed to remove') });
    }
  },
);

/** Product view tracking */
marketplaceFeaturesRouter.post('/views', async (req, res) => {
  const parsed = z
    .object({
      product_id: z.string().uuid(),
      company_id: z.string().uuid(),
      session_id: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });

  try {
    const supabase = getSupabaseAdmin();
    let customerId: string | null = null;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      customerId = user?.id ?? null;
    }
    await db(supabase).from('product_view_events').insert({
      customer_id: customerId,
      session_id: parsed.data.session_id ?? null,
      product_id: parsed.data.product_id,
      company_id: parsed.data.company_id,
    });
    return res.status(201).json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

/** Recently viewed products */
marketplaceFeaturesRouter.get('/recommendations/recent', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : null;
    let customerId: string | null = null;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      customerId = user?.id ?? null;
    }
    if (!customerId && !sessionId) return res.json({ success: true, data: [] });

    let query = db(supabase)
      .from('product_view_events')
      .select('product_id, company_id, viewed_at')
      .order('viewed_at', { ascending: false })
      .limit(12);

    if (customerId) query = query.eq('customer_id', customerId);
    else query = query.eq('session_id', sessionId);

    const { data: views } = await query;
    const unique = new Map<string, { product_id: string; company_id: string }>();
    for (const v of views ?? []) {
      const key = `${v.company_id}:${v.product_id}`;
      if (!unique.has(key)) unique.set(key, v);
    }

    const companyIds = [...new Set([...unique.values()].map((v) => v.company_id))];
    const stockMap = await fetchSellableStockMap(supabase, companyIds);
    const products = [];
    for (const v of unique.values()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from('products').select('*').eq('id', v.product_id);
      let { data: p, error } = await q.eq('is_online_listing', true).maybeSingle();
      if (error && String(error.message || '').includes('is_online_listing')) {
        const retry = await supabase.from('products').select('*').eq('id', v.product_id).maybeSingle();
        p = retry.data;
      }
      if (!p) continue;
      const stock = stockForProduct(stockMap, v.company_id, v.product_id);
      products.push({
        ...p,
        company_id: v.company_id,
        stock,
        in_stock: stock > 0,
      });
    }
    return res.json({ success: true, data: products });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed') });
  }
});

/** Related products (same category) */
marketplaceFeaturesRouter.get('/recommendations/related/:companyId/:productId', async (req, res) => {
  const { companyId, productId } = req.params;
  try {
    const supabase = getSupabaseAdmin();
    const { data: product } = await supabase
      .from('products')
      .select('category')
      .eq('id', productId)
      .eq('company_id', companyId)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .neq('id', productId)
      .limit(6);

    if (product?.category) query = query.eq('category', product.category);

    let { data, error: relatedError } = await query.eq('is_online_listing', true);
    if (relatedError && String(relatedError.message || '').includes('is_online_listing')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fallback: any = supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .neq('id', productId)
        .limit(6);
      if (product?.category) fallback = fallback.eq('category', product.category);
      const retry = await fallback;
      data = retry.data;
    }
    const stockMap = await fetchSellableStockMap(supabase, [companyId]);
    const enriched = ((data ?? []) as Array<Record<string, unknown> & { id: string }>).map((p) => {
      const stock = stockForProduct(stockMap, companyId, p.id);
      return { ...p, stock, in_stock: stock > 0 };
    });
    return res.json({ success: true, data: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed') });
  }
});

/** Seller ratings */
marketplaceFeaturesRouter.get('/companies/:companyId/seller-ratings', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('seller_ratings')
      .select('rating, comment, created_at, users(full_name)')
      .eq('company_id', req.params.companyId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;

    const ratings = data ?? [];
    const avg =
      ratings.length > 0
        ? ratings.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / ratings.length
        : 0;

    return res.json({
      success: true,
      data: { average_rating: avg, rating_count: ratings.length, ratings },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed') });
  }
});

marketplaceFeaturesRouter.post(
  '/companies/:companyId/seller-ratings',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    if (!requireCustomer(req, res)) return;
    const parsed = z
      .object({ rating: z.number().int().min(1).max(5), comment: z.string().max(500).optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });

    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await db(supabase)
        .from('seller_ratings')
        .upsert(
          {
            company_id: req.params.companyId,
            customer_id: req.userId!,
            rating: parsed.data.rating,
            comment: parsed.data.comment ?? null,
          },
          { onConflict: 'company_id,customer_id' },
        )
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed') });
    }
  },
);

/** Abandoned cart snapshot */
marketplaceFeaturesRouter.post('/cart/abandoned', async (req, res) => {
  const parsed = z
    .object({
      session_id: z.string().optional(),
      email: z.string().email().optional(),
      cart: z.array(z.unknown()),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });

  try {
    const supabase = getSupabaseAdmin();
    let customerId: string | null = null;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      customerId = user?.id ?? null;
    }

    const row = {
      customer_id: customerId,
      session_id: parsed.data.session_id ?? null,
      email: parsed.data.email ?? null,
      cart_json: parsed.data.cart,
      last_updated: new Date().toISOString(),
    };

    if (customerId) {
      await db(supabase)
        .from('abandoned_cart_snapshots')
        .upsert(row, { onConflict: 'customer_id' });
    } else if (parsed.data.session_id) {
      const { data: existing } = await db(supabase)
        .from('abandoned_cart_snapshots')
        .select('id')
        .eq('session_id', parsed.data.session_id)
        .maybeSingle();
      if (existing?.id) {
        await db(supabase).from('abandoned_cart_snapshots').update(row).eq('id', existing.id);
      } else {
        await db(supabase).from('abandoned_cart_snapshots').insert(row);
      }
    }

    return res.json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

/** Guest checkout (pay on delivery only) */
const guestOrderSchema = z
  .object({
    ...baseOrderFields,
    guest_email: z.string().email(),
    payment_method: z.literal('pay_on_delivery'),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment_type === 'delivery' && (!data.shipping_address || data.shipping_address.length < 5)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Delivery address required', path: ['shipping_address'] });
    }
  });

marketplaceFeaturesRouter.post('/orders/guest', async (req, res) => {
  const parsed = guestOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });

  const data = parsed.data;
  try {
    const supabase = getSupabaseAdmin();
    const stockCheck = await validateCheckoutStock(supabase, data.company_id, data.items);
    if (!stockCheck.ok) return res.status(409).json({ success: false, error: stockCheck.error });

    let discount = data.discount_amount ?? 0;
    if (data.promo_code) {
      const promo = await validatePromoCode(supabase, data.promo_code, data.company_id, stockCheck.total);
      if (!promo.ok) return res.status(400).json({ success: false, error: promo.error });
      discount = promo.discount;
    }

    const shippingFee = data.shipping_fee ?? 0;
    const total = Math.max(0, stockCheck.total - discount + shippingFee);
    const guestToken = randomUUID();

    const payload: CheckoutPayload = {
      company_id: data.company_id,
      shipping_name: data.shipping_name,
      shipping_phone: data.shipping_phone,
      shipping_address: data.shipping_address,
      fulfillment_type: data.fulfillment_type,
      payment_method: 'pay_on_delivery',
      notes: data.notes,
      items: stockCheck.validatedItems,
    };

    const order = await fulfillOnlineOrder(supabase, null, payload, {
      paymentStatus: 'pending',
      paymentMethod: 'pay_on_delivery',
      guestEmail: data.guest_email,
      guestPhone: data.shipping_phone,
      guestOrderToken: guestToken,
      shippingFee,
      discountAmount: discount,
      promoCode: data.promo_code ?? null,
      estimatedDeliveryDate: computeEstimatedDelivery(data.fulfillment_type),
    });

    return res.status(201).json({
      success: true,
      data: { ...order, guest_order_token: guestToken },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Order failed') });
  }
});

/** Order tracking (customer auth or guest token) */
marketplaceFeaturesRouter.get('/orders/:orderId/tracking', async (req, res) => {
  const orderId = req.params.orderId;
  const guestToken = typeof req.query.token === 'string' ? req.query.token : null;

  try {
    const supabase = getSupabaseAdmin();
    let orderQuery = db(supabase)
      .from('online_orders')
      .select('*, companies(name), online_order_items(*)')
      .eq('id', orderId);

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) orderQuery = orderQuery.eq('customer_id', user.id);
      else if (guestToken) orderQuery = orderQuery.eq('guest_order_token', guestToken);
      else return res.status(401).json({ success: false, error: 'Unauthorized' });
    } else if (guestToken) {
      orderQuery = orderQuery.eq('guest_order_token', guestToken);
    } else {
      return res.status(401).json({ success: false, error: 'Login or tracking token required' });
    }

    const { data: order, error } = await orderQuery.single();
    if (error || !order) return res.status(404).json({ success: false, error: 'Order not found' });

    const { data: events } = await db(supabase)
      .from('order_tracking_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    return res.json({ success: true, data: { order, events: events ?? [] } });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed') });
  }
});

/** Return requests */
marketplaceFeaturesRouter.post('/returns', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!requireCustomer(req, res)) return;
  const parsed = z
    .object({
      order_id: z.string().uuid(),
      reason: z.string().min(5),
      items: z.array(
        z.object({
          product_id: z.string().uuid(),
          quantity: z.number().int().positive(),
        }),
      ),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });

  try {
    const supabase = getSupabaseAdmin();
    const { data: order } = await db(supabase)
      .from('online_orders')
      .select('id, company_id, customer_id, status')
      .eq('id', parsed.data.order_id)
      .eq('customer_id', req.userId!)
      .single();

    const orderRow = order as { id: string; company_id: string; status: string } | null;
    if (!orderRow) return res.status(404).json({ success: false, error: 'Order not found' });
    if (!['delivered', 'shipped', 'processing', 'confirmed'].includes(orderRow.status)) {
      return res.status(400).json({ success: false, error: 'Order not eligible for return' });
    }

    const { data, error } = await db(supabase)
      .from('return_requests')
      .insert({
        order_id: parsed.data.order_id,
        customer_id: req.userId!,
        company_id: orderRow.company_id,
        reason: parsed.data.reason,
        items: parsed.data.items,
      })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Return request failed') });
  }
});

marketplaceFeaturesRouter.get('/returns', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!requireCustomer(req, res)) return;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('return_requests')
      .select('*, online_orders(id, total, status)')
      .eq('customer_id', req.userId!)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed') });
  }
});

/** Loyalty points */
marketplaceFeaturesRouter.get('/loyalty', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!requireCustomer(req, res)) return;
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await db(supabase)
      .from('customer_loyalty_points')
      .select('*')
      .eq('customer_id', req.userId!)
      .maybeSingle();
    return res.json({
      success: true,
      data: data ?? { points: 0, lifetime_points: 0 },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: getErrorMessage(error, 'Failed') });
  }
});
