# AI Copilot Instructions for POS-Inventory Codebase

## Project Overview
This is a **React + TypeScript + Vite** multi-role POS (Point-of-Sale) and inventory management system with company hierarchy (Super Admin > Company Admin > Sales Staff) and real-time capabilities powered by **Supabase**.

### Core Architecture
- **Frontend**: React 19, Vite, TailwindCSS, TypeScript 5.9
- **Backend**: Supabase (PostgreSQL + Realtime + Auth + Edge Functions)
- **State Management**: React hooks + Supabase subscriptions (no Redux/Zustand)
- **UI Components**: Custom components (Button, Modal, Input, Select, Table) styled with Tailwind
- **Notifications**: Sonner (toast) and React Hot Toast

## Role-Based System (Critical)
The app has three hierarchical roles:

1. **Super Admin** (`/super-admin/dashboard`): Company management, analytics
2. **Company Admin** (`/admin/inventory`): Manage products, branches, staff, inventory
3. **Sales Staff** (`/pos/salespersonPage`): POS transactions, returns, restock requests

**Key Pattern**: Use `useCompanyAuth` hook to extract `companyId`, `userRole`, `userName` from Supabase auth session. Always filter all queries by `company_id` to maintain data isolation.

## Critical Data Flow & Patterns

### Multi-Tenant Architecture
- Every table is scoped to `company_id` 
- Realtime subscriptions use `filter: company_id=eq.${companyId}` to prevent cross-company data leaks
- When creating records, always include `company_id` from the current user

### Branch-Based Inventory Model
```
Products (global per company)
├── Products table: base product info (price, wholesale_price, sku)
└── Branch Inventory: quantity per branch (branch_inventory table)

Sales Recording:
├── Sales table: transaction header (total, payment_method, sales_type)
└── Sale Items: line items with pricing (original_price, wholesale_price)
```

**Pattern**: `useProducts` hook fetches branch inventory, joins with products, and attaches `stock` property. Wholesale pricing is `wholesale_price || price * 0.8`.

### Sales Type Handling (Retail vs Wholesale)
- Branches have `sales_type: 'retail' | 'wholesale' | 'both'`
- Sales staff have `sales_type` field matching their permission
- `useCart` hook calculates different prices based on `salesType` parameter
- Always validate available sales types before allowing checkout

## Essential Hooks (Don't Reinvent)

| Hook | Location | Purpose | Key Note |
|------|----------|---------|----------|
| `useCompanyAuth` | `hooks/` | Session + company context | Called in every page to init company context |
| `useCart` | `hooks/posHooks/` | Cart state, pricing, discounts | Takes `salesType` param; handles stock validation |
| `useProducts` | `hooks/posHooks/` | Fetches branch products + realtime sync | Returns products with `.stock` property |
| `useSalesHistory` | `hooks/posHooks/` | Sales records with date filters | Used for Receipt and SalesHistory tabs |
| `useRealtimeSubscriptions` | `hooks/` | Setup all Supabase subscriptions | Pass callbacks object with `onProductsChange`, `onRestockRequestsChange`, etc. |
| `useRealtimeNotifications` | `hooks/posHooks/` | Notification bell for restock alerts | Admin dashboard uses this |
| `useInventoryManagement` | `hooks/` | Adjust stock, transfer between branches | Used in admin inventory adjustments |
| `useRestockRequests` | `hooks/` + `hooks/posHooks/` | Create/fetch restock requests | Two versions: admin (manages) and POS (creates) |

**Pattern**: Hooks return `{ data, loading, error, refetch }` structure. Always handle loading state in UI. Refetch after mutations.

## Services Layer (Business Logic)

### `saleService.ts`
```typescript
saleService.processSale({ cart, total, customer, payment, salesType, user, selectedBranch })
```
- Creates sale record + sale_items in a single flow
- Updates branch_inventory quantities
- Logs transaction in transaction_logs table
- Handles split payments
- **Pattern**: Always await and handle errors; emit toast notifications

### `invoiceService.ts`
- PDF generation using html2pdf.js
- Receipt format with itemized breakdown

## Component Structure

### Page-Level Components
- **SellPage** (`/pos/salespersonPage`): Orchestrates cart, payment, returns, restock, sales history
- **CompanyDashboard** (`/admin/inventory`): Admin hub with 9 tabs (overview, inventory, warehouse, branches, requests, alerts, staff, price-history, notifications)
- **LoginPage**: Auth entry point

### Reusable UI Components
All styled with Tailwind. Located in `src/components/`:
- `Button`: Variant system (primary, secondary, danger, ghost, outline)
- `Modal`: Escape-key closable, backdrop click closable
- `Input` / `Select`: Form components with labels
- `Table`: Column-based rendering

**Pattern**: Pass `className` prop to override Tailwind classes. All components accept `...props` for flexibility.

## Supabase & Realtime Patterns

### Direct Query Pattern (Used Throughout)
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('company_id', companyId)  // MANDATORY for multi-tenant
  .order('created_at', { ascending: false });
```

### Realtime Subscriptions Pattern
```typescript
const channel = supabase
  .channel('unique-channel-name')
  .on('postgres_changes', {
    event: '*',  // INSERT, UPDATE, DELETE, or specific
    schema: 'public',
    table: 'restock_requests',
    filter: `company_id=eq.${companyId}`  // Critical for data isolation
  }, (payload) => {
    callback();  // Trigger refetch, not direct update
  })
  .subscribe();

return () => channel.unsubscribe();  // Cleanup in useEffect
```

### Edge Functions Pattern (Supabase Functions in `supabase/functions/`)
- Use Deno runtime
- Access env vars: `Deno.env.get('SUPABASE_URL')`
- Service role client for admin operations: `createClient(url, serviceRoleKey)`
- Always handle CORS for browser calls

## Debugging & Development

### Build & Dev Workflow
```bash
npm run dev          # Start Vite with HMR
npm run build        # TypeScript + Vite build to dist/
npm run lint         # ESLint check
npm run preview      # Preview production build
```

### Common Issues
1. **"No matching schema found"**: Check company_id filter is correct
2. **Realtime not updating**: Ensure table has RLS enabled and anon role has SELECT
3. **Stock mismatch**: Verify sale processing updates both sales and branch_inventory tables

### TypeScript Tips
- Import types with `import type { Product }` (type-only imports)
- Types are in `src/types/index.ts`
- Branch and Product types extend from multiple sources (avoid duplication, use shared types)

## Common Workflows

### Adding a New Field to Product
1. Add to `Product` interface in `types/index.ts`
2. Add column to `products` table in Supabase
3. Update `useProducts` hook if it needs realtime sync
4. Update `saleService.processSale` if needed for sale_items

### Creating a New Admin Dashboard Tab
1. Create component in `src/components/admin/dashboard-tabs/`
2. Import in `CompanyDashboard.tsx`
3. Add to the tab switch statement
4. Use existing hooks (e.g., `useInventoryManagement`, `useDashboardData`)

### Adding a POS Modal
1. Create in `src/components/pos/` (e.g., `SampleModal.tsx`)
2. Import and add state in `SellPage.tsx`
3. Trigger modal with button or user action
4. Call service/hook on submit

## File Organization Reference
```
src/
  pages/          → Route handlers (auth, pos, admin, super-admin)
  components/     → UI components (reusable + page-specific)
  hooks/          → Custom React hooks (data fetching, state mgmt)
  services/       → Business logic (saleService, invoiceService)
  lib/            → Utilities (supabase client)
  utils/          → Helpers (dateUtils)
  types/          → TypeScript interfaces
```

## Key Principles
1. **Company ID Isolation**: Never forget to add `company_id` filter
2. **Real-time First**: Use subscriptions for live updates, not polling
3. **Type Safety**: Always use TypeScript interfaces for Supabase responses
4. **Error Handling**: Wrap all async operations in try-catch; emit toast notifications
5. **State Locality**: Use React hooks, not global state manager
6. **Accessibility**: Use semantic HTML, ARIA labels in modals

## Anti-Patterns & Gotchas (DO NOT DO)

### ❌ Multi-Tenant Data Leaks
**Bad**: Querying without company_id filter
```typescript
// WRONG - exposes all companies' data!
const { data } = await supabase.from('products').select('*');
```
**Good**: Always scope to current company
```typescript
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('company_id', companyId);  // MANDATORY
```

### ❌ Inventory Stock Mismatch
The codebase has a known gotcha: **`product.stock` is injected by hooks, not in database**. Never trust `.stock` from raw Supabase queries.

**Bad**:
```typescript
const product = await supabase.from('products').select('*').single();
console.log(product.stock);  // undefined - stock lives in branch_inventory!
```

**Good**: Use hooks that join products with branch_inventory
```typescript
const { products } = useProducts(branch);  // Returns with .stock attached
```

### ❌ Realtime Subscription Leaks
Don't forget to unsubscribe; leaving channels open causes memory leaks and duplicate notifications.

**Bad**:
```typescript
const channel = supabase.channel('events')...subscribe();
// No cleanup - channel persists across re-renders!
```

**Good**:
```typescript
useEffect(() => {
  const channel = supabase.channel('events')...subscribe();
  return () => channel.unsubscribe();  // Always cleanup
}, []);
```

### ❌ Direct Supabase Calls Instead of Hooks
Each page/tab has custom hooks for data fetching. Don't bypass them with raw queries.

**Bad**:
```typescript
// In SellPage - should use existing hooks!
const { data } = await supabase.from('products').select('*');
```

**Good**:
```typescript
const { products } = useProducts(selectedBranch, salesType);
const { sales } = useSalesHistory(selectedBranch, filters);
```

### ❌ Ignoring Sales Type Context
Retail vs wholesale pricing, stock allocation, and staff permissions differ. Always pass `salesType` to relevant hooks.

**Bad**:
```typescript
const { cart } = useCart();  // Missing salesType - defaults to retail pricing!
```

**Good**:
```typescript
const { cart } = useCart(salesType);  // Correctly applies wholesale pricing
```

### ❌ Legacy Restock Request Format
Restock requests have **two storage formats**: old single-product fields + new JSONB `items` array. Some code handles both.

**Bad**:
```typescript
const qty = request.requested_quantity;  // Works for old format, fails for new!
```

**Good** (from RestockRequestCard.tsx):
```typescript
const requestItems = Array.isArray(request.items) ? request.items : [];
const totalRequested = requestItems.reduce((sum, item) => 
  sum + (item.requested_quantity || 0), 0
) || request.requested_quantity || 0;  // Falls back to old format
```

### ❌ Missing Error Toast Notifications
Async operations must provide user feedback; silent failures hurt UX.

**Bad**:
```typescript
try {
  await supabase.from('products').update({...}).eq('id', id);
} catch (error) {
  console.error(error);  // Only logs - user sees nothing!
}
```

**Good**:
```typescript
try {
  const toastId = toast.loading('Updating...');
  await supabase.from('products').update({...}).eq('id', id);
  toast.success('Updated!', { id: toastId });
} catch (error) {
  toast.error('Update Failed', { description: error.message, id: toastId });
}
```

### ❌ Type Imports vs Value Imports
Mixing type and value imports can bloat the bundle.

**Bad**:
```typescript
import { Product, Branch } from '../types';  // Imports as values
```

**Good**:
```typescript
import type { Product, Branch } from '../types';  // Type-only, erased at compile
```

### ❌ Unhandled Race Conditions in Filters
Changing filters while data is loading can cause stale state or missing refetch.

**Bad**:
```typescript
setHistoryFilters({...newFilters});  // No refetch - old data stays cached!
```

**Good** (pattern used throughout):
```typescript
setHistoryFilters({...newFilters});
await fetchSalesHistory(newFilters);  // Explicitly refetch
```

### ❌ Console.logs in Production
Debug logs are scattered throughout (e.g., in useRestockRequests.ts, ReturnModal.tsx). Remove before shipping.

**Scan for**:
- `console.log()` - remove or replace with proper logging
- `console.error()` - OK for error cases, but verify it's not excessive debugging
- `// DEBUG -` comments - clean these up

### ❌ Type Narrowing Issues
Cart and product types have optional `stock`, `wholesale_price`, `branch_id`. Always check before use.

**Bad**:
```typescript
const discount = item.discount / 100;  // Crashes if undefined!
```

**Good**:
```typescript
const discount = (item.discount || 0) / 100;
```

## Known Schema Quirks

1. **Products table** has no `stock` column - it's calculated from `branch_inventory`
2. **Users table** doesn't have `email` column (auth.users holds emails)
3. **RestockRequest** stores items two ways:
   - Legacy: `requested_quantity` (single product)
   - New: `items` JSONB array (multi-product support)
4. **Sales table** has `sales_type` field; **sale_items** repeats it for audit trail
5. **Branches** have `sales_type: 'retail' | 'wholesale' | 'both'` controlling available checkout modes
