export type TourAudience = 'admin' | 'marketplace' | 'pos';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** CSS selector for data-tour target, e.g. [data-tour="admin-branches"] */
  target: string;
  /** Admin dashboard tab to open before highlighting */
  tabId?: string;
  /** Optional route for marketplace */
  route?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export function getAdminTourSteps(inventoryModel: 'warehouse' | 'branch_only'): TourStep[] {
  const base: TourStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to your company dashboard',
      body: 'This walkthrough sets up your store: branches, staff, stock, and products. You can replay it anytime from User Guide.',
      target: '[data-tour="admin-overview"]',
      tabId: 'overview',
    },
    {
      id: 'branches',
      title: 'Create a branch',
      body: 'Branches are where sales happen. Add at least one retail or wholesale location before inviting staff.',
      target: '[data-tour="admin-branches"]',
      tabId: 'branches',
    },
    {
      id: 'staff',
      title: 'Add staff',
      body: 'Invite salespeople, assign them to a branch, and share login credentials securely.',
      target: '[data-tour="admin-staff"]',
      tabId: 'staff',
    },
  ];

  if (inventoryModel === 'warehouse') {
    base.push(
      {
        id: 'warehouse',
        title: 'Add products to warehouse',
        body: 'Receive supplier stock into the warehouse first. Optionally mark items as online marketplace products.',
        target: '[data-tour="admin-warehouse-add"]',
        tabId: 'warehouse',
      },
      {
        id: 'allocate',
        title: 'Allocate stock to branches',
        body: 'Move warehouse stock to branch shelves so POS salespeople can sell.',
        target: '[data-tour="admin-allocate"]',
        tabId: 'warehouse',
      },
    );
  } else {
    base.push({
      id: 'branch-stock',
      title: 'Add stock to a branch',
      body: 'Your company uses branch-only inventory. Add products and stock directly to each branch.',
      target: '[data-tour="admin-branch-stock"]',
      tabId: 'inventory',
    });
  }

  base.push(
    {
      id: 'inventory',
      title: 'Manage catalog & online listings',
      body: 'Edit prices, thresholds, and marketplace details from Inventory. Keep SKUs unique for barcode scanning.',
      target: '[data-tour="admin-inventory"]',
      tabId: 'inventory',
    },
    {
      id: 'done',
      title: 'You’re set',
      body: 'Use Dashboard quick actions for common tasks, and open User Guide anytime for deeper help.',
      target: '[data-tour="admin-guide"]',
      tabId: 'guide',
    },
  );

  return base;
}

export const marketplaceTourSteps: TourStep[] = [
  {
    id: 'home',
    title: 'Browse the marketplace',
    body: 'Discover products from local stores. Search above or scroll featured categories on the home page.',
    target: '[data-tour="shop-home"]',
    route: '/',
  },
  {
    id: 'categories',
    title: 'Shop by category',
    body: 'Jump into categories to filter products by type — grocery, fashion, electronics, and more.',
    target: '[data-tour="shop-categories"]',
  },
  {
    id: 'product',
    title: 'Open a product',
    body: 'Tap any product to see photos, sizes, specs, and add it to your cart.',
    target: '[data-tour="shop-product-card"]',
  },
  {
    id: 'cart',
    title: 'Your cart',
    body: 'Review items, quantities, and checkout when you’re ready. You’ll also see related picks from the same categories.',
    target: '[data-tour="shop-cart"]',
  },
  {
    id: 'account',
    title: 'Your account',
    body: 'Track orders, manage addresses and payment methods, and chat with sellers from Account.',
    target: '[data-tour="shop-account"]',
  },
];

export const posTourSteps: TourStep[] = [
  {
    id: 'search',
    title: 'Search or scan',
    body: 'Type a name/SKU or scan a barcode. Press Enter after a scan to add the match to the cart.',
    target: '[data-tour="pos-search"]',
  },
  {
    id: 'products',
    title: 'Product grid',
    body: 'Tap products to add them to the cart. Stock levels update in realtime for your branch.',
    target: '[data-tour="pos-products"]',
  },
  {
    id: 'cart',
    title: 'Cart panel',
    body: 'Adjust quantities, apply discounts, and review the total before payment.',
    target: '[data-tour="pos-cart"]',
  },
  {
    id: 'checkout',
    title: 'Complete the sale',
    body: 'When the cart is ready, open payment to finish the sale and print or share the receipt.',
    target: '[data-tour="pos-checkout"]',
  },
];
