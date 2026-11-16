import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getPendingSaleCount } from '../../lib/offline/pendingSales';
import { isOnline, onConnectivityChange } from '../../lib/offline/network';
import { syncPendingSales } from '../../services/syncService';

export function useOfflineSync() {
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSaleCount();
    setPendingCount(count);
  }, []);

  const runSync = useCallback(async (silent = false) => {
    if (!isOnline() || syncing) return { synced: 0, failed: 0, errors: [] as string[] };

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
      return result;
    } finally {
      setSyncing(false);
    }
  }, [refreshPendingCount, syncing]);

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
    syncing,
    refreshPendingCount,
    runSync,
  };
}
