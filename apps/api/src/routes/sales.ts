import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole, requireActiveSubscription, type AuthenticatedRequest } from '../middleware/auth.js';

export const salesRouter = Router();

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      const details =
        'details' in error && typeof (error as { details: unknown }).details === 'string'
          ? (error as { details: string }).details
          : null;
      return details ? `${message} (${details})` : message;
    }
  }
  return fallback;
}

const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  original_price: z.number().nonnegative().optional(),
  wholesale_price: z.number().nonnegative().nullish(),
});

function formatZodError(error: z.ZodError): string {
  const flat = error.flatten();
  const parts = [...flat.formErrors];
  for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
    if (msgs?.length) parts.push(`${field}: ${msgs.join(', ')}`);
  }
  return parts.join('; ') || 'Validation failed';
}

const createSaleSchema = z.object({
  id: z.string().uuid(),
  branch_id: z.string().uuid(),
  company_id: z.string().uuid(),
  total: z.number().nonnegative(),
  payment_method: z.enum(['cash', 'mobile_money', 'card', 'split']),
  payment_received: z.number().nonnegative(),
  change_given: z.number().nonnegative().optional(),
  payment_notes: z.string().optional(),
  sales_type: z.enum(['retail', 'wholesale']),
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  items: z.array(saleItemSchema).min(1),
  created_at: z.string().datetime().optional(),
});

salesRouter.post('/', requireAuth, requireRole('salesperson', 'company_admin'), requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  const parsed = createSaleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: formatZodError(parsed.error) });
  }

  const data = parsed.data;
  const userId = req.userId!;

  if (req.companyId && req.companyId !== data.company_id) {
    return res.status(403).json({ success: false, error: 'Company mismatch' });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: existing } = await supabase
      .from('sales')
      .select('id, company_id, branch_id, salesperson_id, total, created_at, sales_type')
      .eq('id', data.id)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ success: true, data: existing, idempotent: true });
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('id, company_id')
      .eq('id', data.branch_id)
      .single();

    if (!branch || branch.company_id !== data.company_id) {
      return res.status(400).json({ success: false, error: 'Invalid branch for company' });
    }

    for (const item of data.items) {
      const { data: inv, error: invError } = await supabase
        .from('branch_inventory')
        .select('quantity, retail_quantity, wholesale_quantity')
        .eq('branch_id', data.branch_id)
        .eq('product_id', item.product_id)
        .maybeSingle();

      if (invError) throw invError;

      const available = inv?.quantity ?? 0;
      if (available < item.quantity) {
        return res.status(409).json({
          success: false,
          error: `Insufficient stock for product ${item.product_id} (need ${item.quantity}, have ${available})`,
        });
      }
    }

    const createdAt = data.created_at ?? new Date().toISOString();
    const changeGiven = data.change_given ?? Math.max(0, data.payment_received - data.total);

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        id: data.id,
        company_id: data.company_id,
        branch_id: data.branch_id,
        salesperson_id: userId,
        total: data.total,
        payment_method: data.payment_method,
        payment_received: data.payment_received,
        change_given: changeGiven,
        payment_notes: data.payment_notes ?? null,
        sales_type: data.sales_type,
        customer_name: data.customer_name ?? null,
        customer_phone: data.customer_phone ?? null,
        created_at: createdAt,
      })
      .select()
      .single();

    if (saleError) throw saleError;

    const saleItems = data.items.map((item) => ({
      sale_id: data.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
      original_price: item.original_price ?? item.price,
      wholesale_price: item.wholesale_price ?? null,
      sales_type: data.sales_type,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
    if (itemsError) {
      await supabase.from('sales').delete().eq('id', data.id);
      throw itemsError;
    }

    for (const item of data.items) {
      const { data: inv } = await supabase
        .from('branch_inventory')
        .select('quantity, retail_quantity, wholesale_quantity')
        .eq('branch_id', data.branch_id)
        .eq('product_id', item.product_id)
        .single();

      if (!inv) continue;

      const newQty = (inv.quantity ?? 0) - item.quantity;
      const updates: Record<string, unknown> = {
        quantity: newQty,
        last_updated: new Date().toISOString(),
      };

      if (data.sales_type === 'retail' && inv.retail_quantity != null) {
        updates.retail_quantity = Math.max(0, (inv.retail_quantity ?? 0) - item.quantity);
      }
      if (data.sales_type === 'wholesale' && inv.wholesale_quantity != null) {
        updates.wholesale_quantity = Math.max(0, (inv.wholesale_quantity ?? 0) - item.quantity);
      }

      const { error: stockError } = await supabase
        .from('branch_inventory')
        .update(updates)
        .eq('branch_id', data.branch_id)
        .eq('product_id', item.product_id);

      if (stockError) throw stockError;
    }

    return res.status(201).json({ success: true, data: sale });
  } catch (error) {
    console.error('Sale processing error:', error);
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to process sale'),
    });
  }
});

const returnItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const createReturnSchema = z.object({
  sale_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  company_id: z.string().uuid(),
  reason: z.string().min(3),
  sales_type: z.enum(['retail', 'wholesale']).default('retail'),
  items: z.array(returnItemSchema).min(1),
});

salesRouter.post('/returns', requireAuth, requireRole('salesperson', 'company_admin'), requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  const parsed = createReturnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: formatZodError(parsed.error) });
  }

  const data = parsed.data;
  const userId = req.userId!;

  if (req.companyId && req.companyId !== data.company_id) {
    return res.status(403).json({ success: false, error: 'Company mismatch' });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { data: sale } = await supabase
      .from('sales')
      .select('id, company_id, branch_id')
      .eq('id', data.sale_id)
      .single();

    if (!sale || sale.company_id !== data.company_id || sale.branch_id !== data.branch_id) {
      return res.status(400).json({ success: false, error: 'Invalid sale for return' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: returnId, error } = await (supabase as any).rpc('process_pos_return', {
      p_sale_id: data.sale_id,
      p_branch_id: data.branch_id,
      p_company_id: data.company_id,
      p_salesperson_id: userId,
      p_reason: data.reason,
      p_items: data.items,
      p_sales_type: data.sales_type,
    });

    if (error) throw error;

    return res.status(201).json({ success: true, data: { id: returnId } });
  } catch (error) {
    console.error('Return processing error:', error);
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to process return'),
    });
  }
});
