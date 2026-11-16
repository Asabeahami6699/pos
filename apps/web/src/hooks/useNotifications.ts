import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  company_id: string;
  user_id?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  created_at: string;
}

export const useNotifications = (companyId: string | null) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Use a ref to track the current AbortController for the active request
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchNotifications = useCallback(async (companyId: string) => {
    // 1. Cancel any previous pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 2. Create a new controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Check if request was aborted during auth check
      if (signal.aborted) return;

      if (userId) {
        query = query.or(`user_id.is.null,user_id.eq.${userId}`);
      } else {
        query = query.is('user_id', null);
      }
      
      // Pass the abort signal to the Supabase query
      // Note: .abortSignal() is available in @supabase/supabase-js v2.x
      const { data, error } = await query.abortSignal(signal);
      
      if (signal.aborted) return;
      
      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      // 3. Ignore AbortErrors to prevent console noise
      if (error.name !== 'AbortError') {
        console.error('Error fetching notifications:', error);
      }
    } finally {
      // Only stop loading if this specific request wasn't aborted
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleMarkNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true } 
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const handleMarkAllNotificationsAsRead = useCallback(async () => {
    if (!companyId) return;
    
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('company_id', companyId)
        .eq('read', false);
      
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchNotifications(companyId);
    }

    // Cleanup function: abort request when component unmounts or companyId changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [companyId, fetchNotifications]);

  return {
    notifications,
    loading,
    fetchNotifications: () => companyId && fetchNotifications(companyId),
    handleMarkNotificationAsRead,
    handleMarkAllNotificationsAsRead,
    setNotifications
  };
};