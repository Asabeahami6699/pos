// src/components/admin/BatchAllocationModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Select } from '../Select';
import { Input } from '../Input';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { 
  Package, 
  Building, 
  ShoppingBag, 
  Truck, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Minus,
  X
} from 'lucide-react';

interface BatchAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onSuccess?: () => void;
}

interface ProductSelection {
  id: string;
  name: string;
  sku: string;
  price: number;
  wholesale_price: number;
  warehouse_stock: number;
  retail_quantity: number;
  wholesale_quantity: number;
  total_quantity: number;
}

interface BranchSelection {
  id: string;
  name: string;
  sales_type: string;
}

const BatchAllocationModal: React.FC<BatchAllocationModalProps> = ({
  isOpen,
  onClose,
  companyId,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<BranchSelection[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<Record<string, number>>({});
  
  const [formData, setFormData] = useState({
    branchIds: [] as string[],
    sales_type: 'retail' as 'retail' | 'wholesale' | 'both',
    notes: '',
  });
  
  const [selectedProducts, setSelectedProducts] = useState<ProductSelection[]>([]);
  const [selectedBranchNames, setSelectedBranchNames] = useState<string[]>([]);
  const [selectAllBranches, setSelectAllBranches] = useState(false);
  const [selectAllProducts, setSelectAllProducts] = useState(false);

  useEffect(() => {
    if (isOpen && companyId) {
      fetchData();
    }
  }, [isOpen, companyId]);

  const fetchData = async () => {
    try {
      const [branchesRes, productsRes, warehouseRes] = await Promise.all([
        supabase.from('branches').select('*').eq('company_id', companyId),
        supabase.from('products').select('*').eq('company_id', companyId),
        supabase.from('warehouse_inventory').select('*').eq('company_id', companyId)
      ]);

      if (branchesRes.data) {
        setBranches(branchesRes.data);
      }
      
      if (productsRes.data) {
        setProducts(productsRes.data);
      }
      
      if (warehouseRes.data) {
        const stockMap: Record<string, number> = {};
        warehouseRes.data.forEach(item => {
          stockMap[item.product_id] = item.quantity || 0;
        });
        setWarehouseStock(stockMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Data Fetch Error', {
        description: 'Failed to load allocation data'
      });
    }
  };

  const toggleBranchSelection = (branchId: string, branchName: string) => {
    if (formData.branchIds.includes(branchId)) {
      setFormData({
        ...formData,
        branchIds: formData.branchIds.filter(id => id !== branchId)
      });
      setSelectedBranchNames(selectedBranchNames.filter(name => name !== branchName));
    } else {
      setFormData({
        ...formData,
        branchIds: [...formData.branchIds, branchId]
      });
      setSelectedBranchNames([...selectedBranchNames, branchName]);
    }
  };

  const toggleSelectAllBranches = () => {
    if (selectAllBranches) {
      setFormData({ ...formData, branchIds: [] });
      setSelectedBranchNames([]);
    } else {
      const allBranchIds = branches.map(b => b.id);
      const allBranchNames = branches.map(b => b.name);
      setFormData({ ...formData, branchIds: allBranchIds });
      setSelectedBranchNames(allBranchNames);
    }
    setSelectAllBranches(!selectAllBranches);
  };

  const toggleProductSelection = (product: any) => {
    const existingProduct = selectedProducts.find(p => p.id === product.id);
    
    if (existingProduct) {
      setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
    } else {
      const newProduct: ProductSelection = {
        id: product.id,
        name: product.name,
        sku: product.sku || 'N/A',
        price: product.price,
        wholesale_price: product.wholesale_price || product.price,
        warehouse_stock: warehouseStock[product.id] || 0,
        retail_quantity: 0,
        wholesale_quantity: 0,
        total_quantity: 0
      };
      setSelectedProducts([...selectedProducts, newProduct]);
    }
  };

  const toggleSelectAllProducts = () => {
    if (selectAllProducts) {
      setSelectedProducts([]);
    } else {
      const allProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        sku: product.sku || 'N/A',
        price: product.price,
        wholesale_price: product.wholesale_price || product.price,
        warehouse_stock: warehouseStock[product.id] || 0,
        retail_quantity: 0,
        wholesale_quantity: 0,
        total_quantity: 0
      }));
      setSelectedProducts(allProducts);
    }
    setSelectAllProducts(!selectAllProducts);
  };

  const updateProductQuantity = (productId: string, field: 'retail_quantity' | 'wholesale_quantity', value: number) => {
    setSelectedProducts(prev => prev.map(product => {
      if (product.id === productId) {
        const updatedProduct = {
          ...product,
          [field]: Math.max(0, Math.min(value, product.warehouse_stock - (field === 'retail_quantity' ? product.wholesale_quantity : product.retail_quantity)))
        };
        updatedProduct.total_quantity = updatedProduct.retail_quantity + updatedProduct.wholesale_quantity;
        return updatedProduct;
      }
      return product;
    }));
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  const validateForm = () => {
    if (formData.branchIds.length === 0) {
      toast.error('Select Branches', {
        description: 'Please select at least one branch'
      });
      return false;
    }

    if (selectedProducts.length === 0) {
      toast.error('Select Products', {
        description: 'Please select at least one product'
      });
      return false;
    }

    let isValid = true;
    selectedProducts.forEach(product => {
      if (product.total_quantity <= 0) {
        toast.error('Invalid Quantity', {
          description: `Please enter quantity for ${product.name}`
        });
        isValid = false;
      }
      
      if (product.total_quantity > product.warehouse_stock) {
        toast.error('Insufficient Stock', {
          description: `${product.name}: Only ${product.warehouse_stock} units available`
        });
        isValid = false;
      }
    });

    return isValid;
  };

  const calculateTotals = () => {
    const totalRetail = selectedProducts.reduce((sum, p) => sum + p.retail_quantity, 0);
    const totalWholesale = selectedProducts.reduce((sum, p) => sum + p.wholesale_quantity, 0);
    const totalProducts = selectedProducts.length;
    const totalBranches = formData.branchIds.length;
    const totalValue = selectedProducts.reduce((sum, p) => {
      const retailValue = p.retail_quantity * p.price;
      const wholesaleValue = p.wholesale_quantity * p.wholesale_price;
      return sum + retailValue + wholesaleValue;
    }, 0);

    return { totalRetail, totalWholesale, totalProducts, totalBranches, totalValue };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    const toastId = toast.loading('Processing batch allocation...');

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user) throw new Error('User not authenticated');

      // Process allocation for each branch
      const results = [];
      
      for (const branchId of formData.branchIds) {
        // Create allocation record
        const { data: allocation, error: allocationError } = await supabase
          .from('allocations')
          .insert({
            company_id: companyId,
            to_branch_id: branchId,
            sales_type: formData.sales_type,
            allocated_by: userData.user.id,
            notes: formData.notes,
            status: 'completed'
          })
          .select()
          .single();

        if (allocationError) throw allocationError;

        // Create allocation items
        const allocationItems = selectedProducts
          .filter(product => product.total_quantity > 0)
          .map(product => ({
            allocation_id: allocation.id,
            product_id: product.id,
            retail_quantity: product.retail_quantity,
            wholesale_quantity: product.wholesale_quantity
          }));

        if (allocationItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('allocation_items')
            .insert(allocationItems);

          if (itemsError) throw itemsError;
        }

        // Process warehouse deduction and branch allocation for this branch
        for (const product of selectedProducts) {
          if (product.total_quantity > 0) {
            // Deduct from warehouse
            await supabase.rpc('update_warehouse_inventory', {
              p_product_id: product.id,
              p_company_id: companyId,
              p_quantity_change: -product.total_quantity
            });

            // Update or create branch inventory
            const { data: existing } = await supabase
              .from('branch_inventory')
              .select('*')
              .eq('branch_id', branchId)
              .eq('product_id', product.id)
              .single();

            if (existing) {
              await supabase
                .from('branch_inventory')
                .update({
                  quantity: existing.quantity + product.total_quantity,
                  retail_quantity: existing.retail_quantity + product.retail_quantity,
                  wholesale_quantity: existing.wholesale_quantity + product.wholesale_quantity,
                  low_stock: false,
                  last_updated: new Date().toISOString()
                })
                .eq('branch_id', branchId)
                .eq('product_id', product.id);
            } else {
              await supabase
                .from('branch_inventory')
                .insert({
                  branch_id: branchId,
                  product_id: product.id,
                  quantity: product.total_quantity,
                  retail_quantity: product.retail_quantity,
                  wholesale_quantity: product.wholesale_quantity,
                  company_id: companyId,
                  low_stock: false
                });
            }
          }
        }

        results.push({ branchId, success: true });
      }

      // Create notification
      const totals = calculateTotals();
      await supabase
        .from('notifications')
        .insert({
          company_id: companyId,
          title: 'Batch Allocation Completed',
          message: `Allocated ${totals.totalRetail + totals.totalWholesale} units across ${totals.totalBranches} branch(es)`,
          type: 'success'
        });

      toast.success('Batch Allocation Complete', {
        description: `Successfully allocated products to ${formData.branchIds.length} branch(es)`,
        id: toastId,
        action: {
          label: 'View Allocations',
          onClick: () => {
            // Navigate to allocations history
          }
        }
      });

      // Reset form
      setFormData({
        branchIds: [],
        sales_type: 'retail',
        notes: '',
      });
      setSelectedProducts([]);
      setSelectedBranchNames([]);
      setSelectAllBranches(false);
      setSelectAllProducts(false);
      
      onClose();
      if (onSuccess) onSuccess();
      
    } catch (error: any) {
      console.error('Batch allocation error:', error);
      toast.error('Allocation Failed', {
        description: error.message || 'Failed to process batch allocation',
        id: toastId
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Batch Product Allocation"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header with steps */}
        <div className="flex items-center justify-center space-x-8 mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
            <span className="ml-2 text-sm font-medium">Select Branches</span>
          </div>
          <div className="w-12 h-0.5 bg-muted"></div>
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
              selectedProducts.length > 0 ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'
            }`}>2</div>
            <span className="ml-2 text-sm font-medium">Select Products</span>
          </div>
          <div className="w-12 h-0.5 bg-muted"></div>
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
              totals.totalRetail + totals.totalWholesale > 0 ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'
            }`}>3</div>
            <span className="ml-2 text-sm font-medium">Set Quantities</span>
          </div>
        </div>

        {/* Step 1: Branch Selection */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-foreground">Step 1: Select Branches</h3>
              <p className="text-sm text-muted-foreground">Choose branches to allocate products to</p>
            </div>
            <button
              type="button"
              onClick={toggleSelectAllBranches}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {selectAllBranches ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-3 border border-border rounded-lg">
            {branches.map(branch => (
              <div
                key={branch.id}
                className={`p-3 border rounded-lg cursor-pointer transition-all ${
                  formData.branchIds.includes(branch.id)
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-border hover:border-border'
                }`}
                onClick={() => toggleBranchSelection(branch.id, branch.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Building className="w-4 h-4 text-muted-foreground mr-2" />
                    <span className="font-medium text-foreground">{branch.name}</span>
                  </div>
                  {formData.branchIds.includes(branch.id) && (
                    <CheckCircle className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    branch.sales_type === 'retail' ? 'bg-blue-500/15 text-blue-800' :
                    branch.sales_type === 'wholesale' ? 'bg-emerald-500/15 text-green-800' :
                    'bg-purple-500/15 text-purple-800'
                  }`}>
                    {branch.sales_type}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Selected Branches Summary */}
          {selectedBranchNames.length > 0 && (
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-2">Selected Branches:</p>
              <div className="flex flex-wrap gap-2">
                {selectedBranchNames.map((name, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-card border border-blue-300 text-blue-700"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => {
                        const branch = branches.find(b => b.name === name);
                        if (branch) {
                          toggleBranchSelection(branch.id, branch.name);
                        }
                      }}
                      className="ml-2 text-blue-500 hover:text-blue-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Product Selection */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-foreground">Step 2: Select Products</h3>
              <p className="text-sm text-muted-foreground">Choose products to allocate</p>
            </div>
            <button
              type="button"
              onClick={toggleSelectAllProducts}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {selectAllProducts ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          
          <div className="max-h-80 overflow-y-auto border border-border rounded-lg">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-secondary/60 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Retail Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Wholesale Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Warehouse Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Select
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {products.map(product => {
                  const isSelected = selectedProducts.some(p => p.id === product.id);
                  const stock = warehouseStock[product.id] || 0;
                  const isLowStock = stock <= 10;
                  
                  return (
                    <tr 
                      key={product.id}
                      className={`hover:bg-secondary/60 cursor-pointer ${
                        isSelected ? 'bg-indigo-500/10' : ''
                      }`}
                      onClick={() => toggleProductSelection(product)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <Package className="w-4 h-4 text-muted-foreground mr-3" />
                          <div>
                            <div className="font-medium text-foreground">{product.name}</div>
                            <div className="text-sm text-muted-foreground">{product.sku || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">₵{product.price.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-green-700">
                          ₵{product.wholesale_price?.toFixed(2) || product.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className={`font-medium mr-2 ${
                            isLowStock ? 'text-red-600' : 'text-foreground'
                          }`}>
                            {stock}
                          </span>
                          {isLowStock && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-600' 
                            : 'border-border'
                        }`}>
                          {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Step 3: Quantity Setting */}
        {selectedProducts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground">Step 3: Set Quantities</h3>
                <p className="text-sm text-muted-foreground">Specify retail and wholesale quantities for each product</p>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedProducts.length} product(s) selected
              </div>
            </div>
            
            {/* Sales Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                Allocation Type
              </label>
              <div className="flex space-x-4">
                {['retail', 'wholesale', 'both'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({...formData, sales_type: type as any})}
                    className={`px-4 py-2 rounded-lg flex items-center ${
                      formData.sales_type === type
                        ? 'bg-indigo-500/15 text-indigo-700 border-2 border-indigo-300'
                        : 'bg-secondary text-foreground hover:bg-muted border-2 border-transparent'
                    }`}
                  >
                    {type === 'retail' && <ShoppingBag className="w-4 h-4 mr-2" />}
                    {type === 'wholesale' && <Truck className="w-4 h-4 mr-2" />}
                    {type === 'both' && (
                      <>
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        <Truck className="w-4 h-4 mr-2" />
                      </>
                    )}
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Quantity Table */}
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-secondary/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Available
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Retail Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Wholesale Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {selectedProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{product.name}</div>
                        <div className="text-sm text-muted-foreground">SKU: {product.sku}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{product.warehouse_stock}</div>
                        <div className="text-xs text-muted-foreground">in warehouse</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => updateProductQuantity(product.id, 'retail_quantity', product.retail_quantity - 1)}
                            className="p-1 rounded-full hover:bg-secondary"
                            disabled={product.retail_quantity <= 0}
                          >
                            <Minus className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <Input
                            type="number"
                            min="0"
                            max={product.warehouse_stock - product.wholesale_quantity}
                            value={product.retail_quantity}
                            onChange={(e) => updateProductQuantity(product.id, 'retail_quantity', parseInt(e.target.value) || 0)}
                            className="w-20 text-center"
                          />
                          <button
                            type="button"
                            onClick={() => updateProductQuantity(product.id, 'retail_quantity', product.retail_quantity + 1)}
                            className="p-1 rounded-full hover:bg-secondary"
                            disabled={product.retail_quantity + product.wholesale_quantity >= product.warehouse_stock}
                          >
                            <Plus className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => updateProductQuantity(product.id, 'wholesale_quantity', product.wholesale_quantity - 1)}
                            className="p-1 rounded-full hover:bg-secondary"
                            disabled={product.wholesale_quantity <= 0}
                          >
                            <Minus className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <Input
                            type="number"
                            min="0"
                            max={product.warehouse_stock - product.retail_quantity}
                            value={product.wholesale_quantity}
                            onChange={(e) => updateProductQuantity(product.id, 'wholesale_quantity', parseInt(e.target.value) || 0)}
                            className="w-20 text-center"
                          />
                          <button
                            type="button"
                            onClick={() => updateProductQuantity(product.id, 'wholesale_quantity', product.wholesale_quantity + 1)}
                            className="p-1 rounded-full hover:bg-secondary"
                            disabled={product.retail_quantity + product.wholesale_quantity >= product.warehouse_stock}
                          >
                            <Plus className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground text-lg">{product.total_quantity}</div>
                        {product.total_quantity > product.warehouse_stock && (
                          <div className="text-xs text-red-600 mt-1">Exceeds available stock</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Allocation Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Add any notes about this allocation..."
          />
        </div>

        {/* Summary */}
        {(selectedProducts.length > 0 || formData.branchIds.length > 0) && (
          <div className="bg-gradient-to-r from-indigo-500/10 to-blue-500/5 p-5 rounded-xl border border-indigo-500/20">
            <h4 className="font-bold text-foreground mb-4">Allocation Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold text-indigo-700">{totals.totalProducts}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Branches</p>
                <p className="text-2xl font-bold text-blue-700">{totals.totalBranches}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Retail Quantity</p>
                <p className="text-2xl font-bold text-green-700">{totals.totalRetail}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Wholesale Quantity</p>
                <p className="text-2xl font-bold text-purple-700">{totals.totalWholesale}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-indigo-500/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Units</p>
                  <p className="text-2xl font-bold text-foreground">
                    {totals.totalRetail + totals.totalWholesale}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Estimated Value</p>
                  <p className="text-2xl font-bold text-green-700">
                    ₵{totals.totalValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t">
          <div>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
          
          <div className="flex space-x-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => {
                setSelectedProducts([]);
                setFormData({...formData, branchIds: []});
                setSelectedBranchNames([]);
              }}
              disabled={loading}
            >
              Reset
            </Button>
            <Button 
              type="submit" 
              loading={loading}
              disabled={selectedProducts.length === 0 || formData.branchIds.length === 0 || loading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              <Truck className="w-5 h-5 mr-2" />
              Allocate Products
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default BatchAllocationModal;