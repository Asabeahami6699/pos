import React, { useMemo, useState } from 'react';
import type { RestockRequest, Product, RestockFilters } from '../../types/index';
import { DateRangePicker } from './DateRangePicker';
import { Button } from '../Button';
import { Package, CheckCircle, XCircle, Clock, Truck, FileText, Download, Printer, User, Building, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useSalesInvoiceActions } from '../../hooks/posHooks/useSalesInvoiceActions';
import { EnhancedInvoiceModal } from './EnhancedInvoiceModal';

interface RestockTabProps {
  restockRequests: RestockRequest[];
  products: Product[];
  onNewRequest: () => void;
  realtimeConnection: 'connected' | 'disconnected' | 'connecting';
  filters: RestockFilters;
  onFiltersChange: (filters: RestockFilters) => void;
  loading: boolean;
  user?: any;
  
  // Invoice functions
  generateInvoice?: (requestId: string, userId: string) => Promise<any>;
  downloadInvoicePDF?: (invoiceNumber: string) => Promise<void>;
  getInvoiceDetails?: (invoiceNumber: string) => Promise<any>;
  generatingInvoice?: string | null;
  
  // For admin capabilities in POS
  canApprove?: boolean;
  onApproveRequest?: (requestId: string) => Promise<void>;
  onMarkDelivered?: (requestId: string, invoiceNumber: string) => Promise<void>;
}

export const RestockTab: React.FC<RestockTabProps> = ({
  restockRequests,
  products,
  onNewRequest,
  realtimeConnection,
  filters,
  onFiltersChange,
  loading,
  user,
  generateInvoice,
  downloadInvoicePDF,
  getInvoiceDetails,
  generatingInvoice,
  canApprove = false,
  onApproveRequest,
  onMarkDelivered
}) => {
  const [selectedRequest, setSelectedRequest] = useState<RestockRequest | null>(null);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<any>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState<string | null>(null);
  
  // Initialize sales invoice hook
  const {
    loading: invoiceLoading,
    downloading: invoiceDownloading,
    invoiceDetails,
    viewInvoice: salesViewInvoice,
    viewDeliveryReceipt: salesViewDeliveryReceipt,
    downloadInvoice: salesDownloadInvoice,
    quickDownload: salesQuickDownload,
    getInvoiceStatus,
    resetInvoiceDetails
  } = useSalesInvoiceActions({
    companyId: user?.company_id,
    userId: user?.id,
    userRole: user?.role
  });

  const productMap = useMemo(() => 
    new Map(products.map(p => [p.id, p])), 
    [products]
  );

  const filteredRequests = useMemo(() => {
    let filtered = restockRequests;
    
    filtered = filtered.filter(req => {
      const reqDate = new Date(req.created_at);
      const fromDate = new Date(filters.dateRange.from);
      const toDate = new Date(filters.dateRange.to);
      return reqDate >= fromDate && reqDate <= toDate;
    });
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(req => req.status === filters.status);
    }
    
    return filtered;
  }, [restockRequests, filters]);

  const pendingRequests = filteredRequests.filter(req => req.status === 'pending');
  const approvedRequests = filteredRequests.filter(req => req.status === 'approved' && (!req.delivery_status || req.delivery_status === 'pending'));
  const pendingCount = pendingRequests.length;
  const readyForDeliveryCount = approvedRequests.length;

  const getStatusBadge = (request: RestockRequest) => {
    if (request.status === 'pending') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-800 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }
    if (request.status === 'approved') {
      if (request.delivery_status === 'delivered') {
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-green-800 flex items-center gap-1">
            <Truck className="w-3 h-3" />
            Delivered
          </span>
        );
      }
      if (request.delivery_status === 'in_transit') {
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-800 flex items-center gap-1">
            <Truck className="w-3 h-3" />
            In Transit
          </span>
        );
      }
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-green-800 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Approved
        </span>
      );
    }
    if (request.status === 'rejected') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-800 flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
    if (request.status === 'fulfilled') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-800 flex items-center gap-1">
          <Package className="w-3 h-3" />
          Fulfilled
        </span>
      );
    }
    return null;
  };

  // Handle approve request (for admin/supervisor using POS)
  const handleApproveRequest = async (requestId: string) => {
    if (onApproveRequest) {
      try {
        await onApproveRequest(requestId);
        setShowApproveConfirm(null);
        toast.success('Request approved');
      } catch (error) {
        toast.error('Failed to approve request');
      }
    } else if (generateInvoice && user?.id) {
      setShowApproveConfirm(null);
      try {
        const result = await generateInvoice(requestId, user.id);
        if (result.success) {
          toast.success('Request Approved', {
            description: `Invoice ${result.invoiceNumber} generated`,
            action: result.canDownload && downloadInvoicePDF ? {
              label: 'Download PDF',
              onClick: () => handleDownloadInvoice(result.invoiceNumber, undefined, true)
            } : undefined
          });
        }
      } catch (error: any) {
        toast.error('Failed to approve request', {
          description: error.message || 'An error occurred'
        });
      }
    } else {
      toast.error('Cannot approve request');
    }
  };

  // Handle view invoice details
  const handleViewInvoice = async (invoiceNumber: string, isReceipt: boolean = false) => {
    try {
      if (isReceipt) {
        const receipt = await salesViewDeliveryReceipt(invoiceNumber);
        if (receipt) {
          setSelectedInvoiceDetails(receipt);
          setShowInvoiceModal(true);
        }
      } else {
        const invoice = await salesViewInvoice(invoiceNumber);
        if (invoice) {
          setSelectedInvoiceDetails(invoice);
          setShowInvoiceModal(true);
        }
      }
    } catch (error: any) {
      console.error('Error viewing invoice:', error);
      
      // Fallback to old system if new system fails
      if (getInvoiceDetails) {
        try {
          const fallbackInvoice = await getInvoiceDetails(invoiceNumber);
          if (fallbackInvoice) {
            setSelectedInvoiceDetails(fallbackInvoice);
            setShowInvoiceModal(true);
          } else {
            toast.error('Failed to load invoice details');
          }
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
          toast.error('Invoice not found');
        }
      } else {
        toast.error('Invoice not found');
      }
    }
  };

  // Handle download invoice
  const handleDownloadInvoice = async (
    invoiceNumber: string, 
    request?: RestockRequest, 
    isFallback: boolean = false
  ) => {
    try {
      // Determine if it's a receipt or invoice
      const isReceipt = request?.status === 'fulfilled' || 
                        request?.delivery_status === 'delivered' || 
                        request?.delivery_date !== null;

      if (isFallback && downloadInvoicePDF) {
        // Use old system for fallback
        await downloadInvoicePDF(invoiceNumber);
        toast.success('Invoice Downloaded', {
          description: `Invoice ${invoiceNumber} downloaded successfully`
        });
      } else {
        // Use new sales invoice system
        await salesDownloadInvoice(invoiceNumber, isReceipt ? 'receipt' : 'invoice');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      
      // Try fallback if new system fails
      if (!isFallback && downloadInvoicePDF) {
        try {
          await downloadInvoicePDF(invoiceNumber);
          toast.success('Invoice Downloaded', {
            description: `Invoice ${invoiceNumber} downloaded successfully`
          });
        } catch (fallbackError) {
          toast.error('Failed to download invoice', {
            description: error.message || 'Please try again'
          });
        }
      } else {
        toast.error('Failed to download invoice', {
          description: error.message || 'Please try again'
        });
      }
    }
  };

  // Quick download function
  const handleQuickDownload = async (invoiceNumber: string, request: RestockRequest) => {
    try {
      await salesQuickDownload(invoiceNumber, request.status);
    } catch (error: any) {
      console.error('Quick download error:', error);
      toast.error('Failed to download document');
    }
  };

  // Render invoice actions based on request status
  const renderInvoiceActions = (req: RestockRequest) => {
    const isDelivered = req.status === 'fulfilled' || req.delivery_status === 'delivered';
    const isApproved = req.status === 'approved';
    
    if (!req.invoice_number) return null;

    if (isDelivered) {
      // Delivery receipt buttons
      return (
        <div className="flex gap-1">
          <button
            onClick={() => handleViewInvoice(req.invoice_number!, true)}
            className="flex-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium flex items-center justify-center gap-1"
            disabled={invoiceLoading}
          >
            {invoiceLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Loading...
              </>
            ) : (
              <>
                <Truck className="w-3 h-3" />
                Delivery Receipt
              </>
            )}
          </button>
          <button
            onClick={() => handleDownloadInvoice(req.invoice_number!, req)}
            disabled={invoiceDownloading === req.invoice_number}
            className="flex-1 px-3 py-1 border border-green-600 text-green-600 rounded hover:bg-emerald-500/10 text-xs font-medium flex items-center justify-center gap-1"
          >
            {invoiceDownloading === req.invoice_number ? (
              <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Download className="w-3 h-3" />
                Download
              </>
            )}
          </button>
        </div>
      );
    } else if (isApproved) {
      // Invoice buttons
      return (
        <div className="flex gap-1">
          <button
            onClick={() => handleViewInvoice(req.invoice_number!)}
            className="flex-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium flex items-center justify-center gap-1"
            disabled={invoiceLoading}
          >
            {invoiceLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Loading...
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                View Invoice
              </>
            )}
          </button>
          <button
            onClick={() => handleDownloadInvoice(req.invoice_number!, req)}
            disabled={invoiceDownloading === req.invoice_number}
            className="flex-1 px-3 py-1 border border-blue-600 text-blue-600 rounded hover:bg-blue-500/100/10 text-xs font-medium flex items-center justify-center gap-1"
          >
            {invoiceDownloading === req.invoice_number ? (
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Download className="w-3 h-3" />
                Download
              </>
            )}
          </button>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Package className="w-5 h-5" />
            Restock Requests
          </h3>
          {(pendingCount > 0 || readyForDeliveryCount > 0) && (
            <div className="flex items-center space-x-2">
              {pendingCount > 0 && (
                <span className="bg-amber-500/100 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
              {readyForDeliveryCount > 0 && (
                <span className="bg-emerald-500/100 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {readyForDeliveryCount}
                </span>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground flex items-center">
            <span className={`w-2 h-2 rounded-full mr-1 ${
              realtimeConnection === 'connected' ? 'bg-emerald-500/100 animate-pulse' : 'bg-red-500/100'
            }`}></span>
            Live
          </div>
        </div>
        <Button 
          onClick={onNewRequest}
          className="flex items-center space-x-2"
        >
          <Package className="w-4 h-4" />
          <span>New Request</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-foreground">{filteredRequests.length}</div>
          <div className="text-sm text-muted-foreground">Total Requests</div>
        </div>
        <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
          <div className="text-2xl font-bold text-amber-700">{pendingCount}</div>
          <div className="text-sm text-amber-600">Pending Approval</div>
        </div>
        <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
          <div className="text-2xl font-bold text-green-700">{readyForDeliveryCount}</div>
          <div className="text-sm text-green-600">Ready for Delivery</div>
        </div>
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
          <div className="text-2xl font-bold text-blue-700">
            {filteredRequests.filter(r => r.invoice_number).length}
          </div>
          <div className="text-sm text-blue-600">With Invoices</div>
        </div>
      </div>

      {/* Alerts */}
      {pendingCount > 0 && canApprove && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <h4 className="font-bold text-amber-800">Pending Approval</h4>
                <p className="text-sm text-amber-600">{pendingCount} requests awaiting approval</p>
              </div>
            </div>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => {
                if (pendingRequests.length > 0) {
                  setShowApproveConfirm(pendingRequests[0].id);
                }
              }}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve All
            </Button>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {showApproveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-foreground mb-2">Approve Request?</h3>
            <p className="text-muted-foreground mb-6">
              Approving this request will generate an invoice. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => setShowApproveConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={generatingInvoice === showApproveConfirm}
                onClick={() => handleApproveRequest(showApproveConfirm)}
              >
                Approve & Generate Invoice
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card rounded-xl p-4 border">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-medium text-foreground">Filter Requests</h4>
          <div className="text-xs text-muted-foreground">
            Showing {filteredRequests.length} of {restockRequests.length} requests
          </div>
        </div>
        
        <div className="space-y-3">
          <DateRangePicker
            range={filters.dateRange}
            onChange={(range) => onFiltersChange({ ...filters, dateRange: range })}
          />
          
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'approved', 'rejected', 'fulfilled'] as const).map(status => (
              <button
                key={`status-filter-${status}`}
                onClick={() => onFiltersChange({ ...filters, status })}
                className={`
                  px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1
                  ${filters.status === status
                    ? status === 'pending' ? 'bg-amber-500/15 text-amber-700 border border-amber-300' :
                      status === 'approved' ? 'bg-emerald-500/15 text-green-700 border border-green-300' :
                      status === 'rejected' ? 'bg-red-500/15 text-red-700 border border-red-300' :
                      status === 'fulfilled' ? 'bg-blue-500/15 text-blue-700 border border-blue-300' :
                      'bg-indigo-500/15 text-indigo-700 border border-indigo-300'
                    : 'bg-secondary text-foreground hover:bg-muted border border-border'
                  }
                `}
              >
                {status === 'all' && 'All Status'}
                {status === 'pending' && <><Clock className="w-3 h-3" /> Pending</>}
                {status === 'approved' && <><CheckCircle className="w-3 h-3" /> Approved</>}
                {status === 'rejected' && <><XCircle className="w-3 h-3" /> Rejected</>}
                {status === 'fulfilled' && <><Package className="w-3 h-3" /> Fulfilled</>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="bg-card rounded-xl shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading restock requests...</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Request Details</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Requested By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No restock requests found for the selected date range.</p>
                      <button
                        onClick={onNewRequest}
                        className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        Create your first request →
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    // ✅ FIXED: Try req.products first (from database join), then fallback to productMap
                    const product = productMap.get(req.product_id);
                    const productName = req.products?.name || product?.name || 'Unknown Product';
                    const productSku = req.products?.sku || product?.sku || 'N/A';
                    
                    return (
                      <tr key={`restock-request-${req.id}`} className="hover:bg-secondary/60 group">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-mono text-sm font-medium text-foreground">
                              REQ-{req.id.slice(-8).toUpperCase()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(req.created_at).toLocaleDateString()}
                              <span className="mx-1">•</span>
                              {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {req.notes && (
                              <div className="text-xs text-muted-foreground mt-1 italic truncate max-w-xs">
                                "{req.notes}"
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-4 py-3">
                          <div className="max-w-xs">
                            <div className="font-medium text-foreground">
                              {req.product_name}
                            </div>
                            {req.product_sku && req.product_sku !== 'N/A' && (
                              <div className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded inline-block">
                                {req.product_sku}
                              </div>
                            )}
                            {/* Show multi-product indicator if items array exists */}
                            {req.items && Array.isArray(req.items) && req.items.length > 1 && (
                              <div className="text-xs text-indigo-600 font-medium mt-1">
                                +{req.items.length - 1} more products
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-500/15 text-indigo-800">
                              {req.requested_quantity || 0} units
                            </span>
                            {req.fulfilled_quantity && req.fulfilled_quantity !== req.requested_quantity && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Fulfilled: {req.fulfilled_quantity}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-foreground">
                              {req.users?.full_name || 'Unknown User'}
                            </div>
                            {req.users?.email && (
                              <div className="text-xs text-muted-foreground truncate max-w-xs">
                                {req.users.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {getStatusBadge(req)}
                            {req.delivery_status === 'delivered' && req.delivery_date && (
                              <div className="text-xs text-muted-foreground">
                                Delivered: {new Date(req.delivery_date).toLocaleDateString()}
                              </div>
                            )}
                            {req.invoice_number && (
                              <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                INV-{req.invoice_number?.slice(-8)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {/* Approve Button (for admin/supervisor in POS) */}
                            {req.status === 'pending' && canApprove && (
                              <button
                                onClick={() => setShowApproveConfirm(req.id)}
                                disabled={generatingInvoice === req.id}
                                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${
                                  generatingInvoice === req.id
                                    ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                              >
                                {generatingInvoice === req.id ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-3 h-3" />
                                    Approve
                                  </>
                                )}
                              </button>
                            )}
                            
                            {/* INVOICE/DELIVERY RECEIPT BUTTONS - For Salesperson */}
                            {renderInvoiceActions(req)}
                            
                            {/* View Details Button */}
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="px-3 py-1 border border-border text-foreground rounded-lg hover:bg-secondary/60 text-xs font-medium"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">
                    Restock Request Details
                  </h2>
                  <p className="text-blue-100 mt-1">
                    REQ-{selectedRequest.id.slice(-8).toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/60 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Date Requested</p>
                    <p className="font-medium">
                      {new Date(selectedRequest.created_at).toLocaleDateString()}
                      <span className="ml-2 text-muted-foreground">
                        {new Date(selectedRequest.created_at).toLocaleTimeString()}
                      </span>
                    </p>
                  </div>
                  <div className="bg-secondary/60 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">
                      {getStatusBadge(selectedRequest)}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/60 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Requested Quantity</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {selectedRequest.requested_quantity || 0} units
                    </p>
                  </div>
                  {selectedRequest.fulfilled_quantity && (
                    <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20">
                      <p className="text-sm text-muted-foreground">Fulfilled Quantity</p>
                      <p className="text-2xl font-bold text-green-600">
                        {selectedRequest.fulfilled_quantity} units
                      </p>
                      {selectedRequest.fulfilled_at && (
                        <p className="text-xs text-green-600 mt-1">
                          Fulfilled on {new Date(selectedRequest.fulfilled_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {selectedRequest.notes && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Notes</p>
                    <div className="bg-secondary/60 p-4 rounded-lg">
                      <p className="text-foreground">{selectedRequest.notes}</p>
                    </div>
                  </div>
                )}
                
                {selectedRequest.admin_notes && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Admin Notes</p>
                    <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                      <p className="text-foreground">{selectedRequest.admin_notes}</p>
                    </div>
                  </div>
                )}
                
                {selectedRequest.invoice_number && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-800">
                          {selectedRequest.delivery_status === 'delivered' ? 'Delivery Receipt' : 'Invoice'}
                        </p>
                        <p className="text-blue-600 font-mono">INV-{selectedRequest.invoice_number}</p>
                        {selectedRequest.delivery_date && (
                          <p className="text-sm text-blue-600">
                            Delivered: {new Date(selectedRequest.delivery_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewInvoice(
                            selectedRequest.invoice_number!, 
                            selectedRequest.delivery_status === 'delivered'
                          )}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleDownloadInvoice(selectedRequest.invoice_number!, selectedRequest)}
                          className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-500/100/10 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Invoice Modal */}
      {showInvoiceModal && selectedInvoiceDetails && (
        <EnhancedInvoiceModal
          invoice={selectedInvoiceDetails}
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoiceDetails(null);
            resetInvoiceDetails();
          }}
          onDownloadInvoice={() => salesDownloadInvoice(selectedInvoiceDetails.invoice_number, 'invoice')}
          onDownloadReceipt={() => salesDownloadInvoice(selectedInvoiceDetails.invoice_number, 'receipt')}
          downloading={invoiceDownloading === selectedInvoiceDetails.invoice_number}
          type={
            selectedInvoiceDetails.status === 'delivered' || 
            selectedInvoiceDetails.delivery_date ||
            selectedInvoiceDetails.restock_request?.delivery_status === 'delivered'
              ? 'receipt' 
              : 'invoice'
          }
        />
      )}
    </div>
  );
};