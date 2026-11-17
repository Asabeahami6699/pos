import { useCallback, useEffect, useState } from 'react';
import {
  EMPTY_PROFIT,
  loadProfitSummary,
  type ProfitPeriod,
  type ProfitSummary,
} from '../lib/profitLoader';

export function useProfit(companyId: string | undefined, period: ProfitPeriod = 'all') {
  const [data, setData] = useState<ProfitSummary>({ ...EMPTY_PROFIT, period });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setData({ ...EMPTY_PROFIT, period });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const summary = await loadProfitSummary(companyId, period);
      setData(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profit data');
      setData({ ...EMPTY_PROFIT, period });
    } finally {
      setLoading(false);
    }
  }, [companyId, period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
