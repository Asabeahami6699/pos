// src/hooks/useRealtimeSubscriptions.ts - FIXED VERSION
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
};

export const useRealtimeSubscriptions = (
  companyId: string | null,
  callbacks: SubscriptionCallbacks = {},
  enabled: boolean = true // ← This should control when subscriptions start
) => {
  const subscriptionSetupRef = useRef(false);
  const channelsRef = useRef<any[]>([]);

  useEffect(() => {
    // ========== FIX: Wait for all conditions before subscribing ==========
    if (!companyId) {
      console.log('⏸️ No company ID - subscriptions disabled');
      return;
    }

    if (!enabled) {
      console.log('⏸️ Initial data not loaded yet - waiting...');
      return;
    }

    // Prevent duplicate setup
    if (subscriptionSetupRef.current) {
      console.log('⚠️ Subscriptions already set up, skipping...');
      return;
    }

    console.log(`🔌 Setting up COMPLETE real-time subscriptions for company: ${companyId}`);
    console.log(`✅ Initial data loaded: ${enabled}`);
    subscriptionSetupRef.current = true;
    
    // Clear any existing channels first
    const cleanupChannels = () => {
      if (channelsRef.current.length > 0) {
        console.log('🧹 Cleaning up existing channels...');
        channelsRef.current.forEach(channel => {
          if (channel) {
            supabase.removeChannel(channel);
          }
        });
        channelsRef.current = [];
      }
    };

    cleanupChannels();

    // Helper function to create subscription with retry logic
    const createSubscription = (
      channelName: string,
      table: string,
      hasCompanyFilter: boolean,
      callbackKey: keyof SubscriptionCallbacks,
      description: string
    ) => {
      try {
        const channel = supabase
          .channel(`realtime:${channelName}-${companyId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: table,
              filter: hasCompanyFilter ? `company_id=eq.${companyId}` : undefined
            },
            (payload) => {
              console.log(`📊 ${description}:`, payload.eventType);
              if (companyId) {
                invalidateQueriesForTable(queryClient, table, companyId);
              }
              const callback = callbacks[callbackKey];
              if (callback) {
                // Small delay to prevent race conditions
                setTimeout(() => callback(), 50);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log(`✅ ${description} - Subscribed`);
            } else if (status === 'CHANNEL_ERROR') {
              console.error(`❌ ${description} - Subscription failed`);
            } else if (status === 'TIMED_OUT') {
              console.warn(`⏱️ ${description} - Timed out, will retry`);
            } else if (status === 'CLOSED') {
              console.warn(`🔒 ${description} - Channel closed`);
            }
          });
        
        channelsRef.current.push(channel);
        return channel;
      } catch (error) {
        console.error(`❌ Failed to create ${description} subscription:`, error);
        return null;
      }
    };

    // ========== CRITICAL ANALYTICS CHANNELS ==========

    // Products subscription
    createSubscription(
      'products',
      'products',
      true,
      'onProductsChange',
      'Products'
    );

    // Branches subscription
    createSubscription(
      'branches',
      'branches',
      true,
      'onBranchesChange',
      'Branches'
    );

    // Sales subscription - MOST CRITICAL
    createSubscription(
      'sales',
      'sales',
      true,
      'onSalesChange',
      'Sales'
    );

    // Sale Items subscription
    createSubscription(
      'sale-items',
      'sale_items',
      false,
      'onSaleItemsChange',
      'Sale Items'
    );

    // Branch Inventory subscription
    createSubscription(
      'branch-inventory',
      'branch_inventory',
      true,
      'onBranchInventoryChange',
      'Branch Inventory'
    );

    // Warehouse Inventory subscription
    createSubscription(
      'warehouse-inventory',
      'warehouse_inventory',
      true,
      'onWarehouseInventoryChange',
      'Warehouse Inventory'
    );

    // Allocations subscription
    createSubscription(
      'allocations',
      'allocations',
      true,
      'onAllocationsChange',
      'Allocations'
    );

    // Allocation Items subscription
    createSubscription(
      'allocation-items',
      'allocation_items',
      false,
      'onAllocationItemsChange',
      'Allocation Items'
    );

    // ========== SUPPORTING CHANNELS ==========

    // Restock Requests subscription
    createSubscription(
      'restock-requests',
      'restock_requests',
      true,
      'onRestockRequestsChange',
      'Restock Requests'
    );

    // Users subscription
    createSubscription(
      'users',
      'users',
      true,
      'onUsersChange',
      'Users'
    );

    // Central Inventory subscription
    createSubscription(
      'central-inventory',
      'central_inventory',
      true,
      'onCentralInventoryChange',
      'Central Inventory'
    );

    // ========== ADDITIONAL CHANNELS ==========

    // Notifications subscription
    createSubscription(
      'notifications',
      'notifications',
      true,
      'onNotificationsChange',
      'Notifications'
    );

    // Price History subscription
    createSubscription(
      'price-history',
      'price_history',
      true,
      'onPriceHistoryChange',
      'Price History'
    );

    // Returns subscription
    createSubscription(
      'returns',
      'returns',
      true,
      'onReturnsChange',
      'Returns'
    );

    console.log(`✅ FULL real-time subscriptions active for company: ${companyId}`);
    console.log(`📡 Monitoring 14 database tables for changes:`);
    console.log(`📊 Analytics Tables (12): products, branches, sales, sale_items, branch_inventory, warehouse_inventory, allocations, allocation_items, restock_requests, users, central_inventory`);
    console.log(`📋 Additional Tables (3): notifications, price_history, returns`);
    
    // Log channel status
    setTimeout(() => {
      console.log('📈 Channel Status Report:');
      channelsRef.current.forEach((channel, index) => {
        const state = (channel as any).state || 'unknown';
        console.log(`   ${index + 1}. ${channel.topic} - ${state}`);
      });
    }, 2000);

    // Cleanup function
    return () => {
      console.log('🔌 Unsubscribing from all real-time channels...');
      subscriptionSetupRef.current = false;
      cleanupChannels();
      console.log('✅ All channels unsubscribed');
    };
  }, [companyId, enabled]); // ← FIX: Dependencies should include 'enabled'
  
  // ========== IMPORTANT: Don't depend on callbacks to avoid re-setup ==========
  // Callbacks changing shouldn't trigger re-subscription
};

// Debug helper for browser console
export const debugRealtimeSubscriptions = () => {
  if (typeof window !== 'undefined') {
    (window as any).supabaseDebug = {
      listChannels: () => {
        const channels = (supabase as any).getChannels();
        console.log('📡 Active Supabase Channels:', channels.length);
        channels.forEach((ch: any, i: number) => {
          console.log(`   ${i + 1}. ${ch.topic} - ${ch.state}`);
        });
        return channels;
      },
      removeAllChannels: () => {
        const channels = (supabase as any).getChannels();
        channels.forEach((ch: any) => {
          supabase.removeChannel(ch);
        });
        console.log('✅ Removed all channels');
      },
      testConnection: async () => {
        console.log('🧪 Testing Supabase connection...');
        const { data, error } = await supabase.from('products').select('count').limit(1);
        if (error) {
          console.error('❌ Connection test failed:', error);
        } else {
          console.log('✅ Connection test successful:', data);
        }
      }
    };
    console.log('🛠️ Debug tools loaded. Available commands:');
    console.log('   window.supabaseDebug.listChannels()');
    console.log('   window.supabaseDebug.removeAllChannels()');
    console.log('   window.supabaseDebug.testConnection()');
  }
};