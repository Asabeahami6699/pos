// src/hooks/useRealtimeSubscriptions.ts
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { invalidateQueriesForTable } from '../lib/queryKeys';

export type SubscriptionCallbacks = {
  onProductsChange?: () => void;
  onBranchesChange?: () => void;
  onRestockRequestsChange?: () => void;
  onSalesChange?: () => void;
  onUsersChange?: () => void;
  onBranchInventoryChange?: () => void;
  onWarehouseInventoryChange?: () => void;
  onNotificationsChange?: () => void;
  onPriceHistoryChange?: () => void;
  onAllocationsChange?: () => void;
  onReturnsChange?: () => void;
  onSaleItemsChange?: () => void;
  onCentralInventoryChange?: () => void;
  onAllocationItemsChange?: () => void;
  onOnlineOrdersChange?: () => void;
};

const isDev = import.meta.env.DEV;

export const useRealtimeSubscriptions = (
  companyId: string | null,
  callbacks: SubscriptionCallbacks = {},
  enabled: boolean = true,
) => {
  const subscriptionSetupRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelsRef = useRef<any[]>([]);

  useEffect(() => {
    if (!companyId || !enabled) {
      return;
    }

    if (subscriptionSetupRef.current) {
      return;
    }

    subscriptionSetupRef.current = true;

    const cleanupChannels = () => {
      if (channelsRef.current.length > 0) {
        channelsRef.current.forEach((channel) => {
          if (channel) supabase.removeChannel(channel);
        });
        channelsRef.current = [];
      }
    };

    cleanupChannels();

    const createSubscription = (
      channelName: string,
      table: string,
      hasCompanyFilter: boolean,
      callbackKey: keyof SubscriptionCallbacks,
      description: string,
    ) => {
      try {
        const channel = supabase
          .channel(`realtime:${channelName}-${companyId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table,
              filter: hasCompanyFilter ? `company_id=eq.${companyId}` : undefined,
            },
            () => {
              if (companyId) {
                invalidateQueriesForTable(queryClient, table, companyId);
              }
              const callback = callbacks[callbackKey];
              if (callback) {
                setTimeout(() => callback(), 50);
              }
            },
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.error(`Realtime subscription failed: ${description}`);
            } else if (isDev && status === 'TIMED_OUT') {
              console.warn(`Realtime timed out: ${description}`);
            }
          });

        channelsRef.current.push(channel);
        return channel;
      } catch (error) {
        console.error(`Failed to create ${description} subscription:`, error);
        return null;
      }
    };

    createSubscription('products', 'products', true, 'onProductsChange', 'Products');
    createSubscription('branches', 'branches', true, 'onBranchesChange', 'Branches');
    createSubscription('restock', 'restock_requests', true, 'onRestockRequestsChange', 'Restock');
    createSubscription('sales', 'sales', true, 'onSalesChange', 'Sales');
    createSubscription('sale-items', 'sale_items', true, 'onSaleItemsChange', 'Sale Items');
    createSubscription('users', 'users', true, 'onUsersChange', 'Users');
    createSubscription(
      'branch-inventory',
      'branch_inventory',
      true,
      'onBranchInventoryChange',
      'Branch Inventory',
    );
    createSubscription(
      'warehouse-inventory',
      'warehouse_inventory',
      true,
      'onWarehouseInventoryChange',
      'Warehouse Inventory',
    );
    createSubscription(
      'central-inventory',
      'central_inventory',
      true,
      'onCentralInventoryChange',
      'Central Inventory',
    );
    createSubscription('allocations', 'allocations', true, 'onAllocationsChange', 'Allocations');
    createSubscription(
      'allocation-items',
      'allocation_items',
      true,
      'onAllocationItemsChange',
      'Allocation Items',
    );
    createSubscription('notifications', 'notifications', true, 'onNotificationsChange', 'Notifications');
    createSubscription('price-history', 'price_history', true, 'onPriceHistoryChange', 'Price History');
    createSubscription('returns', 'returns', true, 'onReturnsChange', 'Returns');
    createSubscription(
      'online-orders',
      'online_orders',
      true,
      'onOnlineOrdersChange',
      'Online Orders',
    );

    return () => {
      subscriptionSetupRef.current = false;
      cleanupChannels();
    };
    // Callbacks intentionally omitted — changing them should not re-subscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, enabled]);
};

/** Dev-only helper for browser console debugging */
export const debugRealtimeSubscriptions = () => {
  if (typeof window === 'undefined' || !isDev) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).supabaseDebug = {
    listChannels: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const channels = (supabase as any).getChannels();
      console.log('Active Supabase Channels:', channels.length);
      return channels;
    },
    removeAllChannels: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const channels = (supabase as any).getChannels();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channels.forEach((ch: any) => supabase.removeChannel(ch));
    },
  };
};
