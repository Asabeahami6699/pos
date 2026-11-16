import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { RestockRequest, Branch, RestockFilters } from '../../types/index';
import { toast } from 'sonner';

export const useRestockRequests = (selectedBranch: Branch | null, filters: RestockFilters) => {
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const restockChannelRef = useRef<any>(null);

  // ✅ FIXED: Fetch with product enrichment
  const fetchRestockRequests = useCallback(async () => {
    if (!selectedBranch) return;
    
    setLoading(true);
    try {
      console.log('Fetching restock requests for branch:', selectedBranch.id);
      
      // Step 1: Fetch restock requests
      const { data, error } = await supabase
        .from('restock_requests')
        .select(`
          id,
          product_id,
          requested_quantity,
          company_id,
          branch_id,
          created_at,
          items,
          notes,
          admin_notes,
          status,
          delivery_status,
          delivery_date,
          delivered_by,
          requested_by,
          invoice_number,
          fulfilled_at,
          fulfilled_quantity,
          approved_at,
          rejected_at,
          users!restock_requests_requested_by_fkey (
            full_name,
            email
          ),
          products (
            name,
            sku,
            price,
            wholesale_price
          )
        `)
        .eq('branch_id', selectedBranch.id)
        .gte('created_at', filters.dateRange.from)
        .lte('created_at', filters.dateRange.to)
        .order('created_at', { ascending: false })
        .limit(100);

      console.log('Supabase query result - Data count:', data?.length);
      console.log('Sample data:', data?.[0]);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      // Step 2: Collect all product IDs from items JSONB
      const allProductIds = new Set<string>();
      
      data?.forEach(req => {
        // From product_id column
        if (req.product_id) {
          allProductIds.add(req.product_id);
        }
        // From items JSONB array
        if (req.items && Array.isArray(req.items)) {
          req.items.forEach((item: any) => {
            if (item.product_id) {
              allProductIds.add(item.product_id);
            }
          });
        }
      });
      
      console.log('Total unique product IDs found:', allProductIds.size);
      
      // Step 3: Fetch ALL products in ONE query (performance optimization)
      let productsMap = new Map();
      
      if (allProductIds.size > 0) {
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, name, sku, price, wholesale_price')
          .in('id', Array.from(allProductIds));
        
        if (productsError) {
          console.error('Error fetching products:', productsError);
        } else {
          productsMap = new Map(
            (products || []).map(p => [p.id, p])
          );
          console.log('Products fetched:', productsMap.size);
        }
      }
      
      // Step 4: Enrich requests with product data
      const enrichedRequests = data?.map(req => {
        let productName = 'Unknown Product';
        let productSku = 'N/A';
        let productPrice = 0;
        
        // Priority 1: Try to get product from items JSONB (multi-product requests)
        if (req.items && Array.isArray(req.items) && req.items.length > 0) {
          const firstItemProductId = req.items[0].product_id;
          const firstProduct = productsMap.get(firstItemProductId);
          
          if (firstProduct) {
            productName = firstProduct.name;
            productSku = firstProduct.sku;
            productPrice = firstProduct.price;
          }
          
          // Enrich each item with full product details
          req.items = req.items.map((item: any) => {
            const itemProduct = productsMap.get(item.product_id);
            return {
              ...item,
              product_name: itemProduct?.name || 'Unknown Product',
              product_sku: itemProduct?.sku || 'N/A',
              product_price: itemProduct?.price || 0,
              product_wholesale_price: itemProduct?.wholesale_price || 0,
            };
          });
        } 
        // Priority 2: Fall back to product_id (single product requests)
        else if (req.product_id) {
          const product = productsMap.get(req.product_id) || req.products;
          
          if (product) {
            productName = product.name;
            productSku = product.sku;
            productPrice = product.price;
          }
        }
        // Priority 3: Use the joined products data as final fallback
        else if (req.products) {
          productName = req.products.name;
          productSku = req.products.sku;
          productPrice = req.products.price;
        }
        
        return {
          ...req,
          // Add these fields for easy access in components
          product_name: productName,
          product_sku: productSku,
          product_price: productPrice,
        };
      }) || [];
      
      console.log('Enriched requests sample:', enrichedRequests[0]);
      setRestockRequests(enrichedRequests);
      
    } catch (error) {
      console.error('Error fetching restock requests:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, filters.dateRange]);

  // Setup real-time subscription for restock requests
  const setupRealtimeSubscription = useCallback(() => {
    if (!selectedBranch) return;

    if (restockChannelRef.current) {
      supabase.removeChannel(restockChannelRef.current);
      restockChannelRef.current = null;
    }

    restockChannelRef.current = supabase
      .channel(`restock-requests-realtime:branch=${selectedBranch.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restock_requests',
          filter: `branch_id=eq.${selectedBranch.id}`
        },
        async (payload) => {
          console.log('Restock request real-time update:', payload);
          
          // Refresh the list
          await fetchRestockRequests();
          
          // Show notifications for status changes
          if (payload.eventType === 'UPDATE') {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            
            if (oldStatus !== newStatus) {
              const productName = payload.new?.products?.name || 'Product';
              
              if (newStatus === 'approved') {
                toast.info('Restock Approved', {
                  description: `${productName} restock approved`,
                  duration: 3000
                });
              } else if (newStatus === 'completed') {
                toast.success('Restock Completed', {
                  description: `${productName} has been restocked`,
                  duration: 3000
                });
              } else if (newStatus === 'rejected') {
                toast.error('Restock Rejected', {
                  description: `${productName} restock rejected`,
                  duration: 3000
                });
              }
            }
          } else if (payload.eventType === 'INSERT') {
            const productName = payload.new?.products?.name || 'Product';
            toast.info('New Restock Request', {
              description: `${productName}: ${payload.new?.quantity} units requested`,
              duration: 3000
            });
          }
        }
      )
      .subscribe();
  }, [selectedBranch, fetchRestockRequests]);

  
  useEffect(() => {
    if (selectedBranch) {
      fetchRestockRequests();
      setupRealtimeSubscription();
    }
    
    return () => {
      if (restockChannelRef.current) {
        supabase.removeChannel(restockChannelRef.current);
      }
    };
  }, [selectedBranch, fetchRestockRequests, setupRealtimeSubscription]);

  return {
    restockRequests,
    loading,
    fetchRestockRequests
  };
};