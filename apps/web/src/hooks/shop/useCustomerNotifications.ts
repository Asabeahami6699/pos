import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { shopApi, type CustomerNotification } from '../../lib/shopApi';
import { supabase } from '../../lib/supabase';
import { useCustomerNotificationsStore } from '../../stores/customerNotificationsStore';
import { useCustomerSession } from './useCustomerSession';

let listenerCount = 0;

export function useCustomerNotifications() {
  const { signedIn, userId } = useCustomerSession();
  const notifications = useCustomerNotificationsStore((s) => s.notifications);
  const unreadCount = useCustomerNotificationsStore((s) => s.unreadCount);
  const loading = useCustomerNotificationsStore((s) => s.loading);
  const setNotifications = useCustomerNotificationsStore((s) => s.setNotifications);
  const setUnreadCount = useCustomerNotificationsStore((s) => s.setUnreadCount);
  const setLoading = useCustomerNotificationsStore((s) => s.setLoading);
  const upsertNotification = useCustomerNotificationsStore((s) => s.upsertNotification);
  const markLocalRead = useCustomerNotificationsStore((s) => s.markLocalRead);
  const markLocalAllRead = useCustomerNotificationsStore((s) => s.markLocalAllRead);
  const reset = useCustomerNotificationsStore((s) => s.reset);

  const hydratedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(
    async (silent = false) => {
      if (!signedIn) {
        reset();
        hydratedRef.current = false;
        knownIdsRef.current = new Set();
        return;
      }

      if (!silent) setLoading(true);
      try {
        const [listRes, countRes] = await Promise.all([
          shopApi.getNotifications(),
          shopApi.getUnreadNotificationCount(),
        ]);
        const list = listRes.data ?? [];
        setNotifications(list);
        setUnreadCount(countRes.data?.count ?? list.filter((n) => !n.read).length);
        knownIdsRef.current = new Set(list.map((n) => n.id));
        hydratedRef.current = true;
      } catch {
        if (!silent) {
          setNotifications([]);
          setUnreadCount(0);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [signedIn, reset, setLoading, setNotifications, setUnreadCount],
  );

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  useEffect(() => {
    if (!signedIn || !userId) return;

    listenerCount += 1;
    if (listenerCount > 1) {
      return () => {
        listenerCount -= 1;
      };
    }

    const channel = supabase
      .channel(`customer-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_notifications',
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as CustomerNotification;
          if (knownIdsRef.current.has(row.id)) return;
          knownIdsRef.current.add(row.id);
          upsertNotification(row);
          toast.info(row.title, {
            description: row.body,
            action: row.link
              ? {
                  label: 'View',
                  onClick: () => {
                    window.location.href = row.link!;
                  },
                }
              : undefined,
          });
        },
      )
      .subscribe();

    return () => {
      listenerCount -= 1;
      if (listenerCount <= 0) {
        listenerCount = 0;
        supabase.removeChannel(channel);
      }
    };
  }, [signedIn, userId, upsertNotification]);

  const markRead = useCallback(
    async (id: string) => {
      markLocalRead(id);
      try {
        await shopApi.markNotificationRead(id);
      } catch {
        void refresh(true);
      }
    },
    [markLocalRead, refresh],
  );

  const markAllRead = useCallback(async () => {
    markLocalAllRead();
    try {
      await shopApi.markAllNotificationsRead();
    } catch {
      void refresh(true);
    }
  }, [markLocalAllRead, refresh]);

  return {
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
    signedIn,
  };
}
