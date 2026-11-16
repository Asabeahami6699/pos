import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getConflictSales,
  getPendingSaleCount,
  requeueConflictSale,
  voidPendingSale,
} from '../../lib/offline/pendingSales';
import { isOnline, onConnectivityChange } from '../../lib/offline/network';
import { syncPendingSales } from '../../services/syncService';

export function useOfflineSync() {
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    const [count, conflicts] = await Promise.all([
      getPendingSaleCount(),
      getConflictSales(),
    ]);
    setPendingCount(count);
    setConflictCount(conflicts.length);
  }, []);

  const runSync = useCallback(async (silent = false) => {
    if (!isOnline() || syncing) {
      return { synced: 0, failed: 0, conflicts: 0, errors: [] as string[], conflictMessages: [] as string[] };
    }

    setSyncing(true);
    try {
      const result = await syncPendingSales();
      await refreshPendingCount();

      if (!silent && result.synced > 0) {
        toast.success(`Synced ${result.synced} offline sale${result.synced > 1 ? 's' : ''}`);
      }
      if (!silent && result.failed > 0) {
        toast.error(`${result.failed} sale(s) failed to sync`, {
          description: result.errors[0],
        });
      }
      if (result.conflicts > 0) {
        toast.error(`${result.conflicts} sale(s) blocked by stock conflict`, {
          description:
            result.conflictMessages[0] ??
            'Refresh stock, adjust quantities, then retry — or void the offline sale.',
          duration: 10_000,
        });
      }
      return result;
    } finally {
      setSyncing(false);
    }
  }, [refreshPendingCount, syncing]);

  const retryConflict = useCallback(
    async (saleId: string) => {
      await requeueConflictSale(saleId);
      await refreshPendingCount();
      return runSync(false);
    },
    [refreshPendingCount, runSync],
  );

  const voidConflict = useCallback(
    async (saleId: string) => {
      await voidPendingSale(saleId);
      await refreshPendingCount();
      toast.message('Offline sale voided');
    },
    [refreshPendingCount],
  );

  useEffect(() => {
    refreshPendingCount();
    return onConnectivityChange(() => {
      const nowOnline = isOnline();
      setOnline(nowOnline);
      if (nowOnline) {
        void runSync(true);
      }
    });
  }, [refreshPendingCount, runSync]);

  useEffect(() => {
    if (online) {
      const interval = setInterval(() => {
        void runSync(true);
      }, 60_000);
      return () => clearInterval(interval);
    }
  }, [online, runSync]);

  return {
    online,
    pendingCount,
    conflictCount,
    syncing,
    refreshPendingCount,
    runSync,
    retryConflict,
    voidConflict,
  };
}
