import React, { useEffect, useState } from 'react';
import { Building2, Package, Plus } from 'lucide-react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Select } from '../Select';
import { Button } from '../Button';
import { toast } from 'sonner';
import type { Branch, Product } from '../../hooks/useDashboardData';

interface AddBranchStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  branches: Branch[];
  products: Product[];
  defaultBranchId?: string;
  onAddExisting: (branchId: string, productId: string, quantity: number, notes?: string) => Promise<boolean>;
  onCreateProductAndStock: (payload: {
    branchId: string;
    name: string;
    sku: string;
    price: number;
    wholesale_price: number | null;
    low_stock_threshold: number;
    quantity: number;
    notes?: string;
  }) => Promise<boolean>;
  onSuccess: () => void;
}

export const AddBranchStockModal: React.FC<AddBranchStockModalProps> = ({
  isOpen,
  onClose,
  companyId,
  branches,
  products,
  defaultBranchId,
  onAddExisting,
  onCreateProductAndStock,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [branchId, setBranchId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [threshold, setThreshold] = useState('5');

  useEffect(() => {
    if (!isOpen) return;
    setBranchId(defaultBranchId && defaultBranchId !== 'all' ? defaultBranchId : branches[0]?.id ?? '');
    setProductId('');
    setQuantity('10');
    setNotes('');
    setMode('existing');
    setName('');
    setSku('');
    setPrice('');
    setWholesalePrice('');
    setThreshold('5');
  }, [isOpen, defaultBranchId, branches]);

  const branchOptions = branches.map((b) => ({
    value: b.id,
    label: b.name,
  }));

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branchId) {
      toast.error('Select a branch');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      let ok = false;

      if (mode === 'existing') {
        if (!productId) {
          toast.error('Select a product');
          return;
        }
        ok = await onAddExisting(branchId, productId, qty, notes.trim() || undefined);
      } else {
        if (!name.trim() || !sku.trim() || !price.trim()) {
          toast.error('Name, SKU, and retail price are required');
          return;
        }
        ok = await onCreateProductAndStock({
          branchId,
          name: name.trim(),
          sku: sku.trim(),
          price: parseFloat(price),
          wholesale_price: wholesalePrice.trim() ? parseFloat(wholesalePrice) : null,
          low_stock_threshold: parseInt(threshold, 10) || 5,
          quantity: qty,
          notes: notes.trim() || undefined,
        });
      }

      if (ok) {
        toast.success(mode === 'existing' ? 'Stock added to branch' : 'Product created and stocked');
        onSuccess();
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add stock');
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add stock to branch"
      size="lg"
      scrollable
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="add-branch-stock-form" loading={saving}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add stock
          </Button>
        </div>
      }
    >
      <form id="add-branch-stock-form" onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Branch-only companies stock shelves directly — no warehouse step. Salespeople and the marketplace use this branch inventory.
        </p>

        <Select
          label="Branch"
          value={branchId}
          onChange={setBranchId}
          options={branchOptions}
          required
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'existing'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            Existing product
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'new'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            New product
          </button>
        </div>

        {mode === 'existing' ? (
          <Select
            label="Product"
            value={productId}
            onChange={setProductId}
            options={[{ value: '', label: 'Choose a product…' }, ...productOptions]}
            required
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Product name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
            <Input
              label="Retail price (₵)"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
            <Input
              label="Wholesale price (₵)"
              type="number"
              min="0"
              step="0.01"
              value={wholesalePrice}
              onChange={(e) => setWholesalePrice(e.target.value)}
            />
            <Input
              label="Low stock threshold"
              type="number"
              min="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="sm:col-span-2"
            />
          </div>
        )}

        <Input
          label="Quantity to add"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />

        <Input
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Delivery reference, supplier, etc."
        />

        {branches.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <Building2 className="w-4 h-4 shrink-0" />
            Create a branch first before adding stock.
          </div>
        )}

        {mode === 'existing' && products.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            <Package className="w-4 h-4 shrink-0" />
            No products in catalog yet — use &quot;New product&quot; to create one.
          </div>
        )}
      </form>
    </Modal>
  );
};
