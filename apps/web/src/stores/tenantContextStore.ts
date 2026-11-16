import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActingTenant {
  id: string;
  name: string;
  enteredAt: string;
}

interface TenantContextState {
  actingTenant: ActingTenant | null;
  enterTenant: (tenant: { id: string; name: string }) => void;
  exitTenant: () => void;
}

export const useTenantContextStore = create<TenantContextState>()(
  persist(
    (set) => ({
      actingTenant: null,
      enterTenant: (tenant) =>
        set({
          actingTenant: {
            id: tenant.id,
            name: tenant.name,
            enteredAt: new Date().toISOString(),
          },
        }),
      exitTenant: () => set({ actingTenant: null }),
    }),
    { name: 'pos-super-admin-tenant-context' },
  ),
);

/** Non-hook access for apiFetch / auth helpers */
export function getActingTenantId(): string | null {
  return useTenantContextStore.getState().actingTenant?.id ?? null;
}
