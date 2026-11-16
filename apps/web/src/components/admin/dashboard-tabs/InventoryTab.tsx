import React, { useState, useMemo } from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { ProductCard } from '../ProductCard';
import { Select } from '../../Select';
import { Button } from '../../Button';
import { Input } from '../../Input';
import { Search, AlertTriangle, Package, Store, Warehouse, X, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';

interface InventoryTabProps {
  products: any[];
  branches: any[];
  branchInventory: any[];
  warehouseInventory: any[];
  loading: boolean;
  selectedBranchFilter: string;
  setSelectedBranchFilter: (branchId: string) => void;
  setIsStockAllocateModalOpen: (open: boolean) => void;
  setIsAddWarehouseProductModalOpen: (open: boolean) => void;
  setStockAllocation: (allocation: any) => void;
  handleDeleteProduct: (productId: string) => void;
  setEditingProduct: (product: any) => void;
  setIsEditProductModalOpen: (open: boolean) => void;
  toast: typeof toast;
  getProductStock: (productId: string) => { retail: number; wholesale: number; total: number };
  getSalesTypeLabel: (type: 'retail' | 'wholesale' | 'both') => string;
  refreshing?: boolean;
  onRefresh?: () => void;
  openStockAllocationModal?: (allocationData?: any) => void;
  // ✅ ADD THIS:
  removeAllocatedStock?: (branchId: string, productId: string, quantity: number, reason: string) => Promise<boolean>;
  companyId?: string | null;
  onOpenOnlineOrders?: () => void;
  inventoryModel?: 'warehouse' | 'branch_only';
  setIsAddBranchStockModalOpen?: (open: boolean) => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  products,
  branches,
  branchInventory,
  warehouseInventory,
  loading,
  selectedBranchFilter,
  setSelectedBranchFilter,
  setIsStockAllocateModalOpen,
  setIsAddWarehouseProductModalOpen,
  setStockAllocation,
  handleDeleteProduct,
  setEditingProduct,
  setIsEditProductModalOpen,
  toast,
  getProductStock,
  getSalesTypeLabel,
  refreshing = false,
  onRefresh,
  openStockAllocationModal,
  removeAllocatedStock,
  companyId,
  onOpenOnlineOrders,
  inventoryModel = 'warehouse',
  setIsAddBranchStockModalOpen,
}) => {
  const isBranchOnly = inventoryModel === 'branch_only';
  const [searchQuery, setSearchQuery] = useState('');
  
  // ✅ ADD STATE FOR REMOVE STOCK MODAL
  const [removeStockModal, setRemoveStockModal] = useState<{
    isOpen: boolean;
    branchId: string;
    productId: string;
    productName: string;
    currentStock: number;
    maxQuantity: number;
  }>({
    isOpen: false,
    branchId: '',
    productId: '',
    productName: '',
    currentStock: 0,
    maxQuantity: 0
  });
  
  // ✅ ADD STATE FOR REMOVAL FORM
  const [removalQuantity, setRemovalQuantity] = useState('');
  const [removalReason, setRemovalReason] = useState('');
  const [removing, setRemoving] = useState(false);
  
  // Get products that are actually assigned to the selected branch
  const filteredByBranch = useMemo(() => {
    if (selectedBranchFilter === 'all') {
      // Show all products that exist in ANY branch
      const assignedProductIds = new Set(branchInventory.map(item => item.product_id));
      return products.filter(product => assignedProductIds.has(product.id));
    } else {
      // Show ONLY products assigned to the SELECTED branch
      const branchProductIds = new Set(
        branchInventory
          .filter(item => item.branch_id === selectedBranchFilter)
          .map(item => item.product_id)
      );
      return products.filter(product => branchProductIds.has(product.id));
    }
  }, [products, branchInventory, selectedBranchFilter]);
  
  // Filter by search query
  const filteredProducts = useMemo(() => {
    return filteredByBranch.filter(product => {
      if (!searchQuery) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        (product.sku && product.sku.toLowerCase().includes(query)) ||
        product.id.toLowerCase().includes(query)
      );
    });
  }, [filteredByBranch, searchQuery]);

  const selectedBranch = selectedBranchFilter === 'all' 
    ? null 
    : branches.find(b => b.id === selectedBranchFilter);
  
  // Calculate statistics
  const stats = useMemo(() => {
    let totalProducts = filteredProducts.length;
    let totalStock = 0;
    let lowStockCount = 0;
    let warehouseStock = 0;
    
    filteredProducts.forEach(product => {
      const stock = getProductStock(product.id);
      const warehouseItem = warehouseInventory.find(w => w.product_id === product.id);
      
      let productStock = 0;
      let productLowStock = false;
      
      if (selectedBranchFilter !== 'all') {
        // For specific branch
        const branchItem = branchInventory.find(
          item => item.branch_id === selectedBranchFilter && item.product_id === product.id
        );
        
        if (branchItem) {
          productStock = (branchItem.retail_quantity || 0) + (branchItem.wholesale_quantity || 0);
          productLowStock = branchItem.low_stock || 
            (productStock <= product.low_stock_threshold);
        }
      } else {
        // For all branches
        productStock = stock.total;
        productLowStock = stock.total <= product.low_stock_threshold;
      }
      
      totalStock += productStock;
      warehouseStock += warehouseItem?.quantity || 0;
      
      if (productLowStock) {
        lowStockCount++;
      }
    });
    
    return {
      totalProducts,
      totalStock,
      lowStockCount,
      warehouseStock
    };
  }, [filteredProducts, getProductStock, warehouseInventory, branchInventory, selectedBranchFilter]);

  // ✅ Function to open remove stock modal
  const openRemoveStockModal = (branchId: string, productId: string, productName: string) => {
    if (selectedBranchFilter === 'all') {
      toast.warning('Select Branch First', {
        description: 'Please select a specific branch to remove stock from'
      });
      return;
    }

    // Get current stock for this product in the selected branch
    const branchItem = branchInventory.find(
      item => item.branch_id === selectedBranchFilter && item.product_id === productId
    );
    
    const currentStock = branchItem 
      ? (branchItem.retail_quantity || 0) + (branchItem.wholesale_quantity || 0)
      : 0;

    if (currentStock <= 0) {
      toast.warning('No Stock Available', {
        description: 'This product has no stock in the selected branch'
      });
      return;
    }

    setRemoveStockModal({
      isOpen: true,
      branchId: selectedBranchFilter,
      productId,
      productName,
      currentStock,
      maxQuantity: currentStock
    });

    // Reset form
    setRemovalQuantity('');
    setRemovalReason('');
  };

  // ✅ Function to handle stock removal
  const handleRemoveStock = async () => {
    if (!removeAllocatedStock) {
      toast.error('Function Not Available', {
        description: 'Stock removal function is not available'
      });
      return;
    }

    if (!removalQuantity || parseInt(removalQuantity) <= 0) {
      toast.error('Invalid Quantity', {
        description: 'Please enter a valid quantity to remove'
      });
      return;
    }

    if (!removalReason.trim()) {
      toast.error('Reason Required', {
        description: 'Please provide a reason for removing stock'
      });
      return;
    }

    const quantity = parseInt(removalQuantity);
    
    if (quantity > removeStockModal.maxQuantity) {
      toast.error('Insufficient Stock', {
        description: `Cannot remove more than ${removeStockModal.maxQuantity} units`
      });
      return;
    }

    setRemoving(true);
    try {
      const success = await removeAllocatedStock(
        removeStockModal.branchId,
        removeStockModal.productId,
        quantity,
        removalReason
      );

      if (success) {
        toast.success('Stock Removed', {
          description: `${quantity} units removed from ${removeStockModal.productName}`
        });
        
        // Close modal and refresh data
        setRemoveStockModal(prev => ({ ...prev, isOpen: false }));
        setRemovalQuantity('');
        setRemovalReason('');
        
        // Refresh inventory data
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (error: any) {
      toast.error('Removal Failed', {
        description: error.message || 'Failed to remove stock'
      });
    } finally {
      setRemoving(false);
    }
  };

  // Handle allocate button click
  const handleAllocateClick = (product: any, warehouseStock: number) => {
    if (branches.length === 0) {
      toast.warning('No Branches', {
        description: 'Please create a branch first'
      });
      return;
    }

    const allocationData = {
      productId: product.id,
      branchId: selectedBranchFilter !== 'all' ? selectedBranchFilter : branches[0].id,
      quantity: Math.min(10, warehouseStock).toString()
    };

    if (openStockAllocationModal) {
      // Use the hook's function if available
      openStockAllocationModal(allocationData);
    } else {
      // Fallback to the old method (for backward compatibility)
      setStockAllocation(allocationData);
      setIsStockAllocateModalOpen(true);
    }
  };

  // Handle empty state allocate button
  const handleEmptyStateAllocate = () => {
    if (selectedBranchFilter !== 'all') {
      setStockAllocation({
        productId: '',
        branchId: selectedBranchFilter,
        quantity: '10'
      });
      setIsStockAllocateModalOpen(true);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* HEADER - Not scrollable */}
        <div className="flex-shrink-0 bg-card border-b border-border pb-4">
          {companyId && onOpenOnlineOrders && (
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {isBranchOnly ? (
                  <>
                    Branch stock powers your{' '}
                    <a
                      href={`/store/${companyId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-medium hover:underline"
                    >
                      marketplace store
                    </a>
                    . Add stock directly to branches — no warehouse.
                  </>
                ) : (
                  <>
                    Warehouse stock powers your{' '}
                    <a
                      href={`/store/${companyId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary font-medium hover:underline"
                    >
                      marketplace store
                    </a>
                    . Customer orders appear under Online Orders.
                  </>
                )}
              </p>
              <div className="flex gap-2 shrink-0">
                {isBranchOnly && setIsAddBranchStockModalOpen && (
                  <Button
                    variant="primary"
                    size="sm"
                    data-tour="admin-branch-stock"
                    onClick={() => setIsAddBranchStockModalOpen(true)}
                  >
                    + Add stock to branch
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={onOpenOnlineOrders}>
                  Manage orders
                </Button>
              </div>
            </div>
          )}
          <DashboardHeader 
            title="Branch Inventory" 
            subtitle={
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
                <span className="text-sm text-muted-foreground">
                  {selectedBranch 
                    ? `Products allocated to ${selectedBranch.name} branch` 
                    : "View products assigned to branches"
                  }
                </span>
                
                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                  {/* Branch Filter */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-sm font-medium text-foreground whitespace-nowrap">Branch:</span>
                    <Select
                      value={selectedBranchFilter}
                      onChange={(value) => setSelectedBranchFilter(value)}
                      options={[
                        { value: 'all', label: 'All Branches' },
                        ...branches.map(branch => ({
                          value: branch.id,
                          label: `${branch.name} (${getSalesTypeLabel(branch.sales_type)})`
                        }))
                      ]}
                      className="w-full sm:w-64"
                    />
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-80">
                    <Input
                      type="text"
                      placeholder="Search by name, SKU..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  
                  {/* Refresh Button */}
                  {onRefresh && (
                    <Button
                      variant="secondary"
                      onClick={onRefresh}
                      disabled={refreshing}
                      className="whitespace-nowrap"
                    >
                      {refreshing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500 mr-2"></div>
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            }
          />
          
          {/* Results Count */}
          {searchQuery && (
            <div className="mt-4 px-2">
              <p className="text-sm text-muted-foreground">
                Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} 
                {selectedBranch && ` in ${selectedBranch.name}`} matching "{searchQuery}"
              </p>
            </div>
          )}

          {/* Summary Stats */}
          {!loading && filteredProducts.length > 0 && (
            <div className={`mt-4 grid gap-4 px-2 ${isBranchOnly ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-blue-600 font-medium">Total Products</p>
                </div>
                <p className="text-2xl font-bold text-blue-900">{stats.totalProducts}</p>
              </div>
              
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-purple-600" />
                  <p className="text-xs text-purple-600 font-medium">Branch Stock</p>
                </div>
                <p className="text-2xl font-bold text-purple-900">{stats.totalStock} units</p>
              </div>
              
              {!isBranchOnly && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-orange-600" />
                    <p className="text-xs text-orange-600 font-medium">Warehouse Stock</p>
                  </div>
                  <p className="text-2xl font-bold text-orange-900">{stats.warehouseStock} units</p>
                </div>
              )}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <p className="text-xs text-red-600 font-medium">Low Stock Items</p>
                </div>
                <p className="text-2xl font-bold text-red-900">{stats.lowStockCount}</p>
              </div>
            </div>
          )}
        </div>
        
        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                <p className="text-muted-foreground font-medium">Loading inventory...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            // Empty State
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-4">
                  {searchQuery ? '🔍' : selectedBranchFilter === 'all' ? '📦' : '🏪'}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {searchQuery 
                    ? 'No products found'
                    : selectedBranchFilter === 'all' 
                      ? 'No products assigned to branches yet' 
                      : `No products in ${selectedBranch?.name}`
                  }
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery 
                    ? `No products match "${searchQuery}"${selectedBranch ? ` in ${selectedBranch.name}` : ''}`
                    : selectedBranchFilter === 'all' 
                      ? (isBranchOnly
                          ? 'Add products and stock to your branches to get started'
                          : 'Products need to be allocated from warehouse to branches first')
                      : (isBranchOnly
                          ? `Add stock to ${selectedBranch?.name} for products to appear here`
                          : `This branch doesn't have any products allocated yet`)
                  }
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  {searchQuery ? (
                    <Button
                      variant="secondary"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear Search
                    </Button>
                  ) : isBranchOnly ? (
                    <>
                      <Button
                        variant="primary"
                        onClick={() => setIsAddBranchStockModalOpen?.(true)}
                        disabled={branches.length === 0}
                      >
                        + Add stock to branch
                      </Button>
                      {selectedBranchFilter === 'all' && (
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          Tip: select a specific branch in the filter to manage stock per location.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        onClick={() => setIsAddWarehouseProductModalOpen(true)}
                      >
                        + Add Product to Warehouse
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleEmptyStateAllocate}
                        disabled={selectedBranchFilter === 'all'}
                      >
                        📤 Allocate to Branch
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => {
                const stock = getProductStock(product.id);
                const warehouseItem = warehouseInventory.find(w => w.product_id === product.id);
                const warehouseStock = warehouseItem?.quantity || 0;
                
                // Get branch-specific data
                let branchRetailStock = 0;
                let branchWholesaleStock = 0;
                let branchTotalStock = 0;
                let isLowStock = false;
                let lowStockItem = null;
                
                if (selectedBranchFilter !== 'all') {
                  // For specific branch
                  lowStockItem = branchInventory.find(
                    item => item.branch_id === selectedBranchFilter && item.product_id === product.id
                  );
                  
                  if (lowStockItem) {
                    branchRetailStock = lowStockItem.retail_quantity || 0;
                    branchWholesaleStock = lowStockItem.wholesale_quantity || 0;
                    branchTotalStock = branchRetailStock + branchWholesaleStock;
                    isLowStock = lowStockItem.low_stock || (branchTotalStock <= product.low_stock_threshold);
                  }
                } else {
                  // For all branches
                  branchTotalStock = stock.total;
                  
                  // Check if any branch has this product marked as low stock
                  const branchItems = branchInventory.filter(item => item.product_id === product.id);
                  isLowStock = branchItems.some(item => item.low_stock === true) || 
                               branchTotalStock <= product.low_stock_threshold;
                }
                
                return (
                  <div key={product.id} id={`product-${product.id}`} className="h-full">
                    <ProductCard
                      product={{
                        id: product.id,
                        name: product.name,
                        sku: product.sku || 'N/A',
                        price: product.price,
                        wholesale_price: product.wholesale_price,
                        low_stock_threshold: product.low_stock_threshold,
                        retail_stock: selectedBranchFilter !== 'all' ? branchRetailStock : stock.retail,
                        wholesale_stock: selectedBranchFilter !== 'all' ? branchWholesaleStock : stock.wholesale,
                        total_stock: selectedBranchFilter !== 'all' 
                          ? branchTotalStock 
                          : stock.total,
                        warehouse_stock: warehouseStock,
                        branch_retail_stock: selectedBranchFilter !== 'all' ? branchRetailStock : undefined,
                        branch_wholesale_stock: selectedBranchFilter !== 'all' ? branchWholesaleStock : undefined,
                        is_low_stock: isLowStock
                      }}
                      onDelete={() => handleDeleteProduct(product.id)}
                      onEdit={() => {
                        setEditingProduct(product);
                        setIsEditProductModalOpen(true);
                      }}
                      onAllocate={!isBranchOnly ? () => handleAllocateClick(product, warehouseStock) : undefined}
                      // ✅ ADD ON REMOVE FUNCTION
                      onRemove={() => openRemoveStockModal(
                        selectedBranchFilter,
                        product.id,
                        product.name
                      )}
                      showBranch={selectedBranchFilter !== 'all' ? selectedBranch?.name : undefined}
                      showWarehouse={!isBranchOnly}
                      isAssigned={true}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ✅ REMOVE STOCK MODAL */}
      {removeStockModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/15 rounded-lg">
                  <MinusCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Remove Stock</h3>
                  <p className="text-sm text-muted-foreground">{removeStockModal.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    Branch: {selectedBranch?.name || 'Unknown'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRemoveStockModal(prev => ({ ...prev, isOpen: false }))}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
                disabled={removing}
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              handleRemoveStock();
            }} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Current Available Stock
                </label>
                <div className="text-2xl font-bold text-foreground">
                  {removeStockModal.currentStock} units
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Quantity to Remove *
                </label>
                <input
                  type="number"
                  min="1"
                  max={removeStockModal.maxQuantity}
                  value={removalQuantity}
                  onChange={(e) => setRemovalQuantity(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Enter quantity"
                  required
                  disabled={removing}
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Maximum: {removeStockModal.maxQuantity} units
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Reason for Removal *
                </label>
                <textarea
                  value={removalReason}
                  onChange={(e) => setRemovalReason(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px]"
                  placeholder={isBranchOnly
                    ? 'e.g., Damaged goods, Expired, Quality issue, Theft...'
                    : 'e.g., Damaged goods, Return to warehouse, Expired, Quality issue...'}
                  required
                  disabled={removing}
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Important Notice</p>
                    <ul className="mt-2 list-disc pl-4 space-y-1">
                      <li>This action will permanently remove stock from branch inventory</li>
                      {isBranchOnly ? (
                        <li>Removed stock is written off (not returned to a warehouse)</li>
                      ) : (
                        <li>Removed stock will be returned to warehouse inventory</li>
                      )}
                      <li>This action will be logged in the audit trail</li>
                      <li>Cannot be undone without manual intervention</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setRemoveStockModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-4 py-3 border border-border text-foreground font-medium rounded-lg hover:bg-secondary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={removing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={removing || !removalQuantity || !removalReason || parseInt(removalQuantity) <= 0}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {removing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Removing...
                    </>
                  ) : (
                    'Remove Stock'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};