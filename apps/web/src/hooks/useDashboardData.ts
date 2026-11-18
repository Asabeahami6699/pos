// hooks/useDashboardData.ts - FIXED VERSION
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

// Define types
export interface DashboardStats {
  totalSales: number;
  totalProducts: number;
  lowStockCount: number;
  activeStaff: number;
  pendingRequests: number;
  totalRevenue: number;
  warehouseStock: number;
  allocationsCount: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  company_id: string;
  low_stock_threshold: number;
  created_at: string;
  wholesale_price?: number;
  category?: string | null;
  image_url?: string | null;
  description?: string | null;
  is_online_listing?: boolean;
  marketplace_listing?: unknown;
}

export interface Branch {
  id: string;
  name: string;
  company_id: string;
  sales_type: 'retail' | 'wholesale' | 'both';
  created_at: string;
  staff_count?: number;
  product_count?: number;
  total_stock?: number;
}

// Main hook function
const useDashboardData = (companyId: string | null) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalProducts: 0,
    lowStockCount: 0,
    activeStaff: 0,
    pendingRequests: 0,
    totalRevenue: 0,
    warehouseStock: 0,
    allocationsCount: 0
  });
  
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');
  const [inventoryModel, setInventoryModel] = useState<'warehouse' | 'branch_only'>('warehouse');
  
  // ========== FIX: Use ref to track if initial load is complete ==========
  const initialLoadComplete = useRef(false);

  const fetchCompanyName = useCallback(async (companyId: string): Promise<'warehouse' | 'branch_only'> => {
    try {
      console.log('📝 Fetching company name...');
      const { data, error } = await supabase
        .from('companies')
        .select('name, inventory_model')
        .eq('id', companyId)
        .single();
      
      if (error) throw error;
      const model = data?.inventory_model === 'branch_only' ? 'branch_only' : 'warehouse';
      setCompanyName(data?.name || 'Company Admin');
      setInventoryModel(model);
      console.log('✅ Company name fetched:', data?.name);
      return model;
    } catch (error) {
      console.error('❌ Error fetching company name:', error);
      setCompanyName('Company Admin');
      return 'warehouse';
    }
  }, []);

  const fetchStats = useCallback(async (companyId: string, model: 'warehouse' | 'branch_only' = inventoryModel) => {
    try {
      console.log('📊 Fetching stats...');
      
      // ========== FIX: Add timeout to each query ==========
      const timeoutPromise = (promise: Promise<any>, timeout: number) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), timeout)
          )
        ]);
      };

      const countQuery = (table: string, filters?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>) => {
        let q = supabase.from(table).select('id', { count: 'exact', head: true });
        if (filters) q = filters(q);
        return timeoutPromise(q, 10000);
      };

      const results = await Promise.all([
        countQuery('sales', (q) => q.eq('company_id', companyId)),
        countQuery('products', (q) => q.eq('company_id', companyId)),
        countQuery('users', (q) => q.eq('company_id', companyId).eq('role', 'salesperson')),
        countQuery('restock_requests', (q) => q.eq('company_id', companyId).eq('status', 'pending')),
        model === 'branch_only'
          ? timeoutPromise(
              supabase.from('branch_inventory').select('quantity').eq('company_id', companyId),
              10000
            )
          : timeoutPromise(
              supabase.from('warehouse_inventory').select('quantity').eq('company_id', companyId),
              10000
            ),
        model === 'branch_only'
          ? Promise.resolve({ count: 0, error: null })
          : countQuery('allocations', (q) => q.eq('company_id', companyId)),
      ]);

      for (const r of results) {
        if (r?.error) {
          console.error('Stats query error:', JSON.stringify(r.error));
          throw r.error;
        }
      }

      const [
        { count: salesCount },
        { count: productsCount },
        { count: staffCount },
        { count: requestsCount },
        { data: stockData },
        { count: allocationsCount }
      ] = results;

      const { data: salesData, error: salesError } = await timeoutPromise(
        supabase.from('sales').select('total').eq('company_id', companyId),
        10000
      );
      if (salesError) {
        console.error('Sales total error:', JSON.stringify(salesError));
        throw salesError;
      }

      const totalRevenue = salesData?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
      const warehouseStock = stockData?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      
      const { count: lowStockCount, error: lowStockError } = await timeoutPromise(
        supabase
          .from('branch_inventory')
          .select('product_id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('low_stock', true),
        10000
      );
      if (lowStockError) {
        console.error('Low stock error:', JSON.stringify(lowStockError));
        throw lowStockError;
      }

      setStats({
        totalSales: salesCount || 0,
        totalProducts: productsCount || 0,
        activeStaff: staffCount || 0,
        pendingRequests: requestsCount || 0,
        totalRevenue,
        warehouseStock,
        allocationsCount: allocationsCount || 0,
        lowStockCount: lowStockCount || 0
      });
      
      console.log('✅ Stats fetched successfully');

    } catch (error: any) {
      console.error('❌ Error fetching stats:', error?.message ?? error, error?.details ?? error?.hint ?? '');
      if (error.message !== 'Query timeout') {
        toast.error('Stats Fetch Error', {
          description: 'Failed to fetch statistics'
        });
      }
    }
  }, [inventoryModel]);

  const fetchProducts = useCallback(async (companyId: string) => {
    try {
      console.log('🏷️ Fetching products...');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
      console.log(`✅ Products fetched: ${data?.length || 0} items`);
    } catch (error) {
      console.error('❌ Error fetching products:', error);
      toast.error('Products Fetch Error', {
        description: 'Failed to fetch products'
      });
    }
  }, []);

  const fetchBranches = useCallback(async (companyId: string) => {
    try {
      console.log('🏢 Fetching branches...');
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch staff counts and inventory data for each branch
      const enrichedBranches = await Promise.all(
        (data || []).map(async (branch) => {
          // Fetch staff count for this branch
          const { count: staffCount, error: staffError } = await supabase
            .from('branch_staff')
            .select('user_id', { count: 'exact', head: true })
            .eq('branch_id', branch.id);
          if (staffError) throw staffError;

          // Fetch inventory data for this branch
          const { data: inventoryData } = await supabase
            .from('branch_inventory')
            .select('quantity, product_id, retail_quantity, wholesale_quantity')
            .eq('branch_id', branch.id);

          // Calculate unique product count and total stock
          const productIds = new Set();
          let totalStock = 0;
          
          if (inventoryData) {
            inventoryData.forEach(item => {
              productIds.add(item.product_id);
              // Sum both retail and wholesale quantities
              totalStock += (item.retail_quantity || 0) + (item.wholesale_quantity || 0);
            });
          }

          return {
            ...branch,
            staff_count: staffCount || 0,
            product_count: productIds.size,
            total_stock: totalStock
          };
        })
      );

      setBranches(enrichedBranches);
      console.log(`✅ Branches fetched: ${enrichedBranches.length} items`);
    } catch (error: any) {
      console.error('❌ Error fetching branches:', error);
      toast.error('Branches Fetch Error', {
        description: error.message || 'Failed to fetch branches'
      });
    }
  }, []);

  // PRODUCT CRUD OPERATIONS
  const handleAddProduct = useCallback(async (productData: {
    name: string;
    sku: string;
    price: string;
    wholesale_price: string;
    threshold: string;
  }) => {
    if (!companyId) {
      toast.error('Company Not Found', {
        description: 'Company ID is missing'
      });
      return false;
    }
    
    const toastId = toast.loading('Adding product...');
    
    try {
      const productDataToInsert = {
        name: productData.name,
        sku: productData.sku,
        price: parseFloat(productData.price),
        low_stock_threshold: parseInt(productData.threshold),
        company_id: companyId,
        wholesale_price: productData.wholesale_price ? parseFloat(productData.wholesale_price) : null,
        // Marketplace catalog only returns listed products
        is_online_listing: true,
      };

      const { error } = await supabase.from('products').insert([productDataToInsert]);

      if (error) throw error;

      toast.success('Product Added', {
        description: `${productData.name} has been added successfully`,
        id: toastId
      });

      await fetchProducts(companyId);
      await fetchStats(companyId);
      return true;
    } catch (error: any) {
      console.error('Add product error:', error);
      toast.error('Add Product Failed', {
        description: error.message || 'Failed to add product',
        id: toastId
      });
      return false;
    }
  }, [companyId, fetchProducts, fetchStats]);

const handleEditProduct = useCallback(async (editingProduct: Product | null, currentUserId: string) => {
  if (!editingProduct || !companyId) {
    toast.error('Missing Information', {
      description: 'Product or company information missing'
    });
    return false;
  }
  
  if (!currentUserId) {
    toast.error('Authentication Error', {
      description: 'User ID is required to update product'
    });
    return false;
  }
  
  const toastId = toast.loading('Updating product...');
  
  try {
    // First, get the current product to compare prices
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', editingProduct.id)
      .single();

    if (fetchError) throw fetchError;

    // ========== FIX: Get total inventory quantity ==========
    // Get warehouse inventory
    const { data: warehouseData } = await supabase
      .from('warehouse_inventory')
      .select('quantity')
      .eq('product_id', editingProduct.id)
      .eq('company_id', companyId);

    // Get branch inventory
    const { data: branchData } = await supabase
      .from('branch_inventory')
      .select('retail_quantity, wholesale_quantity')
      .eq('product_id', editingProduct.id)
      .eq('company_id', companyId);

    // Calculate total quantity
    let totalQuantity = 0;
    
    // Add warehouse quantity
    if (warehouseData) {
      totalQuantity += warehouseData.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }
    
    // Add branch quantities
    if (branchData) {
      branchData.forEach(item => {
        totalQuantity += (item.retail_quantity || 0) + (item.wholesale_quantity || 0);
      });
    }

    // Update the product (including marketplace list / unlist)
    const { error } = await supabase
      .from('products')
      .update({
        name: editingProduct.name,
        sku: editingProduct.sku,
        price: editingProduct.price,
        wholesale_price: editingProduct.wholesale_price,
        low_stock_threshold: editingProduct.low_stock_threshold,
        category: editingProduct.category ?? null,
        description: editingProduct.description ?? null,
        is_online_listing: Boolean(editingProduct.is_online_listing),
        marketplace_listing: editingProduct.is_online_listing
          ? editingProduct.marketplace_listing ?? null
          : null,
      })
      .eq('id', editingProduct.id);

    if (error) throw error;

    // Check for price changes and record in price_history
    const priceHistoryInserts: Array<Record<string, unknown>> = [];

    if (currentProduct.price !== editingProduct.price) {
      priceHistoryInserts.push({
        product_id: editingProduct.id,
        old_price: currentProduct.price,
        new_price: editingProduct.price,
        change_type: 'retail',
        reason: 'retail',
        changed_by: currentUserId,
        company_id: companyId,
        quantity_at_change: totalQuantity,
      });
    }

    const currentWholesalePrice = currentProduct.wholesale_price || 0;
    const newWholesalePrice = editingProduct.wholesale_price || 0;

    if (currentWholesalePrice !== newWholesalePrice) {
      priceHistoryInserts.push({
        product_id: editingProduct.id,
        old_price: currentWholesalePrice,
        new_price: newWholesalePrice,
        change_type: 'wholesale',
        reason: 'wholesale',
        changed_by: currentUserId,
        company_id: companyId,
        quantity_at_change: totalQuantity,
      });
    }

    if (priceHistoryInserts.length > 0) {
      let { error: historyError } = await supabase
        .from('price_history')
        .insert(priceHistoryInserts);

      // Older DBs may lack change_type / quantity_at_change — retry minimal columns
      if (historyError?.code === '42703') {
        const minimal = priceHistoryInserts.map((row) => ({
          product_id: row.product_id,
          old_price: row.old_price,
          new_price: row.new_price,
          changed_by: row.changed_by,
          company_id: row.company_id,
          reason: row.reason,
        }));
        const retry = await supabase.from('price_history').insert(minimal);
        historyError = retry.error;
      }

      if (historyError) {
        console.error('Failed to record price history:', historyError);
        toast.warning('Price history not recorded', {
          description: 'Product updated but price change history was not saved',
        });
      }
    }

    toast.success('Product Updated', {
      description: `${editingProduct.name} has been updated successfully`,
      id: toastId
    });

    await fetchProducts(companyId);
    return true;
  } catch (error: any) {
    console.error('Edit product error:', error);
    toast.error('Update Failed', {
      description: error.message || 'Failed to update product',
      id: toastId
    });
    return false;
  }
}, [companyId, fetchProducts]);


  const handleDeleteProduct = useCallback(async (productId: string) => {
    const product = products.find(p => p.id === productId);
    
    return toast.promise(
      async () => {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);

        if (error) throw error;
        
        await fetchProducts(companyId!);
        await fetchStats(companyId!);
        return product?.name;
      },
      {
        loading: 'Deleting product...',
        success: (productName) => `${productName || 'Product'} deleted successfully`,
        error: (error) => `Failed to delete product: ${error.message}`
      }
    );
  }, [companyId, products, fetchProducts, fetchStats]);

  // BRANCH CRUD OPERATIONS
  const handleAddBranch = useCallback(async (branchData: {
    name: string;
    sales_type: 'retail' | 'wholesale' | 'both';
  }) => {
    if (!companyId) {
      toast.error('Company Not Found', {
        description: 'Company ID is missing'
      });
      return false;
    }
    
    const toastId = toast.loading('Adding branch...');
    
    try {
      const { error } = await supabase
        .from('branches')
        .insert([{
          name: branchData.name,
          sales_type: branchData.sales_type,
          company_id: companyId
        }]);

      if (error) throw error;

      toast.success('Branch Added', {
        description: `${branchData.name} has been added successfully`,
        id: toastId
      });

      await fetchBranches(companyId);
      await fetchStats(companyId);
      return true;
    } catch (error: any) {
      console.error('Add branch error:', error);
      toast.error('Add Branch Failed', {
        description: error.message || 'Failed to add branch',
        id: toastId
      });
      return false;
    }
  }, [companyId, fetchBranches, fetchStats]);

  const handleEditBranch = useCallback(async (editingBranch: Branch | null) => {
    if (!editingBranch) return false;
    
    const toastId = toast.loading('Updating branch...');
    
    try {
      const { error } = await supabase
        .from('branches')
        .update({
          name: editingBranch.name,
          sales_type: editingBranch.sales_type
        })
        .eq('id', editingBranch.id);

      if (error) throw error;

      toast.success('Branch Updated', {
        description: `${editingBranch.name} has been updated successfully`,
        id: toastId
      });

      await fetchBranches(companyId!);
      return true;
    } catch (error: any) {
      console.error('Edit branch error:', error);
      toast.error('Update Failed', {
        description: error.message || 'Failed to update branch',
        id: toastId
      });
      return false;
    }
  }, [companyId, fetchBranches]);

  const handleDeleteBranch = useCallback(async (branchId: string, currentBranches: Branch[]) => {
    const branch = currentBranches.find(b => b.id === branchId);
    
    return toast.promise(
      async () => {
        const { error } = await supabase
          .from('branches')
          .delete()
          .eq('id', branchId);

        if (error) throw error;
        
        await fetchBranches(companyId!);
        await fetchStats(companyId!);
        return branch?.name;
      },
      {
        loading: 'Deleting branch...',
        success: (branchName) => `${branchName || 'Branch'} deleted successfully`,
        error: (error) => `Failed to delete branch: ${error.message}`
      }
    );
  }, [companyId, fetchBranches, fetchStats]);

  // ========== FIX: Sequential loading with proper error handling ==========
  const fetchAllData = useCallback(async () => {
    if (!companyId) {
      console.log('⏸️ No company ID, skipping data fetch');
      return;
    }
    
    // Prevent duplicate initial loads
    if (initialLoadComplete.current) {
      console.log('🔄 Data already loaded, using refresh...');
      // This is a refresh, not initial load
    }
    
    console.log('🚀 Starting dashboard data fetch for company:', companyId);
    setLoading(true);
    
    try {
      // ========== SEQUENTIAL LOADING (more reliable than parallel) ==========
      
      // Step 1: Company Name (fastest, no dependencies)
      console.log('📝 Step 1/4: Fetching company name...');
      const companyInventoryModel = await fetchCompanyName(companyId);
      
      // Step 2: Products (needed for other calculations)
      console.log('🏷️ Step 2/4: Fetching products...');
      await fetchProducts(companyId);
      
      // Step 3: Branches (needed for inventory calculations)
      console.log('🏢 Step 3/4: Fetching branches...');
      await fetchBranches(companyId);
      
      // Step 4: Stats (depends on products and branches)
      console.log('📊 Step 4/4: Fetching stats...');
      await fetchStats(companyId, companyInventoryModel);
      
      // Mark as initialized
      if (!initialLoadComplete.current) {
        initialLoadComplete.current = true;
        setInitialized(true);
        console.log('✅ Initial dashboard data load COMPLETE');
      } else {
        console.log('✅ Dashboard data refresh COMPLETE');
      }
      
    } catch (error: any) {
      console.error('❌ Critical error in fetchAllData:', error);
      toast.error('Data Load Failed', {
        description: 'Some data failed to load. Please refresh the page.',
        duration: 5000
      });
      
      // Still mark as initialized to prevent infinite loading
      if (!initialLoadComplete.current) {
        initialLoadComplete.current = true;
        setInitialized(true);
      }
    } finally {
      setLoading(false);
      console.log('🏁 Dashboard fetch cycle completed');
    }
  }, [companyId, fetchCompanyName, fetchStats, fetchBranches, fetchProducts]);

  // ========== FIX: Only run initial fetch once ==========
  useEffect(() => {
    if (companyId && !initialLoadComplete.current) {
      console.log('🔍 Company ID available, starting INITIAL data fetch...');
      fetchAllData();
    } else if (companyId && initialLoadComplete.current) {
      console.log('✅ Data already loaded for this company');
    }
  }, [companyId]); // ← Only depend on companyId, not fetchAllData

  // Refresh function
  const refreshData = useCallback(async () => {
    if (!companyId) return;
    console.log('🔄 Manually refreshing dashboard data...');
    await fetchAllData();
  }, [companyId, fetchAllData]);

  return {
    // State
    stats,
    products,
    branches,
    companyName,
    inventoryModel,
    loading,
    initialized,
    
    // Data Fetching Functions
    fetchAllData: refreshData,
    refreshData,
    fetchStats: () => companyId && fetchStats(companyId),
    fetchProducts: () => companyId && fetchProducts(companyId),
    fetchBranches: () => companyId && fetchBranches(companyId),
    fetchCompanyName: () => companyId && fetchCompanyName(companyId),
    
    // Product CRUD Operations
    handleAddProduct,
    handleEditProduct,
    handleDeleteProduct,
    
    // Branch CRUD Operations
    handleAddBranch,
    handleEditBranch,
    handleDeleteBranch,
    
    // State setters (for real-time updates)
    setStats,
    setProducts,
    setBranches,
    setInventoryModel,
    setInitialized
  };
};

// Export the hook as default
export default useDashboardData;