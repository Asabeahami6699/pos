// components/pos/RestockInvoiceModal.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { InvoiceService } from '../../services/invoiceService';
import { toast } from 'sonner';
import { X, Printer, Download, Check, Package } from 'lucide-react';

interface RestockInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  restockRequest: any;
  user: any;
  onSuccess: () => void;
}

export const RestockInvoiceModal: React.FC<RestockInvoiceModalProps> = ({
  isOpen,
  onClose,
  restockRequest,
  user,
  onSuccess
}) => {
  const [products, setProducts] = useState<any[]>([]);
  const [deliveredQuantities, setDeliveredQuantities] = useState<Record<string, number>>({});
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && restockRequest) {
      loadProducts();
      initializeQuantities();
    }
  }, [isOpen, restockRequest]);

  const loadProducts = async () => {
    try {
      // Get product details for the restock request
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', restockRequest.product_id);

      if (error) throw error;
      
      setProducts(data || []);
      
      // Initialize unit prices
      const prices: Record<string, number> = {};
      (data || []).forEach(product => {
        prices[product.id] = product.cost_price || product.price * 0.7; // Default to 70% of retail price
      });
      setUnitPrices(prices);
      
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const initializeQuantities = () => {
    if (restockRequest) {
      setDeliveredQuantities({
        [restockRequest.product_id]: restockRequest.quantity || 0
      });
    }
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setDeliveredQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, quantity)
    }));
  };

  const handlePriceChange = (productId: string, price: number) => {
    setUnitPrices(prev => ({
      ...prev,
      [productId]: Math.max(0, price)
    }));
  };

  const calculateTotals = () => {
    let totalItems = 0;
    let totalQuantity = 0;
    let totalAmount = 0;

    products.forEach(product => {
      const quantity = deliveredQuantities[product.id] || 0;
      const unitPrice = unitPrices[product.id] || 0;
      
      if (quantity > 0) {
        totalItems++;
        totalQuantity += quantity;
        totalAmount += quantity * unitPrice;
      }
    });

    return { totalItems, totalQuantity, totalAmount };
  };

  const handleCreateInvoice = async () => {
    if (!user || !restockRequest) return;

    setSubmitting(true);
    const toastId = toast.loading('Creating delivery invoice...');

    try {
      const items = products
        .filter(product => (deliveredQuantities[product.id] || 0) > 0)
        .map(product => ({
          product_id: product.id,
          quantity_requested: restockRequest.quantity,
          quantity_delivered: deliveredQuantities[product.id],
          unit_price: unitPrices[product.id],
          total_price: deliveredQuantities[product.id] * unitPrices[product.id],
          notes: ''
        }));

      const invoice = await InvoiceService.createRestockInvoice({
        restockRequestId: restockRequest.id,
        branchId: restockRequest.branch_id,
        companyId: restockRequest.company_id,
        items,
        deliveredBy: user.id,
        deliveryDate: new Date(deliveryDate),
        notes
      });

      toast.success('Invoice Created Successfully!', {
        description: `Invoice #${invoice.invoice_number} has been generated`,
        id: toastId,
        action: {
          label: 'View Invoice',
          onClick: () => {
            // Open invoice view modal
            window.open(`/invoices/${invoice.id}`, '_blank');
          }
        }
      });

      onSuccess();
      onClose();
      
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice', {
        description: error.message || 'Please try again',
        id: toastId
      });
    } finally {
      setSubmitting(false);
    }
  };

  const { totalItems, totalQuantity, totalAmount } = calculateTotals();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6" />
                Create Delivery Invoice
              </h2>
              <p className="text-blue-100 mt-1">
                Record delivered items for {restockRequest?.products?.name || 'Product'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-secondary/60 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Request ID</p>
              <p className="font-mono font-bold">{restockRequest?.id?.slice(-8)}</p>
            </div>
            <div className="bg-secondary/60 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Requested Quantity</p>
              <p className="text-2xl font-bold text-blue-600">{restockRequest?.quantity}</p>
            </div>
          </div>

          {/* Delivery Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Delivery Date
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Products Table */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading product details...</p>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Delivered Items</h3>
              
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-secondary/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Requested
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Delivered
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {products.map(product => {
                      const quantity = deliveredQuantities[product.id] || 0;
                      const unitPrice = unitPrices[product.id] || 0;
                      const total = quantity * unitPrice;
                      
                      return (
                        <tr key={product.id} className="hover:bg-secondary/60">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-foreground">{product.name}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-sm text-muted-foreground bg-secondary px-2 py-1 rounded">
                              {product.sku}
                            </code>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-center">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500/15 text-blue-800">
                                {restockRequest.quantity}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              max={restockRequest.quantity * 2} // Allow some flexibility
                              value={quantity}
                              onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 0)}
                              className="w-24 p-2 border border-border rounded text-center"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-muted-foreground">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={unitPrice.toFixed(2)}
                                onChange={(e) => handlePriceChange(product.id, parseFloat(e.target.value) || 0)}
                                className="w-32 p-2 border border-border rounded"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            ${total.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Delivery Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about the delivery (condition of goods, special instructions, etc.)"
              className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
              rows={4}
            />
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-blue-500/10 to-indigo-50 p-6 rounded-lg border border-blue-500/20">
            <h3 className="text-lg font-semibold text-foreground mb-4">Invoice Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-3xl font-bold text-blue-600">{totalItems}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Quantity</p>
                <p className="text-3xl font-bold text-blue-600">{totalQuantity}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-3xl font-bold text-green-600">${totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-secondary/60 px-6 py-4 border-t flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Delivering to: <span className="font-medium">{user?.full_name}</span>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-2 border border-border rounded-lg text-foreground hover:bg-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateInvoice}
              disabled={submitting || totalQuantity === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Complete Delivery & Create Invoice</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};