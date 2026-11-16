import React from 'react';
import { DashboardHeader } from '../DashboardHeader';

export interface PriceHistory {
  id: string;
  product_id: string;
  old_price: number;
  new_price: number;
  change_type: 'retail' | 'wholesale';
  changed_by: string;
  changed_at: string;
  company_id: string;
  quantity_at_change: number;
  products?: {
    name: string;
    sku: string;
  };
  users?: {
    full_name: string;
  };
}

interface PriceHistoryTabProps {
  priceHistory: PriceHistory[];
  loading: boolean;
}

export const PriceHistoryTab: React.FC<PriceHistoryTabProps> = ({
  priceHistory,
  loading
}) => {
  // Helper function to calculate price change percentage
  const calculateChangePercentage = (oldPrice: number, newPrice: number) => {
    if (oldPrice === 0) return '∞';
    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    return change.toFixed(1);
  };

  // Helper function to get change direction indicator
  const getChangeIndicator = (oldPrice: number, newPrice: number) => {
    if (newPrice > oldPrice) {
      return { 
        icon: '📈', 
        label: 'Increase', 
        color: 'text-green-600', 
        bgColor: 'bg-emerald-500/10', 
        borderColor: 'border-emerald-500/20',
        textColor: 'text-green-700'
      };
    } else if (newPrice < oldPrice) {
      return { 
        icon: '📉', 
        label: 'Decrease', 
        color: 'text-red-600', 
        bgColor: 'bg-red-500/10', 
        borderColor: 'border-red-500/20',
        textColor: 'text-red-700'
      };
    } else {
      return { 
        icon: '➖', 
        label: 'No Change', 
        color: 'text-muted-foreground', 
        bgColor: 'bg-secondary/60', 
        borderColor: 'border-border',
        textColor: 'text-foreground'
      };
    }
  };

  // Helper function to get stock level status
  const getStockStatus = (quantity: number) => {
    if (quantity <= 10) {
      return {
        label: 'Low Stock',
        color: 'text-red-500',
        bgColor: 'bg-red-500/15',
        barColor: 'bg-red-500/100',
        bgBarColor: 'bg-red-200',
        icon: '⚠️'
      };
    } else if (quantity <= 50) {
      return {
        label: 'Moderate Stock',
        color: 'text-yellow-500',
        bgColor: 'bg-amber-500/15',
        barColor: 'bg-amber-500/100/100',
        bgBarColor: 'bg-yellow-200',
        icon: '📦'
      };
    } else {
      return {
        label: 'Good Stock',
        color: 'text-green-500',
        bgColor: 'bg-emerald-500/15',
        barColor: 'bg-emerald-500/100',
        bgBarColor: 'bg-green-200',
        icon: '✅'
      };
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return `₵${amount.toFixed(2)}`;
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div>
        <DashboardHeader 
          title="Price Change History" 
          subtitle="Track retail and wholesale price changes with inventory levels"
        />
        <div className="bg-card rounded-2xl shadow-sm border border-border p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-muted-foreground">Loading price history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader 
        title="Price Change History" 
        subtitle="Track retail and wholesale price changes with inventory levels"
      />
      
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-secondary/60">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Change Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Old Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  New Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Change
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Stock at Change
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Changed By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {priceHistory.map((record) => {
                const changeIndicator = getChangeIndicator(record.old_price, record.new_price);
                const changePercentage = calculateChangePercentage(record.old_price, record.new_price);
                const stockStatus = getStockStatus(record.quantity_at_change || 0);
                const priceDifference = Math.abs(record.new_price - record.old_price);
                
                return (
                  <tr key={record.id} className="hover:bg-secondary/60 transition-colors duration-150">
                    {/* Product */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                          <span className="text-lg">🏷️</span>
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-foreground">
                            {record.products?.name || 'Unknown Product'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            SKU: {record.products?.sku || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Change Type */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium ${
                        record.change_type === 'retail' 
                          ? 'bg-blue-500/15 text-blue-800 border border-blue-500/20' 
                          : 'bg-purple-500/15 text-purple-800 border border-purple-500/20'
                      }`}>
                        {record.change_type === 'retail' ? '🏪 Retail' : '🏭 Wholesale'}
                      </span>
                    </td>

                    {/* Old Price */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground line-through">
                        {formatCurrency(record.old_price)}
                      </div>
                    </td>

                    {/* New Price */}
                    <td className="px-6 py-4">
                      <div className={`text-lg font-bold ${
                        record.new_price > record.old_price 
                          ? 'text-green-600' 
                          : record.new_price < record.old_price 
                          ? 'text-red-600' 
                          : 'text-muted-foreground'
                      }`}>
                        {formatCurrency(record.new_price)}
                      </div>
                    </td>

                    {/* Change */}
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg ${changeIndicator.bgColor} border ${changeIndicator.borderColor}`}>
                        <span className="text-lg">{changeIndicator.icon}</span>
                        <div>
                          <div className={`font-medium ${changeIndicator.color}`}>
                            {changeIndicator.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {priceDifference > 0 ? formatCurrency(priceDifference) : '0.00'} ({changePercentage}%)
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Stock at Change */}
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className={`w-full rounded-full h-2.5 ${stockStatus.bgBarColor}`}>
                              <div 
                                className={`h-2.5 rounded-full ${stockStatus.barColor} transition-all duration-300`}
                                style={{ 
                                  width: `${Math.min(100, ((record.quantity_at_change || 0) / 100) * 100)}%` 
                                }}
                              ></div>
                            </div>
                          </div>
                          <span className="ml-3 font-semibold text-foreground">
                            {record.quantity_at_change || 0}
                          </span>
                          <span className="ml-1 text-sm text-muted-foreground">units</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm mr-1">{stockStatus.icon}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stockStatus.bgColor} ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Changed By */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-muted-foreground">
                            {record.users?.full_name?.charAt(0) || 'S'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-foreground">
                            {record.users?.full_name || 'System'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {record.changed_by?.slice(0, 8) || 'System'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground">
                        {formatDate(record.changed_at)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(record.changed_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {priceHistory.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="text-6xl mb-4">📈</div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        No price history yet
                      </h3>
                      <p className="text-muted-foreground max-w-md mb-6">
                        Price changes will appear here when you update product prices. 
                        Track retail and wholesale price changes over time.
                      </p>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 max-w-md">
                        <p className="text-sm text-blue-800">
                          <span className="font-semibold">💡 Tip:</span> Edit a product and change its retail or wholesale price to see the history here.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Summary Footer */}
        {priceHistory.length > 0 && (
          <div className="bg-secondary/60 px-6 py-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{priceHistory.length}</span> price changes
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <span className="inline-block w-3 h-3 bg-emerald-500/100 rounded-full mr-2"></span>
                  <span className="text-xs text-muted-foreground">Price Increase</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block w-3 h-3 bg-red-500/100 rounded-full mr-2"></span>
                  <span className="text-xs text-muted-foreground">Price Decrease</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block w-3 h-3 bg-blue-500/100 rounded-full mr-2"></span>
                  <span className="text-xs text-muted-foreground">Retail</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block w-3 h-3 bg-purple-500/100 rounded-full mr-2"></span>
                  <span className="text-xs text-muted-foreground">Wholesale</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceHistoryTab;