import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AdjustableSidebar } from '../../components/admin/AdjustableSidebar';
import { api, type AdminOnlineOrder } from '../../lib/api';

// Import Tab Components
import { OverviewTab } from '../../components/admin/dashboard-tabs/OverviewTab';
import { InventoryTab } from '../../components/admin/dashboard-tabs/InventoryTab';
import { WarehouseTab } from '../../components/admin/dashboard-tabs/WarehouseTab';
import { BranchesTab } from '../../components/admin/dashboard-tabs/BranchesTab';
import { AdminRequestsTab as RequestsTab } from '../../components/admin/dashboard-tabs/AdminRequestsTab';
import { AlertsTab } from '../../components/admin/dashboard-tabs/AlertsTab';
import { StaffTab } from '../../components/admin/dashboard-tabs/StaffTab';
import { PriceHistoryTab } from '../../components/admin/dashboard-tabs/PriceHistoryTab';
import { NotificationsTab } from '../../components/admin/dashboard-tabs/NotificationsTab';
import { SettingsTab } from '../../components/admin/dashboard-tabs/SettingsTab';
import { UserGuideTab } from '../../components/admin/dashboard-tabs/UserGuideTab';
import { AnalyticsTab } from '../../components/admin/dashboard-tabs/AnalyticsTab';
import { OnlineOrdersTab } from '../../components/admin/dashboard-tabs/OnlineOrdersTab';
import { CustomerChatTab } from '../../components/admin/dashboard-tabs/CustomerChatTab';
import { AnalyticsRealtimeBridge } from '../../components/admin/AnalyticsRealtimeBridge';
import { TenantContextBanner } from '../../components/admin/TenantContextBanner';
import { EditStaffModal } from '../../components/admin/EditStaffModal';
import { ProductTour } from '../../components/onboarding/ProductTour';
import { useOnboardingTourStore } from '../../stores/onboardingTourStore';
import { useTenantContextStore } from '../../stores/tenantContextStore';

// Import Modal Components
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import { AlertTriangle } from 'lucide-react';
import { ProcessRestockModal } from '../../components/admin/ProcessRestockModal';
import BatchAllocationModal from '../../components/admin/BatchAllocationModal';
import { AddWarehouseProductModal } from '../../components/admin/AddWarehouseProductModal';
import { AddBranchStockModal } from '../../components/admin/AddBranchStockModal';
import { ProductMediaField, type MediaPreview, type ExistingMediaItem } from '../../components/admin/ProductMediaField';
import {
  fetchProductMedia,
  setProductCoverImage,
  uploadProductMediaFiles,
} from '../../lib/productMediaUpload';
import { InvoiceDeliveryModal } from '../../components/admin/InvoiceDeliveryModal';

// Import Custom Hooks
import { useCompanyAuth } from '../../hooks/useCompanyAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { SubscriptionBanner, SubscriptionLockScreen } from '../../components/admin/SubscriptionGate';
import useDashboardData from '../../hooks/useDashboardData';
import { useRealtimeSubscriptions } from '../../hooks/useRealtimeSubscriptions';
import { useInventoryManagement } from '../../hooks/useInventoryManagement';
import { useStaffManagement } from '../../hooks/useStaffManagement';
import { useNotifications } from '../../hooks/useNotifications';
import { usePriceHistory } from '../../hooks/usePriceHistory';
import { useAllocations } from '../../hooks/useAllocations';

// Import Types ONLY - use type-only imports
import type { Branch, Product } from '../../hooks/useDashboardData';
import type { StaffMember } from '../../hooks/useStaffManagement';
import type { RestockRequest, RequestFilter } from '../../hooks/useRestockRequests';
import { useAdminRestockRequests } from '../../hooks/useAdminRestockRequests';

// Import the new stock allocation hook
import { useStockAllocation } from '../../hooks/useStockAllocation';

type ActiveTab =
  | 'overview'
  | 'inventory'
  | 'online-orders'
  | 'customer-chat'
  | 'warehouse'
  | 'branches'
  | 'requests'
  | 'alerts'
  | 'staff'
  | 'price-history'
  | 'notifications'
  | 'analytics'
  | 'settings'
  | 'settings-profile'
  | 'settings-pos'
  | 'settings-payments'
  | 'settings-appearance'
  | 'guide';

const CompanyDashboard: React.FC = () => {
  const navigate = useNavigate();

  // =========== UI STATE ===========
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [activeFilter, setActiveFilter] = useState<RequestFilter>('all');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const tourHydrated = useOnboardingTourStore((s) => s.hydrated);
  const tourCompletedAdmin = useOnboardingTourStore((s) => s.completed.admin);
  const startTour = useOnboardingTourStore((s) => s.startTour);
  const resetAudience = useOnboardingTourStore((s) => s.resetAudience);

  // Modal States
  const [processingRequest, setProcessingRequest] = useState<RestockRequest | null>(null);
  const [isProcessRestockModalOpen, setIsProcessRestockModalOpen] = useState(false);
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isEditBranchModalOpen, setIsEditBranchModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isEditStaffModalOpen, setIsEditStaffModalOpen] = useState(false);
  const [isBatchAllocationModalOpen, setIsBatchAllocationModalOpen] = useState(false);
  const [isAddWarehouseProductModalOpen, setIsAddWarehouseProductModalOpen] = useState(false);
  const [isAddBranchStockModalOpen, setIsAddBranchStockModalOpen] = useState(false);

  // Invoice States
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [isInvoiceDeliveryModalOpen, setIsInvoiceDeliveryModalOpen] = useState(false);
  const [invoiceDeliveryRequest, setInvoiceDeliveryRequest] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  // Form States
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    price: '',
    wholesale_price: '',
    threshold: '5',
  });

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editMediaFiles, setEditMediaFiles] = useState<MediaPreview[]>([]);
  const [editExistingMedia, setEditExistingMedia] = useState<ExistingMediaItem[]>([]);
  const [editCoverKey, setEditCoverKey] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [newBranch, setNewBranch] = useState({
    name: '',
    sales_type: 'retail' as 'retail' | 'wholesale' | 'both',
  });

  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [newStaff, setNewStaff] = useState({
    fullName: '',
    email: '',
    password: '',
    branchId: '',
    sales_type: 'retail' as 'retail' | 'wholesale' | 'both',
    phone: '',
    address: '',
  });

  // =========== CUSTOM HOOKS ===========

  // 1. Authentication Hook
  const {
    companyId,
    userId,
    userName,
    userRole,
    inventoryModel,
    setInventoryModel,
    loading: authLoading,
    initialized,
    isActingAsTenant,
    handleLogout,
  } = useCompanyAuth();

  useEffect(() => {
    if (isActingAsTenant) return;
    if (!tourHydrated || tourCompletedAdmin || !initialized || authLoading) return;
    const timer = window.setTimeout(() => {
      startTour('admin', { inventoryModel });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    tourHydrated,
    tourCompletedAdmin,
    startTour,
    inventoryModel,
    initialized,
    authLoading,
    isActingAsTenant,
  ]);

  const { subscription, loading: subscriptionLoading } = useSubscription(Boolean(companyId && initialized));

  // 2. Dashboard Data Hook
  const {
    stats,
    products,
    branches,
    companyName,
    loading: dataLoading,
    initialized: dataInitialized,
    fetchStats,
    fetchProducts,
    fetchBranches,
    handleAddProduct,
    handleEditProduct,
    handleDeleteProduct,
    handleAddBranch,
    handleEditBranch,
    handleDeleteBranch,
    setInventoryModel: setDashboardInventoryModel,
    refreshData,
  } = useDashboardData(companyId);

  useEffect(() => {
    if (inventoryModel === 'branch_only' && activeTab === 'warehouse') {
      setActiveTab('overview');
    }
  }, [inventoryModel, activeTab]);

  // 3. Inventory Management Hook
  const {
    warehouseInventory,
    branchInventory,
    loading: inventoryLoading,
    fetchWarehouseInventory,
    fetchBranchInventory,
    handleAllocateStock,
    addBranchStock,
    createProductAndBranchStock,
    getProductStock,
    removeAllocatedStock,
  } = useInventoryManagement(companyId, userId, inventoryModel);

  // 4. Staff Management Hook
  const {
    staff,
    loading: staffLoading,
    fetchStaff,
    handleAddStaff,
    handleEditStaff,
    handleRemoveStaff,
    removingIds,
    setStaff,
  } = useStaffManagement(companyId);

  // 5. Restock Requests Hook
  const {
    restockRequests,
    loading: requestsLoading,
    fetchRestockRequests,
    updateRestockStatus,
    updateInvoiceNumber,
    filteredRequests,
  } = useAdminRestockRequests(companyId);

  // 6. Notifications Hook
  const {
    notifications,
    loading: notificationsLoading,
    fetchNotifications,
    handleMarkNotificationAsRead,
    handleMarkAllNotificationsAsRead,
  } = useNotifications(companyId);

  // 7. Price History Hook
  const {
    priceHistory,
    loading: priceHistoryLoading,
    fetchPriceHistory,
  } = usePriceHistory(companyId);

  // 8. Allocations Hook
  const {
    allocations,
    loading: allocationsLoading,
    fetchAllocations,
  } = useAllocations(companyId);

  // 9. Stock Allocation Hook
  const {
    stockAllocation,
    setStockAllocation,
    isStockAllocateModalOpen,
    setIsStockAllocateModalOpen,
    loading: allocationLoading,
    handleAllocateStockSubmit,
    openStockAllocationModal,
    closeStockAllocationModal,
  } = useStockAllocation({
    companyId,
    products,
    branches,
    warehouseInventory,
    branchInventory,
    handleAllocateStock,
    onSuccess: () => {
      if (companyId) {
        fetchWarehouseInventory();
        fetchBranchInventory();
        fetchStats();
        fetchProducts();
      }
    },
  });

  // =========== INITIALIZE USER ===========
  useEffect(() => {
    if (companyId && userName && userRole) {
      setUser({
        id: companyId,
        name: userName,
        role: userRole,
        email: '',
        branch_id: '',
      });
    }
  }, [companyId, userName, userRole]);

  // =========== REAL-TIME SUBSCRIPTIONS ===========
  const [pendingOnlineOrders, setPendingOnlineOrders] = useState<AdminOnlineOrder[]>([]);
  const pendingOnlineOrderCountRef = useRef(0);
  const onlineOrdersHydratedRef = useRef(false);

  const fetchPendingOnlineOrders = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.getAdminOnlineOrders('pending');
      const next = res.data ?? [];
      const prevCount = pendingOnlineOrderCountRef.current;
      if (onlineOrdersHydratedRef.current && next.length > prevCount) {
        const newest = next[0];
        toast.info('New online order', {
          description: newest
            ? `${newest.shipping_name || 'Customer'} · ₵${Number(newest.total ?? 0).toFixed(2)}`
            : 'A customer just placed an order',
          action: {
            label: 'Open',
            onClick: () => setActiveTab('online-orders'),
          },
        });
      }
      onlineOrdersHydratedRef.current = true;
      pendingOnlineOrderCountRef.current = next.length;
      setPendingOnlineOrders(next);
    } catch {
      /* non-blocking */
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId && dataInitialized) {
      void fetchPendingOnlineOrders();
    }
  }, [companyId, dataInitialized, fetchPendingOnlineOrders]);

  useRealtimeSubscriptions(
    companyId,
    {
      onProductsChange: () => companyId && fetchProducts(),
      onBranchesChange: () => companyId && fetchBranches(),
      onRestockRequestsChange: () => companyId && fetchRestockRequests(),
      onSalesChange: () => companyId && fetchStats(),
      onUsersChange: () => companyId && fetchStaff(),
      onBranchInventoryChange: () => {
        if (companyId) {
          fetchBranchInventory();
          fetchStats();
        }
      },
      onWarehouseInventoryChange: () => {
        if (companyId) {
          fetchWarehouseInventory();
          fetchStats();
        }
      },
      onNotificationsChange: () => companyId && fetchNotifications(),
      onPriceHistoryChange: () => companyId && fetchPriceHistory(),
      onAllocationsChange: () => companyId && fetchAllocations(),
      onOnlineOrdersChange: () => {
        void fetchPendingOnlineOrders();
      },
    },
    dataInitialized
  );

  // =========== INVOICE FUNCTIONS ===========

  const handleGenerateInvoice = async (requestId: string, userId: string) => {
    try {
      const toastId = toast.loading('Generating invoice...');

      const request = restockRequests.find((r) => r.id === requestId);
      if (!request) throw new Error('Request not found');

      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const invoiceNumber = `INV-${dateStr}-${randomNum}`;

      let totalAmount = 0;
      let totalQuantity = 0;

      if (request.items && Array.isArray(request.items) && request.items.length > 0) {
        request.items.forEach((item: any) => {
          if (item?.product_id && typeof item?.quantity === 'number') {
            const product = products.find((p) => p.id === item.product_id);
            if (product) {
              totalAmount += item.quantity * product.price;
              totalQuantity += item.quantity;
            }
          }
        });
      } else if (request.product_id) {
        const product = products.find((p) => p.id === request.product_id);
        if (product) {
          totalAmount = (request.requested_quantity || 0) * product.price;
          totalQuantity = request.requested_quantity || 0;
        }
      }

      const invoiceData = {
        invoice_number: invoiceNumber,
        request_id: requestId,
        branch_name:
          request.branch_name ||
          branches.find((b) => b.id === request.branch_id)?.name ||
          'Branch',
        salesperson_name: request.staff_name || request.users?.full_name || 'Salesperson',
        items: request.items || [
          {
            product_name: request.product_name || 'Product',
            sku: request.product_sku || 'N/A',
            quantity: request.requested_quantity || 0,
            unit_price: request.product_price || 0,
          },
        ],
        subtotal: totalAmount,
        tax: totalAmount * 0.12,
        total: totalAmount * 1.12,
        issue_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        notes: request.admin_notes || request.notes || '',
      };

      const result = await updateInvoiceNumber(requestId, invoiceNumber);
      if (!result.success) throw new Error(result.error || 'Failed to update invoice number');

      toast.success('Invoice Generated', {
        description: `Invoice ${invoiceNumber} created successfully`,
        id: toastId,
        action: {
          label: 'Download PDF',
          onClick: () => handleDownloadInvoice(invoiceData),
        },
      });

      return { success: true, invoiceNumber, invoiceData, canDownload: true };
    } catch (error: any) {
      console.error('Invoice generation error:', error);
      toast.error('Failed to generate invoice', {
        description: error.message || 'An error occurred',
      });
      return { success: false, error: error.message };
    }
  };

  const handleDownloadInvoice = async (invoiceData: any) => {
    try {
      const toastId = toast.loading('Generating PDF...');

      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setTextColor(59, 130, 246);
      doc.text('STOCKFLOW INVENTORY', 105, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text('RESTOCK DELIVERY INVOICE', 105, 30, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);

      doc.text(`Invoice #: ${invoiceData.invoice_number}`, 20, 50);
      doc.text(`Issue Date: ${new Date(invoiceData.issue_date).toLocaleDateString()}`, 20, 55);
      doc.text(`Due Date: ${new Date(invoiceData.due_date).toLocaleDateString()}`, 20, 60);
      doc.text(`Branch: ${invoiceData.branch_name}`, 150, 50, { align: 'right' });
      doc.text(`Salesperson: ${invoiceData.salesperson_name}`, 150, 55, { align: 'right' });

      doc.setDrawColor(200, 200, 200);
      doc.line(20, 65, 190, 65);

      const tableData = invoiceData.items.map((item: any, index: number) => [
        index + 1,
        item.product_name,
        item.sku,
        item.quantity.toString(),
        `₵${item.unit_price.toFixed(2)}`,
        `₵${(item.quantity * item.unit_price).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: 70,
        head: [['#', 'Product', 'SKU', 'Quantity', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 20, right: 20 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;

      doc.text('Subtotal:', 150, finalY);
      doc.text(`₵${invoiceData.subtotal.toFixed(2)}`, 180, finalY, { align: 'right' });
      doc.text('VAT (12%):', 150, finalY + 5);
      doc.text(`₵${invoiceData.tax.toFixed(2)}`, 180, finalY + 5, { align: 'right' });

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Total Amount:', 150, finalY + 15);
      doc.text(`₵${invoiceData.total.toFixed(2)}`, 180, finalY + 15, { align: 'right' });

      if (invoiceData.notes) {
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('Notes:', 20, finalY + 30);
        const splitNotes = doc.splitTextToSize(invoiceData.notes, 170);
        doc.text(splitNotes, 20, finalY + 35);
      }

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const footerY = doc.internal.pageSize.height - 20;
      doc.text(
        'This is an automatically generated invoice for restocking purposes.',
        105,
        footerY,
        { align: 'center' }
      );
      doc.text(
        'Goods must be verified upon receipt. Any discrepancies must be reported within 24 hours.',
        105,
        footerY + 5,
        { align: 'center' }
      );

      doc.save(`invoice-${invoiceData.invoice_number}.pdf`);

      toast.success('Invoice Downloaded', {
        description: `Invoice ${invoiceData.invoice_number} downloaded successfully`,
        id: toastId,
      });

      return true;
    } catch (error: any) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF', {
        description: error.message || 'An error occurred',
      });
      return false;
    }
  };

  const getInvoiceDetails = async (invoiceNumber: string) => {
    try {
      const request = restockRequests.find((r) => r.invoice_number === invoiceNumber);
      if (!request) return null;

      return {
        invoice_number: invoiceNumber,
        total_amount: (request.requested_quantity || 0) * (request.products?.price || 0),
        status: request.status === 'fulfilled' ? 'delivered' : 'generated',
        generated_at: request.approved_at || request.created_at,
        restock_requests: { branches: request.branches, users: request.users },
        restock_invoice_items: [
          {
            products: request.products,
            quantity_requested: request.requested_quantity,
            quantity_delivered: request.fulfilled_quantity || 0,
            unit_price: request.products?.price || 0,
            total_price:
              (request.requested_quantity || 0) * (request.products?.price || 0),
          },
        ],
      };
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      return null;
    }
  };

  // =========== OTHER HANDLERS ===========

  const handleRefreshWarehouseData = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        fetchWarehouseInventory(),
        fetchProducts(),
        fetchBranchInventory(),
        fetchStats(),
      ]);
      toast.success('Warehouse data refreshed');
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleFullRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([refreshData(), fetchPendingOnlineOrders()]);
      toast.success('Dashboard data refreshed');
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await handleAddProduct(newProduct);
    if (success) {
      setNewProduct({ name: '', sku: '', price: '', wholesale_price: '', threshold: '5' });
      toast.success('Product Added');
    }
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      const success = await handleEditProduct(editingProduct, userId);
      if (success && companyId) {
        if (editMediaFiles.length > 0) {
          try {
            await uploadProductMediaFiles(
              editMediaFiles.map((m) => m.file),
              companyId,
              editingProduct.id,
              {
                coverKey: editCoverKey,
                previews: editMediaFiles.map((m) => ({ previewUrl: m.previewUrl, file: m.file })),
              },
            );
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to upload media');
          }
        }
        if (editCoverKey?.startsWith('http')) {
          try {
            await setProductCoverImage(companyId, editingProduct.id, editCoverKey);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to set cover image');
          }
        }
      }
      if (success) {
        setIsEditProductModalOpen(false);
        setEditingProduct(null);
        setEditMediaFiles([]);
        setEditExistingMedia([]);
        setEditCoverKey(null);
      }
    }
  };

  useEffect(() => {
    if (!editingProduct?.id) {
      setEditExistingMedia([]);
      setEditCoverKey(null);
      return;
    }

    setEditCoverKey(editingProduct.image_url ?? null);

    fetchProductMedia(editingProduct.id).then((media) => {
      let items: ExistingMediaItem[] = media;
      if (
        editingProduct.image_url &&
        !media.some((m) => m.url === editingProduct.image_url)
      ) {
        items = [{ url: editingProduct.image_url, media_type: 'image' }, ...media];
      }
      setEditExistingMedia(items);
      setEditCoverKey(
        editingProduct.image_url ??
          items.find((m) => m.media_type === 'image')?.url ??
          null,
      );
    });
  }, [editingProduct?.id, editingProduct?.image_url]);

  const handleAddBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await handleAddBranch(newBranch);
    if (success) {
      setNewBranch({ name: '', sales_type: 'retail' });
      setIsBranchModalOpen(false);
    }
  };

  const handleEditBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBranch) {
      const success = await handleEditBranch(editingBranch);
      if (success) {
        setIsEditBranchModalOpen(false);
        setEditingBranch(null);
      }
    }
  };

  const handleDeleteBranchWrapper = async (branchId: string) => {
    return handleDeleteBranch(branchId, branches);
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await handleAddStaff(newStaff, branches);
    if (success) {
      setNewStaff({
        fullName: '',
        email: '',
        password: '',
        branchId: '',
        sales_type: 'retail',
        phone: '',
        address: '',
      });
      setIsStaffModalOpen(false);
    }
  };

  // ✅ Kept clean — EditStaffModal handles its own field rendering & branch-driven sales_type
  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStaff) {
      const success = await handleEditStaff(editingStaff, branches);
      if (success) {
        setIsEditStaffModalOpen(false);
        setEditingStaff(null);
      }
    }
  };

  const handleUpdateRestockStatusWrapper = async (requestId: string, status: string) => {
    return updateRestockStatus(requestId, status, restockRequests);
  };

  const getSalesTypeLabel = (type: 'retail' | 'wholesale' | 'both') => {
    switch (type) {
      case 'retail':   return 'Retail Only';
      case 'wholesale': return 'Wholesale Only';
      case 'both':     return 'Retail & Wholesale';
      default:         return type;
    }
  };

  // Combined loading states
  const loading =
    authLoading ||
    dataLoading ||
    inventoryLoading ||
    requestsLoading ||
    notificationsLoading ||
    priceHistoryLoading ||
    allocationsLoading ||
    allocationLoading;

  const showInitialLoading = authLoading || !initialized || subscriptionLoading || (companyId && !dataInitialized);
  const filteredRestockRequests = filteredRequests ? filteredRequests(activeFilter) : restockRequests;

  const lowStockProducts = products
    .map((product) => {
      const stock = getProductStock(product.id).total;
      return { ...product, stock, isLowStock: stock <= product.low_stock_threshold };
    })
    .filter((product) => product.isLowStock);

  // =========== LOADING / ERROR STATES ===========

  if (showInitialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center page-shell">
        <div className="text-center glass-card p-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-foreground">Loading dashboard...</p>
          <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (!companyId && initialized) {
    const isSuperAdmin = userRole === 'super_admin';
    return (
      <div className="flex min-h-screen items-center justify-center page-shell">
        <div className="text-center glass-card p-10 max-w-md">
          <div className="text-destructive text-xl mb-4">
            {isSuperAdmin ? 'No tenant selected' : 'No Company Found'}
          </div>
          <p className="text-muted-foreground mb-4">
            {isSuperAdmin
              ? 'Open a company from the Super Admin dashboard with Enter tenant.'
              : 'You are not associated with any company.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {isSuperAdmin && (
              <Button
                onClick={() => {
                  useTenantContextStore.getState().exitTenant();
                  navigate('/super-admin/dashboard');
                }}
              >
                Back to Super Admin
              </Button>
            )}
            <Button variant="secondary" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (subscription?.access === 'locked') {
    return <SubscriptionLockScreen subscription={subscription} onLogout={handleLogout} />;
  }

  // =========== MAIN RENDER ===========

  return (
    <div className="flex h-screen overflow-hidden page-shell flex-col">
      {isActingAsTenant && <TenantContextBanner />}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {companyId && <AnalyticsRealtimeBridge companyId={companyId} />}
      <AdjustableSidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as ActiveTab)}
        onLogout={handleLogout}
        companyName={companyName}
        notificationCount={notifications.filter((n) => !n.read).length}
        onlineOrderCount={pendingOnlineOrders.length}
        userName={userName}
        userRole={isActingAsTenant ? 'super_admin (tenant)' : userRole}
        inventoryModel={inventoryModel}
        onRefresh={handleFullRefresh}
        refreshing={refreshing}
      />

      <div className="flex-1 min-w-0 overflow-y-auto p-4 pt-16 md:pt-6 md:p-6 safe-area-pb">
        <main className="max-w-6xl mx-auto w-full min-w-0">
          {subscription && <SubscriptionBanner subscription={subscription} />}

          {activeTab === 'overview' && (
            <OverviewTab
              companyName={companyName}
              companyId={companyId}
              subscription={subscription}
              inventoryModel={inventoryModel}
              stats={stats}
              branchCount={branches.length}
              staffCount={staff.length}
              restockRequests={restockRequests}
              pendingOnlineOrders={pendingOnlineOrders}
              setProcessingRequest={setProcessingRequest}
              setIsProcessRestockModalOpen={setIsProcessRestockModalOpen}
              setIsAddWarehouseProductModalOpen={setIsAddWarehouseProductModalOpen}
              setIsBatchAllocationModalOpen={setIsBatchAllocationModalOpen}
              setIsAddBranchStockModalOpen={setIsAddBranchStockModalOpen}
              setIsStaffModalOpen={setIsStaffModalOpen}
              setIsBranchModalOpen={setIsBranchModalOpen}
              setActiveTab={setActiveTab}
              onReplayTour={() => {
                resetAudience('admin');
                startTour('admin', { inventoryModel, force: true });
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryTab
              products={products}
              branches={branches}
              branchInventory={branchInventory}
              warehouseInventory={warehouseInventory}
              loading={loading}
              selectedBranchFilter={selectedBranchFilter}
              setSelectedBranchFilter={setSelectedBranchFilter}
              setIsStockAllocateModalOpen={setIsStockAllocateModalOpen}
              setIsAddWarehouseProductModalOpen={setIsAddWarehouseProductModalOpen}
              setIsAddBranchStockModalOpen={setIsAddBranchStockModalOpen}
              setStockAllocation={setStockAllocation}
              handleDeleteProduct={handleDeleteProduct}
              setEditingProduct={setEditingProduct}
              setIsEditProductModalOpen={setIsEditProductModalOpen}
              toast={toast}
              getProductStock={getProductStock}
              getSalesTypeLabel={getSalesTypeLabel}
              refreshing={refreshing}
              onRefresh={handleFullRefresh}
              removeAllocatedStock={removeAllocatedStock}
              companyId={companyId}
              onOpenOnlineOrders={() => setActiveTab('online-orders')}
              inventoryModel={inventoryModel}
            />
          )}

          {activeTab === 'online-orders' && (
            <OnlineOrdersTab companyId={companyId} />
          )}

          {activeTab === 'customer-chat' && companyId && (
            <CustomerChatTab companyId={companyId} />
          )}

          {activeTab === 'warehouse' && (
            <WarehouseTab
              warehouseInventory={warehouseInventory}
              products={products}
              loading={loading}
              selectedBranchFilter={selectedBranchFilter}
              setSelectedBranchFilter={setSelectedBranchFilter}
              setIsBatchAllocationModalOpen={setIsBatchAllocationModalOpen}
              setIsAddWarehouseProductModalOpen={setIsAddWarehouseProductModalOpen}
              setIsStockAllocateModalOpen={setIsStockAllocateModalOpen}
              setStockAllocation={setStockAllocation}
              setEditingProduct={setEditingProduct}
              setIsEditProductModalOpen={setIsEditProductModalOpen}
              branches={branches}
              toast={toast}
              stats={stats}
              onRefresh={handleRefreshWarehouseData}
              refreshing={refreshing}
            />
          )}

          {activeTab === 'branches' && (
            <BranchesTab
              branches={branches}
              loading={loading}
              setIsBranchModalOpen={setIsBranchModalOpen}
              handleDeleteBranch={handleDeleteBranchWrapper}
              setEditingBranch={setEditingBranch}
              setIsEditBranchModalOpen={setIsEditBranchModalOpen}
              getSalesTypeLabel={getSalesTypeLabel}
              refreshing={refreshing}
            />
          )}

          {activeTab === 'requests' && user && (
            <RequestsTab
              restockRequests={restockRequests}
              loading={requestsLoading}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              handleUpdateRestockStatus={handleUpdateRestockStatusWrapper}
              setProcessingRequest={setProcessingRequest}
              setIsProcessRestockModalOpen={setIsProcessRestockModalOpen}
              generateInvoice={handleGenerateInvoice}
              downloadInvoice={handleDownloadInvoice}
              currentUser={user}
              setSelectedInvoice={setSelectedInvoice}
              setIsDeliveryModalOpen={(open: boolean, request?: any) => {
                if (open && request) {
                  setInvoiceDeliveryRequest(request);
                  setIsInvoiceDeliveryModalOpen(true);
                } else {
                  setIsInvoiceDeliveryModalOpen(false);
                }
              }}
              fetchRestockRequests={fetchRestockRequests}
              getInvoiceDetails={getInvoiceDetails}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsTab
              lowStockProducts={lowStockProducts}
              getProductStock={getProductStock}
              loading={loading}
              branches={branches}
              setStockAllocation={setStockAllocation}
              setIsStockAllocateModalOpen={setIsStockAllocateModalOpen}
              toast={toast}
            />
          )}

          {activeTab === 'staff' && (
            <StaffTab
              staff={staff}
              loading={staffLoading}
              branches={branches}
              setIsStaffModalOpen={setIsStaffModalOpen}
              setEditingStaff={setEditingStaff}
              setIsEditStaffModalOpen={setIsEditStaffModalOpen}
              toast={toast}
              companyId={companyId || ''}
              fetchStaff={() => companyId && fetchStaff()}
              getSalesTypeLabel={getSalesTypeLabel}
              handleRemoveStaff={handleRemoveStaff}
              removingIds={removingIds}
            />
          )}

          {activeTab === 'price-history' && (
            <PriceHistoryTab priceHistory={priceHistory} loading={loading} />
          )}

          {activeTab === 'analytics' && companyId && (
            <AnalyticsTab companyId={companyId} />
          )}

          {activeTab === 'notifications' && (
            <NotificationsTab
              notifications={notifications}
              loading={loading}
              handleMarkNotificationAsRead={handleMarkNotificationAsRead}
              handleMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
            />
          )}

          {(activeTab === 'settings' ||
            activeTab === 'settings-profile' ||
            activeTab === 'settings-pos' ||
            activeTab === 'settings-payments' ||
            activeTab === 'settings-appearance') && (
            <SettingsTab
              companyId={companyId}
              section={
                activeTab === 'settings' ? 'settings-profile' : activeTab
              }
              onOpenGuide={() => setActiveTab('guide')}
              onReplayTour={() => {
                resetAudience('admin');
                startTour('admin', { inventoryModel, force: true });
              }}
              onInventoryModelChange={(model) => {
                setInventoryModel(model);
                setDashboardInventoryModel(model);
                void refreshData();
              }}
            />
          )}

          {activeTab === 'guide' && (
            <UserGuideTab
              onNavigateToTab={(tab) => setActiveTab(tab as ActiveTab)}
              onStartTour={() => {
                resetAudience('admin');
                startTour('admin', { inventoryModel, force: true });
              }}
            />
          )}
        </main>
      </div>
      </div>

      <ProductTour
        onStepChange={({ tabId }) => {
          if (tabId && tabId !== activeTab) {
            setActiveTab(tabId as ActiveTab);
          }
        }}
      />

      {/* =========== MODALS =========== */}

      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditProductModalOpen}
        onClose={() => setIsEditProductModalOpen(false)}
        title="Edit Product Information"
      >
        {editingProduct && (
          <form onSubmit={handleEditProductSubmit} className="space-y-6">
            <ProductMediaField
              value={editMediaFiles}
              onChange={setEditMediaFiles}
              existingUrls={editExistingMedia}
              coverKey={editCoverKey}
              onCoverChange={setEditCoverKey}
            />
            <Input
              label="Product Name"
              value={editingProduct.name}
              onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
              required
            />
            <Input
              label="Category"
              value={editingProduct.category ?? ''}
              onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
              placeholder="e.g. Beverages"
            />
            <Input
              label="SKU/Barcode"
              value={editingProduct.sku || ''}
              onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
              placeholder="PROD-001"
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Retail Price (₵)"
                type="number"
                step="0.01"
                value={editingProduct.price}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })
                }
                required
              />
              <Input
                label="Wholesale Price (₵)"
                type="number"
                step="0.01"
                value={editingProduct.wholesale_price || ''}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    wholesale_price: parseFloat(e.target.value),
                  })
                }
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Low Stock Threshold"
                type="number"
                value={editingProduct.low_stock_threshold}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    low_stock_threshold: parseInt(e.target.value),
                  })
                }
                required
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditProductModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Update Product</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Branch Modal */}
      <Modal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        title="Create New Branch"
      >
        <form onSubmit={handleAddBranchSubmit} className="space-y-6">
          <Input
            label="Branch Name"
            value={newBranch.name}
            onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
            required
            placeholder="Enter branch name"
          />
          <Select
            label="Sales Type"
            value={newBranch.sales_type}
            onChange={(value) =>
              setNewBranch({ ...newBranch, sales_type: value as 'retail' | 'wholesale' | 'both' })
            }
            options={[
              { value: 'retail', label: 'Retail Only' },
              { value: 'wholesale', label: 'Wholesale Only' },
              { value: 'both', label: 'Retail & Wholesale' },
            ]}
            required
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsBranchModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create Branch</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Branch Modal */}
      <Modal
        isOpen={isEditBranchModalOpen}
        onClose={() => setIsEditBranchModalOpen(false)}
        title="Edit Branch"
      >
        {editingBranch && (
          <form onSubmit={handleEditBranchSubmit} className="space-y-6">
            <Input
              label="Branch Name"
              value={editingBranch.name}
              onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
              required
            />
            <Select
              label="Sales Type"
              value={editingBranch.sales_type}
              onChange={(value) =>
                setEditingBranch({
                  ...editingBranch,
                  sales_type: value as 'retail' | 'wholesale' | 'both',
                })
              }
              options={[
                { value: 'retail', label: 'Retail Only' },
                { value: 'wholesale', label: 'Wholesale Only' },
                { value: 'both', label: 'Retail & Wholesale' },
              ]}
              required
            />
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditBranchModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Update Branch</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        title="Create Salesperson"
      >
        <form onSubmit={handleAddStaffSubmit} className="space-y-6">
          <Input
            label="Full Name"
            value={newStaff.fullName}
            onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
            required
          />
          <Input
            label="Email Address"
            type="email"
            value={newStaff.email}
            onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={newStaff.password}
            onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
            required
            minLength={6}
          />
          <Input
            label="Phone Number"
            value={newStaff.phone}
            onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
            placeholder="Optional"
          />
          <Input
            label="Address"
            value={newStaff.address}
            onChange={(e) => setNewStaff({ ...newStaff, address: e.target.value })}
            placeholder="Optional"
          />
          <Select
            label="Default Sales Type"
            value={newStaff.sales_type}
            onChange={(value) =>
              setNewStaff({ ...newStaff, sales_type: value as 'retail' | 'wholesale' | 'both' })
            }
            options={[
              { value: 'retail', label: 'Retail' },
              { value: 'wholesale', label: 'Wholesale' },
              { value: 'both', label: 'Both' },
            ]}
            required
          />
          <Select
            label="Assign to Branch"
            value={newStaff.branchId}
            onChange={(val) => setNewStaff({ ...newStaff, branchId: val })}
            options={[
              { value: '', label: 'Select a branch...' },
              ...branches.map((b) => ({
                value: b.id,
                label: `${b.name} (${getSalesTypeLabel(b.sales_type)})`,
              })),
            ]}
            required
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsStaffModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={staffLoading}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* ✅ Edit Staff Modal — replaced inline form with the dedicated EditStaffModal component */}
      <EditStaffModal
        isOpen={isEditStaffModalOpen}
        editingStaff={editingStaff}
        setEditingStaff={setEditingStaff}
        branches={branches}
        onSubmit={handleEditStaffSubmit}
        onClose={() => setIsEditStaffModalOpen(false)}
        getSalesTypeLabel={getSalesTypeLabel}
      />

      {/* Stock Allocation Modal */}
      <Modal
        isOpen={isStockAllocateModalOpen}
        onClose={closeStockAllocationModal}
        title="Allocate Stock from Warehouse to Branch"
        size="lg"
      >
        <form onSubmit={handleAllocateStockSubmit} className="space-y-6">
          <Select
            label="Product from Warehouse"
            value={stockAllocation.productId}
            onChange={(val) => {
              const product = products.find((p) => p.id === val);
              setStockAllocation((prev) => ({ ...prev, productId: val }));
              const warehouseItem = warehouseInventory.find((w) => w.product_id === val);
              if (warehouseItem) {
                const warehouseStock = warehouseItem.quantity || 0;
                if (product) {
                  setStockAllocation((prev) => ({
                    ...prev,
                    lowStockThreshold: product.low_stock_threshold?.toString() || '5',
                  }));
                }
                toast.info('Warehouse Stock Available', {
                  description: `${product?.name}: ${warehouseStock} units available`,
                  duration: 3000,
                });
              }
            }}
            options={[
              { value: '', label: 'Select a product...' },
              ...products.map((p) => {
                const warehouseItem = warehouseInventory.find((w) => w.product_id === p.id);
                const available = warehouseItem?.quantity || 0;
                const currentBranchItem =
                  selectedBranchFilter !== 'all'
                    ? branchInventory.find(
                        (item) =>
                          item.branch_id === selectedBranchFilter && item.product_id === p.id
                      )
                    : null;
                const currentStock = currentBranchItem
                  ? (currentBranchItem.retail_quantity || 0) +
                    (currentBranchItem.wholesale_quantity || 0)
                  : 0;
                return {
                  value: p.id,
                  label: `${p.name} (${p.sku || 'N/A'}) - Available: ${available}, Current: ${currentStock}`,
                };
              }),
            ]}
            required
          />

          <Select
            label="Destination Branch"
            value={stockAllocation.branchId}
            onChange={(val) => {
              setStockAllocation({ ...stockAllocation, branchId: val });
              if (stockAllocation.productId && val) {
                const existingItem = branchInventory.find(
                  (item) =>
                    item.branch_id === val && item.product_id === stockAllocation.productId
                );
                if (existingItem && existingItem.low_stock_threshold) {
                  setStockAllocation((prev) => ({
                    ...prev,
                    lowStockThreshold: existingItem.low_stock_threshold?.toString() || '5',
                  }));
                }
              }
            }}
            options={[
              { value: '', label: 'Select a branch...' },
              ...branches.map((b) => ({
                value: b.id,
                label: `${b.name} (${getSalesTypeLabel(b.sales_type)})`,
              })),
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity to Allocate"
              type="number"
              value={stockAllocation.quantity}
              onChange={(e) => {
                const qty = parseInt(e.target.value) || 0;
                if (stockAllocation.productId) {
                  const warehouseItem = warehouseInventory.find(
                    (w) => w.product_id === stockAllocation.productId
                  );
                  const available = warehouseItem?.quantity || 0;
                  if (qty > available) {
                    toast.warning('Insufficient Stock', {
                      description: `Only ${available} units available in warehouse`,
                    });
                  }
                }
                setStockAllocation({ ...stockAllocation, quantity: e.target.value });
              }}
              required
              min="1"
            />
            <Input
              label="Low Stock Threshold"
              type="number"
              value={stockAllocation.lowStockThreshold || ''}
              onChange={(e) =>
                setStockAllocation({ ...stockAllocation, lowStockThreshold: e.target.value })
              }
              required
              min="1"
              placeholder="Set threshold for low stock alert"
            />
          </div>

          {stockAllocation.productId && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Warehouse Available</p>
                <p className="text-lg font-bold text-blue-700">
                  {warehouseInventory.find((w) => w.product_id === stockAllocation.productId)
                    ?.quantity || 0}{' '}
                  units
                </p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Current Branch Stock</p>
                <p className="text-lg font-bold text-orange-700">
                  {selectedBranchFilter !== 'all' && stockAllocation.productId
                    ? (branchInventory.find(
                        (item) =>
                          item.branch_id === selectedBranchFilter &&
                          item.product_id === stockAllocation.productId
                      )?.retail_quantity || 0) +
                      (branchInventory.find(
                        (item) =>
                          item.branch_id === selectedBranchFilter &&
                          item.product_id === stockAllocation.productId
                      )?.wholesale_quantity || 0)
                    : getProductStock(stockAllocation.productId).total}{' '}
                  units
                </p>
              </div>
            </div>
          )}

          {stockAllocation.productId && stockAllocation.branchId && stockAllocation.quantity && (
            <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <h4 className="font-medium text-green-800 mb-2">Allocation Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">From:</span>
                  <span className="ml-2 font-medium">Warehouse</span>
                </div>
                <div>
                  <span className="text-muted-foreground">To:</span>
                  <span className="ml-2 font-medium">
                    {branches.find((b) => b.id === stockAllocation.branchId)?.name}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Product:</span>
                  <span className="ml-2 font-medium">
                    {products.find((p) => p.id === stockAllocation.productId)?.name}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="ml-2 font-medium">{stockAllocation.quantity} units</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sales Type:</span>
                  <span className="ml-2 font-medium">
                    {getSalesTypeLabel(
                      branches.find((b) => b.id === stockAllocation.branchId)?.sales_type ||
                        'retail'
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Low Stock Alert:</span>
                  <span className="ml-2 font-medium">
                    Below {stockAllocation.lowStockThreshold} units
                  </span>
                </div>

                {stockAllocation.lowStockThreshold &&
                  parseInt(stockAllocation.quantity) <
                    parseInt(stockAllocation.lowStockThreshold) && (
                    <div className="col-span-2 mt-2 p-2 bg-amber-500/100/10 border border-amber-500/20 rounded">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-yellow-700 font-medium">
                          Warning: Allocation quantity ({stockAllocation.quantity}) is below the
                          low stock threshold ({stockAllocation.lowStockThreshold})
                        </span>
                      </div>
                    </div>
                  )}

                {selectedBranchFilter !== 'all' && stockAllocation.productId && (
                  <div className="col-span-2 mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700">Total after allocation:</span>
                      <span className="font-bold text-blue-900">
                        {(branchInventory.find(
                          (item) =>
                            item.branch_id === selectedBranchFilter &&
                            item.product_id === stockAllocation.productId
                        )?.retail_quantity || 0) +
                          (branchInventory.find(
                            (item) =>
                              item.branch_id === selectedBranchFilter &&
                              item.product_id === stockAllocation.productId
                          )?.wholesale_quantity || 0) +
                          parseInt(stockAllocation.quantity || 0)}{' '}
                        units
                      </span>
                    </div>
                    {parseInt(stockAllocation.lowStockThreshold || '0') > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        Will trigger low stock alert when stock falls below{' '}
                        {stockAllocation.lowStockThreshold} units
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={closeStockAllocationModal}
              disabled={allocationLoading}
            >
              Cancel
            </Button>
            <Button type="submit" loading={allocationLoading}>
              Allocate from Warehouse
            </Button>
          </div>
        </form>
      </Modal>

      {/* Process Restock Modal */}
      <ProcessRestockModal
        isOpen={isProcessRestockModalOpen}
        onClose={() => {
          setIsProcessRestockModalOpen(false);
          setProcessingRequest(null);
        }}
        request={processingRequest}
        onFulfilled={() => {
          if (companyId) {
            fetchRestockRequests();
            fetchStats();
            fetchBranchInventory();
            fetchWarehouseInventory();
          }
          toast.success('Request Processed', {
            description: 'Restock request has been updated successfully',
            duration: 3000,
          });
        }}
        companyId={companyId || ''}
        warehouseInventory={warehouseInventory}
      />

      {/* Batch Allocation Modal */}
      <BatchAllocationModal
        isOpen={isBatchAllocationModalOpen}
        onClose={() => setIsBatchAllocationModalOpen(false)}
        companyId={companyId || ''}
        onSuccess={() => {
          if (companyId) {
            fetchWarehouseInventory();
            fetchBranchInventory();
            fetchProducts();
            fetchStats();
          }
        }}
      />

      {/* Add Warehouse Product Modal */}
      <AddWarehouseProductModal
        isOpen={isAddWarehouseProductModalOpen}
        onClose={() => setIsAddWarehouseProductModalOpen(false)}
        companyId={companyId || ''}
        onSuccess={() => {
          if (companyId) {
            fetchWarehouseInventory();
            fetchProducts();
            fetchStats();
          }
          toast.success('Product Added to Warehouse', {
            description: 'Product has been successfully added to warehouse inventory',
          });
        }}
        existingProducts={products}
      />

      <AddBranchStockModal
        isOpen={isAddBranchStockModalOpen}
        onClose={() => setIsAddBranchStockModalOpen(false)}
        companyId={companyId || ''}
        branches={branches}
        products={products}
        defaultBranchId={selectedBranchFilter}
        onAddExisting={addBranchStock}
        onCreateProductAndStock={async (payload) => {
          const ok = await createProductAndBranchStock(payload);
          if (ok) {
            fetchProducts();
            fetchStats();
          }
          return ok;
        }}
        onSuccess={() => {
          if (companyId) {
            fetchBranchInventory();
            fetchProducts();
            fetchStats();
          }
        }}
      />

      {/* Invoice Delivery Modal */}
      {isInvoiceDeliveryModalOpen && invoiceDeliveryRequest && (
        <InvoiceDeliveryModal
          isOpen={isInvoiceDeliveryModalOpen}
          onClose={() => {
            setIsInvoiceDeliveryModalOpen(false);
            setInvoiceDeliveryRequest(null);
          }}
          invoiceNumber={invoiceDeliveryRequest.invoice_number}
          requestId={invoiceDeliveryRequest.id}
          userId={companyId || ''}
          onSuccess={() => {
            if (fetchRestockRequests) fetchRestockRequests();
            if (fetchStats) fetchStats();
            if (fetchBranchInventory) fetchBranchInventory();
            toast.success('Delivery completed successfully');
          }}
        />
      )}
    </div>
  );
};

export default CompanyDashboard;