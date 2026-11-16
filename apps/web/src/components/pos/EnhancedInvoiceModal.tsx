// src/components/EnhancedInvoiceModal.tsx
import React from 'react';
import { Button } from '../Button';
import { 
  X, 
  FileText, 
  Download, 
  Printer, 
  Building, 
  User, 
  Package, 
  Truck,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Mail,
  Phone
} from 'lucide-react';
import type { InvoiceDetails } from '../hooks/useSalesInvoiceActions';

interface EnhancedInvoiceModalProps {
  invoice: InvoiceDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onDownloadInvoice: (invoiceNumber: string) => Promise<void>;
  onDownloadReceipt: (invoiceNumber: string) => Promise<void>;
  downloading: boolean;
  type?: 'invoice' | 'receipt';
}

export const EnhancedInvoiceModal: React.FC<EnhancedInvoiceModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onDownloadInvoice,
  onDownloadReceipt,
  downloading,
  type = 'invoice'
}) => {
  if (!isOpen || !invoice) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isReceipt = type === 'receipt' || invoice.status === 'delivered' || !!invoice.delivery_date;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`p-6 text-white ${isReceipt ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {isReceipt ? (
                <Truck className="w-8 h-8" />
              ) : (
                <FileText className="w-8 h-8" />
              )}
              <div>
                <h2 className="text-2xl font-bold">
                  {isReceipt ? 'Delivery Receipt' : 'Invoice'}
                </h2>
                <p className="opacity-90 font-mono mt-1">
                  {invoice.invoice_number}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-opacity-20 hover:bg-card rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Branch Info */}
            <div className="bg-secondary/60 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Building className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Branch Details</h3>
              </div>
              <p className="font-medium text-foreground text-lg">
                {invoice.branch_name || 'N/A'}
              </p>
              {invoice.branch_address && (
                <p className="text-sm text-muted-foreground mt-1">
                  {invoice.branch_address}
                </p>
              )}
            </div>

            {/* Request Info */}
            <div className="bg-secondary/60 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Request Information</h3>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">
                  {invoice.requested_by_name || 'N/A'}
                </p>
                {invoice.requested_by_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    {invoice.requested_by_email}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-secondary/60 p-4 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Timeline</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium text-foreground">
                    {formatDate(invoice.created_at)}
                  </span>
                </div>
                {invoice.delivery_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivered:</span>
                    <span className="font-medium text-green-600">
                      {formatDate(invoice.delivery_date)}
                    </span>
                  </div>
                )}
                {invoice.delivered_by_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivered By:</span>
                    <span className="font-medium text-foreground">
                      {invoice.delivered_by_name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center justify-center">
              <div className={`px-4 py-3 rounded-lg flex items-center gap-2 ${
                invoice.status === 'delivered' 
                  ? 'bg-emerald-500/15 text-green-800' 
                  : invoice.status === 'pending'
                  ? 'bg-amber-500/15 text-amber-800'
                  : 'bg-blue-500/15 text-blue-800'
              }`}>
                {invoice.status === 'delivered' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : invoice.status === 'pending' ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
                <span className="font-semibold">
                  {invoice.status === 'delivered' ? 'Delivered' 
                   : invoice.status === 'pending' ? 'Pending Delivery'
                   : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-foreground" />
                <h3 className="text-lg font-semibold text-foreground">Items List</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {invoice.items?.length || 0} item(s)
              </span>
            </div>

            {invoice.items && invoice.items.length > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-secondary/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Requested</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Delivered</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoice.items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-secondary/60">
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {item.product_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm bg-secondary px-2 py-1 rounded">
                            {item.product_sku}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">
                            {item.quantity_requested}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${
                            item.quantity_delivered === item.quantity_requested
                              ? 'text-green-600'
                              : 'text-amber-600'
                          }`}>
                            {item.quantity_delivered}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          GHC {item.unit_price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">
                          GHC {item.total_price.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No items found</p>
              </div>
            )}
          </div>

          {/* Summary Section - VAT Removed */}
          <div className="bg-gradient-to-br from-secondary/60 to-secondary p-6 rounded-xl border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {isReceipt ? 'Receipt Summary' : 'Invoice Summary'}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-foreground">Total Items:</span>
                <span className="font-semibold text-foreground">{invoice.total_items}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground">Total Quantity:</span>
                <span className="font-semibold text-foreground">{invoice.total_quantity} units</span>
              </div>
              <div className="border-t border-border pt-3 mt-3"></div>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-foreground">Total Amount:</span>
                <span className="text-2xl font-bold text-blue-600">
                  GHC {invoice.total_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {(invoice.notes || invoice.restock_request?.notes) && (
            <div className="mt-6 space-y-4">
              {invoice.notes && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Invoice Notes:</h4>
                  <p className="text-sm text-blue-700">{invoice.notes}</p>
                </div>
              )}
              {invoice.restock_request?.notes && (
                <div className="bg-secondary/60 border border-border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">Request Notes:</h4>
                  <p className="text-sm text-foreground">{invoice.restock_request.notes}</p>
                </div>
              )}
              {invoice.restock_request?.admin_notes && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-800 mb-2">Admin Notes:</h4>
                  <p className="text-sm text-amber-700">{invoice.restock_request.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t p-6 bg-secondary/60">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {isReceipt ? 'Delivery acknowledged' : 'Invoice generated'} from restock system
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => window.print()}
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button
                variant={isReceipt ? 'success' : 'primary'}
                onClick={() => isReceipt 
                  ? onDownloadReceipt(invoice.invoice_number)
                  : onDownloadInvoice(invoice.invoice_number)
                }
                loading={downloading}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {downloading 
                  ? 'Downloading...' 
                  : isReceipt 
                    ? 'Download Receipt' 
                    : 'Download Invoice'
                }
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};