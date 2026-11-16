import { supabase } from './supabase';

const BUCKET = 'product-images';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function validateBrandingImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Use JPG, PNG, WebP, or GIF';
  }
  if (file.size > MAX_BYTES) {
    return 'Image must be 5MB or smaller';
  }
  return null;
}

export async function uploadCompanyBranding(
  file: File,
  companyId: string,
  kind: 'logo' | 'banner',
): Promise<string> {
  const validationError = validateBrandingImage(file);
  if (validationError) throw new Error(validationError);

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${companyId}/branding/${kind}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });

  if (uploadError) {
    if (uploadError.message.includes('Bucket not found')) {
      throw new Error('Image storage not configured. Run migration 20250620140000_product_images.sql');
    }
    throw uploadError;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
