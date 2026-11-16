import type { ShopProduct } from '../stores/ecommerceCatalogStore';

export type ShopPriceType = 'retail' | 'wholesale';

export function productHasRetailPrice(product: ShopProduct): boolean {
  return product.price != null && product.price > 0;
}

export function productHasWholesalePrice(product: ShopProduct): boolean {
  return product.wholesale_price != null && product.wholesale_price > 0;
}

export function productHasDualPricing(product: ShopProduct): boolean {
  return productHasRetailPrice(product) && productHasWholesalePrice(product);
}

export function getPriceForType(product: ShopProduct, priceType: ShopPriceType): number {
  if (priceType === 'wholesale' && productHasWholesalePrice(product)) {
    return product.wholesale_price!;
  }
  return product.price;
}

export function getDefaultPriceType(
  product: ShopProduct,
  preferWholesale = false,
): ShopPriceType {
  if (preferWholesale && productHasWholesalePrice(product)) return 'wholesale';
  if (productHasRetailPrice(product)) return 'retail';
  if (productHasWholesalePrice(product)) return 'wholesale';
  return 'retail';
}

export function isWholesaleProduct(product: ShopProduct): boolean {
  return productHasWholesalePrice(product);
}
