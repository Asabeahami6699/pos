import type { ProductMediaItem } from '../../stores/ecommerceCatalogStore';

/** Build ordered slides from API media + optional cover image_url */
export function buildProductMediaSlides(
  imageUrl?: string | null,
  media: ProductMediaItem[] = [],
): ProductMediaItem[] {
  const sorted = [...media].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  if (sorted.length > 0) {
    if (imageUrl && !sorted.some((m) => m.url === imageUrl)) {
      return [{ url: imageUrl, media_type: 'image' }, ...sorted];
    }
    return sorted;
  }

  if (imageUrl) return [{ url: imageUrl, media_type: 'image' }];
  return [];
}
