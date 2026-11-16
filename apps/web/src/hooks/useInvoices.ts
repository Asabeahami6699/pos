import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const useInvoices = (companyId?: string, userRole?: string, userId?: string) => {
  const [loading, setLoading] = useState(false);

  // Helper function to enrich items with product data
  const enrichInvoiceItems = async (items: any[], requestItems: any[]) => {
    if (!items || items.length === 0) {
      // If no invoice items, try to create from request items
      return requestItems?.map((item: any) => {
        const productPrice = item.product_price || 0;
        const quantity = item.requested_quantity || item.quantity || 0;
        
        return {
          product_id: item.product_id,
          product_name: item.product_name || 'Product',
          product_sku: item.product_sku || 'N/A',
          product_price: productPrice,
          quantity_requested: quantity,
          quantity_delivered: 0,
          unit_price: productPrice,
          total_price: productPrice * quantity,
          notes: item.notes || ''
        };
      }) || [];
    }

    // Get all product IDs from items
    const productIds = items
      .map(item => item.product_id)
      .filter(Boolean)
      .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates

    // Fetch products in one query
    let productsMap = new Map();
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, price, wholesale_price')
        .in('id', productIds);

      if (products) {
        productsMap = new Map(products.map(p => [p.id, p]));
      }
    }

    // Enrich items with product data
    return items.map((item: any) => {
      const product = productsMap.get(item.product_id);
      const unitPrice = item.unit_price || product?.price || 0;
      const quantityRequested = item.quantity_requested || 0;
      const quantityDelivered = item.quantity_delivered || 0;
      
      return {
        ...item,
        product_name: product?.name || item.product_name || 'Unknown Product',
        product_sku: product?.sku || item.product_sku || 'N/A',
        product_price: unitPrice,
        unit_price: unitPrice,
        total_price: item.total_price || (unitPrice * quantityDelivered) || 0,
        quantity_requested: quantityRequested,
        quantity_delivered: quantityDelivered
      };
    });
  };

  // Get invoice by number - FIXED VERSION
  const getInvoiceByNumber = useCallback(async (invoiceNumber: string) => {
    console.log('Fetching invoice:', invoiceNumber);
    
    try {
      // First try to get from restock_requests (where your data is)
      const { data: requestData, error: requestError } = await supabase
        .from('restock_requests')
        .select(`
          *,
          products:product_id (name, sku, price, wholesale_price),
          branches!inner (name, location, address),
          users!restock_requests_requested_by_fkey (full_name, email, phone)
        `)
        .eq('invoice_number', invoiceNumber)
        .single();

      if (requestError) {
        console.log('Not found in restock_requests, trying restock_invoices');
        // Fallback to restock_invoices
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('restock_invoices')
          .select(`
            *,
            restock_requests!inner (
              *,
              products:product_id (name, sku, price),
              branches!inner (name, location),
              users!restock_requests_requested_by_fkey (full_name, email)
            )
          `)
          .eq('invoice_number', invoiceNumber)
          .single();

        if (invoiceError) throw invoiceError;
        return invoiceData;
      }

      console.log('Found request data:', requestData);

      if (!requestData) {
        toast.error('Invoice not found');
        return null;
      }

      // Get invoice items from restock_invoice_items if they exist
      let invoiceItems: any[] = [];
      try {
        const { data: itemsData } = await supabase
          .from('restock_invoice_items')
          .select('*')
          .eq('restock_request_id', requestData.id);
        
        invoiceItems = itemsData || [];
        console.log('Found invoice items:', invoiceItems);
      } catch (itemsError) {
        console.log('No invoice items found, using request items');
      }

      // Enrich items
      const enrichedItems = await enrichInvoiceItems(invoiceItems, requestData.items || []);

      console.log('Enriched items:', enrichedItems);

      // Calculate totals
      const totalQuantity = enrichedItems.reduce((sum: number, item: any) => 
        sum + (item.quantity_requested || 0), 0);
      const totalAmount = enrichedItems.reduce((sum: number, item: any) => 
        sum + (item.total_price || 0), 0);

      // Construct invoice object
      const invoice = {
        id: requestData.id,
        invoice_number: requestData.invoice_number,
        restock_request_id: requestData.id,
        branch_id: requestData.branch_id,
        company_id: requestData.company_id,
        total_items: enrichedItems.length,
        total_quantity: totalQuantity,
        total_amount: totalAmount,
        delivered_by: requestData.delivered_by,
        delivery_date: requestData.delivery_date,
        status: requestData.status === 'fulfilled' ? 'delivered' : 
                requestData.status === 'approved' ? 'pending' : 
                requestData.status,
        notes: requestData.notes || requestData.admin_notes,
        created_at: requestData.created_at,
        created_by: requestData.requested_by,
        
        // Items for display
        items: enrichedItems,
        restock_invoice_items: enrichedItems,
        
        // Relation data for modal
        restock_requests: {
          ...requestData,
          product_name: requestData.products?.name,
          product_sku: requestData.products?.sku,
          product_price: requestData.products?.price,
          branch_name: requestData.branches?.name,
          branch_address: requestData.branches?.address,
          staff_name: requestData.users?.full_name,
          staff_email: requestData.users?.email
        },
        
        // Convenience fields
        delivered_by_name: requestData.delivered_by_user?.full_name,
        branch_name: requestData.branches?.name,
        branch_address: requestData.branches?.address
      };

      console.log('Final invoice object:', invoice);
      return invoice;
      
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      toast.error(error.message || 'Invoice not found');
      return null;
    }
  }, []);

  // Get all invoices
  const getInvoices = useCallback(async (filters = {}) => {
    if (!companyId) return [];
    
    setLoading(true);
    try {
      // Get all requests with invoice numbers
      const { data, error } = await supabase
        .from('restock_requests')
        .select(`
          *,
          products:product_id (name, sku, price),
          branches!inner (name, location, address),
          users!restock_requests_requested_by_fkey (full_name, email, phone)
        `)
        .eq('company_id', companyId)
        .not('invoice_number', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform into invoice format
      const invoices = await Promise.all(
        (data || []).map(async (request: any) => {
          // Get items from restock_invoice_items if they exist
          let items: any[] = [];
          try {
            const { data: itemsData } = await supabase
              .from('restock_invoice_items')
              .select('*')
              .eq('restock_request_id', request.id);
            
            items = itemsData || [];
          } catch (error) {
            items = request.items || [];
          }

          // Enrich items
          const enrichedItems = await enrichInvoiceItems(items, request.items || []);
          
          const totalQuantity = enrichedItems.reduce((sum: number, item: any) => 
            sum + (item.quantity_requested || 0), 0);
          const totalAmount = enrichedItems.reduce((sum: number, item: any) => 
            sum + (item.total_price || 0), 0);

          return {
            id: request.id,
            invoice_number: request.invoice_number,
            restock_request_id: request.id,
            branch_id: request.branch_id,
            company_id: request.company_id,
            total_items: enrichedItems.length,
            total_quantity: totalQuantity,
            total_amount: totalAmount,
            delivered_by: request.delivered_by,
            delivery_date: request.delivery_date,
            status: request.status === 'fulfilled' ? 'delivered' : 
                    request.status === 'approved' ? 'pending' : 
                    request.status,
            notes: request.notes,
            created_at: request.created_at,
            created_by: request.requested_by,
            
            // For table display
            restock_requests: {
              ...request,
              product_name: request.products?.name,
              product_sku: request.products?.sku,
              product_price: request.products?.price,
              branch_name: request.branches?.name,
              staff_name: request.users?.full_name
            },
            items: enrichedItems
          };
        })
      );

      return invoices;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
      return [];
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Generate PDF (same as before)
  const generateInvoicePDF = useCallback(async (invoiceNumber: string) => {
    try {
      const invoice = await getInvoiceByNumber(invoiceNumber);
      if (!invoice) {
        toast.error('Invoice not found');
        return false;
      }

      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text('DELIVERY INVOICE', 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Invoice #${invoiceNumber}`, 105, 30, { align: 'center' });
      
      // Details
      doc.setFontSize(10);
      let yPos = 50;
      
      doc.text(`Branch: ${invoice.branch_name || invoice.restock_requests?.branches?.name || 'N/A'}`, 20, yPos);
      if (invoice.branch_address || invoice.restock_requests?.branches?.address) {
        doc.text(`Address: ${invoice.branch_address || invoice.restock_requests?.branches?.address}`, 20, yPos + 7);
        yPos += 7;
      }
      
      yPos += 7;
      doc.text(`Invoice Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 20, yPos);
      doc.text(`Status: ${invoice.status}`, 120, yPos);
      
      yPos += 7;
      if (invoice.delivered_by_name || invoice.restock_requests?.delivered_by_user?.full_name) {
        doc.text(`Delivered By: ${invoice.delivered_by_name || invoice.restock_requests?.delivered_by_user?.full_name}`, 20, yPos);
      }
      if (invoice.delivery_date) {
        doc.text(`Delivery Date: ${new Date(invoice.delivery_date).toLocaleDateString()}`, 120, yPos);
      }
      
      // Requested By
      if (invoice.restock_requests?.staff_name) {
        yPos += 14;
        doc.text(`Requested By: ${invoice.restock_requests.staff_name}`, 20, yPos);
        if (invoice.restock_requests.staff_email) {
          doc.text(`Email: ${invoice.restock_requests.staff_email}`, 20, yPos + 7);
        }
      }
      
      // Items table
      const tableY = yPos + 20;
      const items = invoice.items || invoice.restock_invoice_items || [];
      
      const tableData = items.map((item: any, index: number) => [
        index + 1,
        item.product_name || 'Unknown Product',
        item.product_sku || 'N/A',
        item.quantity_requested || 0,
        item.quantity_delivered || 0,
        `₵${(item.unit_price || 0).toFixed(2)}`,
        `₵${(item.total_price || 0).toFixed(2)}`
      ]);
      
      autoTable(doc, {
        startY: tableY,
        head: [['#', 'Product', 'SKU', 'Requested', 'Delivered', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { top: 10 }
      });
      
      // Totals
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.text('Summary', 20, finalY);
      
      doc.setFontSize(10);
      const totalItems = items.length;
      const totalQuantity = items.reduce((sum: number, item: any) => 
        sum + (item.quantity_delivered || item.quantity_requested || 0), 0);
      
      doc.text(`Total Items: ${totalItems}`, 20, finalY + 10);
      doc.text(`Total Quantity: ${totalQuantity}`, 20, finalY + 17);
      doc.text(`Total Amount: ₵${(invoice.total_amount || 0).toFixed(2)}`, 20, finalY + 24);
      
      // Save
      doc.save(`invoice-${invoiceNumber}.pdf`);
      toast.success(`Invoice ${invoiceNumber} downloaded`);
      return true;
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
      return false;
    }
  }, [getInvoiceByNumber]);

  // Update delivery status
  const updateDeliveryStatus = useCallback(async (invoiceNumber: string, status: 'delivered' | 'cancelled', deliveredBy?: string) => {
    if (userRole !== 'admin') {
      toast.error('Only admin can update delivery status');
      return false;
    }
    
    try {
      const updateData: any = { 
        status: status === 'delivered' ? 'fulfilled' : 'cancelled',
        delivery_status: status,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'delivered') {
        updateData.delivery_date = new Date().toISOString();
        if (deliveredBy) {
          updateData.delivered_by = deliveredBy;
        }
      }
      
      const { error } = await supabase
        .from('restock_requests')
        .update(updateData)
        .eq('invoice_number', invoiceNumber);
      
      if (error) throw error;
      
      toast.success(`Invoice marked as ${status}`);
      return true;
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update invoice');
      return false;
    }
  }, [userRole]);

  return {
    loading,
    getInvoices,
    getInvoiceByNumber,
    generateInvoicePDF,
    updateDeliveryStatus
  };
};