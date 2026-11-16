import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export interface AllocationItem {
  id: string;
  allocation_id: string;
  product_id: string;
  retail_quantity: number;
  wholesale_quantity: number;
  products?: {
    name: string;
    sku: string;
  };
}

export interface Allocation {
  id: string;
  to_branch_id: string;
  /** @deprecated legacy column; prefer to_branch_id */
  branch_id?: string;
  allocated_by: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  sales_type?: string;
  from_warehouse?: boolean | null;
  branches?: {
    name: string;
  };
  users?: {
    full_name: string;
  };
  allocation_items?: AllocationItem[];
}

export const useAllocations = (companyId: string | null) => {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAllocations = useCallback(async (companyId: string) => {
    try {
      const { data: allocationsData, error } = await supabase
        .from('allocations')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (!allocationsData || allocationsData.length === 0) {
        setAllocations([]);
        return;
      }

      const branchIds = [
        ...new Set(
          allocationsData
            .map((a) => a.to_branch_id || a.branch_id)
            .filter(Boolean) as string[],
        ),
      ];
      const userIds = [...new Set(allocationsData.map(a => a.allocated_by).filter(Boolean))];
      const allocationIds = allocationsData.map(a => a.id);

      const [branchesData, usersData, allocationItemsData] = await Promise.all([
        branchIds.length > 0 
          ? supabase.from('branches').select('id, name').in('id', branchIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length > 0 
          ? supabase.from('users').select('id, full_name').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
        allocationIds.length > 0 
          ? supabase.from('allocation_items').select('*').in('allocation_id', allocationIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      let productMap = new Map();
      if (allocationItemsData.data && allocationItemsData.data.length > 0) {
        const itemProductIds = [...new Set(allocationItemsData.data.map(item => item.product_id).filter(Boolean))];
        
        if (itemProductIds.length > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('id, name, sku')
            .in('id', itemProductIds);
          
          (productsData || []).forEach(product => {
            productMap.set(product.id, product);
          });
        }
      }

      const branchMap = new Map();
      (branchesData.data || []).forEach(branch => {
        branchMap.set(branch.id, branch);
      });

      const userMap = new Map();
      (usersData.data || []).forEach(user => {
        userMap.set(user.id, user);
      });

      const allocationItemsMap = new Map();
      (allocationItemsData.data || []).forEach(item => {
        const items = allocationItemsMap.get(item.allocation_id) || [];
        items.push({
          ...item,
          products: item.product_id ? productMap.get(item.product_id) : undefined
        });
        allocationItemsMap.set(item.allocation_id, items);
      });

      const enrichedAllocations = allocationsData.map((allocation) => {
        const branchId = allocation.to_branch_id || allocation.branch_id;
        return {
          ...allocation,
          to_branch_id: branchId || allocation.to_branch_id,
          branches: branchId ? branchMap.get(branchId) : undefined,
          users: allocation.allocated_by ? userMap.get(allocation.allocated_by) : undefined,
          allocation_items: allocationItemsMap.get(allocation.id) || [],
        };
      });

      setAllocations(enrichedAllocations);
    } catch (error) {
      console.error('Error fetching allocations:', error);
    }
  }, []);

  useEffect(() => {
    if (companyId) {
      setLoading(true);
      fetchAllocations(companyId).finally(() => setLoading(false));
    }
  }, [companyId, fetchAllocations]);

  return {
    allocations,
    loading,
    fetchAllocations: () => companyId && fetchAllocations(companyId),
    setAllocations
  };
};