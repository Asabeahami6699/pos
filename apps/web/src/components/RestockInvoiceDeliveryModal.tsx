// components/RestockInvoiceDeliveryModal.tsx
import React, { useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { Package, CheckCircle, Truck, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface InvoiceDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  requestId: string;
  userId: string;
  onSuccess?: () => void;
}

export const InvoiceDeliveryModal: React.FC<InvoiceDeliveryModalProps> = ({
  isOpen,
  onClose,
  invoiceNumber,
  requestId,
  userId,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [deliveredItems, setDeliveredItems] = useState<Array<{
    id: string;
    product_id: string;
    product_name: string;
    sku: string;
    requested: number;
    delivered: number;
    notes?: string;
  }>>([]);

  const [deliveryData, setDeliveryData] = useState({
    delivered_by: '',
    delivery_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Fetch invoice items on open
  React.useEffect(() => {
    if (isOpen) {
      fetchInvoiceItems();
    }
  }, [isOpen]);

  const fetchInvoiceItems = async () => {
    try {
      const { data: items, error } = await supabase
        .from('restock_invoice_items')
        .select(`
          *,
          products!inner (name, sku)
        `)
        .eq('restock_request_id', requestId);

      if (error) throw error;

      setDeliveredItems(items?.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown',
        sku: item.products?.sku || 'N/A',
        requested: item.quantity_requested,
        delivered: item.quantity_requested, // Default to full delivery
        notes: ''
      })) || []);
    } catch (error) {
      console.error('Error fetching invoice items:', error);
    }
  };

  const updateDeliveredQuantity = (id: string, value: number) => {
    setDeliveredItems(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, delivered: Math.min(Math.max(0, value), item.requested) }
          : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (deliveredItems.length === 0) {
      toast.error('No items to deliver');
      return;
    }

    const hasInvalidDelivery = deliveredItems.some(item => 
      item.delivered < 0 || item.delivered > item.requested
    );
    
    if (hasInvalidDelivery) {
      toast.error('Invalid delivery quantities');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Processing delivery...');

    try {
      // Start transaction
      const totalDelivered = deliveredItems.reduce((sum, item) => sum + item.delivered, 0);
      
      // Update invoice status
      const { error: invoiceError } = await supabase
        .from('restock_invoices')
        .update({
          status: 'delivered',
          delivered_by: userId,
          delivery_date: new Date().toISOString(),
          notes: deliveryData.notes
        })
        .eq('invoice_number', invoiceNumber);

      if (invoiceError) throw invoiceError;

      // Update invoice items with delivered quantities
      const updates = deliveredItems.map(item => 
        supabase
          .from('restock_invoice_items')
          .update({
            quantity_delivered: item.delivered,
            notes: item.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)
      );

      await Promise.all(updates);

      // Update restock request status
      const { error: requestError } = await supabase
        .from('restock_requests')
        .update({
          status: 'fulfilled',
          fulfilled_quantity: totalDelivered,
          fulfilled_at: new Date().toISOString(),
          delivery_status: 'delivered',
          delivery_date: new Date().toISOString(),
          delivered_by: userId
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      // Update branch inventory
      for (const item of deliveredItems) {
        if (item.delivered > 0) {
          // Check if inventory record exists
          const { data: existingInventory } = await supabase
            .from('branch_inventory')
            .select('quantity')
            .eq('branch_id', request.branch_id)
            .eq('product_id', item.product_id)
            .single();

          if (existingInventory) {
            // Update existing
            await supabase
              .from('branch_inventory')
              .update({
                quantity: existingInventory.quantity + item.delivered,
                last_updated: new Date().toISOString()
              })
              .eq('branch_id', request.branch_id)
              .eq('product_id', item.product_id);
          } else {
            // Create new
            await supabase
              .from('branch_inventory')
              .insert({
                branch_id: request.branch_id,
                product_id: item.product_id,
                quantity: item.delivered,
                company_id: request.company_id
              });
          }
        }
      }

      // Log activity
      await supabase
        .from('activity_log')
        .insert({
          type: 'restock_delivered',
          description: `Restock delivered: ${totalDelivered} items`,
          company_id: request.company_id,
          user_id: userId,
          metadata: {
            invoice_number,
            restock_request_id: requestId,
            total_delivered: totalDelivered
          }
        });

      // Create notification for salesperson
      const { data: requestData } = await supabase
        .from('restock_requests')
        .select('requested_by')
        .eq('id', requestId)
        .single();

      if (requestData?.requested_by) {
        await supabase
          .from('notifications')
          .insert({
            company_id: request.company_id,
            user_id: requestData.requested_by,
            title: 'Restock Delivered',
            message: `Your restock request has been delivered. Invoice: ${invoiceNumber}`,
            type: 'success'
          });
      }

      toast.success('Delivery Completed', {
        description: `${totalDelivered} items delivered successfully`,
        id: toastId
      });

      onSuccess?.();
      onClose();

    } catch (error: any) {
      console.error('Delivery error:', error);
      toast.error('Delivery Failed', {
        description: error.message || 'Failed to process delivery',
        id: toastId
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Process Delivery"
      size="lg"
    >
      <div className="space-y-6">
        {/* Invoice Header */}
        <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-blue-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Invoice: {invoiceNumber}
              </h3>
              <p className="text-sm text-blue-700">
                Process delivery for restock request
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">
                {deliveredItems.reduce((sum, item) => sum + item.requested, 0)}
              </div>
              <div className="text-sm text-blue-700">Total Items</div>
            </div>
          </div>
        </div>

        {/* Delivery Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Delivery Date"
              type="date"
              value={deliveryData.delivery_date}
              onChange={(e) => setDeliveryData(prev => ({ 
                ...prev, 
                delivery_date: e.target.value 
              }))}
              required
            />
            <Input
              label="Delivered By"
              value={deliveryData.delivered_by}
              onChange={(e) => setDeliveryData(prev => ({ 
                ...prev, 
                delivered_by: e.target.value 
              }))}
              placeholder="Enter name"
              required
            />
          </div>

          {/* Items List */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-secondary/60 px-4 py-3 border-b">
              <h4 className="font-medium text-foreground">Delivery Items</h4>
              <p className="text-sm text-muted-foreground">
                Update delivered quantities for each item
              </p>
            </div>
            
            <div className="divide-y">
              {deliveredItems.map((item) => (
                <div key={item.id} className="p-4 hover:bg-secondary/60">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {item.product_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        SKU: {item.sku}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Requested: <span className="font-bold">{item.requested}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Input
                        label="Delivered Quantity"
                        type="number"
                        value={item.delivered}
                        onChange={(e) => updateDeliveredQuantity(item.id, parseInt(e.target.value) || 0)}
                        min="0"
                        max={item.requested}
                        required
                        hideLabel
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        Enter 0 if item not delivered
                      </div>
                    </div>
                    
                    <div className="w-48">
                      <Input
                        label="Notes"
                        value={item.notes}
                        onChange={(e) => setDeliveredItems(prev => 
                          prev.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i)
                        )}
                        placeholder="Damaged, missing, etc."
                        hideLabel
                      />
                    </div>
                  </div>
                  
                  {item.delivered < item.requested && (
                    <div className="mt-2 text-sm text-amber-600">
                      ⚠️ Partial delivery: {item.requested - item.delivered} items pending
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-secondary/60 p-4 rounded-lg">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {deliveredItems.length}
                </div>
                <div className="text-sm text-muted-foreground">Products</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {deliveredItems.reduce((sum, item) => sum + item.requested, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Requested</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {deliveredItems.reduce((sum, item) => sum + item.delivered, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Delivered</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <Input
            label="Delivery Notes"
            value={deliveryData.notes}
            onChange={(e) => setDeliveryData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Any additional notes about the delivery..."
            multiline
            rows={2}
          />

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
              disabled={loading || deliveredItems.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Delivery
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};