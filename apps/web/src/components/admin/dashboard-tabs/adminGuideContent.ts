export interface GuideStep {
  text: string;
}

export interface GuideSection {
  id: string;
  title: string;
  icon: string;
  summary: string;
  tabId?: string;
  steps: GuideStep[];
  tips?: string[];
}

export const adminGuideSections: GuideSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: '🚀',
    summary: 'First-time setup checklist for company admins.',
    steps: [
      { text: 'Confirm your company name appears in the sidebar header after login.' },
      { text: 'Create at least one branch under Branches (retail, wholesale, or both).' },
      { text: 'Add products in Inventory, then add stock to the Warehouse.' },
      { text: 'Allocate stock from Warehouse to branches so salespeople can sell.' },
      { text: 'Add staff members, assign each to a branch, and share login credentials securely.' },
    ],
    tips: [
      'Complete branches and warehouse stock before inviting sales staff.',
      'Use the Dashboard quick actions to jump to common tasks.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard overview',
    icon: '📊',
    summary: 'Your home screen for KPIs and pending work.',
    tabId: 'overview',
    steps: [
      { text: 'Review revenue, product count, pending requests, and warehouse stock at a glance.' },
      { text: 'Click Pending Requests or any stat card to open the related section.' },
      { text: 'Use Recent Restock Requests to approve or process requests without leaving the page.' },
      { text: 'Quick Actions let you add warehouse products, batch-allocate, add staff, or open Warehouse.' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory & products',
    icon: '📦',
    summary: 'Manage product catalog, prices, and stock thresholds.',
    tabId: 'inventory',
    steps: [
      { text: 'Add products with name, SKU, retail price, wholesale price, and low-stock threshold.' },
      { text: 'Edit a product to update pricing or thresholds; changes apply across the company.' },
      { text: 'Low-stock and out-of-stock counts feed into Dashboard stats and Alerts.' },
      { text: 'Price changes are tracked under Price History for audit purposes.' },
    ],
    tips: ['Keep SKUs unique — they are used for barcode scanning at the POS.'],
  },
  {
    id: 'warehouse',
    title: 'Warehouse & allocation',
    icon: '🏭',
    summary: 'Central stock hub before products reach branch shelves.',
    tabId: 'warehouse',
    steps: [
      { text: 'Add products to the warehouse with quantities when stock arrives from suppliers.' },
      { text: 'Use single allocation to send stock to one branch, or Batch Allocate for multiple products at once.' },
      { text: 'Choose retail vs wholesale quantities based on each branch’s sales type.' },
      { text: 'After allocation, branch inventory updates and salespeople can sell those items.' },
    ],
    tips: [
      'Check Analytics → Branch Stock Tracking to see sell-through by branch.',
      'Refresh the warehouse tab if realtime updates seem delayed.',
    ],
  },
  {
    id: 'branches',
    title: 'Branches',
    icon: '🏢',
    summary: 'Store locations and their sales modes.',
    tabId: 'branches',
    steps: [
      { text: 'Create a branch with a name and sales type: retail, wholesale, or both.' },
      { text: 'Sales type controls which prices and quantities apply at the POS for that branch.' },
      { text: 'Assign staff to branches so each salesperson sees the correct inventory.' },
    ],
  },
  {
    id: 'requests',
    title: 'Restock requests',
    icon: '📋',
    summary: 'Handle branch requests for more stock.',
    tabId: 'requests',
    steps: [
      { text: 'Salespeople submit restock requests from the POS when branch stock runs low.' },
      { text: 'Open Requests to filter by status: pending, approved, fulfilled, or rejected.' },
      { text: 'Process a pending request to approve quantity and trigger warehouse fulfillment.' },
      { text: 'Fulfilled requests update branch inventory automatically.' },
    ],
    tips: ['Pending request count also appears on the Dashboard and in Notifications.'],
  },
  {
    id: 'staff',
    title: 'Staff management',
    icon: '👥',
    summary: 'Add salespeople and link them to branches.',
    tabId: 'staff',
    steps: [
      { text: 'Click Add Staff and enter full name, email, password, branch, and sales type.' },
      { text: 'New accounts are created with the salesperson role for POS access.' },
      { text: 'Reassign staff to another branch anytime; sales type may sync with the branch.' },
      { text: 'Edit staff details or remove access when someone leaves the team.' },
    ],
    tips: [
      'Staff must use Forgot password on the login page if they lose access.',
      'Ensure the API server is running when creating staff (uses secure server-side signup).',
    ],
  },
  {
    id: 'alerts',
    title: 'Alerts & notifications',
    icon: '🔔',
    summary: 'Stay on top of stock issues and system events.',
    tabId: 'alerts',
    steps: [
      { text: 'Alerts shows low-stock and critical inventory items that need attention.' },
      { text: 'Notifications lists realtime events such as sales, requests, and allocations.' },
      { text: 'Mark notifications as read individually or all at once.' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: '📈',
    summary: 'Sales performance, inventory value, and branch tracking.',
    tabId: 'analytics',
    steps: [
      { text: 'Filter analytics by branch or view all branches combined.' },
      { text: 'Monitor total sales, inventory value, warehouse stock, and alert counts.' },
      { text: 'Review 7-day trends, top products, sales by branch, and top performers.' },
      { text: 'Use Branch Stock Tracking to compare allocated vs sold quantities.' },
    ],
    tips: ['Click Refresh to pull the latest data; live updates also arrive via realtime sync.'],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: '⚙️',
    summary: 'Profile, POS pricing, payments, and appearance live under Settings.',
    tabId: 'settings-profile',
    steps: [
      { text: 'Expand Settings in the sidebar to open Profile & store, POS & support, Payments, or Appearance.' },
      { text: 'Use Profile & store for branding; POS & support for tax/discounts; Payments for Paystack; Appearance for theme.' },
      { text: 'Theme choice is saved locally on this browser or device.' },
    ],
  },
  {
    id: 'pos',
    title: 'Salesperson POS (for your team)',
    icon: '🛒',
    summary: 'What staff see — useful when training or troubleshooting.',
    steps: [
      { text: 'Salespeople log in and land on the POS to scan or search products and checkout.' },
      { text: 'They can view sales history, process returns, and submit restock requests.' },
      { text: 'Retail vs wholesale mode depends on their branch and assigned sales type.' },
      { text: 'Receipts and invoices can be generated after each sale.' },
    ],
    tips: ['If POS shows no products, confirm warehouse stock was allocated to their branch.'],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: '🔧',
    summary: 'Common issues and quick fixes.',
    steps: [
      { text: 'Cannot log in — verify email/password; use Forgot password if needed.' },
      { text: 'Staff creation fails — ensure the API is running and .env keys are configured.' },
      { text: 'Empty POS catalog — allocate warehouse stock to the salesperson’s branch.' },
      { text: 'Stale numbers — use Refresh on Analytics or reload the page; check Live indicator on Dashboard.' },
      { text: 'Password reset emails — add your app URL to Supabase Auth redirect URLs.' },
    ],
  },
];
