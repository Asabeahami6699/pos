import type { getSupabaseAdmin } from '../lib/supabase.js';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

function db(supabase: SupabaseAdmin) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

export type CheckoutItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
};

export type CheckoutPayload = {
  company_id: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address?: string;
  fulfillment_type: 'delivery' | 'pickup';
  address_id?: string;
  payment_method: string;
  notes?: string;
  items: CheckoutItem[];
};

export async function validateCheckoutStock(
  supabase: SupabaseAdmin,
  companyId: string,
  items: CheckoutItem[],
): Promise<{ ok: true; total: number; validatedItems: CheckoutItem[] } | { ok: false; error: string }> {
  let total = 0;
  const validatedItems: CheckoutItem[] = [];

  for (const item of items) {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price')
      .eq('id', item.product_id)
      .eq('company_id', companyId)
      .single();

    if (productError || !product) {
      return { ok: false, error: `Product not found: ${item.product_name}` };
    }

    const serverPrice = Number(product.price);
    if (Math.abs(serverPrice - item.unit_price) > 0.01) {
      return { ok: false, error: `Price changed for ${product.name}. Refresh and try again.` };
    }

    const { data: availableQty, error: qtyError } = await db(supabase).rpc('get_available_warehouse_qty', {
      p_company_id: companyId,
      p_product_id: item.product_id,
    });

    if (qtyError) {
      const { data: sellableQty, error: sellableError } = await db(supabase).rpc('get_sellable_qty', {
        p_company_id: companyId,
        p_product_id: item.product_id,
      });

      if (sellableError) {
        const { data: wh } = await supabase
          .from('warehouse_inventory')
          .select('quantity')
          .eq('company_id', companyId)
          .eq('product_id', item.product_id)
          .maybeSingle();
        const available = wh?.quantity ?? 0;
        if (available < item.quantity) {
          return { ok: false, error: `Insufficient stock for ${product.name}` };
        }
      } else if ((sellableQty ?? 0) < item.quantity) {
        return { ok: false, error: `Insufficient stock for ${product.name}` };
      }
    } else if ((availableQty ?? 0) < item.quantity) {
      return { ok: false, error: `Insufficient stock for ${product.name}` };
    }

    total += serverPrice * item.quantity;
    validatedItems.push({
      product_id: item.product_id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price: serverPrice,
    });
  }

  return { ok: true, total, validatedItems };
}

export async function reserveCheckoutStock(
  supabase: SupabaseAdmin,
  companyId: string,
  items: CheckoutItem[],
  paymentTransactionId: string,
): Promise<void> {
  const { error } = await db(supabase).rpc('reserve_checkout_stock', {
    p_company_id: companyId,
    p_items: items,
    p_payment_transaction_id: paymentTransactionId,
    p_ttl_minutes: 15,
  });
  if (error) throw error;
}

export async function fulfillOnlineOrder(
  supabase: SupabaseAdmin,
  customerId: string | null,
  payload: CheckoutPayload,
  options: {
    paymentStatus: string;
    paymentMethod: string;
    paystackReference?: string | null;
    paymentTransactionId?: string | null;
    platformFee?: number;
    guestEmail?: string | null;
    guestPhone?: string | null;
    guestOrderToken?: string | null;
    shippingFee?: number;
    discountAmount?: number;
    promoCode?: string | null;
    estimatedDeliveryDate?: string | null;
  },
): Promise<{ id: string }> {
  const shippingAddress =
    payload.fulfillment_type === 'pickup'
      ? 'Store pickup'
      : (payload.shipping_address?.trim() ?? '');

  const itemsTotal = payload.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const total = Math.max(
    0,
    itemsTotal - (options.discountAmount ?? 0) + (options.shippingFee ?? 0),
  );

  const { data: orderId, error } = await db(supabase).rpc('fulfill_online_order', {
    p_customer_id: customerId,
    p_company_id: payload.company_id,
    p_total: total,
    p_shipping_name: payload.shipping_name,
    p_shipping_phone: payload.shipping_phone,
    p_shipping_address: shippingAddress,
    p_fulfillment_type: payload.fulfillment_type,
    p_payment_method: options.paymentMethod,
    p_payment_status: options.paymentStatus,
    p_items: payload.items,
    p_paystack_reference: options.paystackReference ?? null,
    p_payment_transaction_id: options.paymentTransactionId ?? null,
    p_platform_fee: options.platformFee ?? 0,
    p_address_id: payload.address_id ?? null,
    p_notes: payload.notes ?? null,
    p_guest_email: options.guestEmail ?? null,
    p_guest_phone: options.guestPhone ?? null,
    p_guest_order_token: options.guestOrderToken ?? null,
    p_shipping_fee: options.shippingFee ?? 0,
    p_discount_amount: options.discountAmount ?? 0,
    p_promo_code: options.promoCode ?? null,
    p_estimated_delivery_date: options.estimatedDeliveryDate ?? null,
  });

  if (error) throw error;
  return { id: orderId as string };
}
