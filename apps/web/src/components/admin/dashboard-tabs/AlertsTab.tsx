import React from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { Button } from '../../Button';
import { toast } from 'sonner';

interface AlertsTabProps {
  lowStockProducts: any[];
  getProductStock: (productId: string, branchId?: string) => { retail: number; wholesale: number; total: number };
  loading: boolean;
  branches: any[];
  setStockAllocation: (allocation: any) => void;
  setIsStockAllocateModalOpen: (open: boolean) => void;
  toast: typeof toast;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  lowStockProducts,
  getProductStock,
  loading,
  branches,
  setStockAllocation,
  setIsStockAllocateModalOpen,
  toast
}) => {
  return (
    <div>
      <DashboardHeader 
        title="Stock Alerts" 
        subtitle="Monitor low stock and out-of-stock situations"
      />
      <div className="flex-1 overflow-y-auto max-h-[70vh] px-4 pb-4">  {/* Scrollable container with max height */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {lowStockProducts.map(product => {
              const stock = getProductStock(product.id).total;
              return (
                <div key={product.id} className="bg-card rounded-xl shadow-sm border border-border p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        stock === 0 ? 'bg-red-500/15' : 'bg-amber-500/15'
                      }`}>
                        <span className="text-xl">{stock === 0 ? '🚨' : '⚠️'}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">{product.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Current: {stock} units | Threshold: {product.low_stock_threshold} units
                        </p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {product.sku} | Retail: ₵{product.price.toFixed(2)}
                          {product.wholesale_price && ` | Wholesale: ₵${product.wholesale_price.toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (branches.length > 0) {
                          setStockAllocation({
                            productId: product.id,
                            branchId: branches[0].id,
                            quantity: (product.low_stock_threshold * 2).toString()
                          });
                          setIsStockAllocateModalOpen(true);
                        } else {
                          toast.warning('No Branches', {
                            description: 'Please create a branch first'
                          });
                        }
                      }}
                    >
                      Restock Now
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {lowStockProducts.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-lg font-medium text-foreground mb-2">No stock alerts</h3>
                <p className="text-muted-foreground">All stock levels are within safe thresholds.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};