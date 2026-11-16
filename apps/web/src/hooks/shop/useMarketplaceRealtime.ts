import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useEcommerceCatalogStore } from '../../stores/ecommerceCatalogStore';

/** Refresh marketplace catalog when products or warehouse stock change */
export function useMarketplaceRealtime(onRefresh: () => void) {
  const touchMarketplace = useEcommerceCatalogStore((s) => s.touchMarketplace);

  useEffect(() => {
    const channel = supabase
      .channel('marketplace-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          touchMarketplace();
          onRefresh();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'warehouse_inventory' },
        () => {
          touchMarketplace();
          onRefresh();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_media' },
        () => {
          touchMarketplace();
          onRefresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefresh, touchMarketplace]);
}
