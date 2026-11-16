import { create } from 'zustand';
import type { AnalyticsData } from '../lib/analyticsLoader';
import { EMPTY_ANALYTICS, loadAnalyticsData } from '../lib/analyticsLoader';

export interface AnalyticsBranch {
  id: string;
  name: string;
}

function cacheKey(companyId: string, branch: string) {
  return `${companyId}:${branch}`;
}

interface AnalyticsStore {
  companyId: string | null;
  selectedBranch: string;
  analytics: AnalyticsData | null;
  loadedKey: string | null;
  inFlightKey: string | null;
  loading: boolean;
  error: string | null;
  isRefreshing: boolean;
  lastUpdate: Date;
  pulseAnimation: boolean;
  branches: AnalyticsBranch[];
  branchesLoadedFor: string | null;
  setCompanyId: (companyId: string | null) => void;
  setSelectedBranch: (branchId: string) => void;
  setBranches: (branches: AnalyticsBranch[]) => void;
  ensureLoaded: (companyId: string, branch: string, force?: boolean) => Promise<void>;
  refetch: (force?: boolean) => Promise<void>;
  touchLastUpdate: () => void;
  triggerPulse: () => void;
  beginRefresh: () => void;
  endRefresh: () => void;
  loadBranches: (companyId: string) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  companyId: null,
  selectedBranch: 'all',
  analytics: null,
  loadedKey: null,
  inFlightKey: null,
  loading: false,
  error: null,
  isRefreshing: false,
  lastUpdate: new Date(),
  pulseAnimation: false,
  branches: [],
  branchesLoadedFor: null,

  setCompanyId: (companyId) => set({ companyId }),

  setSelectedBranch: (branchId) => {
    set({ selectedBranch: branchId });
    const { companyId } = get();
    if (companyId) {
      void get().ensureLoaded(companyId, branchId);
    }
  },

  setBranches: (branches) => set({ branches }),

  ensureLoaded: async (companyId, branch, force = false) => {
    const key = cacheKey(companyId, branch);
    const state = get();

    if (!force && state.loadedKey === key && state.analytics) {
      return;
    }

    if (state.inFlightKey === key) {
      return;
    }

    set({
      loading: !state.analytics || state.loadedKey !== key,
      error: null,
      inFlightKey: key,
      companyId,
    });

    try {
      const data = await loadAnalyticsData(companyId, branch);
      set({
        analytics: data,
        loadedKey: key,
        loading: false,
        inFlightKey: null,
        lastUpdate: new Date(),
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load analytics',
        loading: false,
        inFlightKey: null,
      });
    }
  },

  refetch: async (force = true) => {
    const { companyId, selectedBranch } = get();
    if (!companyId) return;
    await get().ensureLoaded(companyId, selectedBranch, force);
  },

  touchLastUpdate: () => set({ lastUpdate: new Date() }),

  triggerPulse: () => {
    set({ pulseAnimation: true, lastUpdate: new Date() });
    setTimeout(() => set({ pulseAnimation: false }), 1000);
  },

  beginRefresh: () => set({ isRefreshing: true }),

  endRefresh: () => set({ isRefreshing: false, lastUpdate: new Date() }),

  loadBranches: async (companyId) => {
    if (get().branchesLoadedFor === companyId && get().branches.length > 0) {
      return;
    }
    const { supabase } = await import('../lib/supabase');
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name');
    if (data) {
      set({ branches: data, branchesLoadedFor: companyId });
    }
  },
}));

export const getAnalyticsSnapshot = () => {
  const { analytics, loadedKey, loading, error } = useAnalyticsStore.getState();
  return {
    analytics: analytics ?? EMPTY_ANALYTICS,
    loadedKey,
    loading,
    error,
  };
};
