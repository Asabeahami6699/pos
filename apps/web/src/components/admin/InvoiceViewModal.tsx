// src/components/admin/InvoiceViewModal.tsx
import React from 'react';
import { X, FileText, Download, Printer, Package, Calendar, User, Building, Truck, CheckCircle } from 'lucide-react';
import { Button } from '../Button';
import type { InvoiceDetails } from '../../hooks/useInvoiceManagement';

interface InvoiceViewModalProps {
  invoice: InvoiceDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onDownloadPDF: (invoiceNumber: string) => Promise<void>;
  onMarkAsDelivered?: (invoiceNumber: string) => void;
  downloading?: boolean;
  canMarkAsDelivered?: boolean;
}

export const InvoiceViewModal: React.FC<InvoiceViewModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onDownloadPDF,
  onMarkAsDelivered,
  downloading = false,
  canMarkAsDelivered = false
}) => {
  if (!isOpen || !invoice) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      pending: { bg: 'bg-amber-500/15', text: 'text-amber-800', label: 'Pending' },
      delivered: { bg: 'bg-emerald-500/15', text: 'text-green-800', label: 'Delivered' },
      verified: { bg: 'bg-blue-500/15', text: 'text-blue-800', label: 'Verified' },
      disputed: { bg: 'bg-red-500/15', text: 'text-red-800', label: 'Disputed' },
      cancelled: { bg: 'bg-secondary', text: 'text-foreground', label: 'Cancelled' }
    };

    const config = configs[status as keyof typeof configs] || configs.pending;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const subtotal = invoice.total_amount;
  const vat = subtotal * 0.12;
  const total = subtotal + vat;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-8 h-8" />
                <h2 className="text-3xl font-bold">Invoice Details</h2>
              </div>
              <p className="text-blue-100 text-lg font-mono">
                {invoice.invoice_number}
              </p>
              <div className="mt-3">
                {getStatusBadge(invoice.status)}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          {/* Invoice Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Branch Details */}
            <div className="bg-secondary/60 p-5 rounded-xl border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Building className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Branch Details</h3>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground text-lg">
                  {invoice.branch_name || 'N/A'}
                </p>
                {invoice.branch_address && (
                  <p className="text-sm text-muted-foreground">
                    {invoice.branch_address}
                  </p>
                )}
              </div>
            </div>

            {/* Request Details */}
            <div className="bg-secondary/60 p-5 rounded-xl border border-border">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Requested By</h3>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">
                  {invoice.requested_by_name || 'N/A'}
                </p>
                {invoice.requested_by_email && (
                  <p className="text-sm text-muted-foreground">
                    {invoice.requested_by_email}
                  </p>
                )}
              </div>
            </div>

            {/* Invoice Timeline */}
            <div className="bg-secondary/60 p-5 rounded-xl border border-border">
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
                {invoice.created_by_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">By:</span>
                    <span className="font-medium text-foreground">
                      {invoice.created_by_name}
                    </span>
                  </div>
                )}
                {invoice.delivery_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivered:</span>
                    <span className="font-medium text-green-600">
                      {formatDate(invoice.delivery_date)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Info */}
            {(invoice.delivered_by_name || invoice.status === 'delivered') && (
              <div className="bg-emerald-500/10 p-5 rounded-xl border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">Delivery Info</h3>
                </div>
                <div className="space-y-2">
                  {invoice.delivered_by_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700">Delivered By:</span>
                      <span className="font-medium text-green-900">
                        {invoice.delivered_by_name}
                      </span>
                    </div>
                  )}
                  {invoice.delivery_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700">Date:</span>
                      <span className="font-medium text-green-900">
                        {formatDate(invoice.delivery_date)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Items Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Invoice Items</h3>
              <span className="ml-auto text-sm text-muted-foreground">
                {invoice.items?.length || 0} item(s)
              </span>
            </div>

            {invoice.items && invoice.items.length > 0 ? (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider">
                          Requested
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider">
                          Delivered
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {invoice.items.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-secondary/60 transition-colors">
                          <td className="px-4 py-4 text-sm text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-foreground">
                              {item.product_name}
                            </div>
                            {item.product_category && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.product_category}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono bg-secondary text-foreground">
                              {item.product_sku}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="font-medium text-foreground">
                              {item.quantity_requested}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`font-medium ${
                              item.quantity_delivered > 0 
                                ? 'text-green-600' 
                                : 'text-muted-foreground'
                            }`}>
                              {item.quantity_delivered}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-foreground">
                            ₵{item.unit_price.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-foreground">
                            ₵{item.total_price.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No items found in this invoice</p>
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="bg-gradient-to-br from-secondary/60 to-secondary p-6 rounded-xl border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Invoice Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Items:</span>
                <span className="font-semibold text-foreground">{invoice.total_items}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Quantity:</span>
                <span className="font-semibold text-foreground">{invoice.total_quantity} units</span>
              </div>
              <div className="border-t border-border pt-3 mt-3"></div>
              <div className="flex justify-between items-center">
                <span className="text-foreground">Subtotal:</span>
                <span className="font-semibold text-foreground">₵{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">VAT (12%):</span>
                <span className="font-medium text-foreground">₵{vat.toFixed(2)}</span>
              </div>
              <div className="border-t-2 border-gray-400 pt-3 mt-3"></div>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-foreground">Total Amount:</span>
                <span className="text-2xl font-bold text-blue-600">₵{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {invoice.notes && (
            <div className="mt-6 bg-amber-500/100/10 border border-amber-500/20 rounded-xl p-4">
              <h4 className="font-semibold text-yellow-900 mb-2">Notes:</h4>
              <p className="text-sm text-yellow-800">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-secondary/60 border-t border-border px-6 py-4">
          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => window.print()}
              className="flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
            
            {canMarkAsDelivered && invoice.status === 'pending' && onMarkAsDelivered && (
              <Button
                variant="success"
                onClick={() => onMarkAsDelivered(invoice.invoice_number)}
                className="flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Delivered
              </Button>
            )}
            
            <Button
              variant="primary"
              onClick={() => onDownloadPDF(invoice.invoice_number)}
              loading={downloading}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};