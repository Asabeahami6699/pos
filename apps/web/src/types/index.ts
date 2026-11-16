// src/types/index.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  wholesale_price?: number;
  sku: string;
  stock?: number;
  company_id: string;
  last_updated?: string;
  is_low_stock?: boolean;
  category?: string;
  low_stock_threshold?: number; // Add this field
  cost_price?: number; // Add for invoice calculations
  description?: string;
  image_url?: string | null;
  barcode?: string | null;
  images?: string[];
  specifications?: any;
}

export interface Branch {
  id: string;
  name: string;
  company_id: string;
  sales_type: 'retail' | 'wholesale' | 'both';
  address?: string; // Add for invoice display
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface Payment {
  method: 'cash' | 'mobile_money' | 'card' | 'split';
  amount: number;
  reference?: string;
  notes?: string;
}

export interface Customer {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface User {
  id: string;
  email?: string;
  full_name?: string;
  role: string;
  sales_type: 'retail' | 'wholesale';
  company_id?: string;
  phone?: string;
}

// src/types.ts
export type UserRole = 'super_admin' | 'company_admin' | 'salesperson' | 'customer';

// Updated RestockRequest with invoice and delivery fields
// Updated RestockRequest with invoice and delivery fields
export interface RestockRequest {
  id: string;
  product_id: string;
  requested_quantity: number;
  company_id: string;
  branch_id: string;
  created_at: string;
  items: any[] | null; // JSONB field
  notes: string | null;
  admin_notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  delivery_status: 'pending' | 'in_transit' | 'delivered' | 'cancelled' | null;
  delivery_date: string | null;
  delivered_by: string | null;
  requested_by: string;
  invoice_number: string | null;
  fulfilled_at: string | null;
  fulfilled_quantity: number | null;
  approved_at: string | null;
  rejected_at: string | null;

  // ✅ ADDED: Enriched product fields (populated by useRestockRequests hook)
  product_name?: string;
  product_sku?: string;
  product_price?: number;
  
  // Relations
  users?: {
    full_name: string;
    email: string;
    phone?: string;
  };
  products?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    wholesale_price?: number;
    cost_price?: number;
  };
  delivered_by_user?: {
    full_name: string;
    email: string;
  };
  branch?: {
    name: string;
    address?: string;
  };
}

// New Invoice Types
export interface RestockInvoice {
  id: string;
  invoice_number: string;
  restock_request_id: string;
  branch_id: string;
  company_id: string;
  total_items: number;
  total_quantity: number;
  total_amount: number;
  delivered_by: string;
  delivery_date: string;
  status: 'pending' | 'delivered' | 'verified' | 'disputed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at?: string;
  created_by: string;
  
  // Relations
  branch?: Branch;
  delivered_by_user?: User;
  created_by_user?: User;
  restock_request?: RestockRequest;
  items?: RestockInvoiceItem[];
}

export interface RestockInvoiceItem {
  id: string;
  restock_request_id: string;
  product_id: string;
  quantity_requested: number;
  quantity_delivered: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  
  // Relations
  product?: Product;
}

export interface Return {
  id: string;
  sale_id: string;
  company_id: string;
  branch_id: string;
  salesperson_id: string;
  total_refund: number;
  reason: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  sales_type: 'retail' | 'wholesale' | 'both';
  rejection_reason?: string;
  
  // Relations
  staff?: {
    full_name: string;
  };
  resolved_by_user?: {
    full_name: string;
  };
  return_items?: Array<{
    id: string;
    product_id: string;
    quantity: number;
    price: number;
    refund_amount: number;
    restocked: boolean;
    restocked_at?: string;
    sales_type: string;
    products?: Product;
  }>;
  branches?: {
    name: string;
    address?: string;
  };
}

export interface Sale {
  id: string;
  created_at: string;
  total: number;
  sales_type: 'retail' | 'wholesale';
  payment_method: string;
  customer_name: string | null;
  customer_id?: string;
  branch_id: string;
  company_id: string;
  salesperson_id: string;
  discount_amount?: number;
  tax_amount?: number;
  subtotal?: number;
  sale_items?: SaleItem[];
  
  // Relations
  users?: {
    full_name: string;
    email?: string;
  };
  customer?: Customer;
  branch?: Branch;
  
  // Return info
  return_status?: 'none' | 'partially_returned' | 'fully_returned';
  refunded_amount?: number;
  return_id?: string;
  returns?: Return[];
}

export type ActiveTab = 'products' | 'history' | 'returns' | 'restock' | 'invoices' | 'reports';

export interface RealTimeNotification {
  id: string;
  type: 'price' | 'stock' | 'product' | 'sale' | 'restock' | 'low_stock' | 'return' | 'delivery' | 'invoice';
  title: string;
  description: string;
  icon: string;
  timestamp: Date;
  productId?: string;
  invoiceNumber?: string;
  requestId?: string;
  seen: boolean;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface HistoryFilters {
  dateRange: DateRange;
  status: 'all' | 'completed' | 'returned';
  salesType?: 'all' | 'retail' | 'wholesale';
  paymentMethod?: 'all' | 'cash' | 'mobile_money' | 'card' | 'split';
}

export interface ReturnsFilters {
  dateRange: DateRange;
  status: 'all' | 'pending' | 'completed' | 'rejected';
  salesType?: 'all' | 'retail' | 'wholesale';
}

export interface RestockFilters {
  dateRange: DateRange;
  status: 'all' | 'pending' | 'approved' | 'rejected' | 'fulfilled';
  deliveryStatus?: 'all' | 'pending' | 'in_transit' | 'delivered' | 'cancelled';
}

export interface InvoiceFilters {
  dateRange: DateRange;
  status: 'all' | 'pending' | 'delivered' | 'verified' | 'disputed';
  search?: string;
}

export interface BranchInventory {
  product_id: string;
  branch_id: string;
  quantity: number;
  last_updated: string;
  low_stock?: boolean;
  retail_quantity?: number;
  wholesale_quantity?: number;
  company_id?: string;
  
  // Relations
  product?: Product;
  branch?: Branch;
}

export interface SaleItem {
  id?: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  price: number;
  original_price?: number;
  wholesale_price?: number;
  sales_type: 'retail' | 'wholesale';
  created_at?: string;
  discount_amount?: number;
  total_price?: number;
  
  // Relations
  product?: Product;
  sale?: Sale;
}

// New interface for invoice creation
export interface InvoiceCreationData {
  restockRequestId: string;
  branchId: string;
  companyId: string;
  items: InvoiceItemData[];
  deliveredBy: string;
  deliveryDate?: Date;
  notes?: string;
}

export interface InvoiceItemData {
  product_id: string;
  quantity_requested: number;
  quantity_delivered: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

// Interface for goods verification
export interface GoodsVerification {
  invoice_id: string;
  verified_by: string;
  verification_date: string;
  quantity_match: boolean;
  quality_ok: boolean;
  sku_match: boolean;
  notes?: string;
  discrepancies?: Array<{
    product_id: string;
    expected_quantity: number;
    actual_quantity: number;
    notes: string;
  }>;
}

// Interface for delivery discrepancy report
export interface DeliveryDiscrepancy {
  id: string;
  invoice_id: string;
  reported_by: string;
  issue_type: 'quantity_mismatch' | 'damaged_goods' | 'wrong_product' | 'price_discrepancy';
  description: string;
  status: 'pending' | 'investigating' | 'resolved' | 'rejected';
  reported_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  
  // Relations
  invoice?: RestockInvoice;
  reporter?: User;
  resolver?: User;
}
// src/types/analytics.ts
export interface AnalyticsData {
  overview: OverviewMetrics;
  traffic: TrafficMetrics;
  sales: SalesMetrics;
  inventory: InventoryMetrics;
  warehouse: WarehouseMetrics;
  revenueData: RevenueDataPoint[];
  orderData: OrderDataPoint[];
}

export interface OverviewMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  revenueGrowth: number;
  orderGrowth: number;
}

export interface TrafficMetrics {
  totalVisitors: number;
  bounceRate: number;
  averageSessionDuration: number;
  newVisitors: number;
  returningVisitors: number;
  sources: TrafficSources;
}

export interface TrafficSources {
  direct: number;
  organic: number;
  referral: number;
  social: number;
}

export interface SalesMetrics {
  totalSales: number;
  refundedOrders: number;
  netSales: number;
  refundRate: number;
  topProducts: TopProduct[];
}

export interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
}

export interface InventoryMetrics {
  totalProducts: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
  turnoverRate: number;
  categoryDistribution: CategoryDistribution[];
}

export interface CategoryDistribution {
  category: string;
  value: number;
  count: number;
}

export interface WarehouseMetrics {
  totalWarehouses: number;
  totalCapacity: number;
  usedCapacity: number;
  utilizationRate: number;
  warehouseEfficiency: number;
  shippingPerformance: number;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  profit: number;
}

export interface OrderDataPoint {
  month: string;
  orders: number;
  avgValue: number;
}

export type TimeRange = 'last7days' | 'last30days' | 'last90days' | 'last6months' | 'lastYear' | 'all';

export interface AnalyticsFilters {
  timeRange: TimeRange;
  category: string;
  warehouse: string;
  branch: string;
}