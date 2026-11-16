// src/hooks/useSalesInvoiceActions.ts
import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_requested: number;
  quantity_delivered: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
}

export interface InvoiceDetails {
  id: string;
  invoice_number: string;
  restock_request_id: string;
  branch_id: string;
  company_id: string;
  total_items: number;
  total_quantity: number;
  total_amount: number;
  delivered_by: string | null;
  delivery_date: string | null;
  status: 'pending' | 'delivered' | 'verified' | 'cancelled';
  notes: string | null;
  created_at: string;
  created_by: string;
  
  // Related data
  branch_name?: string;
  requested_by_name?: string;
  requested_by_email?: string;
  created_by_name?: string;
  delivered_by_name?: string;
  restock_request?: {
    notes?: string;
    admin_notes?: string;
    delivery_status?: string;
  };
  
  // Items
  items?: InvoiceItem[];
  restock_invoice_items?: InvoiceItem[];
}

interface UseSalesInvoiceActionsProps {
  companyId?: string;
  userId?: string;
  userRole?: string;
}

export const useSalesInvoiceActions = ({
  companyId,
  userId,
  userRole
}: UseSalesInvoiceActionsProps) => {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails | null>(null);

  // Main function to get invoice details
  const getInvoiceDetails = useCallback(async (invoiceNumber: string): Promise<InvoiceDetails | null> => {
    try {
      console.log('Fetching invoice details for:', invoiceNumber);
      
      // First try to get the basic invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('restock_invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber.trim())
        .single();

      if (invoiceError || !invoice) {
        console.log('Invoice not found, trying alternative search');
        return await findInvoiceAlternative(invoiceNumber);
      }

      // We found the invoice, now get all related data
      return await getInvoiceWithSeparateQueries(invoice);
    } catch (error: any) {
      console.error('Error fetching invoice details:', error);
      return await findInvoiceAlternative(invoiceNumber);
    }
  }, []);

  // Helper to get all invoice data with separate queries (more reliable)
  const getInvoiceWithSeparateQueries = async (invoice: any): Promise<InvoiceDetails> => {
    try {
      // Get branch info
      let branch = null;
      if (invoice.branch_id) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('name')
          .eq('id', invoice.branch_id)
          .single();
        branch = branchData;
      }

      // Get creator info
      let creator = null;
      if (invoice.created_by) {
        const { data: creatorData } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', invoice.created_by)
          .single();
        creator = creatorData;
      }

      // Get deliverer info
      let deliverer = null;
      if (invoice.delivered_by) {
        const { data: delivererData } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', invoice.delivered_by)
          .single();
        deliverer = delivererData;
      }

      // Get invoice items
      const { data: items } = await supabase
        .from('restock_invoice_items')
        .select(`
          *,
          product:product_id (
            name,
            sku
          )
        `)
        .eq('restock_request_id', invoice.restock_request_id);

      // Get restock request
      let restockRequest = null;
      if (invoice.restock_request_id) {
        const { data: requestData } = await supabase
          .from('restock_requests')
          .select('*')
          .eq('id', invoice.restock_request_id)
          .single();
        
        if (requestData) {
          // Get requester info
          let requester = null;
          if (requestData.requested_by) {
            const { data: requesterData } = await supabase
              .from('users')
              .select('full_name, email')
              .eq('id', requestData.requested_by)
              .single();
            requester = requesterData;
          }
          
          restockRequest = { ...requestData, requester };
        }
      }

      // Format the invoice
      const formattedInvoice: InvoiceDetails = {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        restock_request_id: invoice.restock_request_id,
        branch_id: invoice.branch_id,
        company_id: invoice.company_id,
        total_items: invoice.total_items || 0,
        total_quantity: invoice.total_quantity || 0,
        total_amount: parseFloat(String(invoice.total_amount || 0)),
        delivered_by: invoice.delivered_by,
        delivery_date: invoice.delivery_date,
        status: (invoice.status as InvoiceDetails['status']) || 'pending',
        notes: invoice.notes,
        created_at: invoice.created_at,
        created_by: invoice.created_by,
        
        // Related data
        branch_name: branch?.name,
        created_by_name: creator?.full_name,
        delivered_by_name: deliverer?.full_name,
        requested_by_name: restockRequest?.requester?.full_name,
        requested_by_email: restockRequest?.requester?.email,
        restock_request: restockRequest ? {
          notes: restockRequest.notes,
          admin_notes: restockRequest.admin_notes,
          delivery_status: restockRequest.delivery_status
        } : undefined,
        
        // Items
        items: (items || []).map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name || 'Unknown Product',
          product_sku: item.product?.sku || 'N/A',
          quantity_requested: item.quantity_requested || 0,
          quantity_delivered: item.quantity_delivered || 0,
          unit_price: parseFloat(String(item.unit_price || 0)),
          total_price: parseFloat(String(item.total_price || 0)),
          notes: item.notes
        }))
      };

      // Also populate restock_invoice_items for backward compatibility
      formattedInvoice.restock_invoice_items = formattedInvoice.items;

      setInvoiceDetails(formattedInvoice);
      return formattedInvoice;
    } catch (error) {
      console.error('Error in getInvoiceWithSeparateQueries:', error);
      throw error;
    }
  };

  // Helper function to find invoice using alternative methods
  const findInvoiceAlternative = async (invoiceNumber: string): Promise<InvoiceDetails | null> => {
    try {
      console.log('Trying alternative search methods for:', invoiceNumber);
      
      // Method 1: Search by partial invoice number (case insensitive)
      const partialNumber = invoiceNumber.replace('INV-', '');
      
      const { data: invoices } = await supabase
        .from('restock_invoices')
        .select('*')
        .ilike('invoice_number', `%${partialNumber}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (invoices && invoices.length > 0) {
        console.log('Found invoice by partial match:', invoices[0].invoice_number);
        // Get full details for the found invoice
        return await getInvoiceWithSeparateQueries(invoices[0]);
      }

      // Method 2: Search in restock_requests for any matching reference
      const { data: requests } = await supabase
        .from('restock_requests')
        .select('*')
        .or(`request_number.ilike.%${partialNumber}%,notes.ilike.%${invoiceNumber}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (requests && requests.length > 0) {
        console.log('Found matching restock request:', requests[0].id);
        return await createInvoiceFromRequest(requests[0], invoiceNumber);
      }

      // Method 3: Check if it's a recent invoice by searching all invoices
      const { data: allInvoices } = await supabase
        .from('restock_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (allInvoices && allInvoices.length > 0) {
        console.log('Recent invoices:', allInvoices.map(i => i.invoice_number));
      }

      throw new Error(`Invoice "${invoiceNumber}" not found in system`);
      
    } catch (error: any) {
      console.error('Alternative search failed:', error);
      
      // Create a minimal invoice for display with the requested number
      const debugInvoice: InvoiceDetails = {
        id: `debug-${Date.now()}`,
        invoice_number: invoiceNumber,
        restock_request_id: `debug-request-${Date.now()}`,
        branch_id: '76d59068-f380-4e7c-b0f0-951c2499d4ae',
        company_id: '1c261bfe-b927-42ca-9945-25f1d163aed7',
        total_items: 0,
        total_quantity: 0,
        total_amount: 0,
        delivered_by: null,
        delivery_date: null,
        status: 'pending',
        notes: 'DEBUG: Invoice found but details incomplete. Please check database connection.',
        created_at: new Date().toISOString(),
        created_by: 'system',
        
        branch_name: 'Unknown Branch',
        
        items: []
      };
      
      debugInvoice.restock_invoice_items = debugInvoice.items;
      return debugInvoice;
    }
  };

  // Create invoice from restock request data
  const createInvoiceFromRequest = async (request: any, originalInvoiceNumber: string): Promise<InvoiceDetails> => {
    try {
      // Get items for this request
      const { data: items } = await supabase
        .from('restock_invoice_items')
        .select(`
          *,
          product:product_id (
            name,
            sku
          )
        `)
        .eq('restock_request_id', request.id);

      // Get branch info
      let branch = null;
      if (request.branch_id) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('name')
          .eq('id', request.branch_id)
          .single();
        branch = branchData;
      }

      // Get requester info
      let requester = null;
      if (request.requested_by) {
        const { data: requesterData } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', request.requested_by)
          .single();
        requester = requesterData;
      }

      // Calculate totals
      const totalItems = items?.length || 1;
      const totalQuantity = items?.reduce((sum, item) => 
        sum + (item.quantity_delivered || item.quantity_requested || 0), 0) || 
        (request.requested_quantity || 0);
      
      const totalAmount = items?.reduce((sum, item) => 
        sum + parseFloat(String(item.total_price || 0)), 0) || 
        parseFloat(String((request.product_price || 0) * (request.fulfilled_quantity || request.requested_quantity || 0)));

      // Create invoice object
      const invoice: InvoiceDetails = {
        id: request.id,
        invoice_number: originalInvoiceNumber,
        restock_request_id: request.id,
        branch_id: request.branch_id,
        company_id: request.company_id,
        total_items: totalItems,
        total_quantity: totalQuantity,
        total_amount: totalAmount,
        delivered_by: request.delivered_by,
        delivery_date: request.delivery_date,
        status: request.delivery_status === 'delivered' ? 'delivered' : 
                request.status === 'approved' ? 'pending' : 'pending',
        notes: request.notes || request.admin_notes,
        created_at: request.created_at,
        created_by: request.requested_by || 'system',
        
        // Related data
        branch_name: branch?.name,
        requested_by_name: requester?.full_name,
        requested_by_email: requester?.email,
        restock_request: {
          notes: request.notes,
          admin_notes: request.admin_notes,
          delivery_status: request.delivery_status
        },
        
        // Items
        items: (items || []).map(item => ({
          id: item.id || `temp-${Date.now()}`,
          product_id: item.product_id,
          product_name: item.product?.name || 'Unknown Product',
          product_sku: item.product?.sku || 'N/A',
          quantity_requested: item.quantity_requested || request.requested_quantity || 0,
          quantity_delivered: item.quantity_delivered || request.fulfilled_quantity || 0,
          unit_price: parseFloat(String(item.unit_price || request.product_price || 0)),
          total_price: parseFloat(String(item.total_price || 0)),
          notes: item.notes
        }))
      };

      // If no items from restock_invoice_items, create one from the request
      if (!items || items.length === 0) {
        invoice.items = [{
          id: `temp-${Date.now()}`,
          product_id: request.product_id,
          product_name: request.product_name || 'Unknown Product',
          product_sku: request.product_sku || 'N/A',
          quantity_requested: request.requested_quantity || 0,
          quantity_delivered: request.fulfilled_quantity || 0,
          unit_price: parseFloat(String(request.product_price || 0)),
          total_price: totalAmount,
          notes: null
        }];
      }

      invoice.restock_invoice_items = invoice.items;
      return invoice;
    } catch (error) {
      console.error('Error creating invoice from request:', error);
      throw error;
    }
  };

  // View invoice - opens modal with invoice details
  const viewInvoice = useCallback(async (invoiceNumber: string): Promise<InvoiceDetails | null> => {
    try {
      setLoading(true);
      const invoice = await getInvoiceDetails(invoiceNumber);
      
      if (!invoice) {
        toast.error('Invoice not found');
        return null;
      }
      
      return invoice;
    } catch (error: any) {
      toast.error('Failed to load invoice', {
        description: error.message || 'Please try again'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [getInvoiceDetails]);

  // View delivery receipt (same as invoice but marked as delivered)
  const viewDeliveryReceipt = useCallback(async (invoiceNumber: string): Promise<InvoiceDetails | null> => {
    try {
      setLoading(true);
      const invoice = await getInvoiceDetails(invoiceNumber);
      
      if (!invoice) {
        toast.error('Delivery receipt not found');
        return null;
      }
      
      // Check if it's delivered
      if (invoice.status !== 'delivered' && !invoice.delivery_date) {
        toast.info('This invoice is not yet marked as delivered');
      }
      
      return invoice;
    } catch (error: any) {
      toast.error('Failed to load delivery receipt', {
        description: error.message || 'Please try again'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [getInvoiceDetails]);

  // Download invoice as PDF - Black & White optimized with stretched table
const downloadInvoice = useCallback(async (invoiceNumber: string, type: 'invoice' | 'receipt' = 'invoice') => {
  setDownloading(invoiceNumber);
  
  try {
    // Get invoice details
    const invoice = await getInvoiceDetails(invoiceNumber);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Create PDF with optimized settings for black & white
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 15; // Reduced margin for more space
    let yPos = 15;

    // Header - Black & White optimized
    doc.setFontSize(type === 'receipt' ? 18 : 20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    
    if (type === 'receipt') {
      doc.text('DELIVERY RECEIPT', pageWidth / 2, yPos, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Receipt #${invoice.invoice_number}`, pageWidth / 2, yPos + 7, { align: 'center' });
    } else {
      doc.text('INVOICE', pageWidth / 2, yPos, { align: 'center' });
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoice #${invoice.invoice_number}`, pageWidth / 2, yPos + 7, { align: 'center' });
    }
    
    yPos += 20;

    // Company Info - Minimal styling for B&W
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text('Your Company Name', margin, yPos + 5);
    doc.text('Business Address Line 1', margin, yPos + 10);
    doc.text('Business Address Line 2', margin, yPos + 15);
    doc.text('Phone: (000) 000-0000', margin, yPos + 20);

    // Branch Info
    doc.setFont('helvetica', 'bold');
    doc.text('TO:', pageWidth - margin - 50, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.branch_name || 'N/A', pageWidth - margin - 50, yPos + 5);

    yPos += 30;

    // Details section - Simple layout
    const invoiceDate = new Date(invoice.created_at);
    const deliveryDate = invoice.delivery_date ? new Date(invoice.delivery_date) : null;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Date:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceDate.toLocaleDateString('en-GH', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }), margin + 25, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', margin + 70, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1), margin + 85, yPos);
    
    yPos += 8;
    
    if (deliveryDate) {
      doc.setFont('helvetica', 'bold');
      doc.text('Delivery Date:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(deliveryDate.toLocaleDateString('en-GH', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }), margin + 25, yPos);
    }

    if (invoice.delivered_by_name) {
      doc.setFont('helvetica', 'bold');
      doc.text('Delivered By:', margin, yPos + (deliveryDate ? 8 : 0));
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.delivered_by_name || 'Not specified', margin + 25, yPos + (deliveryDate ? 8 : 0));
    }

    yPos += (deliveryDate ? 20 : 12);

    // Horizontal line separator
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.2);
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);

    // Calculate available width for table
    const availableWidth = pageWidth - (margin * 2); // Total space available
    
    // Items Table - Stretched to full width
    const tableHeaders = [
      ['#', 'Product', 'SKU', 'Qty Req', 'Qty Del', 'Unit Price', 'Total']
    ];
    
    const tableData = invoice.items?.map((item, index) => [
      (index + 1).toString(),
      item.product_name.substring(0, 30), // Increased from 20 to 30 since we have more space
      item.product_sku.substring(0, 12), // Increased from 8 to 12
      item.quantity_requested.toString(),
      item.quantity_delivered.toString(),
      `GHC ${item.unit_price.toFixed(2)}`,
      `GHC ${item.total_price.toFixed(2)}`
    ]) || [];

    autoTable(doc, {
      startY: yPos,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontSize: 8,
        fontStyle: 'bold',
        lineColor: [0, 0, 0],
        lineWidth: 0.2
      },
      bodyStyles: {
        fontSize: 8, // Slightly larger since we have more space
        textColor: [0, 0, 0],
        cellPadding: 2,
        lineColor: [100, 100, 100],
        lineWidth: 0.1
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: margin, right: margin },
      // Stretch table to full available width
      tableWidth: availableWidth,
      // Column widths as percentages of available space
      columnStyles: {
        0: { cellWidth: availableWidth * 0.04, halign: 'center' },   // # - 4%
        1: { cellWidth: availableWidth * 0.45, halign: 'left' },     // Product - 45% (largest)
        2: { cellWidth: availableWidth * 0.15, halign: 'left' },     // SKU - 15%
        3: { cellWidth: availableWidth * 0.08, halign: 'center' },   // Qty Req - 8%
        4: { cellWidth: availableWidth * 0.08, halign: 'center' },   // Qty Del - 8%
        5: { cellWidth: availableWidth * 0.10, halign: 'right' },    // Unit Price - 10%
        6: { cellWidth: availableWidth * 0.10, halign: 'right' }     // Total - 10%
      },
      styles: {
        overflow: 'linebreak',
        cellPadding: 3
      },
      didDrawPage: function (data: any) {
        // Add page numbers for multi-page invoices
        if (data.pageCount > 1) {
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(
            `Page ${data.pageNumber} of ${data.pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
          );
        }
      }
    });

    // Totals section - VAT completely removed
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Horizontal line before totals
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY - 5, pageWidth - margin, finalY - 5);
    
    // Left aligned summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(type === 'receipt' ? 'RECEIPT SUMMARY' : 'INVOICE SUMMARY', margin, finalY);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Items: ${invoice.total_items}`, margin, finalY + 7);
    doc.text(`Quantity: ${invoice.total_quantity}`, margin, finalY + 14);
    
    // Right aligned totals
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const totalText = type === 'receipt' ? 'Total Amount:' : 'Invoice Total:';
    doc.text(totalText, pageWidth - margin - 60, finalY + 7, { align: 'right' });
    
    doc.setFontSize(14);
    doc.text(`GHC ${invoice.total_amount.toFixed(2)}`, pageWidth - margin, finalY + 7, { align: 'right' });

    // Horizontal line after totals
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY + 15, pageWidth - margin, finalY + 15);

    // Footer - Minimal for B&W
    const pageHeight = doc.internal.pageSize.height;
    
    // Signature section for receipts
    if (type === 'receipt') {
      const signatureY = pageHeight - 30;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text('Acknowledgement of Delivery', margin, signatureY);
      doc.text('Branch Manager Signature:', margin, signatureY + 5);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.line(margin + 50, signatureY + 5, margin + 150, signatureY + 5);
      doc.text('Date:', pageWidth - margin - 40, signatureY + 5);
      doc.line(pageWidth - margin - 20, signatureY + 5, pageWidth - margin, signatureY + 5);
    }
    
    // Footer text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    
    const footerY = pageHeight - 10;
    doc.text('This is a computer generated document.', pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Printed: ${new Date().toLocaleDateString('en-GH', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, pageWidth / 2, footerY + 4, { align: 'center' });

    // Save the PDF
    const fileName = type === 'receipt' 
      ? `delivery-receipt-${invoice.invoice_number}.pdf`
      : `invoice-${invoice.invoice_number}.pdf`;
    
    doc.save(fileName);
    
    toast.success(`${type === 'receipt' ? 'Delivery receipt' : 'Invoice'} downloaded successfully`);
    return true;
  } catch (error: any) {
    console.error('Download error:', error);
    toast.error('Failed to download document', {
      description: error.message || 'Please try again'
    });
    return false;
  } finally {
    setDownloading(null);
  }
}, [getInvoiceDetails]);

  // Quick download (automatically detects type)
  const quickDownload = useCallback(async (invoiceNumber: string, requestStatus?: string) => {
    try {
      const invoice = await getInvoiceDetails(invoiceNumber);
      if (!invoice) {
        toast.error('Invoice not found');
        return false;
      }

      // Determine type based on status
      const type = invoice.status === 'delivered' || invoice.delivery_date 
        ? 'receipt' 
        : 'invoice';
      
      return await downloadInvoice(invoiceNumber, type);
    } catch (error: any) {
      toast.error('Download failed', {
        description: error.message || 'Please try again'
      });
      return false;
    }
  }, [getInvoiceDetails, downloadInvoice]);

  return {
    // State
    loading,
    downloading,
    invoiceDetails,
    
    // Actions
    viewInvoice,
    viewDeliveryReceipt,
    downloadInvoice,
    quickDownload,
    getInvoiceDetails,
    
    // Reset
    resetInvoiceDetails: () => setInvoiceDetails(null)
  };
};