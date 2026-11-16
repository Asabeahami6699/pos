// C:\Users\HP\pos-inventory\src\components\admin\dashboard-tabs\ProcessRestockModal.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Button } from '../Button';
import { Loader2, Package, Building, User, Calendar, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { useInvoiceManagement } from '../../hooks/useInvoiceManagement';

interface RestockItem {
  product_id: string;
  requested_quantity: number;
  product_name?: string;
  sku?: string;
  price?: number;
}

interface RestockRequest {
  id: string;
  branch_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  items: RestockItem[] | null;
  requested_quantity: number | null;
  product_id: string | null;
  product_name?: string;
  branch_name?: string;
  staff_name?: string;
  company_id?: string;
  created_at: string;
  admin_notes?: string;
  fulfilled_quantity?: number;
  fulfilled_at?: string;
}

interface ProductDetails {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  wholesale_price: number | null;
  low_stock_threshold: number;
}

interface ProcessRestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RestockRequest | null;
  onFulfilled: () => void;
  companyId?: string;
  currentUser?: any;
}

export const ProcessRestockModal: React.FC<ProcessRestockModalProps> = ({
  isOpen,
  onClose,
  request,
  onFulfilled,
  companyId,
  currentUser
}) => {
  const [loading, setLoading] = useState(false);
  const [fulfillmentItems, setFulfillmentItems] = useState<Array<{
    product_id: string;
    product_name: string;
    sku?: string;
    price?: number;
    requested: number;
    to_fulfill: string;
    current_stock?: number;
    product_data?: ProductDetails | null;
  }>>([]);
  
  const [currentBranchStock, setCurrentBranchStock] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  
  // Get authenticated user ID
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // Initialize auth user
  useEffect(() => {
    const getAuthUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setAuthUserId(session.user.id);
      }
    };
    getAuthUser();
  }, []);

  // Get the invoice management hook
  const {
    generating,
    generateInvoice
  } = useInvoiceManagement(
    companyId || request?.company_id, 
    currentUser?.role, 
    authUserId
  );

  // Initialize modal data
  useEffect(() => {
    const initializeModal = async () => {
      if (!isOpen || !request) {
        setFulfillmentItems([]);
        setCurrentBranchStock({});
        setNotes('');
        return;
      }

      setNotes(request.admin_notes || '');
      
      try {
        // Determine items to display
        const items: RestockItem[] = Array.isArray(request.items) 
          ? request.items 
          : request.product_id 
            ? [{
                product_id: request.product_id,
                requested_quantity: request.requested_quantity || 0,
                product_name: request.product_name
              }]
            : [];

        if (items.length === 0) {
          toast.error('No Items', {
            description: 'This request contains no restock items'
          });
          return;
        }

        // Fetch product details
        const productIds = items.map(item => item.product_id);
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds);

        if (productsError) {
          console.error('Error fetching products:', productsError);
          toast.error('Product Fetch Error', {
            description: 'Failed to load product details'
          });
        }

        // Fetch current stock levels for this branch
        const { data: inventory, error: inventoryError } = await supabase
          .from('branch_inventory')
          .select('product_id, quantity')
          .eq('branch_id', request.branch_id)
          .in('product_id', productIds);

        if (inventoryError) {
          console.error('Error fetching inventory:', inventoryError);
        }

        // Create stock mapping
        const stockMap: Record<string, number> = {};
        inventory?.forEach(item => {
          stockMap[item.product_id] = item.quantity;
        });

        setCurrentBranchStock(stockMap);

        // Prepare fulfillment items
        const fulfillmentData = items.map(item => {
          const product = products?.find(p => p.id === item.product_id);
          const currentStock = stockMap[item.product_id] || 0;
          
          return {
            product_id: item.product_id,
            product_name: item.product_name || product?.name || `Product ${item.product_id.slice(-6)}`,
            sku: product?.sku,
            price: product?.price,
            requested: item.requested_quantity,
            to_fulfill: item.requested_quantity.toString(),
            current_stock: currentStock,
            product_data: product || null
          };
        });

        setFulfillmentItems(fulfillmentData);
      } catch (error) {
        console.error('Error initializing modal:', error);
        toast.error('Initialization Error', {
          description: 'Failed to load request details'
        });
      }
    };

    initializeModal();
  }, [isOpen, request]);

  const handleQuantityChange = (index: number, value: string) => {
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 0) return;
    
    const newItems = [...fulfillmentItems];
    newItems[index].to_fulfill = value;
    setFulfillmentItems(newItems);
  };

  const calculateTotalRequested = () => {
    return fulfillmentItems.reduce((sum, item) => sum + item.requested, 0);
  };

  const calculateTotalToFulfill = () => {
    return fulfillmentItems.reduce((sum, item) => sum + parseInt(item.to_fulfill || '0'), 0);
  };

  const calculateTotalDifference = () => {
    return calculateTotalToFulfill() - calculateTotalRequested();
  };

  const calculateTotalValue = () => {
    return fulfillmentItems.reduce((sum, item) => {
      const price = item.price || 0;
      const quantity = parseInt(item.to_fulfill || '0');
      return sum + (price * quantity);
    }, 0);
  };

  const validateFulfillment = () => {
    if (fulfillmentItems.length === 0) {
      toast.error('No Items', {
        description: 'There are no items to fulfill'
      });
      return false;
    }

    for (const item of fulfillmentItems) {
      const fulfilling = parseInt(item.to_fulfill || '0');
      if (isNaN(fulfilling) || fulfilling < 1) {
        toast.error('Invalid Quantity', {
          description: `Please enter a valid quantity for ${item.product_name}`
        });
        return false;
      }
    }

    return true;
  };

  // Handle approve and generate invoice
  const handleApproveAndInvoice = async () => {
    if (!request || loading) return;
    
    const toastId = toast.loading('Approving request and generating invoice...');
    setLoading(true);

    try {
      // Get current authenticated user
      if (!authUserId) {
        toast.error('Authentication Error', {
          description: 'Please login to approve requests'
        });
        setLoading(false);
        return;
      }

      // Generate invoice
      const result = await generateInvoice(request.id, authUserId);
      
      if (result.success) {
        toast.success('Request Approved & Invoice Generated', {
          description: `Invoice ${result.invoiceNumber} created successfully`,
          id: toastId
        });

        onFulfilled();
        onClose();
      }
    } catch (error: any) {
      console.error('Approve & Invoice error:', error);
      toast.error('Approval Failed', {
        description: error.message || 'Failed to approve request and generate invoice',
        id: toastId
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle fulfill and generate invoice
const handleFulfillAndInvoice = async () => {
  if (!request || loading) return;
  if (!validateFulfillment()) return;

  const toastId = toast.loading('Processing fulfillment and generating invoice...');
  setLoading(true);

  try {
    const requestCompanyId = companyId || request.company_id;
    
    if (!requestCompanyId) {
      throw new Error('Company ID is required for inventory update');
    }

    // Get current authenticated user
    if (!authUserId) {
      toast.error('Authentication Error', {
        description: 'Please login to fulfill requests'
      });
      setLoading(false);
      return;
    }

    console.log('=== STARTING FULFILLMENT ===');
    console.log('Request ID:', request.id);
    console.log('Company ID:', requestCompanyId);
    console.log('User ID:', authUserId);

    // Process each item - update inventory
    console.time('inventory_updates');
    const inventoryUpdates = fulfillmentItems.map(async (item) => {
      const qtyToAdd = parseInt(item.to_fulfill);
      console.log(`Processing item ${item.product_id}: ${qtyToAdd} units`);
      
      // Get current inventory
      const { data: existingInv, error: invError } = await supabase
        .from('branch_inventory')
        .select('quantity, low_stock')
        .eq('branch_id', request.branch_id)
        .eq('product_id', item.product_id)
        .single();

      if (invError && invError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.warn(`Error fetching inventory for ${item.product_id}:`, invError);
      }

      const currentQuantity = existingInv?.quantity || 0;
      const newQuantity = currentQuantity + qtyToAdd;
      
      // Check if still low stock
      const isLowStock = item.product_data 
        ? newQuantity <= item.product_data.low_stock_threshold
        : false;

      console.log(`Item ${item.product_id}: current=${currentQuantity}, new=${newQuantity}, low_stock=${isLowStock}`);

      if (existingInv) {
        // Update existing inventory
        return supabase
          .from('branch_inventory')
          .update({ 
            quantity: newQuantity,
            low_stock: isLowStock,
            last_updated: new Date().toISOString()
          })
          .eq('branch_id', request.branch_id)
          .eq('product_id', item.product_id);
      } else {
        // Create new inventory record
        return supabase
          .from('branch_inventory')
          .insert([{
            branch_id: request.branch_id,
            product_id: item.product_id,
            quantity: newQuantity,
            low_stock: isLowStock,
            company_id: requestCompanyId,
            last_updated: new Date().toISOString()
          }]);
      }
    });

    // Wait for all inventory updates
    await Promise.all(inventoryUpdates);
    console.timeEnd('inventory_updates');

    // Generate invoice
    console.time('generate_invoice');
    const invoiceResult = await generateInvoice(request.id, authUserId);
    console.timeEnd('generate_invoice');
    
    if (!invoiceResult.success) {
      throw new Error(invoiceResult.error || 'Failed to generate invoice');
    }

    console.log('Invoice generated successfully:', invoiceResult.invoiceNumber);

    // Update request status to fulfilled
    console.time('update_request_status');
    const { error: updateError } = await supabase
      .from('restock_requests')
      .update({ 
        status: 'fulfilled',
        fulfilled_at: new Date().toISOString(),
        fulfilled_quantity: calculateTotalToFulfill(),
        admin_notes: notes.trim() || null
      })
      .eq('id', request.id);

    if (updateError) {
      console.error('Update request error:', updateError);
      throw new Error(`Failed to update request status: ${updateError.message}`);
    }
    console.timeEnd('update_request_status');

    // Log the fulfillment activity
    console.time('log_fulfillment');
    await supabase
      .from('activity_log')
      .insert([{
        type: 'restock_fulfilled',
        description: `Fulfilled restock request ${request.id.slice(-8)} with invoice ${invoiceResult.invoiceNumber}`,
        company_id: requestCompanyId,
        user_id: authUserId,
        metadata: {
          request_id: request.id,
          invoice_number: invoiceResult.invoiceNumber,
          branch_id: request.branch_id,
          branch_name: request.branch_name,
          items: fulfillmentItems.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: parseInt(item.to_fulfill),
            value: (item.price || 0) * parseInt(item.to_fulfill)
          })),
          total_fulfilled: calculateTotalToFulfill(),
          total_value: calculateTotalValue()
        }
      }]);
    console.timeEnd('log_fulfillment');

    console.log('=== FULFILLMENT COMPLETED SUCCESSFULLY ===');
    
    toast.success('Request Fulfilled & Invoice Generated', {
      description: `Successfully added ${calculateTotalToFulfill()} items to inventory and created invoice ${invoiceResult.invoiceNumber}`,
      id: toastId,
      duration: 3000
    });

    onFulfilled();
    onClose();
    
  } catch (error: any) {
    console.error('=== FULFILLMENT FAILED ===');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    
    toast.error('Fulfillment Failed', {
      description: error.message || 'Could not update inventory and generate invoice. Please try again.',
      id: toastId,
      duration: 5000
    });
  } finally {
    setLoading(false);
  }
};

  const handleReject = async () => {
    if (!request || loading) return;

    const toastId = toast.loading('Rejecting request...');
    setLoading(true);

    try {
      const { error } = await supabase
        .from('restock_requests')
        .update({ 
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          admin_notes: notes.trim() || 'Request rejected by administrator'
        })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Request Rejected', {
        description: 'Request has been rejected',
        id: toastId
      });

      onFulfilled();
      onClose();
    } catch (error: any) {
      toast.error('Rejection Failed', {
        description: error.message || 'Failed to reject request',
        id: toastId
      });
    } finally {
      setLoading(false);
    }
  };

  if (!request) return null;

  const totalRequested = calculateTotalRequested();
  const totalToFulfill = calculateTotalToFulfill();
  const totalDifference = calculateTotalDifference();
  const totalValue = calculateTotalValue();

  const isShortage = totalDifference < 0;
  const isOverage = totalDifference > 0;
  const isExact = totalDifference === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Process Restock Request`}
      size="xl"
      showCloseButton={!loading}
    >
      <div className="space-y-6">
        {/* Request Header */}
        <div className="bg-gradient-to-r from-blue-500/10 to-indigo-50 p-5 rounded-xl border border-blue-500/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-2 bg-card rounded-lg shadow-sm">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Restock Request #{request.id.slice(-8)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(request.created_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-card rounded-lg">
                    <Building className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-semibold uppercase">Branch</p>
                    <p className="font-medium text-foreground">{request.branch_name || 'Unknown Branch'}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-card rounded-lg">
                    <User className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-semibold uppercase">Requested By</p>
                    <p className="font-medium text-foreground">{request.staff_name || 'Unknown Staff'}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-card rounded-lg">
                    <Calendar className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-600 font-semibold uppercase">Status</p>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        request.status === 'pending' ? 'bg-amber-500/15 text-yellow-800' :
                        request.status === 'approved' ? 'bg-blue-500/15 text-blue-800' :
                        request.status === 'fulfilled' ? 'bg-emerald-500/15 text-green-800' :
                        'bg-red-500/15 text-red-800'
                      }`}>
                        {request.status.toUpperCase()}
                      </span>
                      {request.status === 'fulfilled' && request.fulfilled_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(request.fulfilled_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground text-lg">Items to Restock</h3>
            <div className="text-sm text-muted-foreground">
              {fulfillmentItems.length} item{fulfillmentItems.length > 1 ? 's' : ''}
            </div>
          </div>
          
          {fulfillmentItems.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {fulfillmentItems.map((item, index) => {
                const fulfilling = parseInt(item.to_fulfill || '0');
                const difference = fulfilling - item.requested;
                const currentStock = currentBranchStock[item.product_id] || 0;
                const newStock = currentStock + fulfilling;
                
                return (
                  <div 
                    key={`${item.product_id}-${index}`}
                    className="p-4 bg-card rounded-xl border border-border hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-foreground">{item.product_name}</h4>
                        <div className="flex items-center space-x-3 mt-1">
                          {item.sku && (
                            <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">
                              SKU: {item.sku}
                            </span>
                          )}
                          {item.price && (
                            <span className="text-xs text-muted-foreground">
                              Price: ₵{item.price.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Product ID: <code className="bg-secondary px-1 py-0.5 rounded">{item.product_id.slice(-8)}</code>
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-indigo-600">
                          {item.requested} units requested
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Current stock: {currentStock}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Input
                          label="Quantity to Fulfill"
                          type="number"
                          value={item.to_fulfill}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          min="0"
                          max="9999"
                          required
                          disabled={loading || request.status === 'approved'}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Difference:</span>
                          <span className={`font-medium ${
                            difference === 0 ? 'text-muted-foreground' :
                            difference > 0 ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {difference >= 0 ? '+' : ''}{difference} units
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">New stock level:</span>
                          <span className="font-medium text-indigo-600">
                            {newStock} units
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Unit price:</span>
                          <span className="font-medium">
                            ₵{item.price?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total value:</span>
                          <span className="font-medium text-green-600">
                            ₵{((item.price || 0) * fulfilling).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Low stock warning */}
                    {item.product_data && newStock <= item.product_data.low_stock_threshold && (
                      <div className="mt-3 p-2 bg-amber-500/100/10 border border-amber-500/20 rounded-lg">
                        <div className="flex items-center">
                          <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
                          <span className="text-sm text-yellow-800">
                            Warning: After restock, this product will still be below low stock threshold
                            ({item.product_data.low_stock_threshold} units)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-secondary/60 rounded-xl border border-border">
              <div className="text-4xl mb-4">📦</div>
              <h4 className="font-medium text-foreground mb-2">No Items Found</h4>
              <p className="text-muted-foreground text-sm">
                This request doesn't contain any restock items.
              </p>
            </div>
          )}

          {/* Admin Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Admin Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this fulfillment (optional)"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Summary */}
          {fulfillmentItems.length > 0 && (
            <div className="bg-gradient-to-r from-secondary/60 to-secondary p-5 rounded-xl border border-border">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Requested</p>
                  <p className="text-2xl font-bold text-foreground">
                    {totalRequested}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total to Fulfill</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {totalToFulfill}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Difference</p>
                  <p className={`text-2xl font-bold ${
                    isExact ? 'text-muted-foreground' :
                    isOverage ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {isOverage ? '+' : ''}{totalDifference}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₵{totalValue.toFixed(2)}
                  </p>
                </div>
              </div>
              
              {isShortage && (
                <div className="mt-4 p-3 bg-amber-500/100/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                    <div>
                      <p className="text-sm text-yellow-800 font-medium">
                        ⚠️ You are fulfilling less than requested.
                      </p>
                      <p className="text-sm text-yellow-700">
                        This request will remain partially fulfilled.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {isOverage && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <div>
                      <p className="text-sm text-green-800 font-medium">
                        ✅ Extra inventory will be added.
                      </p>
                      <p className="text-sm text-green-700">
                        {totalDifference} additional units beyond requested amount.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons - Removed Cancel button */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t">
          <div className="flex flex-wrap gap-2">
            {(request.status === 'pending' || request.status === 'approved') && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleReject}
                loading={loading}
                disabled={loading}
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
              >
                Reject Request
              </Button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 justify-end">
            {/* Pending Request - Show Approve & Invoice and Fulfill & Invoice */}
            {request.status === 'pending' && (
              <>
                <Button
                  type="button"
                  variant="success"
                  onClick={handleApproveAndInvoice}
                  loading={loading && !generating}
                  disabled={loading || fulfillmentItems.length === 0}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Approve & Invoice
                </Button>
                <Button
                  type="button"
                  onClick={handleFulfillAndInvoice}
                  loading={loading}
                  disabled={loading || fulfillmentItems.length === 0}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Fulfill & Invoice
                </Button>
              </>
            )}
            
            {/* Approved Request - Show Fulfill & Invoice */}
            {request.status === 'approved' && (
              <Button
                type="button"
                onClick={handleFulfillAndInvoice}
                loading={loading}
                disabled={loading || fulfillmentItems.length === 0}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Fulfill & Invoice
              </Button>
            )}
            
            {/* Fulfilled or Rejected Request - No action buttons */}
            {(request.status === 'fulfilled' || request.status === 'rejected') && (
              <div className="text-sm text-muted-foreground italic">
                This request has been {request.status}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};