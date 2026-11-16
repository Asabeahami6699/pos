// components/pos/InvoiceDeliveryModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { Package, CheckCircle, Truck, DollarSign, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface InvoiceDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  requestId: string;
  userId: string;
  branchId: string;
  onSuccess?: () => void;
}

interface DeliveryItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_price: number;
  product_wholesale_price?: number;
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
  branchId,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveredBy, setDeliveredBy] = useState('');

  useEffect(() => {
    if (isOpen && requestId) {
      fetchInvoiceItems();
      setDeliveredBy(userId);
    }
  }, [isOpen, requestId, userId]);

  const fetchInvoiceItems = async () => {
    try {
      // Try to fetch from restock_invoice_items first
      const { data: invoiceItems, error: itemsError } = await supabase
        .from('restock_invoice_items')
        .select(`
          *,
          products:product_id (name, sku, price, wholesale_price)
        `)
        .eq('restock_request_id', requestId);

      if (!itemsError && invoiceItems && invoiceItems.length > 0) {
        const formattedItems: DeliveryItem[] = invoiceItems.map(item => {
          const productPrice = item.product_price || item.products?.price || 0;
          const quantityRequested = item.quantity_requested || item.quantity || 0;
          
          return {
            product_id: item.product_id,
            product_name: item.product_name || item.products?.name || 'Unknown Product',
            product_sku: item.product_sku || item.products?.sku || 'N/A',
            product_price: productPrice,
            product_wholesale_price: item.products?.wholesale_price,
            requested: quantityRequested,
            delivered: quantityRequested,
            notes: item.notes || '',
            unit_price: productPrice,
            total_price: productPrice * quantityRequested
          };
        });
        setDeliveryItems(formattedItems);
        return;
      }

      // Fallback: Fetch from restock_requests
      const { data: request, error: requestError } = await supabase
        .from('restock_requests')
        .select(`
          *,
          products:product_id (name, sku, price, wholesale_price),
          items
        `)
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;

      const items: DeliveryItem[] = [];

      // Handle multi-product requests
      if (request.items && Array.isArray(request.items) && request.items.length > 0) {
        request.items.forEach((item: any) => {
          const productPrice = item.product_price || item.price || request.products?.price || 0;
          const requestedQty = item.quantity || item.requested_quantity || 0;
          
          items.push({
            product_id: item.product_id,
            product_name: item.product_name || request.products?.name || 'Product',
            product_sku: item.product_sku || item.sku || request.products?.sku || 'N/A',
            product_price: productPrice,
            product_wholesale_price: request.products?.wholesale_price,
            requested: requestedQty,
            delivered: requestedQty,
            notes: item.notes || '',
            unit_price: productPrice,
            total_price: productPrice * requestedQty
          });
        });
      } 
      // Handle single product
      else if (request.product_id) {
        const productPrice = request.products?.price || 0;
        const requestedQty = request.requested_quantity || 0;
        
        items.push({
          product_id: request.product_id,
          product_name: request.products?.name || 'Product',
          product_sku: request.products?.sku || 'N/A',
          product_price: productPrice,
          product_wholesale_price: request.products?.wholesale_price,
          requested: requestedQty,
          delivered: requestedQty,
          notes: '',
          unit_price: productPrice,
          total_price: productPrice * requestedQty
        });
      }

      setDeliveryItems(items);

    } catch (error: any) {
      console.error('Error fetching invoice items:', error);
      toast.error('Failed to load delivery items');
    }
  };

  const updateDeliveredQuantity = (index: number, value: number) => {
    setDeliveryItems(prev => 
      prev.map((item, i) => {
        if (i === index) {
          const deliveredQty = Math.min(Math.max(0, value), item.requested);
          const price = item.unit_price || item.product_price || 0;
          const totalPrice = price * deliveredQty;
          
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

  const updateItemNotes = (index: number, notes: string) => {
    setDeliveryItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, notes } : item
      )
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

  const handleSubmit = async () => {
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
      // 1. Update restock request status
      const { error: requestError } = await supabase
        .from('restock_requests')
        .update({
          status: 'fulfilled',
          delivery_status: 'delivered',
          delivery_date: new Date(deliveryDate).toISOString(),
          delivered_by: deliveredBy,
          fulfilled_quantity: totalDelivered,
          fulfilled_at: new Date().toISOString(),
          notes: deliveryNotes || null,
          admin_notes: `Delivered on ${deliveryDate} by ${deliveredBy}`
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      // 2. Update or create invoice record
      const invoiceData = {
        invoice_number: invoiceNumber,
        restock_request_id: requestId,
        branch_id: branchId,
        delivered_by: deliveredBy,
        delivery_date: new Date(deliveryDate).toISOString(),
        status: 'delivered',
        total_quantity: totalDelivered,
        total_amount: totalAmount,
        notes: deliveryNotes,
        items: deliveryItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          quantity_requested: item.requested,
          quantity_delivered: item.delivered,
          unit_price: item.unit_price || item.product_price,
          total_price: item.total_price,
          notes: item.notes
        }))
      };

      // Check if invoice exists
      const { data: existingInvoice } = await supabase
        .from('restock_invoices')
        .select('id')
        .eq('invoice_number', invoiceNumber)
        .single();

      if (existingInvoice) {
        await supabase
          .from('restock_invoices')
          .update(invoiceData)
          .eq('id', existingInvoice.id);
      } else {
        await supabase
          .from('restock_invoices')
          .insert([invoiceData]);
      }

      // 3. Update product stock quantities
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
                last_restocked_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', item.product_id);
          }
        }
      }

      toast.success('Delivery Completed', {
        description: `${totalDelivered} items delivered ($${totalAmount.toFixed(2)})`
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
      size="xl"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500/10 to-indigo-50 p-6 rounded-xl border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-500/15 p-2 rounded-lg">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-blue-900 text-lg">
                    Invoice: {invoiceNumber}
                  </h3>
                  <p className="text-sm text-blue-700">
                    Mark items as delivered and update inventory
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <Input
                    label="Delivery Date"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-40"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    label="Delivered By"
                    value={deliveredBy}
                    onChange={(e) => setDeliveredBy(e.target.value)}
                    placeholder="Enter name"
                    className="w-48"
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-900 mb-1">
                ${totalAmount.toFixed(2)}
              </div>
              <div className="text-sm text-blue-700">Total Value</div>
            </div>
          </div>
        </div>

        {/* Delivery Items */}
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <div className="bg-secondary/60 px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-foreground text-lg">Items to Deliver</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Update delivered quantities and verify product details
                </p>
              </div>
              <div className="text-sm text-muted-foreground bg-card px-3 py-1 rounded-full border">
                {deliveryItems.length} products
              </div>
            </div>
          </div>
          
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {deliveryItems.map((item, index) => (
              <div key={`${item.product_id}-${index}`} className="p-6 hover:bg-secondary/60 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-secondary p-2 rounded-lg">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-lg">
                          {item.product_name}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <code className="text-sm bg-secondary px-3 py-1 rounded-md">
                            SKU: {item.product_sku}
                          </code>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            Price: ${(item.unit_price || item.product_price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">
                      Requested: <span className="font-bold">{item.requested}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${((item.unit_price || item.product_price) * item.requested).toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-foreground">Delivered Quantity</span>
                      {item.delivered < item.requested && (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-500/15 text-amber-800 px-2 py-1 rounded-full">
                          <AlertCircle className="w-3 h-3" />
                          Pending: {item.requested - item.delivered}
                        </span>
                      )}
                    </div>
                    <Input
                      type="number"
                      value={item.delivered}
                      onChange={(e) => updateDeliveredQuantity(index, parseInt(e.target.value) || 0)}
                      min="0"
                      max={item.requested}
                      required
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Item Value</div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xl font-semibold text-green-800">
                      ${(item.total_price || 0).toFixed(2)}
                    </div>
                  </div>
                  
                  <div>
                    <Input
                      label="Item Notes"
                      value={item.notes}
                      onChange={(e) => updateItemNotes(index, e.target.value)}
                      placeholder="Condition, damage, substitutions..."
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-foreground mb-1">
              {deliveryItems.length}
            </div>
            <div className="text-sm text-muted-foreground">Products</div>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-700 mb-1">
              {totalRequested}
            </div>
            <div className="text-sm text-blue-600">Requested</div>
          </div>
          
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-700 mb-1">
              {totalDelivered}
            </div>
            <div className="text-sm text-green-600">Delivered</div>
          </div>
          
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-emerald-800 mb-1">
              ${totalAmount.toFixed(2)}
            </div>
            <div className="text-sm text-emerald-700">Total Value</div>
          </div>
        </div>

        {/* General Notes */}
        <div>
          <Input
            label="General Delivery Notes"
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder="Any additional notes about this delivery, conditions, issues..."
            multiline
            rows={3}
          />
        </div>

        {/* Stock Update Notice */}
        <div className="bg-amber-500/100/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-amber-500/15 p-2 rounded-lg mt-1">
              <AlertCircle className="w-5 h-5 text-yellow-700" />
            </div>
            <div>
              <h4 className="font-medium text-yellow-800 mb-1">Stock Update Notice</h4>
              <p className="text-sm text-yellow-700">
                After confirming delivery, product stock quantities will be automatically updated 
                in the system. The branch inventory will reflect the new stock levels immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={loading || deliveryItems.length === 0 || totalDelivered === 0}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Complete Delivery & Update Stock
          </Button>
        </div>
      </div>
    </Modal>
  );
};