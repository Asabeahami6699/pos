import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

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

export const usePriceHistory = (companyId: string | null) => {
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPriceHistory = useCallback(async (companyId: string) => {
    try {
      const { data: priceData, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('company_id', companyId)
        .order('changed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      if (!priceData || priceData.length === 0) {
        setPriceHistory([]);
        return;
      }

      const productIds = [...new Set(priceData.map(ph => ph.product_id).filter(Boolean))];
      const userIds = [...new Set(priceData.map(ph => ph.changed_by).filter(Boolean))];

      const [productsData, usersData] = await Promise.all([
        productIds.length > 0 
          ? supabase.from('products').select('id, name, sku').in('id', productIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length > 0 
          ? supabase.from('users').select('id, full_name').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const productMap = new Map();
      (productsData.data || []).forEach(product => {
        productMap.set(product.id, product);
      });

      const userMap = new Map();
      (usersData.data || []).forEach(user => {
        userMap.set(user.id, user);
      });

      const enrichedPriceHistory = priceData.map(record => ({
        ...record,
        products: record.product_id ? productMap.get(record.product_id) : undefined,
        users: record.changed_by ? userMap.get(record.changed_by) : undefined
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
    setPriceHistory
  };
};