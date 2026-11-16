/** Rich marketplace listing saved from Add to Warehouse (online products) */
export interface MarketplaceListing {
  variations?: string[];
  size_guide?: string;
  key_highlights?: string[];
  specifications?: string;
  key_features?: string;
  weight_kg?: number | null;
  product_details?: string;
}

export function parseMarketplaceListing(raw: unknown): MarketplaceListing | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const listing: MarketplaceListing = {};

  if (Array.isArray(o.variations)) {
    listing.variations = o.variations.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }
  if (typeof o.size_guide === 'string' && o.size_guide.trim()) listing.size_guide = o.size_guide.trim();
  if (Array.isArray(o.key_highlights)) {
    listing.key_highlights = o.key_highlights.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
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

export function buildMarketplaceListingPayload(input: {
  variations: string;
  sizeGuide: string;
  keyHighlights: string;
  specifications: string;
  keyFeatures: string;
  weightKg: string;
  productDetails: string;
}): MarketplaceListing | null {
  const variations = input.variations
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const key_highlights = input.keyHighlights
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const listing: MarketplaceListing = {};
  if (variations.length) listing.variations = variations;
  if (input.sizeGuide.trim()) listing.size_guide = input.sizeGuide.trim();
  if (key_highlights.length) listing.key_highlights = key_highlights;
  if (input.specifications.trim()) listing.specifications = input.specifications.trim();
  if (input.keyFeatures.trim()) listing.key_features = input.keyFeatures.trim();
  if (input.weightKg.trim()) {
    const w = parseFloat(input.weightKg);
    if (!Number.isNaN(w) && w > 0) listing.weight_kg = w;
  }
  if (input.productDetails.trim()) listing.product_details = input.productDetails.trim();

  return Object.keys(listing).length > 0 ? listing : null;
}
