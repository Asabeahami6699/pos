import type { Product } from '../../types';
import { offlineDb } from './db';

export async function saveCatalogCache(
  branchId: string,
  companyId: string,
  products: Product[],
): Promise<void> {
  await offlineDb.catalog.put({
    branchId,
    companyId,
    products,
    cachedAt: new Date().toISOString(),
  });
}

export async function loadCatalogCache(branchId: string): Promise<Product[] | null> {
  const row = await offlineDb.catalog.get(branchId);
  return row?.products ?? null;
}

export async function decrementLocalStock(
  branchId: string,
  items: Array<{ productId: string; quantity: number }>,
): Promise<void> {
  const row = await offlineDb.catalog.get(branchId);
  if (!row) return;

  const products = row.products.map((p) => {
    const item = items.find((i) => i.productId === p.id);
    if (!item) return p;
    const newStock = Math.max(0, (p.stock ?? 0) - item.quantity);
    return {
      ...p,
      stock: newStock,
      is_low_stock: newStock <= (p.low_stock_threshold || 5),
      last_updated: new Date().toISOString(),
    };
  });

  await offlineDb.catalog.put({
    ...row,
    products,
    cachedAt: new Date().toISOString(),
  });
}
