import React, { useMemo } from 'react';
import  type { Return, ReturnsFilters } from '../../types/index.ts';
import { DateRangePicker } from './DateRangePicker';
import { Button } from '../Button';

interface ReturnsTabProps {
  returns: Return[];
  loading: boolean;
  onNewReturn: () => void;
  onRefresh: () => void;
  realtimeConnection: 'connected' | 'disconnected' | 'connecting';
  filters: ReturnsFilters;
  onFiltersChange: (filters: ReturnsFilters) => void;
}

export const ReturnsTab: React.FC<ReturnsTabProps> = ({
  returns,
  loading,
  onNewReturn,
  onRefresh,
  realtimeConnection,
  filters,
  onFiltersChange
}) => {
  
  const filteredReturns = useMemo(() => {
    let filtered = returns;
    
    filtered = filtered.filter(ret => {
      const retDate = new Date(ret.created_at);
      const fromDate = new Date(filters.dateRange.from);
      const toDate = new Date(filters.dateRange.to);
      return retDate >= fromDate && retDate <= toDate;
    });
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(ret => ret.status === filters.status);
    }
    
    return filtered;
  }, [returns, filters]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-bold text-foreground">Returns & Refunds</h3>
          {returns.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-red-500/100 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {returns.filter(r => r.status === 'pending').length}
            </span>
          )}
          <div className="text-xs text-muted-foreground flex items-center">
            <span className={`w-2 h-2 rounded-full mr-1 ${realtimeConnection === 'connected' ? 'bg-emerald-500/100 animate-pulse' : 'bg-red-500/100'}`}></span>
            Live
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={onNewReturn}
          >
            Process New Return
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={onRefresh}
            className="flex items-center"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 border">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-medium text-foreground">Filter Returns</h4>
          <div className="text-xs text-muted-foreground">
            Showing {filteredReturns.length} of {returns.length} returns
          </div>
        </div>
        
        <div className="space-y-3">
          <DateRangePicker
            range={filters.dateRange}
            onChange={(range) => onFiltersChange({ ...filters, dateRange: range })}
          />
          
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'completed', 'rejected'] as const).map(status => (
              <button
                key={`status-${status}`}
                onClick={() => onFiltersChange({ ...filters, status })}
                className={`
                  px-3 py-1 text-xs rounded-full transition-colors
                  ${filters.status === status
                    ? status === 'pending' ? 'bg-amber-500/15 text-yellow-700 border border-yellow-300' :
                      status === 'completed' ? 'bg-emerald-500/15 text-green-700 border border-green-300' :
                      status === 'rejected' ? 'bg-red-500/15 text-red-700 border border-red-300' :
                      'bg-indigo-500/15 text-indigo-700 border border-indigo-300'
                    : 'bg-secondary text-foreground hover:bg-muted border border-border'
                  }
                `}
              >
                {status === 'all' ? 'All Status' : 
                 status === 'pending' ? 'Pending' :
                 status === 'completed' ? 'Completed' : 'Rejected'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl shadow-sm border border-border">
          <div className="text-4xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-foreground mb-2">No returns found</h3>
          <p className="text-muted-foreground mb-6">No returns for the selected date range</p>
          <Button
            onClick={onNewReturn}
            variant="primary"
          >
            Process First Return
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-secondary/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Return ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Sale ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Refund Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Processed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredReturns.map(returnItem => (
                <tr key={`return-${returnItem.id}`} className="hover:bg-secondary/60">
                  <td className="px-4 py-3 text-sm font-mono">{returnItem.id.slice(-8)}</td>
                  <td className="px-4 py-3 text-sm font-mono">{returnItem.sale_id?.slice(-8) || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(returnItem.created_at).toLocaleDateString()}
                    <div className="text-xs text-muted-foreground">
                      {new Date(returnItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate">{returnItem.reason || 'No reason'}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-bold text-red-600">₵{returnItem.total_refund?.toFixed(2) || '0.00'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {returnItem.status === 'pending' && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-yellow-800">Pending</span>
                    )}
                    {returnItem.status === 'completed' && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-green-800">Completed</span>
                    )}
                    {returnItem.status === 'rejected' && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-800">Rejected</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {returnItem.staff?.full_name || returnItem.resolved_by_user?.full_name || 'Unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredReturns.length > 0 && (
            <div className="bg-secondary/60 px-6 py-3 border-t border-border">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Showing <span className="font-medium">{filteredReturns.length}</span> returns
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/100"></div>
                    <span>Completed: {filteredReturns.filter(r => r.status === 'completed').length}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500/100/100"></div>
                    <span>Pending: {filteredReturns.filter(r => r.status === 'pending').length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};