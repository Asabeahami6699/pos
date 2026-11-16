import type { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  all: ['pos'] as const,
  company: (companyId: string) => [...queryKeys.all, 'company', companyId] as const,
  stats: (companyId: string) => [...queryKeys.company(companyId), 'stats'] as const,
  products: (companyId: string) => [...queryKeys.company(companyId), 'products'] as const,
  branches: (companyId: string) => [...queryKeys.company(companyId), 'branches'] as const,
  branchInventory: (companyId: string) => [...queryKeys.company(companyId), 'branch-inventory'] as const,
  warehouseInventory: (companyId: string) => [...queryKeys.company(companyId), 'warehouse-inventory'] as const,
  restockRequests: (companyId: string) => [...queryKeys.company(companyId), 'restock-requests'] as const,
  staff: (companyId: string) => [...queryKeys.company(companyId), 'staff'] as const,
  notifications: (companyId: string) => [...queryKeys.company(companyId), 'notifications'] as const,
  priceHistory: (companyId: string) => [...queryKeys.company(companyId), 'price-history'] as const,
  allocations: (companyId: string) => [...queryKeys.company(companyId), 'allocations'] as const,
  analytics: (companyId: string) => [...queryKeys.company(companyId), 'analytics'] as const,
  branchProducts: (branchId: string, companyId: string) =>
    [...queryKeys.all, 'branch-products', branchId, companyId] as const,
  salesHistory: (branchId: string, from: string, to: string) =>
    [...queryKeys.all, 'sales-history', branchId, from, to] as const,
  returns: (branchId: string) => [...queryKeys.all, 'returns', branchId] as const,
  posRestock: (branchId: string, userId: string) =>
    [...queryKeys.all, 'pos-restock', branchId, userId] as const,
};

type QueryKeyFactory = (companyId: string, branchId?: string) => readonly unknown[][];

const TABLE_QUERY_MAP: Record<string, QueryKeyFactory> = {
  products: (id) => [queryKeys.products(id)],
  branches: (id) => [queryKeys.branches(id)],
  sales: (id) => [queryKeys.stats(id), queryKeys.analytics(id)],
  sale_items: (id) => [queryKeys.stats(id)],
  branch_inventory: (id, branchId) => [
    queryKeys.branchInventory(id),
    queryKeys.stats(id),
    ...(branchId ? [queryKeys.branchProducts(branchId, id)] : []),
  ],
  warehouse_inventory: (id) => [queryKeys.warehouseInventory(id), queryKeys.stats(id)],
  allocations: (id) => [queryKeys.allocations(id), queryKeys.stats(id)],
  allocation_items: (id) => [queryKeys.allocations(id)],
  restock_requests: (id, branchId) => [
    queryKeys.restockRequests(id),
    queryKeys.stats(id),
    ...(branchId ? [queryKeys.posRestock(branchId, '')] : []),
  ],
  users: (id) => [queryKeys.staff(id), queryKeys.stats(id)],
  central_inventory: (id) => [queryKeys.warehouseInventory(id)],
  notifications: (id) => [queryKeys.notifications(id)],
  price_history: (id) => [queryKeys.priceHistory(id)],
  returns: (_id, branchId) => (branchId ? [queryKeys.returns(branchId)] : []),
};

export function invalidateQueriesForTable(
  queryClient: QueryClient,
  table: string,
  companyId: string,
  branchId?: string
) {
  const keyFactories = TABLE_QUERY_MAP[table];
  if (!keyFactories) return;

  keyFactories(companyId, branchId).forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });
}

export function invalidateAllCompanyQueries(queryClient: QueryClient, companyId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.company(companyId) });
}

export function invalidateBranchQueries(
  queryClient: QueryClient,
  branchId: string,
  companyId: string
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.branchProducts(branchId, companyId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.returns(branchId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.all });
}
