import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/queryKeys';
import type { Product, Branch } from '../../types';
import { toast } from 'sonner';
import { saveCatalogCache, loadCatalogCache } from '../../lib/offline/catalogCache';
import { isOnline } from '../../lib/offline/network';

import { filterProductsByQuery, findProductByScanCode } from '../../lib/posProductMatch';

const PRODUCT_SELECT =
  'id, name, sku, barcode, price, wholesale_price, category, low_stock_threshold, image_url, company_id, description, cost_price';

async function fetchBranchProducts(branch: Branch): Promise<Product[]> {
  const { data: inventoryData, error: inventoryError } = await supabase
    .from('branch_inventory')
    .select('product_id, quantity')
    .eq('branch_id', branch.id);

  if (inventoryError) throw inventoryError;
  if (!inventoryData?.length) return [];

  const productIds = inventoryData.map((item) => item.product_id);
  let productsData: Array<Record<string, unknown>> | null = null;
  let productsError: { code?: string; message?: string } | null = null;

  const primary = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .in('id', productIds)
    .eq('company_id', branch.company_id)
    .order('name');

  productsData = primary.data;
  productsError = primary.error;

  if (productsError?.code === '42703') {
    const fallback = await supabase
      .from('products')
      .select(
        'id, name, sku, price, wholesale_price, category, low_stock_threshold, company_id, description, cost_price',
      )
      .in('id', productIds)
      .eq('company_id', branch.company_id)
      .order('name');
    productsData = fallback.data;
    productsError = fallback.error;
  }

  if (productsError) throw productsError;

  const inventoryMap = new Map(inventoryData.map((item) => [item.product_id, item.quantity]));

  return (productsData ?? []).map((row) => {
    const product = row as Product;
    return {
      ...product,
      sku: product.sku ?? '',
      stock: inventoryMap.get(product.id) || 0,
      is_low_stock: (inventoryMap.get(product.id) || 0) <= (product.low_stock_threshold || 5),
      last_updated: new Date().toISOString(),
    };
  });
}

async function loadProductsForBranch(branch: Branch): Promise<Product[]> {
  if (isOnline()) {
    try {
      const products = await fetchBranchProducts(branch);
      await saveCatalogCache(branch.id, branch.company_id, products);
      return products;
    } catch (error) {
      const cached = await loadCatalogCache(branch.id);
      if (cached?.length) {
        toast.info('Using cached catalog', { description: 'Could not reach server' });
        return cached;
      }
      throw error;
    }
  }

  const cached = await loadCatalogCache(branch.id);
  if (!cached?.length) {
    throw new Error('No offline catalog. Open POS once while online to download products.');
  }
  return cached;
}

export const useProducts = (selectedBranch: Branch | null, salesType: 'retail' | 'wholesale') => {
  const queryClient = useQueryClient();
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const productsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const inventoryChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const queryKey = selectedBranch
    ? queryKeys.branchProducts(selectedBranch.id, selectedBranch.company_id)
    : ['branch-products', 'disabled'];

  const { data: products = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => loadProductsForBranch(selectedBranch!),
    enabled: !!selectedBranch,
    staleTime: 30_000,
  });

  const fetchProductsForBranch = useCallback(async (_branchId: string) => {
    await refetch();
  }, [refetch]);

  // Setup real-time subscriptions for products and inventory
  const setupRealtimeSubscriptions = useCallback(() => {
    if (!selectedBranch) return;

    // Clean up existing channels
    if (productsChannelRef.current) {
      supabase.removeChannel(productsChannelRef.current);
      productsChannelRef.current = null;
    }
    if (inventoryChannelRef.current) {
      supabase.removeChannel(inventoryChannelRef.current);
      inventoryChannelRef.current = null;
    }

    // Subscribe to products table changes for THIS COMPANY only
    productsChannelRef.current = supabase
      .channel(`products-realtime:company=${selectedBranch.company_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `company_id=eq.${selectedBranch.company_id}`
        },
        async (payload) => {
          console.log('Products real-time update:', payload);
          
          // Check if this product is in our current branch
          const productId = payload.new?.id || payload.old?.id;
          const isInBranch = products.some(p => p.id === productId);
          
          // If product is deleted or not in our branch, ignore
          if (payload.eventType === 'DELETE' || !isInBranch) {
            return;
          }
          
          // Refresh products list via React Query
          if (selectedBranch) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.branchProducts(selectedBranch.id, selectedBranch.company_id),
            });
          }
          
          // Show toast notifications
          if (payload.eventType === 'UPDATE') {
            const product = payload.new;
            const oldProduct = payload.old;
            
            if (oldProduct.price !== product.price) {
              toast.info('Price Updated', {
                description: `${product.name} price changed to $${product.price}`,
                duration: 3000
              });
            }
          } else if (payload.eventType === 'INSERT') {
            toast.info('New Product Added', {
              description: `${payload.new.name} added to company inventory`,
              duration: 3000
            });
          }
        }
      )
      .subscribe();

    // Subscribe to branch inventory changes
    inventoryChannelRef.current = supabase
      .channel(`inventory-realtime:branch=${selectedBranch.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branch_inventory',
          filter: `branch_id=eq.${selectedBranch.id}`
        },
        async (payload) => {
          console.log('Inventory real-time update:', payload);
          
          const productId = payload.new?.product_id || payload.old?.product_id;
          
          if (!productId) return;

          // For INSERT (new product added to branch) or DELETE (product removed from branch)
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            if (selectedBranch) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.branchProducts(selectedBranch.id, selectedBranch.company_id),
              });
            }
            
            if (payload.eventType === 'INSERT') {
              toast.info('Product Added to Branch', {
                description: 'New product available in this branch',
                duration: 3000
              });
            }
            return;
          }

          // For UPDATE (stock quantity changed)
          if (payload.eventType === 'UPDATE') {
            const oldStock = payload.old?.quantity || 0;
            const newStock = payload.new?.quantity || 0;
            const change = newStock - oldStock;
            
            if (change !== 0 && selectedBranch) {
              queryClient.setQueryData<Product[]>(
                queryKeys.branchProducts(selectedBranch.id, selectedBranch.company_id),
                (prev) =>
                  (prev ?? []).map((product) =>
                    product.id === productId
                      ? {
                          ...product,
                          stock: newStock,
                          is_low_stock: newStock <= (product.low_stock_threshold || 5),
                          last_updated: new Date().toISOString(),
                        }
                      : product
                  )
              );
              
              if (Math.abs(change) >= 5) {
                const product = products.find((p) => p.id === productId);
                const productName = product?.name || 'Product';
                toast.info('Stock Updated', {
                  description: `${productName} stock ${change > 0 ? 'restocked' : 'reduced'} by ${Math.abs(change)} units`,
                  duration: 3000,
                });
              }
            }
          }
        }
      )
      .subscribe();
  }, [selectedBranch, products, queryClient]);

  // Filter products based on search query (name, SKU, barcode, category)
  useEffect(() => {
    setFilteredProducts(filterProductsByQuery(products, searchQuery));
  }, [searchQuery, products]);

  // Initialize and setup realtime
  useEffect(() => {
    if (selectedBranch) {
      fetchProductsForBranch(selectedBranch.id);
    }
    
    // Cleanup function
    return () => {
      if (productsChannelRef.current) {
        supabase.removeChannel(productsChannelRef.current);
      }
      if (inventoryChannelRef.current) {
        supabase.removeChannel(inventoryChannelRef.current);
      }
    };
  }, [selectedBranch, fetchProductsForBranch]);

  // Setup realtime subscriptions after products are loaded
  useEffect(() => {
    if (selectedBranch && products.length > 0) {
      setupRealtimeSubscriptions();
    }
  }, [selectedBranch, products, setupRealtimeSubscriptions]);

  const getProductPrice = useCallback((product: Product): number => {
    if (salesType === 'wholesale') {
      return product.wholesale_price || product.price * 0.8;
    }
    return product.price;
  }, [salesType]);

  // Helper function to manually update product stock (for optimistic updates)
  const updateProductStock = useCallback((productId: string, newStock: number) => {
    if (!selectedBranch) return;
    queryClient.setQueryData<Product[]>(
      queryKeys.branchProducts(selectedBranch.id, selectedBranch.company_id),
      (prev) =>
        (prev ?? []).map((product) =>
          product.id === productId
            ? {
                ...product,
                stock: newStock,
                is_low_stock: newStock <= (product.low_stock_threshold || 5),
                last_updated: new Date().toISOString(),
              }
            : product
        )
    );
  }, [queryClient, selectedBranch]);

  const refreshFromLocalCache = useCallback(async () => {
    if (!selectedBranch) return;
    const cached = await loadCatalogCache(selectedBranch.id);
    if (cached) {
      queryClient.setQueryData(
        queryKeys.branchProducts(selectedBranch.id, selectedBranch.company_id),
        cached,
      );
    }
  }, [queryClient, selectedBranch]);

  const lookupByScanCode = useCallback(
    (code: string) => findProductByScanCode(products, code),
    [products],
  );

  return {
    products,
    filteredProducts,
    searchQuery,
    setSearchQuery,
    loading,
    fetchProductsForBranch,
    getProductPrice,
    updateProductStock,
    refreshFromLocalCache,
    lookupByScanCode,
  };
};