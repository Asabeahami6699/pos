import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import type { Return, Branch, ReturnsFilters } from '../../types/index.ts';

export const useReturns = (selectedBranch: Branch | null, filters: ReturnsFilters) => {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(false);
  const returnsChannelRef = useRef<any>(null);

  const fetchReturns = useCallback(async () => {
    if (!selectedBranch) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('returns')
        .select(`
          *,
          return_items (
            *,
            products (name, sku, price)
          ),
          branches (name),
          staff:users!returns_salesperson_id_fkey (full_name),
          resolved_by_user:users!returns_resolved_by_fkey (full_name)
        `)
        .eq('branch_id', selectedBranch.id)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (selectedBranch.company_id) {
        query = query.or(`company_id.eq.${selectedBranch.company_id},company_id.is.null`);
      }
      
      query = query
        .gte('created_at', filters.dateRange.from)
        .lte('created_at', filters.dateRange.to);
      
      const { data, error } = await query;
      
      if (error) throw error;
      setReturns(data || []);
    } catch (error) {
      console.error('Error fetching returns:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, filters.dateRange]);

  // Setup real-time subscription for returns
  const setupRealtimeSubscription = useCallback(() => {
    if (!selectedBranch) return;

    if (returnsChannelRef.current) {
      supabase.removeChannel(returnsChannelRef.current);
      returnsChannelRef.current = null;
    }

    returnsChannelRef.current = supabase
      .channel(`returns-realtime:branch=${selectedBranch.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'returns',
          filter: `branch_id=eq.${selectedBranch.id}`
        },
        async (payload) => {
          console.log('Returns real-time update:', payload);
          
          // Refresh the list
          await fetchReturns();
          
          // Show notifications for status changes
          if (payload.eventType === 'UPDATE') {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            
            if (oldStatus !== newStatus) {
              if (newStatus === 'approved') {
                toast.success('Return Approved', {
                  description: 'Return has been approved',
                  duration: 3000
                });
              } else if (newStatus === 'completed') {
                toast.success('Return Completed', {
                  description: 'Return has been processed',
                  duration: 3000
                });
              } else if (newStatus === 'rejected') {
                toast.error('Return Rejected', {
                  description: 'Return has been rejected',
                  duration: 3000
                });
              }
            }
          } else if (payload.eventType === 'INSERT') {
            toast.info('New Return Created', {
              description: 'A new return has been created',
              duration: 3000
            });
          }
        }
      )
      .subscribe();
  }, [selectedBranch, fetchReturns]);

  useEffect(() => {
    if (selectedBranch) {
      fetchReturns();
      setupRealtimeSubscription();
    }
    
    return () => {
      if (returnsChannelRef.current) {
        supabase.removeChannel(returnsChannelRef.current);
      }
    };
  }, [selectedBranch, fetchReturns, setupRealtimeSubscription]);

  return {
    returns,
    loading,
    fetchReturns
  };
};