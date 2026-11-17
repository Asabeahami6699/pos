import { create } from 'zustand';

type ChatPanelView = 'threads' | 'stores' | 'room';

interface ShopChatUiState {
  open: boolean;
  view: ChatPanelView;
  companyId: string | null;
  companyName: string | null;
  openPanel: () => void;
  closePanel: () => void;
  showThreads: () => void;
  showStores: () => void;
  openRoom: (companyId: string, companyName?: string) => void;
}

export const useShopChatUiStore = create<ShopChatUiState>((set) => ({
  open: false,
  view: 'threads',
  companyId: null,
  companyName: null,
  openPanel: () => set({ open: true, view: 'threads', companyId: null, companyName: null }),
  closePanel: () =>
    set({ open: false, view: 'threads', companyId: null, companyName: null }),
  showThreads: () => set({ view: 'threads', companyId: null, companyName: null }),
  showStores: () => set({ view: 'stores', companyId: null, companyName: null }),
  openRoom: (companyId, companyName) =>
    set({
      open: true,
      view: 'room',
      companyId,
      companyName: companyName ?? 'Store',
    }),
}));
