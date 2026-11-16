export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  wholesale_price?: number; // Add this
  low_stock_threshold: number;
  company_id: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  restock_request_id: string;
  company_id: string;
  branch_id: string;
  requested_by: string;
  approved_by?: string;
  total_amount: number;
  total_items: number;
  total_quantity: number;
  status: 'generated' | 'delivered' | 'cancelled';
  notes?: string;
  generated_at: string;
  delivered_at?: string;
  delivery_date?: string;
  delivered_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  restock_request_id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity_requested: number;
  quantity_delivered: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
}

export interface InvoiceDeliveryData {
  invoice_number: string;
  request_id: string;
  delivered_by: string;
  delivery_date: string;
  items: Array<{
    product_id: string;
    quantity_delivered: number;
    notes?: string;
  }>;
  notes?: string;
}

export interface Branch {
  id: string;
  name: string;
  company_id: string;
  sales_type: 'retail' | 'wholesale' | 'both'; // Add this
  created_at: string;
}

export interface BranchInventory {
  branch_id: string;
  product_id: string;
  quantity: number;
  low_stock: boolean;
}

export interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  company_id: string;
  role: string;
  sales_type?: 'retail' | 'wholesale' | 'both'; // Add this
  branch_id?: string;
  branch_name?: string;
}

export interface RestockRequest {
  id: string;
  company_id: string;
  branch_id: string;
  product_id: string;
  requested_by: string;
  requested_quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  delivery_status?: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  delivery_date?: string;
  delivered_by?: string;
  invoice_number?: string;
  invoice_id?: string;
  created_at: string;
  product_name?: string;
  branch_name?: string;
  staff_name?: string;
  users?: {
    full_name: string;
    email: string;
    phone?: string;
  };
  products?: {
    name: string;
    sku: string;
    price: number;
  };
  branches?: {
    name: string;
    location?: string;
  };
  notes?: string;
  admin_notes?: string;
  fulfilled_at?: string;
  fulfilled_quantity?: number;
  approved_at?: string;
  rejected_at?: string;
}


export interface Sale {
  id: string;
  company_id: string;
  branch_id: string;
  salesperson_id: string;
  total: number;
  sales_type?: 'retail' | 'wholesale'; // Add this
  created_at: string;
}

export interface DashboardStats {
  totalSales: number;
  totalProducts: number;
  lowStockCount: number;
  activeStaff: number;
  pendingRequests: number;
  totalRevenue: number;
  totalInvoices?: number; // Add this
  pendingDeliveries?: number; // Add this
}

// Add to your existing types
interface DateRange {
  from: string; // ISO string
  to: string; // ISO string
}

interface HistoryFilters {
  dateRange: DateRange;
  status: 'all' | 'completed' | 'returned';
}

interface ReturnsFilters {
  dateRange: DateRange;
  status: 'all' | 'pending' | 'completed' | 'rejected';
}

interface RestockFilters {
  dateRange: DateRange;
  status: 'all' | 'pending' | 'approved' | 'rejected' | 'fulfilled';
}