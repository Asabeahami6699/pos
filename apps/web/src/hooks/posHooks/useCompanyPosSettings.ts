import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface CompanyPosSettings {
  taxRatePercent: number;
  discountsEnabled: boolean;
  maxDiscountPercent: number;
  quickDiscounts: number[];
  supportPhone: string | null;
  supportEmail: string | null;
  companyName: string | null;
}

const DEFAULTS: CompanyPosSettings = {
  taxRatePercent: 16,
  discountsEnabled: true,
  maxDiscountPercent: 100,
  quickDiscounts: [5, 10, 15],
  supportPhone: null,
  supportEmail: null,
  companyName: null,
};

function parseQuickDiscounts(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    const nums = raw
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 100);
    return nums.length ? nums : DEFAULTS.quickDiscounts;
  }
  if (typeof raw === 'string') {
    try {
      return parseQuickDiscounts(JSON.parse(raw));
    } catch {
      return DEFAULTS.quickDiscounts;
    }
  }
  return DEFAULTS.quickDiscounts;
}

export function useCompanyPosSettings(companyId?: string | null) {
  const [settings, setSettings] = useState<CompanyPosSettings>(DEFAULTS);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setSettings(DEFAULTS);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select(
          'name, tax_rate_percent, pos_discounts_enabled, pos_max_discount_percent, pos_quick_discounts, support_phone, support_email, phone',
        )
        .eq('id', companyId)
        .maybeSingle();

      if (error) {
        // Columns may not exist yet — fall back to phone-only / defaults
        if (error.code === '42703') {
          const fallback = await supabase
            .from('companies')
            .select('name, phone')
            .eq('id', companyId)
            .maybeSingle();
          if (fallback.data) {
            setSettings({
              ...DEFAULTS,
              companyName: fallback.data.name ?? null,
              supportPhone: fallback.data.phone ?? null,
            });
          }
          return;
        }
        throw error;
      }

      if (!data) {
        setSettings(DEFAULTS);
        return;
      }

      const row = data as Record<string, unknown>;
      const tax = Number(row.tax_rate_percent);
      const maxDisc = Number(row.pos_max_discount_percent);

      setSettings({
        taxRatePercent: Number.isFinite(tax) ? tax : DEFAULTS.taxRatePercent,
        discountsEnabled: row.pos_discounts_enabled !== false,
        maxDiscountPercent: Number.isFinite(maxDisc) ? maxDisc : DEFAULTS.maxDiscountPercent,
        quickDiscounts: parseQuickDiscounts(row.pos_quick_discounts),
        supportPhone:
          (typeof row.support_phone === 'string' && row.support_phone.trim()) ||
          (typeof row.phone === 'string' && row.phone.trim()) ||
          null,
        supportEmail:
          typeof row.support_email === 'string' && row.support_email.trim()
            ? row.support_email.trim()
            : null,
        companyName: typeof row.name === 'string' ? row.name : null,
      });
    } catch (e) {
      console.error('Failed to load company POS settings', e);
      setSettings(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { settings, loading, refresh };
}
