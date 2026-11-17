/** Short public order reference (last 8 of UUID, uppercased). */
export function orderNumberFromId(orderId: string): string {
  return orderId.replace(/-/g, '').slice(-8).toUpperCase();
}

/**
 * Mix product barcode (or SKU fallback) with the order number for admin/customer tracking.
 * Example: PEAK12345-A1B2C3D4
 */
export function buildProductTrackingNumber(
  orderId: string,
  barcodeOrSku?: string | null,
): string {
  const orderNo = orderNumberFromId(orderId);
  const code = String(barcodeOrSku ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();

  if (!code) return `ORD-${orderNo}`;
  return `${code}-${orderNo}`;
}

/** Prefer first item barcode, then SKU; join unique codes when several items. */
export function trackingCodeFromOrderItems(
  items?: Array<{ barcode?: string | null; sku?: string | null; product_name?: string }>,
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
