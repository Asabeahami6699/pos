// pages/SellPage.tsx
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  BarChart3,
  ClipboardList,
  HelpCircle,
  LayoutGrid,
  LogOut,
  Package,
  Phone,
  RotateCcw,
  ScanBarcode,
  ShoppingBag,
  Store,
} from 'lucide-react';

// Hooks
import { useUserAndBranch } from '../../hooks/posHooks/useUserAndBranch';
import { useCart } from '../../hooks/posHooks/useCart';
import { useProducts } from '../../hooks/posHooks/useProducts';
import { useSalesHistory } from '../../hooks/posHooks/useSalesHistory';
import { useRestockRequests } from '../../hooks/posHooks/useRestockRequests';
import { useReturns } from '../../hooks/posHooks/useReturns';
import { useRealtimeNotifications } from '../../hooks/posHooks/useRealtimeNotifications';

import { useOfflineSync } from '../../hooks/posHooks/useOfflineSync';
import { useCompanyPosSettings } from '../../hooks/posHooks/useCompanyPosSettings';
import { buildSupportTel } from '../../lib/supportContact';

// Services
import { saleOrchestrator } from '../../services/saleOrchestrator';
import { saleService } from '../../services/saleService';

// Components
import { Button } from '../../components/Button';
import { SearchBar } from '../../components/pos/SearchBar';
import { PosProductThumb } from '../../components/pos/PosProductThumb';
import { PaymentModal } from '../../components/pos/PaymentModal';
import { ReturnModal } from '../../components/pos/ReturnModal';
import { RestockRequestModal } from '../../components/pos/RestockRequestModal';
import { SaleDetailsModal } from '../../components/pos/SaleDetailsModal';
import { RealtimeNotificationBell } from '../../components/pos/RealtimeNotificationBell';
import { SalesTypeModal } from '../../components/pos/SalesTypeModal';
import { CartPanel } from '../../components/pos/CartPanel';
import { SalesHistory } from '../../components/pos/SalesHistory';
import { ReturnsTab } from '../../components/pos/ReturnsTab';
import { RestockTab } from '../../components/pos/RestockTab';
import { ReceiptModal } from '../../components/pos/ReceiptModal';
import { CustomerModal } from '../../components/pos/CustomerModal';
import { InvoiceDeliveryModal } from '../../components/pos/InvoiceDeliveryModal';
import { OfflineStatusBanner } from '../../components/pos/OfflineStatusBanner';
import { PosReportsPanel } from '../../components/pos/PosReportsPanel';
import { BarcodeScannerModal } from '../../components/BarcodeScannerModal';
import { ProductTour } from '../../components/onboarding/ProductTour';
import { useOnboardingTourStore } from '../../stores/onboardingTourStore';

// Types
import type { 
  ActiveTab, 
  Customer, 
  Payment, 
  HistoryFilters, 
  ReturnsFilters, 
  RestockFilters,
  Sale,
  Branch,
  RestockRequest
} from '../../types/index.ts';

// Utils
import { getTodayRange, getLast7DaysRange } from '../../utils/dateUtils';

const SellPage: React.FC = () => {
  const navigate = useNavigate();
  const receiptRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  
  // State
  const [salesType, setSalesType] = useState<'retail' | 'wholesale'>('retail');
  const [availableSalesTypes, setAvailableSalesTypes] = useState<('retail' | 'wholesale')[]>(['retail']);
  const [customer, setCustomer] = useState<Customer>({ name: '' });
  const [activeTab, setActiveTab] = useState<ActiveTab>('products');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  
  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSalesTypeModal, setShowSalesTypeModal] = useState(false);
  const [showRestockRequestModal, setShowRestockRequestModal] = useState(false);
  const [showSaleDetailsModal, setShowSaleDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedRestockRequest, setSelectedRestockRequest] = useState<RestockRequest | null>(null);
  const [showInvoiceDeliveryModal, setShowInvoiceDeliveryModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Filters
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    dateRange: getTodayRange(),
    status: 'all'
  });
  
  const [returnsFilters, setReturnsFilters] = useState<ReturnsFilters>({
    dateRange: getTodayRange(),
    status: 'all'
  });
  
  const [restockFilters, setRestockFilters] = useState<RestockFilters>({
    dateRange: getTodayRange(),
    status: 'all'
  });

  // Custom Hooks
  const {
    user,
    branches,
    selectedBranch,
    setSelectedBranch,
    loading: userLoading,
    error: userError
  } = useUserAndBranch();

  const tourHydrated = useOnboardingTourStore((s) => s.hydrated);
  const tourCompletedPos = useOnboardingTourStore((s) => s.completed.pos);
  const startTour = useOnboardingTourStore((s) => s.startTour);
  const resetAudience = useOnboardingTourStore((s) => s.resetAudience);

  useEffect(() => {
    if (!tourHydrated || tourCompletedPos || userLoading || !user) return;
    const timer = window.setTimeout(() => startTour('pos'), 800);
    return () => window.clearTimeout(timer);
  }, [tourHydrated, tourCompletedPos, startTour, userLoading, user]);

  const { settings: posSettings } = useCompanyPosSettings(
    user?.company_id || selectedBranch?.company_id,
  );

  // Only initialize hooks that depend on selectedBranch/user after they're loaded
  const {
    cart,
    cartTotalItems,
    discountPercentage,
    discountAmount,
    setDiscountPercentage,
    setDiscountAmount,
    taxRatePercent,
    discountsEnabled,
    addToCart,
    removeFromCart,
    updateQuantity,
    applyDiscount,
    clearCart,
    calculateSubtotal,
    calculateTotalDiscount,
    calculateTax,
    calculateTotal,
    calculateItemTotal,
    getProductPrice
  } = useCart(salesType, {
    taxRatePercent: posSettings.taxRatePercent,
    discountsEnabled: posSettings.discountsEnabled,
    maxDiscountPercent: posSettings.maxDiscountPercent,
  });

  const supportTel = buildSupportTel(posSettings.supportPhone);

  const {
    products,
    filteredProducts,
    searchQuery,
    setSearchQuery,
    loading: productsLoading,
    fetchProductsForBranch,
    getProductPrice: getProductPriceFromHook,
    refreshFromLocalCache,
    lookupByScanCode,
  } = useProducts(selectedBranch, salesType);

  const { online, pendingCount, syncing, refreshPendingCount, runSync } = useOfflineSync();

  const {
    sales,
    loading: salesLoading,
    fetchSalesHistory
  } = useSalesHistory(selectedBranch, historyFilters);

  // UPDATED: Now includes invoice functions
  const {
    restockRequests,
    loading: restockLoading,
    fetchRestockRequests,
    generateInvoice,
    downloadInvoicePDF,
    deliverInvoice,
    generatingInvoice
  } = useRestockRequests(selectedBranch, restockFilters);

  const {
    returns,
    loading: returnsLoading,
    fetchReturns
  } = useReturns(selectedBranch, returnsFilters);

  // Initialize real-time notifications
  const {
    notifications,
    connectionStatus,
    markNotificationAsSeen,
    markAllNotificationsAsSeen,
    clearAllNotifications,
    triggerRestockNotification
  } = useRealtimeNotifications({
    selectedBranch,
    userId: user?.id,
    onInvoiceUpdate: (invoiceNumber) => {
      setSelectedInvoice(invoiceNumber);
      toast.info('New Invoice Generated', {
        description: `Invoice ${invoiceNumber} is ready`,
        action: {
          label: 'View',
          onClick: () => {
            // Open invoice modal
            setSelectedInvoice(invoiceNumber);
          }
        }
      });
    },
    onRestockRequestUpdate: fetchRestockRequests
  });

  const canApprove = user?.role === 'admin' || user?.role === 'manager';
  const canDeliver = user?.role === 'admin' || user?.role === 'manager';

  const handleProductScan = useCallback(
    (code: string): boolean => {
      const trimmed = code.trim();
      if (!trimmed) return false;

      if (activeTab !== 'products') {
        setActiveTab('products');
      }

      const product = lookupByScanCode(trimmed);
      if (!product) {
        toast.error('Product not found', {
          description: `No SKU/barcode match for "${trimmed}"`,
        });
        return false;
      }

      const added = addToCart(product, { silent: true });
      if (!added) return false;

      toast.success('Added to sale', {
        description: product.name,
        duration: 1500,
      });
      setSearchQuery('');
      setSelectedCategory('all');
      window.setTimeout(() => productSearchRef.current?.focus(), 50);
      return true;
    },
    [activeTab, addToCart, lookupByScanCode, setSearchQuery],
  );

  // Effects
  useEffect(() => {
    if (selectedBranch) {
      updateAvailableSalesTypes(selectedBranch);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (activeTab === 'products' && selectedBranch) {
      productSearchRef.current?.focus();
    }
  }, [activeTab, selectedBranch]);

  // Handlers
  const handlePayment = async (payment: Payment) => {
    if (!selectedBranch || !user) return;
    
    setSubmitting(true);
    const toastId = toast.loading('Processing payment...');
    
    try {
      const sale = await saleOrchestrator.processSale({
        cart,
        total: calculateTotal(),
        customer,
        payment,
        salesType,
        user,
        selectedBranch
      });

      if (sale.pendingSync) {
        toast.success('Sale saved offline', {
          description: `Receipt #${sale.id.slice(-8)} — will sync when online`,
          id: toastId,
          duration: 4000,
        });
        await refreshPendingCount();
        await refreshFromLocalCache();
      } else {
        toast.success('Payment Successful!', {
          description: `Sale #${sale.id.slice(-8)} processed`,
          id: toastId,
          duration: 3000,
          action: {
            label: 'View Receipt',
            onClick: () => setShowReceipt(true),
          },
        });
        if (selectedBranch) {
          fetchProductsForBranch(selectedBranch.id);
        }
      }

      setShowPaymentModal(false);
      setShowReceipt(true);
      
    } catch (error: any) {
      console.error('Sale error:', error);
      toast.error('Payment Failed', {
        description: error.message || 'Sale processing failed',
        id: toastId
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForNextSale = () => {
    clearCart();
    setCustomer({ name: '' });
    setShowReceipt(false);
    if (selectedBranch) {
      if (online) {
        fetchProductsForBranch(selectedBranch.id);
        fetchSalesHistory();
      } else {
        void refreshFromLocalCache();
      }
    }
  };

  const handleReturn = async (saleId: string, items: any[], reason: string) => {
    if (!selectedBranch || !user) return;
    
    const toastId = toast.loading('Processing return...');
    
    try {
      const returnRecord = await saleService.processReturn({
        saleId,
        items,
        reason,
        user,
        selectedBranch
      });

      toast.success('Return Processed', {
        description: `Refund: $${returnRecord.total_refund.toFixed(2)} for ${items.length} items. Stock has been updated.`,
        id: toastId,
        action: { label: 'Done', onClick: () => {} }
      });

      setShowReturnModal(false);
      
      // Refresh all data
      await Promise.all([
        fetchReturns(),
        fetchProductsForBranch(selectedBranch.id),
        fetchSalesHistory()
      ]);

    } catch (error: any) {
      console.error('Return error:', error);
      toast.error('Return Failed', {
        description: error.message || 'Failed to process return',
        id: toastId
      });
    }
  };

  const updateAvailableSalesTypes = (branch: Branch) => {
    let types: ('retail' | 'wholesale')[] = ['retail'];
    if (branch.sales_type === 'wholesale') {
      types = ['wholesale'];
    } else if (branch.sales_type === 'both') {
      types = ['retail', 'wholesale'];
    }
    setAvailableSalesTypes(types);
    if (!types.includes(salesType)) {
      setSalesType(types[0]);
    }
  };

  // UPDATED: Handle deliver request with invoice
  const handleDeliverRequest = (request: RestockRequest) => {
    if (!request.invoice_number) {
      toast.error('Cannot Deliver', {
        description: 'Invoice must be generated before delivery'
      });
      return;
    }
    
    setSelectedRestockRequest(request);
    setSelectedInvoice(request.invoice_number);
    setShowInvoiceDeliveryModal(true);
  };

  // UPDATED: Handle invoice delivery
  const handleInvoiceDelivery = async (
    invoiceNumber: string,
    deliveredItems: Array<{
      product_id: string;
      quantity_delivered: number;
      notes?: string;
    }>
  ) => {
    if (!user?.id) {
      toast.error('User not found');
      return;
    }

    try {
      const result = await deliverInvoice(invoiceNumber, user.id, deliveredItems);
      
      if (result.success) {
        setShowInvoiceDeliveryModal(false);
        setSelectedRestockRequest(null);
        setSelectedInvoice(null);
        
        toast.success('Delivery Completed', {
          description: `${result.totalDelivered} items delivered successfully`
        });
      }
    } catch (error: any) {
      console.error('Delivery error:', error);
    }
  };

  const handleViewInvoice = (invoiceNumber: string) => {
    // You can implement a modal or page for viewing invoices
    toast.info('View Invoice', {
      description: `Opening invoice ${invoiceNumber}`,
      action: {
        label: 'Download',
        onClick: () => {
          downloadInvoicePDF?.(invoiceNumber);
        }
      }
    });
  };

  const getBranchSalesTypeLabel = (branch: Branch) => {
    switch(branch.sales_type) {
      case 'retail': return 'Retail Only';
      case 'wholesale': return 'Wholesale Only';
      case 'both': return 'Retail & Wholesale';
      default: return branch.sales_type;
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const displayedProducts = useMemo(() => {
    if (selectedCategory === 'all') return filteredProducts;
    return filteredProducts.filter(
      (p) => (p.category || '').trim().toLowerCase() === selectedCategory.toLowerCase(),
    );
  }, [filteredProducts, selectedCategory]);

  const pendingRestockCount = restockRequests.filter((req) => req.status === 'pending').length;
  const pendingReturnsCount = returns.filter((r) => r.status === 'pending').length;

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'history') {
      setHistoryFilters((prev) => ({ ...prev, dateRange: getTodayRange() }));
    } else if (tab === 'reports') {
      setHistoryFilters((prev) => ({ ...prev, dateRange: getLast7DaysRange() }));
    } else if (tab === 'returns') {
      setReturnsFilters((prev) => ({ ...prev, dateRange: getTodayRange() }));
    } else if (tab === 'restock') {
      setRestockFilters((prev) => ({ ...prev, dateRange: getTodayRange() }));
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error: unknown) {
      toast.error('Failed to logout', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'products', label: 'POS', icon: <LayoutGrid className="w-5 h-5" /> },
    { id: 'history', label: 'Sales', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'restock', label: 'Stock', icon: <Package className="w-5 h-5" />, badge: pendingRestockCount },
    { id: 'returns', label: 'Returns', icon: <RotateCcw className="w-5 h-5" />, badge: pendingReturnsCount },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  // Render Product Grid
  const renderProductGrid = () => {
    const isWholesale = salesType === 'wholesale';

    return (
      <div className="space-y-5" data-tour="pos-products">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`pos-category-chip whitespace-nowrap ${
              selectedCategory === 'all' ? 'pos-category-chip-active' : ''
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`pos-category-chip whitespace-nowrap ${
                selectedCategory === cat ? 'pos-category-chip-active' : ''
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onScanSubmit={handleProductScan}
            inputRef={productSearchRef}
            autoFocus={activeTab === 'products'}
            placeholder="Search for products by name, SKU or barcode…"
          />
          <button
            type="button"
            onClick={() => {
              const code = searchQuery.trim();
              if (code) {
                const added = handleProductScan(code);
                if (!added) setShowBarcodeScanner(true);
                return;
              }
              setShowBarcodeScanner(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-primary text-primary font-semibold text-sm hover:bg-primary/5 transition-colors shrink-0"
          >
            <ScanBarcode className="w-4 h-4" />
            Scan Barcode
          </button>
          <div
            className={`text-xs font-semibold px-3 py-2 rounded-full border shrink-0 self-start sm:self-auto ${
              isWholesale
                ? 'bg-blue-500/10 text-blue-800 border-blue-500/20'
                : 'bg-primary/10 text-primary border-primary/20'
            }`}
          >
            {isWholesale ? 'Wholesale' : 'Retail'}
            {availableSalesTypes.length > 1 && (
              <button
                type="button"
                onClick={() => setShowSalesTypeModal(true)}
                className="ml-1.5 underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                Change
              </button>
            )}
          </div>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={`skeleton-${i}`} className="bg-muted animate-pulse h-56 rounded-2xl" />
            ))}
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-border bg-card/50">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground">No products found</p>
            <p className="text-sm text-muted-foreground mt-1">Try another category or search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {displayedProducts.map((product) => {
              const price = getProductPriceFromHook(product);
              const inStock = !!(product.stock && product.stock > 0);
              const recentlyUpdated =
                product.last_updated &&
                new Date().getTime() - new Date(product.last_updated).getTime() < 30000;

              return (
                <div
                  key={`product-${product.id}`}
                  data-product-id={product.id}
                  className={`pos-product-card ${!inStock ? 'opacity-55' : ''} ${
                    recentlyUpdated ? 'ring-2 ring-emerald-400/60' : ''
                  } ${product.is_low_stock ? 'border-l-4 border-l-destructive' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                        inStock ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          inStock ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      {inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                    {product.is_low_stock && inStock && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                        Low
                      </span>
                    )}
                  </div>

                  <PosProductThumb imageUrl={product.image_url} name={product.name} size="lg" />

                  <h3 className="font-semibold text-foreground text-sm line-clamp-2 min-h-[2.5rem] mt-1">
                    {product.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground truncate mb-2">
                    {product.sku}
                    {product.barcode ? ` · ${product.barcode}` : ''}
                  </p>

                  <div className="flex items-end justify-between gap-2 mt-auto">
                    <div>
                      <div className="text-lg font-extrabold text-orange-500">
                        ₵{price.toFixed(2)}
                      </div>
                      {isWholesale && product.price !== price && (
                        <div className="text-[11px] text-muted-foreground line-through">
                          ₵{product.price.toFixed(2)}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {product.stock || 0} left
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={!inStock}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!productsLoading && displayedProducts.length > 0 && (
          <div className="pos-promo-banner">
            <div className="relative z-10 max-w-md">
              <p className="text-lg sm:text-xl font-extrabold text-white leading-tight">
                Big Deals. Great Savings!
              </p>
              <p className="text-sm text-white/85 mt-1">
                Sell more today — {displayedProducts.filter((p) => (p.stock || 0) > 0).length}{' '}
                products in stock at {selectedBranch?.name}.
              </p>
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="px-4 py-2 rounded-xl bg-white text-primary text-sm font-bold shadow-md hover:bg-white/95"
              >
                Shop Deals
              </button>
              <Store className="w-10 h-10 text-white/40 hidden sm:block" />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render loading
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-foreground">Loading POS System...</h2>
          <p className="text-muted-foreground mt-2">Setting up your assigned branch</p>
        </div>
      </div>
    );
  }

  // Render error
  if (userError || !selectedBranch) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell p-8">
        <div className="glass-card p-10 max-w-md text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">
            {userError ? 'Access Error' : 'No Branch Assigned'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {userError || 'Your account is not assigned to any branch. Please contact your administrator.'}
          </p>
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} className="w-full">
              Try Again
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => {
                supabase.auth.signOut();
                navigate('/login');
              }}
              className="w-full"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen page-shell overflow-hidden">
      {/* Dark icon sidebar */}
      <aside className="hidden md:flex w-[88px] shrink-0 flex-col items-center py-5 bg-[hsl(222_47%_11%)] text-white">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center font-extrabold text-sm shadow-lg mb-6">
          POS
        </div>

        <nav className="flex-1 flex flex-col items-center gap-1.5 w-full px-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => switchTab(item.id)}
                className={`relative w-full flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-2 w-full">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-2.5 text-center">
            <HelpCircle className="w-4 h-4 mx-auto text-white/60 mb-1" />
            <p className="text-[9px] font-semibold text-white/80">Need Help?</p>
            {supportTel ? (
              <a
                href={supportTel}
                className="inline-flex flex-col items-center justify-center gap-0.5 text-[9px] text-orange-300 mt-1 hover:text-orange-200"
              >
                <span className="inline-flex items-center gap-0.5">
                  <Phone className="w-2.5 h-2.5" />
                  Support
                </span>
                <span className="text-[8px] text-white/70 break-all px-0.5">
                  {posSettings.supportPhone}
                </span>
              </a>
            ) : (
              <p className="text-[8px] text-white/50 mt-1 leading-tight px-0.5">
                Ask admin to set support line in Settings
              </p>
            )}
            {posSettings.supportEmail ? (
              <a
                href={`mailto:${posSettings.supportEmail}`}
                className="block text-[8px] text-white/55 mt-1 truncate hover:text-white/80"
                title={posSettings.supportEmail}
              >
                {posSettings.supportEmail}
              </a>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <OfflineStatusBanner
          online={online}
          pendingCount={pendingCount}
          syncing={syncing}
          onSync={() => void runSync()}
        />

        {/* Top header */}
        <header className="bg-card border-b border-border px-4 sm:px-5 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight">
                <span className="text-foreground">Shop</span>
                <span className="text-primary">Zone</span>
              </span>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <div className="relative">
                <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <select
                  value={selectedBranch.id}
                  onChange={(e) => {
                    const branch = branches.find((b) => b.id === e.target.value);
                    if (branch) {
                      setSelectedBranch(branch);
                      updateAvailableSalesTypes(branch);
                    }
                  }}
                  className="appearance-none pl-9 pr-8 py-2 rounded-xl border border-border bg-secondary/60 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 max-w-[180px] truncate"
                  aria-label="Select branch"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="hidden lg:inline text-[11px] text-muted-foreground">
                {getBranchSalesTypeLabel(selectedBranch)}
              </span>
            </div>

            <div
              className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
                online
                  ? 'bg-emerald-500/10 text-emerald-700'
                  : 'bg-red-500/10 text-red-600'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              {online ? 'Online' : 'Offline'}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <RealtimeNotificationBell
              notifications={notifications}
              onMarkAllAsSeen={markAllNotificationsAsSeen}
              onClearAll={clearAllNotifications}
              onMarkAsSeen={markNotificationAsSeen}
              connectionStatus={connectionStatus}
            />

            <div className="hidden sm:flex items-center gap-2 pl-1">
              <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold">
                {(user?.full_name || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="leading-tight max-w-[120px]">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user?.full_name || 'Salesperson'}
                </p>
                <p className="text-[11px] text-muted-foreground capitalize truncate">
                  {user?.role || 'salesperson'}
                </p>
              </div>
            </div>

            <Button
              onClick={() => {
                resetAudience('pos');
                startTour('pos', { force: true });
              }}
              variant="ghost"
              size="sm"
              className="hidden lg:inline-flex"
            >
              Tour
            </Button>

            <Button
              onClick={() => void handleLogout()}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        {/* Mobile nav tabs */}
        <div className="md:hidden bg-card/80 border-b border-border px-2 overflow-x-auto">
          <div className="flex gap-1 min-w-max py-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={`m-${item.id}`}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={`relative px-3 py-2.5 text-xs font-semibold rounded-lg capitalize ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                  {item.badge && item.badge > 0 ? (
                    <span className="ml-1 inline-flex min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
              {activeTab === 'products' && renderProductGrid()}
              {activeTab === 'history' && (
                <SalesHistory
                  sales={sales}
                  loading={salesLoading}
                  onReturn={() => {
                    setShowReturnModal(true);
                  }}
                  onViewDetails={(sale) => {
                    setSelectedSale(sale);
                    setShowSaleDetailsModal(true);
                  }}
                  realtimeConnection={connectionStatus}
                  filters={historyFilters}
                  onFiltersChange={setHistoryFilters}
                />
              )}
              {activeTab === 'reports' && (
                <PosReportsPanel
                  sales={sales}
                  products={products}
                  loading={salesLoading}
                  filters={historyFilters}
                  onFiltersChange={setHistoryFilters}
                  salespersonId={user?.id}
                  branchName={selectedBranch?.name}
                  onRefresh={() => {
                    void fetchSalesHistory();
                  }}
                  onOpenSale={(sale) => {
                    setSelectedSale(sale);
                    setShowSaleDetailsModal(true);
                  }}
                  onViewSalesHistory={() => switchTab('history')}
                />
              )}
              {activeTab === 'returns' && (
                <ReturnsTab
                  returns={returns}
                  loading={returnsLoading}
                  onNewReturn={() => setShowReturnModal(true)}
                  onRefresh={fetchReturns}
                  realtimeConnection={connectionStatus}
                  filters={returnsFilters}
                  onFiltersChange={setReturnsFilters}
                />
              )}
              {activeTab === 'restock' && (
                <RestockTab
                  restockRequests={restockRequests}
                  products={products}
                  onNewRequest={() => setShowRestockRequestModal(true)}
                  realtimeConnection={connectionStatus}
                  filters={restockFilters}
                  onFiltersChange={setRestockFilters}
                  loading={restockLoading}
                  onDeliverRequest={handleDeliverRequest}
                  onViewInvoice={handleViewInvoice}
                  user={user}
                  generateInvoice={generateInvoice}
                  downloadInvoicePDF={downloadInvoicePDF}
                  generatingInvoice={generatingInvoice}
                />
              )}
            </div>
          </div>

          <div className="h-[40vh] lg:h-full shrink-0 border-t lg:border-t-0 border-border">
            <CartPanel
              cart={cart}
              salesType={salesType}
              customer={customer}
              discountPercentage={discountPercentage}
              discountAmount={discountAmount}
              setDiscountPercentage={setDiscountPercentage}
              setDiscountAmount={setDiscountAmount}
              setShowCustomerModal={setShowCustomerModal}
              setShowPaymentModal={setShowPaymentModal}
              removeFromCart={removeFromCart}
              updateQuantity={updateQuantity}
              applyDiscount={applyDiscount}
              clearCart={clearCart}
              calculateSubtotal={calculateSubtotal}
              calculateTotalDiscount={calculateTotalDiscount}
              calculateTax={calculateTax}
              calculateTotal={calculateTotal}
              calculateItemTotal={calculateItemTotal}
              submitting={submitting}
              taxRatePercent={taxRatePercent}
              discountsEnabled={discountsEnabled}
              quickDiscounts={posSettings.quickDiscounts}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        total={calculateTotal()}
        onPayment={handlePayment}
        submitting={submitting}
      />

      <ReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        recentSales={sales}
        onReturn={handleReturn}
        supabase={supabase}
        user={user}
        onSuccess={() => {
          fetchReturns();
          fetchProductsForBranch(selectedBranch?.id || '');
          fetchSalesHistory();
        }}
      />

      <RestockRequestModal
        isOpen={showRestockRequestModal}
        onClose={() => {
          setShowRestockRequestModal(false);
          fetchRestockRequests();
        }}
        branchId={selectedBranch?.id || ''}
        companyId={selectedBranch?.company_id || ''}
        userId={user?.id || ''}
        products={products}
      />

      <CustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        customer={customer}
        setCustomer={setCustomer}
      />

      <SalesTypeModal
        isOpen={showSalesTypeModal}
        onClose={() => setShowSalesTypeModal(false)}
        salesType={salesType}
        setSalesType={setSalesType}
        availableSalesTypes={availableSalesTypes}
        selectedBranch={selectedBranch}
      />

      <SaleDetailsModal
        sale={selectedSale}
        isOpen={showSaleDetailsModal}
        onClose={() => {
          setShowSaleDetailsModal(false);
          setSelectedSale(null);
        }}
        supabase={supabase}
      />

      {/* Invoice Delivery Modal */}
      {showInvoiceDeliveryModal && selectedInvoice && user?.id && (
        <InvoiceDeliveryModal
          isOpen={showInvoiceDeliveryModal}
          onClose={() => {
            setShowInvoiceDeliveryModal(false);
            setSelectedRestockRequest(null);
            setSelectedInvoice(null);
          }}
          invoiceNumber={selectedInvoice}
          requestId={selectedRestockRequest?.id || ''}
          userId={user.id}
          onSuccess={() => {
            // Refresh data after delivery
            fetchRestockRequests();
            fetchProductsForBranch(selectedBranch?.id || '');
          }}
        />
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <ReceiptModal
          cart={cart}
          total={calculateTotal()}
          customer={customer}
          salesType={salesType}
          branch={selectedBranch}
          salesperson={user}
          taxRatePercent={taxRatePercent}
          discountTotal={calculateTotalDiscount()}
          onClose={() => setShowReceipt(false)}
          onNewSale={resetForNextSale}
          onPrint={() => {
            const printButton = document.querySelector('[title="Print Receipt"]');
            if (printButton instanceof HTMLElement) {
              printButton.click();
            }
          }}
          onSave={() => {
            const downloadButton = document.querySelector('[title="Download as PDF"]');
            if (downloadButton instanceof HTMLElement) {
              downloadButton.click();
            }
          }}
        />
      )}

      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => {
          setShowBarcodeScanner(false);
          window.setTimeout(() => productSearchRef.current?.focus(), 50);
        }}
        onScan={handleProductScan}
        title="Scan product"
        description="Scan with a USB barcode scanner, use the camera, or type the SKU/barcode — matched products are added to the current sale."
      />

      <ProductTour
        onStepChange={() => {
          if (activeTab !== 'products') setActiveTab('products');
        }}
      />
    </div>
  );
};

export default SellPage;