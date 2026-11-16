import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { RestockRequest } from '../types';
import { toast } from 'sonner';

export const useAdminRestockRequests = (companyId?: string) => {
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRestockRequests = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      console.log('Fetching admin restock requests for company:', companyId);
      
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
          ),
          branches!inner (
            name,
            sales_type
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      console.log('Fetched requests:', data?.length);
      
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
      
      // Step 3: Fetch ALL products in ONE query
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
  }, [companyId]);

  // Update restock request status
  const updateRestockStatus = useCallback(async (requestId: string, status: string, allRequests?: RestockRequest[], notes?: string) => {
    const toastId = toast.loading(`Updating request status...`);
    
    try {
      const updateData: any = { status };
      
      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
      } else if (status === 'rejected') {
        updateData.rejected_at = new Date().toISOString();
        if (notes) updateData.admin_notes = notes;
      } else if (status === 'fulfilled') {
        updateData.fulfilled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('restock_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;
      
      // If allRequests provided, filter them
      if (allRequests) {
        const filteredRequests = allRequests.filter(req => req.status === status);
        return { success: true, filteredRequests };
      }
      
      // Otherwise refresh
      await fetchRestockRequests();
      
      toast.success('Status Updated', {
        description: `Request has been ${status.toLowerCase()}`,
        id: toastId
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('Update restock status error:', error);
      toast.error('Update Failed', {
        description: error.message || 'Failed to update request status',
        id: toastId
      });
      return { success: false, error: error.message };
    }
  }, [fetchRestockRequests]);

  // Update invoice number for a restock request
  const updateInvoiceNumber = useCallback(async (requestId: string, invoiceNumber: string) => {
    try {
      const { data, error } = await supabase
        .from('restock_requests')
        .update({ 
          invoice_number: invoiceNumber,
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select();

      if (error) {
        console.error('Supabase error updating invoice:', error);
        throw error;
      }
      
      // Refresh the requests to get updated data
      await fetchRestockRequests();
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Update invoice number error:', error);
      return { success: false, error: error.message };
    }
  }, [fetchRestockRequests]);

  // Filter requests by status
  const filteredRequests = useCallback((status: string) => {
    if (status === 'all') return restockRequests;
    return restockRequests.filter(req => req.status === status);
  }, [restockRequests]);

  useEffect(() => {
    if (companyId) {
      fetchRestockRequests();
    }
  }, [companyId, fetchRestockRequests]);

  return {
    restockRequests,
    loading,
    fetchRestockRequests,
    updateRestockStatus,
    updateInvoiceNumber,
    filteredRequests
  };
};