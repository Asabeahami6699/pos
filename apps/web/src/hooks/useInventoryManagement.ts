// hooks/useInventoryManagement.ts - COMPLETE FIXED VERSION
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { Product } from './useDashboardData';

export interface WarehouseInventory {
  id: string;
  product_id: string;
  quantity: number;
  company_id: string;
  min_stock_level: number;
  low_stock: boolean;
  products?: Product;
  supplier_name?: string;
  batch_lot_number?: string;
  date_received?: string;
  notes?: string;
  warehouse_location?: string;
  cost_per_unit?: number;
  cost_per_box?: number;
  boxes_received?: number;
  units_per_box?: number;
}

export interface BranchInventoryItem {
  id?: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  low_stock: boolean;
  company_id: string;
  retail_quantity: number;
  wholesale_quantity: number;
  last_updated?: string;
  products?: Product;
  branches?: {
    name: string;
    sales_type: 'retail' | 'wholesale' | 'both';
  };
}

// ✅ Helper: Extract readable message from ANY Supabase or JS error
const getErrorMessage = (error: any): string => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.details) return error.details;
  if (error.hint) return error.hint;
  if (error.code) return `Database error code: ${error.code}`;
  try { return JSON.stringify(error); } catch { return 'An unexpected error occurred'; }
};

export const useInventoryManagement = (
  companyId: string | null,
  userId: string | null,
  inventoryModel: 'warehouse' | 'branch_only' = 'warehouse',
) => {
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseInventory[]>([]);
  const [branchInventory, setBranchInventory] = useState<BranchInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWarehouseInventory = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('warehouse_inventory')
        .select('*, products(*)')
        .eq('company_id', id);
      if (error) throw error;
      setWarehouseInventory(data || []);
    } catch (error) {
      console.error('Error fetching warehouse inventory:', error);
      toast.error('Warehouse Fetch Error', { description: getErrorMessage(error) });
    }
  }, []);

  const fetchBranchInventory = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('branch_inventory')
        .select('*, products(*), branches(name, sales_type)')
        .eq('company_id', id);
      if (error) throw error;
      setBranchInventory(data || []);
    } catch (error) {
      console.error('Error fetching branch inventory:', error);
    }
  }, []);

  const createAllocationRecord = useCallback(async (
    cId: string,
    fromWarehouse: boolean,
    toBranchId: string,
    salesType: 'retail' | 'wholesale' | 'both',
    allocatedBy: string,
    notes?: string
  ) => {
    console.log('📝 Creating allocation record:', { cId, toBranchId, salesType, allocatedBy });

    const { data, error } = await supabase
      .from('allocations')
      .insert({
        company_id: cId,
        from_warehouse: fromWarehouse,
        to_branch_id: toBranchId,
        sales_type: salesType,
        status: 'completed',
        allocated_by: allocatedBy,
        notes: notes || `Allocation to branch`,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ createAllocationRecord error:', error);
      throw new Error(`Failed to create allocation record: ${getErrorMessage(error)}`);
    }
    return data;
  }, []);

  const createAllocationItems = useCallback(async (
    allocationId: string,
    productId: string,
    retailQuantity: number,
    wholesaleQuantity: number
  ) => {
    console.log('📝 Creating allocation items:', { allocationId, productId, retailQuantity, wholesaleQuantity });

    const { error } = await supabase
      .from('allocation_items')
      .insert({
        allocation_id: allocationId,
        product_id: productId,
        retail_quantity: retailQuantity,
        wholesale_quantity: wholesaleQuantity
      });

    if (error) {
      console.error('❌ createAllocationItems error:', error);
      throw new Error(`Failed to create allocation items: ${getErrorMessage(error)}`);
    }
  }, []);

  const addBranchStock = useCallback(async (
    branchId: string,
    productId: string,
    quantity: number,
    notes?: string,
  ): Promise<boolean> => {
    if (!companyId) {
      toast.error('Company ID is missing');
      return false;
    }
    if (!quantity || quantity <= 0) {
      toast.error('Invalid quantity');
      return false;
    }

    const toastId = toast.loading('Adding stock to branch...');

    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('name, low_stock_threshold')
        .eq('id', productId)
        .eq('company_id', companyId)
        .single();

      if (productError || !product) {
        throw new Error('Product not found');
      }

      const { data: existing, error: fetchError } = await supabase
        .from('branch_inventory')
        .select('quantity, retail_quantity, wholesale_quantity')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const threshold = product.low_stock_threshold || 5;
      const currentQty = existing?.quantity || 0;
      const newQty = currentQty + quantity;
      const isLowStock = newQty <= threshold;

      if (existing) {
        const { error: updateError } = await supabase
          .from('branch_inventory')
          .update({
            quantity: newQty,
            retail_quantity: (existing.retail_quantity || 0) + quantity,
            low_stock: isLowStock,
            last_updated: new Date().toISOString(),
          })
          .eq('branch_id', branchId)
          .eq('product_id', productId)
          .eq('company_id', companyId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('branch_inventory').insert({
          branch_id: branchId,
          product_id: productId,
          company_id: companyId,
          quantity: newQty,
          retail_quantity: quantity,
          wholesale_quantity: 0,
          low_stock: isLowStock,
          last_updated: new Date().toISOString(),
        });

        if (insertError) throw insertError;
      }

      if (userId) {
        await supabase.from('activity_log').insert({
          type: 'branch_stock_add',
          description: `${quantity} units of ${product.name} added to branch`,
          company_id: companyId,
          user_id: userId,
          metadata: {
            branch_id: branchId,
            product_id: productId,
            quantity,
            notes: notes ?? null,
          },
        });
      }

      toast.success('Stock added', {
        description: `${quantity} units of ${product.name} added`,
        id: toastId,
      });

      await fetchBranchInventory(companyId);
      return true;
    } catch (error) {
      toast.error('Failed to add stock', {
        description: getErrorMessage(error),
        id: toastId,
      });
      return false;
    }
  }, [companyId, userId, fetchBranchInventory]);

  const createProductAndBranchStock = useCallback(async (payload: {
    branchId: string;
    name: string;
    sku: string;
    price: number;
    wholesale_price: number | null;
    low_stock_threshold: number;
    quantity: number;
    notes?: string;
  }): Promise<boolean> => {
    if (!companyId) {
      toast.error('Company ID is missing');
      return false;
    }

    const toastId = toast.loading('Creating product and adding stock...');

    try {
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: payload.name,
          sku: payload.sku,
          price: payload.price,
          wholesale_price: payload.wholesale_price,
          low_stock_threshold: payload.low_stock_threshold,
          company_id: companyId,
        })
        .select('id')
        .single();

      if (productError || !newProduct) throw productError ?? new Error('Failed to create product');

      const added = await addBranchStock(
        payload.branchId,
        newProduct.id,
        payload.quantity,
        payload.notes,
      );

      if (!added) throw new Error('Product created but stock was not added');

      toast.success('Product stocked', { id: toastId });
      return true;
    } catch (error) {
      toast.error('Failed to create product', {
        description: getErrorMessage(error),
        id: toastId,
      });
      return false;
    }
  }, [companyId, addBranchStock]);

  // ✅ NEW: Remove Allocated Stock Function
  const removeAllocatedStock = useCallback(async (
    branchId: string,
    productId: string,
    quantity: number,
    reason: string
  ) => {
    if (!companyId) {
      toast.error('Operation Failed', { description: 'Company ID is missing' });
      return false;
    }
    if (!userId) {
      toast.error('Operation Failed', { description: 'User ID is missing — please log in again' });
      return false;
    }

    const toastId = toast.loading('Removing allocated stock...');

    try {
      // Validate quantity
      if (!quantity || quantity <= 0 || isNaN(quantity)) {
        throw new Error('Invalid quantity - must be a positive number');
      }

      console.log('🚀 Starting stock removal:', { branchId, productId, quantity, reason });

      // ─── STEP 1: Check current branch inventory ───────────────────────────────
      console.log('📦 Step 1: Checking branch inventory...');
      const { data: current, error: fetchError } = await supabase
        .from('branch_inventory')
        .select('*')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Fetch branch inventory error:', fetchError);
        throw new Error(`Failed to fetch branch inventory: ${getErrorMessage(fetchError)}`);
      }

      if (!current) {
        throw new Error('Product not found in this branch inventory');
      }

      // Check if enough stock exists
      const availableStock = current.quantity || 0;
      if (availableStock < quantity) {
        throw new Error(`Only ${availableStock} units available, cannot remove ${quantity}`);
      }

      // Get product name for logging
      const { data: product } = await supabase
        .from('products')
        .select('name, low_stock_threshold')
        .eq('id', productId)
        .single();

      const productName = product?.name || 'Unknown Product';
      const threshold = product?.low_stock_threshold || 5;

      // ─── STEP 2: Create return allocation record ─────────────────────────────
      console.log('📝 Step 2: Creating return allocation record...');
      const { data: allocation, error: allocationError } = await supabase
        .from('allocations')
        .insert({
          company_id: companyId,
          from_warehouse: false,
          to_branch_id: branchId,
          sales_type: 'both',
          status: 'completed',
          allocated_by: userId,
          notes: `Stock removal: ${quantity} units of ${productName} - ${reason}`,
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (allocationError) {
        console.error('❌ Allocation record error:', allocationError);
        throw new Error(`Failed to create allocation record: ${getErrorMessage(allocationError)}`);
      }
      console.log('✅ Return allocation created:', allocation.id);

      // ─── STEP 3: Create allocation items with negative quantity ─────────────
      console.log('📝 Step 3: Creating allocation items...');
      
      // Determine which quantity type to reduce based on what's available
      let retailToRemove = 0;
      let wholesaleToRemove = 0;
      
      // Prioritize removing from retail stock first
      const currentRetail = current.retail_quantity || 0;
      if (currentRetail >= quantity) {
        retailToRemove = quantity;
      } else {
        retailToRemove = currentRetail;
        wholesaleToRemove = quantity - currentRetail;
      }

      const { error: itemsError } = await supabase
        .from('allocation_items')
        .insert({
          allocation_id: allocation.id,
          product_id: productId,
          retail_quantity: -retailToRemove, // Negative for removal
          wholesale_quantity: -wholesaleToRemove // Negative for removal
        });

      if (itemsError) {
        console.error('❌ Allocation items error:', itemsError);
        throw new Error(`Failed to create allocation items: ${getErrorMessage(itemsError)}`);
      }
      console.log('✅ Allocation items created');

      // ─── STEP 4: Update branch inventory ───────────────────────────────────
      console.log('📦 Step 4: Updating branch inventory...');
      
      const newRetailQty = Math.max(0, (current.retail_quantity || 0) - retailToRemove);
      const newWholesaleQty = Math.max(0, (current.wholesale_quantity || 0) - wholesaleToRemove);
      const newTotalQty = newRetailQty + newWholesaleQty;

      if (newTotalQty === 0) {
        // Delete the record if no stock left
        console.log('🗑️ Deleting branch inventory record (zero stock)...');
        const { error: deleteError } = await supabase
          .from('branch_inventory')
          .delete()
          .eq('branch_id', branchId)
          .eq('product_id', productId)
          .eq('company_id', companyId);

        if (deleteError) {
          console.error('❌ Delete branch inventory error:', deleteError);
          throw new Error(`Failed to delete branch inventory: ${getErrorMessage(deleteError)}`);
        }
        console.log('✅ Branch inventory record deleted');
      } else {
        // Update with reduced quantity
        console.log('📊 Updating branch inventory with new quantities:', { newRetailQty, newWholesaleQty, newTotalQty });
        const { error: updateError } = await supabase
          .from('branch_inventory')
          .update({
            retail_quantity: newRetailQty,
            wholesale_quantity: newWholesaleQty,
            quantity: newTotalQty,
            low_stock: newTotalQty <= threshold,
            last_updated: new Date().toISOString()
          })
          .eq('branch_id', branchId)
          .eq('product_id', productId)
          .eq('company_id', companyId);

        if (updateError) {
          console.error('❌ Update branch inventory error:', updateError);
          throw new Error(`Failed to update branch inventory: ${getErrorMessage(updateError)}`);
        }
        console.log('✅ Branch inventory updated');
      }

      if (inventoryModel !== 'branch_only') {
        // ─── STEP 5: Return stock to warehouse ───────────────────────────────
        console.log('🏭 Step 5: Returning stock to warehouse...');

        const { data: warehouseItem } = await supabase
          .from('warehouse_inventory')
          .select('*')
          .eq('product_id', productId)
          .eq('company_id', companyId)
          .maybeSingle();

        if (warehouseItem) {
          const { error: warehouseError } = await supabase
            .from('warehouse_inventory')
            .update({
              quantity: warehouseItem.quantity + quantity,
              updated_at: new Date().toISOString(),
              low_stock: (warehouseItem.quantity + quantity) <= (warehouseItem.min_stock_level || 10),
            })
            .eq('id', warehouseItem.id);

          if (warehouseError) {
            console.error('❌ Warehouse update error:', warehouseError);
            throw new Error(`Failed to update warehouse: ${getErrorMessage(warehouseError)}`);
          }
        } else {
          const { error: warehouseInsertError } = await supabase.from('warehouse_inventory').insert({
            product_id: productId,
            company_id: companyId,
            quantity: quantity,
            min_stock_level: 10,
            low_stock: quantity <= 10,
            warehouse_location: 'Main Warehouse',
          });

          if (warehouseInsertError) {
            console.error('❌ Warehouse insert error:', warehouseInsertError);
            throw new Error(`Failed to create warehouse record: ${getErrorMessage(warehouseInsertError)}`);
          }
        }
        console.log('✅ Warehouse stock updated');
      } else {
        console.log('📦 Branch-only company — stock written off (not returned to warehouse)');
      }

      // ─── STEP 6: Log activity ──────────────────────────────────────────────
      console.log('📝 Step 6: Logging activity...');
      await supabase
        .from('activity_log')
        .insert({
          type: 'stock_removal',
          description: `${quantity} units of ${productName} removed from branch`,
          company_id: companyId,
          user_id: userId,
          metadata: {
            branch_id: branchId,
            product_id: productId,
            product_name: productName,
            quantity: quantity,
            reason: reason,
            allocation_id: allocation.id
          }
        });

      // ─── SUCCESS ───────────────────────────────────────────────────────────
      toast.success('Stock Removed Successfully!', {
        description:
          inventoryModel === 'branch_only'
            ? `${quantity} units of ${productName} removed from branch`
            : `${quantity} units of ${productName} returned to warehouse`,
        id: toastId
      });

      // Refresh data
      await Promise.all([
        fetchBranchInventory(companyId),
        fetchWarehouseInventory(companyId)
      ]);

      console.log('🎉 Stock removal complete!');
      return true;

    } catch (error: any) {
      console.error('❌ Stock removal error:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      
      toast.error('Stock Removal Failed', {
        description: getErrorMessage(error),
        id: toastId
      });
      
      return false;
    }
  }, [companyId, userId, fetchBranchInventory, fetchWarehouseInventory, inventoryModel]);

  const handleAllocateStock = useCallback(async (
    productId: string,
    branchId: string,
    quantity: string,
    lowStockThreshold: string,
    products: Product[],
    branches: any[]
  ) => {
    if (!companyId) {
      toast.error('Allocation Failed', { description: 'Company ID is missing' });
      return false;
    }
    if (!userId) {
      toast.error('Allocation Failed', { description: 'User ID is missing — please log in again' });
      return false;
    }

    const toastId = toast.loading('Allocating stock...');

    try {
      const qty = parseInt(quantity);
      if (!qty || qty <= 0 || isNaN(qty)) throw new Error('Invalid quantity — must be a positive number');

      if (!Array.isArray(products) || products.length === 0) throw new Error('Products data not available');
      if (!Array.isArray(branches) || branches.length === 0) throw new Error('Branches data not available');

      const product = products.find(p => p.id === productId);
      const branch = branches.find(b => b.id === branchId);

      if (!product) throw new Error(`Product not found (ID: ${productId})`);
      if (!branch) throw new Error(`Branch not found (ID: ${branchId})`);

      console.log('🚀 Starting allocation:', { product: product.name, branch: branch.name, qty, userId, companyId });

      // ─── STEP 1: Check warehouse stock ───────────────────────────────────
      console.log('📦 Step 1: Checking warehouse stock...');
      const { data: warehouseItem, error: warehouseCheckError } = await supabase
        .from('warehouse_inventory')
        .select('*')
        .eq('product_id', productId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (warehouseCheckError) {
        console.error('❌ Warehouse check error:', warehouseCheckError);
        throw new Error(`Warehouse check failed: ${getErrorMessage(warehouseCheckError)}`);
      }
      if (!warehouseItem) throw new Error(`"${product.name}" is not in the warehouse. Add it to warehouse first.`);
      if (warehouseItem.quantity < qty) throw new Error(`Not enough stock! Only ${warehouseItem.quantity} units of "${product.name}" available.`);

      console.log(`✅ Warehouse has ${warehouseItem.quantity} units available`);

      // ─── STEP 2: Create allocation record ────────────────────────────────
      console.log('📝 Step 2: Creating allocation record...');
      const allocation = await createAllocationRecord(
        companyId, true, branchId, branch.sales_type, userId,
        `Allocated ${qty} units of ${product.name} to ${branch.name}`
      );
      console.log('✅ Allocation record created:', allocation.id);

      // ─── STEP 3: Calculate retail/wholesale split ─────────────────────────
      let retailQty = 0;
      let wholesaleQty = 0;
      if (branch.sales_type === 'retail') { retailQty = qty; }
      else if (branch.sales_type === 'wholesale') { wholesaleQty = qty; }
      else { retailQty = qty; } // 'both' → retail by default
      console.log('📊 Step 3: Split →', { retailQty, wholesaleQty });

      // ─── STEP 4: Create allocation items ─────────────────────────────────
      console.log('📝 Step 4: Creating allocation items...');
      await createAllocationItems(allocation.id, productId, retailQty, wholesaleQty);
      console.log('✅ Allocation items created');

      // ─── STEP 5: Update branch inventory ─────────────────────────────────
      console.log('📦 Step 5: Updating branch inventory...');

      const threshold = parseInt(lowStockThreshold) || product.low_stock_threshold || 5;

      const { data: existing, error: checkErr } = await supabase
        .from('branch_inventory')
        .select('*')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (checkErr) {
        console.error('❌ Branch inventory check error:', checkErr);
        throw new Error(`Branch inventory check failed: ${getErrorMessage(checkErr)}`);
      }

      if (existing) {
        // ── UPDATE ──────────────────────────────────────────────────────────
        const newRetail = (existing.retail_quantity || 0) + retailQty;
        const newWholesale = (existing.wholesale_quantity || 0) + wholesaleQty;
        const newTotal = newRetail + newWholesale;

        const { error: updateError } = await supabase
          .from('branch_inventory')
          .update({
            retail_quantity: newRetail,
            wholesale_quantity: newWholesale,
            quantity: newTotal,
            low_stock: newTotal <= threshold,
            last_updated: new Date().toISOString()
          })
          .eq('branch_id', branchId)
          .eq('product_id', productId)
          .eq('company_id', companyId);

        if (updateError) {
          console.error('❌ Branch inventory update error:', updateError);
          throw new Error(`Branch inventory update failed: ${getErrorMessage(updateError)}`);
        }
        console.log('✅ Branch inventory updated:', { newRetail, newWholesale, newTotal });

      } else {
        // ── INSERT ──────────────────────────────────────────────────────────
        const totalQty = retailQty + wholesaleQty;

        const { error: insertError } = await supabase
          .from('branch_inventory')
          .insert({
            branch_id: branchId,
            product_id: productId,
            retail_quantity: retailQty,
            wholesale_quantity: wholesaleQty,
            quantity: totalQty,
            low_stock: totalQty <= threshold,
            company_id: companyId
          });

        if (insertError) {
          console.error('❌ Branch inventory insert error:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          });
          throw new Error(`Branch inventory creation failed: ${getErrorMessage(insertError)}`);
        }
        console.log('✅ Branch inventory created:', { retailQty, wholesaleQty, totalQty });
      }

      // ─── STEP 6: Update warehouse inventory ──────────────────────────────
      console.log('🏭 Step 6: Updating warehouse...');
      const newWarehouseQty = warehouseItem.quantity - qty;
      const warehouseLow = warehouseItem.min_stock_level
        ? newWarehouseQty <= warehouseItem.min_stock_level
        : false;

      const { error: warehouseUpdateError } = await supabase
        .from('warehouse_inventory')
        .update({
          quantity: newWarehouseQty,
          low_stock: warehouseLow
        })
        .eq('id', warehouseItem.id);

      if (warehouseUpdateError) {
        console.error('❌ Warehouse update error:', warehouseUpdateError);
        throw new Error(`Warehouse update failed: ${getErrorMessage(warehouseUpdateError)}`);
      }
      console.log('✅ Warehouse updated:', { newWarehouseQty, warehouseLow });

      // ─── SUCCESS ─────────────────────────────────────────────────────────
      toast.success('Stock Allocated!', {
        description: `${qty} units of "${product.name}" → ${branch.name}`,
        id: toastId
      });

      await Promise.all([
        fetchBranchInventory(companyId),
        fetchWarehouseInventory(companyId)
      ]);

      console.log('🎉 Allocation complete!');
      return true;

    } catch (error: any) {
      console.error('❌ Allocate stock error:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      toast.error('Allocation Failed', {
        description: getErrorMessage(error),
        id: toastId
      });
      return false;
    }
  }, [companyId, userId, fetchBranchInventory, fetchWarehouseInventory, createAllocationRecord, createAllocationItems]);

  const getProductStock = useCallback((productId: string, branchId?: string) => {
    let inv = branchInventory;
    if (branchId && branchId !== 'all') {
      inv = branchInventory.filter(i => i.branch_id === branchId);
    }
    const items = inv.filter(i => i.product_id === productId);
    const retail = items.reduce((s, i) => s + (i.retail_quantity || 0), 0);
    const wholesale = items.reduce((s, i) => s + (i.wholesale_quantity || 0), 0);
    return { retail, wholesale, total: retail + wholesale };
  }, [branchInventory]);

  const getLowStockProducts = useCallback(() => {
    return branchInventory.filter(i => i.low_stock === true);
  }, [branchInventory]);

  const fetchAllInventory = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchWarehouseInventory(companyId),
        fetchBranchInventory(companyId)
      ]);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Inventory Fetch Error', { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [companyId, fetchWarehouseInventory, fetchBranchInventory]);

  useEffect(() => {
    if (companyId) fetchAllInventory();
  }, [companyId, fetchAllInventory]);

  // ✅ RETURN INCLUDING removeAllocatedStock
  return {
    warehouseInventory,
    branchInventory,
    loading,
    fetchWarehouseInventory: () => companyId && fetchWarehouseInventory(companyId),
    fetchBranchInventory: () => companyId && fetchBranchInventory(companyId),
    fetchAllInventory,
    handleAllocateStock,
    addBranchStock,
    createProductAndBranchStock,
    removeAllocatedStock,
    getProductStock,
    getLowStockProducts,
    setWarehouseInventory,
    setBranchInventory
  };
};