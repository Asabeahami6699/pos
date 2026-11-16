// components/admin/StockAllocationModal.tsx - FIXED VERSION
import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../Modal';
import { Select } from '../Select';
import { Input } from '../Input';
import { Button } from '../Button';
import { AlertTriangle, Package, Store, Warehouse, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface StockAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<boolean>;
  products: any[];
  branches: any[];
  warehouseInventory: any[];
  branchInventory: any[];
  stockAllocation: {
    productId: string;
    branchId: string;
    quantity: string;
    lowStockThreshold: string;
  };
  setStockAllocation: React.Dispatch<React.SetStateAction<any>>;
  getSalesTypeLabel: (type: 'retail' | 'wholesale' | 'both') => string;
  loading?: boolean;
}

export const StockAllocationModal: React.FC<StockAllocationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  products,
  branches,
  warehouseInventory,
  branchInventory,
  stockAllocation,
  setStockAllocation,
  getSalesTypeLabel,
  loading = false
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset errors when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setErrors({});
    }
  }, [isOpen]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === stockAllocation.productId);
  }, [products, stockAllocation.productId]);

  const selectedBranch = useMemo(() => {
    return branches.find(b => b.id === stockAllocation.branchId);
  }, [branches, stockAllocation.branchId]);

  const warehouseStock = useMemo(() => {
    const item = warehouseInventory.find(w => w.product_id === stockAllocation.productId);
    return item?.quantity || 0;
  }, [warehouseInventory, stockAllocation.productId]);

  const currentBranchStock = useMemo(() => {
    if (!stockAllocation.branchId || stockAllocation.branchId === 'all') return 0;
    
    const item = branchInventory.find(
      item => item.branch_id === stockAllocation.branchId && 
              item.product_id === stockAllocation.productId
    );
    
    if (item) {
      return (item.retail_quantity || 0) + (item.wholesale_quantity || 0);
    }
    
    return 0;
  }, [branchInventory, stockAllocation.branchId, stockAllocation.productId]);

  const totalAfterAllocation = useMemo(() => {
    return currentBranchStock + parseInt(stockAllocation.quantity || '0');
  }, [currentBranchStock, stockAllocation.quantity]);

  const handleProductChange = (value: string) => {
    const product = products.find(p => p.id === value);
    setStockAllocation((prev: any) => ({
      ...prev,
      productId: value,
      lowStockThreshold: product?.low_stock_threshold?.toString() || '5'
    }));
    setErrors(prev => ({ ...prev, productId: '' }));
  };

  const handleBranchChange = (value: string) => {
    setStockAllocation((prev: any) => ({ ...prev, branchId: value }));
    setErrors(prev => ({ ...prev, branchId: '' }));
  };

  const handleQuantityChange = (value: string) => {
    const qty = parseInt(value) || 0;
    
    if (qty > warehouseStock && warehouseStock > 0) {
      toast.warning('Insufficient Stock', {
        description: `Only ${warehouseStock} units available in warehouse`
      });
    }
    
    setStockAllocation((prev: any) => ({ ...prev, quantity: value }));
    setErrors(prev => ({ ...prev, quantity: '' }));
  };

  const handleThresholdChange = (value: string) => {
    setStockAllocation((prev: any) => ({ ...prev, lowStockThreshold: value }));
    setErrors(prev => ({ ...prev, lowStockThreshold: '' }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});
    
    // Basic validation
    const newErrors: Record<string, string> = {};

    if (!stockAllocation.productId) {
      newErrors.productId = 'Please select a product';
    }

    if (!stockAllocation.branchId) {
      newErrors.branchId = 'Please select a branch';
    }

    if (!stockAllocation.quantity || parseInt(stockAllocation.quantity) <= 0) {
      newErrors.quantity = 'Please enter a valid quantity';
    } else if (parseInt(stockAllocation.quantity) > warehouseStock) {
      newErrors.quantity = `Insufficient warehouse stock. Only ${warehouseStock} units available`;
    }

    if (!stockAllocation.lowStockThreshold || parseInt(stockAllocation.lowStockThreshold) <= 0) {
      newErrors.lowStockThreshold = 'Low stock threshold must be at least 1';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Call the parent submit handler
    const success = await onSubmit(e);
    
    if (success) {
      setErrors({});
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Allocate Stock from Warehouse to Branch"
      size="lg"
    >
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Product Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Product from Warehouse *
          </label>
          <Select
            value={stockAllocation.productId}
            onChange={handleProductChange}
            options={[
              { value: '', label: 'Select a product...' },
              ...products.map(p => {
                const available = warehouseInventory.find(w => w.product_id === p.id)?.quantity || 0;
                return {
                  value: p.id,
                  label: `${p.name} (${p.sku || 'N/A'}) - ${available} units available`,
                  disabled: available === 0
                };
              })
            ]}
            required
          />
          {errors.productId && (
            <p className="mt-1 text-sm text-red-600">{errors.productId}</p>
          )}
        </div>

        {/* Branch Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Destination Branch *
          </label>
          <Select
            value={stockAllocation.branchId}
            onChange={handleBranchChange}
            options={[
              { value: '', label: 'Select a branch...' },
              ...branches.map(b => ({
                value: b.id,
                label: `${b.name} (${getSalesTypeLabel(b.sales_type)})`
              }))
            ]}
            required
          />
          {errors.branchId && (
            <p className="mt-1 text-sm text-red-600">{errors.branchId}</p>
          )}
        </div>

        {/* Quantity and Threshold */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Quantity to Allocate *
            </label>
            <Input
              type="number"
              value={stockAllocation.quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              required
              min="1"
              max={warehouseStock}
              placeholder="Enter quantity"
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Low Stock Threshold *
            </label>
            <Input
              type="number"
              value={stockAllocation.lowStockThreshold}
              onChange={(e) => handleThresholdChange(e.target.value)}
              required
              min="1"
              placeholder="Set alert threshold"
            />
            {errors.lowStockThreshold && (
              <p className="mt-1 text-sm text-red-600">{errors.lowStockThreshold}</p>
            )}
          </div>
        </div>

        {/* Stock Information */}
        {stockAllocation.productId && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-500/10 rounded-lg border-2 border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Warehouse className="h-5 w-5 text-blue-600" />
                <p className="text-sm font-semibold text-blue-900">Warehouse Available</p>
              </div>
              <p className="text-2xl font-black text-blue-700">{warehouseStock} units</p>
            </div>

            {stockAllocation.branchId && stockAllocation.branchId !== 'all' && (
              <div className="p-4 bg-orange-500/10 rounded-lg border-2 border-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="h-5 w-5 text-orange-600" />
                  <p className="text-sm font-semibold text-orange-900">Current Branch Stock</p>
                </div>
                <p className="text-2xl font-black text-orange-700">{currentBranchStock} units</p>
              </div>
            )}
          </div>
        )}

        {/* Allocation Summary */}
        {stockAllocation.productId && stockAllocation.branchId && stockAllocation.quantity && (
          <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-50 rounded-xl border-2 border-green-300 shadow-sm">
            <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Allocation Summary
            </h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground font-medium">From:</span>
                  <span className="font-bold text-foreground">Warehouse</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground font-medium">To:</span>
                  <span className="font-bold text-foreground">{selectedBranch?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground font-medium">Product:</span>
                  <span className="font-bold text-foreground">{selectedProduct?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground font-medium">Quantity:</span>
                  <span className="font-bold text-green-700">{stockAllocation.quantity} units</span>
                </div>
                {selectedBranch && (
                  <div className="flex justify-between">
                    <span className="text-foreground font-medium">Sales Type:</span>
                    <span className="font-bold text-foreground">
                      {getSalesTypeLabel(selectedBranch.sales_type)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-foreground font-medium">Alert at:</span>
                  <span className="font-bold text-yellow-700">≤ {stockAllocation.lowStockThreshold} units</span>
                </div>
              </div>

              {/* Stock After Allocation */}
              {stockAllocation.branchId !== 'all' && (
                <div className="mt-3 p-3 bg-blue-500/15 border-2 border-blue-300 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-700" />
                      <span className="text-sm font-semibold text-blue-900">After Allocation:</span>
                    </div>
                    <span className="text-xl font-black text-blue-900">{totalAfterAllocation} units</span>
                  </div>
                </div>
              )}

              {/* Low Stock Warning */}
              {parseInt(stockAllocation.lowStockThreshold) > 0 && 
               totalAfterAllocation <= parseInt(stockAllocation.lowStockThreshold) && (
                <div className="mt-3 p-3 bg-amber-500/15 border-2 border-yellow-400 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-700 flex-shrink-0" />
                    <span className="text-sm font-semibold text-yellow-900">
                      ⚠️ Warning: Total stock will be at or below low stock threshold after allocation
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={
              !stockAllocation.productId || 
              !stockAllocation.branchId || 
              !stockAllocation.quantity ||
              warehouseStock === 0
            }
          >
            {loading ? 'Allocating...' : 'Allocate Stock'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};