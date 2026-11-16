import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/queryKeys';
import type { Sale, Branch, HistoryFilters } from '../../types/index';
import { toast } from 'sonner';

async function fetchSalesHistoryData(branch: Branch, filters: HistoryFilters): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      sale_items (
        *,
        products (name, sku)
      ),
      users (full_name)
    `)
    .eq('branch_id', branch.id)
    .gte('created_at', filters.dateRange.from)
    .lte('created_at', filters.dateRange.to)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (sale) => {
      const { data: returnsData } = await supabase
        .from('returns')
        .select('total_refund')
        .eq('sale_id', sale.id)
        .eq('status', 'completed');

      const totalRefunded = returnsData?.reduce((sum, r) => sum + (r.total_refund || 0), 0) || 0;
      const allItems = sale.sale_items || [];
      const refundedItems = returnsData?.length || 0;

      let returnStatus: 'none' | 'partially_returned' | 'fully_returned' = 'none';
      if (refundedItems > 0) {
        returnStatus = refundedItems >= allItems.length ? 'fully_returned' : 'partially_returned';
      }

      return {
        ...sale,
        return_status: returnStatus,
        refunded_amount: totalRefunded,
      } as Sale;
    })
  );
}

export const useSalesHistory = (selectedBranch: Branch | null, filters: HistoryFilters) => {
  const queryClient = useQueryClient();
  const salesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const queryKey = selectedBranch
    ? queryKeys.salesHistory(selectedBranch.id, filters.dateRange.from, filters.dateRange.to)
    : ['sales-history', 'disabled'];

  const { data: sales = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchSalesHistoryData(selectedBranch!, filters),
    enabled: !!selectedBranch,
  });

  const fetchSalesHistory = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    if (!selectedBranch) return;

    if (salesChannelRef.current) {
      supabase.removeChannel(salesChannelRef.current);
    }

    salesChannelRef.current = supabase
      .channel(`sales-history-realtime:branch=${selectedBranch.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales',
          filter: `branch_id=eq.${selectedBranch.id}`,
        },
        async (payload) => {
          queryClient.invalidateQueries({ queryKey });
          const sale = payload.new as { id: string; total?: number };
          const saleNumber = sale.id.slice(-8).toUpperCase();
          toast.success('New Sale', {
            description: `Sale #${saleNumber} recorded`,
            duration: 3000,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales',
          filter: `branch_id=eq.${selectedBranch.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      if (salesChannelRef.current) {
        supabase.removeChannel(salesChannelRef.current);
      }
    };
  }, [selectedBranch, queryClient, queryKey]);

  return {
    sales,
    loading,
    fetchSalesHistory,
  };
};
