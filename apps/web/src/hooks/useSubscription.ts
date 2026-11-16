import { useCallback, useEffect, useState } from 'react';
import { api, type SubscriptionInfo } from '../lib/api';

export function useSubscription(enabled = true) {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    try {
      const res = await api.getSubscription();
      setSubscription(res.data);
      return res.data;
    } catch {
      setSubscription(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { subscription, loading, refresh };
}
