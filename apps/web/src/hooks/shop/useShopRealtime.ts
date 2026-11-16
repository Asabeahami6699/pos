import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';

export function useShopRealtime(companyId: string | undefined, onRefresh?: () => void) {
  const updateProductStock = useEcommerceCatalogStore((s) => s.updateProductStock);
  const touchStore = useEcommerceCatalogStore((s) => s.touchStore);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`shop:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          touchStore(companyId);
          onRefreshRef.current?.();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'warehouse_inventory',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const productId = (payload.new as { product_id?: string })?.product_id;
          const quantity = (payload.new as { quantity?: number })?.quantity ?? 0;
          if (productId) {
            updateProductStock(companyId, productId, quantity);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, touchStore, updateProductStock]);
}
