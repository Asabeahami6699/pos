import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Select } from '../Select';
import { Button } from '../Button';

interface Product {
  id: string;
  name: string;
  sku: string;
  stock?: number;
}

// New interface for selected items with quantity
interface SelectedProduct extends Product {
  requestedQuantity: string;
}

interface RestockRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  companyId: string;
  userId: string;
  products: Product[];
  existingRequest?: any;
}

export const RestockRequestModal: React.FC<RestockRequestModalProps> = ({
  isOpen,
  onClose,
  branchId,
  companyId,
  userId,
  products,
  existingRequest
}) => {
  // Form State
  const [formData, setFormData] = useState<{ 
    productId: string;
    adminNotes: string;
    selectedItems: SelectedProduct[];
  }>({
    productId: '',
    adminNotes: '',
    selectedItems: []
  });

  const [loading, setLoading] = useState(false);

  // Initialize from existing request if editing
  useEffect(() => {
    if (existingRequest && existingRequest.items) {
      const selectedItems: SelectedProduct[] = existingRequest.items.map((item: any) => {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          return {
            ...product,
            requestedQuantity: item.requested_quantity.toString()
          };
        }
        return null;
      }).filter(Boolean) as SelectedProduct[];

      setFormData(prev => ({
        ...prev,
        adminNotes: existingRequest.admin_notes || '',
        selectedItems
      }));
    }
  }, [existingRequest, products]);

  // Handle Item Selection
  const handleAddItem = (product: Product) => {
    if (formData.selectedItems.find(item => item.id === product.id)) return;

    const newItem: SelectedProduct = {
      ...product,
      requestedQuantity: '10' // Default quantity
    };

    setFormData(prev => ({
      ...prev,
      selectedItems: [...prev.selectedItems, newItem]
    }));
  };

  const handleRemoveItem = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.filter(item => item.id !== productId)
    }));
  };

  // Update quantity for a specific product
  const handleUpdateQuantity = (productId: string, quantity: string) => {
    setFormData(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.map(item =>
        item.id === productId ? { ...item, requestedQuantity: quantity } : item
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.selectedItems.length === 0) {
      toast.warning('Select Products', {
        description: 'Please select at least one product to restock.'
      });
      return;
    }

    // Validate all quantities
    const hasInvalidQuantity = formData.selectedItems.some(item => 
      !item.requestedQuantity || parseInt(item.requestedQuantity) <= 0
    );
    
    if (hasInvalidQuantity) {
      toast.warning('Invalid Quantities', {
        description: 'Please ensure all quantities are valid numbers greater than 0.'
      });
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Processing request...');

    try {
      // Calculate total quantity
      const totalQuantity = formData.selectedItems.reduce(
        (sum, item) => sum + parseInt(item.requestedQuantity), 
        0
      );

      // For editing existing request
      if (existingRequest) {
        const { error } = await supabase
          .from('restock_requests')
          .update({
            items: formData.selectedItems.map(item => ({
              product_id: item.id,
              requested_quantity: parseInt(item.requestedQuantity)
            })),
            admin_notes: formData.adminNotes,
            requested_quantity: totalQuantity
          })
          .eq('id', existingRequest.id);

        if (error) throw error;
        toast.success('Request Updated', { id: toastId });
      } else {
        // Insert New Request
        const { error } = await supabase
          .from('restock_requests')
          .insert([{
            company_id: companyId,
            branch_id: branchId,
            requested_by: userId,
            items: formData.selectedItems.map(item => ({
              product_id: item.id,
              requested_quantity: parseInt(item.requestedQuantity)
            })),
            admin_notes: formData.adminNotes,
            status: 'pending',
            requested_quantity: totalQuantity
          }]);

        if (error) throw error;
        toast.success('Request Sent', { id: toastId });
      }

      // Reset and Close
      setFormData({
        productId: '',
        adminNotes: '',
        selectedItems: []
      });
      onClose();

    } catch (error: any) {
      console.error('Restock request error:', error);
      toast.error('Submission Failed', {
        description: error.message || 'Could not send request.',
        id: toastId
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate total quantity
  const totalQuantity = formData.selectedItems.reduce(
    (sum, item) => sum + (parseInt(item.requestedQuantity) || 0), 
    0
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={existingRequest ? "Update Restock Request" : "Create Restock Request"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4 bg-blue-500/10 p-3 rounded border border-blue-500/20">
          <p className="font-medium text-blue-800">
            {existingRequest ? "Update existing request below." : "Select products from the list that need restocking."}
          </p>
        </div>

        {/* Multi-Select Product Area */}
        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-secondary/60">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Select Products</p>
          {products.map(product => {
            const isSelected = formData.selectedItems.some(item => item.id === product.id);
            
            return (
              <div
                key={product.id}  // ✅ FIXED: Added key prop
                onClick={() => handleAddItem(product)}
                className={`
                  flex items-center justify-between p-3 rounded border cursor-pointer transition-colors
                  ${isSelected 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : 'border-border hover:bg-card hover:border-indigo-300 bg-card'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.sku}</div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center">
                      <span className="text-sm">✓</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  Current Stock: {product.stock || 0}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Products with Quantity Controls */}
        {formData.selectedItems.length > 0 && (
          <div className="space-y-3 border rounded-lg p-4 bg-card">
            <p className="text-sm font-bold text-foreground mb-2">Selected Products & Quantities</p>
            <div className="space-y-3">
              {formData.selectedItems.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-secondary/60 hover:bg-secondary"
                >
                  <div className="flex-1">
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.sku}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current Stock: {item.stock || 0}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-32">
                      <Input
                        type="number"
                        value={item.requestedQuantity}
                        onChange={(e) => handleUpdateQuantity(item.id, e.target.value)}
                        placeholder="Quantity"
                        min="1"
                        required
                        disabled={loading}
                        className="w-full"
                        label="Request Quantity"
                        hideLabel
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      disabled={loading}
                      aria-label="Remove product"
                    >
                      <svg 
                        className="w-5 h-5" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Section */}
            <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-100 rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-indigo-900">
                    {formData.selectedItems.length} product(s) selected
                  </p>
                  <p className="text-xs text-indigo-700">
                    Total items requested: {totalQuantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-900">
                    Total Quantity
                  </p>
                  <p className="text-lg font-bold text-indigo-700">
                    {totalQuantity}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Notes */}
        <div className="col-span-2">
          <Input
            label="Admin Notes"
            value={formData.adminNotes}
            onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
            placeholder="Internal notes for this request"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            These notes are visible to administrators and warehouse staff only
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
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
            disabled={loading || formData.selectedItems.length === 0}
          >
            {existingRequest ? 'Update Request' : 'Send Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};