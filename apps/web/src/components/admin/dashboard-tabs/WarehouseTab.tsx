import React, { useState, useEffect } from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { StatCard } from '../StatCard';
import { Select } from '../../Select';
import { Button } from '../../Button';
import { toast } from 'sonner';
import { Package, TrendingUp, DollarSign, Tag, Box, Truck, Warehouse, ArrowRight, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { ProductImage } from '../../shop/ProductImage';

interface WarehouseTabProps {
  warehouseInventory: any[];
  products: any[];
  loading: boolean;
  selectedBranchFilter: string;
  setSelectedBranchFilter: (filter: string) => void;
  setIsBatchAllocationModalOpen: (open: boolean) => void;
  setIsAddWarehouseProductModalOpen: (open: boolean) => void;
  setIsStockAllocateModalOpen: (open: boolean) => void;
  setStockAllocation: (allocation: any) => void;
  setEditingProduct: (product: any) => void;
  setIsEditProductModalOpen: (open: boolean) => void;
  branches: any[];
  toast: typeof toast;
  stats: any;
  onRefresh?: () => void; // Added refresh callback
}

export const WarehouseTab: React.FC<WarehouseTabProps> = ({
  warehouseInventory,
  products,
  loading,
  selectedBranchFilter,
  setSelectedBranchFilter,
  setIsBatchAllocationModalOpen,
  setIsAddWarehouseProductModalOpen,
  setIsStockAllocateModalOpen,
  setStockAllocation,
  setEditingProduct,
  setIsEditProductModalOpen,
  branches,
  toast,
  stats,
  onRefresh // Added prop
}) => {
  const [tableScrollable, setTableScrollable] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const filteredInventory = warehouseInventory.filter(item => 
    selectedBranchFilter === 'all' || item.warehouse_location === selectedBranchFilter
  );

  // Check if table should be scrollable (3+ rows)
  useEffect(() => {
    setTableScrollable(filteredInventory.length > 3);
  }, [filteredInventory.length]);

  // Handle manual refresh
  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setRefreshing(true);
    try {
      await onRefresh();
      toast.success('Data refreshed', {
        description: 'Warehouse inventory has been updated'
      });
    } catch (error) {
      toast.error('Refresh failed', {
        description: 'Could not refresh inventory data'
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Format numbers with commas for thousands
  const formatCurrency = (amount: number): string => {
    return `₵${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US');
  };

  // Calculate total inventory value
  const totalInventoryValue = filteredInventory.reduce((sum, item) => {
    const product = item.products;
    const retailPrice = product?.price || 0;
    return sum + ((item.quantity || 0) * retailPrice);
  }, 0);

  // Calculate total units
  const totalUnits = filteredInventory.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Calculate average margin percentage
  const averageMargin = filteredInventory.length > 0 
    ? filteredInventory.reduce((sum, item) => {
        const product = item.products;
        const costPerUnit = item.cost_per_unit || 0;
        const retailPrice = product?.price || 0;
        const margin = retailPrice - costPerUnit;
        const marginPercentage = costPerUnit > 0 ? ((margin / costPerUnit) * 100) : 0;
        return sum + marginPercentage;
      }, 0) / filteredInventory.length
    : 0;

  return (
    <div>
      <DashboardHeader
        title="Warehouse Management"
        subtitle="Central stock hub — add products here first, then allocate to branches"
        actionButton={{
          label: 'Add Product to Warehouse',
          onClick: () => setIsAddWarehouseProductModalOpen(true),
          icon: '📦',
        }}
        actionTourId="admin-warehouse-add"
        secondaryAction={
          <Button
            variant="secondary"
            size="sm"
            data-tour="admin-allocate"
            onClick={() => setIsBatchAllocationModalOpen(true)}
          >
            Batch Allocate
          </Button>
        }
      />
      
      {/* Warehouse Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard 
          title="Total Products" 
          value={formatNumber(filteredInventory.length)} 
          icon="📦" 
          color="blue"
          trend={`${formatNumber(products.length)} in system`}
        />
        <StatCard 
          title="Total Units" 
          value={formatNumber(totalUnits)} 
          icon="📊" 
          color="green"
          trend="Available for allocation"
        />
        <StatCard 
          title="Total Value" 
          value={formatCurrency(totalInventoryValue)} 
          icon="💰" 
          color="purple"
          trend="Retail value"
        />
        <StatCard 
          title="Avg Margin" 
          value={`${averageMargin.toFixed(1)}%`} 
          icon="🏷️" 
          color="orange"
          trend="Gross profit"
        />
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-card rounded-xl shadow-sm border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Warehouse Inventory</h3>
                <p className="text-sm text-muted-foreground">
                  Showing {formatNumber(filteredInventory.length)} of {formatNumber(warehouseInventory.length)} products
                  {tableScrollable && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-500/15 text-blue-700 text-xs rounded-full">
                      Scrollable Table
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <Select
                  value={selectedBranchFilter}
                  onChange={(value) => setSelectedBranchFilter(value)}
                  options={[
                    { value: 'all', label: 'All Locations' },
                    { value: 'Main Warehouse', label: 'Main Warehouse' },
                    { value: 'Storage Area A', label: 'Storage Area A' },
                    { value: 'Storage Area B', label: 'Storage Area B' },
                    { value: 'Cold Storage', label: 'Cold Storage' }
                  ]}
                  className="w-48"
                />
                {/* Refresh Button */}
                {onRefresh && (
                  <Button
                    variant="secondary"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => setIsBatchAllocationModalOpen(true)}
                  className="flex items-center"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Batch Allocate
                </Button>
              </div>
            </div>
          </div>
          
          {/* Table Container */}
          {filteredInventory.length > 0 ? (
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className={`overflow-x-auto ${tableScrollable ? 'max-h-[500px] overflow-y-auto' : ''}`}>
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-secondary/60 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-secondary/60">
                        Product Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-secondary/60">
                        Stock & Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-secondary/60">
                        Cost & Pricing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-secondary/60">
                        Supplier & Batch
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-secondary/60">
                        Value & Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredInventory.map(item => {
                      const product = item.products;
                      if (!product) return null;
                      
                      const costPerUnit = item.cost_per_unit || 0;
                      const retailPrice = product.price || 0;
                      const wholesalePrice = product.wholesale_price || 0;
                      const margin = retailPrice - costPerUnit;
                      const marginPercentage = costPerUnit > 0 ? ((margin / costPerUnit) * 100).toFixed(1) : 0;
                      const quantity = item.quantity || 0;
                      const totalValue = quantity * retailPrice;
                      const isLowStock = quantity <= (item.min_stock_level || 10);
                      const boxesReceived = item.boxes_received || 0;
                      const unitsPerBox = item.units_per_box || 1;
                      
                      return (
                        <tr key={item.id} className="hover:bg-secondary/60">
                          {/* Product Details */}
                          <td className="px-6 py-4">
                            <div className="flex items-start space-x-3">
                              <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-secondary/80 border border-border flex items-center justify-center">
                                <ProductImage
                                  imageUrl={product.image_url}
                                  name={product.name}
                                  className="w-full h-full object-cover"
                                  iconClassName="text-2xl opacity-50"
                                />
                              </div>
                              <div>
                                <div className="font-medium text-foreground">{product.name}</div>
                                <div className="text-sm text-muted-foreground">SKU: {product.sku || 'N/A'}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  <div className="flex items-center">
                                    <Box className="h-3 w-3 mr-1" />
                                    {formatNumber(boxesReceived)} boxes
                                    <span className="mx-1">•</span>
                                    {formatNumber(unitsPerBox)} units/box
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {/* Stock & Location */}
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className={`text-lg font-bold ${
                                  isLowStock ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {formatNumber(quantity)} units
                                </span>
                                <span className="px-2 py-1 bg-blue-500/15 text-blue-800 text-xs rounded-full">
                                  {item.warehouse_location || 'Main Warehouse'}
                                </span>
                              </div>
                              <div className={`h-2 rounded-full ${
                                isLowStock ? 'bg-red-200' : 'bg-green-200'
                              }`}>
                                <div 
                                  className={`h-2 rounded-full ${
                                    isLowStock ? 'bg-red-500/100' : 'bg-emerald-500/100'
                                  }`}
                                  style={{ 
                                    width: `${Math.min(100, (quantity / (item.max_stock_level || 100)) * 100)}%` 
                                  }}
                                ></div>
                              </div>
                              {isLowStock && (
                                <div className="text-xs text-red-500 font-medium">
                                  ⚠️ Low stock alert
                                </div>
                              )}
                            </div>
                          </td>
                          
                          {/* Cost & Pricing */}
                          <td className="px-6 py-4">
                            <div className="space-y-3">
                              <div>
                                <div className="text-xs text-muted-foreground">Cost per unit</div>
                                <div className="font-medium text-foreground">{formatCurrency(costPerUnit)}</div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-blue-500/10 p-2 rounded">
                                  <div className="text-xs text-blue-600">Retail</div>
                                  <div className="font-bold text-blue-700">{formatCurrency(retailPrice)}</div>
                                </div>
                                {wholesalePrice > 0 && (
                                  <div className="bg-emerald-500/10 p-2 rounded">
                                    <div className="text-xs text-green-600">Wholesale</div>
                                    <div className="font-bold text-green-700">{formatCurrency(wholesalePrice)}</div>
                                  </div>
                                )}
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-medium ${
                                margin > 0 ? 'bg-emerald-500/15 text-green-800' : 'bg-red-500/15 text-red-800'
                              }`}>
                                <TrendingUp className="inline h-3 w-3 mr-1" />
                                {marginPercentage}% margin ({formatCurrency(margin)})
                              </div>
                            </div>
                          </td>
                          
                          {/* Supplier & Batch */}
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              {item.supplier_name ? (
                                <div className="bg-secondary/60 p-2 rounded-lg">
                                  <div className="flex items-center text-xs text-muted-foreground mb-1">
                                    <Truck className="h-3 w-3 mr-1" />
                                    Supplier
                                  </div>
                                  <div className="font-medium text-foreground">{item.supplier_name}</div>
                                  {item.date_received && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      📅 {new Date(item.date_received).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground italic">No supplier info</div>
                              )}
                              
                              {item.batch_lot_number && (
                                <div className="bg-secondary p-2 rounded-lg">
                                  <div className="text-xs text-muted-foreground">Batch/Lot</div>
                                  <div className="font-mono text-sm">{item.batch_lot_number}</div>
                                </div>
                              )}
                            </div>
                          </td>
                          
                          {/* Value & Actions */}
                          <td className="px-6 py-4">
                            <div className="space-y-4">
                              <div className="text-right">
                                <div className="text-xs text-muted-foreground">Total Value</div>
                                <div className="text-xl font-bold text-green-700">{formatCurrency(totalValue)}</div>
                                <div className="text-xs text-muted-foreground">at retail price</div>
                              </div>
                              
                              <div className="flex space-x-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setIsEditProductModalOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    if (branches.length > 0) {
                                      setStockAllocation({
                                        productId: product.id,
                                        branchId: branches[0].id,
                                        quantity: Math.min(10, quantity)
                                      });
                                      setIsStockAllocateModalOpen(true);
                                    } else {
                                      toast.warning('No Branches', {
                                        description: 'Please create a branch first'
                                      });
                                    }
                                  }}
                                  disabled={quantity === 0}
                                >
                                  Allocate
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Table Footer */}
              <div className="bg-secondary/60 px-6 py-3 border-t border-border">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <span>
                      Showing <span className="font-medium">{formatNumber(filteredInventory.length)}</span> products
                    </span>
                    {tableScrollable && (
                      <span className="ml-3 flex items-center text-blue-600">
                        <ChevronUp className="h-4 w-4 mr-1" />
                        <ChevronDown className="h-4 w-4" />
                        <span className="ml-2 text-xs">Scroll to see more</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500/100"></div>
                      <span>Good Stock: {formatNumber(filteredInventory.filter(item => (item.quantity || 0) > (item.min_stock_level || 10)).length)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-red-500/100"></div>
                      <span>Low Stock: {formatNumber(filteredInventory.filter(item => (item.quantity || 0) <= (item.min_stock_level || 10)).length)}</span>
                    </div>
                    {/* Last Updated Time */}
                    <div className="text-xs text-muted-foreground">
                      {onRefresh && (
                        <button 
                          onClick={handleRefresh}
                          className="hover:text-blue-600 transition-colors"
                          disabled={refreshing}
                        >
                          {refreshing ? 'Refreshing...' : '↻ Refresh now'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="col-span-full text-center py-12 bg-card rounded-2xl shadow-sm border border-border">
              <div className="text-4xl mb-4">🏭</div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {selectedBranchFilter === 'all' ? 'No warehouse inventory yet' : 'No products in this location'}
              </h3>
              <p className="text-muted-foreground mb-6">
                All products must be added to warehouse before they can be allocated to branches
              </p>
              <div className="flex items-center justify-center space-x-4">
                <Button
                  variant="primary"
                  onClick={() => setIsAddWarehouseProductModalOpen(true)}
                  className="flex items-center"
                >
                  <span className="text-xl mr-2">+</span>
                  Add First Product to Warehouse
                </Button>
                {onRefresh && (
                  <Button
                    variant="secondary"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};