import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Select } from '../Select';
import { Input } from '../Input';
import { Button } from '../Button';
import { toast } from 'sonner';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentSales: any[];
  onReturn: (saleId: string, items: any[], reason: string) => Promise<void>;
  supabase: any;
  user: any;
  onSuccess: () => void;
}

// Add the missing getTodayRange function
const getTodayRange = (): { from: string; to: string } => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  endOfDay.setHours(23, 59, 59, 999);
  
  return {
    from: startOfDay.toISOString(),
    to: endOfDay.toISOString()
  };
};

export const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  recentSales,
  onReturn,
  supabase,
  user,
  onSuccess
}) => {
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'select' | 'items' | 'confirm'>('select');
  const [loading, setLoading] = useState(false);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSale(null);
      setReturnItems([]);
      setReason('');
      setStep('select');
      setSaleItems([]);
    }
  }, [isOpen]);

  const handleSaleSelect = async (saleId: string) => {
    const sale = recentSales.find(s => s.id === saleId);
    if (!sale) return;

    setSelectedSale(sale);
    setLoadingItems(true);
    
    try {
      // Fetch sale items with product details
      const { data: items, error } = await supabase
        .from('sale_items')
        .select(`
          *,
          products (
            id,
            name,
            sku,
            price
          )
        `)
        .eq('sale_id', saleId);

      if (error) throw error;

      // Fetch existing returns for this sale to calculate remaining quantities
      const { data: existingReturns } = await supabase
        .from('returns')
        .select(`
          return_items (
            product_id,
            quantity
          )
        `)
        .eq('sale_id', saleId)
        .eq('status', 'completed');

      // Calculate already returned quantities
      const alreadyReturned = new Map<string, number>();
      if (existingReturns) {
        existingReturns.forEach(returnItem => {
          if (returnItem.return_items) {
            returnItem.return_items.forEach((item: any) => {
              alreadyReturned.set(
                item.product_id,
                (alreadyReturned.get(item.product_id) || 0) + item.quantity
              );
            });
          }
        });
      }

      const returnItemsData = (items || []).map((item: any) => {
        const alreadyReturnedQty = alreadyReturned.get(item.product_id) || 0;
        const maxReturnable = Math.max(0, item.quantity - alreadyReturnedQty);

        return {
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          returnQuantity: 0,
          maxReturnable: maxReturnable,
          product: item.products || item.product,
          product_name: item.products?.name || 'Unknown Product'
        };
      }).filter(item => item.maxReturnable > 0); // Only show items that can still be returned

      setSaleItems(returnItemsData);
      setReturnItems(returnItemsData);
      setStep('items');
    } catch (error: any) {
      console.error('Error fetching sale items:', error);
      toast.error('Failed to load sale items');
    } finally {
      setLoadingItems(false);
    }
  };

  const updateReturnQuantity = (itemId: string, quantity: number) => {
    setReturnItems(items => 
      items.map(item => {
        if (item.id === itemId) {
          const newQuantity = Math.max(0, Math.min(quantity, item.maxReturnable));
          return { 
            ...item, 
            returnQuantity: newQuantity 
          };
        }
        return item;
      })
    );
  };

  const handleConfirm = async () => {
  const itemsToReturn = returnItems
    .filter(item => item.returnQuantity > 0)
    .map(item => ({
      product_id: item.product_id,
      quantity: item.returnQuantity,
      price: item.price,
      product_name: item.product_name
    }));

  if (itemsToReturn.length === 0) {
    toast.error('No items selected', {
      description: 'Please select items to return'
    });
    return;
  }

  if (!reason.trim()) {
    toast.error('Reason required', {
      description: 'Please enter a reason for return'
    });
    return;
  }

  setLoading(true);
  try {
    await onReturn(selectedSale.id, itemsToReturn, reason.trim());

    toast.success('Return processed successfully', {
      description: `Refunded ₵${calculateRefundTotal().toFixed(2)} and restocked ${itemsToReturn.length} item(s)`,
    });

    setSelectedSale(null);
    setReturnItems([]);
    setReason('');
    setStep('select');
    setSaleItems([]);

    onSuccess();
    onClose();
  } catch (error: any) {
    console.error('Return processing error:', error);
    toast.error('Return failed', {
      description: error.message || 'Failed to process return',
    });
  } finally {
    setLoading(false);
  }
};

  const calculateRefundTotal = () => {
    return returnItems.reduce((sum, item) => 
      sum + (item.price * (item.returnQuantity || 0)), 0
    );
  };

  const getSelectedItemsCount = () => {
    return returnItems.filter(item => item.returnQuantity > 0).length;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Process Return"
      size="lg"
    >
      <div className="space-y-6">
        {step === 'select' && (
          <>
            <Select
              label="Select Sale"
              value={selectedSale?.id || ''}
              onChange={handleSaleSelect}
              options={recentSales.map(sale => ({
                value: sale.id,
                label: `Sale #${sale.id.slice(-8)} - $${sale.total?.toFixed(2) || '0.00'} - ${new Date(sale.created_at).toLocaleDateString()}`
              }))}
              placeholder="Search recent sales..."
            />
            {loadingItems && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading sale items...</p>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {step === 'items' && selectedSale && (
          <>
            <div className="bg-secondary/60 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Original Sale</p>
              <p className="font-medium">
                Sale #{selectedSale.id.slice(-8)} • 
                ${selectedSale.total?.toFixed(2) || '0.00'}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(selectedSale.created_at).toLocaleDateString()}
                {selectedSale.customer_name && ` • Customer: ${selectedSale.customer_name}`}
              </p>
            </div>

            {returnItems.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📦</div>
                <h3 className="text-lg font-medium text-foreground mb-2">No items available for return</h3>
                <p className="text-muted-foreground">All items from this sale have already been returned.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <h4 className="font-bold text-foreground">Select Items to Return</h4>
                  {returnItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-secondary/60 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Original: {item.quantity} × ${item.price?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Max returnable: {item.maxReturnable}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => updateReturnQuantity(item.id, (item.returnQuantity || 0) - 1)}
                          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted disabled:opacity-50"
                          disabled={item.returnQuantity <= 0}
                        >
                          −
                        </button>
                        <span className="font-bold w-8 text-center">{item.returnQuantity || 0}</span>
                        <button
                          onClick={() => updateReturnQuantity(item.id, (item.returnQuantity || 0) + 1)}
                          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted disabled:opacity-50"
                          disabled={item.returnQuantity >= item.maxReturnable}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Input
                  label="Reason for Return"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Wrong size, Damaged, Customer changed mind"
                  required
                />

                <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-red-800">Total Refund</span>
                      <p className="text-sm text-red-600">
                        {getSelectedItemsCount()} item(s) selected
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-red-800">
                      ${calculateRefundTotal().toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between space-x-3">
                  <Button variant="secondary" onClick={() => setStep('select')}>
                    Back
                  </Button>
                  <div className="space-x-3">
                    <Button variant="secondary" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => setStep('confirm')} 
                      variant="danger"
                      disabled={returnItems.every(i => i.returnQuantity === 0) || !reason.trim()}
                    >
                      Continue to Confirm
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-bold text-foreground mb-2">Confirm Return</h3>
              <p className="text-muted-foreground">
                Please review the return details before processing.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/60 p-3 rounded">
                  <p className="text-sm text-muted-foreground">Refund Amount</p>
                  <p className="text-xl font-bold text-red-600">${calculateRefundTotal().toFixed(2)}</p>
                </div>
                <div className="bg-secondary/60 p-3 rounded">
                  <p className="text-sm text-muted-foreground">Items to Restock</p>
                  <p className="text-xl font-bold">
                    {getSelectedItemsCount()} item(s)
                  </p>
                </div>
              </div>

              <div className="bg-secondary/60 p-4 rounded">
                <p className="text-sm text-muted-foreground mb-2">Reason</p>
                <p className="font-medium">{reason}</p>
              </div>

              <div className="bg-amber-500/100/10 p-4 rounded border border-amber-500/20">
                <p className="text-sm text-yellow-800">
                  <span className="font-bold">Note:</span> This action cannot be undone. 
                  The refund will be processed and items will be restocked in inventory.
                </p>
              </div>
            </div>

            <div className="flex justify-center space-x-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setStep('items')}>
                Back
              </Button>
              <Button 
                onClick={handleConfirm} 
                variant="danger" 
                loading={loading}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm & Process Return'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};