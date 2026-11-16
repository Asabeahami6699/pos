import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import type { Sale } from '../../types/index.ts';

interface SaleDetailsModalProps {
  sale: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  supabase: any;
}

export const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({ 
  sale, 
  isOpen, 
  onClose, 
  supabase 
}) => {
  const [returnHistory, setReturnHistory] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (sale && isOpen) {
      fetchReturnHistory(sale.id);
    }
  }, [sale, isOpen]);

  const fetchReturnHistory = async (saleId: string) => {
    setLoadingDetails(true);
    try {
      const { data } = await supabase
        .from('returns')
        .select(`
          *,
          return_items (
            *,
            products (*)
          ),
          resolved_by_user:users!returns_resolved_by_fkey (full_name)
        `)
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false });
      
      setReturnHistory(data || []);
    } catch (error) {
      console.error('Error fetching return history:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (!sale) return null;

  const totalRefunded = returnHistory.reduce((sum, r) => sum + (r.total_refund || 0), 0);
  const netAmount = sale.total - totalRefunded;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Sale Details - #${sale.id.slice(-8)}`}
      size="lg"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary/60 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Sale Date</div>
            <div className="font-medium">
              {new Date(sale.created_at).toLocaleDateString()} at{' '}
              {new Date(sale.created_at).toLocaleTimeString()}
            </div>
          </div>
          <div className="bg-secondary/60 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Payment Method</div>
            <div className="font-medium capitalize">{sale.payment_method}</div>
          </div>
          <div className="bg-secondary/60 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Sales Type</div>
            <div className="font-medium">
              <span className={`px-2 py-1 text-xs rounded-full ${
                sale.sales_type === 'wholesale' 
                  ? 'bg-blue-500/15 text-blue-800' 
                  : 'bg-secondary text-foreground'
              }`}>
                {sale.sales_type}
              </span>
            </div>
          </div>
          <div className="bg-secondary/60 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Customer</div>
            <div className="font-medium">{sale.customer_name || 'Walk-in'}</div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium text-foreground mb-3">Financial Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Original Sale Amount:</span>
              <span className="font-bold">${sale.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Refunded:</span>
              <span className="font-bold text-red-600">-${totalRefunded.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Net Amount:</span>
              <span className={`font-bold text-lg ${
                netAmount > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${netAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {returnHistory.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-foreground mb-3">Return History</h4>
            <div className="space-y-3">
              {returnHistory.map(returnItem => (
                <div key={returnItem.id} className="bg-secondary/60 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        Return #{returnItem.id.slice(-8)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(returnItem.created_at).toLocaleDateString()} • 
                        Processed by: {returnItem.resolved_by_user?.full_name}
                      </div>
                      {returnItem.reason && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Reason: {returnItem.reason}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600">
                        -${returnItem.total_refund.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {returnItem.return_items?.length || 0} items
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium text-foreground mb-3">Original Sale Items</h4>
          <div className="space-y-2">
            {sale.sale_items?.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b">
                <div>
                  <div className="font-medium">{item.products?.name || `Item ${index + 1}`}</div>
                  <div className="text-sm text-muted-foreground">SKU: {item.products?.sku || 'N/A'}</div>
                </div>
                <div className="text-right">
                  <div>${item.price.toFixed(2)} × {item.quantity}</div>
                  <div className="font-bold">${(item.price * item.quantity).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};