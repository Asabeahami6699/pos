import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface PriceHistory {
  id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  change_type: 'retail' | 'wholesale';
  changed_by: string;
  changed_at: string;
  company_id: string;
  quantity_at_change: number;
  products?: {
    name: string;
    sku: string;
  };
  users?: {
    full_name: string;
  };
}

type PriceHistoryRow = {
  id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  change_type?: string | null;
  reason?: string | null;
  changed_by: string;
  changed_at?: string | null;
  created_at?: string | null;
  company_id: string;
  quantity_at_change?: number | null;
};

function mapChangeType(row: PriceHistoryRow): 'retail' | 'wholesale' {
  const raw = (row.change_type || row.reason || 'retail').toLowerCase();
  return raw.includes('wholesale') ? 'wholesale' : 'retail';
}

export const usePriceHistory = (companyId: string | null) => {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPriceHistory = useCallback(async (companyId: string) => {
    try {
      // Prefer changed_at when migration applied; fall back to created_at
      let priceData: PriceHistoryRow[] | null = null;

      const primary = await supabase
        .from('price_history')
        .select('*')
        .eq('company_id', companyId)
        .order('changed_at', { ascending: false })
        .limit(50);

      if (primary.error?.code === '42703') {
        const fallback = await supabase
          .from('price_history')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (fallback.error) throw fallback.error;
        priceData = (fallback.data ?? []) as PriceHistoryRow[];
      } else if (primary.error) {
        throw primary.error;
      } else {
        priceData = (primary.data ?? []) as PriceHistoryRow[];
      }

      if (!priceData || priceData.length === 0) {
        setPriceHistory([]);
        return;
      }

      const productIds = [...new Set(priceData.map((ph) => ph.product_id).filter(Boolean))];
      const userIds = [...new Set(priceData.map((ph) => ph.changed_by).filter(Boolean))];

      const [productsData, usersData] = await Promise.all([
        productIds.length > 0
          ? supabase.from('products').select('id, name, sku').in('id', productIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length > 0
          ? supabase.from('users').select('id, full_name').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const productMap = new Map();
      (productsData.data || []).forEach((product) => {
        productMap.set(product.id, product);
      });

      const userMap = new Map();
      (usersData.data || []).forEach((user) => {
        userMap.set(user.id, user);
      });

      const enrichedPriceHistory: PriceHistory[] = priceData.map((record) => ({
        id: record.id,
        product_id: record.product_id,
        old_price: Number(record.old_price),
        new_price: Number(record.new_price),
        change_type: mapChangeType(record),
        changed_by: record.changed_by,
        changed_at: record.changed_at || record.created_at || new Date().toISOString(),
        company_id: record.company_id,
        quantity_at_change: Number(record.quantity_at_change ?? 0),
        products: record.product_id ? productMap.get(record.product_id) : undefined,
        users: record.changed_by ? userMap.get(record.changed_by) : undefined,
      }));

      setPriceHistory(enrichedPriceHistory);
    } catch (error) {
      console.error('Error fetching price history:', error);
    }
  }, []);

  useEffect(() => {
    if (companyId) {
      setLoading(true);
      fetchPriceHistory(companyId).finally(() => setLoading(false));
    }
  }, [companyId, fetchPriceHistory]);

  return {
    priceHistory,
    loading,
    fetchPriceHistory: () => companyId && fetchPriceHistory(companyId),
    setPriceHistory,
  };
};
