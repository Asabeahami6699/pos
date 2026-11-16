import type { getSupabaseAdmin } from '../lib/supabase.js';

export type InventoryModel = 'warehouse' | 'branch_only';

function db(supabase: ReturnType<typeof getSupabaseAdmin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

function isMissingColumn(error: { code?: string; message?: string } | null, column: string) {
  return error?.code === '42703' && (error.message?.includes(column) ?? false);
}

/** companyId -> inventory_model (defaults to warehouse) */
export async function fetchCompanyInventoryModels(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyIds: string[],
): Promise<Map<string, InventoryModel>> {
  const map = new Map<string, InventoryModel>();
  if (companyIds.length === 0) return map;

  let result = await db(supabase)
    .from('companies')
    .select('id, inventory_model')
    .in('id', companyIds);

  if (isMissingColumn(result.error, 'inventory_model')) {
    companyIds.forEach((id) => map.set(id, 'warehouse'));
    return map;
  }

  if (result.error) throw result.error;

  for (const row of (result.data ?? []) as Array<{ id: string; inventory_model?: string }>) {
    map.set(row.id, row.inventory_model === 'branch_only' ? 'branch_only' : 'warehouse');
  }

  companyIds.forEach((id) => {
    if (!map.has(id)) map.set(id, 'warehouse');
  });

  return map;
}

/**
 * Sellable stock per company+product.
 * Key: `${companyId}:${productId}`
 */
export async function fetchSellableStockMap(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  companyIds: string[],
): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  if (companyIds.length === 0) return stockMap;

  const models = await fetchCompanyInventoryModels(supabase, companyIds);
  const warehouseCompanyIds = companyIds.filter((id) => models.get(id) !== 'branch_only');
  const branchOnlyCompanyIds = companyIds.filter((id) => models.get(id) === 'branch_only');

  if (warehouseCompanyIds.length > 0) {
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('warehouse_inventory')
        .select('company_id, product_id, quantity')
        .in('company_id', warehouseCompanyIds)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const batch = data ?? [];
      for (const row of batch) {
        stockMap.set(
          `${row.company_id}:${row.product_id}`,
          row.quantity ?? 0,
        );
      }
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  if (branchOnlyCompanyIds.length > 0) {
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('branch_inventory')
        .select('company_id, product_id, quantity')
        .in('company_id', branchOnlyCompanyIds)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const batch = data ?? [];
      for (const row of batch) {
        const key = `${row.company_id}:${row.product_id}`;
        stockMap.set(key, (stockMap.get(key) ?? 0) + (row.quantity ?? 0));
      }
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  return stockMap;
}

export function stockForProduct(
  stockMap: Map<string, number>,
  companyId: string | null | undefined,
  productId: string,
): number {
  if (!companyId) return 0;
  return stockMap.get(`${companyId}:${productId}`) ?? 0;
}
