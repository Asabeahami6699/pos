import { supabase } from './supabase';
import { uploadProductImage } from './productImageUpload';

const BUCKET = 'product-images';
const API_BASE = import.meta.env.VITE_API_URL ?? '';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export type MediaFileKind = 'image' | 'video';

export function getMediaKind(file: File): MediaFileKind | null {
  if (IMAGE_TYPES.includes(file.type)) return 'image';
  if (VIDEO_TYPES.includes(file.type)) return 'video';
  return null;
}

export function validateProductMedia(file: File): string | null {
  const kind = getMediaKind(file);
  if (!kind) return 'Use JPG, PNG, WebP, GIF, MP4, or WebM';
  if (kind === 'image' && file.size > MAX_IMAGE_BYTES) return 'Images must be 5MB or smaller';
  if (kind === 'video' && file.size > MAX_VIDEO_BYTES) return 'Videos must be 25MB or smaller';
  return null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function uploadMediaFile(
  file: File,
  companyId: string,
  productId: string,
  sortOrder: number,
): Promise<{ url: string; media_type: MediaFileKind }> {
  const kind = getMediaKind(file);
  if (!kind) throw new Error('Unsupported file type');

  const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'video' ? 'mp4' : 'jpg');
  const storagePath = `${companyId}/${productId}/${sortOrder}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });

  if (uploadError) {
    if (uploadError.message.includes('Bucket not found')) {
      throw new Error('Media storage not configured. Run product_images migration.');
    }
    throw uploadError;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { url: data.publicUrl, media_type: kind };
}

export interface MediaPreviewRef {
  previewUrl: string;
  file: File;
}

function resolveCoverUrl(
  uploaded: Array<{ url: string; media_type: MediaFileKind }>,
  previews: MediaPreviewRef[],
  coverKey: string | null,
): string | null {
  if (coverKey) {
    const previewIndex = previews.findIndex((p) => p.previewUrl === coverKey);
    if (previewIndex >= 0 && uploaded[previewIndex]?.media_type === 'image') {
      return uploaded[previewIndex].url;
    }
    if (coverKey.startsWith('http')) return coverKey;
  }
  return uploaded.find((r) => r.media_type === 'image')?.url ?? uploaded[0]?.url ?? null;
}

async function registerProductMediaViaApi(
  companyId: string,
  productId: string,
  items: Array<{ url: string; media_type: MediaFileKind; sort_order: number }>,
  coverUrl: string | null,
) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/product-media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      company_id: companyId,
      product_id: productId,
      items,
      cover_url: coverUrl,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to register product media');
  }
}

export async function saveProductMedia(
  files: File[],
  companyId: string,
  productId: string,
  coverKey?: string | null,
  previews?: MediaPreviewRef[],
): Promise<Array<{ url: string; media_type: MediaFileKind }>> {
  if (files.length === 0) return [];

  const previewList = previews ?? files.map((f, i) => ({ previewUrl: `file:${i}`, file: f }));
  const uploaded: Array<{ url: string; media_type: MediaFileKind }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const validationError = validateProductMedia(file);
    if (validationError) throw new Error(validationError);
    uploaded.push(await uploadMediaFile(file, companyId, productId, i));
  }

  const coverUrl = resolveCoverUrl(uploaded, previewList, coverKey ?? null);
  await registerProductMediaViaApi(
    companyId,
    productId,
    uploaded.map((item, sort_order) => ({ ...item, sort_order })),
    coverUrl,
  );

  return uploaded;
}

/** Upload one or more media files for a product */
export async function uploadProductMediaFiles(
  files: File[],
  companyId: string,
  productId: string,
  options?: { coverKey?: string | null; previews?: MediaPreviewRef[] },
): Promise<Array<{ url: string; media_type: MediaFileKind }>> {
  if (files.length === 0) return [];

  const previews = options?.previews ?? files.map((f, i) => ({ previewUrl: `file:${i}`, file: f }));

  try {
    return await saveProductMedia(files, companyId, productId, options?.coverKey ?? null, previews);
  } catch (primaryError) {
    const firstImage = files.find((f) => getMediaKind(f) === 'image');
    if (firstImage) {
      try {
        const url = await uploadProductImage(firstImage, companyId, productId);
        await setProductCoverImage(companyId, productId, url);
        return [{ url, media_type: 'image' }];
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}

export async function fetchProductMedia(
  productId: string,
): Promise<Array<{ id: string; url: string; media_type: 'image' | 'video' }>> {
  const { data, error } = await supabase
    .from('product_media')
    .select('id, url, media_type, sort_order')
    .eq('product_id', productId)
    .order('sort_order');

  if (error) return [];
  return (data ?? []) as Array<{ id: string; url: string; media_type: 'image' | 'video' }>;
}

export async function setProductCoverImage(
  companyId: string,
  productId: string,
  imageUrl: string,
) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/api/product-media/cover`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      company_id: companyId,
      product_id: productId,
      cover_url: imageUrl,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to set cover image');
  }
}
