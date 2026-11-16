// services/invoiceService.ts
import { supabase } from '../lib/supabase';

export interface InvoiceItem {
  product_id: string;
  quantity_requested: number;
  quantity_delivered: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

export interface CreateInvoiceParams {
  restockRequestId: string;
  branchId: string;
  companyId: string;
  items: InvoiceItem[];
  deliveredBy: string;
  deliveryDate?: Date;
  notes?: string;
}

export class InvoiceService {
  // Generate unique invoice number
  private static generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}${day}-${random}`;
  }

  // Create restock invoice
  static async createRestockInvoice(params: CreateInvoiceParams) {
    const invoiceNumber = this.generateInvoiceNumber();
    
    // Calculate totals
    const totalItems = params.items.length;
    const totalQuantity = params.items.reduce((sum, item) => sum + item.quantity_delivered, 0);
    const totalAmount = params.items.reduce((sum, item) => sum + item.total_price, 0);

    try {
      // Start a transaction
      const { data: invoice, error: invoiceError } = await supabase
        .from('restock_invoices')
        .insert({
          invoice_number: invoiceNumber,
          restock_request_id: params.restockRequestId,
          branch_id: params.branchId,
          company_id: params.companyId,
          total_items: totalItems,
          total_quantity: totalQuantity,
          total_amount: totalAmount,
          delivered_by: params.deliveredBy,
          delivery_date: params.deliveryDate || new Date(),
          status: 'delivered',
          notes: params.notes,
          created_at: new Date(),
          created_by: params.deliveredBy
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert invoice items
      const invoiceItems = params.items.map(item => ({
        restock_request_id: params.restockRequestId,
        product_id: item.product_id,
        quantity_requested: item.quantity_requested,
        quantity_delivered: item.quantity_delivered,
        unit_price: item.unit_price,
        total_price: item.total_price,
        notes: item.notes
      }));

      const { error: itemsError } = await supabase
        .from('restock_invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      // Update the restock request status
      const { error: updateError } = await supabase
        .from('restock_requests')
        .update({
          status: 'completed',
          delivery_status: 'delivered',
          delivery_date: new Date(),
          delivered_by: params.deliveredBy,
          invoice_number: invoiceNumber
        })
        .eq('id', params.restockRequestId);

      if (updateError) throw updateError;

      // Update branch inventory stock
      for (const item of params.items) {
        const { error: inventoryError } = await supabase.rpc('update_branch_inventory', {
          p_branch_id: params.branchId,
          p_product_id: item.product_id,
          p_quantity: item.quantity_delivered
        });

        if (inventoryError) {
          console.error(`Failed to update inventory for product ${item.product_id}:`, inventoryError);
        }
      }

      return invoice;
    } catch (error) {
      console.error('Error creating restock invoice:', error);
      throw error;
    }
  }

  // Get invoice by ID
  static async getInvoiceById(invoiceId: string) {
    const { data, error } = await supabase
      .from('restock_invoices')
      .select(`
        *,
        branch:branches(name, address),
        delivered_by_user:users!restock_invoices_delivered_by_fkey(full_name, email),
        created_by_user:users!restock_invoices_created_by_fkey(full_name, email),
        restock_request:restock_requests(*),
        items:restock_invoice_items(
          *,
          product:products(name, sku, price, wholesale_price)
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (error) throw error;
    return data;
  }

  // Get invoices by branch
  static async getInvoicesByBranch(branchId: string, filters = {}) {
    let query = supabase
      .from('restock_invoices')
      .select(`
        *,
        delivered_by_user:users!restock_invoices_delivered_by_fkey(full_name),
        items:restock_invoice_items(count)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (filters) {
      // Add filter logic here
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Print/Download invoice as PDF
  static async generateInvoicePDF(invoiceId: string) {
    const invoice = await this.getInvoiceById(invoiceId);
    
    // This would integrate with a PDF generation service
    // For now, return the data that would be used for PDF
    return {
      invoice,
      pdfData: this.formatInvoiceForPDF(invoice)
    };
  }

  private static formatInvoiceForPDF(invoice: any) {
    return {
      invoiceNumber: invoice.invoice_number,
      date: invoice.delivery_date,
      branch: invoice.branch,
      items: invoice.items,
      totals: {
        totalItems: invoice.total_items,
        totalQuantity: invoice.total_quantity,
        totalAmount: invoice.total_amount
      },
      deliveredBy: invoice.delivered_by_user,
      notes: invoice.notes
    };
  }
}