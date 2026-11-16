import type { ShopProduct } from '../stores/ecommerceCatalogStore';

export interface CategorySection {
  title: string;
  products: ShopProduct[];
}

/** Split "Grocery/Food Cupboard" or "Grocery > Biscuits" into main + sub labels */
export function parseCategoryPath(category: string | null | undefined): {
  main: string;
  sub: string | null;
} {
  if (!category?.trim()) return { main: '', sub: null };
  const normalized = category.replace(/\s*>\s*/g, '/').trim();
  const parts = normalized.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { main: parts[0], sub: parts.slice(1).join(' / ') };
  }
  return { main: parts[0] ?? '', sub: null };
}

function normalizeCategoryPath(category: string): string {
  return category.replace(/\s*>\s*/g, '/').trim().toLowerCase();
}

/** Match sidebar/chip category against product category (exact, main, or path prefix). */
export function productMatchesCategoryFilter(
  product: ShopProduct,
  filter: string,
): boolean {
  const needle = filter.trim();
  if (!needle) return true;

  const raw = (product.category ?? '').trim();
  const f = normalizeCategoryPath(needle);

  if (!raw) {
    return (product.company_name ?? '').trim().toLowerCase() === f;
  }

  const normalized = normalizeCategoryPath(raw);
  if (normalized === f) return true;

  const { main } = parseCategoryPath(raw);
  if (main.toLowerCase() === f) return true;

  if (normalized.startsWith(`${f}/`)) return true;

  return false;
}

export function productMatchesMainCategory(
  product: ShopProduct,
  mainCategory: string,
): boolean {
  return productMatchesCategoryFilter(product, mainCategory);
}

/** Group products into Jumia-style sections (subcategory path, else store name) */
export function groupProductsIntoSections(
  products: ShopProduct[],
  mainCategory: string,
): CategorySection[] {
  const map = new Map<string, ShopProduct[]>();

  for (const product of products) {
    const { sub } = parseCategoryPath(product.category);
    const sectionTitle =
      sub ?? product.company_name ?? 'More products';
    const list = map.get(sectionTitle) ?? [];
    list.push(product);
    map.set(sectionTitle, list);
  }

  return Array.from(map.entries())
    .map(([title, items]) => ({ title, products: items }))
    .sort((a, b) => b.products.length - a.products.length);
}

/** Group all marketplace products by top-level category (for "All Categories" browse) */
export function groupProductsByMainCategory(products: ShopProduct[]): CategorySection[] {
  const map = new Map<string, ShopProduct[]>();

  for (const product of products) {
    const { main } = parseCategoryPath(product.category);
    const sectionTitle = main || product.company_name || 'Other';
    const list = map.get(sectionTitle) ?? [];
    list.push(product);
    map.set(sectionTitle, list);
  }

  return Array.from(map.entries())
    .map(([title, items]) => ({ title, products: items }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function findProductInCatalog(
  products: ShopProduct[],
  companyId: string,
  productId: string,
): ShopProduct | undefined {
  return products.find((p) => p.id === productId && p.company_id === companyId);
}
