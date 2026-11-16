import type { CartItem, Customer, Payment, User, Branch } from '../../types';
import { offlineDb, type PendingSaleRow } from './db';

export interface SalePayload {
  cart: CartItem[];
  total: number;
  customer: Customer;
  payment: Payment;
  salesType: 'retail' | 'wholesale';
  user: User;
  selectedBranch: Branch;
}

export async function savePendingSale(id: string, payload: SalePayload): Promise<void> {
  const row: PendingSaleRow = {
    id,
    companyId: payload.selectedBranch.company_id,
    branchId: payload.selectedBranch.id,
    salespersonId: payload.user.id,
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  };
  await offlineDb.pendingSales.put(row);
}

export async function getPendingSales(): Promise<PendingSaleRow[]> {
  return offlineDb.pendingSales
    .where('status')
    .anyOf(['pending', 'failed'])
    .sortBy('createdAt');
}

export async function getPendingSaleCount(): Promise<number> {
  return offlineDb.pendingSales
    .where('status')
    .anyOf(['pending', 'failed'])
    .count();
}

export async function markSaleSyncing(id: string): Promise<void> {
  await offlineDb.pendingSales.update(id, { status: 'syncing' });
}

export async function markSaleSynced(id: string): Promise<void> {
  await offlineDb.pendingSales.update(id, { status: 'synced', syncError: undefined });
}

export async function markSaleFailed(id: string, error: string): Promise<void> {
  const row = await offlineDb.pendingSales.get(id);
  await offlineDb.pendingSales.update(id, {
    status: 'failed',
    syncError: error,
    attempts: (row?.attempts ?? 0) + 1,
  });
}

export function parseSalePayload(row: PendingSaleRow): SalePayload {
  return JSON.parse(row.payload) as SalePayload;
}
