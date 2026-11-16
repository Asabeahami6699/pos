import type { ShopCompany, ShopProduct } from '../stores/ecommerceCatalogStore';
import type { MarketplaceListing } from '../types/marketplaceListing';
import { parseCategoryPath } from './categoryGroups';
import {
  productHasDualPricing,
  productHasRetailPrice,
  productHasWholesalePrice,
} from './shopProductPricing';

export interface ProductSpecRow {
  label: string;
  value: string;
}

function getListing(product: ShopProduct): MarketplaceListing | null {
  return product.marketplace_listing ?? null;
}

export function productHasOnlineListing(product: ShopProduct): boolean {
  if (product.is_online_listing) return true;
  const listing = getListing(product);
  return Boolean(product.description?.trim() || listing?.variations?.length || listing);
}

export function getProductVariations(product: ShopProduct): string[] {
  return getListing(product)?.variations ?? [];
}

export function buildProductSpecs(product: ShopProduct, company: ShopCompany): ProductSpecRow[] {
  const listing = getListing(product);
  const rows: ProductSpecRow[] = [
    { label: 'SKU', value: product.sku?.trim() || '—' },
    { label: 'Sold by', value: company.name },
  ];

  if (product.category) {
    const { main, sub } = parseCategoryPath(product.category);
    rows.push({ label: 'Category', value: sub ? `${main} › ${sub}` : main });
  }

  if (listing?.weight_kg) {
    const kg = listing.weight_kg;
    rows.push({
      label: 'Weight',
      value: kg < 1 ? `${Math.round(kg * 1000)}g` : `${kg} kg`,
    });
  }

  rows.push({
    label: 'Availability',
    value: product.in_stock ? `${product.stock} unit${product.stock === 1 ? '' : 's'} in stock` : 'Out of stock',
  });

  if (productHasDualPricing(product)) {
    const parts: string[] = [];
    if (productHasRetailPrice(product)) parts.push(`Retail ₵${Number(product.price).toFixed(2)}`);
    if (productHasWholesalePrice(product))
      parts.push(`Wholesale ₵${Number(product.wholesale_price).toFixed(2)}`);
    rows.push({ label: 'Pricing', value: parts.join(' · ') });
  } else {
    rows.push({ label: 'Price', value: `₵${Number(product.price).toFixed(2)}` });
  }

  if ((product.rating_count ?? 0) > 0) {
    rows.push({
      label: 'Customer rating',
      value: `${(product.average_rating ?? 0).toFixed(1)} / 5 (${product.rating_count} review${product.rating_count === 1 ? '' : 's'})`,
    });
  }

  return rows;
}

export function buildProductHighlights(product: ShopProduct): string[] {
  const fromListing = getListing(product)?.key_highlights ?? [];
  if (fromListing.length > 0) {
    const highlights = [...fromListing];
    if (product.in_stock && product.stock <= 5) {
      highlights.unshift(`Only ${product.stock} left — order soon.`);
    }
    return highlights.slice(0, 8);
  }

  return [
    'Quality-checked before listing on the marketplace.',
    'Sold and fulfilled by a verified local seller.',
    'Questions? Chat with the store directly from this page.',
  ];
}

export function getProductAboutText(product: ShopProduct): string {
  const trimmed = product.description?.trim();
  if (trimmed) return trimmed;

  const { main, sub } = parseCategoryPath(product.category);
  const categoryPhrase = sub ? `${sub.toLowerCase()} in ${main}` : main || 'everyday essentials';

  return `${product.name} is listed under ${categoryPhrase} on ${product.company_name ?? 'this store'}. ` +
    `Each unit is prepared for dispatch from the seller's inventory. ` +
    `Use the chat button to ask about variants, bulk pricing, or exact dimensions before you buy.`;
}

export function getProductSpecificationsText(product: ShopProduct): string | null {
  return getListing(product)?.specifications?.trim() || null;
}

export function getProductKeyFeaturesText(product: ShopProduct): string | null {
  return getListing(product)?.key_features?.trim() || null;
}

export function getProductDetailsText(product: ShopProduct): string | null {
  return getListing(product)?.product_details?.trim() || null;
}

export function getProductSizeGuide(product: ShopProduct): string | null {
  return getListing(product)?.size_guide?.trim() || null;
}
