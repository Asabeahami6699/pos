import { getSupabaseAdmin } from './supabase.js';

function db(supabase: ReturnType<typeof getSupabaseAdmin>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

export interface PlatformSettings {
  platform_fee_percent: number;
  support_email: string | null;
  support_phone: string | null;
}

let cachedSettings: PlatformSettings | null = null;

function envDefaultFee(): number {
  const raw = Number(process.env.PLATFORM_FEE_PERCENT ?? 5);
  if (Number.isNaN(raw)) return 5;
  return Math.min(Math.max(raw, 0), 50);
}

function envSupportEmail(): string | null {
  const email = process.env.PLATFORM_SUPPORT_EMAIL?.trim();
  return email || null;
}

function envSupportPhone(): string | null {
  const phone = process.env.PLATFORM_SUPPORT_PHONE?.trim();
  return phone || null;
}

function normalizeSettings(row: Partial<PlatformSettings> | null | undefined): PlatformSettings {
  const feeRaw = row?.platform_fee_percent;
  const fee =
    feeRaw != null && !Number.isNaN(Number(feeRaw))
      ? Math.min(Math.max(Number(feeRaw), 0), 50)
      : envDefaultFee();

  return {
    platform_fee_percent: fee,
    support_email: row?.support_email?.trim() || envSupportEmail(),
    support_phone: row?.support_phone?.trim() || envSupportPhone(),
  };
}

export function getCachedPlatformFeePercent(): number {
  return cachedSettings?.platform_fee_percent ?? envDefaultFee();
}

export function getCachedPlatformSettings(): PlatformSettings {
  return cachedSettings ?? normalizeSettings(null);
}

export function setCachedPlatformSettings(settings: PlatformSettings): void {
  cachedSettings = settings;
}

export async function loadPlatformSettings(): Promise<PlatformSettings> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await db(supabase)
      .from('platform_settings')
      .select('platform_fee_percent, support_email, support_phone')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      const fallback = normalizeSettings(null);
      setCachedPlatformSettings(fallback);
      return fallback;
    }

    const settings = normalizeSettings(data as Partial<PlatformSettings> | null);
    setCachedPlatformSettings(settings);
    return settings;
  } catch {
    const fallback = normalizeSettings(null);
    setCachedPlatformSettings(fallback);
    return fallback;
  }
}

export async function updatePlatformSettings(
  updates: Partial<PlatformSettings>,
): Promise<PlatformSettings> {
  const current = await loadPlatformSettings();
  const next = normalizeSettings({
    platform_fee_percent:
      updates.platform_fee_percent != null ? updates.platform_fee_percent : current.platform_fee_percent,
    support_email:
      updates.support_email !== undefined ? updates.support_email : current.support_email,
    support_phone:
      updates.support_phone !== undefined ? updates.support_phone : current.support_phone,
  });

  const supabase = getSupabaseAdmin();
  const { error } = await db(supabase)
    .from('platform_settings')
    .upsert({
      id: 1,
      platform_fee_percent: next.platform_fee_percent,
      support_email: next.support_email,
      support_phone: next.support_phone,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  setCachedPlatformSettings(next);
  return next;
}

export function buildRenewalMailto(
  supportEmail: string,
  companyName: string,
  plan: string,
  renewalDate: string | null,
): string {
  const subject = encodeURIComponent(`Subscription renewal — ${companyName}`);
  const renewalLine = renewalDate
    ? `Renewal date: ${new Date(renewalDate).toLocaleDateString()}`
    : 'Renewal date: not set';
  const body = encodeURIComponent(
    `Hello,\n\nI would like to renew the ${plan} subscription for ${companyName}.\n\n${renewalLine}\n\nThank you.`,
  );
  return `mailto:${supportEmail}?subject=${subject}&body=${body}`;
}

export { computePlanRenewalDate } from '@pos-inventory/shared';
