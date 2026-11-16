import type { ShopCartItem } from '../stores/ecommerceCartStore';
import type { ShopProduct } from '../stores/ecommerceCatalogStore';
import {
  findProductInCatalog,
  parseCategoryPath,
  productMatchesCategoryFilter,
} from './categoryGroups';

export interface CartRecommendationSection {
  categoryLabel: string;
  products: ShopProduct[];
}

function cartProductKey(companyId: string, productId: string): string {
  return `${companyId}:${productId}`;
}

/** Collect category filters from items currently in the cart */
function collectCartCategoryFilters(
  cartItems: ShopCartItem[],
  catalog: ShopProduct[],
): string[] {
  const filters = new Set<string>();

  for (const item of cartItems) {
    const product =
      findProductInCatalog(catalog, item.companyId, item.productId) ??
      catalog.find((p) => p.id === item.productId);
    const category = item.category ?? product?.category;

    if (!category?.trim()) continue;

    const { main, sub } = parseCategoryPath(category);
    if (main) filters.add(main);
    if (sub) filters.add(category);
    else if (main) filters.add(main);
  }

  return [...filters];
}

/** Same-category picks for the cart page — excludes items already in cart */
export function getCartCategoryRecommendations(
  cartItems: ShopCartItem[],
  catalog: ShopProduct[],
  limit = 12,
): ShopProduct[] {
  if (cartItems.length === 0 || catalog.length === 0) return [];

  const cartKeys = new Set(cartItems.map((i) => cartProductKey(i.companyId, i.productId)));
  const categoryFilters = collectCartCategoryFilters(cartItems, catalog);
  if (categoryFilters.length === 0) return [];

  const results: ShopProduct[] = [];
  const seen = new Set<string>();

  for (const product of catalog) {
    const companyId = product.company_id;
    if (!companyId) continue;

    const key = cartProductKey(companyId, product.id);
    if (cartKeys.has(key) || seen.has(key)) continue;
    if (!product.in_stock) continue;

    const matches = categoryFilters.some((filter) => productMatchesCategoryFilter(product, filter));
    if (!matches) continue;

    results.push(product);
    seen.add(key);
    if (results.length >= limit) break;
  }

  return results;
}

/** Group recommendations by subcategory / section for clearer cart upsell */
export function groupCartRecommendations(
  cartItems: ShopCartItem[],
  catalog: ShopProduct[],
  perSection = 4,
): CartRecommendationSection[] {
  const recommendations = getCartCategoryRecommendations(cartItems, catalog, 24);
  if (recommendations.length === 0) return [];

  const categoryFilters = collectCartCategoryFilters(cartItems, catalog);
  const primaryFilter = categoryFilters[0] ?? 'More';

  const map = new Map<string, ShopProduct[]>();
  for (const product of recommendations) {
    const { sub, main } = parseCategoryPath(product.category);
    const label = sub ?? main ?? primaryFilter;
    const list = map.get(label) ?? [];
    if (list.length < perSection) {
      list.push(product);
      map.set(label, list);
    }
  }

  return Array.from(map.entries()).map(([categoryLabel, products]) => ({
    categoryLabel,
    products,
  }));
}
