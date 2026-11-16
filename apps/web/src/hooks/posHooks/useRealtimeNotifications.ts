// hooks/posHooks/useRealtimeNotifications.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { RealTimeNotification, Branch } from '../../types/index';
import { toast } from 'sonner';

interface UseRealtimeNotificationsProps {
  selectedBranch?: Branch | null;
  userId?: string | null;
  onInvoiceUpdate?: (invoiceNumber: string) => void;
  onRestockRequestUpdate?: () => Promise<void> | void;
  enableInvoiceNotifications?: boolean;
}

export const useRealtimeNotifications = ({
  selectedBranch = null,
  userId = null,
  onInvoiceUpdate,
  onRestockRequestUpdate,
  enableInvoiceNotifications = true
}: UseRealtimeNotificationsProps) => {
  const [notifications, setNotifications] = useState<RealTimeNotification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  
  const channelsRef = useRef<Set<any>>(new Set());

  const addNotification = useCallback((notification: Omit<RealTimeNotification, 'id' | 'timestamp' | 'seen'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: RealTimeNotification = {
      id,
      timestamp: new Date(),
      seen: false,
      ...notification
    };
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]);
    
    return newNotification;
  }, []);

  const showToastForNotification = useCallback((notification: RealTimeNotification) => {
    const shouldShowToast = [
      'low_stock', 
      'price', 
      'stock', 
      'product', 
      'sale', 
      'return', 
      'restock',
      'invoice'
    ].includes(notification.type);
    
    if (shouldShowToast) {
      const toastConfig: any = {
        description: notification.description || notification.title,
        duration: 4000,
      };
      
      if (notification.type === 'invoice' && notification.metadata?.invoiceNumber) {
        toastConfig.action = {
          label: 'View',
          onClick: () => {
            if (onInvoiceUpdate) {
              onInvoiceUpdate(notification.metadata.invoiceNumber);
            }
          }
        };
      }
      
      const typeIcons: Record<string, string> = {
        low_stock: '⚠️',
        price: '💰',
        stock: '📊',
        product: '📦',
        sale: '🛒',
        return: '↩️',
        restock: '📦',
        invoice: '🧾',
        'restock_approved': '✅',
        'restock_rejected': '❌',
        'restock_fulfilled': '🚚'
      };
      
      const icon = notification.icon || typeIcons[notification.type] || '🔔';
      
      switch (notification.type) {
        case 'restock_rejected':
          toast.error(`${icon} ${notification.title}`, toastConfig);
          break;
        case 'restock_approved':
        case 'restock_fulfilled':
        case 'invoice':
          toast.success(`${icon} ${notification.title}`, toastConfig);
          break;
        default:
          toast.info(`${icon} ${notification.title}`, toastConfig);
      }
    }
  }, [onInvoiceUpdate]);

  const markNotificationAsSeen = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, seen: true } : notification
      )
    );
  }, []);

  const markAllNotificationsAsSeen = useCallback(() => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, seen: true }))
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const cleanupRealtimeChannels = useCallback(() => {
    channelsRef.current.forEach(channel => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    });
    channelsRef.current.clear();
    setConnectionStatus('disconnected');
  }, []);

  const setupRealtimeSubscriptions = useCallback(() => {
    // Check if we have either branch or user
    const hasBranch = selectedBranch && selectedBranch.id;
    const hasUser = userId;
    
    if (!hasBranch && !hasUser) {
      console.log('No branch or user provided, skipping real-time setup');
      setConnectionStatus('disconnected');
      return () => {}; // Return empty cleanup function
    }

    cleanupRealtimeChannels();
    setConnectionStatus('connecting');

    const channels: any[] = [];

    try {
      // 1. Branch-specific restock requests channel
      if (hasBranch) {
        const branchChannel = supabase
          .channel(`restock-requests:branch=${selectedBranch!.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'restock_requests',
              filter: `branch_id=eq.${selectedBranch!.id}`
            },
            async (payload: any) => {
              console.log('Restock request update:', payload);
              
              // Callback to refresh data
              if (onRestockRequestUpdate) {
                try {
                  await onRestockRequestUpdate();
                } catch (error) {
                  console.error('Error in onRestockRequestUpdate callback:', error);
                }
              }
              
              // Handle notifications based on event type
              if (payload.eventType === 'INSERT') {
                const productName = payload.new?.products?.name || 'Product';
                
                const notification = addNotification({
                  title: 'New Restock Request',
                  description: `${productName}: ${payload.new?.requested_quantity || 0} units requested`,
                  type: 'restock',
                  icon: '📦',
                  metadata: {
                    requestId: payload.new.id,
                    branchId: selectedBranch!.id,
                    action: 'new_request'
                  }
                });
                
                showToastForNotification(notification);
              }
              
              if (payload.eventType === 'UPDATE') {
                const oldStatus = payload.old?.status;
                const newStatus = payload.new?.status;
                
                if (oldStatus !== newStatus) {
                  const productName = payload.new?.products?.name || 'Product';
                  
                  if (newStatus === 'approved') {
                    const notification = addNotification({
                      title: 'Restock Approved',
                      description: `${productName} restock request approved`,
                      type: 'restock_approved',
                      icon: '✅',
                      metadata: {
                        requestId: payload.new.id,
                        invoiceNumber: payload.new.invoice_number,
                        action: 'restock_approved'
                      }
                    });
                    
                    showToastForNotification(notification);
                  } else if (newStatus === 'rejected') {
                    const notification = addNotification({
                      title: 'Restock Rejected',
                      description: `${productName} restock request rejected`,
                      type: 'restock_rejected',
                      icon: '❌',
                      metadata: {
                        requestId: payload.new.id,
                        action: 'restock_rejected'
                      }
                    });
                    
                    showToastForNotification(notification);
                  } else if (newStatus === 'fulfilled') {
                    const notification = addNotification({
                      title: 'Restock Fulfilled',
                      description: `${productName} has been restocked`,
                      type: 'restock_fulfilled',
                      icon: '🚚',
                      metadata: {
                        requestId: payload.new.id,
                        action: 'restock_fulfilled'
                      }
                    });
                    
                    showToastForNotification(notification);
                  }
                }
              }
            }
          )
          .subscribe((status: any) => {
            console.log('Branch channel status:', status);
          });
        
        channels.push(branchChannel);
      }

      // 2. User-specific notifications (restock request status changes)
      if (hasUser) {
        const userRestockChannel = supabase
          .channel(`user-restock:${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'restock_requests',
              filter: `requested_by=eq.${userId}`
            },
            async (payload: any) => {
              const oldStatus = payload.old?.status;
              const newStatus = payload.new?.status;
              const oldInvoice = payload.old?.invoice_number;
              const newInvoice = payload.new?.invoice_number;
              
              // Check if invoice was just added
              if (!oldInvoice && newInvoice) {
                try {
                  // Fetch product name
                  const { data: product, error } = await supabase
                    .from('products')
                    .select('name')
                    .eq('id', payload.new.product_id)
                    .single();
                  
                  const productName = product?.name || 'Product';
                  
                  const notification = addNotification({
                    title: 'Invoice Generated',
                    description: `Invoice ${newInvoice} for ${productName} restock`,
                    type: 'invoice',
                    icon: '🧾',
                    metadata: {
                      requestId: payload.new.id,
                      invoiceNumber: newInvoice,
                      action: 'view_invoice'
                    }
                  });
                  
                  showToastForNotification(notification);
                } catch (error) {
                  console.error('Error fetching product for invoice notification:', error);
                }
              }
              
              // Status change notifications
              if (oldStatus !== newStatus) {
                try {
                  const { data: product, error } = await supabase
                    .from('products')
                    .select('name')
                    .eq('id', payload.new.product_id)
                    .single();
                  
                  const productName = product?.name || 'Product';
                  
                  if (newStatus === 'approved') {
                    const notification = addNotification({
                      title: 'Request Approved',
                      description: `${productName} restock approved`,
                      type: 'restock_approved',
                      icon: '✅',
                      metadata: {
                        requestId: payload.new.id,
                        action: 'request_approved'
                      }
                    });
                    
                    showToastForNotification(notification);
                  } else if (newStatus === 'rejected') {
                    const notification = addNotification({
                      title: 'Request Rejected',
                      description: `${productName} restock rejected`,
                      type: 'restock_rejected',
                      icon: '❌',
                      metadata: {
                        requestId: payload.new.id,
                        action: 'request_rejected'
                      }
                    });
                    
                    showToastForNotification(notification);
                  } else if (newStatus === 'fulfilled') {
                    const notification = addNotification({
                      title: 'Request Fulfilled',
                      description: `${productName} restock delivered`,
                      type: 'restock_fulfilled',
                      icon: '🚚',
                      metadata: {
                        requestId: payload.new.id,
                        action: 'request_fulfilled'
                      }
                    });
                    
                    showToastForNotification(notification);
                  }
                } catch (error) {
                  console.error('Error fetching product for status notification:', error);
                }
              }
            }
          )
          .subscribe();
        
        channels.push(userRestockChannel);
      }

      // 3. Low stock notifications (for branch)
      if (hasBranch) {
        const lowStockChannel = supabase
          .channel(`low-stock:branch=${selectedBranch!.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'branch_inventory',
              filter: `branch_id=eq.${selectedBranch!.id}`
            },
            async (payload: any) => {
              const oldLowStock = payload.old?.low_stock;
              const newLowStock = payload.new?.low_stock;
              
              // Check if product just went into low stock
              if (!oldLowStock && newLowStock) {
                try {
                  const { data: product, error } = await supabase
                    .from('products')
                    .select('name')
                    .eq('id', payload.new.product_id)
                    .single();
                  
                  if (product) {
                    const notification = addNotification({
                      title: 'Low Stock Alert',
                      description: `${product.name} is running low`,
                      type: 'low_stock',
                      icon: '⚠️',
                      metadata: {
                        productId: payload.new.product_id,
                        branchId: selectedBranch!.id,
                        quantity: payload.new.quantity,
                        action: 'restock_now'
                      }
                    });
                    
                    showToastForNotification(notification);
                  }
                } catch (error) {
                  console.error('Error fetching product for low stock notification:', error);
                }
              }
            }
          )
          .subscribe();
        
        channels.push(lowStockChannel);
      }

      // 4. Sales notifications (for branch)
      if (hasBranch) {
        const salesChannel = supabase
          .channel(`sales:branch=${selectedBranch!.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'sales',
              filter: `branch_id=eq.${selectedBranch!.id}`
            },
            (payload: any) => {
              const notification = addNotification({
                title: 'New Sale',
                description: `Sale #${payload.new.id.slice(-8)} recorded`,
                type: 'sale',
                icon: '🛒',
                metadata: {
                  saleId: payload.new.id,
                  branchId: selectedBranch!.id,
                  action: 'view_sale'
                }
              });
              
              showToastForNotification(notification);
            }
          )
          .subscribe();
        
        channels.push(salesChannel);
      }

      setConnectionStatus('connected');
      console.log('All real-time subscriptions established');
      
    } catch (error) {
      console.error('Error setting up real-time subscriptions:', error);
      setConnectionStatus('disconnected');
      
      // Retry after 5 seconds if we have branch or user
      if (hasBranch || hasUser) {
        setTimeout(() => {
          setupRealtimeSubscriptions();
        }, 5000);
      }
    }

    // Return cleanup function
    return () => {
      channels.forEach(channel => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, [
    selectedBranch,
    userId,
    enableInvoiceNotifications,
    onInvoiceUpdate,
    onRestockRequestUpdate,
    cleanupRealtimeChannels,
    addNotification,
    showToastForNotification
  ]);

  // Initialize subscriptions only when we have branch or user
  useEffect(() => {
    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, [setupRealtimeSubscriptions]);

  // Helper function to manually trigger restock notification
  const triggerRestockNotification = useCallback(({
    title,
    description,
    type,
    metadata
  }: {
    title: string;
    description: string;
    type: 'restock' | 'restock_approved' | 'restock_rejected' | 'restock_fulfilled' | 'invoice';
    metadata?: any;
  }) => {
    const notification = addNotification({
      title,
      description,
      type,
      icon: type === 'invoice' ? '🧾' : 
            type === 'restock_approved' ? '✅' :
            type === 'restock_rejected' ? '❌' :
            type === 'restock_fulfilled' ? '🚚' : '📦',
      metadata
    });
    
    showToastForNotification(notification);
    return notification;
  }, [addNotification, showToastForNotification]);

  // Helper to filter notifications by type
  const getNotificationsByType = useCallback((type: string) => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  // Get unread notifications count
  const getUnreadCount = useCallback(() => {
    return notifications.filter(n => !n.seen).length;
  }, [notifications]);

  // Get recent notifications (last 24 hours)
  const getRecentNotifications = useCallback(() => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return notifications.filter(n => new Date(n.timestamp) > oneDayAgo);
  }, [notifications]);

  return {
    notifications,
    connectionStatus,
    addNotification,
    markNotificationAsSeen,
    markAllNotificationsAsSeen,
    clearAllNotifications,
    cleanupRealtimeChannels,
    setupRealtimeSubscriptions,
    triggerRestockNotification,
    getNotificationsByType,
    getUnreadCount,
    getRecentNotifications
  };
};