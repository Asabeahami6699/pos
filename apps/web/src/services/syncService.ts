import { ApiError, api } from '../lib/api';
import { saleOrchestrator } from './saleOrchestrator';
import {
  getPendingSales,
  markSaleConflict,
  markSaleFailed,
  markSaleSynced,
  markSaleSyncing,
  parseSalePayload,
} from '../lib/offline/pendingSales';
import { isOnline } from '../lib/offline/network';

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
  errors: string[];
  conflictMessages: string[];
}

export async function syncPendingSales(): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    failed: 0,
    conflicts: 0,
    errors: [],
    conflictMessages: [],
  };

  if (!isOnline()) return result;

  const pending = await getPendingSales();

  for (const row of pending) {
    try {
      await markSaleSyncing(row.id);
      const payload = parseSalePayload(row);
      const apiPayload = saleOrchestrator.buildApiPayload(row.id, payload);
      await api.createSale(apiPayload);
      await markSaleSynced(row.id);
      result.synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      const isStockConflict =
        error instanceof ApiError &&
        (error.status === 409 || error.code === 'INSUFFICIENT_STOCK');

      if (isStockConflict) {
        await markSaleConflict(row.id, message);
        result.conflicts += 1;
        result.conflictMessages.push(message);
      } else {
        await markSaleFailed(row.id, message);
        result.failed += 1;
        result.errors.push(message);
      }
    }
  }

  return result;
}
