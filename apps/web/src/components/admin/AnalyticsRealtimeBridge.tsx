import React from 'react';
import { useRealtimeSubscriptions } from '../../hooks/useRealtimeSubscriptions';
import { useAnalyticsStore } from '../../stores/analyticsStore';

interface AnalyticsRealtimeBridgeProps {
  companyId: string;
}

/** Keeps analytics live via realtime without remounting when leaving the Analytics tab. */
export const AnalyticsRealtimeBridge: React.FC<AnalyticsRealtimeBridgeProps> = ({ companyId }) => {
  const refetch = useAnalyticsStore((s) => s.refetch);
  const triggerPulse = useAnalyticsStore((s) => s.triggerPulse);
  const touchLastUpdate = useAnalyticsStore((s) => s.touchLastUpdate);

  useRealtimeSubscriptions(companyId, {
    onSalesChange: () => {
      triggerPulse();
      void refetch(true);
    },
    onBranchInventoryChange: () => {
      touchLastUpdate();
      void refetch(true);
    },
    onWarehouseInventoryChange: () => {
      touchLastUpdate();
      void refetch(true);
    },
    onAllocationsChange: () => {
      touchLastUpdate();
      void refetch(true);
    },
    onRestockRequestsChange: () => {
      touchLastUpdate();
      void refetch(true);
    },
    onProductsChange: () => {
      touchLastUpdate();
      void refetch(true);
    },
  });

  return null;
};
