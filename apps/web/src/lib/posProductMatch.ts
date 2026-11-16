import type { Product } from '../types';

function normalizeScanCode(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '');
}

/** Match barcode or SKU (exact, case-insensitive; ignores spaces/dashes/underscores). */
export function findProductByScanCode(products: Product[], rawCode: string): Product | undefined {
  const code = normalizeScanCode(rawCode);
  if (!code) return undefined;

  return products.find((p) => {
    const sku = p.sku ? normalizeScanCode(p.sku) : '';
    const barcode = p.barcode ? normalizeScanCode(p.barcode) : '';
    return (sku && sku === code) || (barcode && barcode === code);
  });
}

export function filterProductsByQuery(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;

  return products.filter((product) => {
    const name = product.name.toLowerCase();
    const sku = product.sku?.toLowerCase() ?? '';
    const barcode = product.barcode?.toLowerCase() ?? '';
    const category = product.category?.toLowerCase() ?? '';
    return name.includes(q) || sku.includes(q) || barcode.includes(q) || category.includes(q);
  });
}
