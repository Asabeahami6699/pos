// C:\Users\HP\pos-inventory\src\hooks\useInvoiceManagement.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceItem {
  id?: string;
  restock_request_id: string;
  product_id: string;
  quantity_requested: number;
  quantity_delivered: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  
  // Enriched fields from joins
  product_name?: string;
  product_sku?: string;
  product_category?: string;
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
  delivered_by?: string;
  delivery_date?: string;
  status: 'pending' | 'delivered' | 'verified' | 'disputed' | 'cancelled';
  notes?: string;
  created_at: string;
  created_by: string;
  
  // Enriched relations
  items?: InvoiceItem[];
  branch_name?: string;
  delivered_by_name?: string;
  created_by_name?: string;
  requested_by_name?: string;
  requested_by_email?: string;
}

// Helper function to format currency with cedis
const formatCurrency = (amount: number): string => {
  return `₵${amount.toFixed(2)}`;
};

export const useInvoiceManagement = (
  companyId?: string,
  userRole?: string,
  userId?: string
) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

/**
 * Generate a new invoice from a restock request - WORKING VERSION
 */
const generateInvoice = useCallback(async (
  restockRequestId: string,
  createdByUserId: string
): Promise<{ success: boolean; invoiceNumber?: string; error?: string }> => {
  setGenerating(true);
  
  try {
    console.log('Starting invoice generation for request ID:', restockRequestId);
    console.log('Created by user ID:', createdByUserId);
    
    // Validate user ID
    if (!createdByUserId) {
      throw new Error('User ID is required for invoice creation');
    }

    // Step 1: Fetch restock request with all details
    const { data: restockRequest, error: fetchError } = await supabase
      .from('restock_requests')
      .select(`
        *,
        branches!inner (id, name),
        users!restock_requests_requested_by_fkey (id, full_name, email, phone)
      `)
      .eq('id', restockRequestId)
      .single();

    if (fetchError || !restockRequest) {
      console.error('Fetch restock request error:', fetchError);
      throw new Error('Restock request not found');
    }

    console.log('Restock request found:', restockRequest);

    // Check if invoice already exists
    if (restockRequest.invoice_number) {
      return {
        success: false,
        error: `Invoice ${restockRequest.invoice_number} already exists for this request`
      };
    }

    // Step 2: Parse items from JSONB and fetch product details
    const itemsArray = restockRequest.items as any[] || [];
    if (itemsArray.length === 0) {
      throw new Error('No items found in restock request');
    }

    const productIds = itemsArray.map((item: any) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, price, wholesale_price, category')
      .in('id', productIds);

    if (productsError || !products) {
      throw new Error('Failed to fetch product details');
    }

    // Create product lookup map
    const productMap = new Map(products.map(p => [p.id, p]));

    // Step 3: Calculate totals and prepare items
    let totalQuantity = 0;
    let totalAmount = 0;

    const invoiceItems = itemsArray.map((item: any) => {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new Error(`Product not found: ${item.product_id}`);
      }

      const quantity = item.requested_quantity || 0;
      const unitPrice = product.price || 0;
      const totalPrice = unitPrice * quantity;

      totalQuantity += quantity;
      totalAmount += totalPrice;

      return {
        product_id: item.product_id,
        quantity_requested: quantity,
        quantity_delivered: quantity, // For Fulfill & Invoice, mark as delivered
        unit_price: unitPrice,
        total_price: totalPrice
      };
    });

    // Step 4: Generate invoice number
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${timestamp}-${randomSuffix}`;

    // Step 5: Create invoice record - validate createdByUserId is a user
    console.log('Creating invoice with created_by:', createdByUserId);
    
    // Verify user exists before creating invoice
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', createdByUserId)
      .single();

    if (userError || !userData) {
      console.error('User verification error:', userError);
      throw new Error(`Invalid user ID: ${createdByUserId}. User not found in users table.`);
    }

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabase
      .from('restock_invoices')
      .insert({
        invoice_number: invoiceNumber,
        restock_request_id: restockRequestId,
        branch_id: restockRequest.branch_id,
        company_id: restockRequest.company_id,
        total_items: invoiceItems.length,
        total_quantity: totalQuantity,
        total_amount: totalAmount,
        status: 'pending',
        created_by: createdByUserId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      console.error('Invoice creation error:', invoiceError);
      throw new Error(`Failed to create invoice record: ${invoiceError?.message}`);
    }

    // Step 6: Create invoice items
    const invoiceItemsToInsert = invoiceItems.map(item => ({
      restock_request_id: restockRequestId,
      product_id: item.product_id,
      quantity_requested: item.quantity_requested,
      quantity_delivered: item.quantity_delivered,
      unit_price: item.unit_price,
      total_price: item.total_price,
      created_at: new Date().toISOString()
    }));

    const { error: itemsError } = await supabase
      .from('restock_invoice_items')
      .insert(invoiceItemsToInsert);

    if (itemsError) {
      console.error('Invoice items creation error:', itemsError);
      
      // Rollback: Delete the invoice
      await supabase
        .from('restock_invoices')
        .delete()
        .eq('id', invoice.id);
      
      throw new Error('Failed to create invoice items');
    }

    // Step 7: Update restock request
    const { error: updateError } = await supabase
      .from('restock_requests')
      .update({
        invoice_number: invoiceNumber,
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: createdByUserId
      })
      .eq('id', restockRequestId);

    if (updateError) {
      console.error('Update request error:', updateError);
      throw new Error('Failed to update restock request');
    }

    toast.success('Invoice Generated Successfully', {
      description: `Invoice ${invoiceNumber} created with ${invoiceItems.length} items`
    });

    return {
      success: true,
      invoiceNumber: invoiceNumber
    };

  } catch (error: any) {
    console.error('Generate invoice error:', error);
    toast.error('Failed to Generate Invoice', {
      description: error.message || 'An unexpected error occurred'
    });
    
    return {
      success: false,
      error: error.message || 'Failed to generate invoice'
    };
  } finally {
    setGenerating(false);
  }
}, [companyId]);



  /**
   * Get invoice details by invoice number - OPTIMIZED
   */
  const getInvoiceByNumber = useCallback(async (
    invoiceNumber: string
  ): Promise<InvoiceDetails | null> => {
    setLoading(true);
    
    try {
      // Try cache first
      const cacheKey = `invoice_cache_${invoiceNumber}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const cachedInvoice = JSON.parse(cached);
          return {
            ...cachedInvoice,
            id: '',
            restock_request_id: '',
            branch_id: '',
            company_id: '',
            delivered_by: '',
            delivery_date: '',
            notes: '',
            created_by: '',
            delivered_by_name: '',
            created_by_name: '',
            requested_by_name: '',
            requested_by_email: ''
          } as InvoiceDetails;
        } catch (e) {
          // Cache invalid, proceed to fetch
        }
      }

      // Fetch invoice with all related data in one query
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('restock_invoices')
        .select(`
          *,
          branch:branches!inner (name),
          delivered_by_user:users!delivered_by (full_name),
          created_by_user:users!created_by (full_name),
          restock_request:restock_requests!inner (
            users!restock_requests_requested_by_fkey (full_name, email)
          )
        `)
        .eq('invoice_number', invoiceNumber)
        .single();

      if (invoiceError || !invoiceData) {
        toast.error('Invoice not found');
        return null;
      }

      // Security check for salesperson
      if (userRole === 'salesperson' && userId) {
        const { data: userData } = await supabase
          .from('users')
          .select('branch_id')
          .eq('id', userId)
          .single();

        if (userData?.branch_id && invoiceData.branch_id !== userData.branch_id) {
          toast.error('Access denied - You can only view invoices from your branch');
          return null;
        }
      }

      // Fetch invoice items
      const { data: invoiceItems, error: itemsError } = await supabase
        .from('restock_invoice_items')
        .select(`
          *,
          product:products!product_id (name, sku, category, price)
        `)
        .eq('restock_request_id', invoiceData.restock_request_id);

      // Build enriched invoice
      const enrichedInvoice: InvoiceDetails = {
        id: invoiceData.id,
        invoice_number: invoiceData.invoice_number,
        restock_request_id: invoiceData.restock_request_id,
        branch_id: invoiceData.branch_id,
        company_id: invoiceData.company_id,
        total_items: invoiceData.total_items,
        total_quantity: invoiceData.total_quantity,
        total_amount: invoiceData.total_amount,
        delivered_by: invoiceData.delivered_by,
        delivery_date: invoiceData.delivery_date,
        status: invoiceData.status,
        notes: invoiceData.notes,
        created_at: invoiceData.created_at,
        created_by: invoiceData.created_by,
        items: (invoiceItems || []).map((item: any) => ({
          id: item.id,
          restock_request_id: item.restock_request_id,
          product_id: item.product_id,
          quantity_requested: item.quantity_requested,
          quantity_delivered: item.quantity_delivered,
          unit_price: item.unit_price,
          total_price: item.total_price,
          notes: item.notes,
          product_name: item.product?.name || 'Unknown Product',
          product_sku: item.product?.sku || 'N/A',
          product_category: item.product?.category
        })),
        branch_name: invoiceData.branch?.name,
        delivered_by_name: invoiceData.delivered_by_user?.full_name,
        created_by_name: invoiceData.created_by_user?.full_name,
        requested_by_name: invoiceData.restock_request?.users?.full_name,
        requested_by_email: invoiceData.restock_request?.users?.email
      };

      // Update cache
      localStorage.setItem(cacheKey, JSON.stringify({
        invoice_number: enrichedInvoice.invoice_number,
        branch_name: enrichedInvoice.branch_name,
        total_items: enrichedInvoice.total_items,
        total_quantity: enrichedInvoice.total_quantity,
        total_amount: enrichedInvoice.total_amount,
        items: enrichedInvoice.items,
        created_at: enrichedInvoice.created_at,
        status: enrichedInvoice.status
      }));

      return enrichedInvoice;

    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      toast.error('Failed to load invoice');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userRole, userId]);

  /**
   * Generate PDF for invoice - FAST VERSION with cedis
   */
  
const generatePDF = useCallback(async (invoiceNumber: string): Promise<boolean> => {
  setLoading(true);
  
  try {
    // Try to get cached data first for faster generation
    const cacheKey = `invoice_cache_${invoiceNumber}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    let invoice: InvoiceDetails;
    
    if (cachedData) {
      // Use cached data if available (partial data)
      const cachedInvoice = JSON.parse(cachedData);
      invoice = {
        ...cachedInvoice,
        id: '',
        restock_request_id: '',
        branch_id: '',
        company_id: '',
        delivered_by: '',
        delivery_date: '',
        status: 'pending',
        notes: '',
        created_at: new Date().toISOString(),
        created_by: '',
        delivered_by_name: '',
        created_by_name: '',
        requested_by_name: '',
        requested_by_email: ''
      } as InvoiceDetails;
    } else {
      // Fetch full invoice details
      const fetchedInvoice = await getInvoiceByNumber(invoiceNumber);
      if (!fetchedInvoice) {
        toast.error('Invoice not found');
        return false;
      }
      invoice = fetchedInvoice;
    }

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let yPos = 20;

    // Simple modern header with double underline
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth / 2, yPos, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.invoice_number, pageWidth / 2, yPos + 8, { align: 'center' });
    
    // Double underline
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, yPos + 12, pageWidth - margin, yPos + 12);
    doc.setLineWidth(0.2);
    doc.line(margin, yPos + 13, pageWidth - margin, yPos + 13);
    
    yPos += 25;

    // Clean info section - two columns
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Left column
    doc.text('Branch:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.branch_name || 'N/A', margin + 20, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Requested By:', margin, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.requested_by_name || 'N/A', margin + 35, yPos + 6);
    
    // Right column
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', pageWidth - margin - 60, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(invoice.created_at).toLocaleDateString('en-GH'), pageWidth - margin, yPos, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', pageWidth - margin - 60, yPos + 6);
    doc.setFont('helvetica', 'normal');
    // Status in bold for visibility
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.status.toUpperCase(), pageWidth - margin, yPos + 6, { align: 'right' });
    
    yPos += 15;

    // Simple separator line
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.1);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // Items Table - Simple and clean
    const tableHeaders = [['#', 'PRODUCT', 'QTY', 'UNIT PRICE', 'TOTAL']];
    const tableData = (invoice.items || []).map((item, index) => [
      (index + 1).toString(),
      (item.product_name || 'Product'),
      item.quantity_requested.toString(),
      `GHC ${parseFloat(item.unit_price.toString()).toFixed(2)}`,
      `GHC ${parseFloat(item.total_price.toString()).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [255, 255, 255],
        textColor: 0,
        fontSize: 10,
        cellPadding: 4,
        fontStyle: 'bold',
        lineWidth: 0.3,
        lineColor: [0, 0, 0]
      },
      bodyStyles: { 
        fontSize: 10,
        cellPadding: 4,
        lineWidth: 0.1,
        lineColor: [100, 100, 100]
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
        overflow: 'linebreak',
        lineColor: [100, 100, 100],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' }, // #
        1: { cellWidth: 90 }, // Product
        2: { cellWidth: 20, halign: 'center' }, // Qty
        3: { cellWidth: 30, halign: 'right' }, // Unit Price
        4: { cellWidth: 30, halign: 'right' } // Total
      },
      margin: { left: margin, right: margin },
      tableWidth: pageWidth - 2 * margin,
      // No alternating colors for better photocopy
      alternateRowStyles: {
        fillColor: [255, 255, 255] // All white for photocopy clarity
      }
    });

    // Simple Summary Section - Clean horizontal layout
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Summary header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SUMMARY', margin, finalY);
    
    // Add a thick line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, finalY + 2, pageWidth - margin, finalY + 2);
    
    yPos = finalY + 12;
    
    // Horizontal layout - three columns
    const colWidth = (pageWidth - 2 * margin) / 3;
    
    // Column 1: Total Items
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Items', margin + colWidth * 0.5, yPos, { align: 'center' });
    doc.setFontSize(12);
    doc.text(invoice.total_items.toString(), margin + colWidth * 0.5, yPos + 6, { align: 'center' });
    
    // Column 2: Total Quantity
    doc.setFontSize(10);
    doc.text('Total Quantity', margin + colWidth * 1.5, yPos, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`${invoice.total_quantity} units`, margin + colWidth * 1.5, yPos + 6, { align: 'center' });
    
    // Column 3: Total Amount
    doc.setFontSize(10);
    doc.text('Total Amount', margin + colWidth * 2.5, yPos, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`GHC ${parseFloat(invoice.total_amount.toString()).toFixed(2)}`, margin + colWidth * 2.5, yPos + 8, { align: 'center' });
    
    // Add simple vertical separators
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.1);
    doc.line(margin + colWidth, yPos - 4, margin + colWidth, yPos + 15);
    doc.line(margin + colWidth * 2, yPos - 4, margin + colWidth * 2, yPos + 15);
    
    yPos += 25;

    // Notes section if available
    if (invoice.notes && invoice.notes.trim()) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      
      // Handle long notes
      const maxWidth = pageWidth - 2 * margin - 15;
      const noteLines = doc.splitTextToSize(invoice.notes, maxWidth);
      doc.text(noteLines, margin + 15, yPos);
      
      yPos += (noteLines.length * 5) + 5;
    }

    // Simple footer for photocopy
    const pageHeight = doc.internal.pageSize.height;
    
    // Thin separator line
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.1);
    doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    // Generation info
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-GH')}`,
      margin,
      pageHeight - 18
    );
    
    // Page info
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.text(
      `Page 1 of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 18,
      { align: 'right' }
    );
    
    // Simple thank you message
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Thank you for your business',
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );

    // Save PDF
    doc.save(`${invoice.invoice_number}.pdf`);
    toast.success('Invoice PDF downloaded successfully');
    return true;

  } catch (error) {
    console.error('PDF generation error:', error);
    toast.error('Failed to generate PDF');
    return false;
  } finally {
    setLoading(false);
  }
}, [getInvoiceByNumber]);


  // Other functions (getAllInvoices, updateDeliveryStatus) remain the same
  const getAllInvoices = useCallback(async (filters?: {
    status?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<InvoiceDetails[]> => {
    if (!companyId) return [];
    
    setLoading(true);
    
    try {
      let query = supabase
        .from('restock_invoices')
        .select(`
          *,
          branch:branches!inner (name),
          delivered_by_user:users!delivered_by (full_name),
          created_by_user:users!created_by (full_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      // Salesperson filter
      if (userRole === 'salesperson' && userId) {
        const { data: userData } = await supabase
          .from('users')
          .select('branch_id')
          .eq('id', userId)
          .single();

        if (userData?.branch_id) {
          query = query.eq('branch_id', userData.branch_id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrich invoices with requested_by info
      const enrichedInvoices = await Promise.all(
        (data || []).map(async (inv: any) => {
          const { data: restockRequest } = await supabase
            .from('restock_requests')
            .select(`
              users!restock_requests_requested_by_fkey (full_name)
            `)
            .eq('id', inv.restock_request_id)
            .single();

          return {
            id: inv.id,
            invoice_number: inv.invoice_number,
            restock_request_id: inv.restock_request_id,
            branch_id: inv.branch_id,
            company_id: inv.company_id,
            total_items: inv.total_items,
            total_quantity: inv.total_quantity,
            total_amount: inv.total_amount,
            delivered_by: inv.delivered_by,
            delivery_date: inv.delivery_date,
            status: inv.status,
            notes: inv.notes,
            created_at: inv.created_at,
            created_by: inv.created_by,
            branch_name: inv.branch?.name,
            delivered_by_name: inv.delivered_by_user?.full_name,
            created_by_name: inv.created_by_user?.full_name,
            requested_by_name: restockRequest?.users?.full_name
          };
        })
      );

      return enrichedInvoices;

    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
      return [];
    } finally {
      setLoading(false);
    }
  }, [companyId, userRole, userId]);

  const updateDeliveryStatus = useCallback(async (
    invoiceNumber: string,
    status: 'delivered' | 'cancelled',
    deliveredBy?: string,
    deliveryNotes?: string
  ): Promise<boolean> => {
    if (userRole !== 'admin') {
      toast.error('Only admins can update delivery status');
      return false;
    }

    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'delivered') {
        updateData.delivery_date = new Date().toISOString();
        if (deliveredBy) {
          updateData.delivered_by = deliveredBy;
        }
        if (deliveryNotes) {
          updateData.notes = deliveryNotes;
        }
      }

      const { error } = await supabase
        .from('restock_invoices')
        .update(updateData)
        .eq('invoice_number', invoiceNumber);

      if (error) throw error;

      // Also update restock request
      await supabase
        .from('restock_requests')
        .update({
          delivery_status: status,
          delivery_date: status === 'delivered' ? new Date().toISOString() : null,
          delivered_by: status === 'delivered' ? deliveredBy : null
        })
        .eq('invoice_number', invoiceNumber);

      toast.success(`Invoice marked as ${status}`);
      return true;

    } catch (error) {
      console.error('Update delivery error:', error);
      toast.error('Failed to update delivery status');
      return false;
    }
  }, [userRole]);

  return {
    loading,
    generating,
    generateInvoice,
    getInvoiceByNumber,
    getAllInvoices,
    updateDeliveryStatus,
    generatePDF
  };
};