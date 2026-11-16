// C:\Users\HP\pos-inventory\src\components\admin\dashboard-tabs\AdminRequestsTab.tsx
import React, { useState, useEffect } from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { 
  Filter, CheckCircle, XCircle, Clock, Package, 
  CheckSquare, User, Building, FileText, 
  Download, Eye 
} from 'lucide-react';
import { Button } from '../../Button';
import { toast } from 'sonner';
import { useInvoiceManagement } from '../../../hooks/useInvoiceManagement';
import { InvoiceViewModal } from '../InvoiceViewModal';
import type { InvoiceDetails } from '../../../hooks/useInvoiceManagement';
import { supabase } from '../../../lib/supabase';

interface RequestsTabProps {
  restockRequests: any[];
  loading: boolean;
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  setProcessingRequest: (request: any) => void;
  setIsProcessRestockModalOpen: (open: boolean) => void;
  currentUser?: any;
  companyId?: string;
  fetchRestockRequests?: () => Promise<void>;
}

export const AdminRequestsTab: React.FC<RequestsTabProps> = ({
  restockRequests,
  loading,
  activeFilter,
  setActiveFilter,
  setProcessingRequest,
  setIsProcessRestockModalOpen,
  currentUser,
  companyId,
  fetchRestockRequests
}) => {
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetails | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [actualUserId, setActualUserId] = useState<string | null>(null);
  const [actualCompanyId, setActualCompanyId] = useState<string | null>(null);

  // Get authenticated user and company ID
  useEffect(() => {
    const initializeData = async () => {
      console.log('=== DEBUG AdminRequestsTab ===');
      console.log('currentUser prop:', currentUser);
      console.log('companyId prop:', companyId);
      
      try {
        // Get authenticated user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          return;
        }
        
        console.log('Auth session:', session);
        
        if (session?.user?.id) {
          setActualUserId(session.user.id);
          console.log('Auth session user ID:', session.user.id);
          
          // Try to get user details to get company ID
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('company_id')
            .eq('id', session.user.id)
            .single();
            
          if (!userError && userData?.company_id) {
            setActualCompanyId(userData.company_id);
            console.log('Company ID from user table:', userData.company_id);
          }
        }
        
        // Fallback: Use props if user table doesn't have company ID
        if (!actualCompanyId) {
          if (currentUser?.company_id) {
            setActualCompanyId(currentUser.company_id);
          } else if (companyId) {
            setActualCompanyId(companyId);
          } else if (currentUser?.id && currentUser.id !== '1c261bfe-b927-42ca-9945-25f1d163aed7') {
            // currentUser.id might be the company ID
            setActualCompanyId(currentUser.id);
          }
        }
        
        console.log('Final actualCompanyId:', actualCompanyId);
        console.log('Final actualUserId:', actualUserId);
        
      } catch (error) {
        console.error('Error initializing AdminRequestsTab:', error);
      }
    };

    initializeData();
  }, [currentUser, companyId]);

  // Use the invoice management hook
  const {
    loading: invoiceLoading,
    getInvoiceByNumber,
    generatePDF
  } = useInvoiceManagement(
    actualCompanyId || companyId,
    currentUser?.role,
    actualUserId
  );

  // Calculate counts for each status
  const requestCounts = {
    all: restockRequests.length,
    pending: restockRequests.filter(r => r.status === 'pending').length,
    approved: restockRequests.filter(r => r.status === 'approved').length,
    fulfilled: restockRequests.filter(r => r.status === 'fulfilled' || r.delivery_status === 'delivered').length,
    rejected: restockRequests.filter(r => r.status === 'rejected').length,
  };

  const filteredRequests = restockRequests.filter(r => 
    activeFilter === 'all' || r.status === activeFilter
  );

  // Status badge component
  const StatusBadge = ({ status, delivery_status }: { status: string; delivery_status?: string }) => {
    const getStatusConfig = (status: string, delivery_status?: string) => {
      if (status === 'fulfilled' || delivery_status === 'delivered') {
        return { 
          bg: 'bg-emerald-500/15', 
          text: 'text-green-800', 
          icon: CheckSquare, 
          label: 'Delivered' 
        };
      }
      
      switch(status) {
        case 'pending':
          return { bg: 'bg-amber-500/15', text: 'text-amber-800', icon: Clock, label: 'Pending' };
        case 'approved':
          return { 
            bg: delivery_status === 'in_transit' ? 'bg-blue-500/15' : 'bg-blue-500/15', 
            text: delivery_status === 'in_transit' ? 'text-blue-800' : 'text-blue-800', 
            icon: CheckCircle, 
            label: delivery_status === 'in_transit' ? 'In Transit' : 'Approved' 
          };
        case 'rejected':
          return { bg: 'bg-red-500/15', text: 'text-red-800', icon: XCircle, label: 'Rejected' };
        default:
          return { bg: 'bg-secondary', text: 'text-foreground', icon: Clock, label: status };
      }
    };

    const config = getStatusConfig(status, delivery_status);
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </div>
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle view invoice
  const handleViewInvoice = async (invoiceNumber: string) => {
    try {
      const invoice = await getInvoiceByNumber(invoiceNumber);
      if (invoice) {
        setSelectedInvoice(invoice);
        setShowInvoiceModal(true);
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast.error('Failed to load invoice details');
    }
  };

  // Handle download invoice
  const handleDownloadInvoice = async (invoiceNumber: string) => {
    setDownloadingInvoice(true);
    try {
      await generatePDF(invoiceNumber);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download invoice');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <DashboardHeader 
        title="Restock Requests" 
        subtitle="Manage product requests from salespersons across branches"
      />

      <div className="flex-1 overflow-y-auto max-h-[75vh] px-4 pb-4 space-y-6">
        {/* Filter Tabs */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-x-auto pb-2">
              <div className="flex items-center text-sm text-muted-foreground mr-2">
                <Filter className="h-4 w-4 mr-2" />
                Status:
              </div>
              {['all', 'pending', 'approved', 'fulfilled', 'rejected'].map((status) => {
                const count = requestCounts[status as keyof typeof requestCounts];
                const isActive = activeFilter === status;
                
                const statusColors = {
                  all: isActive ? 'bg-secondary text-white' : 'bg-secondary text-foreground hover:bg-muted',
                  pending: isActive ? 'bg-amber-500/100 text-white' : 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/15',
                  approved: isActive ? 'bg-blue-500/100 text-white' : 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/100/15',
                  fulfilled: isActive ? 'bg-emerald-500/100 text-white' : 'bg-emerald-500/10 text-green-700 hover:bg-emerald-500/15',
                  rejected: isActive ? 'bg-red-500/100 text-white' : 'bg-red-500/10 text-red-700 hover:bg-red-500/15',
                };

                return (
                  <button
                    key={status}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200 flex items-center space-x-2 ${statusColors[status as keyof typeof statusColors]}`}
                    onClick={() => setActiveFilter(status)}
                  >
                    <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                        isActive ? 'bg-card/20' : 'bg-card'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{filteredRequests.length}</span> requests
            </div>
          </div>
        </div>
              
        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-card rounded-2xl shadow-sm border border-border">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent mb-4"></div>
            <p className="text-muted-foreground">Loading restock requests...</p>
          </div>
        ) : (
          <>
            {/* Table Container */}
            {filteredRequests.length > 0 ? (
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div 
                  className={`overflow-x-auto ${
                    filteredRequests.length > 5 
                      ? 'max-h-[500px] overflow-y-auto' 
                      : ''
                  }`}
                >
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-secondary/60 sticky top-0 z-10">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Product Details
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Branch & Staff
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Quantity & Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {filteredRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-secondary/60 transition-colors duration-150">
                          {/* Product Details */}
                          <td className="px-6 py-4">
                            <div className="flex items-start space-x-3">
                              <div className="bg-indigo-500/15 p-2 rounded-lg">
                                <Package className="h-5 w-5 text-indigo-600" />
                              </div>
                              <div>
                                <div className="font-medium text-foreground">
                                  {request.product_name || request.products?.name || 'Product'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  SKU: {request.product_sku || request.products?.sku || 'N/A'}
                                </div>
                                <div className="text-sm font-medium text-foreground">
                                  ₵{request.product_price || request.products?.price || '0.00'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Branch & Staff */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center text-sm">
                                <Building className="h-4 w-4 text-muted-foreground mr-2" />
                                <span className="font-medium text-foreground">
                                  {request.branch_name || request.branches?.name || 'Branch'}
                                </span>
                              </div>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <User className="h-4 w-4 text-muted-foreground mr-2" />
                                {request.staff_name || request.users?.full_name || 'Staff Member'}
                              </div>
                            </div>
                          </td>

                          {/* Quantity & Date */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <span className="text-lg font-bold text-foreground">
                                  {request.requested_quantity || 0}
                                </span>
                                <span className="ml-1 text-sm text-muted-foreground">units</span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(request.created_at)}
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <StatusBadge 
                              status={request.status} 
                              delivery_status={request.delivery_status}
                            />
                            {request.invoice_number && (
                              <div className="mt-1 text-xs text-blue-600 font-medium flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {request.invoice_number}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col space-y-2">
                              {/* View and Download for requests with invoice */}
                              {(request.status === 'approved' || request.status === 'fulfilled') && request.invoice_number && (
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleViewInvoice(request.invoice_number)}
                                    className="flex-1"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    View Invoice
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleDownloadInvoice(request.invoice_number)}
                                    loading={downloadingInvoice}
                                    className="flex-1"
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    PDF
                                  </Button>
                                </div>
                              )}
                              
                              {/* View Details Button for all requests */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setProcessingRequest(request);
                                  setIsProcessRestockModalOpen(true);
                                }}
                                className="w-full"
                              >
                                View Details
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div className="bg-secondary/60 px-6 py-3 border-t border-border">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                      Showing <span className="font-medium">{filteredRequests.length}</span> of{' '}
                      <span className="font-medium">{requestCounts.all}</span> requests
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500/100"></div>
                        <span>Pending: {requestCounts.pending}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/100"></div>
                        <span>Fulfilled: {requestCounts.fulfilled}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State */
              <div className="col-span-full text-center py-16 bg-card rounded-2xl shadow-sm border border-border">
                <div className="text-5xl mb-4">
                  {activeFilter === 'pending' ? '📝' :
                   activeFilter === 'approved' ? '⏳' :
                   activeFilter === 'fulfilled' ? '✅' :
                   activeFilter === 'rejected' ? '❌' : '📦'}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {activeFilter === 'all' ? 'No restock requests' :
                   activeFilter === 'pending' ? 'No pending requests' :
                   activeFilter === 'approved' ? 'No approved requests' :
                   activeFilter === 'fulfilled' ? 'All requests fulfilled' : 'No rejected requests'}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  {activeFilter === 'pending' 
                    ? 'All restock requests have been processed. New requests will appear here.'
                    : activeFilter === 'fulfilled'
                    ? 'Great job! All requests have been successfully fulfilled.'
                    : 'Restock requests will appear here when salespersons make requests.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Modal */}
      <InvoiceViewModal
        invoice={selectedInvoice}
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setSelectedInvoice(null);
        }}
        onDownloadPDF={handleDownloadInvoice}
        downloading={downloadingInvoice}
      />
    </div>
  );
};