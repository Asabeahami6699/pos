import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  fulfillOnlineOrder,
  validateCheckoutStock,
  type CheckoutPayload,
} from '../services/shopOrders.js';
import { decryptChatMessage, decryptChatMessages, encryptChatMessage } from '../lib/chatCrypto.js';
import { refundPaystackTransaction } from '../lib/paystack.js';
import { requireActiveSubscription } from '../middleware/auth.js';
import { fetchSellableStockMap, stockForProduct } from '../lib/inventoryModel.js';
import { validatePromoCode } from './marketplaceFeatures.js';
import { notifyCustomer } from '../lib/customerNotifications.js';

/** Untyped access for tables not yet in generated Database types */
function db(supabase: ReturnType<typeof getSupabaseAdmin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

const PRODUCT_CORE_SELECT =
  'id, name, sku, price, category, company_id, low_stock_threshold';

const PRODUCT_COLUMN_CANDIDATES = [
  `${PRODUCT_CORE_SELECT}, description, image_url, is_online_listing, marketplace_listing`,
  `${PRODUCT_CORE_SELECT}, description, image_url, is_online_listing`,
  `${PRODUCT_CORE_SELECT}, description, image_url, marketplace_listing`,
  `${PRODUCT_CORE_SELECT}, description, image_url`,
  `${PRODUCT_CORE_SELECT}, description`,
  `${PRODUCT_CORE_SELECT}, image_url`,
  PRODUCT_CORE_SELECT,
];

type MarketplaceListingPayload = {
  variations?: string[];
  size_guide?: string;
  key_highlights?: string[];
  specifications?: string;
  key_features?: string;
  weight_kg?: number | null;
  product_details?: string;
};

type ShopProductRow = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  category: string | null;
  company_id: string | null;
  low_stock_threshold: number | null;
  image_url: string | null;
  description: string | null;
  is_online_listing: boolean;
  marketplace_listing: MarketplaceListingPayload | null;
};

function parseMarketplaceListing(raw: unknown): MarketplaceListingPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const listing: MarketplaceListingPayload = {};

  if (Array.isArray(o.variations)) {
    listing.variations = o.variations.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }
  if (typeof o.size_guide === 'string' && o.size_guide.trim()) listing.size_guide = o.size_guide.trim();
  if (Array.isArray(o.key_highlights)) {
    listing.key_highlights = o.key_highlights.filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    );
  }
  if (typeof o.specifications === 'string' && o.specifications.trim()) {
    listing.specifications = o.specifications.trim();
  }
  if (typeof o.key_features === 'string' && o.key_features.trim()) {
    listing.key_features = o.key_features.trim();
  }
  if (typeof o.weight_kg === 'number' && !Number.isNaN(o.weight_kg)) listing.weight_kg = o.weight_kg;
  if (typeof o.product_details === 'string' && o.product_details.trim()) {
    listing.product_details = o.product_details.trim();
  }

  return Object.keys(listing).length > 0 ? listing : null;
}

function isOptionalProductColumnError(error: { code?: string; message?: string } | null) {
  return (
    isMissingColumnError(error, 'description') ||
    isMissingColumnError(error, 'image_url') ||
    isMissingColumnError(error, 'is_online_listing') ||
    isMissingColumnError(error, 'marketplace_listing')
  );
}

function orderNumberFromId(orderId: string): string {
  return String(orderId).replace(/-/g, '').slice(-8).toUpperCase();
}

/** Mix barcode/SKU with order number — e.g. PEAK123-A1B2C3D4 */
function buildProductTrackingNumber(orderId: string, barcodeOrSku?: string | null): string {
  const orderNo = orderNumberFromId(orderId);
  const code = String(barcodeOrSku ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!code) return `ORD-${orderNo}`;
  return `${code}-${orderNo}`;
}

async function attachOrderItemBarcodes(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orders: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const productIds = new Set<string>();
  for (const order of orders) {
    const items = (order.online_order_items as Array<{ product_id?: string }> | undefined) ?? [];
    for (const item of items) {
      if (item.product_id) productIds.add(item.product_id);
    }
  }
  if (productIds.size === 0) return orders;

  let { data: products, error } = await db(supabase)
    .from('products')
    .select('id, sku, barcode')
    .in('id', [...productIds]);

  if (error && isMissingColumnError(error, 'barcode')) {
    const fallback = await db(supabase)
      .from('products')
      .select('id, sku')
      .in('id', [...productIds]);
    products = (fallback.data ?? []).map((p: { id: string; sku: string | null }) => ({
      ...p,
      barcode: null,
    }));
    error = fallback.error;
  }
  if (error) throw error;

  const productMap = new Map(
    (products ?? []).map((p: { id: string; sku?: string | null; barcode?: string | null }) => [
      p.id,
      p,
    ]),
  );

  return orders.map((order) => {
    const items = (order.online_order_items as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      ...order,
      online_order_items: items.map((item) => {
        const product = productMap.get(String(item.product_id ?? ''));
        return {
          ...item,
          barcode: product?.barcode ?? null,
          sku: product?.sku ?? (item.sku as string | null | undefined) ?? null,
        };
      }),
    };
  });
}

function trackingCodeFromItems(
  items?: Array<{ barcode?: string | null; sku?: string | null }>,
): string | null {
  if (!items?.length) return null;
  const codes = items
    .map((item) => (item.barcode || item.sku || '').trim())
    .filter(Boolean);
  const unique = [...new Set(codes.map((c) => c.toUpperCase()))];
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];
  return unique.slice(0, 3).join('+');
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function isMissingColumnError(error: { code?: string; message?: string } | null, column: string) {
  return error?.code === '42703' && (error.message?.includes(column) ?? false);
}

const COMPANY_PUBLIC_BASE = 'id, name, location, phone, status';
const COMPANY_PUBLIC_BRANDING = `${COMPANY_PUBLIC_BASE}, logo_url, banner_url`;
const COMPANY_LIST_BASE = 'id, name, location, phone, plan, status, created_at';
const COMPANY_LIST_BRANDING = `${COMPANY_LIST_BASE}, logo_url, banner_url`;

async function fetchShopCompany(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
) {
  let result = await db(supabase)
    .from('companies')
    .select(COMPANY_PUBLIC_BRANDING)
    .eq('id', companyId)
    .single();

  if (isMissingColumnError(result.error, 'logo_url')) {
    result = await db(supabase)
      .from('companies')
      .select(COMPANY_PUBLIC_BASE)
      .eq('id', companyId)
      .single();
  }

  return result;
}

async function fetchShopCompaniesList(supabase: ReturnType<typeof getSupabaseAdmin>) {
  let result = await db(supabase)
    .from('companies')
    .select(COMPANY_LIST_BRANDING)
    .or('status.eq.active,status.is.null,status.eq.Active')
    .order('name');

  if (isMissingColumnError(result.error, 'logo_url')) {
    result = await db(supabase)
      .from('companies')
      .select(COMPANY_LIST_BASE)
      .or('status.eq.active,status.is.null,status.eq.Active')
      .order('name');
  }

  return result;
}

function normalizeProductRow(row: Record<string, unknown>): ShopProductRow {
  return {
    id: row.id as string,
    name: row.name as string,
    sku: (row.sku as string | null) ?? null,
    price: row.price as number,
    category: (row.category as string | null) ?? null,
    company_id: (row.company_id as string | null) ?? null,
    low_stock_threshold: (row.low_stock_threshold as number | null) ?? null,
    image_url: (row.image_url as string | null | undefined) ?? null,
    description: (row.description as string | null | undefined) ?? null,
    is_online_listing: Boolean(row.is_online_listing),
    marketplace_listing: parseMarketplaceListing(row.marketplace_listing),
  };
}

/** Select products; retries without image_url if migration not applied yet */
async function fetchShopProducts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  filter: {
    companyId?: string;
    companyIds?: string[];
    productId?: string;
    single?: boolean;
    /** Public marketplace only — defaults true */
    listedOnly?: boolean;
  },
): Promise<ShopProductRow | ShopProductRow[]> {
  const PAGE_SIZE = 1000;
  const listedOnly = filter.listedOnly !== false;

  const buildQuery = (columns: string, range?: { from: number; to: number }) => {
    let query = db(supabase).from('products').select(columns);
    if (filter.companyId) query = query.eq('company_id', filter.companyId);
    if (filter.companyIds?.length) query = query.in('company_id', filter.companyIds);
    if (filter.productId) query = query.eq('id', filter.productId);
    if (listedOnly) query = query.eq('is_online_listing', true);
    if (filter.single) return query.single();
    query = query.order('name');
    if (range) query = query.range(range.from, range.to);
    return query;
  };

  const fetchColumns = async (columns: string) => {
    if (filter.single) {
      const result = await buildQuery(columns);
      return result;
    }

    const allRows: Array<Record<string, unknown>> = [];
    let from = 0;

    while (true) {
      const result = await buildQuery(columns, { from, to: from + PAGE_SIZE - 1 });
      if (result.error) return result;

      const batch = (result.data ?? []) as Array<Record<string, unknown>>;
      allRows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return { data: allRows, error: null };
  };

  let result: { data: unknown; error: { code?: string; message?: string } | null } = {
    data: null,
    error: null,
  };

  for (const columns of PRODUCT_COLUMN_CANDIDATES) {
    result = await fetchColumns(columns);
    if (!result.error) break;
    // Column may be missing from SELECT *or* from the listedOnly filter
    if (
      isMissingColumnError(result.error, 'is_online_listing') &&
      listedOnly
    ) {
      // Retry once without marketplace gate if migration not applied yet
      const ungated = await fetchShopProducts(supabase, { ...filter, listedOnly: false });
      return ungated;
    }
    if (!isOptionalProductColumnError(result.error)) {
      break;
    }
  }

  if (result.error) throw result.error;

  if (filter.single) {
    return normalizeProductRow(result.data as Record<string, unknown>);
  }
  return ((result.data ?? []) as Array<Record<string, unknown>>).map(normalizeProductRow);
}

export const shopRouter = Router();

/** Public: list marketplace stores (active companies) */
shopRouter.get('/companies', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await fetchShopCompaniesList(supabase);

    if (error) throw error;

    const companies = data ?? [];
    const withCounts = await Promise.all(
      companies.map(async (company: { id: string }) => {
        let countQuery = supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('is_online_listing', true);
        let { count, error: countError } = await countQuery;
        if (countError && isMissingColumnError(countError, 'is_online_listing')) {
          const fallback = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', company.id);
          count = fallback.count;
        }
        return { ...company, product_count: count ?? 0 };
      }),
    );

    return res.json({ success: true, data: withCounts });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load stores'),
    });
  }
});

/** Public: products for a store with warehouse stock */
shopRouter.get('/companies/:companyId/products', async (req, res) => {
  const { companyId } = req.params;

  try {
    const supabase = getSupabaseAdmin();

    const { data: company, error: companyError } = await fetchShopCompany(supabase, companyId);

    if (companyError || !company) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const productRows = (await fetchShopProducts(supabase, { companyId })) as ShopProductRow[];

    const stockMap = await fetchSellableStockMap(supabase, [companyId]);

    const productIds = productRows.map((p) => p.id);
    const mediaMap = await attachProductMedia(supabase, productIds);

    const catalog = productRows.map((p) => {
      const stock = stockForProduct(stockMap, companyId, p.id);
      return enrichProduct(
        {
          ...p,
          stock,
          in_stock: stock > 0,
        } as ShopProductRow & { stock: number; in_stock: boolean },
        mediaMap,
      );
    });

    return res.json({ success: true, data: { company, products: catalog } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load products'),
    });
  }
});

async function attachRatingSummaries(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  productIds: string[],
) {
  if (productIds.length === 0) return new Map<string, { average_rating: number; rating_count: number }>();

  try {
    const { data: ratings, error } = await db(supabase)
      .from('product_ratings')
      .select('product_id, rating')
      .in('product_id', productIds);

    if (error) return new Map<string, { average_rating: number; rating_count: number }>();

    const map = new Map<string, { sum: number; count: number }>();
    ((ratings ?? []) as unknown as Array<{ product_id: string; rating: number }>).forEach((row) => {
      const current = map.get(row.product_id) ?? { sum: 0, count: 0 };
      map.set(row.product_id, { sum: current.sum + row.rating, count: current.count + 1 });
    });

    const summaries = new Map<string, { average_rating: number; rating_count: number }>();
    map.forEach((value, productId) => {
      summaries.set(productId, {
        average_rating: value.count ? value.sum / value.count : 0,
        rating_count: value.count,
      });
    });
    return summaries;
  } catch {
    return new Map<string, { average_rating: number; rating_count: number }>();
  }
}

export type ProductMediaItem = {
  id: string;
  url: string;
  media_type: 'image' | 'video';
  sort_order: number;
};

async function attachProductMedia(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  productIds: string[],
) {
  if (productIds.length === 0) return new Map<string, ProductMediaItem[]>();

  try {
    const { data, error } = await db(supabase)
      .from('product_media')
      .select('id, product_id, url, media_type, sort_order')
      .in('product_id', productIds)
      .order('sort_order');

    if (error) return new Map<string, ProductMediaItem[]>();

    const map = new Map<string, ProductMediaItem[]>();
    ((data ?? []) as unknown as Array<ProductMediaItem & { product_id: string }>).forEach((row) => {
      const list = map.get(row.product_id) ?? [];
      list.push({
        id: row.id,
        url: row.url,
        media_type: row.media_type,
        sort_order: row.sort_order,
      });
      map.set(row.product_id, list);
    });
    return map;
  } catch {
    return new Map<string, ProductMediaItem[]>();
  }
}

function enrichProduct<T extends ShopProductRow>(
  product: T,
  mediaMap: Map<string, ProductMediaItem[]>,
): T & { media: ProductMediaItem[] } {
  const media = mediaMap.get(product.id) ?? [];
  const firstImage =
    media.find((m) => m.media_type === 'image')?.url ?? product.image_url ?? null;
  return { ...product, media, image_url: firstImage };
}

/** Public: all marketplace products across stores */
shopRouter.get('/products', async (req, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  try {
    const supabase = getSupabaseAdmin();

    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, location, status')
      .or('status.eq.active,status.is.null,status.eq.Active');

    if (companiesError) throw companiesError;

    const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));
    const companyIds = [...companyMap.keys()];
    if (companyIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const productRows = (await fetchShopProducts(supabase, {
      companyIds,
    })) as ShopProductRow[];

    const stockMap = await fetchSellableStockMap(supabase, companyIds);

    const productIds = productRows.map((p) => p.id);
    const ratingSummaries = await attachRatingSummaries(supabase, productIds);
    const mediaMap = await attachProductMedia(supabase, productIds);

    let catalog = productRows.map((p) => {
      const company = p.company_id ? companyMap.get(p.company_id) : null;
      const stock = stockForProduct(stockMap, p.company_id, p.id);
      const ratings = ratingSummaries.get(p.id) ?? { average_rating: 0, rating_count: 0 };
      return enrichProduct(
        {
          ...p,
          stock,
          in_stock: stock > 0,
          company_name: company?.name ?? 'Store',
          average_rating: ratings.average_rating,
          rating_count: ratings.rating_count,
        } as ShopProductRow & {
          stock: number;
          in_stock: boolean;
          company_name: string;
          average_rating: number;
          rating_count: number;
        },
        mediaMap,
      );
    });

    if (search) {
      catalog = catalog.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          (p.sku ?? '').toLowerCase().includes(search) ||
          p.company_name.toLowerCase().includes(search),
      );
    }

    return res.json({ success: true, data: catalog });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load products'),
    });
  }
});

/** Public: single product detail with ratings */
shopRouter.get('/companies/:companyId/products/:productId', async (req, res) => {
  const { companyId, productId } = req.params;

  try {
    const supabase = getSupabaseAdmin();

    const { data: company, error: companyError } = await fetchShopCompany(supabase, companyId);

    if (companyError || !company) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    let productRow: ShopProductRow;
    try {
      // Detail by ID: allow fetch even if listing flag lags behind catalog feeds
      productRow = (await fetchShopProducts(supabase, {
        companyId,
        productId,
        single: true,
        listedOnly: false,
      })) as ShopProductRow;
    } catch {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Prefer listed products publicly; still serve if present for this store
    // (promo/recommendation feeds may surface a product before listing is synced)

    const stockMap = await fetchSellableStockMap(supabase, [companyId]);
    const stock = stockForProduct(stockMap, companyId, productId);

    const ratingSummaries = await attachRatingSummaries(supabase, [productId]);
    const summary = ratingSummaries.get(productId) ?? { average_rating: 0, rating_count: 0 };
    const mediaMap = await attachProductMedia(supabase, [productId]);
    const enriched = enrichProduct(productRow, mediaMap);

    const { data: ratings } = await db(supabase)
      .from('product_ratings')
      .select('id, rating, comment, created_at, users(full_name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(20);

    const ratingList = (ratings ?? []) as unknown as Array<{
      id: string;
      rating: number;
      comment: string | null;
      created_at: string;
      users?: { full_name: string | null };
    }>;

    return res.json({
      success: true,
      data: {
        company,
        product: {
          ...enriched,
          stock,
          in_stock: stock > 0,
          company_name: company.name,
          average_rating: summary.average_rating,
          rating_count: summary.rating_count,
        },
        ratings: ratingList.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          customer_name: r.users?.full_name ?? 'Customer',
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load product',
    });
  }
});

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/** Authenticated customer: rate a product */
shopRouter.post(
  '/companies/:companyId/products/:productId/ratings',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    if (req.userRole !== 'customer') {
      return res.status(403).json({ success: false, error: 'Customer account required' });
    }

    const parsed = ratingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const { companyId, productId } = req.params;
    const cId = String(companyId);
    const pId = String(productId);

    try {
      const supabase = getSupabaseAdmin();

      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('id', pId)
        .eq('company_id', cId)
        .maybeSingle();

      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      const { data, error } = await db(supabase)
        .from('product_ratings')
        .upsert(
          {
            product_id: pId,
            company_id: cId,
            customer_id: req.userId!,
            rating: parsed.data.rating,
            comment: parsed.data.comment ?? null,
          } as Record<string, unknown>,
          { onConflict: 'product_id,customer_id' },
        )
        .select()
        .single();

      if (error) {
        if (error.message.includes('product_ratings')) {
          return res.status(503).json({
            success: false,
            error: 'Ratings table not configured. Run migration 20250620120000_product_ratings.sql',
          });
        }
        throw error;
      }

      return res.status(201).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit rating',
      });
    }
  },
);

/** Track product clicks for personalized promotions */
const clickSchema = z.object({
  product_id: z.string().uuid(),
  company_id: z.string().uuid(),
  category: z.string().optional(),
  session_id: z.string().min(8).optional(),
});

shopRouter.post('/clicks', async (req, res) => {
  const parsed = clickSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  try {
    const supabase = getSupabaseAdmin();
    let customerId: string | null = null;

    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      customerId = user?.id ?? null;
    }

    await db(supabase).from('product_click_events').insert({
      customer_id: customerId,
      session_id: parsed.data.session_id ?? null,
      product_id: parsed.data.product_id,
      company_id: parsed.data.company_id,
      category: parsed.data.category ?? null,
    });

    return res.status(201).json({ success: true });
  } catch {
    return res.json({ success: true });
  }
});

/** Promoted products based on customer click history */
shopRouter.get('/promotions', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    let customerId: string | null = null;
    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : null;

    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      customerId = user?.id ?? null;
    }

    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .or('status.eq.active,status.is.null,status.eq.Active');

    const companyIds = (companies ?? []).map((c) => c.id);
    const nameMap = new Map((companies ?? []).map((c) => [c.id, c.name]));

    if (companyIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    let clickedProductIds: string[] = [];
    let topCategories: string[] = [];

    if (customerId || sessionId) {
      let clickQuery = db(supabase)
        .from('product_click_events')
        .select('category, product_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (customerId) {
        clickQuery = clickQuery.eq('customer_id', customerId);
      } else if (sessionId) {
        clickQuery = clickQuery.eq('session_id', sessionId);
      }

      const { data: clickRows } = await clickQuery;
      const clicks = (clickRows ?? []) as Array<{
        product_id: string;
        category?: string | null;
      }>;

      clickedProductIds = Array.from(
        new Set(clicks.map((row) => row.product_id).filter((id: string) => Boolean(id))),
      ).slice(0, 12);

      topCategories = Array.from(
        new Set(
          clicks
            .map((row) => row.category?.trim())
            .filter((cat: string | undefined): cat is string => Boolean(cat)),
        ),
      ).slice(0, 5);
    }

    const picked = new Map<string, Record<string, unknown>>();

    const listedSelect = `${PRODUCT_CORE_SELECT}, image_url, is_online_listing`;

    async function selectListedProducts(
      apply: (q: ReturnType<ReturnType<typeof db>['from']>) => unknown,
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = db(supabase).from('products').select(listedSelect);
      query = apply(query);
      let { data, error } = await query.eq('is_online_listing', true);
      if (error && isMissingColumnError(error, 'is_online_listing')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fallback: any = db(supabase).from('products').select(`${PRODUCT_CORE_SELECT}, image_url`);
        fallback = apply(fallback);
        const retry = await fallback;
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }

    if (clickedProductIds.length > 0) {
      const clickedProducts = await selectListedProducts((q) =>
        q.in('company_id', companyIds).in('id', clickedProductIds),
      );

      for (const productId of clickedProductIds) {
        const row = clickedProducts.find((p) => p.id === productId);
        if (row) picked.set(productId, row);
      }
    }

    if (picked.size < 8 && topCategories.length > 0) {
      const categoryProducts = await selectListedProducts((q) =>
        q.in('company_id', companyIds).in('category', topCategories).limit(40),
      );

      for (const row of categoryProducts) {
        if (picked.size >= 8) break;
        picked.set(row.id as string, row);
      }
    }

    if (picked.size < 8) {
      const fallbackProducts = await selectListedProducts((q) =>
        q.in('company_id', companyIds).limit(40),
      );

      const shuffled = [...fallbackProducts].sort(() => Math.random() - 0.5);
      for (const row of shuffled) {
        if (picked.size >= 8) break;
        picked.set(row.id as string, row);
      }
    }

    const shuffledPicked = [...picked.values()]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);

    const productIds = shuffledPicked.map((p) => p.id as string);
    const mediaMap = await attachProductMedia(supabase, productIds);

    const stockMap = await fetchSellableStockMap(supabase, companyIds);

    const promoted = shuffledPicked.map((p) => {
      const row = normalizeProductRow(p);
      const enriched = enrichProduct(row, mediaMap);
      const stock = stockForProduct(stockMap, p.company_id as string, p.id as string);
      return {
        ...enriched,
        stock,
        in_stock: stock > 0,
        company_name: nameMap.get(p.company_id as string) ?? 'Store',
        promoted: true,
      };
    });

    return res.json({ success: true, data: promoted, categories: topCategories });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load promotions'),
    });
  }
});

/** Public: marketplace product categories */
shopRouter.get('/categories', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id')
      .or('status.eq.active,status.is.null,status.eq.Active');

    if (companiesError) throw companiesError;

    const companyIds = (companies ?? []).map((c) => c.id);
    if (companyIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const categories = new Set<string>();
    const PAGE_SIZE = 1000;
    let from = 0;

    while (true) {
      let { data: products, error: productsError } = await supabase
        .from('products')
        .select('category')
        .in('company_id', companyIds)
        .eq('is_online_listing', true)
        .not('category', 'is', null)
        .range(from, from + PAGE_SIZE - 1);

      if (productsError && isMissingColumnError(productsError, 'is_online_listing')) {
        const fallback = await supabase
          .from('products')
          .select('category')
          .in('company_id', companyIds)
          .not('category', 'is', null)
          .range(from, from + PAGE_SIZE - 1);
        products = fallback.data;
        productsError = fallback.error;
      }

      if (productsError) throw productsError;

      const batch = products ?? [];
      for (const p of batch) {
        const cat = p.category?.trim();
        if (cat) categories.add(cat);
      }
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const sorted = [...categories].sort((a, b) => a.localeCompare(b));

    return res.json({ success: true, data: sorted });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load categories'),
    });
  }
});

const registerSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
});

/** Public: customer registration */
shopRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const { fullName, email, password, phone } = parsed.data;
  const displayName = fullName?.trim() || email.split('@')[0] || 'Customer';

  try {
    const supabase = getSupabaseAdmin();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, role: 'customer' },
    });

    if (authError || !authData.user) {
      throw authError ?? new Error('Failed to create account');
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabase.from('users').insert({
      id: userId,
      email,
      full_name: displayName,
      phone: phone ?? null,
      role: 'customer',
      company_id: null,
      sales_type: null,
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      throw profileError;
    }

    return res.status(201).json({
      success: true,
      data: { userId, email },
      message: 'Account created. You can sign in now.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
});

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
});

const createOrderSchema = z
  .object({
    company_id: z.string().uuid(),
    shipping_name: z.string().min(2),
    shipping_phone: z.string().min(6),
    shipping_address: z.string().optional(),
    fulfillment_type: z.enum(['delivery', 'pickup']).default('delivery'),
    address_id: z.string().uuid().optional(),
    payment_method: z.enum(['pay_on_delivery', 'paystack']).default('pay_on_delivery'),
    notes: z.string().optional(),
    items: z.array(orderItemSchema).min(1),
    promo_code: z.string().optional(),
    shipping_fee: z.number().min(0).optional(),
    discount_amount: z.number().min(0).optional(),
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
    if (data.payment_method === 'paystack') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use /api/shop/payments/initialize for Paystack checkout',
        path: ['payment_method'],
      });
    }
  });

/** Authenticated customer: place order */
shopRouter.post('/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const data = parsed.data;
  const customerId = req.userId!;

  try {
    const supabase = getSupabaseAdmin();

    const stockCheck = await validateCheckoutStock(supabase, data.company_id, data.items);
    if (!stockCheck.ok) {
      return res.status(409).json({ success: false, error: stockCheck.error });
    }

    let discount = data.discount_amount ?? 0;
    if (data.promo_code) {
      const promo = await validatePromoCode(
        supabase,
        data.promo_code,
        data.company_id,
        stockCheck.total,
      );
      if (!promo.ok) {
        return res.status(400).json({ success: false, error: promo.error });
      }
      discount = promo.discount;
    }

    const payload: CheckoutPayload = {
      company_id: data.company_id,
      shipping_name: data.shipping_name,
      shipping_phone: data.shipping_phone,
      shipping_address: data.shipping_address,
      fulfillment_type: data.fulfillment_type,
      address_id: data.address_id,
      payment_method: 'pay_on_delivery',
      notes: data.notes,
      items: stockCheck.validatedItems,
    };

    const order = await fulfillOnlineOrder(supabase, customerId, payload, {
      paymentStatus: 'pending',
      paymentMethod: 'pay_on_delivery',
      shippingFee: data.shipping_fee ?? 0,
      discountAmount: discount,
      promoCode: data.promo_code ?? null,
    });

    const orderId = String((order as { id?: string })?.id ?? '');
    void notifyCustomer(supabase, customerId, {
      type: 'order',
      title: 'Order placed',
      body: 'Your order was received. We will notify you as it progresses.',
      link: orderId ? `/orders/${orderId}/track` : '/account/orders',
      metadata: { order_id: orderId || undefined },
    });

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Order failed'),
    });
  }
});

/** Customer order history */
shopRouter.get('/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('online_orders')
      .select('*, companies(name), online_order_items(*)')
      .eq('customer_id', req.userId!)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load orders',
    });
  }
});

const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'ready',
  'shipped',
  'delivered',
  'cancelled',
]);

const updateOrderStatusSchema = z
  .object({
    status: orderStatusSchema.optional(),
    tracking_number: z.string().max(120).optional(),
    carrier_name: z.string().max(80).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.status && data.tracking_number === undefined && data.carrier_name === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide status and/or tracking details',
      });
    }
  });

/** Admin can skip intermediate steps (e.g. confirmed → ready) */
const ADMIN_STATUS_FLOW: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'ready', 'cancelled'],
  processing: ['ready', 'shipped'],
  ready: ['shipped', 'delivered'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Company admin: list online orders for their store */
shopRouter.get(
  '/admin/orders',
  requireAuth,
  requireRole('company_admin'),
  requireActiveSubscription,
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, error: 'Company admin profile required' });
    }

    const statusFilter =
      typeof req.query.status === 'string' && req.query.status !== 'all'
        ? req.query.status
        : null;

    try {
      const supabase = getSupabaseAdmin();
      let query = db(supabase)
        .from('online_orders')
        .select('*, online_order_items(*)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        if (error.message.includes('online_orders')) {
          return res.status(503).json({
            success: false,
            error: 'Online orders table not configured. Run migration 20250619120000_online_orders.sql',
          });
        }
        throw error;
      }

      const enriched = await attachOrderItemBarcodes(
        supabase,
        (data ?? []) as Array<Record<string, unknown>>,
      );
      return res.json({ success: true, data: enriched });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load orders',
      });
    }
  },
);

/** Company admin: update order status (confirm, ship, etc.) */
shopRouter.patch(
  '/admin/orders/:orderId',
  requireAuth,
  requireRole('company_admin'),
  requireActiveSubscription,
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, error: 'Company admin profile required' });
    }

    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const orderId = String(req.params.orderId);
    const nextStatus = parsed.data.status;
    const trackingNumber = parsed.data.tracking_number?.trim();
    const carrierName = parsed.data.carrier_name?.trim();

    try {
      const supabase = getSupabaseAdmin();

      const { data: order, error: fetchError } = await db(supabase)
        .from('online_orders')
        .select('*, online_order_items(*)')
        .eq('id', orderId)
        .eq('company_id', companyId)
        .single();

      if (fetchError || !order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const [enrichedOrder] = await attachOrderItemBarcodes(supabase, [
        order as Record<string, unknown>,
      ]);
      const orderRow = enrichedOrder as {
        status: string;
        customer_id: string | null;
        tracking_number?: string | null;
        online_order_items?: Array<{
          product_id: string;
          quantity: number;
          barcode?: string | null;
          sku?: string | null;
        }>;
      };

      const currentStatus = orderRow.status;

      if (nextStatus) {
        const allowed = ADMIN_STATUS_FLOW[currentStatus] ?? [];
        if (!allowed.includes(nextStatus)) {
          return res.status(400).json({
            success: false,
            error: `Cannot change status from "${currentStatus}" to "${nextStatus}"`,
          });
        }

        if (nextStatus === 'cancelled') {
          const items = orderRow.online_order_items ?? [];
          for (const item of items) {
            await db(supabase).rpc('restore_sellable_stock', {
              p_company_id: companyId,
              p_product_id: item.product_id,
              p_qty: item.quantity,
            });
          }
        }
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (nextStatus) patch.status = nextStatus;
      if (parsed.data.tracking_number !== undefined) {
        patch.tracking_number = trackingNumber || null;
      }
      if (parsed.data.carrier_name !== undefined) {
        patch.carrier_name = carrierName || null;
      }

      // Auto-mix barcode + order number when shipping/ready and no tracking yet
      const shouldAutoTrack =
        (nextStatus === 'shipped' || nextStatus === 'ready') &&
        !patch.tracking_number &&
        !orderRow.tracking_number;
      if (shouldAutoTrack) {
        patch.tracking_number = buildProductTrackingNumber(
          orderId,
          trackingCodeFromItems(orderRow.online_order_items),
        );
      }

      const { data: updated, error: updateError } = await db(supabase)
        .from('online_orders')
        .update(patch)
        .eq('id', orderId)
        .eq('company_id', companyId)
        .select('*, online_order_items(*)')
        .single();

      if (updateError) throw updateError;

      const [enrichedUpdated] = await attachOrderItemBarcodes(supabase, [
        updated as Record<string, unknown>,
      ]);

      const finalTracking =
        (enrichedUpdated.tracking_number as string | null | undefined) ??
        (patch.tracking_number as string | undefined) ??
        trackingNumber;

      if (nextStatus) {
        const trackNote = finalTracking ? ` · Tracking ${finalTracking}` : '';
        await db(supabase).from('order_tracking_events').insert({
          order_id: orderId,
          status: nextStatus,
          message: `Order status updated to ${nextStatus}${trackNote}`,
        });
      } else if (trackingNumber || carrierName || shouldAutoTrack) {
        await db(supabase).from('order_tracking_events').insert({
          order_id: orderId,
          status: currentStatus,
          message: `Tracking updated${carrierName ? `: ${carrierName}` : ''}${finalTracking ? ` — ${finalTracking}` : ''}`,
        });
      }

      if (orderRow.customer_id) {
        if (nextStatus) {
          const statusLabels: Record<string, string> = {
            confirmed: 'confirmed',
            processing: 'being processed',
            ready: 'ready for pickup',
            shipped: 'shipped',
            delivered: 'delivered',
            cancelled: 'cancelled',
          };
          const label = statusLabels[nextStatus] ?? nextStatus;
          void notifyCustomer(supabase, orderRow.customer_id, {
            type: 'order',
            title: 'Order update',
            body: finalTracking
              ? `Your order is now ${label}. Tracking: ${finalTracking}`
              : `Your order is now ${label}.`,
            link: `/orders/${orderId}/track`,
            metadata: { order_id: orderId, status: nextStatus, tracking_number: finalTracking },
          });
        } else if (finalTracking && (trackingNumber || shouldAutoTrack)) {
          void notifyCustomer(supabase, orderRow.customer_id, {
            type: 'order',
            title: 'Tracking update',
            body: `Tracking number: ${finalTracking}`,
            link: `/orders/${orderId}/track`,
            metadata: { order_id: orderId, tracking_number: finalTracking },
          });
        }
      }

      return res.json({ success: true, data: enrichedUpdated });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to update order'),
      });
    }
  },
);

const returnStatusSchema = z.enum(['pending', 'approved', 'rejected', 'refunded', 'cancelled']);

/** Company admin: list return requests */
shopRouter.get(
  '/admin/returns',
  requireAuth,
  requireRole('company_admin'),
  requireActiveSubscription,
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, error: 'Company admin profile required' });
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await db(supabase)
        .from('return_requests')
        .select('*, online_orders(id, total, status, shipping_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json({ success: true, data: data ?? [] });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to load return requests'),
      });
    }
  },
);

/** Company admin: update return request */
shopRouter.patch(
  '/admin/returns/:returnId',
  requireAuth,
  requireRole('company_admin'),
  requireActiveSubscription,
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, error: 'Company admin profile required' });
    }

    const parsed = z
      .object({
        status: returnStatusSchema,
        admin_notes: z.string().max(500).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const returnId = String(req.params.returnId);

    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await db(supabase)
        .from('return_requests')
        .update({
          status: parsed.data.status,
          admin_notes: parsed.data.admin_notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', returnId)
        .eq('company_id', companyId)
        .select('*, online_orders(id, total, status)')
        .single();

      if (error || !data) {
        return res.status(404).json({ success: false, error: 'Return request not found' });
      }

      const row = data as { customer_id: string | null; order_id: string; status: string };
      if (row.customer_id) {
        const messages: Record<string, string> = {
          approved: 'Your return request was approved.',
          rejected: 'Your return request was declined.',
          refunded: 'Your return has been refunded.',
        };
        const msg = messages[parsed.data.status];
        if (msg) {
          void notifyCustomer(supabase, row.customer_id, {
            type: 'return',
            title: 'Return update',
            body: msg,
            link: '/account/orders',
            metadata: { order_id: row.order_id, status: parsed.data.status },
          });
        }
      }

      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to update return request'),
      });
    }
  },
);

/** Company admin: refund paid Paystack order and restock warehouse */
shopRouter.post(
  '/admin/orders/:orderId/refund',
  requireAuth,
  requireRole('company_admin'),
  requireActiveSubscription,
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, error: 'Company admin profile required' });
    }

    const orderId = String(req.params.orderId);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Order refund';

    try {
      const supabase = getSupabaseAdmin();

      const { data: order, error: fetchError } = await db(supabase)
        .from('online_orders')
        .select('*, online_order_items(*)')
        .eq('id', orderId)
        .eq('company_id', companyId)
        .single();

      if (fetchError || !order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const orderRow = order as {
        payment_status: string;
        payment_method: string;
        momo_reference: string | null;
        status: string;
        online_order_items?: Array<{ product_id: string; quantity: number }>;
      };

      if (orderRow.payment_status !== 'paid') {
        return res.status(400).json({ success: false, error: 'Only paid orders can be refunded' });
      }

      if (orderRow.status === 'cancelled') {
        return res.status(400).json({ success: false, error: 'Order already cancelled' });
      }

      if (orderRow.payment_method === 'paystack' && orderRow.momo_reference) {
        await refundPaystackTransaction(orderRow.momo_reference, undefined, reason);
      }

      for (const item of orderRow.online_order_items ?? []) {
        await db(supabase).rpc('restore_sellable_stock', {
          p_company_id: companyId,
          p_product_id: item.product_id,
          p_qty: item.quantity,
        });
      }

      const { data: updated, error: updateError } = await db(supabase)
        .from('online_orders')
        .update({
          status: 'cancelled',
          payment_status: 'refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('company_id', companyId)
        .select('*, online_order_items(*)')
        .single();

      if (updateError) throw updateError;

      return res.json({ success: true, data: updated });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Refund failed'),
      });
    }
  },
);

/** Customer profile */
shopRouter.get('/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, address')
      .eq('id', req.userId!)
      .single();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load profile'),
    });
  }
});

const profileUpdateSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
  address: z.string().optional(),
});

shopRouter.patch('/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .update(parsed.data)
      .eq('id', req.userId!)
      .select('id, full_name, email, phone, address')
      .single();

    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to update profile'),
    });
  }
});

/** Customer addresses */
shopRouter.get('/addresses', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', req.userId!)
      .order('is_default', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load addresses'),
    });
  }
});

const addressSchema = z.object({
  label: z.string().min(1).default('Home'),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  address_line: z.string().min(5),
  city: z.string().optional(),
  region: z.string().optional(),
  is_default: z.boolean().optional(),
});

shopRouter.post('/addresses', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (parsed.data.is_default) {
      await db(supabase)
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', req.userId!);
    }

    const { data, error } = await db(supabase)
      .from('customer_addresses')
      .insert({ ...parsed.data, customer_id: req.userId! })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to save address'),
    });
  }
});

shopRouter.delete('/addresses/:addressId', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await db(supabase)
      .from('customer_addresses')
      .delete()
      .eq('id', String(req.params.addressId))
      .eq('customer_id', req.userId!);

    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to delete address'),
    });
  }
});

/** Customer payment methods */
shopRouter.get('/payment-methods', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('customer_payment_methods')
      .select('*')
      .eq('customer_id', req.userId!)
      .order('is_default', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load payment methods'),
    });
  }
});

const paymentMethodSchema = z
  .object({
    type: z.enum(['mobile_money', 'card', 'pay_on_delivery']),
    provider: z.string().optional(),
    phone_number: z.string().optional(),
    label: z.string().optional(),
    is_default: z.boolean().optional(),
    card_last4: z.string().optional(),
    card_exp_month: z.number().int().min(1).max(12).optional(),
    card_exp_year: z.number().int().min(2020).max(2100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'mobile_money') {
      const phone = data.phone_number?.trim();
      if (!phone || phone.length < 9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valid phone number is required',
          path: ['phone_number'],
        });
      }
    }
    if (data.type === 'card') {
      if (!data.provider?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Card brand is required',
          path: ['provider'],
        });
      }
      if (!data.card_last4 || !/^\d{4}$/.test(data.card_last4)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Last 4 digits are required',
          path: ['card_last4'],
        });
      }
      if (!data.card_exp_month || !data.card_exp_year) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Card expiry is required',
          path: ['card_exp_month'],
        });
      }
    }
  });

shopRouter.post('/payment-methods', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  const parsed = paymentMethodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (parsed.data.is_default) {
      await db(supabase)
        .from('customer_payment_methods')
        .update({ is_default: false })
        .eq('customer_id', req.userId!);
    }

    const { data, error } = await db(supabase)
      .from('customer_payment_methods')
      .insert({ ...parsed.data, customer_id: req.userId! })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to save payment method'),
    });
  }
});

/** Customer ratings history */
shopRouter.get('/my-ratings', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('product_ratings')
      .select('*, products(name), companies(name)')
      .eq('customer_id', req.userId!)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load ratings'),
    });
  }
});

/** Live chat — customer thread list */
shopRouter.get('/chat/threads', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: threads, error } = await db(supabase)
      .from('shop_chat_threads')
      .select('id, company_id, updated_at, companies(name)')
      .eq('customer_id', req.userId!)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, data: threads ?? [] });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load chat threads'),
    });
  }
});

/** Live chat — customer messages with a store */
shopRouter.get('/chat/:companyId', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  const companyId = String(req.params.companyId);

  try {
    const supabase = getSupabaseAdmin();
    let { data: thread } = await db(supabase)
      .from('shop_chat_threads')
      .select('id')
      .eq('customer_id', req.userId!)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!thread) {
      const { data: created } = await db(supabase)
        .from('shop_chat_threads')
        .insert({ customer_id: req.userId!, company_id: companyId })
        .select('id')
        .single();
      thread = created as { id: string };
    }

    const { data: messages, error } = await db(supabase)
      .from('shop_chat_messages')
      .select('id, sender_id, sender_role, body, created_at')
      .eq('thread_id', (thread as { id: string }).id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json({
      success: true,
      data: {
        thread_id: (thread as { id: string }).id,
        messages: decryptChatMessages((messages ?? []) as Array<{ body: string }>),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to load chat'),
    });
  }
});

const chatMessageSchema = z.object({ body: z.string().min(1).max(2000) });

shopRouter.post('/chat/:companyId', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'customer') {
    return res.status(403).json({ success: false, error: 'Customer account required' });
  }

  const parsed = chatMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.flatten() });
  }

  const companyId = String(req.params.companyId);

  try {
    const supabase = getSupabaseAdmin();
    let { data: thread } = await db(supabase)
      .from('shop_chat_threads')
      .select('id')
      .eq('customer_id', req.userId!)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!thread) {
      const { data: created, error: createError } = await db(supabase)
        .from('shop_chat_threads')
        .insert({ customer_id: req.userId!, company_id: companyId })
        .select('id')
        .single();
      if (createError) throw createError;
      thread = created;
    }

    const { data: message, error } = await db(supabase)
      .from('shop_chat_messages')
      .insert({
        thread_id: (thread as { id: string }).id,
        sender_id: req.userId!,
        sender_role: 'customer',
        body: encryptChatMessage(parsed.data.body),
      })
      .select('id, sender_id, sender_role, body, created_at')
      .single();

    if (error) throw error;

    await db(supabase)
      .from('shop_chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', (thread as { id: string }).id);

    const decrypted = message
      ? { ...(message as Record<string, unknown>), body: decryptChatMessage((message as { body: string }).body) }
      : message;

    return res.status(201).json({ success: true, data: decrypted });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: getErrorMessage(error, 'Failed to send message'),
    });
  }
});

/** Admin chat inbox */
shopRouter.get(
  '/admin/chat',
  requireAuth,
  requireRole('company_admin'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, error: 'Company admin profile required' });
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data: threads, error } = await db(supabase)
        .from('shop_chat_threads')
        .select('*, users(full_name, email)')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return res.json({ success: true, data: threads ?? [] });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to load chat threads'),
      });
    }
  },
);

shopRouter.get(
  '/admin/chat/:threadId/messages',
  requireAuth,
  requireRole('company_admin'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, error: 'Company admin profile required' });
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data: thread, error: threadError } = await db(supabase)
        .from('shop_chat_threads')
        .select('id')
        .eq('id', String(req.params.threadId))
        .eq('company_id', companyId)
        .single();

      if (threadError || !thread) {
        return res.status(404).json({ success: false, error: 'Thread not found' });
      }

      const { data: messages, error } = await db(supabase)
        .from('shop_chat_messages')
        .select('id, sender_id, sender_role, body, created_at')
        .eq('thread_id', (thread as { id: string }).id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return res.json({
        success: true,
        data: decryptChatMessages((messages ?? []) as Array<{ body: string }>),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to load messages'),
      });
    }
  },
);

shopRouter.post(
  '/admin/chat/:threadId/messages',
  requireAuth,
  requireRole('company_admin'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, error: 'Company admin profile required' });
    }

    const parsed = chatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data: thread, error: threadError } = await db(supabase)
        .from('shop_chat_threads')
        .select('id, customer_id')
        .eq('id', String(req.params.threadId))
        .eq('company_id', companyId)
        .single();

      if (threadError || !thread) {
        return res.status(404).json({ success: false, error: 'Thread not found' });
      }

      const { data: message, error } = await db(supabase)
        .from('shop_chat_messages')
        .insert({
          thread_id: (thread as { id: string }).id,
          sender_id: req.userId!,
          sender_role: 'company_admin',
          body: encryptChatMessage(parsed.data.body),
        })
        .select('id, sender_id, sender_role, body, created_at')
        .single();

      if (error) throw error;

      await db(supabase)
        .from('shop_chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', (thread as { id: string }).id);

      const decrypted = message
        ? { ...(message as Record<string, unknown>), body: decryptChatMessage((message as { body: string }).body) }
        : message;

      const threadRow = thread as { id: string; customer_id: string };
      void notifyCustomer(supabase, threadRow.customer_id, {
        type: 'chat',
        title: 'New message from seller',
        body: 'Open your inbox to read and reply.',
        link: '/account/inbox',
        metadata: { thread_id: threadRow.id },
      });

      return res.status(201).json({ success: true, data: decrypted });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: getErrorMessage(error, 'Failed to send message'),
      });
    }
  },
);
