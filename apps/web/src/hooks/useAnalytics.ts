import { useEffect } from 'react';
import { EMPTY_ANALYTICS } from '../lib/analyticsLoader';
import { useAnalyticsStore } from '../stores/analyticsStore';

export type {
  BranchStockTracking,
  BranchPerformance,
  AnalyticsData,
} from '../lib/analyticsLoader';

export const useAnalytics = (companyId: string | null, selectedBranchId?: string) => {
  const branch = selectedBranchId ?? 'all';
  const analytics = useAnalyticsStore((s) => s.analytics);
  const loading = useAnalyticsStore((s) => s.loading);
  const error = useAnalyticsStore((s) => s.error);
  const loadedKey = useAnalyticsStore((s) => s.loadedKey);
  const ensureLoaded = useAnalyticsStore((s) => s.ensureLoaded);
  const refetch = useAnalyticsStore((s) => s.refetch);

  const key = companyId ? `${companyId}:${branch}` : null;
  const hasCache = Boolean(key && loadedKey === key && analytics);

  useEffect(() => {
    if (!companyId) return;
    useAnalyticsStore.getState().setCompanyId(companyId);
    void ensureLoaded(companyId, branch);
  }, [companyId, branch, ensureLoaded]);

  return {
    analytics: analytics ?? EMPTY_ANALYTICS,
    loading: loading && !hasCache,
    error,
    refetch: () => refetch(true),
  };
};
