import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireActiveSubscription, type AuthenticatedRequest } from '../middleware/auth.js';

function db(supabase: ReturnType<typeof getSupabaseAdmin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

const registerSchema = z.object({
  company_id: z.string().uuid(),
  product_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        url: z.string().url(),
        media_type: z.enum(['image', 'video']),
        sort_order: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  cover_url: z.string().url().optional().nullable(),
});

const coverSchema = z.object({
  company_id: z.string().uuid(),
  product_id: z.string().uuid(),
  cover_url: z.string().url(),
});

async function assertCompanyProductAccess(
  req: AuthenticatedRequest,
  companyId: string,
  productId: string,
) {
  const staffRoles = ['company_admin', 'salesperson', 'super_admin'];
  if (!req.userRole || !staffRoles.includes(req.userRole)) {
    return { ok: false as const, status: 403, error: 'Staff access required' };
  }

  if (req.userRole !== 'super_admin' && req.companyId !== companyId) {
    return { ok: false as const, status: 403, error: 'Not allowed for this company' };
  }

  const supabase = getSupabaseAdmin();
  const { data: product, error } = await supabase
    .from('products')
    .select('id, company_id')
    .eq('id', productId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error || !product) {
    return { ok: false as const, status: 404, error: 'Product not found' };
  }

  return { ok: true as const };
}

export const productMediaRouter = Router();

/** Register uploaded storage URLs into product_media (service role) */
productMediaRouter.post('/', requireAuth, requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const { company_id, product_id, items, cover_url } = parsed.data;
  const access = await assertCompanyProductAccess(req, company_id, product_id);
  if (!access.ok) {
    return res.status(access.status).json({ success: false, error: access.error });
  }

  try {
    const supabase = getSupabaseAdmin();
    const rows = items.map((item) => ({
      product_id,
      company_id,
      url: item.url,
      media_type: item.media_type,
      sort_order: item.sort_order,
    }));

    const { error: insertError } = await db(supabase).from('product_media').insert(rows);
    if (insertError) throw insertError;

    const cover =
      cover_url && items.some((i) => i.url === cover_url && i.media_type === 'image')
        ? cover_url
        : cover_url && cover_url.startsWith('http') && !items.some((i) => i.url === cover_url)
          ? cover_url
          : items.find((i) => i.media_type === 'image')?.url ?? null;

    if (cover) {
      const { error: updateError } = await db(supabase)
        .from('products')
        .update({ image_url: cover })
        .eq('id', product_id)
        .eq('company_id', company_id);
      if (updateError) throw updateError;
    }

    return res.status(201).json({ success: true, data: { count: rows.length, cover_url: cover } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save product media',
    });
  }
});

/** Set marketplace cover / icon image */
productMediaRouter.patch('/cover', requireAuth, requireActiveSubscription, async (req: AuthenticatedRequest, res) => {
  const parsed = coverSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const { company_id, product_id, cover_url } = parsed.data;
  const access = await assertCompanyProductAccess(req, company_id, product_id);
  if (!access.ok) {
    return res.status(access.status).json({ success: false, error: access.error });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await db(supabase)
      .from('products')
      .update({ image_url: cover_url })
      .eq('id', product_id)
      .eq('company_id', company_id);

    if (error) throw error;
    return res.json({ success: true, data: { cover_url } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update cover image',
    });
  }
});
