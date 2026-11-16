import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Select } from '../Select';
import { Button } from '../Button';
import {
  Package,
  Calculator,
  Tag,
  Truck,
  ScanLine,
  Check,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadProductMediaFiles } from '../../lib/productMediaUpload';
import { ProductMediaField, type MediaPreview } from './ProductMediaField';
import {
  OnlineListingFields,
  EMPTY_ONLINE_LISTING,
  type OnlineListingFormData,
} from './OnlineListingFields';
import { buildMarketplaceListingPayload } from '../../types/marketplaceListing';
import { BarcodeScannerInput } from '../BarcodeScannerInput';
import { usePhysicalBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { toast } from 'sonner';

interface AddWarehouseProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onSuccess: () => void;
  existingProducts?: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    wholesale_price?: number;
    image_url?: string | null;
  }>;
}

type WizardStep = 1 | 2 | 3;
type QuantityMode = 'simple' | 'boxes';

interface FormData {
  productName: string;
  sku: string;
  category: string;
  isNewProduct: boolean;
  existingProductId: string;
  productType: 'retail' | 'wholesale' | 'both';
  numberOfBoxes: string;
  quantityPerBox: string;
  totalUnits: string;
  wholesalePricePerBox: string;
  retailPricePerUnit: string;
  costPricePerUnit: string;
  costPricePerBox: string;
  totalWholesaleValue: string;
  totalRetailValue: string;
  totalCostValue: string;
  supplierName: string;
  batchLotNumber: string;
  dateReceived: string;
  notes: string;
  warehouseLocation: string;
  minStockLevel: string;
  onlineListing: OnlineListingFormData;
}

const INITIAL_FORM: FormData = {
  productName: '',
  sku: '',
  category: '',
  isNewProduct: true,
  existingProductId: '',
  productType: 'both',
  numberOfBoxes: '1',
  quantityPerBox: '',
  totalUnits: '',
  wholesalePricePerBox: '',
  retailPricePerUnit: '',
  costPricePerUnit: '',
  costPricePerBox: '',
  totalWholesaleValue: '',
  totalRetailValue: '',
  totalCostValue: '',
  supplierName: '',
  batchLotNumber: '',
  dateReceived: new Date().toISOString().split('T')[0],
  notes: '',
  warehouseLocation: 'Main Warehouse',
  minStockLevel: '10',
  onlineListing: { ...EMPTY_ONLINE_LISTING },
};

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: 'Identify' },
  { id: 2, label: 'Stock & price' },
  { id: 3, label: 'Optional' },
];

function makeSku(): string {
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PROD-${random}`;
}

export const AddWarehouseProductModal: React.FC<AddWarehouseProductModalProps> = ({
  isOpen,
  onClose,
  companyId,
  onSuccess,
  existingProducts = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [quantityMode, setQuantityMode] = useState<QuantityMode>('simple');
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaPreview[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...INITIAL_FORM });

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setQuantityMode('simple');
    }
  }, [isOpen]);

  // Sync totals from qty + prices
  useEffect(() => {
    const boxes = parseFloat(formData.numberOfBoxes) || 0;
    const perBox = parseFloat(formData.quantityPerBox) || 0;
    const units =
      quantityMode === 'simple'
        ? parseFloat(formData.totalUnits) || 0
        : boxes * perBox;
    const wholesalePrice = parseFloat(formData.wholesalePricePerBox) || 0;
    const retailPrice = parseFloat(formData.retailPricePerUnit) || 0;
    const costPerUnit = parseFloat(formData.costPricePerUnit) || 0;
    const costPerBox = parseFloat(formData.costPricePerBox) || 0;

    setFormData((prev) => {
      const next: Partial<FormData> = {};

      if (quantityMode === 'boxes' && !Number.isNaN(units) && units > 0) {
        next.totalUnits = String(units);
      }

      if (wholesalePrice > 0 && boxes > 0) {
        next.totalWholesaleValue = (wholesalePrice * boxes).toFixed(2);
      } else if (wholesalePrice > 0 && quantityMode === 'simple' && units > 0) {
        // Treat wholesale box price as unit proxy when using simple mode with 1 box
        next.totalWholesaleValue = (wholesalePrice * (boxes || 1)).toFixed(2);
      }

      if (retailPrice > 0 && units > 0) {
        next.totalRetailValue = (retailPrice * units).toFixed(2);
      }

      let costValue = 0;
      if (costPerUnit > 0 && units > 0) costValue = costPerUnit * units;
      else if (costPerBox > 0 && boxes > 0) costValue = costPerBox * boxes;
      if (costValue > 0) next.totalCostValue = costValue.toFixed(2);

      if (Object.keys(next).length === 0) return prev;
      return { ...prev, ...next };
    });
  }, [
    quantityMode,
    formData.numberOfBoxes,
    formData.quantityPerBox,
    formData.totalUnits,
    formData.wholesalePricePerBox,
    formData.retailPricePerUnit,
    formData.costPricePerUnit,
    formData.costPricePerBox,
  ]);

  const setSimpleTotalUnits = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      totalUnits: value,
      numberOfBoxes: '1',
      quantityPerBox: value,
    }));
  };

  const setQuantityModeAndSync = (mode: QuantityMode) => {
    setQuantityMode(mode);
    if (mode === 'simple') {
      const units =
        formData.totalUnits ||
        String(
          (parseFloat(formData.numberOfBoxes) || 0) *
            (parseFloat(formData.quantityPerBox) || 0) || '',
        );
      setFormData((prev) => ({
        ...prev,
        totalUnits: units,
        numberOfBoxes: '1',
        quantityPerBox: units,
      }));
    }
  };

  const handleExistingProductSelect = (productId: string) => {
    const product = existingProducts.find((p) => p.id === productId);
    if (product) {
      setFormData((prev) => ({
        ...prev,
        existingProductId: productId,
        productName: product.name,
        sku: product.sku,
        retailPricePerUnit: product.price.toString(),
        wholesalePricePerBox: product.wholesale_price?.toString() || '',
      }));
    }
  };

  const applyScannedProduct = useCallback(
    (product: {
      id: string;
      name: string;
      sku: string;
      price: number;
      wholesale_price?: number | null;
    }) => {
      setFormData((prev) => ({
        ...prev,
        isNewProduct: false,
        existingProductId: product.id,
        productName: product.name,
        sku: product.sku,
        retailPricePerUnit: product.price.toString(),
        wholesalePricePerBox: product.wholesale_price?.toString() || '',
      }));
      setScanHint(`Loaded: ${product.name} (${product.sku})`);
      toast.success('Product found', { description: product.name });
    },
    [],
  );

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      const code = barcode.trim();
      if (!code) return;

      const localMatch = existingProducts.find(
        (p) => p.sku.toLowerCase() === code.toLowerCase(),
      );
      if (localMatch) {
        applyScannedProduct(localMatch);
        return;
      }

      const { data: bySku, error: skuError } = await supabase
        .from('products')
        .select('id, name, sku, price, wholesale_price, barcode')
        .eq('company_id', companyId)
        .ilike('sku', code)
        .limit(1);

      if (skuError) {
        toast.error('Lookup failed', { description: skuError.message });
        return;
      }

      if (bySku && bySku.length > 0) {
        applyScannedProduct(bySku[0]);
        return;
      }

      const { data: byBarcode, error: barcodeError } = await supabase
        .from('products')
        .select('id, name, sku, price, wholesale_price, barcode')
        .eq('company_id', companyId)
        .ilike('barcode', code)
        .limit(1);

      if (barcodeError) {
        toast.error('Lookup failed', { description: barcodeError.message });
        return;
      }

      if (byBarcode && byBarcode.length > 0) {
        applyScannedProduct(byBarcode[0]);
        return;
      }

      setFormData((prev) => ({
        ...prev,
        isNewProduct: true,
        existingProductId: '',
        sku: code,
        productName: prev.productName || '',
      }));
      setScanHint(`New product — SKU/barcode set to ${code}`);
      toast.info('Product not in catalog', {
        description: 'Enter product details, then continue.',
      });
    },
    [applyScannedProduct, companyId, existingProducts],
  );

  usePhysicalBarcodeScanner(
    (barcode) => {
      if (isOpen) void handleBarcodeScan(barcode);
    },
    { minLength: 3 },
  );

  const generateSKU = () => {
    setFormData((prev) => ({ ...prev, sku: makeSku() }));
  };

  const ensureSku = (): string => {
    const current = formData.sku.trim();
    if (current) return current;
    const generated = makeSku();
    setFormData((prev) => (prev.sku.trim() ? prev : { ...prev, sku: generated }));
    return generated;
  };

  const validateStep1 = (): boolean => {
    if (!formData.isNewProduct) {
      if (!formData.existingProductId) {
        toast.error('Select a product', {
          description: 'Choose an existing product or switch to Add New.',
        });
        return false;
      }
      return true;
    }
    if (!formData.productName.trim()) {
      toast.error('Product name required');
      return false;
    }
    ensureSku();
    return true;
  };

  const validateStep2 = (): boolean => {
    const units = parseInt(formData.totalUnits, 10) || 0;
    if (units <= 0) {
      toast.error('Enter quantity', { description: 'Total units must be greater than 0.' });
      return false;
    }
    if (
      (formData.productType === 'retail' || formData.productType === 'both') &&
      !(parseFloat(formData.retailPricePerUnit) > 0)
    ) {
      toast.error('Retail price required');
      return false;
    }
    if (
      (formData.productType === 'wholesale' || formData.productType === 'both') &&
      !(parseFloat(formData.wholesalePricePerBox) > 0)
    ) {
      toast.error('Wholesale price required');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const resetAll = () => {
    setFormData({
      ...INITIAL_FORM,
      dateReceived: new Date().toISOString().split('T')[0],
      onlineListing: { ...EMPTY_ONLINE_LISTING },
    });
    setMediaFiles([]);
    setCoverKey(null);
    setScanHint(null);
    setStep(1);
    setQuantityMode('simple');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }

    setLoading(true);

    try {
      const {
        isNewProduct,
        existingProductId,
        productName,
        category,
        numberOfBoxes,
        quantityPerBox,
        totalUnits,
        wholesalePricePerBox,
        retailPricePerUnit,
        costPricePerUnit,
        costPricePerBox,
        supplierName,
        batchLotNumber,
        dateReceived,
        notes,
        warehouseLocation,
        minStockLevel,
      } = formData;

      const sku = formData.sku.trim() || makeSku();

      // Normalize box fields for simple mode
      const units = parseInt(totalUnits, 10) || 0;
      const boxes =
        quantityMode === 'simple' ? 1 : parseInt(numberOfBoxes, 10) || 1;
      const perBox =
        quantityMode === 'simple' ? units : parseInt(quantityPerBox, 10) || units;

      let productId = existingProductId;

      const online = formData.onlineListing;
      const marketplaceListing = online.isOnlineListing
        ? buildMarketplaceListingPayload({
            variations: online.variations,
            sizeGuide: online.sizeGuide,
            keyHighlights: online.keyHighlights,
            specifications: online.specifications,
            keyFeatures: online.keyFeatures,
            weightKg: online.weightKg,
            productDetails: online.productDetails,
          })
        : null;

      const onlineProductFields = online.isOnlineListing
        ? {
            is_online_listing: true,
            description: online.about.trim() || null,
            marketplace_listing: marketplaceListing,
          }
        : { is_online_listing: false, marketplace_listing: null };

      if (isNewProduct) {
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert([
            {
              company_id: companyId,
              name: productName,
              sku,
              barcode: sku,
              category: category.trim() || null,
              price: parseFloat(retailPricePerUnit) || 0,
              wholesale_price: wholesalePricePerBox
                ? parseFloat(wholesalePricePerBox)
                : null,
              low_stock_threshold: parseInt(minStockLevel, 10) || 10,
              created_at: new Date().toISOString(),
              ...onlineProductFields,
            },
          ])
          .select()
          .single();

        if (productError) throw productError;
        productId = newProduct.id;
      } else if (existingProductId) {
        const updates: Record<string, unknown> = { ...onlineProductFields };
        if (wholesalePricePerBox) {
          updates.wholesale_price = parseFloat(wholesalePricePerBox);
        }
        if (retailPricePerUnit) {
          updates.price = parseFloat(retailPricePerUnit);
        }
        await supabase.from('products').update(updates).eq('id', existingProductId);
      }

      if (!productId) throw new Error('No product ID available');

      if (mediaFiles.length > 0) {
        await uploadProductMediaFiles(
          mediaFiles.map((m) => m.file),
          companyId,
          productId,
          {
            coverKey,
            previews: mediaFiles.map((m) => ({
              previewUrl: m.previewUrl,
              file: m.file,
            })),
          },
        );
      }

      const { error: warehouseError } = await supabase
        .from('warehouse_inventory')
        .upsert(
          [
            {
              product_id: productId,
              company_id: companyId,
              quantity: units,
              min_stock_level: parseInt(minStockLevel, 10) || 10,
              supplier_name: supplierName || null,
              batch_lot_number: batchLotNumber || null,
              date_received: dateReceived,
              notes: notes || null,
              warehouse_location: warehouseLocation,
              cost_per_unit: costPricePerUnit ? parseFloat(costPricePerUnit) : null,
              cost_per_box: costPricePerBox ? parseFloat(costPricePerBox) : null,
              boxes_received: boxes,
              units_per_box: perBox,
            },
          ],
          { onConflict: 'product_id, company_id' },
        );

      if (warehouseError) throw warehouseError;

      const { error: priceHistoryError } = await supabase
        .from('price_history')
        .insert([
          {
            product_id: productId,
            company_id: companyId,
            old_price: 0,
            new_price: parseFloat(retailPricePerUnit) || 0,
            change_type: 'retail',
            changed_by: 'warehouse_admin',
            changed_at: new Date().toISOString(),
          },
        ]);

      if (priceHistoryError) {
        console.warn('Failed to create price history:', priceHistoryError);
      }

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([
          {
            company_id: companyId,
            title: 'New Product Added to Warehouse',
            message: `${productName} (${sku}) added to warehouse with ${units} units`,
            type: 'info',
            read: false,
          },
        ]);

      if (notificationError) {
        console.warn('Failed to create notification:', notificationError);
      }

      toast.success('Product Added Successfully', {
        description: `${productName} has been added to warehouse inventory`,
      });

      onSuccess();
      onClose();
      resetAll();
    } catch (error: unknown) {
      console.error('Error adding warehouse product:', error);
      toast.error('Failed to Add Product', {
        description:
          error instanceof Error ? error.message : 'An error occurred while adding the product',
      });
    } finally {
      setLoading(false);
    }
  };

  const productTypeOptions = [
    { value: 'retail', label: 'Retail Only' },
    { value: 'wholesale', label: 'Wholesale Only' },
    { value: 'both', label: 'Retail & Wholesale' },
  ];

  const warehouseLocationOptions = [
    { value: 'Main Warehouse', label: 'Main Warehouse' },
    { value: 'Storage Area A', label: 'Storage Area A' },
    { value: 'Storage Area B', label: 'Storage Area B' },
    { value: 'Cold Storage', label: 'Cold Storage' },
  ];

  const unitsPreview = parseInt(formData.totalUnits, 10) || 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Product to Warehouse" size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 3) void handleSubmit();
          else goNext();
        }}
        className="space-y-5"
      >
        {/* Step indicator */}
        <div className="flex items-center gap-1 sm:gap-2">
          {STEPS.map((s, idx) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <React.Fragment key={s.id}>
                {idx > 0 && (
                  <div
                    className={`h-px flex-1 ${done || active ? 'bg-primary/40' : 'bg-border'}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (s.id < step) setStep(s.id);
                    else if (s.id === step + 1) goNext();
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : done
                        ? 'bg-primary/15 text-primary'
                        : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      active || done ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {done ? <Check className="w-3 h-3" /> : s.id}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* STEP 1 — Identify */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-3 p-4 rounded-lg border border-indigo-200 bg-indigo-500/5">
              <div className="flex items-center space-x-2">
                <ScanLine className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-foreground">Scan Product</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Scan a barcode or SKU to load an existing product, or pre-fill SKU for a new one.
              </p>
              <BarcodeScannerInput
                onScan={(code) => void handleBarcodeScan(code)}
                placeholder="Click here, then scan barcode or type SKU..."
                autoFocus={isOpen && step === 1}
              />
              {scanHint && (
                <p className="text-sm text-indigo-700 font-medium">{scanHint}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-foreground">Product Information</h3>
              </div>

              <Select
                label="Product Selection"
                value={formData.isNewProduct ? 'new' : 'existing'}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    isNewProduct: value === 'new',
                    existingProductId: value === 'new' ? '' : prev.existingProductId,
                  }))
                }
                options={[
                  { value: 'new', label: 'Add New Product' },
                  { value: 'existing', label: 'Select Existing Product' },
                ]}
              />

              {!formData.isNewProduct && existingProducts.length > 0 ? (
                <div className="space-y-4">
                  <Select
                    label="Select Product"
                    value={formData.existingProductId}
                    onChange={handleExistingProductSelect}
                    options={[
                      { value: '', label: 'Choose a product...' },
                      ...existingProducts.map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.sku}) - ₵${p.price}`,
                      })),
                    ]}
                  />
                  {formData.existingProductId && (
                    <ProductMediaField
                      value={mediaFiles}
                      onChange={setMediaFiles}
                      coverKey={coverKey}
                      onCoverChange={setCoverKey}
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <ProductMediaField
                    value={mediaFiles}
                    onChange={setMediaFiles}
                    coverKey={coverKey}
                    onCoverChange={setCoverKey}
                  />
                  <Input
                    label="Product Name"
                    value={formData.productName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, productName: e.target.value }))
                    }
                    required
                    placeholder="Enter product name"
                  />
                  <Input
                    label="Category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, category: e.target.value }))
                    }
                    placeholder="e.g. Beverages, Electronics"
                  />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label="SKU Code"
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, sku: e.target.value }))
                        }
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={generateSKU}>
                      Generate
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 — Stock & price */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-foreground">Quantity</h3>
              </div>

              <Select
                label="Product Type"
                value={formData.productType}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    productType: value as FormData['productType'],
                  }))
                }
                options={productTypeOptions}
              />

              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuantityModeAndSync('simple')}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    quantityMode === 'simple'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Total units (simple)
                </button>
                <button
                  type="button"
                  onClick={() => setQuantityModeAndSync('boxes')}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    quantityMode === 'boxes'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  By boxes
                </button>
              </div>

              {quantityMode === 'simple' ? (
                <Input
                  label="Total Units"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.totalUnits}
                  onChange={(e) => setSimpleTotalUnits(e.target.value)}
                  required
                  placeholder="How many units are you adding?"
                  helperText="Fast path — skips boxes math"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Number of Boxes"
                    type="number"
                    value={formData.numberOfBoxes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, numberOfBoxes: e.target.value }))
                    }
                    required
                    min="1"
                    step="1"
                  />
                  <Input
                    label="Quantity per Box"
                    type="number"
                    value={formData.quantityPerBox}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, quantityPerBox: e.target.value }))
                    }
                    required
                    min="1"
                    step="1"
                  />
                  <Input
                    label="Total Units"
                    type="number"
                    value={formData.totalUnits}
                    readOnly
                    className="bg-secondary/60"
                    helperText="Auto-calculated"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Calculator className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-foreground">Pricing</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(formData.productType === 'retail' || formData.productType === 'both') && (
                  <div className="space-y-3 p-3 bg-blue-500/10 rounded-lg">
                    <h4 className="font-medium text-blue-800">Retail Pricing</h4>
                    <Input
                      label="Retail Price per Unit (₵)"
                      type="number"
                      step="0.01"
                      value={formData.retailPricePerUnit}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          retailPricePerUnit: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                )}
                {(formData.productType === 'wholesale' || formData.productType === 'both') && (
                  <div className="space-y-3 p-3 bg-emerald-500/10 rounded-lg">
                    <h4 className="font-medium text-green-800">Wholesale Pricing</h4>
                    <Input
                      label="Wholesale Price per Box (₵)"
                      type="number"
                      step="0.01"
                      value={formData.wholesalePricePerBox}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          wholesalePricePerBox: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-secondary/60">
                  <p className="text-xs text-muted-foreground">Units</p>
                  <p className="text-lg font-bold tabular-nums">{unitsPreview || '—'}</p>
                </div>
                {formData.totalRetailValue && (
                  <div className="p-3 rounded-lg bg-secondary/60">
                    <p className="text-xs text-muted-foreground">Retail value</p>
                    <p className="text-lg font-bold text-blue-700 tabular-nums">
                      ₵{formData.totalRetailValue}
                    </p>
                  </div>
                )}
                {formData.totalWholesaleValue && (
                  <div className="p-3 rounded-lg bg-secondary/60">
                    <p className="text-xs text-muted-foreground">Wholesale value</p>
                    <p className="text-lg font-bold text-green-700 tabular-nums">
                      ₵{formData.totalWholesaleValue}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Optional */}
        {step === 3 && (
          <div className="space-y-5">
            <OnlineListingFields
              value={formData.onlineListing}
              onChange={(onlineListing) =>
                setFormData((prev) => ({ ...prev, onlineListing }))
              }
            />

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Calculator className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Cost (optional)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Cost Price per Unit (₵)"
                  type="number"
                  step="0.01"
                  value={formData.costPricePerUnit}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, costPricePerUnit: e.target.value }))
                  }
                  placeholder="Optional"
                />
                <Input
                  label="Cost Price per Box (₵)"
                  type="number"
                  step="0.01"
                  value={formData.costPricePerBox}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, costPricePerBox: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              {formData.totalCostValue && (
                <div className="p-3 bg-secondary/60 rounded-lg inline-block">
                  <p className="text-xs text-muted-foreground">Total cost value</p>
                  <p className="text-lg font-bold tabular-nums">₵{formData.totalCostValue}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-foreground">Receiving details</h3>
              </div>

              <Select
                label="Warehouse Location"
                value={formData.warehouseLocation}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, warehouseLocation: value }))
                }
                options={warehouseLocationOptions}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Supplier Name"
                  value={formData.supplierName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, supplierName: e.target.value }))
                  }
                  placeholder="Enter supplier name"
                />
                <Input
                  label="Batch/Lot Number"
                  value={formData.batchLotNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, batchLotNumber: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Date Received"
                  type="date"
                  value={formData.dateReceived}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dateReceived: e.target.value }))
                  }
                />
                <Input
                  label="Minimum Stock Level"
                  type="number"
                  value={formData.minStockLevel}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, minStockLevel: e.target.value }))
                  }
                  min="1"
                  step="1"
                  helperText="Alert when stock goes below this level"
                />
              </div>

              <Input
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes or comments"
                multiline
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
          <div>
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={goBack} disabled={loading} className="gap-1">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
            )}
          </div>

          <div className="flex gap-2 ml-auto">
            {step === 2 && (
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => {
                  if (!validateStep2()) return;
                  void handleSubmit();
                }}
              >
                Skip optional & add
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={goNext} disabled={loading} className="gap-1">
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="submit" loading={loading} disabled={loading}>
                {loading ? 'Adding...' : 'Add to Warehouse'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};
