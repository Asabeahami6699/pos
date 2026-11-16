// hooks/useRestockRequests.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export interface RestockRequest {
  id: string;
  product_id: string;
  branch_id: string;
  requested_by: string;
  requested_quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  created_at: string;
  product_name?: string;
  product_sku?: string;
  product_price?: number;
  branch_name?: string;
  staff_name?: string;
  items?: Array<{
    product_id: string;
    requested_quantity: number;
    product_name?: string;
    sku?: string;
    price?: number;
  }> | null;
  admin_notes?: string;
  fulfilled_quantity?: number;
  company_id?: string;
}

export type RequestFilter = 'all' | 'pending' | 'approved' | 'fulfilled' | 'rejected';

export const useRestockRequests = (companyId: string | null) => {
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRestockRequests = useCallback(async (companyId: string, abortSignal?: AbortSignal) => {
    try {
      const { data: requests, error } = await supabase
        .from('restock_requests')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .abortSignal(abortSignal);  // Pass the abort signal to Supabase

      if (error) throw error;
      if (!requests || requests.length === 0) {
        setRestockRequests([]);
        return;
      }

      // Extract unique IDs
      const productIds = [...new Set(requests.map(r => r.product_id).filter(Boolean))];
      const branchIds = [...new Set(requests.map(r => r.branch_id).filter(Boolean))];
      const userIds = [...new Set(requests.map(r => r.requested_by).filter(Boolean))];

      // Fetch related data in parallel (also pass abortSignal if supported, but Supabase may not for all queries—check docs)
      const [productsData, branchesData, usersData] = await Promise.all([
        productIds.length > 0 
          ? supabase.from('products').select('id, name, sku, price').in('id', productIds).abortSignal(abortSignal)
          : Promise.resolve({ data: [], error: null }),
        branchIds.length > 0 
          ? supabase.from('branches').select('id, name').in('id', branchIds).abortSignal(abortSignal)
          : Promise.resolve({ data: [], error: null }),
        userIds.length > 0 
          ? supabase.from('users').select('id, full_name').in('id', userIds).abortSignal(abortSignal)
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Create lookup maps
      const productMap = new Map();
      (productsData.data || []).forEach(product => {
        productMap.set(product.id, product);
      });

      const branchMap = new Map();
      (branchesData.data || []).forEach(branch => {
        branchMap.set(branch.id, branch);
      });

      const userMap = new Map();
      (usersData.data || []).forEach(user => {
        userMap.set(user.id, user);
      });

      // Enrich requests with related data
      const enrichedRequests = requests.map(request => {
        const product = productMap.get(request.product_id);
        const branch = branchMap.get(request.branch_id);
        const user = userMap.get(request.requested_by);

        return {
          ...request,
          product_name: product?.name,
          product_sku: product?.sku,
          product_price: product?.price,
          branch_name: branch?.name,
          staff_name: user?.full_name || 'Unknown Staff'
        };
      });

      setRestockRequests(enrichedRequests);
    } catch (error: any) {
      // Handle AbortError specifically—don't log or toast
      if (error.name === 'AbortError') {
        console.log('Restock requests fetch aborted');
        return;
      }
      console.error('Error fetching restock requests:', error);
      toast.error('Requests Fetch Error', {
        description: error.message || 'Failed to fetch restock requests'
      });
    }
  }, []);

  const handleUpdateRestockStatus = useCallback(async (
    requestId: string,
    status: string,
    currentRequests: RestockRequest[]
  ) => {
    const request = currentRequests.find(r => r.id === requestId);
    if (!request) return false;
    
    const statusMessages = {
      approved: 'Approved',
      rejected: 'Rejected',
      fulfilled: 'Fulfilled'
    };
    
    const toastId = toast.loading(`Updating request status...`);
    
    try {
      const updateData: any = { status };
      
      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
      } else if (status === 'rejected') {
        updateData.rejected_at = new Date().toISOString();
      } else if (status === 'fulfilled') {
        updateData.fulfilled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('restock_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;
      
      // Update local state
      setRestockRequests(prev => 
        prev.map(req => 
          req.id === requestId ? { ...req, ...updateData } : req
        )
      );
      
      toast.success('Status Updated', {
        description: `Request has been ${statusMessages[status as keyof typeof statusMessages] || status.toLowerCase()}`,
        id: toastId
      });
      
      // Refresh data after a delay
      setTimeout(() => {
        if (companyId) {
          fetchRestockRequests(companyId);
        }
      }, 500);
      
      return true;
    } catch (error: any) {
      console.error('Update restock status error:', error);
      toast.error('Update Failed', {
        description: error.message || 'Failed to update request status',
        id: toastId
      });
      return false;
    }
  }, [companyId, fetchRestockRequests]);

  const filteredRequests = useCallback((filter: RequestFilter) => {
    if (filter === 'all') {
      return restockRequests;
    }
    return restockRequests.filter(request => request.status === filter);
  }, [restockRequests]);

  // Initial fetch with AbortController for cleanup
  useEffect(() => {
    if (companyId) {
      setLoading(true);
      const abortController = new AbortController();
      fetchRestockRequests(companyId, abortController.signal).finally(() => setLoading(false));
      
      // Cleanup: Abort the request if component unmounts
      return () => abortController.abort();
    }
  }, [companyId, fetchRestockRequests]);

  return {
    // State
    restockRequests,
    loading,
    
    // Functions
    fetchRestockRequests: () => companyId && fetchRestockRequests(companyId),
    handleUpdateRestockStatus,
    filteredRequests,
    
    // State setter
    setRestockRequests
  };
};