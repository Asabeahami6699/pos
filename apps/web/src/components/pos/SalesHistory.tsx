import React, { useMemo } from 'react';
import type{ Sale, HistoryFilters } from '../../types/index.ts';
import { DateRangePicker } from './DateRangePicker';
import { Button } from '../Button';

interface SalesHistoryProps {
  sales: Sale[];
  loading: boolean;
  onReturn: (saleId: string) => void;
  onViewDetails: (sale: Sale) => void;
  realtimeConnection: 'connected' | 'disconnected' | 'connecting';
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({
  sales,
  loading,
  onReturn,
  onViewDetails,
  realtimeConnection,
  filters,
  onFiltersChange
}) => {
  
  const filteredSales = useMemo(() => {
    let filtered = sales;
    
    filtered = filtered.filter(sale => {
      const saleDate = new Date(sale.created_at);
      const fromDate = new Date(filters.dateRange.from);
      const toDate = new Date(filters.dateRange.to);
      return saleDate >= fromDate && saleDate <= toDate;
    });
    
    if (filters.status !== 'all') {
      if (filters.status === 'completed') {
        filtered = filtered.filter(sale => !sale.return_status || sale.return_status === 'none');
      } else if (filters.status === 'returned') {
        filtered = filtered.filter(sale => sale.return_status && sale.return_status !== 'none');
      }
    }
    
    return filtered;
  }, [sales, filters]);

  const totals = useMemo(() => {
    const totalSales = filteredSales.length;
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalRefunds = filteredSales.reduce((sum, sale) => sum + (sale.refunded_amount || 0), 0);
    const netRevenue = totalRevenue - totalRefunds;
    
    return { totalSales, totalRevenue, totalRefunds, netRevenue };
  }, [filteredSales]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-base sm:text-lg font-bold text-foreground">Sales History</h3>
        <div className="flex items-center space-x-3">
          <div className="text-xs text-muted-foreground flex items-center">
            <span className={`w-2 h-2 rounded-full mr-1 ${realtimeConnection === 'connected' ? 'bg-emerald-500/100 animate-pulse' : 'bg-red-500/100'}`}></span>
            Live
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl p-3 sm:p-4 border">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mb-3">
          <h4 className="font-medium text-foreground">Filter Sales</h4>
          <div className="text-xs text-muted-foreground">
            Showing {filteredSales.length} of {sales.length} sales
          </div>
        </div>
        
        <div className="space-y-3">
          <DateRangePicker
            range={filters.dateRange}
            onChange={(range) => onFiltersChange({ ...filters, dateRange: range })}
          />
          
          <div className="flex flex-wrap gap-2">
            {(['all', 'completed', 'returned'] as const).map(status => (
              <button
                key={`status-${status}`}
                onClick={() => onFiltersChange({ ...filters, status })}
                className={`
                  px-3 py-1 text-xs rounded-full transition-colors
                  ${filters.status === status
                    ? status === 'completed' ? 'bg-emerald-500/15 text-green-700 border border-green-300' :
                      status === 'returned' ? 'bg-red-500/15 text-red-700 border border-red-300' :
                      'bg-indigo-500/15 text-indigo-700 border border-indigo-300'
                    : 'bg-secondary text-foreground hover:bg-muted border border-border'
                  }
                `}
              >
                {status === 'all' ? 'All Sales' : 
                 status === 'completed' ? 'Completed Only' : 'Returned Only'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-card rounded-xl p-3 sm:p-4 border shadow-sm">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Sales</div>
          <div className="text-xl sm:text-2xl font-bold text-foreground">{totals.totalSales}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">Selected period</div>
        </div>
        <div className="bg-card rounded-xl p-3 sm:p-4 border shadow-sm">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Gross Revenue</div>
          <div className="text-xl sm:text-2xl font-bold text-orange-500">₵{totals.totalRevenue.toFixed(2)}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">Before refunds</div>
        </div>
        <div className="bg-card rounded-xl p-3 sm:p-4 border shadow-sm">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Total Refunds</div>
          <div className="text-xl sm:text-2xl font-bold text-red-600">₵{totals.totalRefunds.toFixed(2)}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">Amount refunded</div>
        </div>
        <div className="bg-card rounded-xl p-3 sm:p-4 border shadow-sm">
          <div className="text-xs sm:text-sm text-muted-foreground mb-1">Net Revenue</div>
          <div className="text-xl sm:text-2xl font-bold text-primary">₵{totals.netRevenue.toFixed(2)}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">After refunds</div>
        </div>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sales history...</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-x-auto -mx-1 sm:mx-0">
          <table className="min-w-[720px] w-full divide-y divide-border">
            <thead className="bg-secondary/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Sale ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Refunded</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No sales found for the selected date range.
                  </td>
                </tr>
              ) : (
                filteredSales.map(sale => {
                  const isReturned = sale.return_status && sale.return_status !== 'none';
                  const isFullyReturned = sale.return_status === 'fully_returned';
                  const isPartiallyReturned = sale.return_status === 'partially_returned';
                  
                  return (
                    <tr 
                      key={`sale-${sale.id}`} 
                      className={`
                        hover:bg-secondary/60
                        ${isReturned ? 'bg-secondary/60' : ''}
                        ${isFullyReturned ? 'opacity-60' : ''}
                      `}
                    >
                      <td className="px-4 py-3 text-sm font-mono">
                        {sale.id.slice(-8)}
                        {isReturned && (
                          <div className="text-xs text-muted-foreground">RETURNED</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(sale.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                        <div className="text-xs text-muted-foreground">
                          {new Date(sale.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!isReturned ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-green-800">
                            Completed
                          </span>
                        ) : isFullyReturned ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-800">
                            Fully Returned
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-yellow-800">
                            Partially Returned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sale.sales_type === 'wholesale' 
                            ? 'bg-blue-500/15 text-blue-800' 
                            : 'bg-secondary text-foreground'
                        }`}>
                          {sale.sales_type || 'retail'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {sale.customer_name || 'Walk-in'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center space-x-1">
                          <span>{sale.sale_items?.length || 0}</span>
                          {isPartiallyReturned && (
                            <span className="text-xs text-yellow-600">(some returned)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold">
                        ${sale.total.toFixed(2)}
                        {isReturned && (
                          <div className="text-xs text-red-600 line-through">
                            ${sale.total.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {sale.refunded_amount && sale.refunded_amount > 0 ? (
                          <div className="text-red-600 font-medium">
                            -${sale.refunded_amount.toFixed(2)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex space-x-2">
                          {!isFullyReturned ? (
                            <button
                              onClick={() => onReturn(sale.id)}
                              className={`
                                text-xs font-medium
                                ${isPartiallyReturned 
                                  ? 'text-yellow-600 hover:text-yellow-800' 
                                  : 'text-indigo-600 hover:text-indigo-800'
                                }
                              `}
                            >
                              {isPartiallyReturned ? 'Add Return' : 'Return'}
                            </button>
                          ) : (
                            <button
                              onClick={() => onViewDetails(sale)}
                              className="text-xs text-muted-foreground hover:text-muted-foreground cursor-help"
                              title="Fully returned - cannot add more returns"
                            >
                              View Details
                            </button>
                          )}
                          <button
                            onClick={() => onViewDetails(sale)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};