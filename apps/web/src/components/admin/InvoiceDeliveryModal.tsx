import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { Package, CheckCircle, Truck, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface InvoiceDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  requestId: string;
  userId: string;
  onSuccess?: () => void;
}

interface DeliveryItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_price: number;
  requested: number;
  delivered: number;
  notes: string;
  unit_price?: number;
  total_price?: number;
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
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [deliveryData, setDeliveryData] = useState({
    delivered_by: '',
    delivery_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (isOpen && requestId) {
      fetchRequestItems();
    }
  }, [isOpen, requestId]);

  const fetchRequestItems = async () => {
    try {
      const { data: request, error } = await supabase
        .from('restock_requests')
        .select(`
          *,
          products:product_id (
            name,
            sku,
            price,
            wholesale_price
          ),
          items
        `)
        .eq('id', requestId)
        .single();

      if (error) throw error;

      const items: DeliveryItem[] = [];

      // Handle multi-product requests (items JSONB)
      if (request.items && Array.isArray(request.items) && request.items.length > 0) {
        request.items.forEach((item: any) => {
          const productPrice = item.product_price || item.price || request.products?.price || 0;
          const requestedQty = item.quantity || item.requested_quantity || 0;
          
          items.push({
            product_id: item.product_id,
            product_name: item.product_name || request.products?.name || 'Product',
            product_sku: item.product_sku || item.sku || request.products?.sku || 'N/A',
            product_price: productPrice,
            requested: requestedQty,
            delivered: requestedQty, // Default to requested quantity
            notes: item.notes || '',
            unit_price: productPrice,
            total_price: productPrice * requestedQty
          });
        });
      } 
      // Handle single product request (product_id column)
      else if (request.product_id) {
        const productPrice = request.products?.price || 0;
        const requestedQty = request.requested_quantity || 0;
        
        items.push({
          product_id: request.product_id,
          product_name: request.products?.name || 'Product',
          product_sku: request.products?.sku || 'N/A',
          product_price: productPrice,
          requested: requestedQty,
          delivered: requestedQty,
          notes: '',
          unit_price: productPrice,
          total_price: productPrice * requestedQty
        });
      }

      setDeliveryItems(items);
      
    } catch (error: any) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load request items');
      
      // Fallback mock data for testing
      setDeliveryItems([{
        product_id: '1',
        product_name: 'Sample Product',
        product_sku: 'SKU-001',
        product_price: 29.99,
        requested: 10,
        delivered: 10,
        notes: '',
        unit_price: 29.99,
        total_price: 299.90
      }]);
    }
  };

  const updateDeliveredQuantity = (index: number, value: number) => {
    setDeliveryItems(prev => 
      prev.map((item, i) => {
        if (i === index) {
          const deliveredQty = Math.min(Math.max(0, value), item.requested);
          const totalPrice = (item.unit_price || item.product_price) * deliveredQty;
          
          return { 
            ...item, 
            delivered: deliveredQty,
            total_price: totalPrice
          };
        }
        return item;
      })
    );
  };

  const calculateTotals = () => {
    return deliveryItems.reduce((acc, item) => {
      const price = item.unit_price || item.product_price || 0;
      const itemTotal = price * item.delivered;
      
      return {
        totalRequested: acc.totalRequested + item.requested,
        totalDelivered: acc.totalDelivered + item.delivered,
        totalAmount: acc.totalAmount + itemTotal
      };
    }, { totalRequested: 0, totalDelivered: 0, totalAmount: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (deliveryItems.length === 0) {
      toast.error('No items to deliver');
      return;
    }

    const { totalDelivered, totalAmount } = calculateTotals();
    
    if (totalDelivered === 0) {
      toast.error('Please enter delivered quantities');
      return;
    }

    setLoading(true);
    
    try {
      // Prepare delivery items with proper pricing
      const deliveryItemsWithPrices = deliveryItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity_requested: item.requested,
        quantity_delivered: item.delivered,
        unit_price: item.unit_price || item.product_price,
        total_price: item.total_price,
        notes: item.notes
      }));

      // Check if we need to create an invoice record
      const { data: existingInvoice } = await supabase
        .from('restock_invoices')
        .select('id')
        .eq('invoice_number', invoiceNumber)
        .single();

      const invoiceData = {
        invoice_number: invoiceNumber,
        request_id: requestId,
        delivered_by: userId,
        delivery_date: deliveryData.delivery_date,
        status: 'delivered',
        total_quantity: totalDelivered,
        total_amount: totalAmount,
        notes: deliveryData.notes,
        items: deliveryItemsWithPrices
      };

      if (existingInvoice) {
        // Update existing invoice
        await supabase
          .from('restock_invoices')
          .update(invoiceData)
          .eq('id', existingInvoice.id);
      } else {
        // Create new invoice
        await supabase
          .from('restock_invoices')
          .insert([invoiceData]);
      }

      // Update restock request with delivery information
      const { error: updateError } = await supabase
        .from('restock_requests')
        .update({
          status: 'fulfilled',
          delivery_status: 'delivered',
          delivery_date: new Date(deliveryData.delivery_date).toISOString(),
          delivered_by: userId,
          fulfilled_quantity: totalDelivered,
          fulfilled_at: new Date().toISOString(),
          admin_notes: deliveryData.notes || null
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Update product stock if needed
      for (const item of deliveryItems) {
        if (item.delivered > 0) {
          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single();

          if (product) {
            await supabase
              .from('products')
              .update({
                stock_quantity: (product.stock_quantity || 0) + item.delivered,
                last_restocked_at: new Date().toISOString()
              })
              .eq('id', item.product_id);
          }
        }
      }

      toast.success('Delivery Completed', {
        description: `${totalDelivered} items ($${totalAmount.toFixed(2)}) delivered successfully`
      });

      onSuccess?.();
      onClose();
      
    } catch (error: any) {
      console.error('Delivery error:', error);
      toast.error('Delivery Failed', {
        description: error.message || 'Failed to process delivery'
      });
    } finally {
      setLoading(false);
    }
  };

  const { totalRequested, totalDelivered, totalAmount } = calculateTotals();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Process Delivery"
      size="lg"
    >
      <div className="space-y-6">
        <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-blue-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Invoice: {invoiceNumber}
              </h3>
              <p className="text-sm text-blue-700">
                Mark items as delivered and update inventory
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">
                ${totalAmount.toFixed(2)}
              </div>
              <div className="text-sm text-blue-700">Total Value</div>
            </div>
          </div>
        </div>

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

          {/* Delivery Items */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-secondary/60 px-4 py-3 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-foreground">Items to Deliver</h4>
                  <p className="text-sm text-muted-foreground">
                    Update delivered quantities and verify prices
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {deliveryItems.length} items
                </div>
              </div>
            </div>
            
            <div className="divide-y max-h-64 overflow-y-auto">
              {deliveryItems.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="p-4 hover:bg-secondary/60">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {item.product_name}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <code className="text-xs bg-secondary px-2 py-1 rounded">
                          SKU: {item.product_sku}
                        </code>
                        <span className="text-xs text-muted-foreground">
                          Price: ${(item.unit_price || item.product_price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                      <div>Requested: <span className="font-bold">{item.requested}</span></div>
                      <div className="text-xs mt-1">
                        ${((item.unit_price || item.product_price) * item.requested).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Input
                        label="Delivered Quantity"
                        type="number"
                        value={item.delivered}
                        onChange={(e) => updateDeliveredQuantity(index, parseInt(e.target.value) || 0)}
                        min="0"
                        max={item.requested}
                        required
                      />
                    </div>
                    
                    <div>
                      <div className="text-sm text-foreground mb-1">Item Total</div>
                      <div className="p-2 bg-secondary/60 rounded border text-lg font-semibold text-foreground">
                        ${(item.total_price || 0).toFixed(2)}
                      </div>
                    </div>
                    
                    <div>
                      <Input
                        label="Item Notes"
                        value={item.notes}
                        onChange={(e) => {
                          const newItems = [...deliveryItems];
                          newItems[index].notes = e.target.value;
                          setDeliveryItems(newItems);
                        }}
                        placeholder="Condition, issues, etc."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-secondary/60 p-4 rounded-lg">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {deliveryItems.length}
                </div>
                <div className="text-sm text-muted-foreground">Products</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {totalRequested}
                </div>
                <div className="text-sm text-muted-foreground">Requested</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {totalDelivered}
                </div>
                <div className="text-sm text-muted-foreground">Delivered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">
                  ${totalAmount.toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Total Value</div>
              </div>
            </div>
          </div>

          <Input
            label="Overall Delivery Notes"
            value={deliveryData.notes}
            onChange={(e) => setDeliveryData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Any additional notes about the delivery, conditions, issues..."
            multiline
            rows={3}
          />

          <div className="bg-amber-500/100/10 p-4 rounded-lg border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">Stock Update Notice</span>
            </div>
            <p className="text-sm text-yellow-700">
              After confirming delivery, product stock quantities will be automatically updated in the system.
            </p>
          </div>

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
              disabled={loading || deliveryItems.length === 0 || totalDelivered === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Delivery & Update Stock
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};