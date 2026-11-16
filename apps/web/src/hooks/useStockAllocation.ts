// hooks/useStockAllocation.ts - FIXED VERSION
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { Product } from './useDashboardData';
import type { Branch } from './useDashboardData';

interface StockAllocationState {
  productId: string;
  branchId: string;
  quantity: string;
  lowStockThreshold: string;
  salesType?: 'retail' | 'wholesale' | 'both';
}

interface UseStockAllocationProps {
  companyId: string | null;
  products: Product[];
  branches: Branch[];
  warehouseInventory: any[];
  branchInventory: any[];
  handleAllocateStock: (
    productId: string,
    branchId: string,
    quantity: string,
    lowStockThreshold: string,
    products: Product[],
    branches: any[]
  ) => Promise<boolean>;
  onSuccess?: () => void;
}

export const useStockAllocation = ({
  companyId,
  products,
  branches,
  warehouseInventory,
  branchInventory,
  handleAllocateStock,
  onSuccess
}: UseStockAllocationProps) => {
  const [stockAllocation, setStockAllocation] = useState<StockAllocationState>({
    productId: '',
    branchId: '',
    quantity: '',
    lowStockThreshold: '5'
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAllocateStockSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('📋 Form submitted with data:', stockAllocation);
    console.log('📊 Products array:', Array.isArray(products), products.length);
    console.log('🏪 Branches array:', Array.isArray(branches), branches.length);
    
    if (!stockAllocation.productId || !stockAllocation.branchId || !stockAllocation.quantity) {
      toast.warning('Missing Information', {
        description: 'Please fill in all required fields'
      });
      return false;
    }
    
    // Validate low stock threshold
    if (!stockAllocation.lowStockThreshold || parseInt(stockAllocation.lowStockThreshold) <= 0) {
      toast.warning('Invalid Threshold', {
        description: 'Low stock threshold must be at least 1'
      });
      return false;
    }

    // Validate quantity
    const quantity = parseInt(stockAllocation.quantity);
    if (quantity <= 0) {
      toast.warning('Invalid Quantity', {
        description: 'Quantity must be greater than 0'
      });
      return false;
    }

    // Check warehouse stock
    const warehouseItem = warehouseInventory.find(w => w.product_id === stockAllocation.productId);
    const availableStock = warehouseItem?.quantity || 0;
    if (quantity > availableStock) {
      toast.error('Insufficient Stock', {
        description: `Only ${availableStock} units available in warehouse`
      });
      return false;
    }

    setLoading(true);
    try {
      console.log('🚀 Calling handleAllocateStock with parameters:', {
        productId: stockAllocation.productId,
        branchId: stockAllocation.branchId,
        quantity: stockAllocation.quantity,
        lowStockThreshold: stockAllocation.lowStockThreshold,
        productsType: Array.isArray(products) ? 'array' : typeof products,
        branchesType: Array.isArray(branches) ? 'array' : typeof branches
      });
      
      const success = await handleAllocateStock(
        stockAllocation.productId,
        stockAllocation.branchId,
        stockAllocation.quantity,
        stockAllocation.lowStockThreshold,
        products,
        branches
      );
      
      if (success) {
        console.log('✅ Allocation successful');
        
        // Reset form
        setStockAllocation({ 
          productId: '', 
          branchId: '', 
          quantity: '',
          lowStockThreshold: '5'
        });
        
        setIsModalOpen(false);
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
        
        toast.success('Stock Allocated Successfully');
        return true;
      }
    } catch (error: any) {
      console.error('❌ Allocation error:', error);
      toast.error('Allocation Failed', {
        description: error.message || 'Failed to allocate stock'
      });
    } finally {
      setLoading(false);
    }
    
    return false;
  }, [stockAllocation, handleAllocateStock, products, branches, warehouseInventory, onSuccess]);

  const openModal = useCallback((initialState?: Partial<StockAllocationState>) => {
    if (initialState) {
      setStockAllocation(prev => ({
        ...prev,
        ...initialState,
        lowStockThreshold: initialState.lowStockThreshold || 
                         products.find(p => p.id === initialState.productId)?.low_stock_threshold?.toString() || 
                         '5'
      }));
    }
    setIsModalOpen(true);
  }, [products]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    // Reset state after modal closes
    setTimeout(() => {
      setStockAllocation({
        productId: '',
        branchId: '',
        quantity: '',
        lowStockThreshold: '5'
      });
    }, 300);
  }, []);

  const getSelectedProduct = () => {
    return products.find(p => p.id === stockAllocation.productId);
  };

  const getSelectedBranch = () => {
    return branches.find(b => b.id === stockAllocation.branchId);
  };

  const getWarehouseStock = () => {
    const item = warehouseInventory.find(w => w.product_id === stockAllocation.productId);
    return item?.quantity || 0;
  };

  const getCurrentBranchStock = () => {
    if (!stockAllocation.branchId || stockAllocation.branchId === 'all') return 0;
    
    const item = branchInventory.find(
      item => item.branch_id === stockAllocation.branchId && 
              item.product_id === stockAllocation.productId
    );
    
    if (item) {
      return (item.retail_quantity || 0) + (item.wholesale_quantity || 0);
    }
    
    return 0;
  };

  return {
    // State
    stockAllocation,
    setStockAllocation,
    isStockAllocateModalOpen: isModalOpen,
    setIsStockAllocateModalOpen: setIsModalOpen,
    loading,
    
    // Actions
    handleAllocateStockSubmit,
    openStockAllocationModal: openModal,
    closeStockAllocationModal: closeModal,
    
    // Helpers
    getSelectedProduct,
    getSelectedBranch,
    getWarehouseStock,
    getCurrentBranchStock
  };
};