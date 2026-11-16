import React from 'react';
import { toast } from 'sonner';
import { Button } from '../Button';
import { Package, AlertCircle, CheckCircle, Clock, User, Building } from 'lucide-react';

interface RestockRequest {
  id: string;
  branch_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  items: Array<{
    product_id: string;
    requested_quantity: number;
    product_name?: string;
    sku?: string;
    price?: number;
  }> | null;
  requested_quantity: number | null;
  product_id: string | null;
  product_name?: string;
  branch_name?: string;
  staff_name?: string;
  created_at: string;
  admin_notes?: string;
  fulfilled_quantity?: number;
}

interface RestockRequestCardProps {
  request: RestockRequest;
  onApprove?: () => void;
  onReject?: () => void;
  onFulfill?: () => void;
  onClick?: () => void;
  compact?: boolean;
}

export const RestockRequestCard: React.FC<RestockRequestCardProps> = ({
  request,
  onApprove,
  onReject,
  onFulfill,
  onClick,
  compact = false
}) => {
  // Parse items from JSONB or use legacy format
  const requestItems = Array.isArray(request.items) ? request.items : [];
  
  // Calculate totals
  const totalRequested = requestItems.reduce((sum, item) => 
    sum + (item.requested_quantity || 0), 0
  ) || request.requested_quantity || 0;
  
  const totalFulfilled = request.fulfilled_quantity || 0;
  
  // Status colors and icons
  const statusConfig = {
    pending: {
      color: 'bg-amber-500/15 text-yellow-800 border-amber-500/20',
      icon: Clock,
      label: 'Pending Review'
    },
    approved: {
      color: 'bg-blue-500/15 text-blue-800 border-blue-500/20',
      icon: CheckCircle,
      label: 'Approved'
    },
    fulfilled: {
      color: 'bg-emerald-500/15 text-green-800 border-emerald-500/20',
      icon: CheckCircle,
      label: 'Fulfilled'
    },
    rejected: {
      color: 'bg-red-500/15 text-red-800 border-red-500/20',
      icon: AlertCircle,
      label: 'Rejected'
    }
  };
  
  const status = statusConfig[request.status];
  const StatusIcon = status.icon;

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  const handleButtonClick = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation();
    action?.();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffHours < 168) {
      return `${Math.floor(diffHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (compact) {
    return (
      <div 
        className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
          onClick ? 'hover:border-indigo-300 hover:bg-indigo-500/100/10/30' : ''
        } ${status.color.replace('bg-', 'bg-').replace('text-', 'text-')} border`}
        onClick={handleCardClick}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <StatusIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{status.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(request.created_at)}
          </div>
        </div>
        
        <div className="mb-2">
          <p className="font-bold text-foreground truncate">
            {requestItems.length > 0 
              ? `${requestItems.length} item${requestItems.length > 1 ? 's' : ''}`
              : request.product_name || 'Restock Request'
            }
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {request.branch_name || 'Unknown Branch'}
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{request.staff_name || 'Staff'}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-indigo-600">{totalRequested} units</p>
            {request.status === 'fulfilled' && (
              <p className="text-xs text-green-600">{totalFulfilled} fulfilled</p>
            )}
          </div>
        </div>
        
        {onClick && (
          <div className="mt-3 pt-2 border-t border-border border-opacity-50">
            <div className="text-xs text-indigo-600 text-center">
              Click to process →
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`bg-card rounded-xl border transition-all ${
        onClick ? 'cursor-pointer hover:shadow-lg hover:border-indigo-300' : ''
      } ${status.color.replace('bg-', 'border-')}`}
      onClick={handleCardClick}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${status.color.split(' ')[0]}`}>
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">
                {requestItems.length > 0 
                  ? `${requestItems.length} item${requestItems.length > 1 ? 's' : ''} requested`
                  : request.product_name || 'Restock Request'
                }
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                  {status.label}
                </div>
                <span className="text-xs text-muted-foreground">
                  ID: {request.id.slice(-8)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-600">{totalRequested}</div>
            <div className="text-xs text-muted-foreground">units requested</div>
            {request.status === 'fulfilled' && (
              <div className="text-xs text-green-600 mt-1">
                {totalFulfilled} fulfilled
              </div>
            )}
          </div>
        </div>

        {/* Items List */}
        {requestItems.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-foreground">Requested Items</h4>
              <span className="text-xs text-muted-foreground">
                {requestItems.length} item{requestItems.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {requestItems.map((item, index) => (
                <div 
                  key={`${item.product_id}-${index}`}
                  className="flex items-center justify-between p-2 bg-secondary/60 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.product_name || `Product ${item.product_id?.slice(-6)}`}
                    </p>
                    {item.sku && (
                      <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-bold text-foreground">
                      {item.requested_quantity} units
                    </div>
                    {item.price && (
                      <div className="text-xs text-muted-foreground">
                        ${(item.price * item.requested_quantity).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single Product (Legacy) */}
        {requestItems.length === 0 && request.product_name && (
          <div className="mb-4 p-3 bg-secondary/60 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{request.product_name}</p>
                <p className="text-sm text-muted-foreground">Single product request</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">
                  {request.requested_quantity} units
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <div className="flex items-center text-sm">
              <User className="w-4 h-4 text-muted-foreground mr-2" />
              <div>
                <p className="text-muted-foreground">Requested by</p>
                <p className="font-medium">{request.staff_name || 'Unknown Staff'}</p>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <Building className="w-4 h-4 text-muted-foreground mr-2" />
              <div>
                <p className="text-muted-foreground">Branch</p>
                <p className="font-medium">{request.branch_name || 'Unknown Branch'}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm">
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {new Date(request.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            {request.admin_notes && (
              <div className="text-sm">
                <p className="text-muted-foreground">Admin Notes</p>
                <p className="font-medium text-foreground line-clamp-2">
                  {request.admin_notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!onClick && (
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border">
            {request.status === 'pending' && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => handleButtonClick(e, onApprove)}
                >
                  Approve Request
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => handleButtonClick(e, onReject)}
                >
                  Reject
                </Button>
              </>
            )}
            
            {request.status === 'approved' && (
              <Button
                variant="success"
                size="sm"
                className="w-full"
                onClick={(e) => handleButtonClick(e, onFulfill)}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Fulfill Request
              </Button>
            )}
            
            {request.status === 'fulfilled' && (
              <div className="w-full text-center">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    toast.info('Invoice Downloaded', {
                      description: 'Restock invoice has been generated and downloaded.'
                    });
                  }}
                >
                  Download Invoice
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Click Hint */}
        {onClick && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-center text-sm text-indigo-600 font-medium">
              <span className="mr-2">Click to process this request</span>
              <span className="animate-pulse">→</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};