import { supabase } from './supabase';

export type ProfitPeriod = 'all' | 'today' | 'week' | 'month';

export interface ProductProfitRow {
  product_id: string;
  product_name: string;
  sku: string;
  units_sold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin_percent: number;
  cost_estimated: boolean;
  retail_price: number;
  cost_price: number | null;
  catalog_unit_profit: number;
}

export interface ProfitSummary {
  revenue: number;
  cost: number;
  profit: number;
  margin_percent: number;
  salesCount: number;
  unitsSold: number;
  posRevenue: number;
  posCost: number;
  posProfit: number;
  onlineRevenue: number;
  onlineCost: number;
  onlineProfit: number;
  estimatedCostShare: number;
  catalogPotentialProfit: number;
  productsWithCost: number;
  productsMissingCost: number;
  byProduct: ProductProfitRow[];
  period: ProfitPeriod;
}

export const EMPTY_PROFIT: ProfitSummary = {
  revenue: 0,
  cost: 0,
  profit: 0,
  margin_percent: 0,
  salesCount: 0,
  unitsSold: 0,
  posRevenue: 0,
  posCost: 0,
  posProfit: 0,
  onlineRevenue: 0,
  onlineCost: 0,
  onlineProfit: 0,
  estimatedCostShare: 0,
  catalogPotentialProfit: 0,
  productsWithCost: 0,
  productsMissingCost: 0,
  byProduct: [],
  period: 'all',
};

function periodStart(period: ProfitPeriod): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === 'today') {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (period === 'week') {
    now.setDate(now.getDate() - 7);
    return now;
  }
  now.setDate(now.getDate() - 30);
  return now;
}

function resolveUnitCost(
  costPrice: number | null | undefined,
  sellPrice: number,
): { cost: number; estimated: boolean } {
  if (costPrice != null && Number.isFinite(Number(costPrice)) && Number(costPrice) >= 0) {
    return { cost: Number(costPrice), estimated: false };
  }
  // Match restock invoice default when cost is missing
  return { cost: Math.max(0, sellPrice * 0.7), estimated: true };
}

export async function loadProfitSummary(
  companyId: string,
  period: ProfitPeriod = 'all',
): Promise<ProfitSummary> {
  if (!companyId) return { ...EMPTY_PROFIT, period };

  const start = periodStart(period);

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, sku, price, wholesale_price, cost_price')
    .eq('company_id', companyId);

  if (productsError) throw productsError;

  const productMap = new Map(
    (products ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        name: (p.name as string) || 'Unknown',
        sku: (p.sku as string) || '',
        price: Number(p.price ?? 0),
        wholesale_price: p.wholesale_price != null ? Number(p.wholesale_price) : null,
        cost_price: p.cost_price != null ? Number(p.cost_price) : null,
      },
    ]),
  );

  let productsWithCost = 0;
  let productsMissingCost = 0;
  let catalogPotentialProfit = 0;
  for (const p of productMap.values()) {
    if (p.cost_price != null) {
      productsWithCost += 1;
      catalogPotentialProfit += Math.max(0, p.price - p.cost_price);
    } else {
      productsMissingCost += 1;
      catalogPotentialProfit += Math.max(0, p.price - p.price * 0.7);
    }
  }

  let salesQuery = supabase
    .from('sales')
    .select('id, total, created_at, sale_items(id, product_id, quantity, price, total_price)')
    .eq('company_id', companyId);

  if (start) {
    salesQuery = salesQuery.gte('created_at', start.toISOString());
  }

  const { data: sales, error: salesError } = await salesQuery;
  if (salesError) throw salesError;

  let onlineQuery = supabase
    .from('online_orders')
    .select(
      'id, total, status, created_at, online_order_items(product_id, quantity, unit_price, total_price, product_name)',
    )
    .eq('company_id', companyId)
    .neq('status', 'cancelled');

  if (start) {
    onlineQuery = onlineQuery.gte('created_at', start.toISOString());
  }

  const { data: onlineOrders, error: onlineError } = await onlineQuery;
  if (onlineError) throw onlineError;

  type Agg = {
    product_id: string;
    product_name: string;
    sku: string;
    units_sold: number;
    revenue: number;
    cost: number;
    estimated_cost: number;
    retail_price: number;
    cost_price: number | null;
  };

  const byProduct = new Map<string, Agg>();

  const bump = (
    productId: string,
    fallbackName: string,
    qty: number,
    unitSell: number,
    lineRevenue: number,
  ) => {
    const product = productMap.get(productId);
    const sell = unitSell > 0 ? unitSell : product?.price ?? 0;
    const { cost: unitCost, estimated } = resolveUnitCost(product?.cost_price, sell);
    const lineCost = unitCost * qty;
    const key = productId || fallbackName;
    const existing = byProduct.get(key) ?? {
      product_id: productId || key,
      product_name: product?.name || fallbackName || 'Unknown',
      sku: product?.sku || '',
      units_sold: 0,
      revenue: 0,
      cost: 0,
      estimated_cost: 0,
      retail_price: product?.price ?? sell,
      cost_price: product?.cost_price ?? null,
    };
    existing.units_sold += qty;
    existing.revenue += lineRevenue;
    existing.cost += lineCost;
    if (estimated) existing.estimated_cost += lineCost;
    byProduct.set(key, existing);
  };

  let posRevenue = 0;
  let posCost = 0;
  let estimatedCostShare = 0;
  let unitsSold = 0;

  for (const sale of sales ?? []) {
    const items = (sale.sale_items as Array<{
      product_id?: string;
      quantity?: number;
      price?: number;
      total_price?: number | null;
    }> | null) ?? [];

    if (items.length === 0) {
      const total = Number(sale.total ?? 0);
      posRevenue += total;
      continue;
    }

    for (const item of items) {
      const qty = Number(item.quantity ?? 0);
      if (qty <= 0) continue;
      const unitSell = Number(item.price ?? 0);
      const lineRevenue =
        item.total_price != null && Number(item.total_price) > 0
          ? Number(item.total_price)
          : unitSell * qty;
      const product = productMap.get(String(item.product_id ?? ''));
      const { cost: unitCost, estimated } = resolveUnitCost(product?.cost_price, unitSell);
      const lineCost = unitCost * qty;
      posRevenue += lineRevenue;
      posCost += lineCost;
      if (estimated) estimatedCostShare += lineCost;
      unitsSold += qty;
      bump(String(item.product_id ?? ''), product?.name || 'Unknown', qty, unitSell, lineRevenue);
    }
  }

  let onlineRevenue = 0;
  let onlineCost = 0;

  for (const order of onlineOrders ?? []) {
    const items = (order.online_order_items as Array<{
      product_id?: string;
      product_name?: string;
      quantity?: number;
      unit_price?: number;
      total_price?: number;
    }> | null) ?? [];

    if (items.length === 0) {
      onlineRevenue += Number(order.total ?? 0);
      continue;
    }

    for (const item of items) {
      const qty = Number(item.quantity ?? 0);
      if (qty <= 0) continue;
      const unitSell = Number(item.unit_price ?? 0);
      const lineRevenue =
        item.total_price != null ? Number(item.total_price) : unitSell * qty;
      const product = productMap.get(String(item.product_id ?? ''));
      const { cost: unitCost, estimated } = resolveUnitCost(product?.cost_price, unitSell);
      const lineCost = unitCost * qty;
      onlineRevenue += lineRevenue;
      onlineCost += lineCost;
      if (estimated) estimatedCostShare += lineCost;
      unitsSold += qty;
      bump(
        String(item.product_id ?? ''),
        item.product_name || product?.name || 'Unknown',
        qty,
        unitSell,
        lineRevenue,
      );
    }
  }

  const revenue = posRevenue + onlineRevenue;
  const cost = posCost + onlineCost;
  const profit = revenue - cost;
  const margin_percent = revenue > 0 ? (profit / revenue) * 100 : 0;

  const rows: ProductProfitRow[] = [...byProduct.values()]
    .map((row) => {
      const rowProfit = row.revenue - row.cost;
      const unitCost =
        row.cost_price != null
          ? row.cost_price
          : resolveUnitCost(null, row.retail_price).cost;
      return {
        product_id: row.product_id,
        product_name: row.product_name,
        sku: row.sku,
        units_sold: row.units_sold,
        revenue: row.revenue,
        cost: row.cost,
        profit: rowProfit,
        margin_percent: row.revenue > 0 ? (rowProfit / row.revenue) * 100 : 0,
        cost_estimated: row.estimated_cost > 0,
        retail_price: row.retail_price,
        cost_price: row.cost_price,
        catalog_unit_profit: Math.max(0, row.retail_price - unitCost),
      };
    })
    .sort((a, b) => b.profit - a.profit);

  return {
    revenue,
    cost,
    profit,
    margin_percent,
    salesCount: (sales?.length ?? 0) + (onlineOrders?.length ?? 0),
    unitsSold,
    posRevenue,
    posCost,
    posProfit: posRevenue - posCost,
    onlineRevenue,
    onlineCost,
    onlineProfit: onlineRevenue - onlineCost,
    estimatedCostShare,
    catalogPotentialProfit,
    productsWithCost,
    productsMissingCost,
    byProduct: rows,
    period,
  };
}
