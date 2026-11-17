import { create } from 'zustand';
import type { CustomerNotification } from '../lib/shopApi';

interface CustomerNotificationsStore {
  notifications: CustomerNotification[];
  unreadCount: number;
  loading: boolean;
  setNotifications: (list: CustomerNotification[]) => void;
  setUnreadCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  upsertNotification: (n: CustomerNotification) => void;
  markLocalRead: (id: string) => void;
  markLocalAllRead: () => void;
  reset: () => void;
}

export const useCustomerNotificationsStore = create<CustomerNotificationsStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  setNotifications: (notifications) => set({ notifications }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setLoading: (loading) => set({ loading }),
  upsertNotification: (n) =>
    set((state) => {
      const exists = state.notifications.some((x) => x.id === n.id);
      const notifications = exists
        ? state.notifications.map((x) => (x.id === n.id ? n : x))
        : [n, ...state.notifications].slice(0, 50);
      const unreadCount = exists
        ? state.unreadCount
        : state.unreadCount + (n.read ? 0 : 1);
      return { notifications, unreadCount };
    }),
  markLocalRead: (id) =>
    set((state) => {
      const target = state.notifications.find((n) => n.id === id);
      if (!target || target.read) return state;
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }),
  markLocalAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  reset: () => set({ notifications: [], unreadCount: 0, loading: false }),
}));
