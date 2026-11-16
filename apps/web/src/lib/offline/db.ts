import Dexie, { type Table } from 'dexie';
import type { Product, Branch, User } from '../../types';

export type PendingSaleStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export interface CatalogCacheRow {
  branchId: string;
  companyId: string;
  products: Product[];
  cachedAt: string;
}

export interface PosSessionRow {
  id: 'current';
  user: User;
  branches: Branch[];
  selectedBranch: Branch;
  savedAt: string;
}

export interface PendingSaleRow {
  id: string;
  companyId: string;
  branchId: string;
  salespersonId: string;
  payload: string;
  createdAt: string;
  status: PendingSaleStatus;
  syncError?: string;
  attempts: number;
}

class PosOfflineDB extends Dexie {
  catalog!: Table<CatalogCacheRow, string>;
  session!: Table<PosSessionRow, string>;
  pendingSales!: Table<PendingSaleRow, string>;

  constructor() {
    super('pos-inventory-offline');
    this.version(1).stores({
      catalog: 'branchId',
      session: 'id',
      pendingSales: 'id, status, createdAt',
    });
  }
}

export const offlineDb = new PosOfflineDB();
